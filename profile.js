const firebaseConfig = {
    apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI", // Replace if necessary, keep private
    authDomain: "poxelcomp.firebaseapp.com",
    projectId: "poxelcomp",
    storageBucket: "poxelcomp.firebasestorage.app",
    messagingSenderId: "620490990104",
    appId: "1:620490990104:web:709023eb464c7d886b996d",
};

// --- Initialize Firebase ---
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// --- Cloudinary Configuration ---
const CLOUDINARY_CLOUD_NAME = "djttn4xvk"; // <-- REPLACE if different
const CLOUDINARY_UPLOAD_PRESET = "compmanage"; // <-- REPLACE if different

// --- URL Parameter Parsing & Logged-in User Check ---
const urlParams = new URLSearchParams(window.location.search);
const profileUidFromUrl = urlParams.get('uid');
let loggedInUser = null; // Initially null, set by onAuthStateChanged

// --- Admin Emails ---
const adminEmails = [
    'trixdesignsofficial@gmail.com',
    'jackdmbell@outlook.com',
    'myrrr@myrrr.myrrr'
].map(email => email.toLowerCase());

// --- Badge Configuration ---
const badgeConfig = {
    verified: { emails: ['jackdmbell@outlook.com', 'myrrr@myrrr.myrrr', 'leezak5555@gmail.com'].map(e => e.toLowerCase()), className: 'badge-verified', title: 'Verified' },
    creator: { emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()), className: 'badge-creator', title: 'Content Creator' },
    moderator: { emails: ['jackdmbell@outlook.com', 'mod_team@sample.org'].map(e => e.toLowerCase()), className: 'badge-moderator', title: 'Moderator' } // Add actual moderator emails
};

// --- DOM Elements ---
const profileContent = document.getElementById('profile-content');
const loadingIndicator = document.getElementById('loading-profile');
const notLoggedInMsg = document.getElementById('not-logged-in');
// Profile Pic Elements
const profilePicDiv = document.getElementById('profile-pic');
const profileImage = document.getElementById('profile-image');
const profileInitials = document.getElementById('profile-initials');
const editProfilePicIcon = document.getElementById('edit-profile-pic-icon');
const profilePicInput = document.getElementById('profile-pic-input');
// Other Profile Elements
const usernameDisplay = document.getElementById('profile-username');
const emailDisplay = document.getElementById('profile-email'); // Kept for structure, hidden by CSS
const competitiveStatsDisplay = document.getElementById('stats-display');
const profileLogoutBtn = document.getElementById('profile-logout-btn');
const adminTag = document.getElementById('admin-tag');
const rankDisplay = document.getElementById('profile-rank');
const titleDisplay = document.getElementById('profile-title');
const profileIdentifiersDiv = document.querySelector('.profile-identifiers');
const profileBadgesContainer = document.getElementById('profile-badges-container');
const poxelStatsSection = document.getElementById('poxel-stats-section');
const poxelStatsDisplay = document.getElementById('poxel-stats-display');
// Modal Elements
const editModal = document.getElementById('edit-modal');
const modalImage = document.getElementById('image-to-crop');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalApplyBtn = document.getElementById('modal-apply-btn');
const modalSpinner = document.getElementById('modal-spinner');
// Friend System Elements
const friendshipControlsContainer = document.getElementById('friendship-controls-container');
const friendsSection = document.getElementById('friends-section');
const friendsListUl = document.getElementById('friends-list');
const incomingListUl = document.getElementById('incoming-requests-list');
const outgoingListUl = document.getElementById('outgoing-requests-list');
const incomingCountSpan = document.getElementById('incoming-count');
const outgoingCountSpan = document.getElementById('outgoing-count');
const friendsTabsContainer = document.querySelector('.friends-tabs');
// Achievement Section Elements (NEW)
const achievementsSection = document.getElementById('achievements-section');
const achievementsListContainer = document.getElementById('achievements-list-container');


// --- Global/Scoped Variables ---
let allAchievements = null; // Cache for achievement definitions
let viewingUserProfileData = {}; // Data of the profile being viewed {profile: {}, stats: {}}
let viewerProfileData = null; // Data of the logged-in user (viewer), including their friends map
let miniProfileCache = {}; // Simple cache for friend display names/pfps { userId: { displayName, profilePictureUrl, id } }
let isTitleSelectorOpen = false;
let titleSelectorElement = null;
let cropper = null; // To hold the Cropper.js instance
let isOwnProfile = false; // Flag to check if viewing own profile

// =============================================================================
// --- CORE FUNCTIONS ---
// =============================================================================

// --- Fetch Poxel.io Stats from API ---
async function fetchPoxelStats(username) {
    // Validate username
    if (!username || typeof username !== 'string' || username.trim() === '') {
        console.warn("fetchPoxelStats: Invalid username provided.");
        return null;
    }
    console.log(`Fetching Poxel.io stats for: ${username}`);
    try {
        // Adjust URL if needed (remove /dev prefix for production?)
        const apiUrl = `https://dev-usa-1.poxel.io/api/profile/stats/${encodeURIComponent(username)}`;
        const res = await fetch(apiUrl, {
            // Consider adding cache control or other headers if necessary
             headers: { "Content-Type": "application/json" }
             // mode: 'no-cors' // Remove this if API supports CORS properly
        });

        if (!res.ok) {
            let errorMsg = `HTTP error ${res.status}`;
             if (res.status === 404) {
                errorMsg = "User not found on Poxel.io";
             } else {
                try {
                    const errorData = await res.json();
                    errorMsg = errorData.message || errorData.error || errorMsg;
                } catch (parseError) { /* Ignore if response isn't JSON */ }
             }
            throw new Error(errorMsg);
        }

        const data = await res.json();
        // console.log("Poxel.io API Stats Received:", data);

        if (typeof data !== 'object' || data === null) {
            throw new Error("Invalid data format received from Poxel.io API.");
        }
        if (data.error || data.status === 'error') {
             // Handle specific error cases if API returns them structured
            if (data.message && data.message.toLowerCase().includes('not found')) {
                 throw new Error('User not found on Poxel.io');
            }
            throw new Error(data.message || 'Poxel.io API returned an error status.');
        }
        return data;
    } catch (e) {
        console.error("Error fetching Poxel.io stats:", e.message || e);
        return null; // Indicate error by returning null
    }
}


// --- Fetch all achievement definitions ---
async function fetchAllAchievements() {
    if (allAchievements) return allAchievements; // Return cached if available
    console.log("Fetching all achievement definitions...");
    try {
        const snapshot = await db.collection('achievements').get();
        const fetchedAchievements = {};
        snapshot.forEach(doc => {
            fetchedAchievements[doc.id] = { id: doc.id, ...doc.data() };
        });
        allAchievements = fetchedAchievements; // Cache the result
        console.log(`Fetched ${Object.keys(allAchievements).length} achievement definitions.`);
        return allAchievements;
    } catch (error) {
        console.error("Error fetching achievement definitions:", error);
        allAchievements = {}; // Set empty object on error to prevent retries
        return null;
    }
}

// --- Helper: Compare Leaderboard Stats ---
function areStatsDifferent(newStats, existingProfileStats) {
    const normNew = newStats || {};
    const normExisting = existingProfileStats || {};
    // Define relevant stat keys to compare (adjust as needed)
    const statKeys = ['wins', 'points', 'kdRatio', 'matchesPlayed', 'matches', 'losses'];
    let different = false;
    for (const key of statKeys) {
        let newValue = normNew[key];
        let existingValue = normExisting[key];

        // Handle potential 'matches'/'matchesPlayed' alias more carefully
        if(key === 'matchesPlayed' && !normNew.hasOwnProperty('matchesPlayed') && normNew.hasOwnProperty('matches')) {
            newValue = normNew.matches;
        }
        if(key === 'matchesPlayed' && !normExisting.hasOwnProperty('matchesPlayed') && normExisting.hasOwnProperty('matches')) {
            existingValue = normExisting.matches;
        }


        // Coerce undefined/null to null for comparison
        newValue = newValue ?? null;
        existingValue = existingValue ?? null;


        // Special comparison for floating point numbers
        if (key === 'kdRatio' && typeof newValue === 'number' && typeof existingValue === 'number') {
            if (Math.abs(newValue - existingValue) > 0.001) { different = true; break; }
        } else if (newValue !== existingValue) {
            different = true; break;
        }
    }
    // Also check if the *set* of relevant keys present differs
    if (!different) {
        const newRelevantKeys = Object.keys(normNew).filter(k => statKeys.includes(k) || (k === 'matches' && statKeys.includes('matchesPlayed')));
        const existingRelevantKeys = Object.keys(normExisting).filter(k => statKeys.includes(k)|| (k === 'matches' && statKeys.includes('matchesPlayed')));
        if (newRelevantKeys.length !== existingRelevantKeys.length) {
            different = true;
        } else {
            const newSet = new Set(newRelevantKeys);
            if (!existingRelevantKeys.every(key => newSet.has(key))) { different = true; }
        }
    }
     // if (different) console.log("Detected difference in stats:", { new: normNew, existing: normExisting });
    return different;
}

// --- Helper Function: Client-Side User Profile Document Creation ---
async function createUserProfileDocument(userId, authUser) {
    if (!userId || !authUser) {
        console.error("Cannot create profile: userId or authUser missing.");
        return null;
    }
    console.warn(`Client-side: Creating missing user profile doc for UID: ${userId}`);
    const userDocRef = db.collection("users").doc(userId);
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;
    const defaultProfileData = {
        email: authUser.email ? authUser.email.toLowerCase() : null, // Store email lowercase
        displayName: displayName,
        currentRank: "Unranked",
        equippedTitle: "",
        availableTitles: [],
        friends: {}, // Initialize empty friends map
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        leaderboardStats: {}, // Initialize empty stats
        profilePictureUrl: authUser.photoURL || null, // Use Google photoURL if available
        poxelStats: {} // Placeholder for Poxel stats if needed later
    };
    try {
        await userDocRef.set(defaultProfileData, { merge: false }); // Use set without merge to create cleanly
        console.log(`Successfully created user profile document for UID: ${userId} via client`);
        return { id: userId, ...defaultProfileData, createdAt: new Date() }; // Return structure matching a fetched doc, use client date for createdAt initially
    } catch (error) {
        console.error(`Error creating user profile document client-side for UID ${userId}:`, error);
        // Don't show alert, handle error in calling function
        return null;
    }
}

