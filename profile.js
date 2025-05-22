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

// --- Admin Emails (kept for the admin tag, could also be a dynamic badge) ---
const adminEmails = [
    'trixdesignsofficial@gmail.com',
    'jackdmbell@outlook.com',
    'myrrr@myrrr.myrrr',
    'headbean615@yahoo.com'
].map(email => email.toLowerCase());

// --- REMOVED Old Static Badge Configuration ---
// const badgeConfig = { ... }; // This has been deleted

// --- DOM Elements ---
const profileContent = document.getElementById('profile-content');
const loadingIndicator = document.getElementById('loading-profile');
const notLoggedInMsg = document.getElementById('not-logged-in');
const profilePicDiv = document.getElementById('profile-pic');
const profileImage = document.getElementById('profile-image');
const profileInitials = document.getElementById('profile-initials');
const editProfilePicIcon = document.getElementById('edit-profile-pic-icon');
const profilePicInput = document.getElementById('profile-pic-input');
const editBackgroundIcon = document.getElementById('edit-background-icon');
const removeBackgroundIcon = document.getElementById('remove-background-icon');
const backgroundInput = document.getElementById('background-input');
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
const editModal = document.getElementById('edit-modal');
const modalImage = document.getElementById('image-to-crop');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalApplyBtn = document.getElementById('modal-apply-btn');
const modalSpinner = document.getElementById('modal-spinner');
const friendshipControlsContainer = document.getElementById('friendship-controls-container');
const friendsSection = document.getElementById('friends-section');
const friendsListUl = document.getElementById('friends-list');
const incomingListUl = document.getElementById('incoming-requests-list');
const outgoingListUl = document.getElementById('outgoing-requests-list');
const incomingCountSpan = document.getElementById('incoming-count');
const outgoingCountSpan = document.getElementById('outgoing-count');
const friendsTabsContainer = document.querySelector('.friends-tabs');
const achievementsListContainer = document.getElementById('achievements-list-container');
const achievementsSectionOuter = document.getElementById('achievements-section-outer');

// --- Global/Scoped Variables ---
let allAchievements = null;
let allBadgeDefinitions = null; // NEW: Cache for dynamic badge definitions from Firestore
let viewingUserProfileData = {};
let viewerProfileData = null;
let miniProfileCache = {};
let isTitleSelectorOpen = false;
let titleSelectorElement = null;
let cropper = null;
let isOwnProfile = false;

// =============================================================================
// --- CORE DATA FETCHING FUNCTIONS ---
// =============================================================================

async function fetchPoxelStats(username) {
    if (!username || typeof username !== 'string' || username.trim() === '') { console.warn("fetchPoxelStats: Invalid username provided."); return null; }
    // console.log(`Fetching Poxel.io stats for: ${username}`);
    try {
        const apiUrl = `https://dev-usa-1.poxel.io/api/profile/stats/${encodeURIComponent(username)}`;
        const res = await fetch(apiUrl, { headers: { "Content-Type": "application/json" } });
        if (!res.ok) { let errorMsg = `HTTP error ${res.status}`; if (res.status === 404) { errorMsg = "User not found on Poxel.io"; } else { try { const errorData = await res.json(); errorMsg = errorData.message || errorData.error || errorMsg; } catch (parseError) { /* Ignore */ } } throw new Error(errorMsg); }
        const data = await res.json();
        if (typeof data !== 'object' || data === null) throw new Error("Invalid data format received from Poxel.io API.");
        if (data.error || data.status === 'error') { if (data.message && data.message.toLowerCase().includes('not found')) throw new Error('User not found on Poxel.io'); throw new Error(data.message || 'Poxel.io API returned an error status.'); }
        return data;
    } catch (e) { console.error("Error fetching Poxel.io stats:", e.message || e); return null; }
}

async function fetchAllAchievements() {
    if (allAchievements) return allAchievements;
    // console.log("Fetching all achievement definitions...");
    try {
        const snapshot = await db.collection('achievements').get(); // Assuming you might have an 'order' field
        const fetchedAchievements = {};
        snapshot.forEach(doc => { fetchedAchievements[doc.id] = { id: doc.id, ...doc.data() }; });
        allAchievements = fetchedAchievements;
        // console.log(`Fetched ${Object.keys(allAchievements).length} achievement definitions.`);
        return allAchievements;
    } catch (error) { console.error("Error fetching achievement definitions:", error); allAchievements = {}; return null; }
}

// NEW: Fetch all badge definitions from Firestore
async function fetchAllBadgeDefinitions() {
    if (allBadgeDefinitions) return allBadgeDefinitions;
    console.log("Fetching all badge definitions from Firestore...");
    try {
        const snapshot = await db.collection('badge_definitions').orderBy('displayOrder').get(); // Assumes 'displayOrder' field
        const fetchedBadges = {};
        snapshot.forEach(doc => {
            fetchedBadges[doc.id] = { docId: doc.id, ...doc.data() };
        });
        allBadgeDefinitions = fetchedBadges;
        console.log(`Fetched ${Object.keys(allBadgeDefinitions).length} badge definitions from Firestore.`);
        return allBadgeDefinitions;
    } catch (error) {
        console.error("Error fetching badge definitions from Firestore:", error);
        allBadgeDefinitions = {}; // Set empty on error to prevent retries, but allow UI to proceed
        return null;
    }
}

// =============================================================================
// --- USER PROFILE & STATS LOGIC ---
// =============================================================================

