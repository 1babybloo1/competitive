// --- Firebase Configuration ---
// IMPORTANT: Replace with your actual Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI", // Replace with your real key
    authDomain: "poxelcomp.firebaseapp.com",
    projectId: "poxelcomp",
    storageBucket: "poxelcomp.appspot.com", // *** Ensure this is correct ***
    messagingSenderId: "620490990104",
    appId: "1:620490990104:web:709023eb464c7d886b996d",
};

// --- Initialize Firebase (Compat Version) ---
// Moved this block to the TOP to ensure firebase is initialized before use
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth(); // Define auth right after init
const db = firebase.firestore(); // Define db right after init

// --- URL Parameter Parsing & Logged-in User Check ---
const urlParams = new URLSearchParams(window.location.search);
const profileUidFromUrl = urlParams.get('uid'); // Get UID from ?uid=...
let loggedInUser = null; // Updated by onAuthStateChanged

// --- Admin Emails ---
const adminEmails = [
    'trixdesignsofficial@gmail.com', // Replace/add your admin emails
    'jackdmbell@outlook.com',
    'myrrr@myrrr.myrrr'
].map(email => email.toLowerCase()); // Normalize to lowercase

// --- Badge Configuration ---
const badgeConfig = {
    verified: {
        emails: ['jackdmbell@outlook.com', 'myrrr@myrrr.myrrr'].map(e => e.toLowerCase()),
        className: 'badge-verified', title: 'Verified'
    },
    creator: {
        emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()),
        className: 'badge-creator', title: 'Content Creator'
    },
    moderator: {
        emails: ['jackdmbell@outlook.com', 'mod_team@sample.org'].map(e => e.toLowerCase()),
        className: 'badge-moderator', title: 'Moderator'
    }
};

// --- DOM Elements ---
const profileContainer = document.getElementById('profile-content'); // Main container for profile data
const profileContent = document.getElementById('profile-content'); // Alias for clarity if used elsewhere
const loadingIndicator = document.getElementById('loading-profile');
const notLoggedInMsg = document.getElementById('not-logged-in');
const profilePicDiv = document.getElementById('profile-pic');
const usernameDisplay = document.getElementById('profile-username');
const emailDisplay = document.getElementById('profile-email');
const statsDisplay = document.getElementById('stats-display');
const profileLogoutBtn = document.getElementById('profile-logout-btn');
const adminTag = document.getElementById('admin-tag');
const rankDisplay = document.getElementById('profile-rank');
const titleDisplay = document.getElementById('profile-title');
const profileIdentifiersDiv = document.querySelector('.profile-identifiers'); // Parent for title selector
const profileBadgesContainer = document.getElementById('profile-badges-container');
// --- Ban Related DOM Elements ---
const banOverlay = document.getElementById('ban-overlay');
const banReasonDisplay = document.getElementById('ban-reason-display');

// --- Global/Scoped Variables ---
let allAchievements = null; // Cache for achievement definitions
let viewingUserProfileData = {}; // Cache for the profile *being viewed* (includes profile, stats, ban status)
let isTitleSelectorOpen = false;
let titleSelectorElement = null; // Reference to the created selector dropdown div
let currentProfileLoadAbortController = null; // To handle rapid navigation/auth changes

