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
// Achievement Section Elements (UPDATED)
const achievementsListContainer = document.getElementById('achievements-list-container');
const achievementsSectionOuter = document.getElementById('achievements-section-outer'); // NEW reference to the wrapper


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
             headers: { "Content-Type": "application/json" }
        });

        if (!res.ok) {
            let errorMsg = `HTTP error ${res.status}`;
             if (res.status === 404) { errorMsg = "User not found on Poxel.io"; }
             else { try { const errorData = await res.json(); errorMsg = errorData.message || errorData.error || errorMsg; } catch (parseError) { /* Ignore */ } }
            throw new Error(errorMsg);
        }

        const data = await res.json();
        if (typeof data !== 'object' || data === null) throw new Error("Invalid data format received from Poxel.io API.");
        if (data.error || data.status === 'error') {
            if (data.message && data.message.toLowerCase().includes('not found')) throw new Error('User not found on Poxel.io');
            throw new Error(data.message || 'Poxel.io API returned an error status.');
        }
        return data;
    } catch (e) { console.error("Error fetching Poxel.io stats:", e.message || e); return null; }
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
    const statKeys = ['wins', 'points', 'kdRatio', 'matchesPlayed', 'matches', 'losses', 'kills']; // Ensure 'kills' is checked
    let different = false;
    for (const key of statKeys) {
        let newValue = normNew[key];
        let existingValue = normExisting[key];
        if(key === 'matchesPlayed' && !normNew.hasOwnProperty('matchesPlayed') && normNew.hasOwnProperty('matches')) newValue = normNew.matches;
        if(key === 'matchesPlayed' && !normExisting.hasOwnProperty('matchesPlayed') && normExisting.hasOwnProperty('matches')) existingValue = normExisting.matches;
        newValue = newValue ?? null; existingValue = existingValue ?? null;
        if (key === 'kdRatio' && typeof newValue === 'number' && typeof existingValue === 'number') { if (Math.abs(newValue - existingValue) > 0.001) { different = true; break; } }
        else if (newValue !== existingValue) { different = true; break; }
    }
    if (!different) {
        const newRelevantKeys = Object.keys(normNew).filter(k => statKeys.includes(k) || (k === 'matches' && statKeys.includes('matchesPlayed')));
        const existingRelevantKeys = Object.keys(normExisting).filter(k => statKeys.includes(k)|| (k === 'matches' && statKeys.includes('matchesPlayed')));
        if (newRelevantKeys.length !== existingRelevantKeys.length) { different = true; }
        else { const newSet = new Set(newRelevantKeys); if (!existingRelevantKeys.every(key => newSet.has(key))) { different = true; } }
    }
    return different;
}

// --- Helper Function: Client-Side User Profile Document Creation ---
async function createUserProfileDocument(userId, authUser) {
    if (!userId || !authUser) { console.error("Cannot create profile: userId or authUser missing."); return null; }
    console.warn(`Client-side: Creating missing user profile doc for UID: ${userId}`);
    const userDocRef = db.collection("users").doc(userId);
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;
    const defaultProfileData = { email: authUser.email ? authUser.email.toLowerCase() : null, displayName: displayName, currentRank: "Unranked", equippedTitle: "", availableTitles: [], friends: {}, createdAt: firebase.firestore.FieldValue.serverTimestamp(), leaderboardStats: {}, profilePictureUrl: authUser.photoURL || null, poxelStats: {} };
    try { await userDocRef.set(defaultProfileData, { merge: false }); console.log(`Successfully created user profile document for UID: ${userId} via client`); return { id: userId, ...defaultProfileData, createdAt: new Date() }; }
    catch (error) { console.error(`Error creating user profile document client-side for UID ${userId}:`, error); return null; }
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
    if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none'; // Hide OUTER achievements section wrapper
    if (achievementsListContainer) achievementsListContainer.innerHTML = '<p class="list-message">Loading achievements...</p>'; // Reset inner list content

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
                 viewerProfileData = await createUserProfileDocument(loggedInUser.uid, loggedInUser); // Attempt creation
                 if (!viewerProfileData) viewerProfileData = { id: loggedInUser.uid, friends: {} }; // Fallback empty map
            }
        } catch (viewerError) { console.error("Error fetching viewing user's profile data:", viewerError); viewerProfileData = { id: loggedInUser.uid, friends: {} }; }
    } // `else if (isOwnProfile)` handled later after profile fetch

    // --- Fetch Firestore Data ---
    const userProfileRef = db.collection('users').doc(targetUserId);
    const leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId);
    let userUnlockedAchievementIds = []; // Hold unlocked achievement IDs for owner

    try {
        // Fetch unlocked achievements IF viewing own profile (do early)
        if (isOwnProfile) userUnlockedAchievementIds = await fetchUserUnlockedAchievements(targetUserId);

        // 1. Fetch Target User Profile Data
        let profileSnap = await userProfileRef.get();
        let profileData = null;
        if (!profileSnap || !profileSnap.exists) {
            console.warn(`User profile document does NOT exist for UID: ${targetUserId}`);
            if (isOwnProfile && loggedInUser) { profileData = await createUserProfileDocument(targetUserId, loggedInUser); if (!profileData) throw new Error(`Profile creation failed.`); }
            else { throw new Error(`Profile not found.`); }
        } else {
            profileData = { id: profileSnap.id, ...profileSnap.data() };
            // Ensure essential fields and correct case
            if (profileData.leaderboardStats === undefined) profileData.leaderboardStats = {};
            if (profileData.profilePictureUrl === undefined) profileData.profilePictureUrl = null;
            if (profileData.friends === undefined) profileData.friends = {};
            if (profileData.email) profileData.email = profileData.email.toLowerCase();
        }

        // If viewing own profile, set viewerProfileData now
        if (isOwnProfile) { viewerProfileData = profileData; if (!viewerProfileData.friends) viewerProfileData.friends = {}; }

        // 2. Fetch Leaderboard Stats Data (Competitive)
        let competitiveStatsData = null;
        if(profileData) { const statsSnap = await leaderboardStatsRef.get(); competitiveStatsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null; }

        // 3. Sync Competitive Stats to Profile Document if needed
        if (profileData && competitiveStatsData && areStatsDifferent(competitiveStatsData, profileData.leaderboardStats)) {
            console.log(`Competitive stats for UID ${targetUserId} differ. Syncing to 'users' doc.`);
            try { const statsToSave = { ...competitiveStatsData }; delete statsToSave.id; await userProfileRef.update({ leaderboardStats: statsToSave }); profileData.leaderboardStats = statsToSave; console.log("'users' doc synced with leaderboard stats."); }
            catch (updateError) { console.error(`Error syncing competitive stats to 'users' doc:`, updateError); }
        }

        // 4. Update Global State for the viewed profile
        viewingUserProfileData = { profile: profileData, stats: competitiveStatsData };

        // 5. Display Core Profile & Competitive Stats, Cache
        displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats, isOwnProfile);
        saveCombinedDataToCache(targetUserId, viewingUserProfileData); // Cache fetched data

        // 6. Display Friendship Controls or Friends Section
        if (loggedInUser) {
            if (isOwnProfile) displayFriendsSection(profileData);
            else if (viewerProfileData) { const status = determineFriendshipStatus(loggedInUser.uid, targetUserId); displayFriendshipControls(status, targetUserId); }
        }

        // 7. Fetch and Display Poxel.io Stats
        if (profileData && profileData.displayName) {
             if(poxelStatsSection) poxelStatsSection.style.display = 'block';
             fetchPoxelStats(profileData.displayName)
                .then(poxelStatsData => displayPoxelStats(poxelStatsData))
                .catch(poxelError => displayPoxelStats(null, poxelError.message || 'Error loading Poxel stats.'));
        } else { displayPoxelStats(null, 'Poxel username not found.'); }

        // 8. Display Achievements Section (IF owner)
        if (isOwnProfile) { if (!allAchievements) await fetchAllAchievements(); await displayAchievementsSection(viewingUserProfileData.stats, userUnlockedAchievementIds); }
        else { if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none'; } // Ensure hidden if not owner

        // 9. Check and Grant Achievements (only if owner and has competitive stats)
        if (isOwnProfile && viewingUserProfileData.stats) {
            if (!allAchievements) await fetchAllAchievements();
            if (allAchievements) {
                const potentiallyUpdatedProfile = await checkAndGrantAchievements( targetUserId, viewingUserProfileData.profile, viewingUserProfileData.stats );
                if (potentiallyUpdatedProfile) {
                    console.log("Profile updated by achievement grant. Refreshing UI.");
                    viewingUserProfileData.profile = potentiallyUpdatedProfile; viewerProfileData = potentiallyUpdatedProfile; // Update both
                    displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats, isOwnProfile); // Re-render core profile
                    saveCombinedDataToCache(targetUserId, viewingUserProfileData); // Re-cache
                    const latestUnlockedIds = await fetchUserUnlockedAchievements(targetUserId); // Re-fetch unlocked status
                    await displayAchievementsSection(viewingUserProfileData.stats, latestUnlockedIds); // Refresh achievement display
                    displayFriendsSection(viewingUserProfileData.profile); // Refresh friends section (rank might affect display?)
                }
            }
        }

    } catch (error) {
        console.error(`Error loading combined data for UID ${targetUserId}:`, error);
        const errorMessage = error.message === 'Profile not found.' ? 'Profile not found.' : 'Error loading profile data.';
        viewingUserProfileData = { profile: null, stats: null }; // Mark as failed load
        if (!cacheLoaded) { // If nothing from cache shown, display main error
             if (profileContent) profileContent.style.display = 'none';
             if (notLoggedInMsg) { notLoggedInMsg.textContent = errorMessage; notLoggedInMsg.style.display = 'flex'; }
             updateProfileTitlesAndRank(null, false); // Reset display
             if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = '<p class="list-message">Error loading stats.</p>';
             if (poxelStatsSection) poxelStatsSection.style.display = 'none';
             if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none';
             clearFriendshipControls(); resetFriendsSection();
        } else { // Cache was shown, just log the error, keep cached view
            console.warn("Error fetching latest data, displaying potentially stale cache.");
            // Optionally show a small error banner instead of replacing content
             if (notLoggedInMsg) { notLoggedInMsg.textContent = 'Could not fetch latest updates.'; notLoggedInMsg.style.display = 'block'; notLoggedInMsg.style.textAlign='center'; notLoggedInMsg.style.color='orange'; setTimeout(()=>notLoggedInMsg.style.display='none', 4000)} // Temporary warning
             // Try Poxel fetch based on cached name
             if (viewingUserProfileData.profile?.displayName) {
                 if(poxelStatsSection && poxelStatsSection.style.display !== 'block') poxelStatsSection.style.display = 'block';
                 fetchPoxelStats(viewingUserProfileData.profile.displayName)
                     .then(poxelStatsData => displayPoxelStats(poxelStatsData))
                     .catch(e => displayPoxelStats(null, e.message || 'Error loading Poxel stats.'));
              } else { displayPoxelStats(null, 'Poxel username not found.'); }
              // Show cached achievements if owner
              if(isOwnProfile && achievementsSectionOuter){
                  if(achievementsListContainer && !achievementsListContainer.hasChildNodes()) achievementsListContainer.innerHTML = '<p class="list-message">Showing cached achievements. Could not fetch latest.</p>';
                   achievementsSectionOuter.style.display = 'block';
                  // Optionally re-render achievements using cached data - displayAchievementsSection(...)
              }
        }
    } finally {
         if (loadingIndicator) loadingIndicator.style.display = 'none';
         // Show profile content ONLY if profile data exists (either from cache or fresh)
         if (viewingUserProfileData.profile) { if (profileContent) profileContent.style.display = 'block'; }
         else if (!cacheLoaded && !viewingUserProfileData.profile) { /* Error message already displayed if !cacheLoaded & profile null */ }
    }
} // --- End loadCombinedUserData ---