function areStatsDifferent(newStats, existingProfileStats) {
    const normNew = newStats || {}; const normExisting = existingProfileStats || {};
    const statKeys = ['wins', 'points', 'kdRatio', 'matchesPlayed', 'matches', 'losses', 'kills'];
    let different = false;
    for (const key of statKeys) {
        let newValue = normNew[key]; let existingValue = normExisting[key];
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

async function createUserProfileDocument(userId, authUser) {
    if (!userId || !authUser) { console.error("Cannot create profile: userId or authUser missing."); return null; }
    console.warn(`Client-side: Creating missing user profile doc for UID: ${userId}`);
    const userDocRef = db.collection("users").doc(userId);
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;
    const defaultProfileData = {
        email: authUser.email ? authUser.email.toLowerCase() : null,
        displayName: displayName, currentRank: "Unranked", equippedTitle: "",
        availableTitles: [], friends: {}, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        leaderboardStats: {}, profilePictureUrl: authUser.photoURL || null,
        profileBackgroundUrl: null, poxelStats: {}
    };
    try { await userDocRef.set(defaultProfileData, { merge: false }); console.log(`Successfully created user profile document for UID: ${userId} via client`); return { id: userId, ...defaultProfileData, createdAt: new Date() }; }
    catch (error) { console.error(`Error creating user profile document client-side for UID ${userId}:`, error); return null; }
}

async function loadCombinedUserData(targetUserId) {
    // console.log(`Loading combined user data for TARGET UID: ${targetUserId}`);
    isOwnProfile = loggedInUser && loggedInUser.uid === targetUserId;
    // console.log("Is viewing own profile:", isOwnProfile);

    viewerProfileData = null; miniProfileCache = {}; viewingUserProfileData = {};
    if (profileContent) profileContent.style.display = 'none';
    if (notLoggedInMsg) notLoggedInMsg.style.display = 'none';
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = '<p class="list-message">Loading competitive stats...</p>';
    if (poxelStatsSection) poxelStatsSection.style.display = 'none';
    if (poxelStatsDisplay) poxelStatsDisplay.innerHTML = '<p class="list-message">Loading Poxel.io stats...</p>';
    if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none';
    if (achievementsListContainer) achievementsListContainer.innerHTML = '<p class="list-message">Loading achievements...</p>';
    updateProfileTitlesAndRank(null, false);
    clearFriendshipControls(); resetFriendsSection();
    updateProfileBackground(null);
    if (editBackgroundIcon) editBackgroundIcon.style.display = 'none';
    if (removeBackgroundIcon) removeBackgroundIcon.style.display = 'none';

    const cacheLoaded = loadCombinedDataFromCache(targetUserId);

    // Ensure definitions are fetched if not already
    if (!allAchievements) await fetchAllAchievements();
    if (!allBadgeDefinitions) await fetchAllBadgeDefinitions(); // Fallback fetch

    if (loggedInUser && !isOwnProfile) {
        try {
            const viewerSnap = await db.collection('users').doc(loggedInUser.uid).get();
            if (viewerSnap.exists) { viewerProfileData = { id: viewerSnap.id, ...viewerSnap.data() }; if (!viewerProfileData.friends) viewerProfileData.friends = {}; /* console.log("Fetched viewer profile data."); */ }
            else { console.warn("Logged-in user's profile data not found."); viewerProfileData = await createUserProfileDocument(loggedInUser.uid, loggedInUser); if (!viewerProfileData) viewerProfileData = { id: loggedInUser.uid, friends: {} }; }
        } catch (viewerError) { console.error("Error fetching viewing user's profile data:", viewerError); viewerProfileData = { id: loggedInUser.uid, friends: {} }; }
    }

    const userProfileRef = db.collection('users').doc(targetUserId);
    const leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId);
    let userUnlockedAchievementIds = [];

    try {
        if (isOwnProfile) userUnlockedAchievementIds = await fetchUserUnlockedAchievements(targetUserId);
        let profileSnap = await userProfileRef.get();
        let profileData = null;
        if (!profileSnap || !profileSnap.exists) {
            console.warn(`User profile document does NOT exist for UID: ${targetUserId}`);
            if (isOwnProfile && loggedInUser) { profileData = await createUserProfileDocument(targetUserId, loggedInUser); if (!profileData) throw new Error(`Profile creation failed.`); }
            else { throw new Error(`Profile not found.`); }
        } else {
            profileData = { id: profileSnap.id, ...profileSnap.data() };
            profileData.leaderboardStats = profileData.leaderboardStats || {};
            profileData.profilePictureUrl = profileData.profilePictureUrl || null;
            profileData.profileBackgroundUrl = profileData.profileBackgroundUrl || null;
            profileData.friends = profileData.friends || {};
            if (profileData.email) profileData.email = profileData.email.toLowerCase();
        }

        if (isOwnProfile) { viewerProfileData = profileData; if (!viewerProfileData.friends) viewerProfileData.friends = {}; }

        let competitiveStatsData = null;
        if(profileData) { const statsSnap = await leaderboardStatsRef.get(); competitiveStatsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null; }

        if (profileData && competitiveStatsData && areStatsDifferent(competitiveStatsData, profileData.leaderboardStats)) {
            // console.log(`Competitive stats for UID ${targetUserId} differ. Syncing to 'users' doc.`);
            try { const statsToSave = { ...competitiveStatsData }; delete statsToSave.id; await userProfileRef.update({ leaderboardStats: statsToSave }); profileData.leaderboardStats = statsToSave; /* console.log("'users' doc synced with leaderboard stats."); */ }
            catch (updateError) { console.error(`Error syncing competitive stats to 'users' doc:`, updateError); }
        }

        viewingUserProfileData = { profile: profileData, stats: competitiveStatsData };

        if (profileData && profileData.profileBackgroundUrl) updateProfileBackground(profileData.profileBackgroundUrl);
        else updateProfileBackground(null);

        displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats, isOwnProfile);
        saveCombinedDataToCache(targetUserId, viewingUserProfileData);

        if (loggedInUser) {
            if (isOwnProfile) {
                displayFriendsSection(profileData);
                setupBackgroundEditing();
            } else if (viewerProfileData) {
                const status = determineFriendshipStatus(loggedInUser.uid, targetUserId);
                displayFriendshipControls(status, targetUserId);
                if (editBackgroundIcon) editBackgroundIcon.style.display = 'none';
                if (removeBackgroundIcon) removeBackgroundIcon.style.display = 'none';
            }
        }

        if (profileData && profileData.displayName) {
             if(poxelStatsSection) poxelStatsSection.style.display = 'block';
             fetchPoxelStats(profileData.displayName)
                .then(poxelStatsData => displayPoxelStats(poxelStatsData))
                .catch(poxelError => displayPoxelStats(null, poxelError.message || 'Error loading Poxel stats.'));
        } else { displayPoxelStats(null, 'Poxel username not found.'); }

        if (isOwnProfile) { if (!allAchievements) await fetchAllAchievements(); await displayAchievementsSection(viewingUserProfileData.stats, userUnlockedAchievementIds); }
        else { if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none'; }

        if (isOwnProfile && viewingUserProfileData.stats) {
            if (!allAchievements) await fetchAllAchievements();
            if (allAchievements) {
                const potentiallyUpdatedProfile = await checkAndGrantAchievements( targetUserId, viewingUserProfileData.profile, viewingUserProfileData.stats );
                if (potentiallyUpdatedProfile) {
                    // console.log("Profile updated by achievement grant. Refreshing UI.");
                    viewingUserProfileData.profile = potentiallyUpdatedProfile; viewerProfileData = potentiallyUpdatedProfile;
                    displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats, isOwnProfile);
                    saveCombinedDataToCache(targetUserId, viewingUserProfileData);
                    const latestUnlockedIds = await fetchUserUnlockedAchievements(targetUserId);
                    await displayAchievementsSection(viewingUserProfileData.stats, latestUnlockedIds);
                    displayFriendsSection(viewingUserProfileData.profile);
                }
            }
        }
    } catch (error) {
        console.error(`Error loading combined data for UID ${targetUserId}:`, error);
        const errorMessage = error.message === 'Profile not found.' ? 'Profile not found.' : 'Error loading profile data.';
        viewingUserProfileData = { profile: null, stats: null };
        if (!cacheLoaded) {
             if (profileContent) profileContent.style.display = 'none';
             if (notLoggedInMsg) { notLoggedInMsg.textContent = errorMessage; notLoggedInMsg.style.display = 'flex'; }
             updateProfileTitlesAndRank(null, false);
             if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = '<p class="list-message">Error loading stats.</p>';
             if (poxelStatsSection) poxelStatsSection.style.display = 'none';
             if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none';
             clearFriendshipControls(); resetFriendsSection(); updateProfileBackground(null);
        } else {
            console.warn("Error fetching latest data, displaying potentially stale cache.");
             if (notLoggedInMsg) { notLoggedInMsg.textContent = 'Could not fetch latest updates.'; notLoggedInMsg.style.display = 'block'; notLoggedInMsg.style.textAlign='center'; notLoggedInMsg.style.color='orange'; setTimeout(()=>notLoggedInMsg.style.display='none', 4000)}
             if (viewingUserProfileData.profile?.displayName && poxelStatsSection) {
                 if(poxelStatsSection.style.display !== 'block') poxelStatsSection.style.display = 'block';
                 fetchPoxelStats(viewingUserProfileData.profile.displayName)
                     .then(poxelStatsData => displayPoxelStats(poxelStatsData))
                     .catch(e => displayPoxelStats(null, e.message || 'Error loading Poxel stats.'));
              } else if(poxelStatsDisplay) { displayPoxelStats(null, 'Poxel username not found.'); }
              if(isOwnProfile && achievementsSectionOuter && achievementsListContainer){
                  if(!achievementsListContainer.hasChildNodes()) achievementsListContainer.innerHTML = '<p class="list-message">Showing cached achievements. Could not fetch latest.</p>';
                   achievementsSectionOuter.style.display = 'block';
              }
        }
    } finally {
         if (loadingIndicator) loadingIndicator.style.display = 'none';
         if (viewingUserProfileData.profile) { if (profileContent) profileContent.style.display = 'block'; }
    }
}

// =============================================================================
// --- UI DISPLAY FUNCTIONS ---
// =============================================================================

function displayProfileData(profileData, competitiveStatsData, isOwner) {
    if (!profileContent) { console.error("Profile content container not found."); return; }
    profileContent.style.display = 'block';
    if (!profileData) { console.error("displayProfileData called with null profileData."); profileContent.style.display = 'none'; if (notLoggedInMsg) { notLoggedInMsg.textContent = 'Profile data unavailable.'; notLoggedInMsg.style.display = 'flex'; } return; }

    const displayName = profileData.displayName || 'Anonymous User';
    usernameDisplay.textContent = displayName;

    if (profileData.profilePictureUrl) {
        profileImage.src = profileData.profilePictureUrl; profileImage.style.display = 'block'; profileInitials.style.display = 'none';
        profileImage.onerror = () => { console.error("Failed to load PFP:", profileData.profilePictureUrl); profileImage.style.display = 'none'; profileInitials.textContent = displayName?.charAt(0)?.toUpperCase() || '?'; profileInitials.style.display = 'flex'; };
    } else { profileImage.style.display = 'none'; profileImage.src = ''; profileInitials.textContent = displayName?.charAt(0)?.toUpperCase() || '?'; profileInitials.style.display = 'flex'; }

    if (profileData.profileBackgroundUrl) updateProfileBackground(profileData.profileBackgroundUrl);
    else updateProfileBackground(null);

    if(editProfilePicIcon) editProfilePicIcon.style.display = isOwner ? 'flex' : 'none';

    displayUserBadges(profileData); // Uses dynamic badge system
    updateProfileTitlesAndRank(profileData, isOwner);
    displayCompetitiveStats(competitiveStatsData);

    if (isOwner) {
        setupProfilePicEditing();
        // setupBackgroundEditing is called in loadCombinedUserData
    }
}

function updateProfileBackground(imageUrl) {
    if (!profileContent) return;
    if (imageUrl) { profileContent.style.setProperty('--profile-bg-image', `url('${imageUrl}')`); profileContent.classList.add('has-background'); }
    else { profileContent.style.removeProperty('--profile-bg-image'); profileContent.classList.remove('has-background'); }
}

