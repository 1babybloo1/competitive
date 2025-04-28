// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI", // Replace with your real key
    authDomain: "poxelcomp.firebaseapp.com",
    projectId: "poxelcomp",
    storageBucket: "poxelcomp.firebasestorage.app", // CHECK IF CORRECT
    messagingSenderId: "620490990104",
    appId: "1:620490990104:web:709023eb464c7d886b996d",
};

// --- Initialize Firebase (Compat Version) ---
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// --- Constants ---
const BANNED_USERS_COLLECTION = 'banned_users';
const USERS_COLLECTION = 'users';
const LEADERBOARD_COLLECTION = 'leaderboard';
const ACHIEVEMENTS_COLLECTION = 'achievements';
const USER_ACHIEVEMENTS_COLLECTION = 'userAchievements';

// --- Configuration ---
const adminEmails = [
    'trixdesignsofficial@gmail.com', // Replace/add your admin emails
    'jackdmbell@outlook.com'
].map(email => email.toLowerCase());

const badgeConfig = {
    verified: { emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()), className: 'badge-verified', title: 'Verified' },
    creator: { emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()), className: 'badge-creator', title: 'Content Creator' },
    moderator: { emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()), className: 'badge-moderator', title: 'Moderator' } // Removed sample mod email
};

// --- DOM Elements ---
const profileContentDiv = document.getElementById('profile-content');
const profileContainerDiv = document.getElementById('profile-container'); // Container for banned styling
const loadingIndicatorDiv = document.getElementById('loading-profile');
const notLoggedInMsgDiv = document.getElementById('not-logged-in');
const profilePicDiv = document.getElementById('profile-pic');
const usernameDisplayH2 = document.getElementById('profile-username');
const emailDisplayP = document.getElementById('profile-email');
const statsDisplayDiv = document.getElementById('stats-display');
const profileLogoutBtn = document.getElementById('profile-logout-btn');
const adminTagSpan = document.getElementById('admin-tag');
const rankDisplaySpan = document.getElementById('profile-rank');
const titleDisplaySpan = document.getElementById('profile-title');
const profileIdentifiersDiv = document.querySelector('.profile-identifiers');
const profileBadgesContainerSpan = document.getElementById('profile-badges-container');
const banStatusDisplayDiv = document.getElementById('ban-status-display'); // Ban status element

// --- Global State ---
let loggedInUser = null; // Updated by auth listener
let viewingProfileUid = null; // The UID of the profile currently being viewed
let viewingUserProfileData = { profile: null, stats: null, isBanned: false, banReason: null }; // Holds combined data for the VIEWED profile
let allAchievements = null; // Cache for achievement definitions
let isTitleSelectorOpen = false;
let titleSelectorElement = null;
let profileDataListenerUnsubscribe = null; // Firestore listener

// --- Helper: Escape HTML ---
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    try {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    } catch(e) { console.warn("HTML escape failed:", e); return "Error"; }
}

// --- Helper: Fetch Achievement Definitions ---
async function fetchAllAchievements() {
    if (allAchievements) return allAchievements;
    try {
        const snapshot = await db.collection(ACHIEVEMENTS_COLLECTION).get();
        allAchievements = {};
        snapshot.forEach(doc => { allAchievements[doc.id] = { id: doc.id, ...doc.data() }; });
        console.log("Fetched achievement definitions:", allAchievements);
        return allAchievements;
    } catch (error) { console.error("Error fetching achievements:", error); return null; }
}

// --- Helper: Display User Badges ---
function displayUserBadges(profileData) {
    if (!profileBadgesContainerSpan) return;
    profileBadgesContainerSpan.innerHTML = '';
    const userEmail = profileData?.email?.toLowerCase();
    if (!userEmail) return;

    adminTagSpan.style.display = adminEmails.includes(userEmail) ? 'inline-block' : 'none';

    for (const type in badgeConfig) {
        if (badgeConfig[type].emails.includes(userEmail)) {
            const badgeSpan = document.createElement('span');
            badgeSpan.className = `profile-badge ${badgeConfig[type].className}`;
            badgeSpan.title = badgeConfig[type].title;
            profileBadgesContainerSpan.appendChild(badgeSpan);
        }
    }
}