// --- Display Core Profile Data ---
function displayProfileData(profileData, competitiveStatsData, isOwner) {
     if (!profileContent) { console.error("Profile content container not found."); return; }
     profileContent.style.display = 'block';
     if (!profileData) {
        console.error("displayProfileData called with null profileData."); profileContent.style.display = 'none';
        if (notLoggedInMsg) { notLoggedInMsg.textContent = 'Profile data unavailable.'; notLoggedInMsg.style.display = 'flex'; }
        return;
    }
    const displayName = profileData.displayName || 'Anonymous User';
    usernameDisplay.textContent = displayName;
    if (profileData.profilePictureUrl) {
        profileImage.src = profileData.profilePictureUrl; profileImage.style.display = 'block'; profileInitials.style.display = 'none';
        profileImage.onerror = () => { console.error("Failed to load PFP:", profileData.profilePictureUrl); profileImage.style.display = 'none'; profileInitials.textContent = displayName?.charAt(0)?.toUpperCase() || '?'; profileInitials.style.display = 'flex'; updateProfileBackground(null); };
        profileImage.onload = () => { updateProfileBackground(profileData.profilePictureUrl); }; // Update background on load
    } else { profileImage.style.display = 'none'; profileImage.src = ''; profileInitials.textContent = displayName?.charAt(0)?.toUpperCase() || '?'; profileInitials.style.display = 'flex'; updateProfileBackground(null); }
    if(editProfilePicIcon) editProfilePicIcon.style.display = isOwner ? 'flex' : 'none';
    displayUserBadges(profileData); updateProfileTitlesAndRank(profileData, isOwner); displayCompetitiveStats(competitiveStatsData);
    if (isOwner) setupProfilePicEditing();
}

// --- Update Profile Background ---
function updateProfileBackground(imageUrl) { if (!profileContent) return; if (imageUrl) { profileContent.style.setProperty('--profile-bg-image', `url('${imageUrl}')`); profileContent.classList.add('has-background'); } else { profileContent.style.removeProperty('--profile-bg-image'); profileContent.classList.remove('has-background'); }}

// --- Display COMPETITIVE Stats Grid ---
function displayCompetitiveStats(statsData) {
    if (!competitiveStatsDisplay) return; competitiveStatsDisplay.innerHTML = '';
    if (!statsData || typeof statsData !== 'object' || Object.keys(statsData).length === 0) { competitiveStatsDisplay.innerHTML = '<p class="list-message">Competitive stats unavailable.</p>'; return; }
    const statsMap = { wins: 'Wins', points: 'Points', kdRatio: 'K/D Ratio', matchesPlayed: 'Matches Played', losses: 'Losses', kills: 'Kills'};
    if (!statsData.hasOwnProperty('matchesPlayed') && statsData.hasOwnProperty('matches')) { statsMap.matches = 'Matches Played'; delete statsMap.matchesPlayed; }
    let statsAdded = 0; for (const key in statsMap) { if (statsData.hasOwnProperty(key)) { let value = statsData[key]; let displayValue = value; if (key === 'kdRatio' && typeof value === 'number') displayValue = value.toFixed(2); else if (value === null || value === undefined) displayValue = '-'; competitiveStatsDisplay.appendChild(createStatItem(statsMap[key], displayValue)); statsAdded++; } }
    if (statsAdded === 0) competitiveStatsDisplay.innerHTML = '<p class="list-message">No competitive stats found.</p>';
}

