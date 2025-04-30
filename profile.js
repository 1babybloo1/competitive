// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI", // Replace with your actual API key if this is public placeholder
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
const CLOUDINARY_CLOUD_NAME = "djttn4xvk"; // <-- REPLACE with your Cloudinary Cloud Name
const CLOUDINARY_UPLOAD_PRESET = "compmanage"; // <-- REPLACE with your unsigned Upload Preset name

// --- URL Parameter Parsing & Logged-in User Check ---
const urlParams = new URLSearchParams(window.location.search);
const profileUidFromUrl = urlParams.get('uid');
let loggedInUser = null; // Initialize as null, will be set by onAuthStateChanged

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
    // Add more badges as needed
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
const competitiveStatsDisplay = document.getElementById('stats-display'); // The container for comp stats
const profileLogoutBtn = document.getElementById('profile-logout-btn');
const adminTag = document.getElementById('admin-tag');
const rankDisplay = document.getElementById('profile-rank');
const titleDisplay = document.getElementById('profile-title');
const profileIdentifiersDiv = document.querySelector('.profile-identifiers');
const profileBadgesContainer = document.getElementById('profile-badges-container');
const poxelStatsSection = document.getElementById('poxel-stats-section'); // Section for Poxel.io stats
const poxelStatsDisplay = document.getElementById('poxel-stats-display'); // Display area for Poxel.io stats
// Modal Elements
const editModal = document.getElementById('edit-modal');
const modalImage = document.getElementById('image-to-crop');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalApplyBtn = document.getElementById('modal-apply-btn');
const modalSpinner = document.getElementById('modal-spinner');

// --- Global/Scoped Variables ---
let allAchievements = null;
let viewingUserProfileData = {}; // Holds { profile: data, stats: data }
let isTitleSelectorOpen = false;
let titleSelectorElement = null;
let cropper = null;
let isOwnProfile = false; // Flag needs to be set definitively inside onAuthStateChanged

// =============================================================================
// --- CORE FUNCTIONS ---
// =============================================================================

// --- Fetch Poxel.io Stats from API ---
// (No changes needed here unless Poxel API provides different stats)
async function fetchPoxelStats(username) {
    if (!username || typeof username !== 'string' || username.trim() === '') { console.warn("fetchPoxelStats: Invalid username."); return null; }
    console.log(`Fetching Poxel.io stats for: ${username}`);
    try {
        const apiUrl = `https://dev-usa-1.poxel.io/api/profile/stats/${encodeURIComponent(username)}`;
        const res = await fetch(apiUrl, { headers: { "Content-Type": "application/json" } });
        if (!res.ok) {
            let errorMsg = `HTTP error ${res.status}`; try { const errData = await res.json(); errorMsg = errData.message || errData.error || errorMsg; } catch (e) {} throw new Error(errorMsg);
        }
        const data = await res.json(); console.log("Poxel.io API Stats Received:", data);
        if (typeof data !== 'object' || data === null) throw new Error("Invalid data format from Poxel.io API.");
        if (data.error || data.status === 'error') throw new Error(data.message || 'Poxel API returned error status.');
        return data;
    } catch (e) { console.error("Error fetching Poxel.io stats:", e.message || e); return null; }
}

// --- Fetch all achievement definitions ---
async function fetchAllAchievements() {
    if (allAchievements) return allAchievements; // Use cached if available
    try {
        const snapshot = await db.collection('achievements').get();
        allAchievements = {};
        snapshot.forEach(doc => { allAchievements[doc.id] = { id: doc.id, ...doc.data() }; });
        console.log("Fetched achievement definitions:", allAchievements);
        return allAchievements;
    } catch (error) { console.error("Error fetching achievement definitions:", error); return null; }
}