// --- UI State Management ---
function showLoadingState() {
    profileContentDiv.style.display = 'none';
    notLoggedInMsgDiv.style.display = 'none';
    loadingIndicatorDiv.style.display = 'flex';
}

function showErrorState(message = "Profile information is unavailable.") {
    profileContentDiv.style.display = 'none';
    loadingIndicatorDiv.style.display = 'none';
    notLoggedInMsgDiv.innerHTML = `<p>${escapeHtml(message)}</p>`;
    notLoggedInMsgDiv.style.display = 'flex';
    // Clear potential leftover data
    usernameDisplayH2.textContent = "Error";
    profilePicDiv.textContent = "!";
    adminTagSpan.style.display = 'none';
    if (profileBadgesContainerSpan) profileBadgesContainerSpan.innerHTML = '';
    updateProfileTitlesAndRank(null, false); // Clear rank/title
    if (statsDisplayDiv) statsDisplayDiv.innerHTML = '';
    if (banStatusDisplayDiv) banStatusDisplayDiv.style.display = 'none';
    if (profileContainerDiv) profileContainerDiv.classList.remove('banned-profile');
}

function showProfileContent() {
    loadingIndicatorDiv.style.display = 'none';
    notLoggedInMsgDiv.style.display = 'none';
    profileContentDiv.style.display = 'block';
}

// --- Auth State Listener ---
auth.onAuthStateChanged(user => {
    loggedInUser = user; // Update global reference to logged-in user
    const urlParams = new URLSearchParams(window.location.search);
    const profileUidFromUrl = urlParams.get('uid');
    const targetUid = profileUidFromUrl || loggedInUser?.uid; // Prioritize URL UID

    console.log(`Auth state change: LoggedIn=${!!user}, TargetUID=${targetUid}`);

    if (targetUid) {
        if (targetUid !== viewingProfileUid) { // Load only if target changed
            viewingProfileUid = targetUid;
            loadAndDisplayUserProfile(viewingProfileUid); // Initiate loading
        } else {
            // Target UID hasn't changed, maybe just logged in/out
            // Re-render based on current data and potentially updated login state
             if (viewingUserProfileData.profile) {
                 displayProfileData(viewingUserProfileData);
             } else {
                  // Data might not be loaded yet if auth change happened quickly
                  loadAndDisplayUserProfile(viewingProfileUid);
             }
        }
        profileLogoutBtn.style.display = (loggedInUser && loggedInUser.uid === targetUid) ? 'inline-block' : 'none';
    } else {
        // No target UID (not logged in, no UID in URL)
        viewingProfileUid = null;
        showErrorState("Please log in to view your profile or provide a user ID in the URL.");
        profileLogoutBtn.style.display = 'none';
        clearProfileListener(); // Detach any listener
    }
});

// --- Detach Firestore Listener ---
function clearProfileListener() {
    if (profileDataListenerUnsubscribe) {
        console.log("Detaching Firestore profile listener for UID:", viewingProfileUid);
        profileDataListenerUnsubscribe();
        profileDataListenerUnsubscribe = null;
    }
}