// --- Load Combined User Data (Profile + Stats + Poxel + Achievements) ---
async function loadCombinedUserData(targetUserId) {
    console.log(`Loading combined user data for TARGET UID: ${targetUserId}`);
    isOwnProfile = loggedInUser && loggedInUser.uid === targetUserId;
    console.log("Is viewing own profile:", isOwnProfile);

    // Reset viewer data and caches on new load
    viewerProfileData = null;
    miniProfileCache = {};
    viewingUserProfileData = {}; // Clear existing viewing data

    // Clear previous content and show loading indicators
    if (profileContent) profileContent.style.display = 'none'; // Hide content until load completes
    if (notLoggedInMsg) notLoggedInMsg.style.display = 'none';
    if (loadingIndicator) loadingIndicator.style.display = 'flex';

    if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = '<p class="list-message">Loading competitive stats...</p>';
    if (poxelStatsSection) poxelStatsSection.style.display = 'none'; // Hide Poxel section initially
    if (poxelStatsDisplay) poxelStatsDisplay.innerHTML = '<p class="list-message">Loading Poxel.io stats...</p>';
    if (achievementsSection) achievementsSection.style.display = 'none'; // Hide achievements section initially
    if (achievementsListContainer) achievementsListContainer.innerHTML = '<p class="list-message">Loading achievements...</p>';

    updateProfileTitlesAndRank(null, false); // Reset rank/title display
    clearFriendshipControls(); // Clear old friend buttons
    resetFriendsSection(); // Hide and reset friend lists/tabs

    // Try loading from cache first for faster perceived load
    const cacheLoaded = loadCombinedDataFromCache(targetUserId);
    // Fetch definitions needed globally (can run in parallel to user data fetch)
    if (!allAchievements) fetchAllAchievements();


    // --- Fetch Viewer's Profile Data (if logged in and not viewing self) ---
    if (loggedInUser && !isOwnProfile) {
        try {
            const viewerSnap = await db.collection('users').doc(loggedInUser.uid).get();
            if (viewerSnap.exists) {
                viewerProfileData = { id: viewerSnap.id, ...viewerSnap.data() };
                 if (!viewerProfileData.friends) viewerProfileData.friends = {}; // Ensure map exists
                console.log("Fetched viewer profile data.");
            } else {
                 console.warn("Logged-in user's profile data not found.");
                 // Attempt to create profile if viewer's own is missing (edge case)
                 viewerProfileData = await createUserProfileDocument(loggedInUser.uid, loggedInUser);
                 if (!viewerProfileData) viewerProfileData = { id: loggedInUser.uid, friends: {} }; // Fallback empty map
            }
        } catch (viewerError) {
            console.error("Error fetching viewing user's profile data:", viewerError);
             viewerProfileData = { id: loggedInUser.uid, friends: {} }; // Assume empty map for checks
        }
    } else if (isOwnProfile) {
         // If viewing own profile, viewer data IS the profile data (fetched below)
         // This section will be populated later once the profile is fetched.
    }
    // --- End Fetch Viewer's Profile Data ---

    const userProfileRef = db.collection('users').doc(targetUserId);
    const leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId);
    let userUnlockedAchievementIds = []; // Hold unlocked achievement IDs for owner

    try {
        // *** Fetch unlocked achievements IF viewing own profile (do early) ***
        if (isOwnProfile) {
            userUnlockedAchievementIds = await fetchUserUnlockedAchievements(targetUserId);
            // console.log("Initial fetch of unlocked achievements:", userUnlockedAchievementIds);
        }

        // 1. Fetch Target User Profile Data
        let profileSnap = await userProfileRef.get();
        let profileData = null;

        if (!profileSnap || !profileSnap.exists) {
            console.warn(`User profile document does NOT exist for UID: ${targetUserId}`);
            if (isOwnProfile && loggedInUser) {
                profileData = await createUserProfileDocument(targetUserId, loggedInUser);
                if (!profileData) throw new Error(`Profile creation failed for own UID ${targetUserId}.`);
                // No stats available for newly created profile yet
                 viewingUserProfileData = { profile: profileData, stats: null };
            } else {
                console.error(`Cannot find profile for user UID: ${targetUserId}`);
                throw new Error(`Profile not found for UID ${targetUserId}.`); // Throw specific error
            }
        } else {
            profileData = { id: profileSnap.id, ...profileSnap.data() };
            // Ensure essential fields exist for robustness
            if (profileData.leaderboardStats === undefined) profileData.leaderboardStats = {};
            if (profileData.profilePictureUrl === undefined) profileData.profilePictureUrl = null;
            if (profileData.friends === undefined) profileData.friends = {};
            if (profileData.email) profileData.email = profileData.email.toLowerCase(); // Ensure lowercase
        }

        // If viewing own profile, also set viewerProfileData here
        if (isOwnProfile) {
            viewerProfileData = profileData;
            if (!viewerProfileData.friends) viewerProfileData.friends = {}; // Ensure map exists
        }


        // 2. Fetch Leaderboard Stats Data (Competitive) - Fetch ONLY IF profile exists
        let competitiveStatsData = null;
        if(profileData) { // Only fetch if profile was found/created
            const statsSnap = await leaderboardStatsRef.get();
            competitiveStatsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null;
             // console.log("Fetched competitive stats:", competitiveStatsData);
        }

        // 3. Sync Competitive Stats to Profile Document if needed
        if (profileData && competitiveStatsData) {
             // console.log("Comparing fetched stats with profile stats:", competitiveStatsData, profileData.leaderboardStats);
            if (areStatsDifferent(competitiveStatsData, profileData.leaderboardStats)) {
                console.log(`Competitive stats for UID ${targetUserId} differ. Updating 'users' doc.`);
                try {
                    const statsToSave = { ...competitiveStatsData };
                    delete statsToSave.id; // Don't save the id field itself inside the map
                    await userProfileRef.update({ leaderboardStats: statsToSave });
                    profileData.leaderboardStats = statsToSave; // Update local copy
                    console.log("Local profileData.leaderboardStats updated after sync.");
                } catch (updateError) {
                    console.error(`Error updating competitive stats in 'users' doc for UID ${targetUserId}:`, updateError);
                     // Continue with potentially stale stats in profileData.leaderboardStats if update fails
                }
            }
        }


        // 4. Update Global State for the viewed profile
        viewingUserProfileData = {
            profile: profileData,
            stats: competitiveStatsData // Store stats from leaderboard, or null if not found
        };
        // console.log("Final Profile Data set in viewingUserProfileData:", viewingUserProfileData);


        // 5. Display Core Profile & Competitive Stats, Cache
        displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats, isOwnProfile);
        saveCombinedDataToCache(targetUserId, viewingUserProfileData); // Cache fetched data


        // --- Display Friendship Controls or Friends Section ---
        if (loggedInUser) {
            if (isOwnProfile) {
                // Use the just fetched profileData (which is also viewerProfileData now)
                 displayFriendsSection(profileData); // Show friends section on own profile
            } else if (viewerProfileData){ // Ensure viewer data is available before determining status
                 const status = determineFriendshipStatus(loggedInUser.uid, targetUserId);
                 displayFriendshipControls(status, targetUserId);
            }
        }


        // 6. Fetch and Display Poxel.io Stats (asynchronously)
        if (profileData && profileData.displayName) {
             if(poxelStatsSection) poxelStatsSection.style.display = 'block'; // Show section before fetch starts
             fetchPoxelStats(profileData.displayName)
                .then(poxelStatsData => {
                    displayPoxelStats(poxelStatsData);
                    // Optional: Save Poxel stats to user profile? Requires write permission/function.
                     // if (isOwnProfile && poxelStatsData) {
                    //     userProfileRef.update({ poxelStats: poxelStatsData }).catch(err => console.error("Failed to save Poxel stats", err));
                    // }
                })
                .catch(poxelError => {
                    console.error("Caught error during Poxel.io fetch chain:", poxelError);
                    displayPoxelStats(null, poxelError.message || 'Error loading stats.'); // Pass error message
                });
        } else {
             console.warn("No displayName found in profile, cannot fetch Poxel.io stats.");
             displayPoxelStats(null, 'Poxel username not found.'); // Display unavailable state
        }


        // --- Display Achievements Section (IF owner) ---
        if (isOwnProfile) {
            // Ensure definitions are loaded before display
             if (!allAchievements) await fetchAllAchievements();
            // Display achievements based on the fetched competitive stats and initially fetched unlocked IDs
             await displayAchievementsSection(viewingUserProfileData.stats, userUnlockedAchievementIds);
        }


        // 7. Check and Grant Achievements (only if owner and has competitive stats)
        if (isOwnProfile && viewingUserProfileData.stats) {
            // Ensure definitions are loaded
            if (!allAchievements) await fetchAllAchievements();

            if (allAchievements) {
                // Pass the LATEST profile data (including potentially synced stats)
                const potentiallyUpdatedProfile = await checkAndGrantAchievements(
                    targetUserId,
                    viewingUserProfileData.profile,
                    viewingUserProfileData.stats
                );

                if (potentiallyUpdatedProfile) {
                    console.log("Profile potentially updated by achievement grant.");
                    // Update global state with the returned updated profile
                    viewingUserProfileData.profile = potentiallyUpdatedProfile;
                    // If viewing own profile, update viewer data too
                     viewerProfileData = viewingUserProfileData.profile;

                    // Re-render affected UI components
                    displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats, isOwnProfile); // Reflect title/rank changes
                    saveCombinedDataToCache(targetUserId, viewingUserProfileData); // Update cache

                    // Re-fetch unlocked achievements AFTER granting, and re-display section
                    console.log("Refreshing achievement display after grant check...");
                    const latestUnlockedIds = await fetchUserUnlockedAchievements(targetUserId);
                    await displayAchievementsSection(viewingUserProfileData.stats, latestUnlockedIds); // Refresh achievement display

                    // Optionally refresh friends section if rank changed?
                    displayFriendsSection(viewingUserProfileData.profile); // Refresh friends section
                    console.log("UI/Cache updated post-achievement check.");
                }
            }
        }


    } catch (error) {
        console.error(`Error in loadCombinedUserData for TARGET UID ${targetUserId}:`, error);
        // Determine error message
        let errorMessage = 'Error loading profile data. Please try again later.';
        if (error.message && error.message.includes('Profile not found')) {
            errorMessage = 'Profile not found.';
             viewingUserProfileData.profile = null; // Explicitly mark profile as not found
        } else {
            // Keep potentially cached data visible if it was loaded
            if (cacheLoaded) {
                 errorMessage = 'Error fetching latest data. Displaying cached version.';
                 console.warn("Error fetching fresh data, displaying potentially stale cached view.");
                 // Attempt Poxel fetch based on cache if available
                  if (viewingUserProfileData.profile?.displayName) {
                     if(poxelStatsSection) poxelStatsSection.style.display = 'block';
                     fetchPoxelStats(viewingUserProfileData.profile.displayName)
                         .then(poxelStatsData => displayPoxelStats(poxelStatsData))
                         .catch(e => displayPoxelStats(null, e.message || 'Error loading stats.'));
                  } else {
                       displayPoxelStats(null, 'Poxel username not found.');
                  }
                   // Optionally show achievements based on cache (may be stale)
                 if(isOwnProfile && achievementsSection) {
                      achievementsSection.style.display = 'block';
                      if(achievementsListContainer) achievementsListContainer.innerHTML = '<p class="list-message">Error refreshing achievements. Displaying cached data.</p>';
                       // Optionally: displayAchievementsSection(viewingUserProfileData.stats, userUnlockedAchievementIds) // using possibly stale unlocked IDs
                 }

                 // Do not clear main display, keep cached view shown.
                 // But do update the error message area.
                 if (notLoggedInMsg) {
                      notLoggedInMsg.textContent = errorMessage;
                      notLoggedInMsg.style.display = 'block'; // Show temporary error above cached content? Or have a dedicated banner?
                      // Maybe just log it, let user interact with stale data.
                      console.warn(errorMessage);
                      notLoggedInMsg.style.display = 'none'; // Keep it hidden if cache is shown
                 }

            } else {
                 // No cache loaded and error occurred - Clear everything and show main error
                 if (profileContent) profileContent.style.display = 'none';
                 if (notLoggedInMsg) notLoggedInMsg.textContent = errorMessage;
                 if (notLoggedInMsg) notLoggedInMsg.style.display = 'flex';
                 updateProfileTitlesAndRank(null, false);
                 if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = '<p class="list-message">Error loading stats.</p>';
                 if (poxelStatsSection) poxelStatsSection.style.display = 'none';
                 if (achievementsSection) achievementsSection.style.display = 'none';
                 updateProfileBackground(null);
                 clearFriendshipControls();
                 resetFriendsSection();
            }
        }
    } finally {
         // Ensure loading indicator is always hidden at the end
        if (loadingIndicator) loadingIndicator.style.display = 'none';
         // Show profile content ONLY if profile data was successfully loaded/found
         if (viewingUserProfileData.profile) {
             if (profileContent) profileContent.style.display = 'block';
         } else if(!cacheLoaded) { // If profile not found AND no cache was shown
             if (profileContent) profileContent.style.display = 'none';
             // The error message display is handled within the catch block logic above
         }
    }
} // --- End loadCombinedUserData ---


// --- Display Core Profile Data (Username, PFP, Badges, Rank, Title, Comp Stats) ---
function displayProfileData(profileData, competitiveStatsData, isOwner) {
     // Check if the profile-content container is ready
     if (!profileContent) {
         console.error("Profile content container not found in DOM.");
         return;
     }
    profileContent.style.display = 'block'; // Ensure main container is visible if data exists

    if (!profileData) {
        // Reset state for "User Not Found" or error after initial load failure
        // This case is mostly handled by loadCombinedUserData error handling now.
        console.error("displayProfileData called with null profileData.");
        profileContent.style.display = 'none'; // Hide container if no data
         if (notLoggedInMsg) {
            notLoggedInMsg.textContent = 'Profile data unavailable.';
             notLoggedInMsg.style.display = 'flex';
         }
        return;
    }

    const displayName = profileData.displayName || 'Anonymous User';
    // const email = profileData.email || 'No email provided'; // Email kept hidden by CSS

    usernameDisplay.textContent = displayName;
    // emailDisplay.textContent = email; // Keep email hidden based on CSS

    // --- Profile Picture Logic ---
    if (profileData.profilePictureUrl) {
        profileImage.src = profileData.profilePictureUrl;
        profileImage.style.display = 'block';
        profileInitials.style.display = 'none';
        profileImage.onerror = () => { // Fallback if image load fails
            console.error("Failed to load profile image:", profileData.profilePictureUrl);
            profileImage.style.display = 'none';
            profileInitials.textContent = displayName?.charAt(0)?.toUpperCase() || '?';
            profileInitials.style.display = 'flex';
            updateProfileBackground(null); // Clear background on error
        };
        profileImage.onload = () => { // Ensure background updates *after* image loads
             updateProfileBackground(profileData.profilePictureUrl); // Set background
        }
    } else {
        profileImage.style.display = 'none';
        profileImage.src = '';
        profileInitials.textContent = displayName?.charAt(0)?.toUpperCase() || '?';
        profileInitials.style.display = 'flex';
        updateProfileBackground(null); // No background
    }

    // Show edit icon only if it's the owner's profile
    editProfilePicIcon.style.display = isOwner ? 'flex' : 'none';

    // Display other elements
    displayUserBadges(profileData);
    updateProfileTitlesAndRank(profileData, isOwner); // Pass owner status for interaction
    displayCompetitiveStats(competitiveStatsData); // Pass competitive stats

     // Setup editing listener IF owner, AFTER the elements are displayed
    if (isOwner) {
        setupProfilePicEditing();
    }

}