// --- Helper Function: Escape HTML ---
function escapeHtml(unsafe) {
   if (typeof unsafe !== 'string') {
        if (unsafe === null || unsafe === undefined) return '';
        try { unsafe = String(unsafe); } catch (e) { return ''; }
   }
   return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// --- Function to fetch all achievement definitions ---
async function fetchAllAchievements() {
    // Use cache if available
    if (allAchievements) return allAchievements;
    try {
        const snapshot = await db.collection('achievements').get();
        allAchievements = {};
        snapshot.forEach(doc => {
            allAchievements[doc.id] = { id: doc.id, ...doc.data() };
        });
        console.log("Fetched achievement definitions:", allAchievements);
        return allAchievements;
    } catch (error) {
        console.error("Error fetching achievement definitions:", error);
        return null; // Return null on error
    }
}

// --- Helper: Display Badges based on the viewed profile's data ---
function displayUserBadges(profileData) {
    if (!profileBadgesContainer) return;
    profileBadgesContainer.innerHTML = ''; // Clear existing badges
    const userEmail = profileData?.email;
    if (!userEmail) return;

    const emailLower = userEmail.toLowerCase();

    // Check Admin Tag based on VIEWED profile's email
    if (adminTag) {
        adminTag.style.display = adminEmails.includes(emailLower) ? 'inline-block' : 'none';
    }

    // Check other badges
    for (const badgeType in badgeConfig) {
        const config = badgeConfig[badgeType];
        if (config.emails.includes(emailLower)) {
            const badgeSpan = document.createElement('span');
            badgeSpan.classList.add('profile-badge', config.className);
            badgeSpan.setAttribute('title', config.title); // Tooltip for badge type
            profileBadgesContainer.appendChild(badgeSpan);
        }
    }
}

// --- Auth State Listener ---
auth.onAuthStateChanged(async (user) => {
    loggedInUser = user; // Update the global variable for logged-in user
    const targetUid = profileUidFromUrl || loggedInUser?.uid; // Determine whose profile to view

    console.log(`Auth state changed. Logged in: ${!!user}, Target UID: ${targetUid}`);

    // Abort any previous profile load if auth state changes quickly
    if (currentProfileLoadAbortController) {
        console.log("Aborting previous profile load request.");
        currentProfileLoadAbortController.abort();
    }

    if (targetUid) {
        // User is logged in OR a profile UID is specified in the URL
        loadingIndicator.style.display = 'block'; // Show loading initially
        notLoggedInMsg.style.display = 'none';
        profileContent.style.display = 'none'; // Hide content until loaded

        // Create a new AbortController for this load attempt
        currentProfileLoadAbortController = new AbortController();
        const signal = currentProfileLoadAbortController.signal;

        try {
            // Fetch achievements (uses cache if already fetched)
            if (!allAchievements) await fetchAllAchievements();

            // Load the profile data (handles cache, fetching, ban check, creation)
            await loadCombinedUserData(targetUid, signal); // Pass the signal

            // Show content after successful load
            loadingIndicator.style.display = 'none';
            profileContent.style.display = 'block';

            // Show/Hide logout button based on viewing own profile
            if (profileLogoutBtn) {
                 profileLogoutBtn.style.display = (loggedInUser && loggedInUser.uid === targetUid) ? 'inline-block' : 'none';
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                 console.log("Profile load aborted."); // Expected if user navigates away quickly
            } else {
                 console.error("Error during profile loading sequence:", error);
                 loadingIndicator.style.display = 'none';
                 profileContent.style.display = 'none';
                 notLoggedInMsg.innerHTML = '<p>Error loading profile data. Please try again later.</p>';
                 notLoggedInMsg.style.display = 'flex'; // Show error message
                 // Clear potentially inconsistent UI state
                 resetProfileUI();
            }
        } finally {
            // Clear the controller reference once done (or aborted/errored)
            currentProfileLoadAbortController = null;
        }

    } else {
        // No user logged in AND no profile UID in URL
        console.log('No user logged in and no profile UID in URL.');
        loadingIndicator.style.display = 'none';
        profileContent.style.display = 'none';
        notLoggedInMsg.innerHTML = '<p>You need to be logged in to view your profile, or specify a user UID in the URL.</p>';
        notLoggedInMsg.style.display = 'flex'; // Show appropriate message
        resetProfileUI(); // Clear any leftover data
    }
});

// --- Helper Function: Reset Profile UI elements ---
function resetProfileUI() {
    console.log("Resetting profile UI elements.");
    if (profileContainer) profileContainer.classList.remove('is-banned');
    if (banOverlay) banOverlay.style.display = 'none';
    if (banReasonDisplay) banReasonDisplay.style.display = 'none';
    if (usernameDisplay) usernameDisplay.textContent = '...';
    if (emailDisplay) emailDisplay.textContent = '...';
    if (profilePicDiv) profilePicDiv.textContent = '?';
    if (adminTag) adminTag.style.display = 'none';
    if (profileBadgesContainer) profileBadgesContainer.innerHTML = '';
    if (profileLogoutBtn) profileLogoutBtn.style.display = 'none';
    if (statsDisplay) statsDisplay.innerHTML = ''; // Clear stats
    updateProfileTitlesAndRank(null, false); // Reset rank/title display
    closeTitleSelector();
    viewingUserProfileData = {}; // Clear cached data state
}


// --- Helper Function: Client-Side User Profile Document Creation ---
// Creates a basic profile doc if one doesn't exist for the logged-in user viewing their own profile.
async function createUserProfileDocument(userId, authUser) {
    if (!userId || !authUser || authUser.uid !== userId) {
         console.error("createUserProfileDocument called with invalid arguments.");
         return null;
    }
    console.warn(`Attempting client-side creation/merge of user profile doc for own UID: ${userId}`);
    const userDocRef = db.collection("users").doc(userId);
    // Use provided display name/email, or generate defaults
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;
    const email = authUser.email || null; // Store email if available
    const defaultProfileData = {
        email: email,
        displayName: displayName,
        currentRank: "Unranked", // Default rank
        equippedTitle: "",       // Default title (empty)
        availableTitles: [],     // Start with no titles
        friends: [],             // Start with no friends
        createdAt: firebase.firestore.FieldValue.serverTimestamp() // Record creation time
    };
    try {
        // Use set with merge: true to create OR update fields without overwriting existing ones unnecessarily
        await userDocRef.set(defaultProfileData, { merge: true });
        console.log(`Successfully created/merged user profile document for UID: ${userId} via client`);
        // Return the data that was likely set (including potentially merged fields not set here)
        // It's better to re-fetch, but this provides a usable structure immediately
        const freshSnap = await userDocRef.get(); // Re-fetch immediately
        return freshSnap.exists ? { id: freshSnap.id, ...freshSnap.data() } : null;

    } catch (error) {
        console.error(`Error creating/merging user profile document client-side for UID ${userId}:`, error);
        alert("Error setting up your profile details. Please check your connection or contact support if the issue persists.");
        return null; // Indicate failure
    }
}

// --- Load Combined Data from Local Storage Cache ---
function loadCombinedDataFromCache(viewedUserId) {
    const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
    const cachedDataString = localStorage.getItem(cacheKey);
    if (cachedDataString) {
        try {
            const cachedFullData = JSON.parse(cachedDataString);
            // Basic validation of cached structure
            if (cachedFullData && typeof cachedFullData === 'object') {
                 viewingUserProfileData = cachedFullData; // Restore state from cache
                 console.log("Loaded combined data from cache for VIEWED UID:", viewedUserId, viewingUserProfileData);
                 // Display cached data immediately
                 displayProfileData(
                     viewingUserProfileData.profile,
                     viewingUserProfileData.stats,
                     viewingUserProfileData.isBanned || false, // Handle potential absence in old cache
                     viewingUserProfileData.banReason || null
                 );
                 return true; // Indicate cache was successfully loaded and displayed
            } else {
                 console.warn("Invalid data structure in cache for UID:", viewedUserId);
                 localStorage.removeItem(cacheKey); // Remove invalid cache
                 viewingUserProfileData = {}; // Reset state
                 return false;
            }
        } catch (error) {
            console.error("Error parsing combined cached data:", error);
            localStorage.removeItem(cacheKey); // Remove corrupted cache
            viewingUserProfileData = {}; // Reset state
            return false;
        }
    } else {
        // console.log("No combined data found in cache for VIEWED UID:", viewedUserId);
        viewingUserProfileData = {}; // Ensure state is clear if no cache
        return false;
    }
}

// --- Save Combined Data (Profile, Stats, Ban Status) to Local Storage Cache ---
function saveCombinedDataToCache(viewedUserId, combinedData) {
     if (!viewedUserId || !combinedData) return;
     // Ensure we are saving the full structure including ban status
     if (typeof combinedData.isBanned === 'undefined') {
          console.warn("Attempting to save cache without ban status for UID:", viewedUserId);
          // Optionally fetch ban status here if missing, or save incomplete data
          // For simplicity now, we assume combinedData includes it when this function is called
     }
     const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
     try {
         localStorage.setItem(cacheKey, JSON.stringify(combinedData));
         // console.log("Saved combined data to cache for VIEWED UID:", viewedUserId);
     } catch(error) {
         // Handle potential storage errors (e.g., quota exceeded)
         console.error("Error saving combined data to cache:", error);
         // Optionally try to clear some old cache items here
     }
}

// --- Load Combined User Data (Profile, Stats, Ban Status) ---
// Fetches data from Firestore, handles profile creation for self, checks ban status.
async function loadCombinedUserData(targetUserId, signal) {
    console.log(`Loading combined user data for TARGET UID: ${targetUserId}`);

    // --- Reset Visual State ---
    // Clear previous ban state visually before loading/checking cache
    if (profileContainer) profileContainer.classList.remove('is-banned');
    if (banOverlay) banOverlay.style.display = 'none';
    if (banReasonDisplay) banReasonDisplay.style.display = 'none';

    // --- Attempt to load from cache first for faster initial display ---
    const cacheLoaded = loadCombinedDataFromCache(targetUserId);
    if (!cacheLoaded) {
        // If cache didn't load, show placeholder text while fetching fresh data
        if (statsDisplay) statsDisplay.innerHTML = '<p>Loading stats...</p>';
        updateProfileTitlesAndRank(null, false); // Reset rank/title display
    }

    // --- Define Firestore references ---
    const userProfileRef = db.collection('users').doc(targetUserId);
    const leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId);
    const banDocRef = db.collection('banned_users').doc(targetUserId);

    try {
        // --- Fetch data concurrently ---
        // Note: We don't use the signal directly with compat SDK's get()
        // AbortController primarily helps avoid *processing* the result if aborted.
        const [profileSnap, statsSnap, banSnap] = await Promise.all([
            userProfileRef.get(),
            leaderboardStatsRef.get(),
            banDocRef.get()
        ]);

        // Check if the load operation was aborted after fetches started
        if (signal?.aborted) { throw new Error('AbortError'); }

        // --- Process Profile Data ---
        let profileData = null;
        if (profileSnap.exists) {
            profileData = { id: profileSnap.id, ...profileSnap.data() };
        } else {
            // Profile doesn't exist in Firestore 'users' collection
            console.warn(`User profile document does NOT exist for UID: ${targetUserId}`);
            // If the logged-in user is viewing their *own* non-existent profile, attempt to create it
            if (loggedInUser && loggedInUser.uid === targetUserId) {
                 console.log(`Attempting profile creation for self (UID: ${targetUserId})`);
                 profileData = await createUserProfileDocument(targetUserId, loggedInUser);
                 if (!profileData) {
                     // Handle case where profile creation failed
                     throw new Error(`Profile creation failed for own UID ${targetUserId}. Cannot proceed.`);
                 }
            } else {
                 // Viewing someone else's profile that doesn't exist
                 console.error(`Cannot find profile for user UID: ${targetUserId}. Displaying 'Not Found'.`);
                 // Display "User Not Found" state (handled later by passing null profileData)
            }
        }

        // --- Process Stats Data ---
        // Use statsSnap.exists property (Compat SDK)
        const statsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null;

        // --- Process Ban Data ---
        // Use banSnap.exists property (Compat SDK)
        const isBanned = banSnap.exists;
        const banReason = isBanned ? (banSnap.data()?.reason || "No reason specified") : null;

        // --- Combine and Update State ---
        // Store all relevant data together for the viewed profile
        viewingUserProfileData = {
            profile: profileData,
            stats: statsData,
            isBanned: isBanned,
            banReason: banReason
        };
        console.log("Fetched Data - Profile:", profileData);
        console.log("Fetched Data - Stats:", statsData);
        console.log(`Fetched Data - Banned: ${isBanned}`);

        // --- Display, Cache, Check Achievements ---
        displayProfileData(
            viewingUserProfileData.profile,
            viewingUserProfileData.stats,
            viewingUserProfileData.isBanned,
            viewingUserProfileData.banReason
        );

        // Save the fetched (or created) data (including ban status) to cache
        saveCombinedDataToCache(targetUserId, viewingUserProfileData);

        // --- Achievement Check Logic (Only if profile exists and is not banned) ---
        if (profileData && !isBanned) {
            // Check achievements only if viewing own profile and stats are available
             if (loggedInUser && loggedInUser.uid === targetUserId && viewingUserProfileData.stats) {
                 // Ensure achievement definitions are loaded
                 if (!allAchievements) await fetchAllAchievements();

                 if (allAchievements) {
                     const potentiallyUpdatedProfile = await checkAndGrantAchievements(
                         targetUserId,
                         viewingUserProfileData.profile, // Pass current profile state
                         viewingUserProfileData.stats   // Pass current stats
                     );
                     // If achievements were granted and profile data changed:
                     if (potentiallyUpdatedProfile) {
                         console.log("Achievements granted, profile updated locally. Refreshing UI.");
                         viewingUserProfileData.profile = potentiallyUpdatedProfile; // Update state
                         // Re-display with updated profile data (still not banned)
                         displayProfileData(
                            viewingUserProfileData.profile,
                            viewingUserProfileData.stats,
                            viewingUserProfileData.isBanned, // isBanned remains false here
                            viewingUserProfileData.banReason
                         );
                         // Re-cache the updated data
                         saveCombinedDataToCache(targetUserId, viewingUserProfileData);
                     }
                 } else { console.warn("Could not check achievements: Definitions unavailable."); }
             } else {
                  if (!loggedInUser || loggedInUser.uid !== targetUserId) {
                      // console.log("Skipping achievement check: Viewing another user's profile.");
                  } else if (!viewingUserProfileData.stats) {
                      // console.log("Skipping achievement check: No leaderboard stats found for own profile.");
                  }
             }
        } else if (isBanned) {
             console.log("Skipping achievement check: User is banned.");
        } else if (!profileData) {
             console.log("Skipping achievement check: Profile data not found.");
        }

    } catch (error) {
        // Catch errors from Promise.all or subsequent processing
        if (error.message === 'AbortError') {
             throw error; // Re-throw AbortError to be handled by the caller (onAuthStateChanged)
        }
        console.error(`Error in loadCombinedUserData processing for TARGET UID ${targetUserId}:`, error);
        if (error.stack) console.error("DEBUG: Full error stack:", error.stack);

        // If cache wasn't loaded successfully before the error, show an error message
        if (!cacheLoaded) {
             if (statsDisplay) statsDisplay.innerHTML = '<p>Error loading data.</p>';
             updateProfileTitlesAndRank(null, false); // Reset titles/rank display
             // Optionally display a more prominent error in the main content area
             loadingIndicator.style.display = 'none';
             profileContent.style.display = 'none';
             notLoggedInMsg.innerHTML = '<p>Error loading profile data. Please try again later.</p>';
             notLoggedInMsg.style.display = 'flex';
             resetProfileUI(); // Ensure UI is fully reset
        } else {
             // If cache *was* loaded, we might already be showing cached data.
             // Log the error but don't necessarily clear the cached view immediately.
             console.warn("Error fetching fresh data, continuing with cached view (if available).");
             // Optionally show a subtle indicator that data might be stale?
        }
        // Rethrow the error if needed for higher-level handling
        // throw error;
    }
}