// --- Load and Display User Profile (Main Function) ---
async function loadAndDisplayUserProfile(userId) {
    if (!userId) {
        showErrorState("No user ID specified.");
        return;
    }
    console.log(`Initiating profile load for UID: ${userId}`);
    showLoadingState();
    clearProfileListener(); // Detach previous listener before attaching new one

    // Fetch initial data once (ban status, profile, stats)
    // We'll use a listener for the profile/stats for real-time updates later
    try {
        // 1. Check Ban Status
        const banDocRef = db.collection(BANNED_USERS_COLLECTION).doc(userId);
        const banDoc = await banDocRef.get();
        const isBanned = banDoc.exists;
        const banReason = isBanned ? (banDoc.data()?.reason || "No reason provided.") : null;
        if (isBanned) console.log(`User ${userId} IS BANNED. Reason: ${banReason}`);

        // 2. Get User Profile & Leaderboard Stats (Initial Load)
        const userProfileRef = db.collection(USERS_COLLECTION).doc(userId);
        const leaderboardStatsRef = db.collection(LEADERBOARD_COLLECTION).doc(userId);

        const [profileSnap, statsSnap] = await Promise.all([
            userProfileRef.get(),
            leaderboardStatsRef.get()
        ]);

        let profileData = null;
        if (!profileSnap.exists) {
            console.warn(`User profile document does NOT exist for UID: ${userId}`);
             // If banned but no profile, show special state
             if (isBanned) {
                 showBannedOnlyState(userId, banReason);
                 return; // Stop further processing
             }
             // Attempt to create profile ONLY if it's the logged-in user viewing their own (non-existent) profile
             else if (loggedInUser && loggedInUser.uid === userId) {
                profileData = await createUserProfileDocument(userId, loggedInUser);
                if (!profileData) { throw new Error(`Profile creation failed.`); }
            } else {
                 showErrorState("Profile not found."); return; // Profile doesn't exist, not banned, not logged-in user
            }
        } else {
            profileData = { id: profileSnap.id, ...profileSnap.data() };
        }

        const statsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null;

        // Store initial state
        viewingUserProfileData = { profile: profileData, stats: statsData, isBanned: isBanned, banReason: banReason };
        displayProfileData(viewingUserProfileData); // Initial display
        showProfileContent();

        // 3. Attach Real-time Listener (Optional, for profile/stats updates)
        // This combines profile and stats updates into one listener flow
        // Note: Ban status is NOT listened to in real-time here, requires page refresh
        // attachRealtimeListener(userId); // Uncomment if real-time updates are desired

        // 4. Check Achievements (after initial display)
        if (loggedInUser && loggedInUser.uid === userId && viewingUserProfileData.profile && viewingUserProfileData.stats) {
            await checkAndApplyAchievements(userId);
        }

    } catch (error) {
        console.error(`Error loading profile data for ${userId}:`, error);
        showErrorState(`Error loading profile: ${error.message}`);
    }
}

// --- (Optional) Attach Real-time Listener ---
/*
function attachRealtimeListener(userId) {
    clearProfileListener(); // Ensure no duplicate listeners
    console.log(`Attaching real-time listener for UID: ${userId}`);

    const userProfileRef = db.collection(USERS_COLLECTION).doc(userId);
    const leaderboardStatsRef = db.collection(LEADERBOARD_COLLECTION).doc(userId);

    // Note: This approach fetches both docs whenever either changes.
    // More complex listeners could target individual docs if needed.
    profileDataListenerUnsubscribe = userProfileRef.onSnapshot(async (profileSnap) => {
        console.log(`Real-time update received for profile UID: ${userId}`);
        const profileExists = profileSnap.exists;
        const updatedProfileData = profileExists ? { id: profileSnap.id, ...profileSnap.data() } : null;

        // Fetch the latest stats data to combine with the profile update
        try {
            const statsSnap = await leaderboardStatsRef.get();
            const updatedStatsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null;

            // Get current ban status (not real-time)
            const isBanned = viewingUserProfileData.isBanned;
            const banReason = viewingUserProfileData.banReason;

            if (!profileExists && !isBanned) {
                 console.warn("Profile document deleted and user is not banned.");
                 showErrorState("Profile not found."); // Handle deletion
                 clearProfileListener(); // Stop listening if profile deleted
                 return;
            } else if (!profileExists && isBanned) {
                 showBannedOnlyState(userId, banReason); // Show banned state even if profile deleted
            } else {
                 // Update and re-render
                 viewingUserProfileData = { profile: updatedProfileData, stats: updatedStatsData, isBanned: isBanned, banReason: banReason };
                 displayProfileData(viewingUserProfileData);
            }

        } catch (statsError) {
             console.error(`Error fetching stats during real-time update for ${userId}:`, statsError);
             // Potentially display partial update or error indicator
        }

    }, (error) => {
        console.error(`Error in profile listener for UID ${userId}:`, error);
        showErrorState("Error listening for profile updates.");
        clearProfileListener();
    });
}
*/