function displayCompetitiveStats(statsData) {
    if (!competitiveStatsDisplay) return; competitiveStatsDisplay.innerHTML = '';
    if (!statsData || typeof statsData !== 'object' || Object.keys(statsData).length === 0) { competitiveStatsDisplay.innerHTML = '<p class="list-message">Competitive stats unavailable.</p>'; return; }
    const statsMap = { wins: 'Wins', points: 'Points', kdRatio: 'K/D Ratio', matchesPlayed: 'Matches Played', losses: 'Losses', kills: 'Kills'};
    if (!statsData.hasOwnProperty('matchesPlayed') && statsData.hasOwnProperty('matches')) { statsMap.matches = 'Matches Played'; delete statsMap.matchesPlayed; }
    let statsAdded = 0; for (const key in statsMap) { if (statsData.hasOwnProperty(key)) { let value = statsData[key]; let displayValue = value; if (key === 'kdRatio' && typeof value === 'number') displayValue = value.toFixed(2); else if (value === null || value === undefined) displayValue = '-'; competitiveStatsDisplay.appendChild(createStatItem(statsMap[key], displayValue)); statsAdded++; } }
    if (statsAdded === 0) competitiveStatsDisplay.innerHTML = '<p class="list-message">No competitive stats found.</p>';
}

function displayPoxelStats(poxelData, message = null) {
    if (!poxelStatsDisplay || !poxelStatsSection) return; poxelStatsDisplay.innerHTML = ''; poxelStatsSection.style.display = 'block';
    if (message) { poxelStatsDisplay.innerHTML = `<p class="list-message">${message}</p>`; return; }
    if (!poxelData || typeof poxelData !== 'object' || Object.keys(poxelData).length === 0) { poxelStatsDisplay.innerHTML = '<p class="list-message">Poxel.io stats unavailable.</p>'; return; }
    const statsMap = { kills: 'Kills', deaths: 'Deaths', wins: 'Wins', losses: 'Losses', level: 'Level', playtimeHours: 'Playtime (Hours)', gamesPlayed: 'Games Played' }; let statsAdded = 0;
    for (const key in statsMap) { if (poxelData.hasOwnProperty(key) && poxelData[key] !== null && poxelData[key] !== undefined) { let value = poxelData[key]; if (key === 'playtimeHours' && typeof value === 'number') value = value.toFixed(1); poxelStatsDisplay.appendChild(createStatItem(statsMap[key], value)); statsAdded++; } }
    if (poxelData.hasOwnProperty('kills') && poxelData.hasOwnProperty('deaths') && poxelData.deaths !== null && poxelData.kills !== null) { const kills = Number(poxelData.kills) || 0; const deaths = Number(poxelData.deaths) || 0; const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2); poxelStatsDisplay.appendChild(createStatItem('Poxel K/D', kd)); statsAdded++; }
    if (statsAdded === 0) poxelStatsDisplay.innerHTML = '<p class="list-message">No relevant Poxel.io stats found.</p>';
}

function createStatItem(title, value) { const itemDiv = document.createElement('div'); itemDiv.classList.add('stat-item'); const titleH4 = document.createElement('h4'); titleH4.textContent = title; const valueP = document.createElement('p'); valueP.textContent = (value !== null && value !== undefined) ? value : '-'; itemDiv.appendChild(titleH4); itemDiv.appendChild(valueP); return itemDiv; }

async function fetchUserUnlockedAchievements(userId) { if (!userId) return []; try { const doc = await db.collection('userAchievements').doc(userId).get(); return doc.exists ? (doc.data()?.unlocked || []) : []; } catch (error) { console.error(`Error fetching unlocked achievements for ${userId}:`, error); return []; }}

function calculateAchievementProgress(achievement, userStats) {
    const criteria = achievement?.criteria || {}; const targetValue = criteria.value || 0; const operator = criteria.operator || '>='; const statKey = criteria.stat;
    if (userStats === null || userStats === undefined || !statKey) { const meetsCriteria = operator === '>=' && (0 >= targetValue); return { progress: 0, currentValue: 0, targetValue, meetsCriteria }; }
    let currentValue = userStats[statKey]; if(statKey === 'matchesPlayed' && !userStats.hasOwnProperty('matchesPlayed') && userStats.hasOwnProperty('matches')) currentValue = userStats.matches; currentValue = Number(currentValue) || 0; if (statKey === 'kdRatio' && typeof currentValue === 'number') currentValue = parseFloat(currentValue.toFixed(2));
    if (targetValue <= 0) { const meetsCriteria = operator === '>=' ? currentValue >= targetValue : operator === '==' ? currentValue == targetValue : false; return { progress: (meetsCriteria ? 100 : 0), currentValue, targetValue, meetsCriteria }; }
    let progressPercent = 0; let meetsCriteria = false; switch (operator) { case '>=': meetsCriteria = currentValue >= targetValue; progressPercent = (currentValue / targetValue) * 100; break; case '==': meetsCriteria = currentValue == targetValue; progressPercent = meetsCriteria ? 100 : 0; break; default: console.warn(`Unsupported achievement operator: ${operator}`); meetsCriteria = false; progressPercent = 0; break; }
    progressPercent = Math.max(0, Math.min(100, progressPercent)); return { progress: Math.floor(progressPercent), currentValue, targetValue, meetsCriteria };
}

async function displayAchievementsSection(competitiveStats, unlockedAchievementIds) {
    if (!achievementsSectionOuter || !achievementsListContainer) { console.error("Achievement section elements missing."); return; }
    if (!isOwnProfile) { achievementsSectionOuter.style.display = 'none'; return; }
    if (!allAchievements) { await fetchAllAchievements(); if (!allAchievements) { console.error("Failed to load achievement definitions."); achievementsListContainer.innerHTML = '<p class="list-message">Could not load achievement definitions.</p>'; achievementsSectionOuter.style.display = 'block'; return; }}
    achievementsListContainer.innerHTML = ''; achievementsSectionOuter.style.display = 'block'; const achievementIds = Object.keys(allAchievements || {}); if (achievementIds.length === 0) { achievementsListContainer.innerHTML = '<p class="list-message">No achievements defined yet.</p>'; return; }
    // console.log(`Displaying ${achievementIds.length} achievements.`);
    achievementIds.forEach(id => { const ach = allAchievements[id]; if (!ach || !ach.name || !ach.criteria) { console.warn(`Skipping invalid achievement data for ID: ${id}`, ach); return; }
        const isUnlocked = unlockedAchievementIds?.includes(id) || false; const progInfo = calculateAchievementProgress(ach, competitiveStats); const isDisplayCompleted = isUnlocked || progInfo.meetsCriteria; const itemDiv = document.createElement('div'); itemDiv.classList.add('achievement-item'); if (isUnlocked) itemDiv.classList.add('achievement-unlocked'); if (isDisplayCompleted) itemDiv.classList.add('achievement-completed'); let rewardsHtml = ''; if (ach.rewards) { const parts = []; if (ach.rewards.title) parts.push(`Title: <strong>${ach.rewards.title}</strong>`); if (ach.rewards.rank) parts.push(`Rank: <strong>${ach.rewards.rank}</strong>`); if (parts.length > 0) rewardsHtml = `<div class="achievement-rewards">Reward${parts.length > 1 ? 's': ''}: ${parts.join(', ')}</div>`; }
        let progressText = `${progInfo.progress}%`; let progressBarTitle = 'Progress'; const isNumericProg = ach.criteria.stat && typeof ach.criteria.value === 'number' && ach.criteria.value > 0 && ach.criteria.operator === '>='; if (isDisplayCompleted) { progressText = "Completed"; progressBarTitle = isNumericProg ? `${ach.criteria.stat}: ${progInfo.currentValue} / ${progInfo.targetValue} (Completed)` : "Completed"; } else if (isNumericProg) { progressText = `${progInfo.currentValue} / ${progInfo.targetValue} (${progInfo.progress}%)`; progressBarTitle = `${ach.criteria.stat}: ${progInfo.currentValue} / ${progInfo.targetValue}`; } else { progressBarTitle = ach.criteria.stat ? `${ach.criteria.stat} Progress` : 'Progress'; }
        itemDiv.innerHTML = `<h4><span>${ach.name}</span>${isDisplayCompleted ? '<span class="completion-icon" title="Completed!">✔</span>' : ''}</h4><p class="achievement-description">${ach.description || 'No description available.'}</p>${ach.criteria.stat && ach.criteria.value !== undefined ? `<div class="achievement-progress-container" title="${progressBarTitle}"><div class="achievement-progress-bar" style="width: ${progInfo.progress}%;"><span>${progressText}</span></div></div>` : '<div style="height: 5px;"></div>'}${rewardsHtml}`; achievementsListContainer.appendChild(itemDiv); });
    if (achievementsListContainer.childElementCount === 0 && achievementIds.length > 0) { console.warn("Achievement list empty after processing IDs."); achievementsListContainer.innerHTML = '<p class="list-message">Could not display achievements.</p>'; }
}