// --- Central Function to Display Profile Data (Handles Banned State) ---
function displayProfileData(profileData, statsData, isBanned = false, banReason = null) {

    // --- Reset Ban Styles First (applied again below if needed) ---
    if (profileContainer) profileContainer.classList.remove('is-banned');
    if (banOverlay) banOverlay.style.display = 'none';
    if (banReasonDisplay) banReasonDisplay.style.display = 'none';

    // --- Handle Case: Profile Not Found ---
    if (!profileData) {
        console.log("Displaying 'User Not Found' state.");
        if (usernameDisplay) usernameDisplay.textContent = "User Not Found";
        if (emailDisplay) emailDisplay.textContent = "";
        if (profilePicDiv) profilePicDiv.textContent = "?";
        if (adminTag) adminTag.style.display = 'none';
        if (profileBadgesContainer) profileBadgesContainer.innerHTML = '';
        updateProfileTitlesAndRank(null, false); // Clear rank/title
        displayStats(null); // Clear stats
        if (profileLogoutBtn) profileLogoutBtn.style.display = 'none'; // Hide logout
        closeTitleSelector();
        return; // Stop further processing
    }

    // --- Display Normal Profile Info ---
    const displayName = profileData.displayName || 'User';
    const email = profileData.email || 'No email provided';
    if (usernameDisplay) usernameDisplay.textContent = displayName;
    if (emailDisplay) emailDisplay.textContent = email;
    if (profilePicDiv) profilePicDiv.textContent = displayName.charAt(0).toUpperCase() || '?';

    // Display badges and admin tag
    displayUserBadges(profileData);

    // Display leaderboard stats
    displayStats(statsData);

    // Determine if viewing own profile
    const isOwnProfile = loggedInUser && loggedInUser.uid === profileData.id;

    // --- Apply Banned State Styling and Logic ---
    if (isBanned) {
        console.log("Applying banned styles for user:", profileData.id);
        if (profileContainer) profileContainer.classList.add('is-banned');
        if (banOverlay) banOverlay.style.display = 'block'; // Show the BANNED tag
        if (banReasonDisplay && banReason) {
            banReasonDisplay.textContent = `Reason: ${escapeHtml(banReason)}`;
            banReasonDisplay.style.display = 'block';
        }
        // Hide rank/title and disable interaction when banned
        updateProfileTitlesAndRank(null, false);
        closeTitleSelector(); // Ensure title selector is closed and unusable
    } else {
        // --- Not Banned: Display Rank/Title Normally ---
        // Allow title interaction only if it's the user's own profile
         updateProfileTitlesAndRank(profileData, isOwnProfile);
    }

    // Show/hide logout button (remains visible even if banned, if it's own profile)
     if (profileLogoutBtn) {
         profileLogoutBtn.style.display = isOwnProfile ? 'inline-block' : 'none';
     }
}