// --- Helper: Compare Leaderboard Stats ---
// ***** UPDATED: ADDED 'kills' *****
function areStatsDifferent(newStats, existingProfileStats) {
    const normNew = newStats || {}; // Stats from 'leaderboard' collection
    const normExisting = existingProfileStats || {}; // Stats from 'users' collection (leaderboardStats field)
    // Keys to compare for sync necessity
    const statKeys = ['wins', 'points', 'kdRatio', 'matchesPlayed', 'matches', 'losses', 'kills'];
    let different = false;

    // console.log('Comparing stats:', { new: normNew, existing: normExisting }); // Debug log

    for (const key of statKeys) {
        const newValue = normNew[key] ?? null;
        const existingValue = normExisting[key] ?? null;

        // Check aliases like matches/matchesPlayed
        let newActualValue = newValue;
        if (key === 'matchesPlayed' && !(key in normNew) && ('matches' in normNew)) {
             newActualValue = normNew['matches'] ?? null;
             // console.log(`Alias used for 'matchesPlayed', using 'matches' value: ${newActualValue}`);
        }
        let existingActualValue = existingValue;
         if (key === 'matchesPlayed' && !(key in normExisting) && ('matches' in normExisting)) {
             existingActualValue = normExisting['matches'] ?? null;
             // console.log(`Alias used for 'matchesPlayed' in existing, using 'matches' value: ${existingActualValue}`);
        }

        // Perform comparison
        if (key === 'kdRatio' && typeof newActualValue === 'number' && typeof existingActualValue === 'number') {
            if (Math.abs(newActualValue - existingActualValue) > 0.001) {
                console.log(`Stats diff found: ${key} (float): ${newActualValue} !== ${existingActualValue}`);
                different = true; break;
            }
        } else if (newActualValue !== existingActualValue) {
             console.log(`Stats diff found: ${key} (exact): ${newActualValue} !== ${existingActualValue}`);
            different = true; break;
        }
    }

    // Check if the set of keys themselves changed (e.g., 'kills' was added)
    // Note: This logic might need adjustment if some stats are intentionally absent for some users.
    if (!different) {
        const newRelevantKeys = Object.keys(normNew).filter(k => statKeys.includes(k));
        const existingRelevantKeys = Object.keys(normExisting).filter(k => statKeys.includes(k));
        if (newRelevantKeys.length !== existingRelevantKeys.length) {
             console.log(`Stats diff found: Key count changed ${newRelevantKeys.length} vs ${existingRelevantKeys.length}`);
            different = true;
        } else {
            const newSet = new Set(newRelevantKeys);
            if (!existingRelevantKeys.every(key => newSet.has(key))) {
                 console.log(`Stats diff found: Key sets do not match.`);
                 different = true;
            }
        }
    }
    // if (different) console.log('areStatsDifferent returning TRUE'); else console.log('areStatsDifferent returning FALSE'); // Debug log
    return different;
}

// --- Helper Function: Client-Side User Profile Document Creation ---
// (No changes needed here)
async function createUserProfileDocument(userId, authUser) {
    console.warn(`Client-side: Creating missing user profile doc for UID: ${userId}`);
    const userDocRef = db.collection("users").doc(userId);
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;
    const defaultProfileData = { email: authUser.email || null, displayName: displayName, currentRank: "Unranked", equippedTitle: "", availableTitles: [], friends: [], createdAt: firebase.firestore.FieldValue.serverTimestamp(), leaderboardStats: {}, profilePictureUrl: authUser.photoURL || null };
    try { await userDocRef.set(defaultProfileData, { merge: true }); console.log(`Successfully created/merged user profile document for UID: ${userId} via client`); return { id: userId, ...defaultProfileData };
    } catch (error) { console.error(`Error creating user profile doc client-side for UID ${userId}:`, error); alert("Error setting up profile. Contact support."); return null; }
}

