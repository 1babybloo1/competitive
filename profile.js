const firebaseConfig = {
    apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI",
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
const CLOUDINARY_CLOUD_NAME = "djttn4xvk"; // <-- REPLACE
const CLOUDINARY_UPLOAD_PRESET = "compmanage"; // <-- REPLACE

// --- URL Parameter Parsing & Logged-in User Check ---
const urlParams = new URLSearchParams(window.location.search);
const profileUidFromUrl = urlParams.get('uid');
let loggedInUser = auth.currentUser;

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
    moderator: { emails: ['jackdmbell@outlook.com', 'mod_team@sample.org'].map(e => e.toLowerCase()), className: 'badge-moderator', title: 'Moderator' }
};

// --- DOM Elements ---
const profileContent = document.getElementById('profile-content');
const loadingIndicator = document.getElementById('loading-profile');
const notLoggedInMsg = document.getElementById('not-logged-in');
// Profile Pic Elements
const profilePicDiv = document.getElementById('profile-pic');
const profileImage = document.getElementById('profile-image');
const profileInitials = document.getElementById('profile-initials'); // Span for initials/fallback
const editProfilePicIcon = document.getElementById('edit-profile-pic-icon');
const profilePicInput = document.getElementById('profile-pic-input');
// Other Profile Elements
const usernameDisplay = document.getElementById('profile-username');
const emailDisplay = document.getElementById('profile-email');
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
const friendsTabsContainer = document.querySelector('.friends-tabs'); // For tab switching


// --- Global/Scoped Variables ---
let allAchievements = null;
let viewingUserProfileData = {}; // Data of the profile being viewed
let viewerProfileData = null; // Data of the logged-in user (viewer), including their friends map
let miniProfileCache = {}; // Simple cache for friend display names/pfps { userId: { displayName, profilePictureUrl } }
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
        const apiUrl = `https://dev-usa-1.poxel.io/api/profile/stats/${encodeURIComponent(username)}`;
        const res = await fetch(apiUrl, {
            headers: { "Content-Type": "application/json" }
        });

        if (!res.ok) {
            let errorMsg = `HTTP error ${res.status}`;
            try {
                const errorData = await res.json();
                errorMsg = errorData.message || errorData.error || errorMsg;
            } catch (parseError) { /* Ignore */ }
            throw new Error(errorMsg);
        }

        const data = await res.json();
        console.log("Poxel.io API Stats Received:", data);

        if (typeof data !== 'object' || data === null) {
            throw new Error("Invalid data format received from Poxel.io API.");
        }
        if (data.error || data.status === 'error') {
            throw new Error(data.message || 'API returned an error status.');
        }
        return data;
    } catch (e) {
        console.error("Error fetching Poxel.io stats:", e.message || e);
        return null;
    }
}

// --- Fetch all achievement definitions ---
async function fetchAllAchievements() {
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
        return null;
    }
}

// --- Helper: Compare Leaderboard Stats ---
function areStatsDifferent(newStats, existingProfileStats) {
    const normNew = newStats || {};
    const normExisting = existingProfileStats || {};
    const statKeys = ['wins', 'points', 'kdRatio', 'matchesPlayed', 'matches', 'losses'];
    let different = false;
    for (const key of statKeys) {
        const newValue = normNew[key] ?? null;
        const existingValue = normExisting[key] ?? null;
        if (key === 'kdRatio' && typeof newValue === 'number' && typeof existingValue === 'number') {
            if (Math.abs(newValue - existingValue) > 0.001) { different = true; break; }
        } else if (newValue !== existingValue) {
            different = true; break;
        }
    }
    // Check if relevant keys themselves differ
    if (!different) {
        const newRelevantKeys = Object.keys(normNew).filter(k => statKeys.includes(k));
        const existingRelevantKeys = Object.keys(normExisting).filter(k => statKeys.includes(k));
        if (newRelevantKeys.length !== existingRelevantKeys.length) {
            different = true;
        } else {
            const newSet = new Set(newRelevantKeys);
            if (!existingRelevantKeys.every(key => newSet.has(key))) { different = true; }
        }
    }
    return different;
}

// --- Helper Function: Client-Side User Profile Document Creation ---
async function createUserProfileDocument(userId, authUser) {
    console.warn(`Client-side: Creating missing user profile doc for UID: ${userId}`);
    const userDocRef = db.collection("users").doc(userId);
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;
    const defaultProfileData = {
        email: authUser.email || null,
        displayName: displayName,
        currentRank: "Unranked",
        equippedTitle: "",
        availableTitles: [],
        friends: {}, // Initialize friends map
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        leaderboardStats: {},
        profilePictureUrl: authUser.photoURL || null
    };
    try {
        await userDocRef.set(defaultProfileData, { merge: true });
        console.log(`Successfully created/merged user profile document for UID: ${userId} via client`);
        return { id: userId, ...defaultProfileData };
    } catch (error) {
        console.error(`Error creating user profile document client-side for UID ${userId}:`, error);
        alert("Error setting up your profile details. Please check your connection or contact support.");
        return null;
    }
}