// --- Central Function to Display Profile Data ---
function displayProfileData(data) {
    const { profile, stats, isBanned, banReason } = data;

    if (!profile && !isBanned) { // Handle case where profile is null and not banned (e.g., initial error or deleted)
         showErrorState("Profile data unavailable."); return;
    }
     if (!profile && isBanned) { // Handle case where profile missing BUT banned
         showBannedOnlyState(viewingProfileUid, banReason); return;
     }

     // --- Apply Banned Styling ---
     if (isBanned) {
         profileContainerDiv.classList.add('banned-profile');
         banStatusDisplayDiv.innerHTML = `<strong>BANNED</strong><span>Reason: ${escapeHtml(banReason)}</span>`;
         banStatusDisplayDiv.style.display = 'block';
     } else {
         profileContainerDiv.classList.remove('banned-profile');
         banStatusDisplayDiv.style.display = 'none';
     }

    // --- Render standard profile info ---
    const displayName = profile.displayName || 'Unnamed User';
    const avatarInitials = stats?.avatar || displayName.substring(0, 2).toUpperCase() || "??";
    usernameDisplayH2.textContent = displayName;
    profilePicDiv.textContent = avatarInitials;

    // Determine if viewing own profile
    const isOwnProfile = loggedInUser && loggedInUser.uid === profile.id;

    // Conditionally Display Email
    emailDisplayP.textContent = profile.email || 'Email not available';
    emailDisplayP.style.display = isOwnProfile ? 'block' : 'none';

    // Display Badges & Admin Tag
    displayUserBadges(profile);

    // Update Rank/Title & Interactivity
    updateProfileTitlesAndRank(profile, isOwnProfile);

    // Display Stats
    displayStats(stats);

    // Ensure correct UI state
    showProfileContent();
}

// --- Display Banned Only State ---
function showBannedOnlyState(userId, reason) {
     showProfileContent(); // Show the main content area
     profileContainerDiv.classList.add('banned-profile');
     banStatusDisplayDiv.innerHTML = `<strong>BANNED</strong><span>Reason: ${escapeHtml(reason)}</span>`;
     banStatusDisplayDiv.style.display = 'block';

     // Show placeholders/error messages for other data
     usernameDisplayH2.textContent = `User (Banned)`;
     profilePicDiv.textContent = 'X';
     adminTagSpan.style.display = 'none';
     profileBadgesContainerSpan.innerHTML = '';
     updateProfileTitlesAndRank(null, false); // Clear rank/title
     emailDisplayP.style.display = 'none';
     statsDisplayDiv.innerHTML = '<p><em>Profile data unavailable.</em></p>';
}


// --- Client-Side User Profile Document Creation ---
async function createUserProfileDocument(userId, authUser) {
    console.warn(`Attempting client-side creation of user profile doc for UID: ${userId}`);
    const userDocRef = db.collection(USERS_COLLECTION).doc(userId);
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;
    const defaultProfileData = {
        email: authUser.email || null, displayName: displayName, currentRank: "Unranked", equippedTitle: "",
        availableTitles: [], friends: [], createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        await userDocRef.set(defaultProfileData); // Use set directly, no merge needed for creation
        console.log(`Created user profile document for UID: ${userId}`);
        return { id: userId, ...defaultProfileData };
    } catch (error) {
        console.error(`Error creating user profile document for ${userId}:`, error);
        alert("Error setting up profile. Contact support."); return null;
    }
}