// --- Load Combined User Data (Profile + Stats + Poxel) ---
// (Minor logic refinements, ensure correct data passed to checkAchievements)
async function loadCombinedUserData(targetUserId) {
    console.log(`%c--- Loading Combined User Data for TARGET UID: ${targetUserId} ---`, 'color: blue; font-weight: bold;');
    // 'isOwnProfile' must be determined *after* auth state is confirmed. Set later in onAuthStateChanged.
    console.log("Auth state currently indicates viewing own profile:", isOwnProfile); // Log initial assumption

    displayPoxelStats(null, true);
    competitiveStatsDisplay.innerHTML = '<p>Loading competitive stats...</p>';
    updateProfileTitlesAndRank(null, false);

    // Try cache first
    const cacheLoaded = loadCombinedDataFromCache(targetUserId);
    if (cacheLoaded) console.log("Displayed initial data from cache.");

    const userProfileRef = db.collection('users').doc(targetUserId);
    const leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId);

    try {
        // 1. Fetch User Profile
        console.log(`Fetching profile: users/${targetUserId}`);
        let profileSnap = await userProfileRef.get();
        let profileData = null;
        if (!profileSnap.exists) {
            console.warn(`User profile document NOT FOUND for UID: ${targetUserId}`);
            // Only create profile for the *logged-in* user if they lack one
            if (isOwnProfile && loggedInUser) {
                profileData = await createUserProfileDocument(targetUserId, loggedInUser);
                if (!profileData) throw new Error(`Profile creation FAILED for own UID ${targetUserId}.`);
            } else {
                throw new Error(`Profile not found for target UID: ${targetUserId}. Cannot create profile for others.`);
            }
        } else {
            profileData = { id: profileSnap.id, ...profileSnap.data() };
            // Ensure essential fields exist for logic downstream
            if (profileData.leaderboardStats === undefined) profileData.leaderboardStats = {};
            if (profileData.profilePictureUrl === undefined) profileData.profilePictureUrl = null;
            if (profileData.currentRank === undefined) profileData.currentRank = 'Unranked';
            if (profileData.equippedTitle === undefined) profileData.equippedTitle = '';
            if (profileData.availableTitles === undefined) profileData.availableTitles = [];
            console.log("Fetched Profile Data:", profileData);
        }

        // 2. Fetch Leaderboard Stats (Competitive)
        console.log(`Fetching stats: leaderboard/${targetUserId}`);
        const statsSnap = await leaderboardStatsRef.get();
        // Use empty object as default if no stats doc, simplifies downstream checks
        const competitiveStatsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : {};
        console.log("Fetched Competitive Stats Data:", competitiveStatsData);

        // 3. Sync Stats if Necessary
        // Check if the newly fetched stats from 'leaderboard' differ from the copy in 'users' doc
        let statsSynced = false;
        if (profileData && areStatsDifferent(competitiveStatsData, profileData.leaderboardStats)) {
            console.log(`%cCompetitive stats for UID ${targetUserId} differ or new stats found. Syncing to 'users' doc.`, 'color: orange');
            try {
                const statsToSave = { ...competitiveStatsData }; // Make a copy
                if (statsToSave.id) delete statsToSave.id; // Don't save the ID field within the map
                 console.log("Data being synced to user profile:", statsToSave); // DEBUG LOG

                // --- Perform the Update ---
                await userProfileRef.update({ leaderboardStats: statsToSave });
                console.log("Sync successful: 'users' doc updated with latest leaderboardStats.");
                profileData.leaderboardStats = statsToSave; // Update local profileData copy
                statsSynced = true; // Mark that sync happened
            } catch (updateError) {
                console.error(`%cERROR syncing stats to 'users' doc for UID ${targetUserId}:`, 'color: red', updateError);
                // Proceed with possibly stale stats in profileData.leaderboardStats for achievement check? Or use fresh competitiveStatsData?
                // Let's proceed cautiously but log the error. Maybe achievement check will still work if profile read succeeds.
            }
        } else {
             console.log("Competitive stats in 'users' doc are up-to-date. No sync needed.");
        }

        // 4. Update Global State
        viewingUserProfileData = { profile: profileData, stats: competitiveStatsData }; // Use FRESH stats for reference

        // 5. Display Core Profile & Competitive Stats (using the FRESH stats for display)
        // isOwnProfile should be correctly set by onAuthStateChanged now
        displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats, isOwnProfile);
        if (profileData) saveCombinedDataToCache(targetUserId, viewingUserProfileData); // Update cache with fresh data

        // 6. Fetch and Display Poxel.io Stats (Asynchronous)
        if (profileData?.displayName) {
             fetchPoxelStats(profileData.displayName).then(displayPoxelStats).catch(e => displayPoxelStats(null));
        } else { console.warn("No displayName, cannot fetch Poxel.io stats."); displayPoxelStats(null); }

        // 7. Check Achievements (Crucial Part for Rank/Title Update)
        // Run ONLY if it's the user's own profile AND they have competitive stats data.
        console.log(`Checking Achievement condition: isOwnProfile=${isOwnProfile}, viewingUserProfileData.stats exists?`, !!viewingUserProfileData.stats);
        if (isOwnProfile && viewingUserProfileData.stats) {
             console.log(`Proceeding with achievement check for UID ${targetUserId}.`);
             if (!allAchievements) await fetchAllAchievements(); // Fetch definitions if not done yet
             if (allAchievements) {
                 // *** Pass the FRESH competitive stats data directly ***
                 // Pass the profile data that potentially just got its stats synced
                 const potentiallyUpdatedProfile = await checkAndGrantAchievements(
                     targetUserId,
                     profileData, // Pass profile that has synced stats if sync happened
                     competitiveStatsData // Pass the FRESH stats fetched from leaderboard
                 );
                 if (potentiallyUpdatedProfile) {
                     console.log("%cProfile updated by achievement check. Refreshing UI.", 'color: green');
                     // If achievements were granted, the profile object was changed.
                     viewingUserProfileData.profile = potentiallyUpdatedProfile; // Update global state
                     displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats, isOwnProfile); // RE-RENDER with new rank/title
                     saveCombinedDataToCache(targetUserId, viewingUserProfileData); // Update cache
                 } else {
                      console.log("Achievement check ran, but no new rewards were granted.");
                 }
             } else {
                  console.warn("Cannot check achievements: Definitions failed to load.");
             }
        } else {
             console.log(`Skipping achievement check for UID ${targetUserId}. (Not own profile or no stats data)`);
        }

        console.log(`%c--- Finished loading combined data for ${targetUserId} ---`, 'color: blue; font-weight: bold;');

    } catch (error) {
        console.error(`%c--- ERROR in loadCombinedUserData for UID ${targetUserId} ---`, 'color: red; font-weight: bold;', error);
        if (error.stack) console.error("Full error stack:", error.stack);
        // Show error only if cache didn't load initially
        if (!cacheLoaded) {
            profileContent.style.display = 'none';
            notLoggedInMsg.textContent = `Error loading profile: ${error.message}. Please try again later.`;
            notLoggedInMsg.style.display = 'flex';
            loadingIndicator.style.display = 'none';
            competitiveStatsDisplay.innerHTML = '<p>Error loading data.</p>';
            updateProfileTitlesAndRank(null, false); displayPoxelStats(null); updateProfileBackground(null);
        } else {
            console.warn("Error fetching fresh data, displaying potentially stale cache view.");
            // Attempt Poxel stats fetch using cached data if possible
             if (viewingUserProfileData.profile?.displayName) {
                 fetchPoxelStats(viewingUserProfileData.profile.displayName).then(displayPoxelStats).catch(e => displayPoxelStats(null));
            } else { displayPoxelStats(null); }
        }
    }
}