async function checkAndGrantAchievements(userId, currentUserProfile, competitiveStats) {
    if (!allAchievements || !userId || !currentUserProfile || !competitiveStats || typeof competitiveStats !== 'object') { /* console.log("Skipping achievement check: Missing data."); */ return null; }
    // console.log(`Checking achievements for UID ${userId}...`);
    let profileToUpdate = { ...currentUserProfile, availableTitles: currentUserProfile.availableTitles || [], equippedTitle: currentUserProfile.equippedTitle ?? "", currentRank: currentUserProfile.currentRank || "Unranked", friends: currentUserProfile.friends || {}, leaderboardStats: currentUserProfile.leaderboardStats || {}, profileBackgroundUrl: currentUserProfile.profileBackgroundUrl || null };
    let unlockedIds = []; try { const doc = await db.collection('userAchievements').doc(userId).get(); if (doc.exists) unlockedIds = doc.data()?.unlocked || []; } catch (fetchError) { console.error("Error fetching unlocked achievements, assuming none:", fetchError); }
    let newAchievementsUnlocked = []; let needsProfileUpdate = false; let needsUserAchievementsUpdate = false; let bestRankReward = null; const rankOrder = ["Unranked", "Bronze", "Silver", "Gold", "Platinum", "Veteran", "Legend"];
    for (const achievementId in allAchievements) { if (unlockedIds.includes(achievementId)) continue; const achievement = allAchievements[achievementId]; if (!achievement?.criteria) continue; const progressInfo = calculateAchievementProgress(achievement, competitiveStats); if (progressInfo.meetsCriteria) { /* console.log(`Criteria MET for: ${achievement.name || achievementId}`); */ if (!newAchievementsUnlocked.includes(achievementId)) { newAchievementsUnlocked.push(achievementId); needsUserAchievementsUpdate = true; } if (achievement.rewards) { if (achievement.rewards.title && !profileToUpdate.availableTitles.includes(achievement.rewards.title)) { profileToUpdate.availableTitles.push(achievement.rewards.title); needsProfileUpdate = true; /* console.log(`- Added title: ${achievement.rewards.title}`); */ if (profileToUpdate.equippedTitle === "") { profileToUpdate.equippedTitle = achievement.rewards.title; /* console.log(`- Auto-equipped: ${achievement.rewards.title}`); */ } } if (achievement.rewards.rank) { const curIdx = rankOrder.indexOf(profileToUpdate.currentRank); const newIdx = rankOrder.indexOf(achievement.rewards.rank); const bestRewardIdx = bestRankReward ? rankOrder.indexOf(bestRankReward) : -1; if (newIdx > Math.max(curIdx, bestRewardIdx)) { bestRankReward = achievement.rewards.rank; needsProfileUpdate = true; } } } } }
    if (bestRankReward) { const curIdx = rankOrder.indexOf(profileToUpdate.currentRank); const bestRewardIdx = rankOrder.indexOf(bestRankReward); if (bestRewardIdx > curIdx) { profileToUpdate.currentRank = bestRankReward; /* console.log(`Updating profile rank to: ${bestRankReward}`); */ } }
    if (needsProfileUpdate || needsUserAchievementsUpdate) { /* console.log(`Needs Firestore update. Profile: ${needsProfileUpdate}, UserAch: ${needsUserAchievementsUpdate}`); */ const batch = db.batch(); const userProfileRef = db.collection('users').doc(userId); const userAchievementsRef = db.collection('userAchievements').doc(userId);
        if (needsUserAchievementsUpdate && newAchievementsUnlocked.length > 0) { batch.set(userAchievementsRef, { unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsUnlocked) }, { merge: true }); }
        if (needsProfileUpdate) { const updateData = {}; if (JSON.stringify(profileToUpdate.availableTitles) !== JSON.stringify(currentUserProfile.availableTitles || [])) updateData.availableTitles = profileToUpdate.availableTitles; if (profileToUpdate.equippedTitle !== (currentUserProfile.equippedTitle ?? "")) updateData.equippedTitle = profileToUpdate.equippedTitle; if (profileToUpdate.currentRank !== (currentUserProfile.currentRank || "Unranked")) updateData.currentRank = profileToUpdate.currentRank; if (Object.keys(updateData).length > 0) { /* console.log("Updating 'users' doc with:", updateData); */ batch.update(userProfileRef, updateData); } else { /* console.log("needsProfileUpdate flag set, but no actual change detected."); */ needsProfileUpdate = false; } }
        if (needsProfileUpdate || needsUserAchievementsUpdate) { await batch.commit(); /* console.log("Achievement Firestore batch committed."); */ return profileToUpdate; } else { /* console.log("No batch commit needed."); */ return null; }
    } else { return null; }
}


// MODIFIED: displayUserBadges uses dynamic definitions from `allBadgeDefinitions`
function displayUserBadges(profileData) {
    if (!profileBadgesContainer) {
        console.error("CRITICAL: profileBadgesContainer element not found. Badges cannot be displayed.");
        return;
    }
    profileBadgesContainer.innerHTML = '';

    if (!adminTag) {
        console.warn("WARN: adminTag element not found. Admin tag functionality might be affected.");
    } else {
        adminTag.style.display = 'none';
    }

    if (!profileData) {
        console.warn("displayUserBadges: Called with no profileData.");
        return;
    }

    const userEmail = profileData.email; // Assumes email is already toLowerCase

    // Admin Tag - remains based on hardcoded adminEmails array for now
    if (adminTag && userEmail && adminEmails.includes(userEmail.toLowerCase())) {
        adminTag.style.display = 'inline-block';
    }

    // Dynamic Badges from Firestore
    if (!allBadgeDefinitions) {
        console.warn("displayUserBadges: Badge definitions not loaded yet. Badges might not display correctly on initial fast load.");
        return; // Definitions might still be fetching
    }

    if (userEmail) {
        const lowercasedUserEmail = userEmail.toLowerCase();
        const sortedBadgeIds = Object.keys(allBadgeDefinitions).sort((a, b) => {
            const orderA = allBadgeDefinitions[a].displayOrder || 0;
            const orderB = allBadgeDefinitions[b].displayOrder || 0;
            return orderA - orderB;
        });

        for (const badgeId of sortedBadgeIds) {
            const badgeDef = allBadgeDefinitions[badgeId];
            if (badgeDef && badgeDef.criteria && badgeDef.cssClassName && badgeDef.title) {
                let meetsCriteria = false;
                if (badgeDef.criteria.type === "EMAIL_LIST") {
                    if (Array.isArray(badgeDef.criteria.emails) &&
                        badgeDef.criteria.emails.map(e => String(e).toLowerCase()).includes(lowercasedUserEmail)) {
                        meetsCriteria = true;
                    }
                } else {
                    // console.warn(`Unsupported badge criteria type: ${badgeDef.criteria.type}`);
                }

                if (meetsCriteria) {
                    const badgeSpan = document.createElement('span');
                    badgeSpan.classList.add('profile-badge', badgeDef.cssClassName);
                    badgeSpan.title = badgeDef.title;
                    profileBadgesContainer.appendChild(badgeSpan);
                }
            } else {
                console.warn(`Invalid badge definition structure for ID '${badgeId}':`, badgeDef);
            }
        }
    }
}