// --- Check and Grant Achievements ---
// Checks if user stats meet criteria for unearned achievements and updates Firestore if needed.
async function checkAndGrantAchievements(userId, currentUserProfile, currentUserStats) {
    // Pre-conditions check
    if (!allAchievements || !userId || !currentUserProfile || !currentUserStats) {
        console.warn("Skipping achievement check due to missing data.", { hasDefs: !!allAchievements, userId, hasProfile: !!currentUserProfile, hasStats: !!currentUserStats });
        return null; // Cannot proceed
    }
    console.log(`Checking achievements for UID ${userId}`);

    try {
        // 1. Get current unlocked achievements for the user
        const userAchievementsRef = db.collection('userAchievements').doc(userId);
        const userAchievementsDoc = await userAchievementsRef.get();
        // Use .exists property (Compat SDK) and provide default empty array
        const unlockedIds = userAchievementsDoc.exists ? (userAchievementsDoc.data()?.unlocked || []) : [];

        // 2. Determine new achievements to grant based on stats vs criteria
        let newAchievementsToUnlock = []; // Store IDs of newly unlocked achievements
        let rewardsToApply = { titles: [], rank: null, rankPoints: 0 }; // Accumulate rewards
        let needsDbUpdate = false; // Flag if any Firestore writes are needed

        for (const achievementId in allAchievements) {
             // Skip if already unlocked
             if (unlockedIds.includes(achievementId)) continue;

             const achievement = allAchievements[achievementId];
             let criteriaMet = false;

             // Check criteria (currently supports single stat check)
             if (achievement.criteria?.stat && currentUserStats[achievement.criteria.stat] !== undefined) {
                 const statValue = currentUserStats[achievement.criteria.stat];
                 const requiredValue = achievement.criteria.value;
                 switch (achievement.criteria.operator) {
                     case '>=': criteriaMet = statValue >= requiredValue; break;
                     case '<=': criteriaMet = statValue <= requiredValue; break;
                     case '==': criteriaMet = statValue == requiredValue; break; // Use == for loose comparison if needed
                     case '>':  criteriaMet = statValue > requiredValue; break;
                     case '<':  criteriaMet = statValue < requiredValue; break;
                     default: console.warn(`Unknown operator ${achievement.criteria.operator} for achievement ${achievementId}`);
                 }
             } else if (achievement.criteria) {
                  console.warn(`Criteria invalid or stat missing for achievement ${achievementId}`);
             } // Add more complex criteria checks here if needed (e.g., multiple stats, specific event flags)

             // If criteria met, add to list and collect rewards
             if (criteriaMet) {
                 console.log(`Criteria MET for achievement: ${achievement.name || achievementId}`);
                 newAchievementsToUnlock.push(achievementId);
                 needsDbUpdate = true;
                 // Accumulate rewards
                 if (achievement.rewards?.title) { rewardsToApply.titles.push(achievement.rewards.title); }
                 if (achievement.rewards?.rank) { rewardsToApply.rank = achievement.rewards.rank; } // Note: Last rank reward encountered will overwrite previous ones in this run
                 if (achievement.rewards?.rankPoints) { rewardsToApply.rankPoints += achievement.rewards.rankPoints; }
                 // Add other reward types here (e.g., currency, items)
             }
        } // End loop through all achievement definitions

        // 3. If new achievements were unlocked, update Firestore and local state
        if (needsDbUpdate && newAchievementsToUnlock.length > 0) {
            console.log(`Unlocking ${newAchievementsToUnlock.length} new achievements:`, newAchievementsToUnlock);
            const batch = db.batch();
            const userProfileRef = db.collection('users').doc(userId); // Ref to user's main profile

            // --- Update UserAchievements Collection ---
            // Add the new achievement IDs to the user's 'unlocked' array
            batch.set(userAchievementsRef, {
                 unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsToUnlock)
            }, { merge: true }); // Use merge:true to add to existing array or create if doc doesn't exist

            // --- Apply Rewards to User Profile ---
            const profileUpdateData = {}; // Object to hold profile updates for Firestore batch
            let updatedLocalProfile = { ...currentUserProfile }; // Create copy of local profile to update

            // Apply Title Rewards
            if (rewardsToApply.titles.length > 0) {
                 profileUpdateData.availableTitles = firebase.firestore.FieldValue.arrayUnion(...rewardsToApply.titles);
                 // Update local profile state immediately
                 updatedLocalProfile.availableTitles = [...new Set([...(updatedLocalProfile.availableTitles || []), ...rewardsToApply.titles])];

                 // Auto-equip the first new title *if* no title is currently equipped
                 if (!updatedLocalProfile.equippedTitle) {
                     const titleToEquip = rewardsToApply.titles[0];
                     profileUpdateData.equippedTitle = titleToEquip;
                     updatedLocalProfile.equippedTitle = titleToEquip;
                     console.log(`Auto-equipping new title: ${titleToEquip}`);
                 }
            }

            // Apply Rank Reward (if any)
            if (rewardsToApply.rank) {
                 profileUpdateData.currentRank = rewardsToApply.rank;
                 updatedLocalProfile.currentRank = rewardsToApply.rank; // Update local state
            }

            // Apply Rank Points (TODO: Needs logic for how points affect rank)
            if (rewardsToApply.rankPoints > 0) {
                // Example: Just store total points if needed, rank logic might be separate
                // profileUpdateData.totalRankPoints = firebase.firestore.FieldValue.increment(rewardsToApply.rankPoints);
                // updatedLocalProfile.totalRankPoints = (updatedLocalProfile.totalRankPoints || 0) + rewardsToApply.rankPoints;
                console.warn("Rank point rewards not fully implemented yet.");
            }

             // Ensure defaults if fields were previously null/undefined after updates
             if (!updatedLocalProfile.currentRank) {
                  profileUpdateData.currentRank = 'Unranked'; // Should be set by reward, but as fallback
                  updatedLocalProfile.currentRank = 'Unranked';
             }
             if (!updatedLocalProfile.equippedTitle && !profileUpdateData.equippedTitle) { // Check if still no title after potential auto-equip
                  profileUpdateData.equippedTitle = ''; // Ensure it's an empty string, not null/undefined
                  updatedLocalProfile.equippedTitle = '';
             }


            // Add profile updates to the batch if there are any changes
            let committedProfileUpdate = false;
            if (Object.keys(profileUpdateData).length > 0) {
                 batch.update(userProfileRef, profileUpdateData);
                 committedProfileUpdate = true;
            }

            // --- Commit Firestore Batch ---
            await batch.commit();
            console.log(`Firestore batch committed for achievements for UID ${userId}. Profile updated in batch: ${committedProfileUpdate}`);

            // Return the updated local profile object if changes were made to it
            return committedProfileUpdate ? updatedLocalProfile : null;

        } else {
            // console.log(`No new achievements unlocked for UID ${userId}.`);
            return null; // No changes made
        }

    } catch (error) {
        console.error(`Error during check/grant achievements for UID ${userId}:`, error);
        return null; // Indicate failure
    }
}