// --- Load Combined User Data (Profile + Stats + Poxel) ---
async function loadCombinedUserData(targetUserId) {
    console.log(`Loading combined user data for TARGET UID: ${targetUserId}`);
    isOwnProfile = loggedInUser && loggedInUser.uid === targetUserId;
    console.log("Is viewing own profile:", isOwnProfile);

    // Reset viewer data and cache on new load
    viewerProfileData = null;
    miniProfileCache = {}; // Clear cache on profile load

    // Clear previous content and show loading indicators
    displayPoxelStats(null, true);
    competitiveStatsDisplay.innerHTML = '<p>Loading competitive stats...</p>';
    updateProfileTitlesAndRank(null, false);
    clearFriendshipControls(); // Clear old friend buttons
    resetFriendsSection(); // Hide and reset friend lists

    const cacheLoaded = loadCombinedDataFromCache(targetUserId); // Tries to display cached data first

    // --- Fetch Viewer's Profile Data (if logged in and not viewing own profile) ---
    if (loggedInUser && !isOwnProfile) {
        try {
            const viewerSnap = await db.collection('users').doc(loggedInUser.uid).get();
            if (viewerSnap.exists) {
                viewerProfileData = { id: viewerSnap.id, ...viewerSnap.data() };
                 // Ensure viewer's friends map exists
                 if (!viewerProfileData.friends) viewerProfileData.friends = {};
                console.log("Fetched viewing user's profile data for friend status check.");
            } else {
                 console.warn("Logged in user's profile data not found, cannot determine friendship status accurately.");
                 // Attempt to create viewer profile if missing? Or handle gracefully?
                 // For now, proceed; status check will return 'none'.
                 viewerProfileData = { id: loggedInUser.uid, friends: {} }; // Assume empty map for checks
            }
        } catch (viewerError) {
            console.error("Error fetching viewing user's profile data:", viewerError);
            // Proceed, status check will return 'none'
        }
    }
    // --- End Fetch Viewer's Profile Data ---

    const userProfileRef = db.collection('users').doc(targetUserId);
    const leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId);

    try {
        // 1. Fetch Target User Profile Data
        let profileSnap = await userProfileRef.get();
        let profileData = null;

        if (!profileSnap || !profileSnap.exists) {
            console.warn(`User profile document does NOT exist for UID: ${targetUserId}`);
            if (isOwnProfile && loggedInUser) { // Only create if it's the logged-in user's own profile AND they are logged in
                profileData = await createUserProfileDocument(targetUserId, loggedInUser);
                if (!profileData) throw new Error(`Profile creation failed for own UID ${targetUserId}.`);
            } else {
                console.error(`Cannot find profile for user UID: ${targetUserId}`);
                displayProfileData(null, null, false); // Display not found state
                competitiveStatsDisplay.innerHTML = '<p>Profile not found.</p>';
                displayPoxelStats(null);
                clearFriendshipControls();
                resetFriendsSection();
                return;
            }
        } else {
            profileData = { id: profileSnap.id, ...profileSnap.data() };
            // Ensure essential fields exist for robustness
            if (profileData.leaderboardStats === undefined) profileData.leaderboardStats = {};
            if (profileData.profilePictureUrl === undefined) profileData.profilePictureUrl = null;
            if (profileData.friends === undefined) profileData.friends = {}; // IMPORTANT: Initialize friends map
        }

        // 2. Fetch Leaderboard Stats Data (Competitive)
        const statsSnap = await leaderboardStatsRef.get();
        const competitiveStatsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null;

        // 3. Sync Competitive Stats to Profile Document if needed
        if (profileData && competitiveStatsData) {
            if (areStatsDifferent(competitiveStatsData, profileData.leaderboardStats)) {
                console.log(`Competitive stats for UID ${targetUserId} differ. Updating 'users' doc.`);
                try {
                    const statsToSave = { ...competitiveStatsData };
                    delete statsToSave.id; // Don't save the id field itself inside the map
                    await userProfileRef.update({ leaderboardStats: statsToSave });
                    profileData.leaderboardStats = statsToSave; // Update local copy
                } catch (updateError) {
                    console.error(`Error updating competitive stats in 'users' doc for UID ${targetUserId}:`, updateError);
                }
            }
        }

        // 4. Update Global State for the viewed profile
        viewingUserProfileData = {
            profile: profileData,
            stats: competitiveStatsData
        };
        console.log("Final Profile Data being viewed:", viewingUserProfileData.profile);
        // (viewerProfileData was updated earlier if applicable)

        // 5. Display Core Profile & Competitive Stats, Cache
        displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats, isOwnProfile);
        saveCombinedDataToCache(targetUserId, viewingUserProfileData);

        // --- Display Friendship Controls or Friends Section ---
        if (loggedInUser) { // Only show friend UI elements if a user is logged in
            if (isOwnProfile) {
                displayFriendsSection(profileData); // Show friends section on own profile
            } else {
                // Determine status based on the *viewer's* data
                const status = determineFriendshipStatus(loggedInUser.uid, targetUserId);
                displayFriendshipControls(status, targetUserId); // Show relevant buttons on other's profile
            }
        }
        // --- End Display Friendship ---

        // 6. Fetch and Display Poxel.io Stats (asynchronously)
        if (profileData && profileData.displayName) {
            fetchPoxelStats(profileData.displayName)
                .then(poxelStatsData => displayPoxelStats(poxelStatsData))
                .catch(poxelError => {
                    console.error("Caught error during Poxel.io fetch chain:", poxelError);
                    displayPoxelStats(null); // Display error state
                });
        } else {
             console.warn("No displayName found, cannot fetch Poxel.io stats.");
             displayPoxelStats(null); // Display unavailable state
        }

        // 7. Check Achievements (if viewing own profile with stats)
        if (isOwnProfile && viewingUserProfileData.stats) {
            if (!allAchievements) await fetchAllAchievements();
            if (allAchievements) {
                const potentiallyUpdatedProfile = await checkAndGrantAchievements(
                    targetUserId,
                    viewingUserProfileData.profile, // Pass the current profile data
                    viewingUserProfileData.stats
                );
                if (potentiallyUpdatedProfile) {
                    // Profile was updated (e.g., new title added/equipped)
                    viewingUserProfileData.profile = potentiallyUpdatedProfile; // Update global state
                    displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats, isOwnProfile); // Re-render profile sections
                    saveCombinedDataToCache(targetUserId, viewingUserProfileData); // Update cache with new profile data
                    console.log("UI/Cache updated post-achievement grant.");
                    // If friend section is visible, potentially refresh it too if ranks/titles affect it somehow
                    if(isOwnProfile) displayFriendsSection(viewingUserProfileData.profile);
                }
            }
        }

    } catch (error) {
        console.error(`Error in loadCombinedUserData for TARGET UID ${targetUserId}:`, error);
        if (error.stack) console.error("DEBUG: Full error stack:", error.stack);
        if (!cacheLoaded) { // Only show full error if nothing loaded from cache
            profileContent.style.display = 'none';
            notLoggedInMsg.textContent = 'Error loading profile data. Please try again later.';
            notLoggedInMsg.style.display = 'flex';
            loadingIndicator.style.display = 'none';
            competitiveStatsDisplay.innerHTML = '<p>Error loading data.</p>';
            updateProfileTitlesAndRank(null, false);
            displayPoxelStats(null);
            updateProfileBackground(null); // Ensure background is cleared
            clearFriendshipControls();
            resetFriendsSection();
        } else {
            console.warn("Error fetching fresh data, displaying potentially stale cached view.");
            // Optionally try fetching Poxel stats even if main load failed, using cached name
            if (viewingUserProfileData.profile?.displayName) {
                 fetchPoxelStats(viewingUserProfileData.profile.displayName)
                    .then(poxelStatsData => displayPoxelStats(poxelStatsData))
                    .catch(e => displayPoxelStats(null));
            } else {
                 displayPoxelStats(null);
            }
            // Friend controls might be wrong if based on stale cache - potentially clear them
            // clearFriendshipControls();
             // resetFriendsSection(); // Or keep stale friend section?
        }
    }
}


// --- Display Core Profile Data ---
function displayProfileData(profileData, competitiveStatsData, isOwner) {
    if (!profileData) {
        // Reset state for "User Not Found" or error
        profileImage.style.display = 'none';
        profileImage.src = '';
        profileInitials.style.display = 'flex';
        profileInitials.textContent = "?";
        editProfilePicIcon.style.display = 'none';
        updateProfileBackground(null);

        usernameDisplay.textContent = "User Not Found";
        emailDisplay.textContent = "";
        adminTag.style.display = 'none';
        profileBadgesContainer.innerHTML = '';
        updateProfileTitlesAndRank(null, false);
        displayCompetitiveStats(null);
        // Note: Friend section/controls cleared in loadCombinedUserData start/error
        return;
    }

    const displayName = profileData.displayName || 'Anonymous User';
    const email = profileData.email || 'No email provided';
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
            profileInitials.textContent = displayName.charAt(0).toUpperCase() || '?';
            profileInitials.style.display = 'flex';
            updateProfileBackground(null); // Clear background on error
        };
        updateProfileBackground(profileData.profilePictureUrl); // Set background
    } else {
        profileImage.style.display = 'none';
        profileImage.src = '';
        profileInitials.textContent = displayName.charAt(0).toUpperCase() || '?';
        profileInitials.style.display = 'flex';
        updateProfileBackground(null); // No background
    }

    // Show edit icon only if it's the owner's profile
    editProfilePicIcon.style.display = isOwner ? 'flex' : 'none';

    // Display other elements
    displayUserBadges(profileData);
    updateProfileTitlesAndRank(profileData, isOwner); // Pass owner status for interaction
    displayCompetitiveStats(competitiveStatsData); // Pass competitive stats
}

// --- Update Profile Background ---
function updateProfileBackground(imageUrl) {
    // Use the main profile container 'profile-content'
    const container = profileContent; // Use the existing reference
    if (!container) return;

    if (imageUrl) {
        container.style.setProperty('--profile-bg-image', `url('${imageUrl}')`);
        container.classList.add('has-background');
    } else {
        container.style.removeProperty('--profile-bg-image');
        container.classList.remove('has-background');
    }
}

// --- Display COMPETITIVE Stats Grid ---
function displayCompetitiveStats(statsData) {
    competitiveStatsDisplay.innerHTML = ''; // Clear previous

    if (!statsData || typeof statsData !== 'object' || Object.keys(statsData).length === 0) {
        competitiveStatsDisplay.innerHTML = '<p>Competitive stats unavailable for this user.</p>';
        return;
    }

    const statsMap = { wins: 'Wins', points: 'Points', kdRatio: 'K/D Ratio', matchesPlayed: 'Matches Played', matches: 'Matches Played', losses: 'Losses' };
    let statsAdded = 0;
    const addedKeys = new Set(); // To handle alias 'matchesPlayed'/'matches'
    for (const key in statsMap) {
        let value;
        let actualKeyUsed = key;
        // Handle alias logic
        if (key === 'matchesPlayed') {
            if (statsData.hasOwnProperty('matchesPlayed') && !addedKeys.has('matchesPlayed')) {
                 value = statsData.matchesPlayed;
                 actualKeyUsed = 'matchesPlayed';
            } else if (statsData.hasOwnProperty('matches') && !addedKeys.has('matches')) {
                 value = statsData.matches;
                 actualKeyUsed = 'matches';
            }
        } else {
             value = statsData[key];
        }


        // Skip if value is undefined/null or if the key (or its alias) was already added
        if (value === undefined || value === null || addedKeys.has(actualKeyUsed)) {
             continue;
        }


        let displayValue = value;
        if (key === 'kdRatio' && typeof value === 'number') { displayValue = value.toFixed(2); }

        competitiveStatsDisplay.appendChild(createStatItem(statsMap[key], displayValue));
        addedKeys.add(actualKeyUsed); // Mark this key (or the alias used) as added
        statsAdded++;
    }

    if (statsAdded === 0) {
        competitiveStatsDisplay.innerHTML = '<p>No specific competitive stats found.</p>';
    }
}