// --- Display Core Profile Data ---
// (No changes needed here)
function displayProfileData(profileData, competitiveStatsData, isOwner) {
    // ... (rest of the function is likely OK) ...

    const displayName = profileData?.displayName || 'User Not Found';
     console.log(`Displaying profile for: ${displayName}, isOwner: ${isOwner}`); // Log who is being displayed

     if (!profileData) {
        // Reset state for "User Not Found" or error
        profileImage.style.display = 'none'; profileImage.src = '';
        profileInitials.style.display = 'flex'; profileInitials.textContent = "?";
        editProfilePicIcon.style.display = 'none'; updateProfileBackground(null);
        usernameDisplay.textContent = "User Not Found"; emailDisplay.textContent = "";
        adminTag.style.display = 'none'; profileBadgesContainer.innerHTML = '';
        updateProfileTitlesAndRank(null, false); displayCompetitiveStats(null);
        return;
    }

    emailDisplay.textContent = profileData.email || 'No email provided';
    usernameDisplay.textContent = displayName; // Use var assigned above

    // Profile Picture Logic
    if (profileData.profilePictureUrl) { /* ... */ } else { /* ... */ }
    editProfilePicIcon.style.display = isOwner ? 'flex' : 'none';

    // Display other elements
    displayUserBadges(profileData);
    // Ensure updateProfileTitlesAndRank uses the *latest* profileData (potentially updated by achievements)
    updateProfileTitlesAndRank(profileData, isOwner); // Pass current owner status
    displayCompetitiveStats(competitiveStatsData); // Pass competitive stats (usually fresh from leaderboard)

     // ... (rest of the function, image error handling etc.)
     if (profileData.profilePictureUrl) {
        profileImage.src = profileData.profilePictureUrl;
        profileImage.style.display = 'block';
        profileInitials.style.display = 'none';
        profileImage.onerror = () => { /* Fallback */
            console.error("Failed to load profile image:", profileData.profilePictureUrl);
            profileImage.style.display = 'none'; profileInitials.textContent = displayName.charAt(0).toUpperCase() || '?'; profileInitials.style.display = 'flex'; updateProfileBackground(null); };
        updateProfileBackground(profileData.profilePictureUrl);
    } else {
        profileImage.style.display = 'none'; profileImage.src = ''; profileInitials.textContent = displayName.charAt(0).toUpperCase() || '?'; profileInitials.style.display = 'flex'; updateProfileBackground(null);
    }
}


// --- Update Profile Background ---
// (No changes needed)
function updateProfileBackground(imageUrl) { /* ... */ }