// --- Display Stats Grid ---
function displayStats(statsData) {
    if (!statsDisplay) return;
    statsDisplay.innerHTML = ''; // Clear previous stats

    if (!statsData || typeof statsData !== 'object' || Object.keys(statsData).length === 0) {
        statsDisplay.innerHTML = '<p>Leaderboard stats not available for this user.</p>';
        return;
    }

    // Define the order and formatting for stats
    const statsToShow = [
        { key: 'wins', label: 'Wins' },
        { key: 'points', label: 'Points' },
        { key: 'kdRatio', label: 'K/D Ratio', format: (val) => typeof val === 'number' ? val.toFixed(2) : val },
        { key: 'matchesPlayed', label: 'Matches Played', fallbackKey: 'matches'}, // Use fallback if primary key missing
        { key: 'losses', label: 'Losses' }
        // Add more stats here as needed
    ];

    let itemsAdded = 0;
    statsToShow.forEach(statInfo => {
         const key = statInfo.key;
         const fallbackKey = statInfo.fallbackKey;
         let value;

         if (statsData[key] !== undefined && statsData[key] !== null) {
             value = statsData[key];
         } else if (fallbackKey && statsData[fallbackKey] !== undefined && statsData[fallbackKey] !== null) {
             value = statsData[fallbackKey]; // Use fallback value
         } else {
             value = '-'; // Value not found
         }

         // Don't display '-' if we want to hide missing stats, otherwise format
         // if (value !== '-') {
             const formattedValue = statInfo.format ? statInfo.format(value) : value;
             statsDisplay.appendChild(createStatItem(statInfo.label, formattedValue));
             itemsAdded++;
         // }
    });


    // Fallback message if no relevant stats were found in the data object after filtering
    if (itemsAdded === 0) {
        statsDisplay.innerHTML = '<p>No specific leaderboard stats found to display.</p>';
    }
}