// --- Display Poxel.io Stats Grid ---
function displayPoxelStats(poxelData, loading = false) {
    if (!poxelStatsDisplay || !poxelStatsSection) return;

    poxelStatsDisplay.innerHTML = ''; // Clear previous content
    poxelStatsSection.style.display = 'block'; // Always show the section container

    if (loading) {
        poxelStatsDisplay.innerHTML = '<p>Loading Poxel.io stats...</p>';
        return;
    }

    if (!poxelData) {
         poxelStatsDisplay.innerHTML = '<p>Could not load Poxel.io stats for this user.</p>';
         return;
    }

    // Adjust keys based on actual API response from fetchPoxelStats console log
    const statsMap = {
         kills: 'Kills', deaths: 'Deaths', wins: 'Wins', losses: 'Losses',
         level: 'Level', playtimeHours: 'Playtime (Hours)', gamesPlayed: 'Games Played'
         // Add/remove fields as necessary based on API response
    };
    let statsAdded = 0;

    // Display mapped stats
    for (const key in statsMap) {
         if (poxelData.hasOwnProperty(key) && poxelData[key] !== null && poxelData[key] !== undefined) {
             poxelStatsDisplay.appendChild(createStatItem(statsMap[key], poxelData[key]));
             statsAdded++;
         }
    }

    // Calculate and add K/D specifically
    if (poxelData.hasOwnProperty('kills') && poxelData.hasOwnProperty('deaths')) {
         const kills = Number(poxelData.kills) || 0;
         const deaths = Number(poxelData.deaths) || 0;
         const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2); // Handle division by zero
         poxelStatsDisplay.appendChild(createStatItem('K/D Ratio', kd));
         statsAdded++;
    }

    // Add any other direct fields from poxelData you want to display
    // Example: if API returns 'elo_rating' directly
    // if (poxelData.hasOwnProperty('elo_rating')) {
    //     poxelStatsDisplay.appendChild(createStatItem('ELO Rating', poxelData.elo_rating));
    //     statsAdded++;
    // }

    if (statsAdded === 0) {
        poxelStatsDisplay.innerHTML = '<p>No relevant Poxel.io stats found or available.</p>';
    }
}

// --- Helper: Create a Single Stat Item Element ---
function createStatItem(title, value) {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('stat-item');
    const titleH4 = document.createElement('h4');
    titleH4.textContent = title;
    const valueP = document.createElement('p');
    valueP.textContent = (value !== null && value !== undefined) ? value : '-';
    itemDiv.appendChild(titleH4);
    itemDiv.appendChild(valueP);
    return itemDiv;
}

// --- Check and Grant Achievements ---
async function checkAndGrantAchievements(userId, currentUserProfile, competitiveStats) {
    if (!allAchievements || !userId || !currentUserProfile || !competitiveStats) {
        console.log("Skipping achievement check due to missing data.");
        return null; // Indicate no profile update occurred
    }
    console.log(`Checking achievements for UID ${userId} using stats:`, competitiveStats);
    try {
        const userAchievementsRef = db.collection('userAchievements').doc(userId);
        const userAchievementsDoc = await userAchievementsRef.get();
        const unlockedIds = userAchievementsDoc.exists ? (userAchievementsDoc.data()?.unlocked || []) : [];

        let newAchievementsUnlocked = [];
        let rewardsToApply = { titles: [], rank: null };
        let needsDbUpdate = false;
        let updatedLocalProfile = { ...currentUserProfile }; // Create a mutable copy to track potential changes

        // Ensure fields exist in the local profile copy before processing
        if (!updatedLocalProfile.availableTitles) updatedLocalProfile.availableTitles = [];
        if (updatedLocalProfile.equippedTitle === undefined) updatedLocalProfile.equippedTitle = "";
        if (updatedLocalProfile.currentRank === undefined) updatedLocalProfile.currentRank = "Unranked";


        for (const achievementId in allAchievements) {
            if (unlockedIds.includes(achievementId)) continue; // Skip already unlocked

            const achievement = allAchievements[achievementId];
            let criteriaMet = false;

            // Example Criteria Check (adapt based on your achievement structure)
            if (achievement.criteria?.stat && competitiveStats[achievement.criteria.stat] !== undefined) {
                const statValue = competitiveStats[achievement.criteria.stat];
                const targetValue = achievement.criteria.value;
                switch (achievement.criteria.operator) {
                    case '>=': criteriaMet = statValue >= targetValue; break;
                    case '==': criteriaMet = statValue == targetValue; break; // Use == for flexible type comparison if needed, === for strict
                    // Add more operators as needed
                    default: console.warn(`Unsupported achievement operator: ${achievement.criteria.operator} for ${achievementId}`);
                }
            } // Add more criteria types here (e.g., based on profile fields, multiple stats)

            if (criteriaMet) {
                console.log(`Criteria MET for achievement: ${achievement.name || achievementId}`);
                newAchievementsUnlocked.push(achievementId);
                needsDbUpdate = true;

                // Accumulate rewards and update the LOCAL profile copy
                if (achievement.rewards?.title && !updatedLocalProfile.availableTitles.includes(achievement.rewards.title)) {
                    rewardsToApply.titles.push(achievement.rewards.title);
                    updatedLocalProfile.availableTitles.push(achievement.rewards.title); // Update local copy
                    // Auto-equip first new title if none is equipped
                    if (!updatedLocalProfile.equippedTitle) {
                         updatedLocalProfile.equippedTitle = achievement.rewards.title;
                    }
                }
                if (achievement.rewards?.rank) { // Consider logic for choosing the "best" rank if multiple apply
                     rewardsToApply.rank = achievement.rewards.rank; // For now, last one met wins
                     updatedLocalProfile.currentRank = achievement.rewards.rank; // Update local copy
                }
            }
        }

        if (needsDbUpdate && newAchievementsUnlocked.length > 0) {
            console.log(`Unlocking ${newAchievementsUnlocked.length} new achievement(s):`, newAchievementsUnlocked);
            console.log("Applying rewards (titles, rank):", rewardsToApply.titles, rewardsToApply.rank);

            const batch = db.batch();
            const userProfileRef = db.collection('users').doc(userId);

            // Update unlocked achievements list
            batch.set(userAchievementsRef, { unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsUnlocked) }, { merge: true });

            // Prepare profile updates based on the *final* state of updatedLocalProfile
            const profileUpdateData = {};
            if (rewardsToApply.titles.length > 0) {
                 profileUpdateData.availableTitles = firebase.firestore.FieldValue.arrayUnion(...rewardsToApply.titles);
                 // Check if equipped title needs update (because it was empty before)
                 if(currentUserProfile.equippedTitle === "" && updatedLocalProfile.equippedTitle !== "") {
                    profileUpdateData.equippedTitle = updatedLocalProfile.equippedTitle;
                 }
            }
            if (rewardsToApply.rank) { // Apply rank update if one was determined
                 profileUpdateData.currentRank = updatedLocalProfile.currentRank;
            }

            if (Object.keys(profileUpdateData).length > 0) {
                batch.update(userProfileRef, profileUpdateData);
            }

            await batch.commit();
            console.log(`Achievement Firestore batch committed successfully for UID ${userId}.`);
            return updatedLocalProfile; // Return the locally updated profile object reflecting all changes

        } else {
            console.log(`No new achievements unlocked for UID ${userId}.`);
            return null; // No changes made to the profile
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
    profileBadgesContainer.innerHTML = ''; // Clear previous badges
    const userEmail = profileData?.email;
    if (!userEmail) {
        adminTag.style.display = 'none';
        return;
    }
    const emailLower = userEmail.toLowerCase();

    // Display Admin Tag
    adminTag.style.display = adminEmails.includes(emailLower) ? 'inline-block' : 'none';

    // Display Configured Badges
    for (const badgeType in badgeConfig) {
        const config = badgeConfig[badgeType];
        if (config.emails.includes(emailLower)) {
            const badgeSpan = document.createElement('span');
            badgeSpan.classList.add('profile-badge', config.className);
            badgeSpan.setAttribute('title', config.title);
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
        const title = profileData.equippedTitle || '';
        const available = profileData.availableTitles || [];

        // Update Rank Display
        rankDisplay.textContent = rank;
        rankDisplay.className = `profile-rank-display rank-${rank.toLowerCase().replace(/\s+/g, '-')}`;

        // Update Title Display and Interaction
        if (title) { // Has an equipped title
            titleDisplay.textContent = title;
            titleDisplay.style.display = 'inline-block';
            if (allowInteraction && available.length > 0) {
                titleDisplay.classList.add('selectable-title');
                titleDisplay.addEventListener('click', handleTitleClick);
            }
        } else { // No equipped title
            if (allowInteraction && available.length > 0) { // Has available titles to choose from
                titleDisplay.textContent = '[Choose Title]';
                titleDisplay.style.display = 'inline-block';
                titleDisplay.classList.add('selectable-title', 'no-title-placeholder');
                titleDisplay.addEventListener('click', handleTitleClick);
            } else { // No titles available or no interaction allowed
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
    if (!isOwnProfile || !viewingUserProfileData.profile) return; // Only allow on own profile

    if (isTitleSelectorOpen) {
        closeTitleSelector();
    } else if (viewingUserProfileData.profile?.availableTitles?.length > 0) {
        openTitleSelector();
    } else {
        console.log("No available titles to select.");
    }
}

function openTitleSelector() {
    if (isTitleSelectorOpen || !profileIdentifiersDiv || !viewingUserProfileData.profile?.availableTitles?.length > 0) return;

    const availableTitles = viewingUserProfileData.profile.availableTitles;
    const currentEquippedTitle = viewingUserProfileData.profile.equippedTitle || '';

    if (!titleSelectorElement) { // Create selector div if it doesn't exist
        titleSelectorElement = document.createElement('div');
        titleSelectorElement.className = 'title-selector';
        profileIdentifiersDiv.appendChild(titleSelectorElement);
    }
    titleSelectorElement.innerHTML = ''; // Clear previous options

    // Add "Remove Title" option if a title is currently equipped
    if (currentEquippedTitle) {
        const unequipOption = document.createElement('button');
        unequipOption.className = 'title-option title-option-unequip';
        unequipOption.dataset.title = ""; // Use empty string for unequip
        unequipOption.type = 'button';
        unequipOption.textContent = '[Remove Title]';
        unequipOption.addEventListener('click', handleTitleOptionClick);
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
            optionElement.setAttribute('aria-pressed', 'true');
        } else {
            optionElement.setAttribute('aria-pressed', 'false');
        }
        optionElement.addEventListener('click', handleTitleOptionClick);
        titleSelectorElement.appendChild(optionElement);
    });

    titleSelectorElement.style.display = 'block';
    isTitleSelectorOpen = true;

    // Add listener to close when clicking outside
    setTimeout(() => { // Use timeout to prevent immediate closing due to event propagation
        document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true });
    }, 0);
}

function closeTitleSelector() {
    if (!isTitleSelectorOpen || !titleSelectorElement) return;
    titleSelectorElement.style.display = 'none';
    isTitleSelectorOpen = false;
    // Clean up the outside click listener if it hasn't fired yet
    document.removeEventListener('click', handleClickOutsideTitleSelector, { capture: true });
}

function handleClickOutsideTitleSelector(event) {
    // This listener is added with { once: true }, so it auto-removes after firing.
    if (!isTitleSelectorOpen) return; // Should not happen with 'once', but good practice

    // Check if the click was inside the selector or on the title display itself
    const clickedInsideSelector = titleSelectorElement && titleSelectorElement.contains(event.target);
    const clickedOnTitleDisplay = titleDisplay && titleDisplay.contains(event.target);

    // If clicked outside both, close the selector
    if (!clickedInsideSelector && !clickedOnTitleDisplay) {
        closeTitleSelector();
    } else {
        // If click was inside, re-attach the listener for the *next* outside click
        // This handles cases where user clicks within the dropdown (e.g., scrollbar)
         document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true });
    }
}