// --- Display COMPETITIVE Stats Grid ---
// ***** UPDATED: ADDED 'kills' *****
function displayCompetitiveStats(statsData) {
    competitiveStatsDisplay.innerHTML = ''; // Clear previous

    // Check if statsData is valid and has own properties
    if (!statsData || typeof statsData !== 'object' || Object.keys(statsData).length === 0 || statsData.id && Object.keys(statsData).length === 1) { // Exclude if only contains 'id'
        competitiveStatsDisplay.innerHTML = '<p>Competitive stats unavailable.</p>';
        console.log("Competitive stats are null, empty, or only contain ID. Displaying unavailable.", statsData);
        return;
    }

     console.log("Displaying competitive stats from data:", statsData);

    // Include 'kills' in the map
    const statsMap = {
         wins: 'Wins', points: 'Points',
         kills: 'Kills', // <<<<<<< ADDED KILLS
         losses: 'Losses', kdRatio: 'K/D Ratio',
         matchesPlayed: 'Matches Played', matches: 'Matches Played' // Handle alias
         // Add other stats from 'leaderboard' collection here if needed
    };

    let statsDisplayedCount = 0;
    const addedKeys = new Set(); // Track keys (or aliases) used

    // Prioritize keys in statsMap order
    for (const key in statsMap) {
        let value = undefined;
        let actualKeyUsed = null;

        // Check for key directly or alias ('matchesPlayed' vs 'matches')
        if (statsData.hasOwnProperty(key)) {
            value = statsData[key];
            actualKeyUsed = key;
        } else if (key === 'matchesPlayed' && statsData.hasOwnProperty('matches')) {
            value = statsData.matches;
            actualKeyUsed = 'matches'; // Track the alias source
        }

        // Skip if value is null/undefined OR if the actual stat key was already displayed (due to alias)
        if (value === undefined || value === null || (actualKeyUsed && addedKeys.has(actualKeyUsed))) {
            continue;
        }

        let displayValue = value;
        if (key === 'kdRatio' && typeof value === 'number') {
            displayValue = value.toFixed(2);
        }

        // Ensure we have a title from the map for the display
        if (statsMap[key]) {
            competitiveStatsDisplay.appendChild(createStatItem(statsMap[key], displayValue));
            if (actualKeyUsed) addedKeys.add(actualKeyUsed); // Mark the source key as used
            statsDisplayedCount++;
        }
    }

     // Display remaining stats not in statsMap (optional, if needed)
     /*
     for (const key in statsData) {
         if (key === 'id' || !statsData.hasOwnProperty(key) || addedKeys.has(key) || statsMap.hasOwnProperty(key) || statsMap.matches === key || statsMap.matchesPlayed === key) {
             continue; // Skip ID, already handled keys, or map keys/aliases
         }
          // Capitalize key for display if not mapped
         const title = key.charAt(0).toUpperCase() + key.slice(1);
         competitiveStatsDisplay.appendChild(createStatItem(title, statsData[key]));
         statsDisplayedCount++;
     }
     */

    if (statsDisplayedCount === 0) {
        competitiveStatsDisplay.innerHTML = '<p>No specific competitive stats found.</p>';
         console.log("No competitive stats were found to display from data:", statsData);
    }
}


// --- Display Poxel.io Stats Grid ---
// (No changes needed here unless Poxel API format changes)
function displayPoxelStats(poxelData, loading = false) { /* ... */ }

// --- Helper: Create a Single Stat Item Element ---
// (No changes needed here)
function createStatItem(title, value) { /* ... */ }