// --- Helper: Create a Single Stat Item Element ---
function createStatItem(title, value) {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('stat-item');

    const titleH4 = document.createElement('h4');
    titleH4.textContent = title;

    const valueP = document.createElement('p');
    // Display the value, defaulting to '-' if null/undefined
    valueP.textContent = (value !== null && value !== undefined) ? escapeHtml(value) : '-';

    itemDiv.appendChild(titleH4);
    itemDiv.appendChild(valueP);
    return itemDiv;
}

// --- Helper: Update Profile Rank/Title Display ---
// Handles displaying rank, title, and enabling title interaction if allowed.
// Handles the null case for banned users or missing profiles.
function updateProfileTitlesAndRank(profileData, allowInteraction) {
    if (!rankDisplay || !titleDisplay) {
        console.warn("Rank or Title display element not found.");
        return;
    }

    // Always remove listener first to prevent duplicates if called multiple times
    titleDisplay.classList.remove('selectable-title');
    titleDisplay.removeEventListener('click', handleTitleClick);

    if (profileData && typeof profileData === 'object') {
        // --- Profile Data Exists (User Not Banned) ---
        const rank = profileData.currentRank || 'Unranked';
        const title = profileData.equippedTitle || ''; // Use empty string if null/undefined
        const availableTitles = profileData.availableTitles || [];

        // Display Rank
        rankDisplay.textContent = rank;
        // Apply rank-specific CSS class for styling (convert rank to lowercase, replace spaces with hyphens)
        rankDisplay.className = `profile-rank-display rank-${rank.toLowerCase().replace(/\s+/g, '-')}`;

        // Display Title
        if (title) {
            titleDisplay.textContent = escapeHtml(title);
            titleDisplay.style.display = 'inline-block'; // Show the title element

            // Enable interaction only if allowed AND there are titles to choose from
            if (allowInteraction && availableTitles.length > 0) {
                titleDisplay.classList.add('selectable-title');
                titleDisplay.addEventListener('click', handleTitleClick);
            }
        } else {
            // No title equipped
            titleDisplay.textContent = '';
            titleDisplay.style.display = 'none'; // Hide the title element
        }
    } else {
        // --- Profile Data is Null (User Banned or Not Found) ---
        rankDisplay.textContent = '---'; // Indicate rank unavailable
        rankDisplay.className = 'profile-rank-display rank-unranked'; // Default style
        titleDisplay.textContent = '';
        titleDisplay.style.display = 'none';
        // Ensure interaction is disabled and selector closed
        titleDisplay.classList.remove('selectable-title');
        titleDisplay.removeEventListener('click', handleTitleClick);
        closeTitleSelector();
    }
}