async function handleTitleOptionClick(event) {
    event.stopPropagation(); // Prevent outside click listener
    const selectedTitle = event.currentTarget.dataset.title; // Can be "" for unequip
    const currentUserId = loggedInUser?.uid;
    const currentlyViewedProfile = viewingUserProfileData.profile;

    if (!currentUserId || !currentlyViewedProfile || currentUserId !== currentlyViewedProfile.id) {
        console.error("Attempted to change title for wrong user or not logged in.");
        closeTitleSelector();
        return;
    }

    const currentEquipped = currentlyViewedProfile.equippedTitle || '';

    // Don't do anything if clicking the already equipped title
    if (selectedTitle === currentEquipped) {
        closeTitleSelector();
        return;
    }

    closeTitleSelector(); // Close immediately

    // Optimistic UI update (or show "Updating...")
    titleDisplay.textContent = "Updating...";
    titleDisplay.classList.remove('selectable-title', 'no-title-placeholder');
    titleDisplay.removeEventListener('click', handleTitleClick); // Prevent clicking while updating


    try {
        const userProfileRef = db.collection('users').doc(currentUserId);
        await userProfileRef.update({ equippedTitle: selectedTitle }); // Update Firestore

        console.log(`Firestore 'users' doc updated title to "${selectedTitle || 'None'}" for UID ${currentUserId}`);

        // Update local state and cache
        viewingUserProfileData.profile.equippedTitle = selectedTitle;
        saveCombinedDataToCache(currentUserId, viewingUserProfileData);

        // Re-render the title/rank section with interaction enabled
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true);

    } catch (error) {
        console.error("Error updating equipped title in Firestore 'users':", error);
        alert("Failed to update title. Please try again.");
        // Revert optimistic UI update on error
        if (viewingUserProfileData.profile) {
            // Restore previous state before re-rendering
             viewingUserProfileData.profile.equippedTitle = currentEquipped;
        }
        // Re-render with previous state and interaction
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true);
    }
}


// =============================================================================
// --- Profile Picture Editing Functions ---
// =============================================================================

// --- Initialize Edit Listeners (Call this when owner status is confirmed) ---
function setupProfilePicEditing() {
    // Ensure we are targeting the correct, potentially cloned, elements
    const currentEditIcon = document.getElementById('edit-profile-pic-icon');
    const currentFileInput = document.getElementById('profile-pic-input');

    if (!isOwnProfile || !currentEditIcon || !currentFileInput) return; // Guard clause

    console.log("Setting up profile pic editing listeners.");
    currentEditIcon.style.display = 'flex'; // Ensure it's visible

    // Re-attach listeners to ensure they are on the current DOM nodes
    currentEditIcon.onclick = () => {
         // Ensure the current file input is targeted
        document.getElementById('profile-pic-input').click();
    };

    currentFileInput.onchange = (event) => {
        handleFileSelect(event);
    };
}

// --- Handle File Selection ---
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        alert('Please select a valid image file (PNG, JPG, GIF).');
        event.target.value = null; // Reset input
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        modalImage.src = e.target.result;
        openEditModal(); // Open modal AFTER image source is set
    };
    reader.onerror = (err) => {
        console.error("FileReader error:", err);
        alert("Error reading the selected file.");
    };
    reader.readAsDataURL(file);
    event.target.value = null; // Reset input to allow selecting the same file again
}

// --- Open Image Editing Modal ---
function openEditModal() {
    if (!editModal || !modalImage) return;
    editModal.style.display = 'flex';
    modalImage.style.opacity = 0; // Hide image initially

    // Ensure button state is reset initially
     modalApplyBtn.disabled = false;
     modalSpinner.style.display = 'none';
     const applyTextNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
     if (applyTextNode) applyTextNode.textContent = 'Apply ';


    // Use setTimeout to allow the browser to render the modal & image dimensions
    setTimeout(() => {
        if (cropper) { // Destroy previous instance if exists
            try { cropper.destroy(); } catch(e) { console.warn("Minor error destroying previous cropper", e)}
            cropper = null;
        }
        try {
             cropper = new Cropper(modalImage, {
                aspectRatio: 1 / 1,       // Force square aspect ratio
                viewMode: 1,              // Restrict crop box to canvas bounds
                dragMode: 'move',         // Default drag mode
                background: false,        // Transparent background for cropper container
                autoCropArea: 0.85,       // Initial crop area size relative to image
                responsive: true,         // Recalculate on window resize
                modal: true,              // Dark overlay behind image
                guides: true,             // Crop area guides
                center: true,             // Center indicator
                highlight: false,         // Don't highlight crop area
                cropBoxMovable: true,    // Allow moving cropbox
                cropBoxResizable: true,   // Allow resizing cropbox
                toggleDragModeOnDblclick: false, // Disable this behavior
                ready: () => {
                     modalImage.style.opacity = 1; // Show image once Cropper is ready
                     console.log("Cropper is ready.");
                }
            });
        } catch (cropperError) {
            console.error("Error initializing Cropper:", cropperError);
            alert("Could not initialize image editor. Please try reloading.");
            closeEditModal(); // Close if initialization failed
        }
    }, 150); // Adjust delay if needed

    // Attach listeners to the *current* modal buttons
    modalCloseBtn.onclick = closeEditModal;
    modalCancelBtn.onclick = closeEditModal;
    modalApplyBtn.onclick = handleApplyCrop; // Assign the handler directly

    // Close modal if clicking outside the content area
    editModal.onclick = (event) => {
        if (event.target === editModal) { // Check if click was on the overlay itself
            closeEditModal();
        }
    };
}