function updateProfileTitlesAndRank(profileData, allowInteraction) { if (!rankDisplay || !titleDisplay) return; titleDisplay.classList.remove('selectable-title', 'no-title-placeholder'); titleDisplay.removeEventListener('click', handleTitleClick); closeTitleSelector(); if (profileData && typeof profileData === 'object') { const rank = profileData.currentRank || 'Unranked'; const equippedTitle = profileData.equippedTitle || ''; const availableTitles = profileData.availableTitles || []; rankDisplay.textContent = rank; rankDisplay.className = `profile-rank-display rank-${rank.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`; if (allowInteraction && availableTitles.length > 0) { titleDisplay.classList.add('selectable-title'); titleDisplay.addEventListener('click', handleTitleClick); if (equippedTitle) { titleDisplay.textContent = equippedTitle; titleDisplay.classList.remove('no-title-placeholder'); titleDisplay.style.display = 'inline-block'; } else { titleDisplay.textContent = '[Choose Title]'; titleDisplay.classList.add('no-title-placeholder'); titleDisplay.style.display = 'inline-block'; } } else { if (equippedTitle) { titleDisplay.textContent = equippedTitle; titleDisplay.classList.remove('no-title-placeholder'); titleDisplay.style.display = 'inline-block'; } else { titleDisplay.textContent = ''; titleDisplay.style.display = 'none'; } } } else { rankDisplay.textContent = '...'; rankDisplay.className = 'profile-rank-display rank-unranked'; titleDisplay.textContent = ''; titleDisplay.style.display = 'none'; }}
function handleTitleClick(event) { event.stopPropagation(); if (!isOwnProfile || !viewingUserProfileData.profile || !(viewingUserProfileData.profile.availableTitles?.length > 0)) { /* console.log("Title interaction blocked."); */ return; } if (isTitleSelectorOpen) closeTitleSelector(); else openTitleSelector(); }
function openTitleSelector() { if (isTitleSelectorOpen || !profileIdentifiersDiv || !isOwnProfile || !viewingUserProfileData.profile?.availableTitles?.length > 0) return; const availableTitles = viewingUserProfileData.profile.availableTitles; const currentEquippedTitle = viewingUserProfileData.profile.equippedTitle || ''; if (!titleSelectorElement || !profileIdentifiersDiv.contains(titleSelectorElement)) { titleSelectorElement = document.createElement('div'); titleSelectorElement.className = 'title-selector'; profileIdentifiersDiv.appendChild(titleSelectorElement); } titleSelectorElement.innerHTML = ''; if (currentEquippedTitle) { const unequipOpt = document.createElement('button'); unequipOpt.className = 'title-option title-option-unequip'; unequipOpt.dataset.title = ""; unequipOpt.type = 'button'; unequipOpt.textContent = '[Remove Title]'; unequipOpt.onclick = handleTitleOptionClick; titleSelectorElement.appendChild(unequipOpt); } availableTitles.forEach(title => { const optEl = document.createElement('button'); optEl.className = 'title-option'; optEl.dataset.title = title; optEl.type = 'button'; optEl.textContent = title; if (title === currentEquippedTitle) { optEl.classList.add('currently-equipped'); optEl.disabled = true; } optEl.onclick = handleTitleOptionClick; titleSelectorElement.appendChild(optEl); }); titleSelectorElement.style.display = 'block'; isTitleSelectorOpen = true; setTimeout(() => { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }, 0); }
function closeTitleSelector() { if (!isTitleSelectorOpen || !titleSelectorElement) return; titleSelectorElement.style.display = 'none'; isTitleSelectorOpen = false; document.removeEventListener('click', handleClickOutsideTitleSelector, { capture: true }); }
function handleClickOutsideTitleSelector(event) { if (!isTitleSelectorOpen) return; const inside = titleSelectorElement?.contains(event.target); const onTitle = titleDisplay?.contains(event.target); if (!inside && !onTitle) closeTitleSelector(); else setTimeout(() => { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }, 0); }
async function handleTitleOptionClick(event) { event.stopPropagation(); const button = event.currentTarget; const selectedTitle = button.dataset.title; const userId = loggedInUser?.uid; if (!userId || !viewingUserProfileData.profile || viewingUserProfileData.profile.id !== userId) { console.error("Title change validation failed."); closeTitleSelector(); return; } const currentEquipped = viewingUserProfileData.profile.equippedTitle || ''; if (selectedTitle === currentEquipped) { closeTitleSelector(); return; } closeTitleSelector(); titleDisplay.classList.remove('selectable-title', 'no-title-placeholder'); titleDisplay.removeEventListener('click', handleTitleClick); titleDisplay.textContent = "Updating..."; try { const userRef = db.collection('users').doc(userId); await userRef.update({ equippedTitle: selectedTitle }); /* console.log(`Updated title to "${selectedTitle || 'None'}"`); */ viewingUserProfileData.profile.equippedTitle = selectedTitle; if(isOwnProfile && viewerProfileData) viewerProfileData.equippedTitle = selectedTitle; saveCombinedDataToCache(userId, viewingUserProfileData); updateProfileTitlesAndRank(viewingUserProfileData.profile, true); } catch (error) { console.error("Error updating title:", error); alert("Failed to update title."); if(viewingUserProfileData.profile) viewingUserProfileData.profile.equippedTitle = currentEquipped; updateProfileTitlesAndRank(viewingUserProfileData.profile, true); }}

// =============================================================================
// --- IMAGE EDITING (Profile Pic & Background) ---
// =============================================================================
function setupProfilePicEditing() { if (!isOwnProfile || !editProfilePicIcon || !profilePicInput) { if(editProfilePicIcon) editProfilePicIcon.style.display = 'none'; return; } editProfilePicIcon.style.display = 'flex'; editProfilePicIcon.onclick = null; profilePicInput.onchange = null; editProfilePicIcon.onclick = () => profilePicInput.click(); profilePicInput.onchange = handleFileSelect; }
function handleFileSelect(event) { const file = event.target?.files?.[0]; if (!file) { event.target.value = null; return; } if (!file.type.startsWith('image/')) { alert('Please select a valid image file (PNG, JPG, GIF).'); event.target.value = null; return; } const maxSizeMB = 5; if (file.size > maxSizeMB * 1024 * 1024) { alert(`File size exceeds ${maxSizeMB}MB.`); event.target.value = null; return; } const reader = new FileReader(); reader.onload = (e) => { if (e.target?.result) { modalImage.src = e.target.result; openEditModal(); } else { alert("Error reading file."); } }; reader.onerror = (err) => { console.error("FileReader error:", err); alert("Error reading file."); }; reader.readAsDataURL(file); event.target.value = null; }
function openEditModal() { if (!editModal || !modalImage) return; editModal.style.display = 'flex'; modalImage.style.opacity = 0; modalApplyBtn.disabled = false; modalSpinner.style.display = 'none'; const applyTextNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE); if (applyTextNode) applyTextNode.textContent = 'Apply '; if (cropper) { try { cropper.destroy(); } catch(e) {} cropper = null; } setTimeout(() => { try { cropper = new Cropper(modalImage, { aspectRatio: 1 / 1, viewMode: 1, dragMode: 'move', background: false, autoCropArea: 0.9, responsive: true, modal: true, guides: true, center: true, highlight: false, cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false, ready: () => { modalImage.style.opacity = 1; /* console.log("Cropper ready."); */ } }); } catch (cropperError) { console.error("Cropper init error:", cropperError); alert("Could not initialize image editor."); closeEditModal(); } }, 50); modalCloseBtn.onclick = closeEditModal; modalCancelBtn.onclick = closeEditModal; modalApplyBtn.onclick = handleApplyCrop; editModal.onclick = (event) => { if (event.target === editModal) closeEditModal(); }; }
function closeEditModal() { if (!editModal) return; if (cropper) { try { cropper.destroy(); } catch (e) {} cropper = null; } editModal.style.display = 'none'; modalImage.src = ''; modalImage.removeAttribute('src'); modalApplyBtn.disabled = false; modalSpinner.style.display = 'none'; const textNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE); if (textNode) textNode.textContent = 'Apply '; modalCloseBtn.onclick = null; modalCancelBtn.onclick = null; modalApplyBtn.onclick = null; editModal.onclick = null; }
async function handleApplyCrop() { if (!cropper || !loggedInUser || modalApplyBtn.disabled) return; modalApplyBtn.disabled = true; modalSpinner.style.display = 'inline-block'; const textNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE); if (textNode) textNode.textContent = 'Applying '; try { const canvas = cropper.getCroppedCanvas({ width: 512, height: 512, imageSmoothingEnabled: true, imageSmoothingQuality: 'high', }); if (!canvas) throw new Error("Failed to get cropped canvas."); const blob = await new Promise((res, rej) => { canvas.toBlob((blobRes) => blobRes ? res(blobRes) : rej(new Error("Canvas to Blob failed.")), 'image/jpeg', 0.90); }); /* console.log("Blob created:", (blob.size / 1024).toFixed(2), "KB"); */ const imageUrl = await uploadToCloudinary(blob, 'pfp'); await saveProfilePictureUrl(loggedInUser.uid, imageUrl); /* console.log("PFP Updated & Saved:", imageUrl); */ profileImage.src = `${imageUrl}?ts=${Date.now()}`; profileImage.style.display = 'block'; profileInitials.style.display = 'none'; if (viewingUserProfileData?.profile?.id === loggedInUser.uid) { viewingUserProfileData.profile.profilePictureUrl = imageUrl; if (viewerProfileData?.id === loggedInUser.uid) viewerProfileData.profilePictureUrl = imageUrl; saveCombinedDataToCache(loggedInUser.uid, viewingUserProfileData); } closeEditModal(); } catch (error) { console.error("PFP update error:", error); alert(`Failed to update profile picture: ${error.message}`); modalApplyBtn.disabled = false; modalSpinner.style.display = 'none'; if (textNode) textNode.textContent = 'Apply '; } }
async function uploadToCloudinary(fileOrBlob, baseFileName = 'image') {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) throw new Error("Cloudinary config missing.");
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    const formData = new FormData();
    const extension = fileOrBlob.type.split('/')[1] || 'jpg';
    const filename = `${baseFileName}_${loggedInUser?.uid || 'anon'}_${Date.now()}.${extension}`;
    formData.append('file', fileOrBlob, filename);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    // console.log(`Uploading ${baseFileName} to Cloudinary as ${filename}...`);
    try {
        const response = await fetch(url, { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) { console.error("Cloudinary Upload Error:", data); throw new Error(data.error?.message || `Upload failed (Status: ${response.status}).`); }
        if (!data.secure_url) { console.error("Cloudinary response missing secure_url:", data); throw new Error("Upload success but no URL returned."); }
        return data.secure_url;
    } catch (networkError) { console.error("Cloudinary network error:", networkError); throw new Error(`Network error during upload.`); }
}
async function saveProfilePictureUrl(userId, imageUrl) { if (!userId || !imageUrl) throw new Error("Missing userId or imageUrl for PFP save."); const userRef = db.collection("users").doc(userId); try { await userRef.update({ profilePictureUrl: imageUrl }); /* console.log("Saved PFP URL to Firestore."); */ } catch (error) { console.error(`Error saving PFP URL for ${userId}:`, error); throw new Error("DB error saving PFP link."); }}