// --- Update Profile Background ---
function updateProfileBackground(imageUrl) {
    // Use the main profile container 'profile-content'
    if (!profileContent) return;

    if (imageUrl) {
        profileContent.style.setProperty('--profile-bg-image', `url('${imageUrl}')`);
        profileContent.classList.add('has-background');
    } else {
        profileContent.style.removeProperty('--profile-bg-image');
        profileContent.classList.remove('has-background');
    }
}

// --- Display COMPETITIVE Stats Grid ---
function displayCompetitiveStats(statsData) {
    if (!competitiveStatsDisplay) return;
    competitiveStatsDisplay.innerHTML = ''; // Clear previous

    if (!statsData || typeof statsData !== 'object' || Object.keys(statsData).length === 0) {
        competitiveStatsDisplay.innerHTML = '<p class="list-message">Competitive stats unavailable.</p>';
        return;
    }

    // More robust handling of potential stats structure
    const statsMap = {
        wins: 'Wins',
        points: 'Points',
        kdRatio: 'K/D Ratio',
        matchesPlayed: 'Matches Played', // Primary key
        losses: 'Losses'
    };
    // Use alias if primary is missing
    if (!statsData.hasOwnProperty('matchesPlayed') && statsData.hasOwnProperty('matches')) {
        statsMap.matches = 'Matches Played'; // Use 'matches' as the source
        delete statsMap.matchesPlayed; // Remove the primary expectation
    }

    let statsAdded = 0;
    for (const key in statsMap) {
        if (statsData.hasOwnProperty(key)) {
            let value = statsData[key];
             let displayValue = value;

            // Format specific stats if needed
            if (key === 'kdRatio' && typeof value === 'number') {
                 displayValue = value.toFixed(2);
             } else if (value === null || value === undefined){
                 displayValue = '-'; // Show dash for null/undefined stats
             }

             // Append the item
            competitiveStatsDisplay.appendChild(createStatItem(statsMap[key], displayValue));
            statsAdded++;
        }
    }

    if (statsAdded === 0) {
        competitiveStatsDisplay.innerHTML = '<p class="list-message">No specific competitive stats found.</p>';
    }
}


// --- Display Poxel.io Stats Grid ---
function displayPoxelStats(poxelData, message = null) { // Allow passing a message
    if (!poxelStatsDisplay || !poxelStatsSection) return;

    poxelStatsDisplay.innerHTML = ''; // Clear previous content
    poxelStatsSection.style.display = 'block'; // Always ensure the section is potentially visible

    if (message) { // If an explicit message is passed (e.g., error or loading)
         poxelStatsDisplay.innerHTML = `<p class="list-message">${message}</p>`;
         return;
     }

    if (!poxelData || typeof poxelData !== 'object' || Object.keys(poxelData).length === 0) {
         poxelStatsDisplay.innerHTML = '<p class="list-message">Poxel.io stats unavailable.</p>'; // Generic message if no data and no error message
         return;
    }

    // Map API fields to display names (adjust keys based on ACTUAL API response)
    const statsMap = {
         kills: 'Kills', deaths: 'Deaths', wins: 'Wins', losses: 'Losses',
         level: 'Level', playtimeHours: 'Playtime (Hours)', gamesPlayed: 'Games Played'
         // Add/remove/rename fields based on the API structure confirmed via console logs
    };
    let statsAdded = 0;

    // Display mapped stats
    for (const key in statsMap) {
         if (poxelData.hasOwnProperty(key) && poxelData[key] !== null && poxelData[key] !== undefined) {
             let value = poxelData[key];
             // Simple formatting example
             if (key === 'playtimeHours' && typeof value === 'number') value = value.toFixed(1);

             poxelStatsDisplay.appendChild(createStatItem(statsMap[key], value));
             statsAdded++;
         }
    }

    // Calculate and add K/D specifically (only if kills/deaths exist)
    if (poxelData.hasOwnProperty('kills') && poxelData.hasOwnProperty('deaths') && poxelData.deaths !== null && poxelData.kills !== null) {
         const kills = Number(poxelData.kills) || 0;
         const deaths = Number(poxelData.deaths) || 0;
         const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2); // Handle division by zero
         poxelStatsDisplay.appendChild(createStatItem('Poxel K/D', kd));
         statsAdded++;
    }

    if (statsAdded === 0) {
        poxelStatsDisplay.innerHTML = '<p class="list-message">No relevant Poxel.io stats found.</p>';
    }
}

// --- Helper: Create a Single Stat Item Element ---
function createStatItem(title, value) {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('stat-item');
    const titleH4 = document.createElement('h4');
    titleH4.textContent = title;
    const valueP = document.createElement('p');
    // Display a dash '-' if value is explicitly null or undefined
    valueP.textContent = (value !== null && value !== undefined) ? value : '-';
    itemDiv.appendChild(titleH4);
    itemDiv.appendChild(valueP);
    return itemDiv;
}


// --- Helper: Fetch User's Unlocked Achievements (Corrected) ---
async function fetchUserUnlockedAchievements(userId) {
    if (!userId) return []; // Return empty if no user ID
    // console.log(`Fetching unlocked achievements for ${userId}`); // Optional logging
    try {
        const userAchievementsRef = db.collection('userAchievements').doc(userId);
        const doc = await userAchievementsRef.get(); // Corrected ref and use .get()
        if (doc.exists) {
            const unlockedIds = doc.data()?.unlocked || [];
            // console.log(`Found unlocked achievements for ${userId}:`, unlockedIds); // Optional logging
            return unlockedIds; // Return the array of unlocked IDs
        } else {
             // console.log(`No userAchievements doc found for ${userId}, assuming none unlocked.`); // Optional logging
            return []; // No document means no achievements unlocked yet
        }
    } catch (error) {
        console.error(`Error fetching unlocked achievements for UID ${userId}:`, error);
        return []; // Return empty on error
    }
}

// --- Helper: Calculate Achievement Progress Percentage ---
function calculateAchievementProgress(achievement, userStats) {
     // Provide default target/value of 0 for calculation safety
     const criteria = achievement?.criteria || {};
     const targetValue = criteria.value || 0;
     const operator = criteria.operator || '>='; // Default operator
     const statKey = criteria.stat;

     // Handle case where user has no stats (e.g., new profile)
    if (userStats === null || userStats === undefined || !statKey) {
        // If target is 0 and operator is '>=', consider 0 progress (or 100 if you want "reach 0")
         const meetsCriteria = operator === '>=' && (0 >= targetValue);
         return { progress: 0, currentValue: 0, targetValue, meetsCriteria };
     }

    let currentValue = userStats[statKey];

     // Handle potential alias matches/matchesPlayed if using competitive stats
     if(statKey === 'matchesPlayed' && !userStats.hasOwnProperty('matchesPlayed') && userStats.hasOwnProperty('matches')) {
         currentValue = userStats.matches;
     }

     // Ensure current value is treated as a number, default to 0 if missing or not number
     currentValue = Number(currentValue) || 0;

     // Specific formatting/parsing for floats like K/D if needed
     if (statKey === 'kdRatio' && typeof currentValue === 'number') {
        currentValue = parseFloat(currentValue.toFixed(2)); // Match potential display format
     }


    if (targetValue <= 0) {
         // For non-positive targets, check if condition is met (e.g., currentValue >= 0)
        const meetsCriteria = operator === '>=' ? currentValue >= targetValue : operator === '==' ? currentValue == targetValue : false; // Add other operators
        return { progress: (meetsCriteria ? 100 : 0), currentValue, targetValue, meetsCriteria };
    }

    // Calculate progress based on operator for positive targets
    let progressPercent = 0;
    let meetsCriteria = false;

    switch (operator) {
         case '>=':
            meetsCriteria = currentValue >= targetValue;
             // Ensure division by zero doesn't happen, already handled by targetValue > 0 check
             progressPercent = (currentValue / targetValue) * 100;
            break;
         case '==':
            meetsCriteria = currentValue == targetValue; // Loose comparison intentional? Or use === ?
            progressPercent = meetsCriteria ? 100 : 0; // Binary progress
            break;
        // Add other operators ('<=', '<', '>', '!=') if needed, defining criteria and progress logic
         default:
            console.warn(`Unsupported achievement operator: ${operator} for achievement ${achievement?.id}`);
            meetsCriteria = false;
            progressPercent = 0;
            break;
    }

    // Clamp progress between 0 and 100
    progressPercent = Math.max(0, Math.min(100, progressPercent));

    return {
        progress: Math.floor(progressPercent), // Return whole number percentage
        currentValue,
        targetValue,
        meetsCriteria // Include whether the criteria condition itself is strictly met
    };
}


// --- Display Achievements Section ---
async function displayAchievementsSection(competitiveStats, unlockedAchievementIds) {
    if (!achievementsSection || !achievementsListContainer) {
         console.error("Achievement section elements not found in DOM.");
         return;
     }

    // Ensure this section only appears for the profile owner
    if (!isOwnProfile) {
        achievementsSection.style.display = 'none';
        return;
    }

    // Ensure achievement definitions are loaded
    if (!allAchievements) {
        console.log("Achievement definitions not loaded yet, attempting fetch...");
        await fetchAllAchievements(); // Ensure definitions are available
        if (!allAchievements) { // Check again after attempting fetch
             console.error("Failed to load achievement definitions after attempting fetch.");
             achievementsListContainer.innerHTML = '<p class="list-message">Could not load achievement definitions.</p>';
            achievementsSection.style.display = 'block'; // Show section with error
            return;
        }
    }

    achievementsListContainer.innerHTML = ''; // Clear loading/previous content
    achievementsSection.style.display = 'block'; // Show the section for the owner

    const achievementIds = Object.keys(allAchievements || {}); // Handle null case

    if (achievementIds.length === 0) {
        achievementsListContainer.innerHTML = '<p class="list-message">No achievements defined yet.</p>';
        return;
    }

    console.log(`Displaying ${achievementIds.length} achievements.`);
    // Create and append items for each achievement
    achievementIds.forEach(achievementId => {
        const achievement = allAchievements[achievementId];
        if (!achievement || !achievement.name || !achievement.criteria) {
             console.warn(`Skipping invalid achievement data for ID: ${achievementId}`, achievement);
             return; // Skip if achievement data is invalid/incomplete
        }

        const isUnlocked = unlockedAchievementIds?.includes(achievementId) || false; // Handle null/undefined unlocked IDs
        // Pass the potentially null competitiveStats safely
         const progressInfo = calculateAchievementProgress(achievement, competitiveStats);

        // Criteria met flag from calculation
        const meetsCriteriaDirectly = progressInfo.meetsCriteria;
        // Considered "Completed" for display purposes if unlocked OR meets criteria
        const isDisplayCompleted = isUnlocked || meetsCriteriaDirectly;


        const itemDiv = document.createElement('div');
        itemDiv.classList.add('achievement-item');
         // Add classes based on *both* unlock status and completion status
        if (isUnlocked) itemDiv.classList.add('achievement-unlocked');
        if (isDisplayCompleted) itemDiv.classList.add('achievement-completed');


        // Format rewards string
        let rewardsHtml = '';
        if (achievement.rewards) {
            const rewardsParts = [];
            if (achievement.rewards.title) rewardsParts.push(`Title: <strong>${achievement.rewards.title}</strong>`);
            if (achievement.rewards.rank) rewardsParts.push(`Rank: <strong>${achievement.rewards.rank}</strong>`);
            // Add other reward types here (e.g., XP, items)
            // if (achievement.rewards.xp) rewardsParts.push(`XP: <strong>${achievement.rewards.xp}</strong>`);
            if (rewardsParts.length > 0) {
                rewardsHtml = `<div class="achievement-rewards">Reward${rewardsParts.length > 1 ? 's': ''}: ${rewardsParts.join(', ')}</div>`;
            }
        }

        // Determine progress bar text
         let progressText = `${progressInfo.progress}%`;
         let progressBarTitle = ''; // Tooltip for progress bar

         // Check if criteria is numeric and progressive (like >=)
         const isNumericProgressive = achievement.criteria.stat && typeof achievement.criteria.value === 'number' && achievement.criteria.value > 0 && achievement.criteria.operator === '>=';

         if (isDisplayCompleted) {
             progressText = "Completed";
              if(isNumericProgressive){
                   progressBarTitle = `${achievement.criteria.stat}: ${progressInfo.currentValue} / ${progressInfo.targetValue} (Completed)`;
              } else {
                   progressBarTitle = "Completed";
              }
         } else if (isNumericProgressive) {
             // Show numeric progress for non-completed, progressive achievements
            progressText = `${progressInfo.currentValue} / ${progressInfo.targetValue} (${progressInfo.progress}%)`;
             progressBarTitle = `${achievement.criteria.stat}: ${progressInfo.currentValue} / ${progressInfo.targetValue}`;
         } else {
             // For non-numeric or non-progressive (like '==') that aren't completed, just show percentage
            progressText = `${progressInfo.progress}%`;
            progressBarTitle = achievement.criteria.stat ? `${achievement.criteria.stat} Progress` : 'Progress';
        }

         // Final HTML structure for the item
         itemDiv.innerHTML = `
            <h4>
                 <span>${achievement.name}</span>
                 ${isDisplayCompleted ? '<span class="completion-icon" title="Completed!">✔</span>' : ''}
             </h4>
            <p class="achievement-description">${achievement.description || 'No description available.'}</p>
             ${achievement.criteria.stat && achievement.criteria.value !== undefined ? `
                 <div class="achievement-progress-container" title="${progressBarTitle}">
                    <div class="achievement-progress-bar" style="width: ${progressInfo.progress}%;">
                        <span>${progressText}</span>
                    </div>
                </div>
             ` : '<div style="height: 5px;"></div>' /* Add small spacer if no progress bar */ }
            ${rewardsHtml}
        `;
        achievementsListContainer.appendChild(itemDiv);
    });

    // If after loop, container is still empty (e.g., allAchievements were invalid)
    if (achievementsListContainer.childElementCount === 0 && achievementIds.length > 0) {
         console.warn("Achievement list is empty after processing valid definition IDs.");
        achievementsListContainer.innerHTML = '<p class="list-message">Could not display achievements.</p>';
    } else if (achievementIds.length === 0) {
         // Handled earlier, but double-check
         achievementsListContainer.innerHTML = '<p class="list-message">No achievements defined yet.</p>';
     }
}