// --- Handle Clicks on the Equipped Title (to open selector) ---
function handleTitleClick(event) {
    event.stopPropagation(); // Prevent click from bubbling up to document listener immediately

    // Check if the user is allowed to change title (viewing own profile, not banned)
    if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id || viewingUserProfileData.isBanned) {
        console.log("Title interaction blocked (not own profile or banned).");
        return;
    }

    if (isTitleSelectorOpen) {
        closeTitleSelector();
    } else if (viewingUserProfileData.profile?.availableTitles?.length > 0) {
        // Only open if there are actually titles available
        openTitleSelector();
    } else {
        console.log("Title clicked, but no available titles found in profile data.");
        // Optionally provide feedback like a tooltip "No other titles available"
    }
}

// --- Open Title Selector Dropdown ---
function openTitleSelector() {
    // Double-check conditions - should already be verified by handleTitleClick, but good practice
    if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id || viewingUserProfileData.isBanned) return;
    if (isTitleSelectorOpen || !profileIdentifiersDiv || !viewingUserProfileData.profile?.availableTitles?.length > 0) return;

    const availableTitles = viewingUserProfileData.profile.availableTitles;
    const currentEquippedTitle = viewingUserProfileData.profile.equippedTitle || '';

    // Create the selector element if it doesn't exist
    if (!titleSelectorElement) {
        titleSelectorElement = document.createElement('div');
        titleSelectorElement.className = 'title-selector';
        // Append inside the identifiers div, which is relatively positioned
        profileIdentifiersDiv.appendChild(titleSelectorElement);
    }

    titleSelectorElement.innerHTML = ''; // Clear previous options

    // Add a "Remove Title" option if a title is currently equipped
    if (currentEquippedTitle) {
        const removeOption = document.createElement('button');
        removeOption.className = 'title-option remove-title-option'; // Add specific class if needed
        removeOption.dataset.title = ""; // Set dataset.title to empty string for removal
        removeOption.type = 'button';
        removeOption.textContent = '(Remove Title)';
        removeOption.setAttribute('aria-pressed', 'false');
        removeOption.addEventListener('click', handleTitleOptionClick);
        titleSelectorElement.appendChild(removeOption);
    }


    // Create buttons for each available title
    availableTitles.forEach(titleOptionText => {
        const optionElement = document.createElement('button');
        optionElement.className = 'title-option';
        optionElement.dataset.title = titleOptionText; // Store title in data attribute
        optionElement.type = 'button'; // Explicitly set type
        optionElement.textContent = escapeHtml(titleOptionText);

        // Highlight the currently equipped title
        if (titleOptionText === currentEquippedTitle) {
            optionElement.classList.add('currently-equipped');
            optionElement.setAttribute('aria-pressed', 'true'); // ARIA for accessibility
        } else {
            optionElement.setAttribute('aria-pressed', 'false');
        }

        optionElement.addEventListener('click', handleTitleOptionClick);
        titleSelectorElement.appendChild(optionElement);
    });

    titleSelectorElement.style.display = 'block'; // Show the dropdown
    isTitleSelectorOpen = true;

    // Add a one-time click listener to the document to close the selector
    // Use setTimeout to ensure this listener is added *after* the current click event finishes
    setTimeout(() => {
        document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true });
    }, 0);
}