// --- Display Poxel.io Stats Grid ---
function displayPoxelStats(poxelData, message = null) {
    if (!poxelStatsDisplay || !poxelStatsSection) return; poxelStatsDisplay.innerHTML = ''; poxelStatsSection.style.display = 'block';
    if (message) { poxelStatsDisplay.innerHTML = `<p class="list-message">${message}</p>`; return; }
    if (!poxelData || typeof poxelData !== 'object' || Object.keys(poxelData).length === 0) { poxelStatsDisplay.innerHTML = '<p class="list-message">Poxel.io stats unavailable.</p>'; return; }
    const statsMap = { kills: 'Kills', deaths: 'Deaths', wins: 'Wins', losses: 'Losses', level: 'Level', playtimeHours: 'Playtime (Hours)', gamesPlayed: 'Games Played' }; let statsAdded = 0;
    for (const key in statsMap) { if (poxelData.hasOwnProperty(key) && poxelData[key] !== null && poxelData[key] !== undefined) { let value = poxelData[key]; if (key === 'playtimeHours' && typeof value === 'number') value = value.toFixed(1); poxelStatsDisplay.appendChild(createStatItem(statsMap[key], value)); statsAdded++; } }
    if (poxelData.hasOwnProperty('kills') && poxelData.hasOwnProperty('deaths') && poxelData.deaths !== null && poxelData.kills !== null) { const kills = Number(poxelData.kills) || 0; const deaths = Number(poxelData.deaths) || 0; const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2); poxelStatsDisplay.appendChild(createStatItem('Poxel K/D', kd)); statsAdded++; }
    if (statsAdded === 0) poxelStatsDisplay.innerHTML = '<p class="list-message">No relevant Poxel.io stats found.</p>';
}

// --- Helper: Create a Single Stat Item Element ---
function createStatItem(title, value) { const itemDiv = document.createElement('div'); itemDiv.classList.add('stat-item'); const titleH4 = document.createElement('h4'); titleH4.textContent = title; const valueP = document.createElement('p'); valueP.textContent = (value !== null && value !== undefined) ? value : '-'; itemDiv.appendChild(titleH4); itemDiv.appendChild(valueP); return itemDiv; }

// --- Helper: Fetch User's Unlocked Achievements ---
async function fetchUserUnlockedAchievements(userId) { if (!userId) return []; try { const doc = await db.collection('userAchievements').doc(userId).get(); return doc.exists ? (doc.data()?.unlocked || []) : []; } catch (error) { console.error(`Error fetching unlocked achievements for ${userId}:`, error); return []; }}

// --- Helper: Calculate Achievement Progress Percentage ---
function calculateAchievementProgress(achievement, userStats) {
     const criteria = achievement?.criteria || {}; const targetValue = criteria.value || 0; const operator = criteria.operator || '>='; const statKey = criteria.stat;
    if (userStats === null || userStats === undefined || !statKey) { const meetsCriteria = operator === '>=' && (0 >= targetValue); return { progress: 0, currentValue: 0, targetValue, meetsCriteria }; }
    let currentValue = userStats[statKey]; if(statKey === 'matchesPlayed' && !userStats.hasOwnProperty('matchesPlayed') && userStats.hasOwnProperty('matches')) currentValue = userStats.matches; currentValue = Number(currentValue) || 0; if (statKey === 'kdRatio' && typeof currentValue === 'number') currentValue = parseFloat(currentValue.toFixed(2));
    if (targetValue <= 0) { const meetsCriteria = operator === '>=' ? currentValue >= targetValue : operator === '==' ? currentValue == targetValue : false; return { progress: (meetsCriteria ? 100 : 0), currentValue, targetValue, meetsCriteria }; }
    let progressPercent = 0; let meetsCriteria = false; switch (operator) { case '>=': meetsCriteria = currentValue >= targetValue; progressPercent = (currentValue / targetValue) * 100; break; case '==': meetsCriteria = currentValue == targetValue; progressPercent = meetsCriteria ? 100 : 0; break; default: console.warn(`Unsupported achievement operator: ${operator}`); meetsCriteria = false; progressPercent = 0; break; }
    progressPercent = Math.max(0, Math.min(100, progressPercent)); return { progress: Math.floor(progressPercent), currentValue, targetValue, meetsCriteria };
}

// --- Display Achievements Section (Uses Outer Wrapper for visibility) ---
async function displayAchievementsSection(competitiveStats, unlockedAchievementIds) {
    if (!achievementsSectionOuter || !achievementsListContainer) { console.error("Achievement section elements missing."); return; }
    if (!isOwnProfile) { achievementsSectionOuter.style.display = 'none'; return; }
    if (!allAchievements) { await fetchAllAchievements(); if (!allAchievements) { console.error("Failed to load achievement definitions."); achievementsListContainer.innerHTML = '<p class="list-message">Could not load achievement definitions.</p>'; achievementsSectionOuter.style.display = 'block'; return; }}
    achievementsListContainer.innerHTML = ''; achievementsSectionOuter.style.display = 'block'; const achievementIds = Object.keys(allAchievements || {}); if (achievementIds.length === 0) { achievementsListContainer.innerHTML = '<p class="list-message">No achievements defined yet.</p>'; return; }
    console.log(`Displaying ${achievementIds.length} achievements.`); achievementIds.forEach(id => { const ach = allAchievements[id]; if (!ach || !ach.name || !ach.criteria) { console.warn(`Skipping invalid achievement data for ID: ${id}`, ach); return; }
        const isUnlocked = unlockedAchievementIds?.includes(id) || false; const progInfo = calculateAchievementProgress(ach, competitiveStats); const isDisplayCompleted = isUnlocked || progInfo.meetsCriteria; const itemDiv = document.createElement('div'); itemDiv.classList.add('achievement-item'); if (isUnlocked) itemDiv.classList.add('achievement-unlocked'); if (isDisplayCompleted) itemDiv.classList.add('achievement-completed'); let rewardsHtml = ''; if (ach.rewards) { const parts = []; if (ach.rewards.title) parts.push(`Title: <strong>${ach.rewards.title}</strong>`); if (ach.rewards.rank) parts.push(`Rank: <strong>${ach.rewards.rank}</strong>`); if (parts.length > 0) rewardsHtml = `<div class="achievement-rewards">Reward${parts.length > 1 ? 's': ''}: ${parts.join(', ')}</div>`; }
        let progressText = `${progInfo.progress}%`; let progressBarTitle = 'Progress'; const isNumericProg = ach.criteria.stat && typeof ach.criteria.value === 'number' && ach.criteria.value > 0 && ach.criteria.operator === '>='; if (isDisplayCompleted) { progressText = "Completed"; progressBarTitle = isNumericProg ? `${ach.criteria.stat}: ${progInfo.currentValue} / ${progInfo.targetValue} (Completed)` : "Completed"; } else if (isNumericProg) { progressText = `${progInfo.currentValue} / ${progInfo.targetValue} (${progInfo.progress}%)`; progressBarTitle = `${ach.criteria.stat}: ${progInfo.currentValue} / ${progInfo.targetValue}`; } else { progressBarTitle = ach.criteria.stat ? `${ach.criteria.stat} Progress` : 'Progress'; }
        itemDiv.innerHTML = `<h4><span>${ach.name}</span>${isDisplayCompleted ? '<span class="completion-icon" title="Completed!">✔</span>' : ''}</h4><p class="achievement-description">${ach.description || 'No description available.'}</p>${ach.criteria.stat && ach.criteria.value !== undefined ? `<div class="achievement-progress-container" title="${progressBarTitle}"><div class="achievement-progress-bar" style="width: ${progInfo.progress}%;"><span>${progressText}</span></div></div>` : '<div style="height: 5px;"></div>'}${rewardsHtml}`; achievementsListContainer.appendChild(itemDiv); });
    if (achievementsListContainer.childElementCount === 0 && achievementIds.length > 0) { console.warn("Achievement list empty after processing IDs."); achievementsListContainer.innerHTML = '<p class="list-message">Could not display achievements.</p>'; }
}