// --- Check and Grant Achievements ---
async function checkAndGrantAchievements(userId, currentUserProfile, competitiveStats) {
     // Essential data checks
     if (!allAchievements || !userId || !currentUserProfile || !competitiveStats || typeof competitiveStats !== 'object') {
        console.log("Skipping achievement check: Missing definitions, user data, or stats.");
        return null; // Indicate no profile update needed/possible
    }
    console.log(`Checking achievements for UID ${userId}...`);
    // Make sure we have the necessary structure in the profile
     let profileToUpdate = {
         ...currentUserProfile,
         availableTitles: currentUserProfile.availableTitles || [],
         equippedTitle: currentUserProfile.equippedTitle !== undefined ? currentUserProfile.equippedTitle : "", // Ensure empty string if null/undefined
         currentRank: currentUserProfile.currentRank || "Unranked",
         friends: currentUserProfile.friends || {}, // Ensure friends map exists
         leaderboardStats: currentUserProfile.leaderboardStats || {}, // Ensure stats map exists
     };


    try {
        const userAchievementsRef = db.collection('userAchievements').doc(userId);
        let unlockedIds = []; // Fetch current unlocked achievements
        try {
            const userAchievementsDoc = await userAchievementsRef.get();
            if (userAchievementsDoc.exists) {
                unlockedIds = userAchievementsDoc.data()?.unlocked || [];
            }
        } catch(fetchError) {
             console.error("Error fetching existing unlocked achievements, assuming none:", fetchError);
             // Proceed, but might grant duplicates if fetch failed
             unlockedIds = [];
        }


        let newAchievementsUnlocked = []; // Track newly unlocked in this run
        let needsProfileUpdate = false; // Flag if user doc needs update
        let needsUserAchievementsUpdate = false; // Flag if userAchievements doc needs update

         // Determine highest rank potentially awarded in this check
         let bestRankReward = null;
         const rankOrder = ["Unranked", "Bronze", "Silver", "Gold", "Platinum", "Veteran", "Legend"]; // Define rank progression


        for (const achievementId in allAchievements) {
             // Skip if already explicitly unlocked in userAchievements doc
            if (unlockedIds.includes(achievementId)) continue;

            const achievement = allAchievements[achievementId];
            if (!achievement?.criteria) continue; // Skip if no criteria defined

            // Calculate progress and whether criteria are met *now*
             const progressInfo = calculateAchievementProgress(achievement, competitiveStats);


            if (progressInfo.meetsCriteria) { // Use the calculated flag
                console.log(`Criteria MET for achievement: ${achievement.name || achievementId}`);
                if (!newAchievementsUnlocked.includes(achievementId)) { // Avoid duplicates within this run
                     newAchievementsUnlocked.push(achievementId);
                     needsUserAchievementsUpdate = true; // Mark for userAchievements update
                }


                // Process rewards and update the LOCAL profile copy immediately
                if (achievement.rewards) {
                    // Title reward
                    if (achievement.rewards.title) {
                         if (!profileToUpdate.availableTitles.includes(achievement.rewards.title)) {
                            profileToUpdate.availableTitles.push(achievement.rewards.title);
                            needsProfileUpdate = true; // Mark user doc for update
                            console.log(`- Added title: ${achievement.rewards.title}`);
                            // Auto-equip first *ever* earned title if none is currently equipped
                             if (profileToUpdate.equippedTitle === "") {
                                profileToUpdate.equippedTitle = achievement.rewards.title;
                                console.log(`- Auto-equipped title: ${achievement.rewards.title}`);
                             }
                        }
                     }
                    // Rank reward - determine if it's better than current best reward or profile rank
                    if (achievement.rewards.rank) {
                        const currentRankIndex = rankOrder.indexOf(profileToUpdate.currentRank);
                        const newRankIndex = rankOrder.indexOf(achievement.rewards.rank);
                        const bestRewardRankIndex = bestRankReward ? rankOrder.indexOf(bestRankReward) : -1;

                        if (newRankIndex > Math.max(currentRankIndex, bestRewardRankIndex)) {
                             bestRankReward = achievement.rewards.rank;
                            console.log(`- New best rank reward candidate: ${bestRankReward}`);
                            needsProfileUpdate = true; // Potential rank update needed
                         }
                    }
                    // Add other rewards here (e.g., XP) and set needsProfileUpdate = true
                }
            }
        }


        // Apply the best rank reward found (if any) to the local profile copy
        if (bestRankReward) {
            const currentRankIndex = rankOrder.indexOf(profileToUpdate.currentRank);
             const bestRewardRankIndex = rankOrder.indexOf(bestRankReward);
             // Update only if the reward rank is strictly better than the current rank
            if (bestRewardRankIndex > currentRankIndex) {
                 profileToUpdate.currentRank = bestRankReward;
                 console.log(`Updating profile rank to highest awarded: ${bestRankReward}`);
                 // needsProfileUpdate is already true if bestRankReward is set
             }
        }


        // --- Perform Firestore Updates (if needed) ---
        if (needsProfileUpdate || needsUserAchievementsUpdate) {
            console.log(`Needs Firestore update. Profile: ${needsProfileUpdate}, UserAchievements: ${needsUserAchievementsUpdate}`);
            const batch = db.batch();
            const userProfileRef = db.collection('users').doc(userId);


            // 1. Update userAchievements doc with newly unlocked achievements
            if (needsUserAchievementsUpdate && newAchievementsUnlocked.length > 0) {
                 console.log("Updating userAchievements doc:", newAchievementsUnlocked);
                batch.set(userAchievementsRef, { unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsUnlocked) }, { merge: true });
            }

            // 2. Update user profile doc with changes (titles, rank etc.)
             if (needsProfileUpdate) {
                 const profileUpdateData = {};
                 // Check if titles actually changed from original profile
                if (JSON.stringify(profileToUpdate.availableTitles) !== JSON.stringify(currentUserProfile.availableTitles || [])) {
                    profileUpdateData.availableTitles = profileToUpdate.availableTitles;
                 }
                 // Check if equipped title changed
                if (profileToUpdate.equippedTitle !== (currentUserProfile.equippedTitle !== undefined ? currentUserProfile.equippedTitle : "")) {
                     profileUpdateData.equippedTitle = profileToUpdate.equippedTitle;
                 }
                 // Check if rank changed
                if (profileToUpdate.currentRank !== (currentUserProfile.currentRank || "Unranked")) {
                    profileUpdateData.currentRank = profileToUpdate.currentRank;
                 }
                 // Add other changed fields here...

                 if (Object.keys(profileUpdateData).length > 0) {
                     console.log("Updating 'users' doc with:", profileUpdateData);
                    batch.update(userProfileRef, profileUpdateData);
                } else {
                    console.log("Profile update needed flag was set, but no actual changes detected comparing to original.");
                     needsProfileUpdate = false; // Reset flag if no data is actually changing
                 }

             }


             // Commit only if there's something to commit
             if (needsProfileUpdate || needsUserAchievementsUpdate) {
                 await batch.commit();
                 console.log(`Achievement Firestore batch committed successfully for UID ${userId}.`);
                 // Return the MODIFIED profile object reflecting updates
                 return profileToUpdate;
             } else {
                  console.log("Update flags were set, but no operations added to batch. No commit needed.");
                  return null; // No actual update performed
             }

        } else {
            // console.log(`No new achievements or profile updates needed for UID ${userId}.`);
            return null; // No changes made
        }
    } catch (error) {
        console.error(`Error checking/granting achievements for UID ${userId}:`, error);
        return null; // Indicate no profile update due to error
    }
}


// =============================================================================
// --- UI Display Helpers (Badges, Rank/Title Selector) ---
// =============================================================================
function displayUserBadges(profileData) {
    if (!profileBadgesContainer) return;
    profileBadgesContainer.innerHTML = ''; // Clear previous badges
     if (!adminTag) return;
    adminTag.style.display = 'none'; // Hide admin tag by default


    const userEmail = profileData?.email; // Already lowercased in profileData if exists
    if (!userEmail) {
        return; // No email, no badges/admin tag
    }


    // Display Admin Tag
    if (adminEmails.includes(userEmail)) {
        adminTag.style.display = 'inline-block';
    }

    // Display Configured Badges
    for (const badgeType in badgeConfig) {
        const config = badgeConfig[badgeType];
        if (config.emails.includes(userEmail)) {
            const badgeSpan = document.createElement('span');
            badgeSpan.classList.add('profile-badge', config.className);
            badgeSpan.setAttribute('title', config.title); // Tooltip for badge type
            profileBadgesContainer.appendChild(badgeSpan);
        }
    }
}

function updateProfileTitlesAndRank(profileData, allowInteraction) {
    if (!rankDisplay || !titleDisplay) return;

    // Reset state
    titleDisplay.classList.remove('selectable-title', 'no-title-placeholder');
    titleDisplay.removeEventListener('click', handleTitleClick);
    closeTitleSelector(); // Ensure selector is closed


    if (profileData && typeof profileData === 'object') {
        const rank = profileData.currentRank || 'Unranked';
        const equippedTitle = profileData.equippedTitle || ''; // Use equipped title
        const availableTitles = profileData.availableTitles || [];

        // Update Rank Display
        rankDisplay.textContent = rank;
         // Ensure class reflects rank, handle potential spaces or case issues
         rankDisplay.className = `profile-rank-display rank-${rank.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`; // Sanitize class name


        // Update Title Display and Interaction
         if (allowInteraction && availableTitles.length > 0) {
             // If owner and has titles, make it interactive
            titleDisplay.classList.add('selectable-title');
            titleDisplay.addEventListener('click', handleTitleClick);
             if (equippedTitle) { // Has an equipped title
                titleDisplay.textContent = equippedTitle;
                titleDisplay.classList.remove('no-title-placeholder');
                titleDisplay.style.display = 'inline-block';
            } else { // No equipped title, but has available ones
                titleDisplay.textContent = '[Choose Title]';
                 titleDisplay.classList.add('no-title-placeholder');
                 titleDisplay.style.display = 'inline-block';
             }
        } else { // Not owner or no available titles
             if (equippedTitle) { // Still display equipped title if exists
                titleDisplay.textContent = equippedTitle;
                 titleDisplay.classList.remove('no-title-placeholder');
                 titleDisplay.style.display = 'inline-block';
             } else { // No equipped, not owner or none available -> hide
                 titleDisplay.textContent = '';
                 titleDisplay.style.display = 'none';
            }
        }


    } else {
        // Default/Loading State
        rankDisplay.textContent = '...';
        rankDisplay.className = 'profile-rank-display rank-unranked';
        titleDisplay.textContent = '';
        titleDisplay.style.display = 'none';
    }
}