function setupBackgroundEditing() {
    if (!isOwnProfile || !editBackgroundIcon || !removeBackgroundIcon || !backgroundInput) { if(editBackgroundIcon) editBackgroundIcon.style.display = 'none'; if(removeBackgroundIcon) removeBackgroundIcon.style.display = 'none'; return; }
    const hasBackground = viewingUserProfileData.profile && viewingUserProfileData.profile.profileBackgroundUrl;
    editBackgroundIcon.style.display = 'flex'; removeBackgroundIcon.style.display = hasBackground ? 'flex' : 'none';
    editBackgroundIcon.onclick = () => backgroundInput.click();
    backgroundInput.onchange = handleBackgroundFileSelect;
    removeBackgroundIcon.onclick = handleRemoveBackground;
    editBackgroundIcon.style.pointerEvents = 'auto'; removeBackgroundIcon.style.pointerEvents = 'auto';
    editBackgroundIcon.innerHTML = '<i class="fas fa-image"></i>'; removeBackgroundIcon.innerHTML = '<i class="fas fa-trash-alt"></i>';
}
async function handleBackgroundFileSelect(event) {
    const file = event.target?.files?.[0]; if (!file) { event.target.value = null; return; }
    if (!file.type.startsWith('image/')) { alert('Please select a valid image file.'); event.target.value = null; return; }
    if (file.size > 10 * 1024 * 1024) { alert(`File size exceeds 10MB.`); event.target.value = null; return; }
    if (!loggedInUser) { alert("You must be logged in."); event.target.value = null; return; }
    if (editBackgroundIcon) { editBackgroundIcon.innerHTML = '<div class="spinner" style="border-top-color: white; width:1em; height:1em; margin:0 auto;"></div>'; editBackgroundIcon.style.pointerEvents = 'none'; }
    if (removeBackgroundIcon) removeBackgroundIcon.style.pointerEvents = 'none';
    try {
        const imageUrl = await uploadToCloudinary(file, 'background');
        await saveProfileBackgroundUrl(loggedInUser.uid, imageUrl);
        // console.log("Profile background Updated & Saved:", imageUrl);
        updateProfileBackground(imageUrl);
        if (viewingUserProfileData?.profile?.id === loggedInUser.uid) { viewingUserProfileData.profile.profileBackgroundUrl = imageUrl; if (viewerProfileData?.id === loggedInUser.uid) viewerProfileData.profileBackgroundUrl = imageUrl; saveCombinedDataToCache(loggedInUser.uid, viewingUserProfileData); }
        if (removeBackgroundIcon) removeBackgroundIcon.style.display = 'flex';
    } catch (error) { console.error("Profile background update error:", error); alert(`Failed to update profile background: ${error.message}`);
    } finally { if (editBackgroundIcon) { editBackgroundIcon.innerHTML = '<i class="fas fa-image"></i>'; editBackgroundIcon.style.pointerEvents = 'auto'; } if (removeBackgroundIcon) removeBackgroundIcon.style.pointerEvents = 'auto'; event.target.value = null; }
}
async function saveProfileBackgroundUrl(userId, imageUrl) { if (!userId) throw new Error("Missing userId for saving background URL."); const userRef = db.collection("users").doc(userId); try { await userRef.update({ profileBackgroundUrl: imageUrl }); /* console.log("Saved Profile Background URL to Firestore:", imageUrl); */ } catch (error) { console.error(`Error saving Profile Background URL for ${userId}:`, error); throw new Error("DB error saving profile background link."); }}
async function handleRemoveBackground() {
    if (!loggedInUser) { alert("You must be logged in."); return; }
    if (!confirm("Are you sure you want to remove your custom profile background?")) return;
    if (removeBackgroundIcon) { removeBackgroundIcon.innerHTML = '<div class="spinner" style="border-top-color: white; width:1em; height:1em; margin:0 auto;"></div>'; removeBackgroundIcon.style.pointerEvents = 'none'; }
    if (editBackgroundIcon) editBackgroundIcon.style.pointerEvents = 'none';
    try {
        await saveProfileBackgroundUrl(loggedInUser.uid, null);
        // console.log("Profile background removed.");
        updateProfileBackground(null);
        if (viewingUserProfileData?.profile?.id === loggedInUser.uid) { viewingUserProfileData.profile.profileBackgroundUrl = null; if (viewerProfileData?.id === loggedInUser.uid) viewerProfileData.profileBackgroundUrl = null; saveCombinedDataToCache(loggedInUser.uid, viewingUserProfileData); }
        if (removeBackgroundIcon) removeBackgroundIcon.style.display = 'none';
    } catch (error) { console.error("Error removing profile background:", error); alert(`Failed to remove profile background: ${error.message}`);
    } finally { if (removeBackgroundIcon) removeBackgroundIcon.innerHTML = '<i class="fas fa-trash-alt"></i>'; if (editBackgroundIcon) editBackgroundIcon.style.pointerEvents = 'auto'; setupBackgroundEditing(); }
}