// --- Check and Grant Achievements ---
async function checkAndGrantAchievements(userId, currentUserProfile, competitiveStats) {
    if (!allAchievements || !userId || !currentUserProfile || !competitiveStats || typeof competitiveStats !== 'object') { console.log("Skipping achievement check: Missing data."); return null; }
    console.log(`Checking achievements for UID ${userId}...`); let profileToUpdate = { ...currentUserProfile, availableTitles: currentUserProfile.availableTitles || [], equippedTitle: currentUserProfile.equippedTitle ?? "", currentRank: currentUserProfile.currentRank || "Unranked", friends: currentUserProfile.friends || {}, leaderboardStats: currentUserProfile.leaderboardStats || {}, }; let unlockedIds = []; try { const doc = await db.collection('userAchievements').doc(userId).get(); if (doc.exists) unlockedIds = doc.data()?.unlocked || []; } catch (fetchError) { console.error("Error fetching unlocked achievements, assuming none:", fetchError); }
    let newAchievementsUnlocked = []; let needsProfileUpdate = false; let needsUserAchievementsUpdate = false; let bestRankReward = null; const rankOrder = ["Unranked", "Bronze", "Silver", "Gold", "Platinum", "Veteran", "Legend"];
    for (const achievementId in allAchievements) { if (unlockedIds.includes(achievementId)) continue; const achievement = allAchievements[achievementId]; if (!achievement?.criteria) continue; const progressInfo = calculateAchievementProgress(achievement, competitiveStats); if (progressInfo.meetsCriteria) { console.log(`Criteria MET for: ${achievement.name || achievementId}`); if (!newAchievementsUnlocked.includes(achievementId)) { newAchievementsUnlocked.push(achievementId); needsUserAchievementsUpdate = true; } if (achievement.rewards) { if (achievement.rewards.title && !profileToUpdate.availableTitles.includes(achievement.rewards.title)) { profileToUpdate.availableTitles.push(achievement.rewards.title); needsProfileUpdate = true; console.log(`- Added title: ${achievement.rewards.title}`); if (profileToUpdate.equippedTitle === "") { profileToUpdate.equippedTitle = achievement.rewards.title; console.log(`- Auto-equipped: ${achievement.rewards.title}`); } } if (achievement.rewards.rank) { const curIdx = rankOrder.indexOf(profileToUpdate.currentRank); const newIdx = rankOrder.indexOf(achievement.rewards.rank); const bestRewardIdx = bestRankReward ? rankOrder.indexOf(bestRankReward) : -1; if (newIdx > Math.max(curIdx, bestRewardIdx)) { bestRankReward = achievement.rewards.rank; needsProfileUpdate = true; } } } } }
    if (bestRankReward) { const curIdx = rankOrder.indexOf(profileToUpdate.currentRank); const bestRewardIdx = rankOrder.indexOf(bestRankReward); if (bestRewardIdx > curIdx) { profileToUpdate.currentRank = bestRankReward; console.log(`Updating profile rank to: ${bestRankReward}`); } }
    if (needsProfileUpdate || needsUserAchievementsUpdate) { console.log(`Needs Firestore update. Profile: ${needsProfileUpdate}, UserAch: ${needsUserAchievementsUpdate}`); const batch = db.batch(); const userProfileRef = db.collection('users').doc(userId); const userAchievementsRef = db.collection('userAchievements').doc(userId);
        if (needsUserAchievementsUpdate && newAchievementsUnlocked.length > 0) { batch.set(userAchievementsRef, { unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsUnlocked) }, { merge: true }); }
        if (needsProfileUpdate) { const updateData = {}; if (JSON.stringify(profileToUpdate.availableTitles) !== JSON.stringify(currentUserProfile.availableTitles || [])) updateData.availableTitles = profileToUpdate.availableTitles; if (profileToUpdate.equippedTitle !== (currentUserProfile.equippedTitle ?? "")) updateData.equippedTitle = profileToUpdate.equippedTitle; if (profileToUpdate.currentRank !== (currentUserProfile.currentRank || "Unranked")) updateData.currentRank = profileToUpdate.currentRank; if (Object.keys(updateData).length > 0) { console.log("Updating 'users' doc with:", updateData); batch.update(userProfileRef, updateData); } else { console.log("needsProfileUpdate flag set, but no actual change detected."); needsProfileUpdate = false; } }
        if (needsProfileUpdate || needsUserAchievementsUpdate) { await batch.commit(); console.log("Achievement Firestore batch committed."); return profileToUpdate; } else { console.log("No batch commit needed."); return null; }
    } else { /* console.log("No new achievements found."); */ return null; }
} // --- End checkAndGrantAchievements ---