// --- Close Image Editing Modal ---
function closeEditModal() {
    if (!editModal) return;
    if (cropper) {
        try {
            cropper.destroy();
        } catch (e) { console.warn("Error destroying cropper:", e); }
        cropper = null;
    }
    editModal.style.display = 'none';
    modalImage.src = ''; // Clear image source to free memory

    // Reset button state
    modalApplyBtn.disabled = false;
    modalSpinner.style.display = 'none';
    // Find the text node and restore it if needed (safer than innerHTML)
    const textNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.textContent = 'Apply '; // Restore original text


    // Remove specific listeners to prevent memory leaks
    modalCloseBtn.onclick = null;
    modalCancelBtn.onclick = null;
    modalApplyBtn.onclick = null;
    editModal.onclick = null;
}

// --- Handle Apply Crop and Upload ---
async function handleApplyCrop() {
    if (!cropper || !loggedInUser) {
        console.error("Cropper not initialized or user not logged in.");
        alert("Cannot apply crop. Please try again or re-login.");
        return;
    }

    // Show loading state
    modalApplyBtn.disabled = true;
    modalSpinner.style.display = 'inline-block';
    // Modify text content carefully
     const textNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
     if (textNode) textNode.textContent = 'Applying ';


    try {
        // Get cropped canvas data as a Blob for efficient upload
        const canvas = cropper.getCroppedCanvas({
            width: 512, // Standardized output width
            height: 512, // Standardized output height
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });

        canvas.toBlob(async (blob) => {
            if (!blob) {
                throw new Error("Failed to create blob from canvas. Image might be too complex or browser issue.");
            }

            console.log("Blob created, size:", (blob.size / 1024).toFixed(2), "KB");

            try {
                // Upload to Cloudinary
                const imageUrl = await uploadToCloudinary(blob);
                console.log("Uploaded to Cloudinary:", imageUrl);

                // Save URL to Firestore
                await saveProfilePictureUrl(loggedInUser.uid, imageUrl);
                console.log("Saved URL to Firestore.");

                // Update UI immediately
                profileImage.src = imageUrl; // Update displayed image
                profileImage.style.display = 'block';
                profileInitials.style.display = 'none';
                updateProfileBackground(imageUrl); // Update background

                // Update local cache
                if (viewingUserProfileData && viewingUserProfileData.profile && viewingUserProfileData.profile.id === loggedInUser.uid) {
                    viewingUserProfileData.profile.profilePictureUrl = imageUrl;
                    saveCombinedDataToCache(loggedInUser.uid, viewingUserProfileData);
                }

                closeEditModal(); // Close modal on complete success

            } catch (uploadOrSaveError) {
                console.error("Upload or Save Error:", uploadOrSaveError);
                alert(`Failed to update profile picture: ${uploadOrSaveError.message || 'Unknown error during upload/save.'}`);
                // Reset button state on error within blob callback
                modalApplyBtn.disabled = false;
                modalSpinner.style.display = 'none';
                if (textNode) textNode.textContent = 'Apply ';
            }

        }, 'image/jpeg', 0.9); // Specify format (jpeg is good for photos) and quality (0.9 is high)

    } catch (cropError) {
        console.error("Cropping error:", cropError);
        alert("Failed to crop the image. Please try again or use a different image.");
        // Reset button state on cropping error
        modalApplyBtn.disabled = false;
        modalSpinner.style.display = 'none';
         if (textNode) textNode.textContent = 'Apply ';
    }
}