// =============================================================================
// --- FRIEND SYSTEM ---
// =============================================================================
async function fetchUserMiniProfile(userId) { if (!userId) return null; if (miniProfileCache[userId]?.displayName) return miniProfileCache[userId]; try { const userSnap = await db.collection('users').doc(userId).get(); if (userSnap.exists) { const data = userSnap.data(); const miniProfile = { id: userId, displayName: data.displayName || `User...`, profilePictureUrl: data.profilePictureUrl || null, }; miniProfileCache[userId] = miniProfile; return miniProfile; } else { /* console.warn(`Mini profile not found for ${userId}`); */ miniProfileCache[userId] = { id: userId, displayName: "User Not Found", profilePictureUrl: null }; return miniProfileCache[userId]; } } catch (error) { console.error(`Error fetching mini profile for ${userId}:`, error); return { id: userId, displayName: "Error Loading User", profilePictureUrl: null }; }}
function determineFriendshipStatus(viewerUid, profileOwnerUid) { if (!viewerUid || !profileOwnerUid || viewerUid === profileOwnerUid || !viewerProfileData?.friends) return 'none'; return viewerProfileData.friends[profileOwnerUid] || 'none'; }
function clearFriendshipControls() { if (friendshipControlsContainer) friendshipControlsContainer.innerHTML = ''; }
function resetFriendsSection() { if (friendsSection) friendsSection.style.display = 'none'; const buttons = friendsTabsContainer?.querySelectorAll('.tab-button'); const contents = friendsSection?.querySelectorAll('.tab-content'); buttons?.forEach((btn, idx) => { btn.classList.toggle('active', idx === 0); if(btn.dataset.tab === 'incoming-requests' && incomingCountSpan) incomingCountSpan.textContent = '0'; if(btn.dataset.tab === 'outgoing-requests' && outgoingCountSpan) outgoingCountSpan.textContent = '0'; }); contents?.forEach((content, idx) => { content.classList.toggle('active', idx === 0); const list = content.querySelector('ul'); if (list) list.innerHTML = `<li class="list-message">Loading...</li>`; }); }
function displayFriendshipControls(status, profileOwnerUid) { clearFriendshipControls(); if (!friendshipControlsContainer || !loggedInUser || isOwnProfile) return; friendshipControlsContainer.style.minHeight = '40px'; let btn1 = null, btn2 = null; const actions = { 'none': ()=>btn1=createFriendActionButton('Add Friend', 'sendRequest', 'primary', profileOwnerUid), 'outgoing': ()=>btn1=createFriendActionButton('Cancel Request', 'cancelRequest', 'secondary cancel', profileOwnerUid), 'incoming': ()=>{ btn1=createFriendActionButton('Accept', 'acceptRequest', 'primary accept small', profileOwnerUid); btn2=createFriendActionButton('Decline', 'declineRequest', 'secondary decline small', profileOwnerUid); }, 'friend': ()=>btn1=createFriendActionButton('Remove Friend', 'removeFriend', 'secondary remove', profileOwnerUid), }; actions[status]?.(); if(btn1) friendshipControlsContainer.appendChild(btn1); if(btn2) friendshipControlsContainer.appendChild(btn2); }
async function displayFriendsSection(profileData) { if (!isOwnProfile || !friendsSection || !profileData || typeof profileData.friends !== 'object') { resetFriendsSection(); return; } if (!friendsListUl || !incomingListUl || !outgoingListUl || !incomingCountSpan || !outgoingCountSpan || !friendsTabsContainer) { console.error("Friend section elements missing."); resetFriendsSection(); return; } /* console.log("Displaying friends section..."); */ friendsSection.style.display = 'block'; const friendsMap = profileData.friends || {}; const friendIds = [], incomingIds = [], outgoingIds = []; for (const uid in friendsMap) { if (friendsMap.hasOwnProperty(uid)) { switch (friendsMap[uid]) { case 'friend': friendIds.push(uid); break; case 'incoming': incomingIds.push(uid); break; case 'outgoing': outgoingIds.push(uid); break; } } } incomingCountSpan.textContent = incomingIds.length; outgoingCountSpan.textContent = outgoingIds.length; try { await Promise.all([ populateFriendList(friendsListUl, friendIds, 'friend', 'You have no friends yet.'), populateFriendList(incomingListUl, incomingIds, 'incoming', 'No incoming friend requests.'), populateFriendList(outgoingListUl, outgoingIds, 'outgoing', 'No outgoing friend requests.') ]); } catch(listError) { console.error("Error populating friend lists:", listError); } if (friendsTabsContainer && !friendsTabsContainer.dataset.listenerAttached) { friendsTabsContainer.addEventListener('click', (e) => { const clickedBtn = e.target.closest('.tab-button'); if (clickedBtn) { const targetId = clickedBtn.dataset.tab; if (!targetId) return; const btns = friendsTabsContainer.querySelectorAll('.tab-button'); const contents = friendsSection.querySelectorAll('.tab-content'); btns.forEach(b => b.classList.remove('active')); contents.forEach(c => c.classList.remove('active')); clickedBtn.classList.add('active'); const targetContent = friendsSection.querySelector(`#${targetId}-container`); if (targetContent) targetContent.classList.add('active'); else console.error(`Target content not found: #${targetId}-container`); } }); friendsTabsContainer.dataset.listenerAttached = 'true'; } }
async function populateFriendList(ulEl, userIds, type, emptyMsg) { if (!ulEl) return; ulEl.innerHTML = ''; if (!userIds || userIds.length === 0) { ulEl.innerHTML = `<li class="list-message">${emptyMsg}</li>`; return; } ulEl.innerHTML = `<li class="list-message">Loading...</li>`; const profilePromises = userIds.map(id => fetchUserMiniProfile(id).catch(err => { console.error(`Error fetching mini profile for ${id} in list ${type}:`, err); return { id: id, displayName: "Error Loading", profilePictureUrl: null }; })); const profiles = await Promise.all(profilePromises); const validProfiles = profiles.filter(p => p !== null); ulEl.innerHTML = ''; let itemsAdded = 0; validProfiles.forEach(prof => { if (prof?.id && prof.displayName) { if (prof.displayName === "Error Loading User" || prof.displayName === "User Not Found") { ulEl.appendChild(createFriendListItemError(prof.id, prof.displayName)); } else { ulEl.appendChild(createFriendListItem(prof, type)); itemsAdded++; } } else { console.warn(`Skipping invalid profile in list ${type}:`, prof); } }); if (itemsAdded === 0 && validProfiles.length > 0) ulEl.innerHTML = `<li class="list-message">Could not load details.</li>`; else if (ulEl.childElementCount === 0) ulEl.innerHTML = `<li class="list-message">${emptyMsg}</li>`; }
function createFriendListItem(miniProf, type) { const li = document.createElement('li'); li.className = 'friend-item'; li.dataset.userId = miniProf.id; const infoDiv = document.createElement('div'); infoDiv.className = 'friend-item-info'; const pfpEl = createFriendPfpElement(miniProf); infoDiv.appendChild(pfpEl); const nameSpan = document.createElement('span'); nameSpan.className = 'friend-item-name'; const nameLink = document.createElement('a'); nameLink.href = `profile.html?uid=${miniProf.id}`; nameLink.textContent = miniProf.displayName; nameLink.title = `View ${miniProf.displayName}'s profile`; nameSpan.appendChild(nameLink); infoDiv.appendChild(nameSpan); li.appendChild(infoDiv); const actionsDiv = document.createElement('div'); actionsDiv.className = 'friend-item-actions'; let btn1=null, btn2=null; const actions = { friend: ()=>btn1 = createFriendActionButton('Remove', 'removeFriend', 'secondary', miniProf.id, li), incoming: ()=>{ btn1 = createFriendActionButton('Accept', 'acceptRequest', 'primary', miniProf.id, li); btn2 = createFriendActionButton('Decline', 'declineRequest', 'secondary', miniProf.id, li); }, outgoing: ()=>btn1 = createFriendActionButton('Cancel', 'cancelRequest', 'secondary', miniProf.id, li) }; actions[type]?.(); if(btn1) actionsDiv.appendChild(btn1); if(btn2) actionsDiv.appendChild(btn2); li.appendChild(actionsDiv); return li; }
function createFriendPfpElement(miniProf) { const container = document.createElement('div'); container.style.cssText = 'width:40px; height:40px; flex-shrink:0; position:relative;'; const initialDiv = document.createElement('div'); initialDiv.className = 'friend-item-pfp-initial'; initialDiv.textContent = miniProf.displayName?.charAt(0)?.toUpperCase() || '?'; initialDiv.style.display = 'flex'; container.appendChild(initialDiv); if (miniProf.profilePictureUrl) { const img = document.createElement('img'); img.src = miniProf.profilePictureUrl; img.alt = `${miniProf.displayName || 'User'} PFP`; img.className = 'friend-item-pfp'; img.style.display = 'none'; img.onload = () => { initialDiv.style.display = 'none'; img.style.display = 'block'; }; img.onerror = () => { /* console.warn(`Failed PFP load for ${miniProf.id}`); */ img.style.display = 'none'; initialDiv.style.display = 'flex'; }; container.appendChild(img); } return container; }
function createFriendActionButton(text, actionName, styleClasses, userId, listItem) { const btn = document.createElement('button'); btn.textContent = text; btn.className = `btn btn-${styleClasses.replace(/ /g,' btn-')} btn-small`; btn.onclick = (e) => handleFriendAction(e.currentTarget, actionName, userId, listItem); btn.title = `${text}`; return btn; }
function createFriendListItemError(userId, msg) { const li = document.createElement('li'); li.className = 'friend-item list-message'; li.dataset.userId = userId; li.innerHTML = `<div class="friend-item-info" style="opacity:0.6;"><div class="friend-item-pfp-initial" style="background-color:var(--text-secondary);">?</div><span class="friend-item-name">${msg}</span></div><div class="friend-item-actions"></div>`; return li; }
async function handleFriendAction(buttonElement, action, otherUserId, listItemToRemove = null) { if (!loggedInUser || !otherUserId || !buttonElement) { console.error("Friend action validation failed."); alert("Action failed. Please ensure you are logged in."); return; } const currentUserUid = loggedInUser.uid; if (typeof action !== 'string' || !action) { console.error(`handleFriendAction called with invalid action: ${action} for otherUserId: ${otherUserId}`); alert("An error occurred with the friend action. Invalid action type."); if (buttonElement) { buttonElement.disabled = false; } return; } buttonElement.disabled = true; const originalText = buttonElement.textContent; buttonElement.textContent = '...'; const actionContainer = buttonElement.closest('.friend-item-actions, #friendship-controls-container'); const siblingButtons = actionContainer ? Array.from(actionContainer.querySelectorAll('button')) : []; siblingButtons.forEach(btn => { if (btn !== buttonElement) btn.disabled = true; }); const userDocRef = db.collection('users').doc(currentUserUid); const otherUserDocRef = db.collection('users').doc(otherUserId); const batch = db.batch(); try { /* console.log(`Action: ${action} between ${currentUserUid} and ${otherUserId}`); */ const deleteField = firebase.firestore.FieldValue.delete(); const ops = { sendRequest: () => { batch.update(userDocRef, {[`friends.${otherUserId}`]: 'outgoing'}); batch.update(otherUserDocRef, {[`friends.${currentUserUid}`]: 'incoming'}); }, cancelRequest: () => { batch.update(userDocRef, {[`friends.${otherUserId}`]: deleteField}); batch.update(otherUserDocRef, {[`friends.${currentUserUid}`]: deleteField}); }, declineRequest: () => { batch.update(userDocRef, {[`friends.${otherUserId}`]: deleteField}); batch.update(otherUserDocRef, {[`friends.${currentUserUid}`]: deleteField}); }, removeFriend: () => { batch.update(userDocRef, {[`friends.${otherUserId}`]: deleteField}); batch.update(otherUserDocRef, {[`friends.${currentUserUid}`]: deleteField}); }, acceptRequest: () => { batch.update(userDocRef, {[`friends.${otherUserId}`]: 'friend'}); batch.update(otherUserDocRef, {[`friends.${currentUserUid}`]: 'friend'}); } }; if (!ops[action]) { throw new Error(`Invalid action: ${action}`); } ops[action](); await batch.commit(); /* console.log("Friend action batch committed."); */ delete miniProfileCache[currentUserUid]; delete miniProfileCache[otherUserId]; try { const viewerSnap = await userDocRef.get(); if (viewerSnap.exists) { viewerProfileData = { id: viewerSnap.id, ...(viewerSnap.data() || {}) }; if (!viewerProfileData.friends) viewerProfileData.friends = {}; if (isOwnProfile) { viewingUserProfileData.profile = viewerProfileData; saveCombinedDataToCache(currentUserUid, viewingUserProfileData); } /* console.log("Refreshed viewer data post-action."); */ } else { console.error("Failed to refetch viewer profile data after friend action!"); } } catch (fetchError) { console.error("Error refetching viewer profile after friend action:", fetchError); } if (isOwnProfile) { displayFriendsSection(viewerProfileData); } else if (viewingUserProfileData.profile?.id === otherUserId) { const newStatus = determineFriendshipStatus(currentUserUid, otherUserId); displayFriendshipControls(newStatus, otherUserId); } if (listItemToRemove && (action === 'acceptRequest' || action === 'declineRequest' || action === 'cancelRequest' || action === 'removeFriend')) { listItemToRemove.remove(); } } catch (error) { console.error(`Error in '${action}':`, error); alert(`Error: ${error.message || 'Failed friend action.'}.`); buttonElement.disabled = false; buttonElement.textContent = originalText; siblingButtons.forEach(btn => { if (btn !== buttonElement) btn.disabled = false; }); }}