// --- Check and Grant Achievements ---
// ***** UPDATED: Added More Logging *****
async function checkAndGrantAchievements(userId, currentUserProfile, competitiveStats) {
    console.log('%c--- Starting Achievement Check ---', 'color: purple; font-weight: bold;');
    if (!allAchievements || !userId || !currentUserProfile || !competitiveStats || Object.keys(competitiveStats).length === 0) {
        console.warn("Skipping achievement check: Missing achievements definitions, user ID, profile, or valid competitive stats.", { allAchievements:!!allAchievements, userId, currentUserProfile:!!currentUserProfile, competitiveStats });
        return null; // Cannot proceed without essential data
    }

    console.log(`Checking achievements for UID ${userId} using Stats:`, JSON.parse(JSON.stringify(competitiveStats))); // Log the exact stats used

    try {
        // 1. Get User's Currently Unlocked Achievements
        const userAchievementsRef = db.collection('userAchievements').doc(userId);
        let userAchievementsDoc;
        let unlockedIds = [];
        try {
            userAchievementsDoc = await userAchievementsRef.get();
            unlockedIds = userAchievementsDoc.exists ? (userAchievementsDoc.data()?.unlocked || []) : [];
             console.log(`User currently has ${unlockedIds.length} achievements unlocked:`, unlockedIds);
        } catch (getAchievementsError) {
            console.error(`%cERROR fetching user achievements doc (userAchievements/${userId}):`, 'color:red', getAchievementsError);
            // Decide if we should proceed or stop. Let's try to proceed but warn.
            console.warn("Proceeding with achievement check despite error fetching existing unlocks. May grant duplicates.");
        }

        // 2. Iterate Through All Available Achievements
        let newAchievementsUnlocked = [];
        let rewardsToApply = { titles: [], rank: null }; // Keep track of rewards
        let needsDbUpdate = false; // Flag if any changes need writing

        for (const achievementId in allAchievements) {
            // Skip if already unlocked
            if (unlockedIds.includes(achievementId)) {
                // console.log(`Skipping already unlocked achievement: ${achievementId}`);
                continue;
            }

            const achievement = allAchievements[achievementId];
             console.log(`%cChecking achievement: [${achievementId}] ${achievement.name || ''}`, 'color: navy'); // Log current achievement check

            // 3. Check Criteria for the Achievement
            let criteriaMet = false;
            if (!achievement.criteria) {
                 console.warn(`Achievement ${achievementId} has no 'criteria' defined. Skipping.`);
                 continue; // Skip achievements without criteria
            }

            // --- Example: Single Stat Criteria Check ---
            if (achievement.criteria.stat && achievement.criteria.operator && achievement.criteria.value !== undefined) {
                const statToCheck = achievement.criteria.stat;
                const targetValue = achievement.criteria.value;
                const operator = achievement.criteria.operator;

                // Get the user's current value for this stat FROM the competitiveStats object
                // Provide a default (like 0 or null) if the stat doesn't exist on the user
                const userStatValue = competitiveStats[statToCheck] ?? null;

                 console.log(` -> Criteria: User '${statToCheck}' (${operator}) ${targetValue}. User has: ${userStatValue} (Type: ${typeof userStatValue})`); // Detailed log

                 // Ensure userStatValue is not null for comparison, unless maybe '==' check allows null?
                 if (userStatValue !== null) {
                     try {
                         // Perform comparison based on operator
                        switch (operator) {
                            case '>=': criteriaMet = Number(userStatValue) >= Number(targetValue); break;
                            case '==': criteriaMet = String(userStatValue) == String(targetValue); break; // Use loose equality for potential type differences? Or enforce type? String compare safer? Number() safer? Let's try number
                            // case '==': criteriaMet = Number(userStatValue) == Number(targetValue); break; // Alternative: strict number comparison
                            case '>': criteriaMet = Number(userStatValue) > Number(targetValue); break;
                            case '<=': criteriaMet = Number(userStatValue) <= Number(targetValue); break;
                            case '<': criteriaMet = Number(userStatValue) < Number(targetValue); break;
                            case '!=': criteriaMet = String(userStatValue) != String(targetValue); break;
                            // case '!=': criteriaMet = Number(userStatValue) != Number(targetValue); break; // Alternative number comparison
                            default: console.warn(` -> Unsupported operator: ${operator}. Cannot evaluate criteria.`);
                        }
                     } catch (compareError) {
                          console.warn(` -> Error during criteria comparison (${statToCheck} ${operator} ${targetValue} vs ${userStatValue}):`, compareError);
                          criteriaMet = false; // Fail safe
                     }

                } else {
                    console.log(` -> User stat '${statToCheck}' is null or undefined. Criteria cannot be met.`);
                    criteriaMet = false;
                }
                console.log(` -> Comparison result: ${criteriaMet}`);

            }
            // --- Add more complex criteria checks here (e.g., multiple stats, specific actions) ---
            else {
                 console.warn(` -> Achievement ${achievementId} has invalid or incomplete criteria definition.`);
            }


            // 4. Process If Criteria Met
            if (criteriaMet) {
                console.log(`%c -> CRITERIA MET for [${achievementId}] ${achievement.name || ''}!`, 'color: green; font-weight:bold;');
                newAchievementsUnlocked.push(achievementId); // Add to list for batch update
                needsDbUpdate = true; // Flag that we need to write to Firestore

                // Collect rewards
                if (achievement.rewards?.title) {
                    console.log(`   -> Granting Title reward: "${achievement.rewards.title}"`);
                    rewardsToApply.titles.push(achievement.rewards.title);
                }
                if (achievement.rewards?.rank) {
                     console.log(`   -> Granting Rank reward: "${achievement.rewards.rank}"`);
                    // TODO: Add logic here if ranks have hierarchy (e.g., only grant if HIGHER than current rank)
                    // For now, last rank processed wins if multiple granted simultaneously.
                    rewardsToApply.rank = achievement.rewards.rank;
                }
            }
        } // End loop through allAchievements

        // 5. Perform Firestore Batch Write if Needed
        if (needsDbUpdate && newAchievementsUnlocked.length > 0) {
            console.log(`%cUnlocking ${newAchievementsUnlocked.length} new achievement(s) in Firestore:`, 'color: purple', newAchievementsUnlocked);
            console.log("Applying Rewards to User Profile:", rewardsToApply);

            const batch = db.batch();
            const userProfileRef = db.collection('users').doc(userId);

            // A: Update the list of unlocked achievements
            batch.set(userAchievementsRef, { unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsUnlocked) }, { merge: true });
            console.log("Batch task 1: Update userAchievements/unlocked array.");

            // B: Prepare updates for the user's profile based on collected rewards
            const profileUpdateData = {};
            let updatedLocalProfile = { ...currentUserProfile }; // Clone profile to reflect immediate changes

            // Apply Title Rewards
            if (rewardsToApply.titles.length > 0) {
                // Use arrayUnion to add new titles without duplicates
                profileUpdateData.availableTitles = firebase.firestore.FieldValue.arrayUnion(...rewardsToApply.titles);
                // Update local copy immediately for return value
                updatedLocalProfile.availableTitles = [...new Set([...(updatedLocalProfile.availableTitles || []), ...rewardsToApply.titles])];
                console.log("Updated local profile availableTitles:", updatedLocalProfile.availableTitles);

                // Auto-equip first *new* title if none is currently equipped
                if (!updatedLocalProfile.equippedTitle && rewardsToApply.titles[0]) {
                    console.log(`Auto-equipping title: "${rewardsToApply.titles[0]}"`);
                    profileUpdateData.equippedTitle = rewardsToApply.titles[0];
                    updatedLocalProfile.equippedTitle = rewardsToApply.titles[0];
                }
            }
             // Apply Rank Reward (consider hierarchy later if needed)
            if (rewardsToApply.rank) {
                 console.log(`Applying rank "${rewardsToApply.rank}" to profile.`);
                 profileUpdateData.currentRank = rewardsToApply.rank;
                 updatedLocalProfile.currentRank = rewardsToApply.rank;
                 console.log("Updated local profile currentRank:", updatedLocalProfile.currentRank);
            }

            // C: Add profile updates to the batch if there are any
            if (Object.keys(profileUpdateData).length > 0) {
                console.log("Batch task 2: Update users document with:", profileUpdateData);
                batch.update(userProfileRef, profileUpdateData);
            } else {
                 console.log("No direct profile updates needed (only userAchievements update).");
            }

            // D: Commit the batch
            await batch.commit();
            console.log(`%cFirestore batch committed successfully for UID ${userId}. Achievements & profile updated.`, 'color: green; font-weight: bold;');

            // Return the potentially modified profile object so the UI can update immediately
            return updatedLocalProfile;

        } else {
            console.log(`No new achievements met criteria or needed unlocking for UID ${userId}.`);
            return null; // No changes were made to the profile
        }

    } catch (error) {
        console.error(`%c--- ERROR in checkAndGrantAchievements for UID ${userId} ---`, 'color: red; font-weight:bold;', error);
        if (error.stack) console.error("Full error stack:", error.stack);
        return null; // Return null on error
    } finally {
        console.log('%c--- Finished Achievement Check ---', 'color: purple; font-weight: bold;');
    }
}