// --- Achievement Checking ---
async function checkAndApplyAchievements(userId) {
     if (!allAchievements) await fetchAllAchievements();
     if (!allAchievements || !viewingUserProfileData.profile || !viewingUserProfileData.stats) {
          console.log("Skipping achievement check: missing data."); return;
     }

     console.log(`Checking achievements for UID ${userId}`);
     try {
         const userAchievementsRef = db.collection(USER_ACHIEVEMENTS_COLLECTION).doc(userId);
         const userAchievementsDoc = await userAchievementsRef.get();
         const unlockedIds = userAchievementsDoc.exists ? (userAchievementsDoc.data()?.unlocked || []) : [];

         let newAchievementsUnlocked = [], rewardsToApply = { titles: [], rank: null, rankPoints: 0 }, needsDbUpdate = false;

         for (const achievementId in allAchievements) {
              if (unlockedIds.includes(achievementId)) continue;
              const achievement = allAchievements[achievementId]; let criteriaMet = false;
              if (achievement.criteria?.stat && viewingUserProfileData.stats[achievement.criteria.stat] !== undefined) {
                  const statValue = viewingUserProfileData.stats[achievement.criteria.stat];
                  switch (achievement.criteria.operator) {
                      case '>=': criteriaMet = statValue >= achievement.criteria.value; break;
                      case '<=': criteriaMet = statValue <= achievement.criteria.value; break;
                      case '==': criteriaMet = statValue == achievement.criteria.value; break; // Use == for potential type coercion if needed, else ===
                  }
              } // Add more criteria types (e.g., multiple stats, profile fields) if needed

              if (criteriaMet) {
                  console.log(`Criteria met for achievement: ${achievementId}`);
                  newAchievementsUnlocked.push(achievementId); needsDbUpdate = true;
                  if (achievement.rewards?.title) rewardsToApply.titles.push(achievement.rewards.title);
                  if (achievement.rewards?.rank) rewardsToApply.rank = achievement.rewards.rank; // Assuming only one rank reward overwrites
                  if (achievement.rewards?.rankPoints) rewardsToApply.rankPoints += achievement.rewards.rankPoints;
              }
         }

         if (needsDbUpdate && newAchievementsUnlocked.length > 0) {
             console.log("Applying new achievements:", newAchievementsUnlocked);
             const batch = db.batch();
             const userProfileRef = db.collection(USERS_COLLECTION).doc(userId);

             // Update unlocked achievements list
             batch.set(userAchievementsRef, { unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsUnlocked) }, { merge: true });

             // Prepare profile updates based on rewards
             const profileUpdateData = {};
             let profileNeedsUpdate = false;

             if (rewardsToApply.titles.length > 0) {
                 profileUpdateData.availableTitles = firebase.firestore.FieldValue.arrayUnion(...rewardsToApply.titles);
                 // Automatically equip the first new title if none is equipped
                 if (!viewingUserProfileData.profile.equippedTitle && rewardsToApply.titles[0]) {
                      profileUpdateData.equippedTitle = rewardsToApply.titles[0];
                 }
                 profileNeedsUpdate = true;
             }
             if (rewardsToApply.rank) {
                 profileUpdateData.currentRank = rewardsToApply.rank;
                 profileNeedsUpdate = true;
             }
             // Add rank points logic if applicable (needs to read current points first, more complex)

             if (profileNeedsUpdate) {
                 batch.update(userProfileRef, profileUpdateData);
             }

             await batch.commit();
             console.log(`Achievements and rewards applied for UID ${userId}. Reloading profile data locally.`);

             // Re-fetch data after applying changes to reflect immediately
             // Use a small delay to allow Firestore propagation if needed, though often not required for reads after writes
             // await new Promise(resolve => setTimeout(resolve, 100)); // Optional small delay
             await loadAndDisplayUserProfile(userId); // Reload the profile fully

         } else { console.log(`No new achievements to apply for UID ${userId}.`); }
     } catch (error) { console.error(`Error check/grant achievements for ${userId}:`, error); }
}