function handleTitleClick(event) {
    event.stopPropagation(); // Prevent triggering outside click listener immediately
    // Double check conditions: must be own profile, must have profile data and available titles
     if (!isOwnProfile || !viewingUserProfileData.profile || !(viewingUserProfileData.profile.availableTitles?.length > 0)) {
        console.log("Title interaction blocked: Not owner or no titles available.");
         return;
     }


    if (isTitleSelectorOpen) {
        closeTitleSelector();
    } else {
        openTitleSelector();
    }
}


function openTitleSelector() {
     // Guard conditions
     if (isTitleSelectorOpen || !profileIdentifiersDiv || !isOwnProfile || !viewingUserProfileData.profile?.availableTitles?.length > 0) return;


    const availableTitles = viewingUserProfileData.profile.availableTitles;
    const currentEquippedTitle = viewingUserProfileData.profile.equippedTitle || '';


    // Create selector div if it doesn't exist or append if removed
    if (!titleSelectorElement || !profileIdentifiersDiv.contains(titleSelectorElement)) {
        titleSelectorElement = document.createElement('div');
        titleSelectorElement.className = 'title-selector';
        profileIdentifiersDiv.appendChild(titleSelectorElement); // Append inside identifiers div
    }
    titleSelectorElement.innerHTML = ''; // Clear previous options


    // Add "Remove Title" option if a title is currently equipped
    if (currentEquippedTitle) {
        const unequipOption = document.createElement('button');
        unequipOption.className = 'title-option title-option-unequip';
        unequipOption.dataset.title = ""; // Use empty string for unequip
        unequipOption.type = 'button';
        unequipOption.textContent = '[Remove Title]';
        unequipOption.onclick = handleTitleOptionClick; // Attach listener directly
        titleSelectorElement.appendChild(unequipOption);
    }

    // Add available titles as options
    availableTitles.forEach(titleOptionText => {
        const optionElement = document.createElement('button');
        optionElement.className = 'title-option';
        optionElement.dataset.title = titleOptionText;
        optionElement.type = 'button';
        optionElement.textContent = titleOptionText;


        if (titleOptionText === currentEquippedTitle) {
            optionElement.classList.add('currently-equipped');
             optionElement.disabled = true; // Disable clicking the currently equipped one
            // optionElement.setAttribute('aria-pressed', 'true'); // Indicate current selection
        }
         optionElement.onclick = handleTitleOptionClick; // Attach listener
        titleSelectorElement.appendChild(optionElement);
    });

    titleSelectorElement.style.display = 'block';
    isTitleSelectorOpen = true;


    // Add listener to close when clicking outside
    setTimeout(() => { // Use timeout to prevent immediate closing
        document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true });
    }, 0);
}


function closeTitleSelector() {
    if (!isTitleSelectorOpen || !titleSelectorElement) return;
    titleSelectorElement.style.display = 'none';
    isTitleSelectorOpen = false;
    document.removeEventListener('click', handleClickOutsideTitleSelector, { capture: true });
}

function handleClickOutsideTitleSelector(event) {
    if (!isTitleSelectorOpen) return;

    const isClickInsideSelector = titleSelectorElement && titleSelectorElement.contains(event.target);
    const isClickOnTitle = titleDisplay && titleDisplay.contains(event.target);

    if (!isClickInsideSelector && !isClickOnTitle) {
        closeTitleSelector();
    } else {
         // Re-attach listener if click was inside (e.g. scrollbar) to catch the *next* outside click
         // Use timeout to ensure it's not the same click event re-triggering
         setTimeout(() => {
              document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true });
         }, 0);
    }
}

async function handleTitleOptionClick(event) {
    event.stopPropagation(); // Prevent outside click handler
    const buttonElement = event.currentTarget;
    const selectedTitle = buttonElement.dataset.title; // Can be "" for unequip
    const currentUserId = loggedInUser?.uid;


    // More robust check: viewingUserProfileData should exist and match the logged-in user
    if (!currentUserId || !viewingUserProfileData.profile || viewingUserProfileData.profile.id !== currentUserId) {
        console.error("Attempted title change validation failed:", { currentUserId, viewingProfileId: viewingUserProfileData.profile?.id });
        closeTitleSelector();
        return;
    }

    const currentlyEquippedTitle = viewingUserProfileData.profile.equippedTitle || '';


    // Check if selection is different from current equipped title
    if (selectedTitle === currentlyEquippedTitle) {
        console.log("Clicked already equipped title. No change needed.");
        closeTitleSelector(); // Close selector, do nothing else
        return;
    }


    closeTitleSelector(); // Close selector immediately

    // Disable title display interaction temporarily
    titleDisplay.classList.remove('selectable-title', 'no-title-placeholder');
    titleDisplay.removeEventListener('click', handleTitleClick);
    titleDisplay.textContent = "Updating...";


    try {
        const userProfileRef = db.collection('users').doc(currentUserId);
        await userProfileRef.update({ equippedTitle: selectedTitle }); // Update Firestore

        console.log(`Firestore 'users' doc updated title to "${selectedTitle || 'None'}" for UID ${currentUserId}`);

        // Update local state AND cache
        viewingUserProfileData.profile.equippedTitle = selectedTitle;
        // Also update viewer data if viewing own profile
         if(isOwnProfile && viewerProfileData) viewerProfileData.equippedTitle = selectedTitle;

        saveCombinedDataToCache(currentUserId, viewingUserProfileData);

        // Re-render the title/rank section with interaction enabled
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true);

    } catch (error) {
        console.error("Error updating equipped title in Firestore 'users':", error);
        alert("Failed to update title. Please try again.");
         // Revert UI state ONLY IF profile data is available
        if(viewingUserProfileData.profile) {
           // Restore previous equipped title to the local data before re-rendering
            viewingUserProfileData.profile.equippedTitle = currentlyEquippedTitle;
            updateProfileTitlesAndRank(viewingUserProfileData.profile, true); // Re-render with previous state
         } else {
            updateProfileTitlesAndRank(null, false); // Reset if data got lost
         }

    }
}

// =============================================================================
// --- Profile Picture Editing Functions ---
// =============================================================================

// --- Initialize Edit Listeners (Call this when owner status is confirmed & elements ready) ---
function setupProfilePicEditing() {
    if (!isOwnProfile || !editProfilePicIcon || !profilePicInput) {
         // console.log("Skipping PFP edit setup: Not owner or elements missing.");
        if(editProfilePicIcon) editProfilePicIcon.style.display = 'none'; // Ensure hidden if not owner
        return;
     }


    editProfilePicIcon.style.display = 'flex'; // Ensure it's visible


    // Remove previous listeners before adding new ones (prevent duplicates)
    editProfilePicIcon.onclick = null;
    profilePicInput.onchange = null;

    // Attach listeners
    editProfilePicIcon.onclick = () => {
        profilePicInput.click(); // Trigger hidden file input
    };


    profilePicInput.onchange = (event) => {
        handleFileSelect(event);
    };
     // console.log("Profile pic editing listeners attached.");
}


// --- Handle File Selection ---
function handleFileSelect(event) {
    const file = event.target?.files?.[0]; // Safely access file
    if (!file) {
         console.log("No file selected.");
         event.target.value = null; // Reset input
        return;
     }
     if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file (PNG, JPG, GIF).');
        event.target.value = null; // Reset input
        return;
    }


    // Optional: Check file size (e.g., max 5MB)
     const maxSizeMB = 5;
     if (file.size > maxSizeMB * 1024 * 1024) {
         alert(`File size exceeds ${maxSizeMB}MB limit.`);
         event.target.value = null;
         return;
     }

    const reader = new FileReader();
    reader.onload = (e) => {
         if (e.target?.result) {
            modalImage.src = e.target.result;
             openEditModal(); // Open modal AFTER image source is set
         } else {
             alert("Error reading file data.");
         }
    };
    reader.onerror = (err) => {
        console.error("FileReader error:", err);
        alert("Error reading the selected file.");
    };
    reader.readAsDataURL(file);
    event.target.value = null; // Reset input AFTER starting read, allowing re-selection
}


// --- Open Image Editing Modal ---
function openEditModal() {
    if (!editModal || !modalImage || !modalImage.src || modalImage.src.startsWith('blob:')) {
         // Check if src is already a blob URL from a previous attempt or if it's missing
         console.warn("Modal image source invalid or missing, cannot open cropper.", modalImage.src);
          // Re-read if needed, or clear source and alert
          // For simplicity, just alert and don't open
          // alert("Image data missing. Please select the file again.");
         // return; // Prevent opening if src isn't a valid data URL
     }

     editModal.style.display = 'flex';
     modalImage.style.opacity = 0; // Hide image initially


    // Reset button state
     modalApplyBtn.disabled = false;
     modalSpinner.style.display = 'none';
     const applyTextNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
     if (applyTextNode) applyTextNode.textContent = 'Apply ';


    // Destroy previous Cropper instance if it exists
     if (cropper) {
        try { cropper.destroy(); } catch(e) { console.warn("Minor error destroying previous cropper", e)}
        cropper = null;
     }

     // Delay Cropper initialization slightly
     setTimeout(() => {
        try {
             cropper = new Cropper(modalImage, {
                aspectRatio: 1 / 1,
                viewMode: 1,
                dragMode: 'move',
                background: false, // Show checkerboard behind transparency
                autoCropArea: 0.9, // Start with a slightly larger crop area
                responsive: true,
                modal: true, // Dark overlay *around* the cropper container
                guides: true,
                center: true,
                highlight: false, // Don't highlight the crop box itself
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
                ready: () => {
                     modalImage.style.opacity = 1; // Fade in image once Cropper is ready
                     console.log("Cropper is ready.");
                },
                cropmove: () => {
                     // Optional: actions during crop move
                 },
                zoom: () => {
                    // Optional: actions during zoom
                }
            });
        } catch (cropperError) {
            console.error("Error initializing Cropper:", cropperError);
            alert("Could not initialize image editor. The image might be corrupted or unsupported. Please try a different image or reload the page.");
            closeEditModal();
        }
     }, 50); // Shorter delay


    // --- Attach listeners for modal controls ---
     // Ensure listeners are added ONLY ONCE or remove previous ones
    modalCloseBtn.onclick = null; // Clear previous before assigning
     modalCloseBtn.onclick = closeEditModal;


     modalCancelBtn.onclick = null; // Clear previous
     modalCancelBtn.onclick = closeEditModal;


     modalApplyBtn.onclick = null; // Clear previous
     modalApplyBtn.onclick = handleApplyCrop;


     // Click outside to close (added listener to the overlay)
     editModal.onclick = null; // Clear previous
     editModal.onclick = (event) => {
        // Only close if the click is directly on the overlay, not the content inside
         if (event.target === editModal) {
            closeEditModal();
        }
    };
}


// --- Close Image Editing Modal ---
function closeEditModal() {
    if (!editModal) return;
    if (cropper) {
        try { cropper.destroy(); } catch (e) { console.warn("Minor error destroying cropper on close:", e); }
        cropper = null; // Ensure cropper instance is released
    }
    editModal.style.display = 'none';
    modalImage.src = ''; // Clear image source
    modalImage.removeAttribute('src'); // Fully remove attribute


    // Reset button state reliably
    modalApplyBtn.disabled = false;
    modalSpinner.style.display = 'none';
     const textNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.textContent = 'Apply ';


    // Remove specific listeners on close
    modalCloseBtn.onclick = null;
    modalCancelBtn.onclick = null;
    modalApplyBtn.onclick = null;
    editModal.onclick = null;
}