// =============================================================================
// --- UI Display Helpers (Badges, Rank/Title Selector) ---
// =============================================================================
// (displayUserBadges, updateProfileTitlesAndRank, handleTitleClick, openTitleSelector,
// closeTitleSelector, handleClickOutsideTitleSelector, handleTitleOptionClick functions
// should be OK - no changes needed here for Kills or Rank/Title logic itself)
function displayUserBadges(profileData) { /* ... unchanged ... */ }
function updateProfileTitlesAndRank(profileData, allowInteraction) { /* ... unchanged ... */ }
function handleTitleClick(event) { /* ... unchanged ... */ }
function openTitleSelector() { /* ... unchanged ... */ }
function closeTitleSelector() { /* ... unchanged ... */ }
function handleClickOutsideTitleSelector(event) { /* ... unchanged ... */ }
async function handleTitleOptionClick(event) { /* ... unchanged ... */ }


// =============================================================================
// --- Profile Picture Editing Functions ---
// =============================================================================
// (setupProfilePicEditing, handleFileSelect, openEditModal, closeEditModal,
// handleApplyCrop, uploadToCloudinary, saveProfilePictureUrl functions are unchanged)
function setupProfilePicEditing() { /* ... unchanged ... */ }
function handleFileSelect(event) { /* ... unchanged ... */ }
function openEditModal() { /* ... unchanged ... */ }
function closeEditModal() { /* ... unchanged ... */ }
async function handleApplyCrop() { /* ... unchanged ... */ }
async function uploadToCloudinary(blob) { /* ... unchanged ... */ }
async function saveProfilePictureUrl(userId, imageUrl) { /* ... unchanged ... */ }