// =============================================================================
// --- AUTHENTICATION AND INITIALIZATION ---
// =============================================================================
auth.onAuthStateChanged(async (user) => {
    // console.log(`Auth state changed. User: ${user ? user.uid : 'None'}`);
    loggedInUser = user;
    const targetUid = profileUidFromUrl || loggedInUser?.uid;
    viewerProfileData = null; viewingUserProfileData = {}; miniProfileCache = {};
    isOwnProfile = loggedInUser && targetUid === loggedInUser.uid;

    // Ensure dynamic definitions are fetched early
    const definitionPromises = [];
    if (!allBadgeDefinitions) {
        definitionPromises.push(fetchAllBadgeDefinitions());
    }
    if (!allAchievements) { // Fetch achievements always or conditionally based on your needs
        definitionPromises.push(fetchAllAchievements());
    }
    if (definitionPromises.length > 0) {
        try {
            await Promise.all(definitionPromises);
            // console.log("Initial definitions (badges/achievements) fetched.");
        } catch (defError) {
            console.error("Error fetching initial definitions:", defError);
        }
    }

    if (targetUid) {
        // console.log(`Targeting profile UID: ${targetUid}`);
        if (loadingIndicator) loadingIndicator.style.display = 'flex';
        if (notLoggedInMsg) notLoggedInMsg.style.display = 'none';
        if (profileContent) profileContent.style.display = 'none';
        if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none';
        if (friendsSection) friendsSection.style.display = 'none';
        updateProfileBackground(null);
        if (editBackgroundIcon) editBackgroundIcon.style.display = 'none';
        if (removeBackgroundIcon) removeBackgroundIcon.style.display = 'none';

        try {
            await loadCombinedUserData(targetUid); // This function uses the fetched definitions
            // console.log("Initial data load process completed for target UID.");
            if (viewingUserProfileData.profile) {
                if (isOwnProfile) {
                    setupProfilePicEditing();
                    // setupBackgroundEditing() is called within loadCombinedUserData if isOwnProfile
                } else {
                    if(editProfilePicIcon) editProfilePicIcon.style.display = 'none';
                    if(editBackgroundIcon) editBackgroundIcon.style.display = 'none';
                    if(removeBackgroundIcon) removeBackgroundIcon.style.display = 'none';
                }
                if (profileLogoutBtn) profileLogoutBtn.style.display = isOwnProfile ? 'inline-block' : 'none';
            } else {
                if(profileLogoutBtn) profileLogoutBtn.style.display = 'none';
            }
        } catch (err) {
            console.error("Critical error during profile load sequence:", err);
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            if (profileContent) profileContent.style.display = 'none';
            if (notLoggedInMsg) { notLoggedInMsg.textContent = 'Failed to load profile. An unexpected error occurred.'; notLoggedInMsg.style.display = 'flex'; }
            if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none';
            if (friendsSection) friendsSection.style.display = 'none';
            if(profileLogoutBtn) profileLogoutBtn.style.display = 'none';
            clearFriendshipControls(); resetFriendsSection(); updateProfileBackground(null);
            if (editBackgroundIcon) editBackgroundIcon.style.display = 'none';
            if (removeBackgroundIcon) removeBackgroundIcon.style.display = 'none';
        }
    } else {
        // console.log('No user logged in and no profile UID in URL.');
        if (loadingIndicator) loadingIndicator.style.display = 'none'; if (profileContent) profileContent.style.display = 'none'; if (notLoggedInMsg) { notLoggedInMsg.style.display = 'flex'; notLoggedInMsg.innerHTML = 'Please <a href="index.html#login" style="color: var(--primary-orange); margin: 0 5px;">log in</a> to view your profile, or provide a user ID.'; }
        if (adminTag) adminTag.style.display = 'none'; if (profileBadgesContainer) profileBadgesContainer.innerHTML = ''; if (profileLogoutBtn) profileLogoutBtn.style.display = 'none'; if (editProfilePicIcon) editProfilePicIcon.style.display = 'none'; updateProfileTitlesAndRank(null, false); if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = ''; if (poxelStatsSection) poxelStatsSection.style.display = 'none'; updateProfileBackground(null); closeTitleSelector(); closeEditModal(); clearFriendshipControls(); resetFriendsSection(); if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none'; viewingUserProfileData = {}; viewerProfileData = null; miniProfileCache = {};
        if (editBackgroundIcon) editBackgroundIcon.style.display = 'none';
        if (removeBackgroundIcon) removeBackgroundIcon.style.display = 'none';
        if (backgroundInput) backgroundInput.onchange = null;
    }
});

// --- Logout Button Event Listener ---
if (profileLogoutBtn) profileLogoutBtn.addEventListener('click', () => { const userId = loggedInUser?.uid; /* console.log(`Logout requested by: ${userId || 'N/A'}`); */ if (titleDisplay) titleDisplay.removeEventListener('click', handleTitleClick); closeTitleSelector(); closeEditModal(); clearFriendshipControls(); resetFriendsSection(); if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none'; if (editProfilePicIcon) editProfilePicIcon.onclick = null; if (profilePicInput) profilePicInput.onchange = null;
    if (editBackgroundIcon) { editBackgroundIcon.onclick = null; editBackgroundIcon.style.display = 'none';}
    if (removeBackgroundIcon) { removeBackgroundIcon.onclick = null; removeBackgroundIcon.style.display = 'none';}
    if (backgroundInput) backgroundInput.onchange = null;
    auth.signOut().then(() => { /* console.log('Sign out successful.'); */ if (userId) localStorage.removeItem(`poxelProfileCombinedData_${userId}`); loggedInUser = null; viewerProfileData = null; viewingUserProfileData = {}; miniProfileCache = {}; isOwnProfile = false; window.location.href = 'index.html'; }).catch((error) => { console.error('Sign out error:', error); alert('Error signing out.'); }); });

// =============================================================================
// --- LOCAL STORAGE CACHING ---
// =============================================================================
function loadCombinedDataFromCache(viewedUserId) {
    if (!viewedUserId) return false;
    const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
    try {
        const cachedStr = localStorage.getItem(cacheKey); if (!cachedStr) return false;
        const cachedData = JSON.parse(cachedStr);
        if (cachedData?.profile?.id === viewedUserId) {
            cachedData.profile.friends = cachedData.profile.friends || {};
            cachedData.profile.leaderboardStats = cachedData.profile.leaderboardStats || {};
            cachedData.profile.availableTitles = cachedData.profile.availableTitles || [];
            cachedData.profile.equippedTitle = cachedData.profile.equippedTitle ?? "";
            cachedData.profile.currentRank = cachedData.profile.currentRank || "Unranked";
            cachedData.profile.profileBackgroundUrl = cachedData.profile.profileBackgroundUrl || null;
            cachedData.stats = cachedData.stats || null;
            viewingUserProfileData = cachedData;
            // console.log("Loaded combined data from cache for:", viewedUserId);
            const viewingOwnCached = loggedInUser && loggedInUser.uid === viewedUserId;
            if (viewingUserProfileData.profile.profileBackgroundUrl) updateProfileBackground(viewingUserProfileData.profile.profileBackgroundUrl);
            else updateProfileBackground(null);
            displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats, viewingOwnCached);
            return true;
        } else { /* console.warn(`Cache mismatch for ${viewedUserId}. Removing.`); */ localStorage.removeItem(cacheKey); return false; }
    } catch (error) { console.error("Cache load/parse error:", error); try { localStorage.removeItem(cacheKey); } catch (e) {} return false; }
}
function saveCombinedDataToCache(viewedUserId, combinedData) {
    if (!viewedUserId || !combinedData?.profile?.id || viewedUserId !== combinedData.profile.id) { console.warn("Cache save validation failed.", { viewedUserId, profileId: combinedData?.profile?.id }); return; }
    const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
    try {
        const dataToSave = {
            profile: { ...combinedData.profile, friends: combinedData.profile.friends || {}, availableTitles: combinedData.profile.availableTitles || [], equippedTitle: combinedData.profile.equippedTitle ?? "", currentRank: combinedData.profile.currentRank || "Unranked", leaderboardStats: combinedData.profile.leaderboardStats || {}, profileBackgroundUrl: combinedData.profile.profileBackgroundUrl || null },
            stats: combinedData.stats || null
        };
        localStorage.setItem(cacheKey, JSON.stringify(dataToSave));
    } catch (error) { console.error(`Cache save error for ${viewedUserId}:`, error); if (error.name === 'QuotaExceededError' || error.message?.toLowerCase().includes('quota')) { console.warn('LocalStorage quota exceeded.'); } }
}

// --- Initial Log ---
console.log("Profile script initialized. Waiting for Auth state...");