// --- Handle Apply Crop and Upload ---
async function handleApplyCrop() {
    if (!cropper || !loggedInUser) {
        console.error("Cropper not ready or user not logged in.");
        alert("Cannot apply crop. Please wait or re-login.");
        return;
    }

    // Prevent multiple clicks
     if (modalApplyBtn.disabled) return;


    // Show loading state
    modalApplyBtn.disabled = true;
    modalSpinner.style.display = 'inline-block';
     const textNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
     if (textNode) textNode.textContent = 'Applying ';


    try {
         // Get cropped canvas - specify desired output size
        const canvas = cropper.getCroppedCanvas({
            width: 512, // Request a 512x512 output canvas
            height: 512,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high', // Use 'high' quality smoothing
        });


         if (!canvas) {
            throw new Error("Failed to get cropped canvas. Cropper might not be ready or image invalid.");
         }


         // Use Promise for blob conversion for cleaner async handling
         const blob = await new Promise((resolve, reject) => {
             canvas.toBlob((blobResult) => {
                 if (blobResult) {
                     resolve(blobResult);
                 } else {
                    reject(new Error("Canvas to Blob conversion failed."));
                }
             }, 'image/jpeg', 0.90); // Use JPEG format with high quality (adjust 0.90 if needed)
         });


        console.log("Blob created, size:", (blob.size / 1024).toFixed(2), "KB", "Type:", blob.type);


         // Upload to Cloudinary
        const imageUrl = await uploadToCloudinary(blob);
         console.log("Uploaded to Cloudinary, URL:", imageUrl);


        // Save URL to Firestore
        await saveProfilePictureUrl(loggedInUser.uid, imageUrl);
         console.log("Saved URL to Firestore.");


        // Update UI immediately
         profileImage.src = `${imageUrl}?timestamp=${Date.now()}`; // Add timestamp to bust cache
        profileImage.style.display = 'block';
        profileInitials.style.display = 'none';
         profileImage.onload = () => { updateProfileBackground(imageUrl); } // Update background *after* image loads


        // Update local cache (ensure data exists first)
        if (viewingUserProfileData?.profile?.id === loggedInUser.uid) {
            viewingUserProfileData.profile.profilePictureUrl = imageUrl;
            // Update viewer data cache as well
             if (viewerProfileData?.id === loggedInUser.uid) {
                viewerProfileData.profilePictureUrl = imageUrl;
            }
             saveCombinedDataToCache(loggedInUser.uid, viewingUserProfileData);
         }


        closeEditModal(); // Close modal on complete success


    } catch (error) {
        console.error("Error during crop/upload/save:", error);
         alert(`Failed to update profile picture: ${error.message || 'Unknown error during processing.'}`);
         // Reset button state on ANY error in the process
         modalApplyBtn.disabled = false;
         modalSpinner.style.display = 'none';
         if (textNode) textNode.textContent = 'Apply ';
     }
}

// --- Upload Blob to Cloudinary (using Fetch API for unsigned uploads) ---
async function uploadToCloudinary(blob) {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
         throw new Error("Cloudinary config missing (cloud name or upload preset).");
    }
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    const formData = new FormData();
    formData.append('file', blob, `pfp_${loggedInUser?.uid || 'anon'}.jpg`); // Sensible filename
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    // Add folder if your preset requires or for organization
    // formData.append('folder', 'user_profile_pictures');


    console.log(`Uploading to Cloudinary (${CLOUDINARY_CLOUD_NAME}, preset: ${CLOUDINARY_UPLOAD_PRESET})`);


    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData
            // No 'Content-Type' header needed; browser sets it for FormData
        });

        const data = await response.json(); // Attempt to parse response JSON

        if (!response.ok) {
             console.error("Cloudinary Upload Error Response:", data); // Log error details
            throw new Error(data.error?.message || `Cloudinary upload failed. Status: ${response.status}`);
        }


        // console.log("Cloudinary Upload Success:", data);
        if (!data.secure_url) {
            console.error("Cloudinary response OK, but missing 'secure_url':", data);
            throw new Error("Upload succeeded but did not return a secure URL.");
        }
        return data.secure_url; // Return the https URL


    } catch (networkError) {
        console.error("Network error during Cloudinary upload:", networkError);
        // Rethrow with a more user-friendly message if possible
        throw new Error(`Network error during image upload. Please check your connection.`);
    }
}

// --- Save Profile Picture URL to Firestore ---
async function saveProfilePictureUrl(userId, imageUrl) {
    if (!userId || !imageUrl) {
        throw new Error("Missing userId or imageUrl for saving PFP.");
    }
    const userDocRef = db.collection("users").doc(userId);
    try {
        await userDocRef.update({
            profilePictureUrl: imageUrl
        });
        console.log(`Successfully updated profilePictureUrl for user ${userId}`);
    } catch (error) {
        console.error(`Error updating Firestore profile picture URL for ${userId}:`, error);
         // Handle specific Firestore errors if needed (e.g., permissions)
        throw new Error("Database error saving profile picture link.");
    }
}

// =============================================================================
// --- Friend System Functions ---
// =============================================================================

// --- Helper: Fetch Minimal User Profile for Lists ---
async function fetchUserMiniProfile(userId) {
    if (!userId) return null;
     // Return cached data if available and seems valid
    if (miniProfileCache[userId] && miniProfileCache[userId].displayName) {
         // console.log(`Using cached mini profile for ${userId}`);
        return miniProfileCache[userId];
    }

    // console.log(`Fetching mini profile for ${userId}...`);
    try {
        const userSnap = await db.collection('users').doc(userId).get();
        if (userSnap.exists) {
            const data = userSnap.data();
            const miniProfile = {
                id: userId, // Always include ID
                displayName: data.displayName || `User...`, // Use fallback name
                profilePictureUrl: data.profilePictureUrl || null,
                // Optionally include rank/title if needed in lists
                // currentRank: data.currentRank || 'Unranked',
            };
            miniProfileCache[userId] = miniProfile; // Cache the fetched result
            return miniProfile;
        } else {
            console.warn(`Mini profile not found in Firestore for user ${userId}`);
            // Return a placeholder, but maybe DON'T cache "not found" state?
             // Cache a 'not found' representation to avoid repeated fetches for non-existent users?
             miniProfileCache[userId] = { id: userId, displayName: "User Not Found", profilePictureUrl: null }; // Cache not found state
             return miniProfileCache[userId]; // Return the not found state
        }
    } catch (error) {
        console.error(`Error fetching mini profile for ${userId}:`, error);
         // Return error state, don't cache to allow retry?
         // Or cache error state to prevent hammering? Depends on expected error frequency.
         return { id: userId, displayName: "Error Loading User", profilePictureUrl: null }; // Error representation, not cached?
    }
}


// --- Determine Friendship Status between Viewer and Profile Owner ---
function determineFriendshipStatus(viewerUid, profileOwnerUid) {
    // Status relies on the VIEWING user's `friends` map entry for the profile owner.
    if (!viewerUid || !profileOwnerUid || viewerUid === profileOwnerUid || !viewerProfileData || !viewerProfileData.friends) {
        // console.log("Determined status: 'none' (pre-check failed)");
        return 'none'; // Cannot determine: Not logged in, missing data, or viewing self.
    }
    const status = viewerProfileData.friends[profileOwnerUid];
    // console.log(`Determined status between ${viewerUid} and ${profileOwnerUid} from viewer data: ${status || 'none'}`);
    return status || 'none'; // Return the status ('friend', 'incoming', 'outgoing') or 'none' if no entry
}

// --- Clear Friendship Control Buttons ---
function clearFriendshipControls() {
    if (friendshipControlsContainer) {
        friendshipControlsContainer.innerHTML = '';
        // Optionally reset min-height if layout issues occur
        // friendshipControlsContainer.style.minHeight = '0';
    }
}

// --- Reset and Hide Friends Section ---
function resetFriendsSection() {
    if (friendsSection) friendsSection.style.display = 'none';

    // Reset Tab states visually
    const buttons = friendsTabsContainer?.querySelectorAll('.tab-button');
    const contents = friendsSection?.querySelectorAll('.tab-content');
     buttons?.forEach((btn, index) => {
        btn.classList.toggle('active', index === 0); // First tab active by default
         // Reset counts in tabs
        if(btn.dataset.tab === 'incoming-requests' && incomingCountSpan) incomingCountSpan.textContent = '0';
         if(btn.dataset.tab === 'outgoing-requests' && outgoingCountSpan) outgoingCountSpan.textContent = '0';
    });
    contents?.forEach((content, index) => {
         content.classList.toggle('active', index === 0); // First content active by default
        // Clear list content and add default message
         const list = content.querySelector('ul.friend-request-list');
         if (list) {
             list.innerHTML = `<li class="list-message">Loading...</li>`;
        }
     });

    // Ensure listener isn't added multiple times
    // friendsTabsContainer.dataset.listenerAttached = 'false'; // Reset flag if needed
}


// --- Display Friendship Control Buttons (Add, Cancel, Accept/Decline, Remove) ---
function displayFriendshipControls(status, profileOwnerUid) {
    clearFriendshipControls(); // Always clear previous buttons first
    // Ensure container exists and user is logged in and *not* viewing own profile
    if (!friendshipControlsContainer || !loggedInUser || isOwnProfile) {
        return;
    }

    // Set a min-height to prevent layout jumps when buttons appear
    friendshipControlsContainer.style.minHeight = '40px'; // Adjust value as needed


    let button = null;
    let button2 = null; // For Accept/Decline pair


    switch (status) {
        case 'none': // Not friends, no pending requests
            button = document.createElement('button');
            button.textContent = 'Add Friend';
            button.className = 'btn btn-primary'; // Main action style
             button.title = `Send a friend request to this user`;
            button.onclick = (e) => handleFriendAction(e.currentTarget, 'sendRequest', profileOwnerUid);
            break;
        case 'outgoing': // Viewer sent request to profile owner
            button = document.createElement('button');
            button.textContent = 'Cancel Request';
            button.className = 'btn btn-secondary btn-cancel'; // Secondary/cancel style
            button.title = `Cancel the friend request sent to this user`;
             button.onclick = (e) => handleFriendAction(e.currentTarget, 'cancelRequest', profileOwnerUid);
            break;
        case 'incoming': // Profile owner sent request to viewer
            button = document.createElement('button');
            button.textContent = 'Accept';
            button.className = 'btn btn-primary btn-accept btn-small'; // Smaller accept button
            button.title = `Accept the friend request from this user`;
             button.onclick = (e) => handleFriendAction(e.currentTarget, 'acceptRequest', profileOwnerUid);

            button2 = document.createElement('button');
            button2.textContent = 'Decline';
            button2.className = 'btn btn-secondary btn-decline btn-small'; // Smaller decline button
             button2.title = `Decline the friend request from this user`;
            button2.onclick = (e) => handleFriendAction(e.currentTarget, 'declineRequest', profileOwnerUid);
            break;
        case 'friend': // Already friends
            button = document.createElement('button');
            button.textContent = 'Remove Friend';
            button.className = 'btn btn-secondary btn-remove'; // Secondary/remove style
            button.title = `Remove this user from your friends list`;
             button.onclick = (e) => handleFriendAction(e.currentTarget, 'removeFriend', profileOwnerUid);
            break;
         default:
            console.warn("Unknown friendship status encountered:", status);
            break; // Don't show any buttons for unknown status
    }

    // Append buttons if created
    if (button) friendshipControlsContainer.appendChild(button);
    if (button2) friendshipControlsContainer.appendChild(button2); // Add second button if exists
}