// =============================================================================
// --- UI Display Helpers (Badges, Rank/Title Selector) ---
// =============================================================================
function displayUserBadges(profileData) { if (!profileBadgesContainer) return; profileBadgesContainer.innerHTML = ''; if (!adminTag) return; adminTag.style.display = 'none'; const userEmail = profileData?.email; if (!userEmail) return; if (adminEmails.includes(userEmail)) adminTag.style.display = 'inline-block'; for (const badgeType in badgeConfig) { const config = badgeConfig[badgeType]; if (config.emails.includes(userEmail)) { const badgeSpan = document.createElement('span'); badgeSpan.classList.add('profile-badge', config.className); badgeSpan.title = config.title; profileBadgesContainer.appendChild(badgeSpan); } }}
function updateProfileTitlesAndRank(profileData, allowInteraction) { if (!rankDisplay || !titleDisplay) return; titleDisplay.classList.remove('selectable-title', 'no-title-placeholder'); titleDisplay.removeEventListener('click', handleTitleClick); closeTitleSelector(); if (profileData && typeof profileData === 'object') { const rank = profileData.currentRank || 'Unranked'; const equippedTitle = profileData.equippedTitle || ''; const availableTitles = profileData.availableTitles || []; rankDisplay.textContent = rank; rankDisplay.className = `profile-rank-display rank-${rank.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`; if (allowInteraction && availableTitles.length > 0) { titleDisplay.classList.add('selectable-title'); titleDisplay.addEventListener('click', handleTitleClick); if (equippedTitle) { titleDisplay.textContent = equippedTitle; titleDisplay.classList.remove('no-title-placeholder'); titleDisplay.style.display = 'inline-block'; } else { titleDisplay.textContent = '[Choose Title]'; titleDisplay.classList.add('no-title-placeholder'); titleDisplay.style.display = 'inline-block'; } } else { if (equippedTitle) { titleDisplay.textContent = equippedTitle; titleDisplay.classList.remove('no-title-placeholder'); titleDisplay.style.display = 'inline-block'; } else { titleDisplay.textContent = ''; titleDisplay.style.display = 'none'; } } } else { rankDisplay.textContent = '...'; rankDisplay.className = 'profile-rank-display rank-unranked'; titleDisplay.textContent = ''; titleDisplay.style.display = 'none'; }}
function handleTitleClick(event) { event.stopPropagation(); if (!isOwnProfile || !viewingUserProfileData.profile || !(viewingUserProfileData.profile.availableTitles?.length > 0)) { console.log("Title interaction blocked."); return; } if (isTitleSelectorOpen) closeTitleSelector(); else openTitleSelector(); }
function openTitleSelector() { if (isTitleSelectorOpen || !profileIdentifiersDiv || !isOwnProfile || !viewingUserProfileData.profile?.availableTitles?.length > 0) return; const availableTitles = viewingUserProfileData.profile.availableTitles; const currentEquippedTitle = viewingUserProfileData.profile.equippedTitle || ''; if (!titleSelectorElement || !profileIdentifiersDiv.contains(titleSelectorElement)) { titleSelectorElement = document.createElement('div'); titleSelectorElement.className = 'title-selector'; profileIdentifiersDiv.appendChild(titleSelectorElement); } titleSelectorElement.innerHTML = ''; if (currentEquippedTitle) { const unequipOpt = document.createElement('button'); unequipOpt.className = 'title-option title-option-unequip'; unequipOpt.dataset.title = ""; unequipOpt.type = 'button'; unequipOpt.textContent = '[Remove Title]'; unequipOpt.onclick = handleTitleOptionClick; titleSelectorElement.appendChild(unequipOpt); } availableTitles.forEach(title => { const optEl = document.createElement('button'); optEl.className = 'title-option'; optEl.dataset.title = title; optEl.type = 'button'; optEl.textContent = title; if (title === currentEquippedTitle) { optEl.classList.add('currently-equipped'); optEl.disabled = true; } optEl.onclick = handleTitleOptionClick; titleSelectorElement.appendChild(optEl); }); titleSelectorElement.style.display = 'block'; isTitleSelectorOpen = true; setTimeout(() => { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }, 0); }
function closeTitleSelector() { if (!isTitleSelectorOpen || !titleSelectorElement) return; titleSelectorElement.style.display = 'none'; isTitleSelectorOpen = false; document.removeEventListener('click', handleClickOutsideTitleSelector, { capture: true }); }
function handleClickOutsideTitleSelector(event) { if (!isTitleSelectorOpen) return; const inside = titleSelectorElement?.contains(event.target); const onTitle = titleDisplay?.contains(event.target); if (!inside && !onTitle) closeTitleSelector(); else setTimeout(() => { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }, 0); }
async function handleTitleOptionClick(event) { event.stopPropagation(); const button = event.currentTarget; const selectedTitle = button.dataset.title; const userId = loggedInUser?.uid; if (!userId || !viewingUserProfileData.profile || viewingUserProfileData.profile.id !== userId) { console.error("Title change validation failed."); closeTitleSelector(); return; } const currentEquipped = viewingUserProfileData.profile.equippedTitle || ''; if (selectedTitle === currentEquipped) { closeTitleSelector(); return; } closeTitleSelector(); titleDisplay.classList.remove('selectable-title', 'no-title-placeholder'); titleDisplay.removeEventListener('click', handleTitleClick); titleDisplay.textContent = "Updating..."; try { const userRef = db.collection('users').doc(userId); await userRef.update({ equippedTitle: selectedTitle }); console.log(`Updated title to "${selectedTitle || 'None'}"`); viewingUserProfileData.profile.equippedTitle = selectedTitle; if(isOwnProfile && viewerProfileData) viewerProfileData.equippedTitle = selectedTitle; saveCombinedDataToCache(userId, viewingUserProfileData); updateProfileTitlesAndRank(viewingUserProfileData.profile, true); } catch (error) { console.error("Error updating title:", error); alert("Failed to update title."); if(viewingUserProfileData.profile) viewingUserProfileData.profile.equippedTitle = currentEquipped; updateProfileTitlesAndRank(viewingUserProfileData.profile, true); }}