// --- Display Stats Grid ---
function displayStats(statsData) {
    if (!statsDisplayDiv) return;
    statsDisplayDiv.innerHTML = ''; // Clear previous
    if (!statsData || typeof statsData !== 'object') { statsDisplayDiv.innerHTML = '<p>Leaderboard stats unavailable.</p>'; return; }

    const statOrder = ['points', 'wins', 'losses', 'matches', 'kdRatio']; // Define preferred order
    let statsAdded = 0;

    statOrder.forEach(key => {
         let title = key.charAt(0).toUpperCase() + key.slice(1); // Basic title capitalization
         let value = statsData[key];
         if (value !== undefined && value !== null) {
              if (key === 'kdRatio') { title = 'K/D Ratio'; value = typeof value === 'number' ? value.toFixed(2) : value; }
              if (key === 'matches') title = 'Matches Played';
              statsDisplayDiv.appendChild(createStatItem(title, value));
              statsAdded++;
         }
    });

    // Add any other stats not in the preferred order
    for (const key in statsData) {
         if (!statOrder.includes(key) && key !== 'id' && key !== 'name' && key !== 'avatar' && statsData[key] !== undefined && statsData[key] !== null) {
               let title = key.charAt(0).toUpperCase() + key.slice(1);
               statsDisplayDiv.appendChild(createStatItem(title, statsData[key]));
               statsAdded++;
         }
    }


    if (statsAdded === 0) { statsDisplayDiv.innerHTML = '<p>No specific leaderboard stats found.</p>'; }
}

// --- Helper: Create a Single Stat Item Element ---
function createStatItem(title, value) {
    const itemDiv = document.createElement('div'); itemDiv.classList.add('stat-item');
    const titleH4 = document.createElement('h4'); titleH4.textContent = title;
    const valueP = document.createElement('p'); valueP.textContent = (value !== null && value !== undefined) ? value : '-';
    itemDiv.appendChild(titleH4); itemDiv.appendChild(valueP); return itemDiv;
}

// --- Helper: Update Profile Rank/Title Display ---
function updateProfileTitlesAndRank(profileData, allowInteraction) {
    if (!rankDisplaySpan || !titleDisplaySpan) return;
    titleDisplaySpan.classList.remove('selectable-title');
    titleDisplaySpan.onclick = null; // Remove previous listener simply

    if (profileData && typeof profileData === 'object') {
        const rank = profileData.currentRank || 'Unranked';
        const title = profileData.equippedTitle || '';
        const available = profileData.availableTitles || [];
        rankDisplaySpan.textContent = rank;
        rankDisplaySpan.className = `profile-rank-display rank-${rank.toLowerCase().replace(/\s+/g, '-')}`;
        if (title) {
            titleDisplaySpan.textContent = `"${title}"`; // Add quotes
            titleDisplaySpan.style.display = 'inline-block';
            if (allowInteraction && available.length > 0) {
                titleDisplaySpan.classList.add('selectable-title');
                titleDisplaySpan.onclick = handleTitleClick; // Attach listener
            }
        } else {
            titleDisplaySpan.textContent = '';
            titleDisplaySpan.style.display = 'none';
        }
    } else { // Clear display if no profile data
        rankDisplaySpan.textContent = '...';
        rankDisplaySpan.className = 'profile-rank-display rank-unranked';
        titleDisplaySpan.textContent = '';
        titleDisplaySpan.style.display = 'none';
    }
}

// --- Title Selection Logic ---
function handleTitleClick(event) {
    event.stopPropagation();
    if (isTitleSelectorOpen) { closeTitleSelector(); }
    else if (viewingUserProfileData.profile?.availableTitles?.length > 0) { openTitleSelector(); }
}