// --- Display the Entire Friends Section (for Own Profile) ---
async function displayFriendsSection(profileData) {
    // Guard clause: Only run if viewing own profile AND required elements/data exist
    if (!isOwnProfile || !friendsSection || !profileData || typeof profileData.friends !== 'object') {
         // Ensure section is hidden if not applicable
         resetFriendsSection(); // Calls hide internally
        return;
    }


    // Ensure sections and lists exist before proceeding
     if (!friendsListUl || !incomingListUl || !outgoingListUl || !incomingCountSpan || !outgoingCountSpan || !friendsTabsContainer) {
         console.error("Required friend section elements are missing from the DOM.");
         resetFriendsSection(); // Hide section if elements are missing
         return;
     }


    console.log("Displaying friends section for own profile...");
    friendsSection.style.display = 'block'; // Show the section container


    const friendsMap = profileData.friends || {}; // Use empty map as fallback
    const friendIds = [];
    const incomingIds = [];
    const outgoingIds = [];


    // Categorize users based on status in own profile's friends map
    for (const userId in friendsMap) {
         if (friendsMap.hasOwnProperty(userId)) { // Ensure it's own property
             switch (friendsMap[userId]) {
                 case 'friend': friendIds.push(userId); break;
                case 'incoming': incomingIds.push(userId); break; // Request received FROM them
                case 'outgoing': outgoingIds.push(userId); break; // Request sent TO them
            }
        }
    }


    // Update counts displayed in tabs
    incomingCountSpan.textContent = incomingIds.length;
    outgoingCountSpan.textContent = outgoingIds.length;


    // Populate lists (these functions handle fetching mini profiles)
    // Using Promise.all to fetch and populate concurrently for better performance
    try {
        await Promise.all([
             populateFriendList(friendsListUl, friendIds, 'friend', 'You have no friends yet.'),
             populateFriendList(incomingListUl, incomingIds, 'incoming', 'No incoming friend requests.'),
             populateFriendList(outgoingListUl, outgoingIds, 'outgoing', 'No outgoing friend requests.')
         ]);
    } catch(listError) {
        console.error("Error populating one or more friend lists:", listError);
         // Handle partial failure? Show error in failed lists?
    }

     // Setup Tab Switching Listener (only needs to be attached once)
    // Check if listener already attached using a data attribute flag
    if (friendsTabsContainer && !friendsTabsContainer.dataset.listenerAttached) {
         friendsTabsContainer.addEventListener('click', (event) => {
            const clickedButton = event.target.closest('.tab-button'); // Find button even if icon inside is clicked
            if (clickedButton) {
                const targetTabId = clickedButton.dataset.tab;
                if (!targetTabId) {
                    console.warn("Tab button clicked but missing 'data-tab' attribute.");
                     return;
                }

                // Get all tab buttons and content panes within the specific #friends-section
                const currentTabButtons = friendsTabsContainer.querySelectorAll('.tab-button');
                 const currentTabContents = friendsSection.querySelectorAll('.tab-content');


                 // Remove active class from all buttons and content panes
                 currentTabButtons.forEach(btn => btn.classList.remove('active'));
                 currentTabContents.forEach(content => content.classList.remove('active'));


                // Add active class to the clicked button
                 clickedButton.classList.add('active');


                 // Find and activate the corresponding content pane
                 const targetContent = friendsSection.querySelector(`#${targetTabId}-container`);
                 if (targetContent) {
                     targetContent.classList.add('active');
                 } else {
                    console.error(`Could not find tab content for ID: #${targetTabId}-container`);
                }
            }
        });
         friendsTabsContainer.dataset.listenerAttached = 'true'; // Set flag
     }
}

// --- Populate a specific friend/request list ---
async function populateFriendList(ulElement, userIds, type, emptyMessage) {
    if (!ulElement) return; // Safety check
    ulElement.innerHTML = ''; // Clear previous items (including loading messages)

    if (!userIds || userIds.length === 0) {
        ulElement.innerHTML = `<li class="list-message">${emptyMessage}</li>`;
        return;
    }

    // Show a temporary loading message while fetching profiles
     ulElement.innerHTML = `<li class="list-message">Loading user details...</li>`;

    // Fetch mini profiles for all users in parallel
    const profilePromises = userIds.map(id => fetchUserMiniProfile(id).catch(err => {
         // Handle individual fetch errors gracefully within map
         console.error(`Error fetching mini profile for ${id} in list ${type}:`, err);
         return { id: id, displayName: "Error Loading", profilePictureUrl: null }; // Return error placeholder
     }));
    const profiles = await Promise.all(profilePromises);

     // Filter out potential null results from fetch errors handled above
    const validProfiles = profiles.filter(p => p !== null);


     ulElement.innerHTML = ''; // Clear loading message after fetching


    // Create and append list items
    let itemsAdded = 0;
     validProfiles.forEach(miniProfile => {
        // Ensure miniProfile has essential data, otherwise skip or show placeholder
         if (miniProfile && miniProfile.id && miniProfile.displayName) {
             if (miniProfile.displayName === "Error Loading User" || miniProfile.displayName === "User Not Found") {
                 // Optionally display a different kind of item for error/not found
                ulElement.appendChild(createFriendListItemError(miniProfile.id, miniProfile.displayName));
            } else {
                 // Create standard item
                 ulElement.appendChild(createFriendListItem(miniProfile, type));
                 itemsAdded++;
             }
         } else {
            console.warn(`Skipping invalid miniProfile object for list ${type}:`, miniProfile);
        }
    });

    // If after fetching and filtering, the list is empty (e.g., all fetches failed or resulted in placeholders)
     if (itemsAdded === 0 && validProfiles.length > 0) { // Check if there were IDs but nothing valid to display
         // Maybe keep the placeholder items visible or show a general error?
         ulElement.innerHTML = `<li class="list-message">Could not load user details.</li>`;
    } else if (ulElement.childElementCount === 0) { // Should only happen if userIds was initially empty
         ulElement.innerHTML = `<li class="list-message">${emptyMessage}</li>`;
     }
}

// --- Create HTML for a single list item ---
function createFriendListItem(miniProfile, type) {
    const li = document.createElement('li');
    li.className = 'friend-item'; // Use class for styling group
    li.dataset.userId = miniProfile.id; // Store user ID for actions


    // Info Part (PFP + Name)
    const infoDiv = document.createElement('div');
    infoDiv.className = 'friend-item-info';


    // Profile Picture or Initials Element
    const pfpElement = createFriendPfpElement(miniProfile);
    infoDiv.appendChild(pfpElement);


    // Name (clickable link)
    const nameSpan = document.createElement('span');
    nameSpan.className = 'friend-item-name';
    const nameLink = document.createElement('a');
    nameLink.href = `profile.html?uid=${miniProfile.id}`; // Link to their profile
    nameLink.textContent = miniProfile.displayName;
     nameLink.title = `View ${miniProfile.displayName}'s profile`;
    nameSpan.appendChild(nameLink);
    infoDiv.appendChild(nameSpan);


    li.appendChild(infoDiv);


    // Actions Part (Buttons)
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'friend-item-actions';


    let button1 = null;
     let button2 = null;


     switch(type) {
        case 'friend':
            button1 = createFriendActionButton('Remove', 'remove', 'secondary', miniProfile.id, li);
             break;
         case 'incoming':
             button1 = createFriendActionButton('Accept', 'accept', 'primary', miniProfile.id, li);
             button2 = createFriendActionButton('Decline', 'decline', 'secondary', miniProfile.id, li);
             break;
         case 'outgoing':
             button1 = createFriendActionButton('Cancel', 'cancel', 'secondary', miniProfile.id, li);
            break;
    }

    if(button1) actionsDiv.appendChild(button1);
    if(button2) actionsDiv.appendChild(button2);


    li.appendChild(actionsDiv);


    return li;
}

// Helper to create PFP element with fallback
function createFriendPfpElement(miniProfile) {
    const container = document.createElement('div'); // Use div for easier replacement
    container.style.width = '40px'; // Match CSS size
    container.style.height = '40px';
    container.style.flexShrink = '0'; // Prevent shrinking

    const initialDiv = document.createElement('div');
    initialDiv.className = 'friend-item-pfp-initial';
    initialDiv.textContent = miniProfile.displayName?.charAt(0)?.toUpperCase() || '?';
    initialDiv.style.display = 'flex'; // Ensure initials are visible by default

    container.appendChild(initialDiv); // Add initials first

    if (miniProfile.profilePictureUrl) {
        const img = document.createElement('img');
        img.src = miniProfile.profilePictureUrl;
        img.alt = `${miniProfile.displayName || 'User'}'s profile picture`;
        img.className = 'friend-item-pfp';
        img.style.display = 'none'; // Hide image initially

        img.onload = () => {
            initialDiv.style.display = 'none'; // Hide initials
             img.style.display = 'block'; // Show image
        };
        img.onerror = () => { // If image fails to load
             console.warn(`Failed to load PFP image for ${miniProfile.id}`);
            img.style.display = 'none'; // Ensure failed image is hidden
             initialDiv.style.display = 'flex'; // Ensure initials are shown
        };
        container.appendChild(img); // Append image (might replace initial on load)
    }

    return container;
}


// Helper to create Action Buttons
function createFriendActionButton(text, type, style, userId, listItem) {
    const btn = document.createElement('button');
     btn.textContent = text;
    btn.className = `btn btn-${style} btn-${type} btn-small`; // Combine base, style, type, and size classes
     // Map internal type to action string for handler
     const actionMap = { remove: 'removeFriend', accept: 'acceptRequest', decline: 'declineRequest', cancel: 'cancelRequest' };
    btn.onclick = (e) => handleFriendAction(e.currentTarget, actionMap[type], userId, listItem);
     btn.title = `${text} friend request/friendship`; // Add tooltip
     return btn;
 }

// Helper to create error/placeholder list item
 function createFriendListItemError(userId, message) {
    const li = document.createElement('li');
    li.className = 'friend-item list-message'; // Style as a message within the list
    li.dataset.userId = userId; // Store ID if available
     li.innerHTML = `
         <div class="friend-item-info" style="opacity: 0.6;">
            <div class="friend-item-pfp-initial" style="background-color: var(--text-secondary);">?</div>
            <span class="friend-item-name">${message} (ID: ${userId ? userId.substring(0,8) + '...' : 'N/A'})</span>
        </div>
         <div class="friend-item-actions"></div> <!-- Empty actions -->
     `;
     return li;
 }

// --- Master Handler for Friend Actions (using Batch Writes) ---
async function handleFriendAction(buttonElement, action, otherUserId, listItemToRemove = null) {
    if (!loggedInUser || !otherUserId) {
        console.error("Friend action validation failed: Not logged in or target user ID missing.");
        alert("Could not perform action. Please ensure you are logged in.");
        return;
    }
    if (!buttonElement) {
        console.error("Friend action validation failed: Button element missing.");
        return; // Should not happen if called from onclick
    }


    const currentUserUid = loggedInUser.uid;


    // Prevent multi-clicks, show loading state
    buttonElement.disabled = true;
    const originalText = buttonElement.textContent; // Store original text
     buttonElement.textContent = '...';


    // Disable sibling buttons (e.g., Accept/Decline in the same list item)
    const actionContainer = buttonElement.closest('.friend-item-actions') || friendshipControlsContainer;
    const siblingButtons = actionContainer ? Array.from(actionContainer.querySelectorAll('button')) : [];
    siblingButtons.forEach(btn => {
        if (btn !== buttonElement) {
             btn.disabled = true;
        }
    });


    const userDocRef = db.collection('users').doc(currentUserUid);
    const otherUserDocRef = db.collection('users').doc(otherUserId);
    const batch = db.batch();

    try {
        console.log(`Performing friend action: ${action} between ${currentUserUid} and ${otherUserId}`);


         // Use FieldValue.delete() for removal actions
         const deleteField = firebase.firestore.FieldValue.delete();


         // Define batch operations based on the action
        switch (action) {
            case 'sendRequest':
                // My doc: status for them becomes 'outgoing'
                batch.update(userDocRef, { [`friends.${otherUserId}`]: 'outgoing' });
                // Their doc: status for me becomes 'incoming'
                batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: 'incoming' });
                break;
            case 'cancelRequest': // I cancel my outgoing request
                batch.update(userDocRef, { [`friends.${otherUserId}`]: deleteField });
                batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: deleteField });
                break;
            case 'declineRequest': // I decline their incoming request
                 batch.update(userDocRef, { [`friends.${otherUserId}`]: deleteField });
                batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: deleteField });
                break;
            case 'removeFriend': // Either user removes the friend
                batch.update(userDocRef, { [`friends.${otherUserId}`]: deleteField });
                batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: deleteField });
                break;
            case 'acceptRequest': // I accept their incoming request
                batch.update(userDocRef, { [`friends.${otherUserId}`]: 'friend' });
                batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: 'friend' });
                break;
            default:
                throw new Error(`Invalid friend action: ${action}`);
        }

        // Commit the batch
        await batch.commit();
        console.log("Friend action batch committed successfully.");

        // --- Update Local State and UI Post-Success ---

        // Clear relevant mini-profile cache entries immediately
        delete miniProfileCache[currentUserUid]; // Clear own cache entry (in case rank/etc changed somehow)
        delete miniProfileCache[otherUserId];

        // 1. Refresh the *viewer's* profile data from Firestore to get the latest `friends` map
         try {
            const viewerSnap = await userDocRef.get();
            if (viewerSnap.exists) {
                 const latestViewerData = { id: viewerSnap.id, ...viewerSnap.data() };
                if (!latestViewerData.friends) latestViewerData.friends = {};
                 viewerProfileData = latestViewerData; // Update global viewer data
                // If viewing own profile, also update viewingUserProfileData
                 if (isOwnProfile) {
                    viewingUserProfileData.profile = viewerProfileData; // Keep viewed profile data in sync
                    viewingUserProfileData.stats = viewingUserProfileData.stats || null; // Preserve existing stats
                     saveCombinedDataToCache(currentUserUid, viewingUserProfileData); // Re-cache own profile
                 }
                console.log("Refreshed viewerProfileData after action.");
            } else {
                console.error("Failed to refetch viewer profile after action! Local state may be inconsistent.");
                // Attempt to manually update local viewerProfileData based on action (risky fallback)
                // UpdateFriendsMapLocally(currentUserUid, otherUserId, action);
            }
         } catch (fetchError) {
             console.error("Error refetching viewer profile after action:", fetchError);
             // Proceed with possibly stale viewerProfileData, UI updates might be incorrect
         }

        // 2. Update UI based on context (viewing other vs. own profile)
        if (isOwnProfile) {
            // Update the entire friend section using the refreshed viewer/profile data
             console.log("Refreshing friends section on own profile after action.");
            displayFriendsSection(viewerProfileData); // Pass the UPDATED data
        } else if (viewingUserProfileData.profile?.id === otherUserId) {
             // If viewing the affected user's profile, recalculate and display controls
             console.log("Refreshing friendship controls on other user's profile after action.");
             const newStatus = determineFriendshipStatus(currentUserUid, otherUserId);
             displayFriendshipControls(newStatus, otherUserId);
         }
        // No need to explicitly remove listItemToRemove, displayFriendsSection handles full refresh

    } catch (error) {
        console.error(`Error performing friend action '${action}':`, error);
        alert(`An error occurred: ${error.message || 'Failed to perform friend action.'}. Please try again.`);
         // Re-enable Button(s) on Error
         buttonElement.disabled = false;
         buttonElement.textContent = originalText; // Restore original text
         siblingButtons.forEach(btn => {
            if (btn !== buttonElement) btn.disabled = false; // Re-enable siblings too
        });
    }
}