// --- Upload Blob to Cloudinary (using Fetch API for unsigned uploads) ---
async function uploadToCloudinary(blob) {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
         throw new Error("Cloudinary configuration missing (cloud name or upload preset). Cannot upload.");
    }
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    const formData = new FormData();
    formData.append('file', blob, `profile_${loggedInUser?.uid || 'unknown'}_${Date.now()}.jpg`); // Provide a filename
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    // Optional: Add context, tags, folder etc. based on preset config or here
    // formData.append('folder', 'user_profiles');
    // formData.append('tags', 'profile_picture, poxelcomp');

    console.log(`Uploading to Cloudinary preset: ${CLOUDINARY_UPLOAD_PRESET}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            console.error("Cloudinary Upload Error Response:", data);
            throw new Error(data.error?.message || `Cloudinary upload failed with status ${response.status}.`);
        }

        console.log("Cloudinary Upload Success Response:", data);
        if (!data.secure_url) {
            throw new Error("Cloudinary response missing 'secure_url'.");
        }
        return data.secure_url; // Return the secure URL

    } catch (networkError) {
        console.error("Network error during Cloudinary upload:", networkError);
        throw new Error(`Network error during upload: ${networkError.message}`);
    }
}

// --- Save Profile Picture URL to Firestore ---
async function saveProfilePictureUrl(userId, imageUrl) {
    if (!userId || typeof imageUrl !== 'string' || !imageUrl.startsWith('https://')) {
        throw new Error("Invalid userId or imageUrl provided for saving.");
    }
    const userDocRef = db.collection("users").doc(userId);
    try {
        await userDocRef.update({
            profilePictureUrl: imageUrl
        });
        console.log(`Successfully updated profilePictureUrl for user ${userId}`);
    } catch (error) {
        console.error(`Error updating Firestore profile picture URL for ${userId}:`, error);
        throw new Error("Database error: Failed to save profile picture link.");
    }
}


// =============================================================================
// --- Friend System Functions ---
// =============================================================================

// --- Helper: Fetch Minimal User Profile for Lists ---
async function fetchUserMiniProfile(userId) {
    if (miniProfileCache[userId]) {
        // console.log(`Using cached mini profile for ${userId}`);
        return miniProfileCache[userId];
    }
    // console.log(`Fetching mini profile for ${userId}`);
    try {
        const userSnap = await db.collection('users').doc(userId).get();
        if (userSnap.exists) {
            const data = userSnap.data();
            const miniProfile = {
                id: userId, // Include id for linking
                displayName: data.displayName || `User_${userId.substring(0, 5)}`,
                profilePictureUrl: data.profilePictureUrl || null,
            };
            miniProfileCache[userId] = miniProfile; // Cache the result
            return miniProfile;
        } else {
            console.warn(`Mini profile not found for user ${userId}`);
            // Return a fallback but don't cache it as 'not found' can be temporary
            return { id: userId, displayName: "Unknown User", profilePictureUrl: null };
        }
    } catch (error) {
        console.error(`Error fetching mini profile for ${userId}:`, error);
         // Return error state, don't cache
        return { id: userId, displayName: "Error Loading", profilePictureUrl: null };
    }
}


// --- Determine Friendship Status between Viewer and Profile Owner ---
function determineFriendshipStatus(viewerUid, profileOwnerUid) {
    // Status is determined from the *viewer's* perspective (their entry for the profile owner)
    if (!viewerProfileData || !viewerProfileData.friends || !viewerUid || !profileOwnerUid || viewerUid === profileOwnerUid) {
        return 'none'; // Not logged in, viewer data missing, or viewing own profile
    }
    return viewerProfileData.friends[profileOwnerUid] || 'none'; // Returns 'friend', 'incoming', 'outgoing', or 'none'
}

// --- Clear Friendship Control Buttons ---
function clearFriendshipControls() {
    if (friendshipControlsContainer) {
        friendshipControlsContainer.innerHTML = '';
    }
}

// --- Reset and Hide Friends Section ---
function resetFriendsSection() {
    if (friendsSection) friendsSection.style.display = 'none';
    if (friendsListUl) friendsListUl.innerHTML = '<li class="list-message">Loading friends...</li>';
    if (incomingListUl) incomingListUl.innerHTML = '<li class="list-message">Loading incoming requests...</li>';
    if (outgoingListUl) outgoingListUl.innerHTML = '<li class="list-message">Loading outgoing requests...</li>';
    if (incomingCountSpan) incomingCountSpan.textContent = '0';
    if (outgoingCountSpan) outgoingCountSpan.textContent = '0';
    // Reset tabs to default
    const buttons = friendsTabsContainer?.querySelectorAll('.tab-button');
    const contents = friendsSection?.querySelectorAll('.tab-content');
    buttons?.forEach((btn, index) => {
        btn.classList.toggle('active', index === 0); // First tab active
    });
    contents?.forEach((content, index) => {
         content.classList.toggle('active', index === 0); // First content active
    });
}


// --- Display Friendship Control Buttons (Add, Cancel, Accept/Decline, Remove) ---
function displayFriendshipControls(status, profileOwnerUid) {
    clearFriendshipControls(); // Clear previous buttons
    if (!loggedInUser || isOwnProfile || !friendshipControlsContainer) return; // Don't show on own profile or if not logged in

    let button = null;
    let button2 = null; // For Accept/Decline pair

    switch (status) {
        case 'none':
            button = document.createElement('button');
            button.textContent = 'Add Friend';
            button.className = 'btn btn-primary'; // Use existing button styles
            button.onclick = (e) => handleFriendAction(e.target, 'sendRequest', profileOwnerUid);
            break;
        case 'outgoing':
            button = document.createElement('button');
            button.textContent = 'Cancel Request';
            button.className = 'btn btn-secondary btn-cancel'; // Style as secondary/cancel
             button.onclick = (e) => handleFriendAction(e.target, 'cancelRequest', profileOwnerUid);
            break;
        case 'incoming':
            button = document.createElement('button');
            button.textContent = 'Accept';
            button.className = 'btn btn-primary btn-accept btn-small'; // Smaller accept button
            button.onclick = (e) => handleFriendAction(e.target, 'acceptRequest', profileOwnerUid);

            button2 = document.createElement('button');
            button2.textContent = 'Decline';
            button2.className = 'btn btn-secondary btn-decline btn-small'; // Smaller decline button
            button2.onclick = (e) => handleFriendAction(e.target, 'declineRequest', profileOwnerUid);
            break;
        case 'friend':
            button = document.createElement('button');
            button.textContent = 'Remove Friend';
            button.className = 'btn btn-secondary btn-remove'; // Style as secondary/remove
            button.onclick = (e) => handleFriendAction(e.target, 'removeFriend', profileOwnerUid);
            break;
    }

    if (button) friendshipControlsContainer.appendChild(button);
    if (button2) friendshipControlsContainer.appendChild(button2); // Add second button if exists
}

// --- Display the Entire Friends Section (for Own Profile) ---
async function displayFriendsSection(profileData) {
    if (!isOwnProfile || !friendsSection || !profileData || !profileData.friends) {
         resetFriendsSection(); // Hide if not applicable
        return;
    }

    console.log("Displaying friends section for own profile");
    friendsSection.style.display = 'block'; // Show the section

    const friendsMap = profileData.friends || {};
    const friendIds = [];
    const incomingIds = [];
    const outgoingIds = [];

    // Categorize users based on status in *own* profile data
    for (const userId in friendsMap) {
        switch (friendsMap[userId]) {
            case 'friend': friendIds.push(userId); break;
            case 'incoming': incomingIds.push(userId); break; // They sent request TO ME
            case 'outgoing': outgoingIds.push(userId); break; // I sent request TO THEM
        }
    }

    // Update counts displayed in tabs
    incomingCountSpan.textContent = incomingIds.length;
    outgoingCountSpan.textContent = outgoingIds.length;

    // Populate lists (fetch mini profiles as needed)
    populateFriendList(friendsListUl, friendIds, 'friend');
    populateFriendList(incomingListUl, incomingIds, 'incoming');
    populateFriendList(outgoingListUl, outgoingIds, 'outgoing');

     // Setup Tab Switching Listener (only needs to be attached once)
    if (!friendsTabsContainer.dataset.listenerAttached) {
         friendsTabsContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('tab-button')) {
                const targetTabId = event.target.dataset.tab;
                if (!targetTabId) return;

                // Remove active class from all buttons and content panes
                friendsTabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                friendsSection.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

                // Add active class to the clicked button and corresponding content pane
                event.target.classList.add('active');
                const targetContent = document.getElementById(`${targetTabId}-container`);
                if (targetContent) {
                    targetContent.classList.add('active');
                } else {
                    console.error(`Could not find tab content for ID: ${targetTabId}-container`);
                }
            }
        });
        friendsTabsContainer.dataset.listenerAttached = 'true'; // Mark listener as attached
    }
}

// --- Populate a specific friend/request list ---
async function populateFriendList(ulElement, userIds, type) {
    ulElement.innerHTML = ''; // Clear previous items

    if (userIds.length === 0) {
        let message = 'No users found.';
        if (type === 'friend') message = 'You have no friends yet.';
        if (type === 'incoming') message = 'No incoming friend requests.';
        if (type === 'outgoing') message = 'No outgoing friend requests.';
        ulElement.innerHTML = `<li class="list-message">${message}</li>`;
        return;
    }

    // Fetch mini profiles for all users in parallel
    ulElement.innerHTML = `<li class="list-message">Loading user details...</li>`; // Show loading message while fetching
    const profilePromises = userIds.map(id => fetchUserMiniProfile(id));
    const profiles = await Promise.all(profilePromises);

    ulElement.innerHTML = ''; // Clear loading message

    // Create and append list items for successfully fetched profiles
    profiles.forEach(miniProfile => {
        if (miniProfile && miniProfile.displayName !== "Error Loading") { // Check if fetch was successful and not an error fallback
             ulElement.appendChild(createFriendListItem(miniProfile, type));
        } else {
             console.warn(`Skipping list item for ${miniProfile?.id || 'unknown ID'} due to fetch error or missing data.`);
             // Optionally add a placeholder for failed loads
             // const errorLi = document.createElement('li');
             // errorLi.className = 'list-message';
             // errorLi.textContent = `Could not load user ${miniProfile?.id || ''}`;
             // ulElement.appendChild(errorLi);
        }
    });

    // If after fetching, the list is STILL empty (e.g., all fetches failed)
    if (ulElement.childElementCount === 0) {
         ulElement.innerHTML = `<li class="list-message">Could not load user details.</li>`;
    }
}

// --- Create HTML for a single list item ---
function createFriendListItem(miniProfile, type) {
    const li = document.createElement('li');
    li.classList.add('friend-item');
    li.dataset.userId = miniProfile.id; // Store user ID for actions

    // Info Part (PFP + Name)
    const infoDiv = document.createElement('div');
    infoDiv.className = 'friend-item-info';

    // Profile Picture or Initials
    const pfpContainer = document.createElement('div'); // Container to handle replacement easily
    if (miniProfile.profilePictureUrl) {
        const img = document.createElement('img');
        img.src = miniProfile.profilePictureUrl;
        img.alt = `${miniProfile.displayName}'s profile picture`;
        img.className = 'friend-item-pfp';
        img.onerror = (e) => { // Fallback to initials on error
            const initialDiv = document.createElement('div');
            initialDiv.className = 'friend-item-pfp-initial';
            initialDiv.textContent = miniProfile.displayName?.charAt(0)?.toUpperCase() || '?';
            e.target.parentElement.replaceWith(initialDiv); // Replace container content
        }
        pfpContainer.appendChild(img);
    } else {
        const initialDiv = document.createElement('div');
        initialDiv.className = 'friend-item-pfp-initial';
        initialDiv.textContent = miniProfile.displayName?.charAt(0)?.toUpperCase() || '?';
        pfpContainer.appendChild(initialDiv);
    }
    infoDiv.appendChild(pfpContainer);


    // Name (clickable link)
    const nameSpan = document.createElement('span');
    nameSpan.className = 'friend-item-name';
    const nameLink = document.createElement('a');
    nameLink.href = `profile.html?uid=${miniProfile.id}`; // Link to their profile
    nameLink.textContent = miniProfile.displayName;
    nameSpan.appendChild(nameLink);
    infoDiv.appendChild(nameSpan);

    li.appendChild(infoDiv);

    // Actions Part (Buttons)
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'friend-item-actions';

    if (type === 'friend') {
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.className = 'btn btn-secondary btn-remove btn-small';
        removeBtn.onclick = (e) => handleFriendAction(e.target, 'removeFriend', miniProfile.id, li); // Pass li to remove later
        actionsDiv.appendChild(removeBtn);
    } else if (type === 'incoming') {
        const acceptBtn = document.createElement('button');
        acceptBtn.textContent = 'Accept';
        acceptBtn.className = 'btn btn-primary btn-accept btn-small';
        acceptBtn.onclick = (e) => handleFriendAction(e.target, 'acceptRequest', miniProfile.id, li);

        const declineBtn = document.createElement('button');
        declineBtn.textContent = 'Decline';
        declineBtn.className = 'btn btn-secondary btn-decline btn-small';
        declineBtn.onclick = (e) => handleFriendAction(e.target, 'declineRequest', miniProfile.id, li);

        actionsDiv.appendChild(acceptBtn);
        actionsDiv.appendChild(declineBtn);
    } else if (type === 'outgoing') {
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn btn-secondary btn-cancel btn-small';
        cancelBtn.onclick = (e) => handleFriendAction(e.target, 'cancelRequest', miniProfile.id, li);
        actionsDiv.appendChild(cancelBtn);
    }

    li.appendChild(actionsDiv);

    return li;
}