// =============================================================================
// --- Profile Picture Editing Functions ---
// =============================================================================
function setupProfilePicEditing() { if (!isOwnProfile || !editProfilePicIcon || !profilePicInput) { if(editProfilePicIcon) editProfilePicIcon.style.display = 'none'; return; } editProfilePicIcon.style.display = 'flex'; editProfilePicIcon.onclick = null; profilePicInput.onchange = null; editProfilePicIcon.onclick = () => profilePicInput.click(); profilePicInput.onchange = handleFileSelect; }
function handleFileSelect(event) { const file = event.target?.files?.[0]; if (!file) { event.target.value = null; return; } if (!file.type.startsWith('image/')) { alert('Please select a valid image file (PNG, JPG, GIF).'); event.target.value = null; return; } const maxSizeMB = 5; if (file.size > maxSizeMB * 1024 * 1024) { alert(`File size exceeds ${maxSizeMB}MB.`); event.target.value = null; return; } const reader = new FileReader(); reader.onload = (e) => { if (e.target?.result) { modalImage.src = e.target.result; openEditModal(); } else { alert("Error reading file."); } }; reader.onerror = (err) => { console.error("FileReader error:", err); alert("Error reading file."); }; reader.readAsDataURL(file); event.target.value = null; }
function openEditModal() { if (!editModal || !modalImage) return; editModal.style.display = 'flex'; modalImage.style.opacity = 0; modalApplyBtn.disabled = false; modalSpinner.style.display = 'none'; const applyTextNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE); if (applyTextNode) applyTextNode.textContent = 'Apply '; if (cropper) { try { cropper.destroy(); } catch(e) {} cropper = null; } setTimeout(() => { try { cropper = new Cropper(modalImage, { aspectRatio: 1 / 1, viewMode: 1, dragMode: 'move', background: false, autoCropArea: 0.9, responsive: true, modal: true, guides: true, center: true, highlight: false, cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false, ready: () => { modalImage.style.opacity = 1; console.log("Cropper ready."); } }); } catch (cropperError) { console.error("Cropper init error:", cropperError); alert("Could not initialize image editor."); closeEditModal(); } }, 50); modalCloseBtn.onclick = closeEditModal; modalCancelBtn.onclick = closeEditModal; modalApplyBtn.onclick = handleApplyCrop; editModal.onclick = (event) => { if (event.target === editModal) closeEditModal(); }; }
function closeEditModal() { if (!editModal) return; if (cropper) { try { cropper.destroy(); } catch (e) {} cropper = null; } editModal.style.display = 'none'; modalImage.src = ''; modalImage.removeAttribute('src'); modalApplyBtn.disabled = false; modalSpinner.style.display = 'none'; const textNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE); if (textNode) textNode.textContent = 'Apply '; modalCloseBtn.onclick = null; modalCancelBtn.onclick = null; modalApplyBtn.onclick = null; editModal.onclick = null; }
async function handleApplyCrop() { if (!cropper || !loggedInUser || modalApplyBtn.disabled) return; modalApplyBtn.disabled = true; modalSpinner.style.display = 'inline-block'; const textNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE); if (textNode) textNode.textContent = 'Applying '; try { const canvas = cropper.getCroppedCanvas({ width: 512, height: 512, imageSmoothingEnabled: true, imageSmoothingQuality: 'high', }); if (!canvas) throw new Error("Failed to get cropped canvas."); const blob = await new Promise((res, rej) => { canvas.toBlob((blobRes) => blobRes ? res(blobRes) : rej(new Error("Canvas to Blob failed.")), 'image/jpeg', 0.90); }); console.log("Blob created:", (blob.size / 1024).toFixed(2), "KB"); const imageUrl = await uploadToCloudinary(blob); await saveProfilePictureUrl(loggedInUser.uid, imageUrl); console.log("PFP Updated & Saved:", imageUrl); profileImage.src = `${imageUrl}?ts=${Date.now()}`; profileImage.style.display = 'block'; profileInitials.style.display = 'none'; profileImage.onload = () => updateProfileBackground(imageUrl); if (viewingUserProfileData?.profile?.id === loggedInUser.uid) { viewingUserProfileData.profile.profilePictureUrl = imageUrl; if (viewerProfileData?.id === loggedInUser.uid) viewerProfileData.profilePictureUrl = imageUrl; saveCombinedDataToCache(loggedInUser.uid, viewingUserProfileData); } closeEditModal(); } catch (error) { console.error("PFP update error:", error); alert(`Failed to update profile picture: ${error.message}`); modalApplyBtn.disabled = false; modalSpinner.style.display = 'none'; if (textNode) textNode.textContent = 'Apply '; } }
async function uploadToCloudinary(blob) { if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) throw new Error("Cloudinary config missing."); const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`; const formData = new FormData(); formData.append('file', blob, `pfp_${loggedInUser?.uid || 'anon'}.jpg`); formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET); console.log(`Uploading to Cloudinary...`); try { const response = await fetch(url, { method: 'POST', body: formData }); const data = await response.json(); if (!response.ok) { console.error("Cloudinary Upload Error:", data); throw new Error(data.error?.message || `Upload failed (Status: ${response.status}).`); } if (!data.secure_url) { console.error("Cloudinary response missing secure_url:", data); throw new Error("Upload success but no URL returned."); } return data.secure_url; } catch (networkError) { console.error("Cloudinary network error:", networkError); throw new Error(`Network error during upload.`); }}
async function saveProfilePictureUrl(userId, imageUrl) { if (!userId || !imageUrl) throw new Error("Missing userId or imageUrl for save."); const userRef = db.collection("users").doc(userId); try { await userRef.update({ profilePictureUrl: imageUrl }); console.log("Saved PFP URL to Firestore."); } catch (error) { console.error(`Error saving PFP URL for ${userId}:`, error); throw new Error("DB error saving PFP link."); }}

// =============================================================================
// --- Friend System Functions ---
// =============================================================================
async function fetchUserMiniProfile(userId) { if (!userId) return null; if (miniProfileCache[userId]?.displayName) return miniProfileCache[userId]; try { const userSnap = await db.collection('users').doc(userId).get(); if (userSnap.exists) { const data = userSnap.data(); const miniProfile = { id: userId, displayName: data.displayName || `User...`, profilePictureUrl: data.profilePictureUrl || null, }; miniProfileCache[userId] = miniProfile; return miniProfile; } else { console.warn(`Mini profile not found for ${userId}`); miniProfileCache[userId] = { id: userId, displayName: "User Not Found", profilePictureUrl: null }; return miniProfileCache[userId]; } } catch (error) { console.error(`Error fetching mini profile for ${userId}:`, error); return { id: userId, displayName: "Error Loading User", profilePictureUrl: null }; }}
function determineFriendshipStatus(viewerUid, profileOwnerUid) { if (!viewerUid || !profileOwnerUid || viewerUid === profileOwnerUid || !viewerProfileData?.friends) return 'none'; return viewerProfileData.friends[profileOwnerUid] || 'none'; }
function clearFriendshipControls() { if (friendshipControlsContainer) friendshipControlsContainer.innerHTML = ''; }
function resetFriendsSection() { if (friendsSection) friendsSection.style.display = 'none'; const buttons = friendsTabsContainer?.querySelectorAll('.tab-button'); const contents = friendsSection?.querySelectorAll('.tab-content'); buttons?.forEach((btn, idx) => { btn.classList.toggle('active', idx === 0); if(btn.dataset.tab === 'incoming-requests' && incomingCountSpan) incomingCountSpan.textContent = '0'; if(btn.dataset.tab === 'outgoing-requests' && outgoingCountSpan) outgoingCountSpan.textContent = '0'; }); contents?.forEach((content, idx) => { content.classList.toggle('active', idx === 0); const list = content.querySelector('ul'); if (list) list.innerHTML = `<li class="list-message">Loading...</li>`; }); }
function displayFriendshipControls(status, profileOwnerUid) { clearFriendshipControls(); if (!friendshipControlsContainer || !loggedInUser || isOwnProfile) return; friendshipControlsContainer.style.minHeight = '40px'; let btn1 = null, btn2 = null; const actions = { 'none': ()=>btn1=createFriendActionButton('Add Friend', 'sendRequest', 'primary', profileOwnerUid), 'outgoing': ()=>btn1=createFriendActionButton('Cancel Request', 'cancelRequest', 'secondary cancel', profileOwnerUid), 'incoming': ()=>{ btn1=createFriendActionButton('Accept', 'acceptRequest', 'primary accept small', profileOwnerUid); btn2=createFriendActionButton('Decline', 'declineRequest', 'secondary decline small', profileOwnerUid); }, 'friend': ()=>btn1=createFriendActionButton('Remove Friend', 'removeFriend', 'secondary remove', profileOwnerUid), }; actions[status]?.(); if(btn1) friendshipControlsContainer.appendChild(btn1); if(btn2) friendshipControlsContainer.appendChild(btn2); }
async function displayFriendsSection(profileData) { if (!isOwnProfile || !friendsSection || !profileData || typeof profileData.friends !== 'object') { resetFriendsSection(); return; } if (!friendsListUl || !incomingListUl || !outgoingListUl || !incomingCountSpan || !outgoingCountSpan || !friendsTabsContainer) { console.error("Friend section elements missing."); resetFriendsSection(); return; } console.log("Displaying friends section..."); friendsSection.style.display = 'block'; const friendsMap = profileData.friends || {}; const friendIds = [], incomingIds = [], outgoingIds = []; for (const uid in friendsMap) { if (friendsMap.hasOwnProperty(uid)) { switch (friendsMap[uid]) { case 'friend': friendIds.push(uid); break; case 'incoming': incomingIds.push(uid); break; case 'outgoing': outgoingIds.push(uid); break; } } } incomingCountSpan.textContent = incomingIds.length; outgoingCountSpan.textContent = outgoingIds.length; try { await Promise.all([ populateFriendList(friendsListUl, friendIds, 'friend', 'You have no friends yet.'), populateFriendList(incomingListUl, incomingIds, 'incoming', 'No incoming friend requests.'), populateFriendList(outgoingListUl, outgoingIds, 'outgoing', 'No outgoing friend requests.') ]); } catch(listError) { console.error("Error populating friend lists:", listError); } if (friendsTabsContainer && !friendsTabsContainer.dataset.listenerAttached) { friendsTabsContainer.addEventListener('click', (e) => { const clickedBtn = e.target.closest('.tab-button'); if (clickedBtn) { const targetId = clickedBtn.dataset.tab; if (!targetId) return; const btns = friendsTabsContainer.querySelectorAll('.tab-button'); const contents = friendsSection.querySelectorAll('.tab-content'); btns.forEach(b => b.classList.remove('active')); contents.forEach(c => c.classList.remove('active')); clickedBtn.classList.add('active'); const targetContent = friendsSection.querySelector(`#${targetId}-container`); if (targetContent) targetContent.classList.add('active'); else console.error(`Target content not found: #${targetId}-container`); } }); friendsTabsContainer.dataset.listenerAttached = 'true'; } }
async function populateFriendList(ulEl, userIds, type, emptyMsg) { if (!ulEl) return; ulEl.innerHTML = ''; if (!userIds || userIds.length === 0) { ulEl.innerHTML = `<li class="list-message">${emptyMsg}</li>`; return; } ulEl.innerHTML = `<li class="list-message">Loading...</li>`; const profilePromises = userIds.map(id => fetchUserMiniProfile(id).catch(err => { console.error(`Error fetching mini profile for ${id} in list ${type}:`, err); return { id: id, displayName: "Error Loading", profilePictureUrl: null }; })); const profiles = await Promise.all(profilePromises); const validProfiles = profiles.filter(p => p !== null); ulEl.innerHTML = ''; let itemsAdded = 0; validProfiles.forEach(prof => { if (prof?.id && prof.displayName) { if (prof.displayName === "Error Loading User" || prof.displayName === "User Not Found") { ulEl.appendChild(createFriendListItemError(prof.id, prof.displayName)); } else { ulEl.appendChild(createFriendListItem(prof, type)); itemsAdded++; } } else { console.warn(`Skipping invalid profile in list ${type}:`, prof); } }); if (itemsAdded === 0 && validProfiles.length > 0) ulEl.innerHTML = `<li class="list-message">Could not load details.</li>`; else if (ulEl.childElementCount === 0) ulEl.innerHTML = `<li class="list-message">${emptyMsg}</li>`; }
function createFriendListItem(miniProf, type) { const li = document.createElement('li'); li.className = 'friend-item'; li.dataset.userId = miniProf.id; const infoDiv = document.createElement('div'); infoDiv.className = 'friend-item-info'; const pfpEl = createFriendPfpElement(miniProf); infoDiv.appendChild(pfpEl); const nameSpan = document.createElement('span'); nameSpan.className = 'friend-item-name'; const nameLink = document.createElement('a'); nameLink.href = `profile.html?uid=${miniProf.id}`; nameLink.textContent = miniProf.displayName; nameLink.title = `View ${miniProf.displayName}'s profile`; nameSpan.appendChild(nameLink); infoDiv.appendChild(nameSpan); li.appendChild(infoDiv); const actionsDiv = document.createElement('div'); actionsDiv.className = 'friend-item-actions'; let btn1=null, btn2=null; const actions = { friend:()=>btn1=createFriendActionButton('Remove', 'remove', 'secondary', miniProf.id, li), incoming:()=>{btn1=createFriendActionButton('Accept', 'accept', 'primary', miniProf.id, li);btn2=createFriendActionButton('Decline', 'decline', 'secondary', miniProf.id, li);}, outgoing:()=>btn1=createFriendActionButton('Cancel', 'cancel', 'secondary', miniProf.id, li) }; actions[type]?.(); if(btn1) actionsDiv.appendChild(btn1); if(btn2) actionsDiv.appendChild(btn2); li.appendChild(actionsDiv); return li; }
function createFriendPfpElement(miniProf) { const container = document.createElement('div'); container.style.cssText = 'width:40px; height:40px; flex-shrink:0; position:relative;'; const initialDiv = document.createElement('div'); initialDiv.className = 'friend-item-pfp-initial'; initialDiv.textContent = miniProf.displayName?.charAt(0)?.toUpperCase() || '?'; initialDiv.style.display = 'flex'; container.appendChild(initialDiv); if (miniProf.profilePictureUrl) { const img = document.createElement('img'); img.src = miniProf.profilePictureUrl; img.alt = `${miniProf.displayName || 'User'} PFP`; img.className = 'friend-item-pfp'; img.style.display = 'none'; img.onload = () => { initialDiv.style.display = 'none'; img.style.display = 'block'; }; img.onerror = () => { console.warn(`Failed PFP load for ${miniProf.id}`); img.style.display = 'none'; initialDiv.style.display = 'flex'; }; container.appendChild(img); } return container; }
function createFriendActionButton(text, type, styleClasses, userId, listItem) { const btn = document.createElement('button'); btn.textContent = text; btn.className = `btn btn-${styleClasses.replace(/ /g,' btn-')} btn-small`; const actionMap = { remove: 'removeFriend', accept: 'acceptRequest', decline: 'declineRequest', cancel: 'cancelRequest' }; btn.onclick = (e) => handleFriendAction(e.currentTarget, actionMap[type], userId, listItem); btn.title = `${text}`; return btn; }
function createFriendListItemError(userId, msg) { const li = document.createElement('li'); li.className = 'friend-item list-message'; li.dataset.userId = userId; li.innerHTML = `<div class="friend-item-info" style="opacity:0.6;"><div class="friend-item-pfp-initial" style="background-color:var(--text-secondary);">?</div><span class="friend-item-name">${msg}</span></div><div class="friend-item-actions"></div>`; return li; }
async function handleFriendAction(buttonElement, action, otherUserId, listItemToRemove = null) { if (!loggedInUser || !otherUserId || !buttonElement) { console.error("Friend action validation failed."); alert("Action failed. Please log in."); return; } const currentUserUid = loggedInUser.uid; buttonElement.disabled = true; const originalText = buttonElement.textContent; buttonElement.textContent = '...'; const actionContainer = buttonElement.closest('.friend-item-actions, #friendship-controls-container'); const siblingButtons = actionContainer ? Array.from(actionContainer.querySelectorAll('button')) : []; siblingButtons.forEach(btn => { if (btn !== buttonElement) btn.disabled = true; }); const userDocRef = db.collection('users').doc(currentUserUid); const otherUserDocRef = db.collection('users').doc(otherUserId); const batch = db.batch(); try { console.log(`Action: ${action} between ${currentUserUid} and ${otherUserId}`); const deleteField = firebase.firestore.FieldValue.delete(); const ops = { sendRequest: ()=>{ batch.update(userDocRef, {[`friends.${otherUserId}`]: 'outgoing'}); batch.update(otherUserDocRef, {[`friends.${currentUserUid}`]: 'incoming'}); }, cancelRequest: ()=>{ batch.update(userDocRef, {[`friends.${otherUserId}`]: deleteField}); batch.update(otherUserDocRef, {[`friends.${currentUserUid}`]: deleteField}); }, declineRequest: ()=>{ batch.update(userDocRef, {[`friends.${otherUserId}`]: deleteField}); batch.update(otherUserDocRef, {[`friends.${currentUserUid}`]: deleteField}); }, removeFriend: ()=>{ batch.update(userDocRef, {[`friends.${otherUserId}`]: deleteField}); batch.update(otherUserDocRef, {[`friends.${currentUserUid}`]: deleteField}); }, acceptRequest: ()=>{ batch.update(userDocRef, {[`friends.${otherUserId}`]: 'friend'}); batch.update(otherUserDocRef, {[`friends.${currentUserUid}`]: 'friend'}); } }; if (!ops[action]) throw new Error(`Invalid action: ${action}`); ops[action](); await batch.commit(); console.log("Friend action batch committed."); delete miniProfileCache[currentUserUid]; delete miniProfileCache[otherUserId]; try { const viewerSnap = await userDocRef.get(); if (viewerSnap.exists) { viewerProfileData = { id: viewerSnap.id, ...(viewerSnap.data() || {}) }; if (!viewerProfileData.friends) viewerProfileData.friends = {}; if (isOwnProfile) { viewingUserProfileData.profile = viewerProfileData; saveCombinedDataToCache(currentUserUid, viewingUserProfileData); } console.log("Refreshed viewer data."); } else { console.error("Failed refetch viewer profile!"); } } catch (fetchError) { console.error("Error refetching viewer profile:", fetchError); } if (isOwnProfile) displayFriendsSection(viewerProfileData); else if (viewingUserProfileData.profile?.id === otherUserId) { const newStatus = determineFriendshipStatus(currentUserUid, otherUserId); displayFriendshipControls(newStatus, otherUserId); } } catch (error) { console.error(`Error in '${action}':`, error); alert(`Error: ${error.message || 'Failed friend action.'}.`); buttonElement.disabled = false; buttonElement.textContent = originalText; siblingButtons.forEach(btn => { if (btn !== buttonElement) btn.disabled = false; }); } }