function openTitleSelector() {
    if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id || isTitleSelectorOpen) return;
    const availableTitles = viewingUserProfileData.profile.availableTitles;
    const currentEquippedTitle = viewingUserProfileData.profile.equippedTitle || '';
    if (!availableTitles || availableTitles.length === 0) return;

    if (!titleSelectorElement) {
        titleSelectorElement = document.createElement('div'); titleSelectorElement.className = 'title-selector';
        profileIdentifiersDiv.appendChild(titleSelectorElement); // Append to the identifiers container
    }
    titleSelectorElement.innerHTML = ''; // Clear previous options
    availableTitles.forEach(title => {
        const optionBtn = document.createElement('button'); optionBtn.className = 'title-option';
        optionBtn.dataset.title = title; optionBtn.type = 'button'; optionBtn.textContent = title;
        if (title === currentEquippedTitle) optionBtn.classList.add('currently-equipped');
        optionBtn.onclick = handleTitleOptionClick; // Attach click handler
        titleSelectorElement.appendChild(optionBtn);
    });
    titleSelectorElement.style.display = 'block'; isTitleSelectorOpen = true;
    // Use timeout to allow current click event to finish before attaching listener
    setTimeout(() => document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }), 0);
}

function closeTitleSelector() {
    if (!isTitleSelectorOpen || !titleSelectorElement) return;
    titleSelectorElement.style.display = 'none'; isTitleSelectorOpen = false;
    document.removeEventListener('click', handleClickOutsideTitleSelector, { capture: true });
}

function handleClickOutsideTitleSelector(event) {
    if (!isTitleSelectorOpen) return;
    // Check if click is inside the selector OR on the title itself
    if ((titleSelectorElement && titleSelectorElement.contains(event.target)) || (titleDisplaySpan && titleDisplaySpan.contains(event.target))) {
        // Re-attach listener because the 'once' option removes it
        setTimeout(() => document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }), 0);
        return;
    }
    closeTitleSelector();
}

async function handleTitleOptionClick(event) {
    event.stopPropagation(); // Prevent outside click handler
    const selectedTitle = event.currentTarget.dataset.title;
    const currentUserId = loggedInUser?.uid;
    if (!currentUserId || currentUserId !== viewingUserProfileData.profile?.id || !selectedTitle || selectedTitle === viewingUserProfileData.profile.equippedTitle) {
        closeTitleSelector(); return;
    }

    closeTitleSelector();
    const oldTitle = viewingUserProfileData.profile.equippedTitle; // Store old title for rollback
    titleDisplaySpan.textContent = "Updating..."; // Indicate change in progress
    titleDisplaySpan.classList.remove('selectable-title'); titleDisplaySpan.onclick = null;

    try {
        await db.collection(USERS_COLLECTION).doc(currentUserId).update({ equippedTitle: selectedTitle });
        console.log(`Title updated successfully to "${selectedTitle}" for UID ${currentUserId}`);
        // Update local state immediately for faster UI feedback
        if (viewingUserProfileData.profile) {
            viewingUserProfileData.profile.equippedTitle = selectedTitle;
        }
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true); // Re-render title section
    } catch (error) {
        console.error("Error updating equipped title:", error);
        alert("Failed to update title.");
        // Rollback UI if update failed
        if (viewingUserProfileData.profile) {
            viewingUserProfileData.profile.equippedTitle = oldTitle;
        }
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true);
    }
}

// --- Logout Button ---
profileLogoutBtn.addEventListener('click', () => {
    closeTitleSelector(); // Close dropdown if open
    clearProfileListener(); // Detach listener
    auth.signOut().then(() => {
        console.log('User signed out.');
        viewingUserProfileData = { profile: null, stats: null, isBanned: false, banReason: null }; // Clear local data
        // Auth listener will handle UI reset or redirection implicitly
    }).catch((error) => { console.error('Sign out error:', error); alert('Error signing out.'); });
});

// --- Initial log ---
console.log("Profile script initialized (Compat Version).");
// Initial load is now triggered by the onAuthStateChanged listener detecting a target UID.