// --- Master Handler for Friend Actions (using Batch Writes) ---
async function handleFriendAction(buttonElement, action, otherUserId, listItemToRemove = null) {
    if (!loggedInUser || !otherUserId) {
        console.error("Friend action cannot proceed: Not logged in or otherUserId missing.");
        return;
    }

    const currentUserUid = loggedInUser.uid;

    // --- Disable Button(s) and Show Loading ---
    buttonElement.disabled = true;
    const originalText = buttonElement.textContent; // Store original text
    buttonElement.textContent = '...';

    // Find sibling buttons if they exist (e.g., Accept/Decline pair in a list item)
    const actionContainer = buttonElement.closest('.friend-item-actions') || friendshipControlsContainer;
    const siblingButtons = actionContainer.querySelectorAll('button');
    const originalSiblingTexts = {}; // Store original text for siblings
    siblingButtons.forEach(btn => {
        if (btn !== buttonElement) {
            originalSiblingTexts[btn.textContent] = btn.textContent; // Simple key based on current text
             btn.disabled = true;
        }
    });
    // --- End Disable Buttons ---


    const userDocRef = db.collection('users').doc(currentUserUid);
    const otherUserDocRef = db.collection('users').doc(otherUserId);
    const batch = db.batch();

    try {
        console.log(`Performing friend action: ${action} between ${currentUserUid} and ${otherUserId}`);

        // Prepare batch operations based on action
        switch (action) {
            case 'sendRequest':
                // My status for them: outgoing
                batch.update(userDocRef, { [`friends.${otherUserId}`]: 'outgoing' });
                // Their status for me: incoming
                batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: 'incoming' });
                break;
            case 'cancelRequest': // I cancel my outgoing request
                // Remove entry from my map
                batch.update(userDocRef, { [`friends.${otherUserId}`]: firebase.firestore.FieldValue.delete() });
                // Remove entry from their map
                batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: firebase.firestore.FieldValue.delete() });
                break;
            case 'declineRequest': // I decline their incoming request
                 // Remove entry from my map
                batch.update(userDocRef, { [`friends.${otherUserId}`]: firebase.firestore.FieldValue.delete() });
                // Remove entry from their map
                batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: firebase.firestore.FieldValue.delete() });
                break;
            case 'removeFriend': // Either user removes the friend
                // Remove entry from my map
                batch.update(userDocRef, { [`friends.${otherUserId}`]: firebase.firestore.FieldValue.delete() });
                // Remove entry from their map
                batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: firebase.firestore.FieldValue.delete() });
                break;
            case 'acceptRequest': // I accept their incoming request
                // My status for them: friend
                batch.update(userDocRef, { [`friends.${otherUserId}`]: 'friend' });
                // Their status for me: friend
                batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: 'friend' });
                break;
            default:
                throw new Error("Invalid friend action specified.");
        }

        // Commit the batch
        await batch.commit();
        console.log("Friend action batch commit successful.");

        // --- Update UI Immediately After Success ---

        // 1. Update viewer's local data (important for subsequent status checks)
        try {
            const viewerSnap = await db.collection('users').doc(currentUserUid).get();
            if (viewerSnap.exists) {
                viewerProfileData = { id: viewerSnap.id, ...viewerSnap.data() };
                if (!viewerProfileData.friends) viewerProfileData.friends = {}; // Ensure map exists
                console.log("Refreshed viewerProfileData after action.");
            } else {
                console.error("Could not refetch viewer profile after action! UI state might be inconsistent.");
                // Attempt to update local viewerProfileData based on action? Risky.
                 // For now, log error and proceed with potentially stale viewer data for UI updates.
            }
        } catch (fetchError) {
             console.error("Error refetching viewer profile after action:", fetchError);
             // Proceed with potentially stale viewer data.
        }


        // 2. If viewing the other user's profile, update the control buttons
        if (!isOwnProfile && viewingUserProfileData.profile?.id === otherUserId) {
             const newStatus = determineFriendshipStatus(currentUserUid, otherUserId);
             displayFriendshipControls(newStatus, otherUserId); // Re-display buttons based on new status
        }
        // 3. If viewing own profile, update the lists more directly
        else if (isOwnProfile) {
            if (listItemToRemove) {
                 listItemToRemove.remove(); // Remove the item acted upon

                 // If accepting, fetch profile and add to 'Friends' list
                 if (action === 'acceptRequest') {
                     const acceptedProfile = await fetchUserMiniProfile(otherUserId);
                     if (acceptedProfile && acceptedProfile.displayName !== "Error Loading") {
                         // Avoid adding duplicates if already there somehow
                         if (!friendsListUl.querySelector(`li[data-user-id="${otherUserId}"]`)) {
                            friendsListUl.appendChild(createFriendListItem(acceptedProfile, 'friend'));
                            // Remove 'no friends' message if it exists
                            const emptyMsg = friendsListUl.querySelector('.list-message');
                            if(emptyMsg) emptyMsg.remove();
                         }
                     } else {
                         console.warn("Could not fetch profile to add to friends list after accepting.");
                         // Maybe add a temporary item indicating success but missing details?
                     }
                 }
                 // Update counts and check for empty lists after removal/addition
                 updateListCountsAndMessages();
            } else {
                // If action was triggered from profile page buttons (shouldn't happen on own profile)
                // but potentially refresh the whole section if needed.
                console.warn("Friend action handled on own profile without list item reference.");
                // Refresh the whole section as a fallback
                 displayFriendsSection(viewerProfileData); // Use updated viewer data (which is own data here)
            }
        }

        // Clear mini-profile cache for the other user as their relationship changed
        delete miniProfileCache[otherUserId];

    } catch (error) {
        console.error(`Error performing friend action '${action}':`, error);
        alert(`An error occurred: ${error.message}. Please try again.`);
         // --- Re-enable Button(s) on Error ---
         buttonElement.disabled = false;
         buttonElement.textContent = originalText; // Restore original text

         siblingButtons.forEach(btn => {
              if (btn !== buttonElement) {
                 btn.disabled = false;
                 // Find original text - this simple key lookup might fail if text changed
                 // A more robust way would be storing text in a data attribute
                 const originalSiblingText = Object.keys(originalSiblingTexts).find(key => originalSiblingTexts[key] === btn.textContent) || 'Action';
                 btn.textContent = originalSiblingText;
              }
         });
         // --- End Re-enable Buttons ---
    }
    // Note: Buttons are intentionally *not* re-enabled on success,
    // because the UI should change (button disappears or changes, or list item removed).
}

// Helper to update list counts and show/hide empty messages after actions
function updateListCountsAndMessages() {
    if (!isOwnProfile) return; // Only run on own profile

    const lists = [
        { ul: friendsListUl, type: 'friend' },
        { ul: incomingListUl, type: 'incoming', countSpan: incomingCountSpan },
        { ul: outgoingListUl, type: 'outgoing', countSpan: outgoingCountSpan }
    ];

    lists.forEach(listInfo => {
        if (!listInfo.ul) return; // Skip if element doesn't exist

        const items = listInfo.ul.querySelectorAll('li.friend-item'); // Select only actual friend items
        const count = items.length;

        // Update count in tab
        if (listInfo.countSpan) {
            listInfo.countSpan.textContent = count;
        }

        // Add or remove the empty message
        const messageElement = listInfo.ul.querySelector('.list-message');
        if (count === 0 && !messageElement) {
             let messageText = 'No users found.';
            if (listInfo.type === 'friend') messageText = 'You have no friends yet.';
            if (listInfo.type === 'incoming') messageText = 'No incoming friend requests.';
            if (listInfo.type === 'outgoing') messageText = 'No outgoing friend requests.';
            // Create and prepend message
            const msgLi = document.createElement('li');
            msgLi.className = 'list-message';
            msgLi.textContent = messageText;
            listInfo.ul.prepend(msgLi); // Prepend to show at top
        } else if (count > 0 && messageElement) {
            messageElement.remove(); // Remove message if items exist
        }
    });
}