// =============================================================================
// --- Authentication and Initialization ---
// =============================================================================
auth.onAuthStateChanged(async (user) => {
    console.log(`Auth state changed. User: ${user ? user.uid : 'None'}`);
    loggedInUser = user;
    const targetUid = profileUidFromUrl || loggedInUser?.uid;
    viewerProfileData = null; viewingUserProfileData = {}; miniProfileCache = {};
    isOwnProfile = loggedInUser && targetUid === loggedInUser.uid;

    if (targetUid) {
         console.log(`Targeting profile UID: ${targetUid}`);
         if (loadingIndicator) loadingIndicator.style.display = 'flex';
         if (notLoggedInMsg) notLoggedInMsg.style.display = 'none';
         if (profileContent) profileContent.style.display = 'none';
         if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none'; // Hide outer wrapper
         if (friendsSection) friendsSection.style.display = 'none';
         try { await loadCombinedUserData(targetUid); console.log("Initial data load process completed."); if (viewingUserProfileData.profile) { if (isOwnProfile) setupProfilePicEditing(); else if(editProfilePicIcon) editProfilePicIcon.style.display = 'none'; if (profileLogoutBtn) profileLogoutBtn.style.display = isOwnProfile ? 'inline-block' : 'none'; } else { if(profileLogoutBtn) profileLogoutBtn.style.display = 'none'; } }
         catch (err) { console.error("Critical error during profile load sequence:", err); if (loadingIndicator) loadingIndicator.style.display = 'none'; if (profileContent) profileContent.style.display = 'none'; if (notLoggedInMsg) { notLoggedInMsg.textContent = 'Failed to load profile. An unexpected error occurred.'; notLoggedInMsg.style.display = 'flex'; } if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none'; if (friendsSection) friendsSection.style.display = 'none'; if(profileLogoutBtn) profileLogoutBtn.style.display = 'none'; clearFriendshipControls(); resetFriendsSection(); }
    } else {
        console.log('No user logged in and no profile UID in URL.');
        if (loadingIndicator) loadingIndicator.style.display = 'none'; if (profileContent) profileContent.style.display = 'none'; if (notLoggedInMsg) { notLoggedInMsg.style.display = 'flex'; notLoggedInMsg.innerHTML = 'Please <a href="index.html#login" style="color: var(--primary-orange); margin: 0 5px;">log in</a> to view your profile, or provide a user ID.'; } // Adjust link target if needed
        if (adminTag) adminTag.style.display = 'none'; if (profileBadgesContainer) profileBadgesContainer.innerHTML = ''; if (profileLogoutBtn) profileLogoutBtn.style.display = 'none'; if (editProfilePicIcon) editProfilePicIcon.style.display = 'none'; updateProfileTitlesAndRank(null, false); if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = ''; if (poxelStatsSection) poxelStatsSection.style.display = 'none'; updateProfileBackground(null); closeTitleSelector(); closeEditModal(); clearFriendshipControls(); resetFriendsSection(); if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none'; viewingUserProfileData = {}; viewerProfileData = null; miniProfileCache = {};
    }
});

// --- Logout Button Event Listener ---
if (profileLogoutBtn) profileLogoutBtn.addEventListener('click', () => { const userId = loggedInUser?.uid; console.log(`Logout requested by: ${userId || 'N/A'}`); if (titleDisplay) titleDisplay.removeEventListener('click', handleTitleClick); closeTitleSelector(); closeEditModal(); clearFriendshipControls(); resetFriendsSection(); if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none'; if (editProfilePicIcon) editProfilePicIcon.onclick = null; if (profilePicInput) profilePicInput.onchange = null; auth.signOut().then(() => { console.log('Sign out successful.'); if (userId) localStorage.removeItem(`poxelProfileCombinedData_${userId}`); loggedInUser = null; viewerProfileData = null; viewingUserProfileData = {}; miniProfileCache = {}; isOwnProfile = false; window.location.href = 'index.html'; }).catch((error) => { console.error('Sign out error:', error); alert('Error signing out.'); }); });

// =============================================================================
// --- Local Storage Caching ---
// =============================================================================
function loadCombinedDataFromCache(viewedUserId) { if (!viewedUserId) return false; const cacheKey = `poxelProfileCombinedData_${viewedUserId}`; try { const cachedStr = localStorage.getItem(cacheKey); if (!cachedStr) return false; const cachedData = JSON.parse(cachedStr); if (cachedData?.profile?.id === viewedUserId) { cachedData.profile.friends = cachedData.profile.friends || {}; cachedData.profile.leaderboardStats = cachedData.profile.leaderboardStats || {}; cachedData.profile.availableTitles = cachedData.profile.availableTitles || []; cachedData.profile.equippedTitle = cachedData.profile.equippedTitle ?? ""; cachedData.profile.currentRank = cachedData.profile.currentRank || "Unranked"; cachedData.stats = cachedData.stats || null; viewingUserProfileData = cachedData; console.log("Loaded combined data from cache for:", viewedUserId); const viewingOwnCached = loggedInUser && loggedInUser.uid === viewedUserId; displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats, viewingOwnCached); return true; } else { console.warn(`Cache mismatch for ${viewedUserId}. Removing.`); localStorage.removeItem(cacheKey); return false; } } catch (error) { console.error("Cache load/parse error:", error); try { localStorage.removeItem(cacheKey); } catch (e) {} return false; } }
function saveCombinedDataToCache(viewedUserId, combinedData) { if (!viewedUserId || !combinedData?.profile?.id || viewedUserId !== combinedData.profile.id) { console.warn("Cache save validation failed.", { viewedUserId, profileId: combinedData?.profile?.id }); return; } const cacheKey = `poxelProfileCombinedData_${viewedUserId}`; try { const dataToSave = { profile: { ...combinedData.profile, friends: combinedData.profile.friends || {}, availableTitles: combinedData.profile.availableTitles || [], equippedTitle: combinedData.profile.equippedTitle ?? "", currentRank: combinedData.profile.currentRank || "Unranked", leaderboardStats: combinedData.profile.leaderboardStats || {} }, stats: combinedData.stats || null }; localStorage.setItem(cacheKey, JSON.stringify(dataToSave)); } catch (error) { console.error(`Cache save error for ${viewedUserId}:`, error); if (error.name === 'QuotaExceededError' || error.message?.toLowerCase().includes('quota')) { console.warn('LocalStorage quota exceeded.'); } } }

// --- Initial Log ---
console.log("Profile script initialized. Waiting for Auth state...");