// =============================================================================
// --- Authentication and Initialization ---
// =============================================================================
auth.onAuthStateChanged(async user => { // Added async for await inside
    console.log('%c--- Auth State Changed ---', 'color: green; font-weight: bold;');
    loggedInUser = user; // Update global state FIRST

    const targetUid = profileUidFromUrl || loggedInUser?.uid;
    console.log(`Auth user: ${user ? user.uid : 'null'}. Target profile UID: ${targetUid}`);

    // *** Set isOwnProfile definitively HERE ***
    isOwnProfile = loggedInUser && targetUid === loggedInUser.uid;
    console.log(`Is viewing own profile? ${isOwnProfile}`);

    if (targetUid) {
        // A user is logged in OR a specific profile UID is requested
        loadingIndicator.style.display = 'none';
        notLoggedInMsg.style.display = 'none';
        profileContent.style.display = 'block';

        // Ensure achievement definitions are loaded *before* user data load,
        // as user data load might trigger the check that needs them.
        if (!allAchievements) {
            console.log("Fetching achievement definitions required before loading user data...");
            await fetchAllAchievements(); // Wait for achievements before proceeding
        }

        // Now load user data (which might trigger achievement check inside it)
        loadCombinedUserData(targetUid)
            .then(() => {
                console.log("loadCombinedUserData promise resolved. Setting up profile-specific interactions.");
                // Setup interactions *after* data has been fully loaded and initially displayed
                if (isOwnProfile) {
                    // Ensure profile pic editing is enabled only for the owner
                    setupProfilePicEditing();
                     profileLogoutBtn.style.display = 'inline-block'; // Show logout for owner
                } else {
                    // Ensure edit icon and logout are hidden if not the owner
                    if(editProfilePicIcon) editProfilePicIcon.style.display = 'none';
                    profileLogoutBtn.style.display = 'none'; // Hide logout if not owner
                }
                // Rank/Title interaction is handled by updateProfileTitlesAndRank within loadCombinedUserData/displayProfileData
            })
            .catch(err => {
                // This catch handles errors from loadCombinedUserData or subsequent .then() block
                console.error("%cError during loadCombinedUserData or subsequent setup:", 'color:red', err);
                // UI might already be in an error state handled inside loadCombinedUserData
            });

    } else {
        // No user logged in AND no UID in URL
        console.log('No user logged in and no profile UID in URL.');
        loadingIndicator.style.display = 'none';
        profileContent.style.display = 'none';
        notLoggedInMsg.style.display = 'flex';
        notLoggedInMsg.textContent = 'Please log in to view your profile, or provide a user ID in the URL (e.g., ?uid=USER_ID).';

        // Reset UI elements
        adminTag.style.display = 'none';
        profileBadgesContainer.innerHTML = '';
        profileLogoutBtn.style.display = 'none';
        if(editProfilePicIcon) editProfilePicIcon.style.display = 'none';
        updateProfileTitlesAndRank(null, false);
        competitiveStatsDisplay.innerHTML = '';
        displayPoxelStats(null);
        updateProfileBackground(null);
        viewingUserProfileData = {}; // Clear global data
        closeTitleSelector(); closeEditModal();
    }
    console.log('%c--- Finished Auth State Change Handling ---', 'color: green; font-weight: bold;');
});

// --- Logout Button Event Listener ---
// (No changes needed here)
profileLogoutBtn.addEventListener('click', () => { /* ... unchanged ... */ });


// =============================================================================
// --- Local Storage Caching ---
// =============================================================================
// (loadCombinedDataFromCache and saveCombinedDataToCache are likely okay)
function loadCombinedDataFromCache(viewedUserId) { /* ... unchanged ... */ }
function saveCombinedDataToCache(viewedUserId, combinedData) { /* ... unchanged ... */ }

// --- Initial Log ---
console.log("Profile script initialized. Waiting for Auth state...");