// =============================================================================
// --- Authentication and Initialization ---
// =============================================================================
auth.onAuthStateChanged(user => {
    loggedInUser = user; // Update global loggedInUser state
    const targetUid = profileUidFromUrl || loggedInUser?.uid; // Determine whose profile to load
    console.log(`Auth state changed. User: ${user ? user.uid : 'null'}, Target UID: ${targetUid}`);

    // Determine if viewing own profile AFTER auth state is confirmed
    isOwnProfile = loggedInUser && targetUid === loggedInUser.uid;
    viewerProfileData = null; // Reset viewer data cache on auth change
    miniProfileCache = {}; // Reset mini profile cache

    if (targetUid) {
        // User is logged in or a UID is provided in URL
        loadingIndicator.style.display = 'flex'; // Show loading initially
        notLoggedInMsg.style.display = 'none';
        profileContent.style.display = 'none'; // Hide content until loaded

        // Fetch necessary global data if not already fetched
        if (!allAchievements) fetchAllAchievements(); // Can run in parallel

        // Load the combined user data
        loadCombinedUserData(targetUid).then(() => {
             // AFTER data is loaded and displayed, hide loading, show content
             console.log("loadCombinedUserData finished. Displaying content.");
             loadingIndicator.style.display = 'none';
             // Only show content if profile was actually found (check inside loadCombinedUserData?)
             // Assuming loadCombinedUserData handles the "not found" case by not showing #profile-content
             if (viewingUserProfileData.profile) { // Check if profile data exists after load
                  profileContent.style.display = 'block'; // Show main profile container
             }


             // Setup interaction listeners AFTER content is displayed
             if (isOwnProfile) {
                 // Ensure listeners are attached to potentially new/cloned nodes
                 const currentEditIcon = document.getElementById('edit-profile-pic-icon');
                 const currentFileInput = document.getElementById('profile-pic-input');
                 if (currentEditIcon) currentEditIcon.replaceWith(currentEditIcon.cloneNode(true));
                 if (currentFileInput) currentFileInput.replaceWith(currentFileInput.cloneNode(true));

                 setupProfilePicEditing(); // Setup pic edit listeners for the owner
                 // Friend section tab listener setup is handled within displayFriendsSection
             } else {
                // Ensure edit icon is hidden if not the owner
                const currentEditIcon = document.getElementById('edit-profile-pic-icon');
                if(currentEditIcon) currentEditIcon.style.display = 'none';
                 // Friendship controls are displayed within loadCombinedUserData
             }
             // Title selector setup is handled within updateProfileTitlesAndRank called by displayProfileData
        }).catch(err => {
            console.error("Critical error during loadCombinedUserData execution:", err);
            // Ensure loading is hidden and error message is shown
            loadingIndicator.style.display = 'none';
            profileContent.style.display = 'none';
            notLoggedInMsg.textContent = 'Failed to load profile. Please try again.';
            notLoggedInMsg.style.display = 'flex';
             clearFriendshipControls();
             resetFriendsSection();
        });

        // Show/Hide Logout Button based on whether viewer is owner of target profile
        profileLogoutBtn.style.display = isOwnProfile ? 'inline-block' : 'none';

    } else {
        // No user logged in AND no UID in URL -> Show "Not Logged In" message
        console.log('No user logged in and no profile UID in URL.');
        loadingIndicator.style.display = 'none';
        profileContent.style.display = 'none'; // Hide profile content
        notLoggedInMsg.style.display = 'flex'; // Show message container
        notLoggedInMsg.textContent = 'Please log in to view your profile, or provide a user ID in the URL (e.g., ?uid=USER_ID).';

        // Reset UI elements (including new friend elements)
        adminTag.style.display = 'none';
        profileBadgesContainer.innerHTML = '';
        profileLogoutBtn.style.display = 'none';
        editProfilePicIcon.style.display = 'none'; // Hide edit icon
        updateProfileTitlesAndRank(null, false); // Reset rank/title
        competitiveStatsDisplay.innerHTML = ''; // Clear stats
        displayPoxelStats(null); // Clear poxel stats
        updateProfileBackground(null); // Clear background
        viewingUserProfileData = {}; // Clear global data
        viewerProfileData = null; // Clear viewer data
        miniProfileCache = {}; // Clear mini profile cache
        closeTitleSelector(); // Ensure title selector is closed
        closeEditModal(); // Ensure edit modal is closed
        clearFriendshipControls(); // Clear friend buttons
        resetFriendsSection();    // Reset friend section visibility and content
    }
});

// --- Logout Button Event Listener ---
profileLogoutBtn.addEventListener('click', () => {
    const userId = loggedInUser?.uid;
    console.log('Logout button clicked.');

    // Clean up UI elements and state before signing out
    if (titleDisplay) titleDisplay.removeEventListener('click', handleTitleClick);
    closeTitleSelector();
    closeEditModal();
    clearFriendshipControls(); // Clear friend buttons if any were shown
    resetFriendsSection();    // Hide friend section
    miniProfileCache = {}; // Clear mini profile cache
    viewingUserProfileData = {}; // Clear viewed profile data
    viewerProfileData = null; // Clear logged-in user data


    // Sign out
    auth.signOut().then(() => {
        console.log('User signed out successfully.');
        if (userId) {
            // Clear cache for the logged-out user
            localStorage.removeItem(`poxelProfileCombinedData_${userId}`);
            console.log(`Cleared cache for UID: ${userId}`);
        }
        // State already cleared above
        window.location.href = 'index.html'; // Redirect to home or login page
    }).catch((error) => {
        console.error('Sign out error:', error);
        alert('Error signing out. Please try again.');
        // Re-enable UI? Or assume redirect will happen anyway?
    });
});


// =============================================================================
// --- Local Storage Caching ---
// =============================================================================
function loadCombinedDataFromCache(viewedUserId) {
    if (!viewedUserId) return false;
    const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
    const cachedDataString = localStorage.getItem(cacheKey);
    if (!cachedDataString) {
        console.log(`No cache found for UID: ${viewedUserId}`);
        return false;
    }
    try {
        const cachedData = JSON.parse(cachedDataString);
        // Basic validation: ensure profile object exists
        if (cachedData && cachedData.profile) {
            // Ensure friends map exists in cached data
             if (!cachedData.profile.friends) cachedData.profile.friends = {};

            viewingUserProfileData = cachedData; // Load data into global state
            console.log("Loaded combined data from cache for VIEWED UID:", viewedUserId);

            // Determine if the cached view is for the currently logged-in user
            // Use auth.currentUser directly as loggedInUser might not be set yet
            const viewingOwnCachedProfile = auth.currentUser && auth.currentUser.uid === viewedUserId;

            // Display data from cache
            displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats, viewingOwnCachedProfile);
            // Note: Poxel stats are not cached here, they will be fetched live later.
            // Friend controls/section will be displayed later in loadCombinedUserData after viewer data is fetched.

            return true; // Indicate cache was successfully loaded and displayed
        } else {
            console.warn(`Invalid cache structure for UID: ${viewedUserId}. Removing.`);
            localStorage.removeItem(cacheKey);
            return false;
        }
    } catch (error) {
        console.error("Error parsing cached data:", error);
        localStorage.removeItem(cacheKey); // Remove corrupted cache
        return false;
    }
}

function saveCombinedDataToCache(viewedUserId, combinedData) {
    if (!viewedUserId || !combinedData || !combinedData.profile) {
        console.warn("Attempted to save invalid data to cache. Aborting.");
        return;
    }
    const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
    try {
        // Ensure friends map exists before saving
        if (!combinedData.profile.friends) combinedData.profile.friends = {};

        // Consider stringifying only necessary parts if data becomes very large
        // For now, stringify the whole combined object (profile + stats)
        localStorage.setItem(cacheKey, JSON.stringify(combinedData));
        // console.log(`Saved combined data to cache for UID: ${viewedUserId}`);
    } catch(error) {
        console.error("Error saving data to cache:", error);
        if (error.name === 'QuotaExceededError') {
            console.warn('Browser storage quota exceeded. Cannot cache profile data. Consider clearing old data or reducing cache size.');
            // Implement more sophisticated cache cleanup if needed (e.g., LRU cache)
        }
    }
}

// --- Initial Log ---
console.log("Profile script initialized. Waiting for Auth state...");