// --- Close Title Selector Dropdown ---
function closeTitleSelector() {
    if (!isTitleSelectorOpen || !titleSelectorElement) return;
    titleSelectorElement.style.display = 'none'; // Hide the dropdown
    isTitleSelectorOpen = false;
    // Remove the document click listener if it hasn't already been removed by firing
    document.removeEventListener('click', handleClickOutsideTitleSelector, { capture: true });
}

// --- Handle Clicks Outside the Selector (or on title again) to Close ---
function handleClickOutsideTitleSelector(event) {
    if (!isTitleSelectorOpen) return; // Should not happen if listener is removed correctly, but safe check

    // Check if the click was inside the selector itself or on the title display element
    const isClickInsideSelector = titleSelectorElement && titleSelectorElement.contains(event.target);
    const isClickOnTitleDisplay = titleDisplay && titleDisplay.contains(event.target);

    // If the click was *outside* both the selector and the title display, close the selector
    if (!isClickInsideSelector && !isClickOnTitleDisplay) {
        closeTitleSelector();
    } else {
        // If the click was *inside* (e.g., scrolling), re-attach the listener
        // because the 'once: true' option automatically removes it after firing once.
        document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true });
    }
}


// --- Handle Clicks on a Title Option in the Dropdown ---
async function handleTitleOptionClick(event) {
    event.stopPropagation(); // Prevent click from closing the dropdown via document listener

    const selectedTitle = event.currentTarget.dataset.title; // Get title from data attribute
    const currentUserId = loggedInUser?.uid;
    const currentlyViewedProfile = viewingUserProfileData.profile;

    // --- Safety Checks ---
    if (!currentUserId || !currentlyViewedProfile || currentUserId !== currentlyViewedProfile.id || viewingUserProfileData.isBanned) {
        console.error("Attempted to change title under invalid conditions (wrong user, banned, etc.).");
        closeTitleSelector();
        return;
    }

    const currentEquipped = currentlyViewedProfile.equippedTitle || '';

    // If the selected title is the same as the current one, just close (do nothing)
    // selectedTitle can be "" if "Remove Title" was clicked
    if (selectedTitle === currentEquipped) {
        closeTitleSelector();
        return;
    }
    // --- End Safety Checks ---

    closeTitleSelector(); // Close dropdown immediately

    // --- Update UI Temporarily ---
    if (titleDisplay) {
         titleDisplay.textContent = "Updating...";
         titleDisplay.classList.remove('selectable-title'); // Disable clicking while updating
         titleDisplay.removeEventListener('click', handleTitleClick); // Remove listener explicitly
    }


    // --- Update Firestore ---
    try {
        const userProfileRef = db.collection('users').doc(currentUserId);
        await userProfileRef.update({
            equippedTitle: selectedTitle // Update the equippedTitle field
        });
        console.log(`Firestore 'users' doc updated equippedTitle to "${selectedTitle}" for UID ${currentUserId}`);

        // --- Update Local State and UI on Success ---
        viewingUserProfileData.profile.equippedTitle = selectedTitle; // Update cached state
        saveCombinedDataToCache(currentUserId, viewingUserProfileData); // Save updated state to cache
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true); // Re-render rank/title display (enables interaction again)

    } catch (error) {
        console.error("Error updating equipped title in Firestore 'users':", error);
        alert("Failed to update your title. Please try again.");

        // --- Revert Local State and UI on Failure ---
        if (viewingUserProfileData.profile) {
            // Revert local state to what it was before the attempt
            viewingUserProfileData.profile.equippedTitle = currentEquipped;
        }
        // Re-render with the original title, allowing interaction again
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true);
    }
}


// --- Logout Button Event Listener ---
if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener('click', () => {
        const userId = loggedInUser?.uid; // Get UID before potential sign out

        // Clean up UI elements related to interaction state
        if (titleDisplay) titleDisplay.removeEventListener('click', handleTitleClick);
        closeTitleSelector(); // Ensure selector is closed on logout

        auth.signOut().then(() => {
            console.log('User signed out successfully.');
            // Clear cached data for the logged-out user
            if (userId) {
                 localStorage.removeItem(`poxelProfileCombinedData_${userId}`);
                 console.log(`Cleared cache for UID: ${userId}`);
            }
            viewingUserProfileData = {}; // Clear global state variable
            // The onAuthStateChanged listener will handle redirecting or updating the UI
            // to the "not logged in" state.
        }).catch((error) => {
            console.error('Sign out error:', error);
            alert('Error signing out. Please try again.');
            // Re-attach listener if signout fails? Maybe not necessary if state is inconsistent.
        });
    });
} else {
    console.warn("Logout button not found.");
}

// --- Initial log ---
console.log("Profile script initialized.");
// Initial profile load is triggered by the onAuthStateChanged listener upon script execution.
```