// =============================================================================
// --- Authentication and Initialization ---
// =============================================================================

// --- Auth State Change Handler ---
auth.onAuthStateChanged(async (user) => { // Make async to allow awaiting setup steps
    console.log(`Auth state changed. User: ${user ? user.uid : 'None'}`);
    loggedInUser = user; // Update global loggedInUser state immediately
    const targetUid = profileUidFromUrl || loggedInUser?.uid; // Determine whose profile to load


    // Clear potentially stale data from previous user/state
    viewerProfileData = null;
    viewingUserProfileData = {};
    miniProfileCache = {}; // Reset mini-profile cache on auth change
    isOwnProfile = loggedInUser && targetUid === loggedInUser.uid; // Determine ownership


    if (targetUid) {
        // User is logged in OR a UID is provided in URL
         console.log(`Targeting profile UID: ${targetUid}`);


        // Show loading, hide content/errors initially
        if (loadingIndicator) loadingIndicator.style.display = 'flex';
        if (notLoggedInMsg) notLoggedInMsg.style.display = 'none';
        if (profileContent) profileContent.style.display = 'none';
         if (achievementsSection) achievementsSection.style.display = 'none'; // Ensure hidden
         if (friendsSection) friendsSection.style.display = 'none'; // Ensure hidden

        // --- Load Data ---
        try {
             // Pre-fetch definitions (can happen while loading main data)
            if (!allAchievements) fetchAllAchievements();

            // Call the main data loading function
             await loadCombinedUserData(targetUid);

            // loadCombinedUserData now handles hiding loader and showing content/errors internally
             console.log("Initial data load process completed.");


             // Final UI setup based on loaded data and ownership
             if (viewingUserProfileData.profile) { // Check if profile was loaded successfully
                // Setup interactions specific to profile owner AFTER data is loaded/displayed
                if (isOwnProfile) {
                    setupProfilePicEditing(); // Attach PFP edit listener
                    // Friend section interaction setup is inside displayFriendsSection
                    // Title interaction setup is inside updateProfileTitlesAndRank
                } else {
                     if(editProfilePicIcon) editProfilePicIcon.style.display = 'none'; // Ensure non-owners cannot edit PFP
                }
                // Ensure logout button visibility is correct
                profileLogoutBtn.style.display = isOwnProfile ? 'inline-block' : 'none';
             } else {
                // If profile wasn't loaded, ensure logout btn is hidden etc.
                 profileLogoutBtn.style.display = 'none';
                // Error message should be displayed by loadCombinedUserData
            }

        } catch (err) {
            console.error("Critical error during initial profile load sequence:", err);
            // Show generic error message if loadCombinedUserData failed catastrophically
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            if (profileContent) profileContent.style.display = 'none';
             if (notLoggedInMsg) {
                notLoggedInMsg.textContent = 'Failed to load profile. An unexpected error occurred.';
                notLoggedInMsg.style.display = 'flex';
            }
             // Ensure dependent sections are also hidden
            if (achievementsSection) achievementsSection.style.display = 'none';
            if (friendsSection) friendsSection.style.display = 'none';
            profileLogoutBtn.style.display = 'none'; // Hide logout on critical failure
            clearFriendshipControls();
             resetFriendsSection();
        }

    } else {
        // --- No User Logged In AND No UID in URL ---
        console.log('No user logged in and no profile UID in URL.');


        // Display "Not Logged In" message and hide profile content/loading
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (profileContent) profileContent.style.display = 'none';
        if (notLoggedInMsg) {
            notLoggedInMsg.style.display = 'flex';
             // More informative message:
            notLoggedInMsg.innerHTML = 'Please <a href="index.html#login-section" style="color: var(--primary-orange); margin: 0 5px;">log in</a> to view your profile, or provide a user ID in the URL.';
             // Assuming your index.html has an element with id="login-section" for login form. Adjust link if needed.
        }


        // Reset UI elements fully
        if (adminTag) adminTag.style.display = 'none';
        if (profileBadgesContainer) profileBadgesContainer.innerHTML = '';
        if (profileLogoutBtn) profileLogoutBtn.style.display = 'none';
        if (editProfilePicIcon) editProfilePicIcon.style.display = 'none';
        updateProfileTitlesAndRank(null, false);
        if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = '';
        if (poxelStatsSection) poxelStatsSection.style.display = 'none';
        updateProfileBackground(null);
        closeTitleSelector();
        closeEditModal();
        clearFriendshipControls();
        resetFriendsSection();
         if (achievementsSection) achievementsSection.style.display = 'none'; // Reset achievements section


        // Clear global data state
         viewingUserProfileData = {};
         viewerProfileData = null;
        miniProfileCache = {};
    }
});

// --- Logout Button Event Listener ---
profileLogoutBtn.addEventListener('click', () => {
    const userId = loggedInUser?.uid; // Get UID before potential logout completes
    console.log(`Logout button clicked by user: ${userId || 'N/A'}`);


    // Clean up UI elements and listeners associated with the logged-in state
     if (titleDisplay) titleDisplay.removeEventListener('click', handleTitleClick);
     closeTitleSelector(); // Close any open dropdowns
     closeEditModal(); // Close any open modals


    // Clear sensitive / user-specific content immediately
     clearFriendshipControls();
     resetFriendsSection();
    if (achievementsSection) achievementsSection.style.display = 'none';
    // Reset PFP editor functionality
     if (editProfilePicIcon) editProfilePicIcon.onclick = null;
    if (profilePicInput) profilePicInput.onchange = null;


     // Sign out from Firebase
     auth.signOut().then(() => {
        console.log('User signed out successfully.');
         // Clear cached data for the logged-out user
        if (userId) {
            localStorage.removeItem(`poxelProfileCombinedData_${userId}`);
            console.log(`Cleared cached profile data for UID: ${userId}`);
         }


        // Clear global variables
        loggedInUser = null;
        viewerProfileData = null;
         viewingUserProfileData = {}; // Clear viewed data too
         miniProfileCache = {};
        isOwnProfile = false;


        // Redirect or let onAuthStateChanged handle the UI reset
        // onAuthStateChanged *will* trigger with user=null, handling the UI reset.
        // Redirect explicitly if desired:
        window.location.href = 'index.html'; // Redirect to home or login page


    }).catch((error) => {
        console.error('Sign out error:', error);
        alert('Error signing out. Please try again.');
         // Re-enable UI? Generally better to let state change handler manage UI.
    });
});

// =============================================================================
// --- Local Storage Caching ---
// =============================================================================

function loadCombinedDataFromCache(viewedUserId) {
    if (!viewedUserId) return false;
    const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;


    try {
        const cachedDataString = localStorage.getItem(cacheKey);
        if (!cachedDataString) {
             // console.log(`No cache found for UID: ${viewedUserId}`);
            return false;
        }


        const cachedData = JSON.parse(cachedDataString);


        // Basic validation: ensure profile object and its id exist
         if (cachedData && cachedData.profile && cachedData.profile.id === viewedUserId) {


             // Ensure crucial nested structures exist in cached data (add defaults if missing)
             cachedData.profile.friends = cachedData.profile.friends || {};
             cachedData.profile.leaderboardStats = cachedData.profile.leaderboardStats || {};
             cachedData.profile.availableTitles = cachedData.profile.availableTitles || [];
             cachedData.profile.equippedTitle = cachedData.profile.equippedTitle !== undefined ? cachedData.profile.equippedTitle : "";
             cachedData.profile.currentRank = cachedData.profile.currentRank || "Unranked";
             cachedData.stats = cachedData.stats || null; // Cache might just have profile


             viewingUserProfileData = cachedData; // Load data into global state
             console.log("Loaded combined data from cache for VIEWED UID:", viewedUserId);


             // Determine if the cached view is for the currently logged-in user
             // (Check against auth.currentUser which should be available if needed)
             const viewingOwnCachedProfile = loggedInUser && loggedInUser.uid === viewedUserId;


             // --- Display data from cache IMMEDIATELY ---
            displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats, viewingOwnCachedProfile);
             // Note: Poxel stats are NOT cached here, fetched live later.
             // Note: Friends/Achievement sections are populated later after live fetches/checks.


             return true; // Indicate cache was successfully loaded and displayed
         } else {
            console.warn(`Invalid or mismatched cache data for UID: ${viewedUserId}. Removing.`);
            localStorage.removeItem(cacheKey);
            return false;
        }
    } catch (error) {
        console.error("Error loading or parsing cached profile data:", error);
        try { localStorage.removeItem(cacheKey); } catch(removeError) {} // Remove potentially corrupted cache
        return false;
    }
}


function saveCombinedDataToCache(viewedUserId, combinedData) {
    if (!viewedUserId || !combinedData || !combinedData.profile || !combinedData.profile.id) {
        console.warn("Attempted to save invalid data to cache (missing profile/id). Aborting.", { viewedUserId, combinedData });
        return;
    }
    // Ensure data integrity (especially ensuring ID matches)
     if(viewedUserId !== combinedData.profile.id) {
         console.error(`Cache save mismatch: Key UID ${viewedUserId} does not match profile data UID ${combinedData.profile.id}. Aborting.`);
         return;
     }

    const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;


    try {
        // Ensure nested objects exist before stringifying to avoid saving `undefined`
         const dataToSave = {
             profile: {
                 ...combinedData.profile,
                 friends: combinedData.profile.friends || {},
                 availableTitles: combinedData.profile.availableTitles || [],
                 equippedTitle: combinedData.profile.equippedTitle !== undefined ? combinedData.profile.equippedTitle : "",
                 currentRank: combinedData.profile.currentRank || "Unranked",
                 leaderboardStats: combinedData.profile.leaderboardStats || {}
                 // Explicitly exclude potentially large/sensitive fields if needed:
                 // poxelStats: undefined, // Example: Don't cache poxel stats
            },
             stats: combinedData.stats || null // Save comp stats if available
         };


        localStorage.setItem(cacheKey, JSON.stringify(dataToSave));
        // console.log(`Saved combined data to cache for UID: ${viewedUserId}`);
    } catch(error) {
        console.error(`Error saving profile data to cache for UID ${viewedUserId}:`, error);
        if (error.name === 'QuotaExceededError' || (error.message && error.message.toLowerCase().includes('quota'))) {
             console.warn('LocalStorage quota exceeded. Cannot cache profile data. Consider clearing storage.');
             // Implement cache eviction strategy here if needed (e.g., remove oldest entries)
         }
     }
}


// --- Initial Log ---
console.log("Profile script initialized. Waiting for Auth state...");
