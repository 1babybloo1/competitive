// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI", // Replace if necessary, keep private
    authDomain: "poxelcomp.firebaseapp.com",
    projectId: "poxelcomp",
    storageBucket: "poxelcomp.appspot.com", // Standard storage bucket domain
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
const CLOUDINARY_CLOUD_NAME = "djttn4xvk";
const CLOUDINARY_UPLOAD_PRESET = "compmanage";

// --- URL Parameter Parsing & Logged-in User Check ---
const urlParams = new URLSearchParams(window.location.search);
const profileUidFromUrl = urlParams.get('uid');
let loggedInUser = null;

// --- Admin Emails & Badge Config ---
const adminEmails = [
    'trixdesignsofficial@gmail.com',
    'jackdmbell@outlook.com',
    'myrrr@myrrr.myrrr'
].map(email => email.toLowerCase());
const badgeConfig = {
    verified: { emails: ['jackdmbell@outlook.com', 'myrrr@myrrr.myrrr', 'leezak5555@gmail.com'].map(e => e.toLowerCase()), className: 'badge-verified', title: 'Verified' },
    creator: { emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()), className: 'badge-creator', title: 'Content Creator' },
    moderator: { emails: ['jackdmbell@outlook.com', 'mod_team@sample.org'].map(e => e.toLowerCase()), className: 'badge-moderator', title: 'Moderator' } // Add actual moderator emails
};

// --- DOM Elements ---
const profileArea = document.getElementById('profile-area');
const loadingIndicator = document.getElementById('loading-profile');
const notLoggedInMsg = document.getElementById('not-logged-in');
const profileHeaderArea = document.getElementById('profile-header-area');
const profileBanner = document.getElementById('profile-banner');
const editBannerIcon = document.getElementById('edit-banner-icon');
const bannerInput = document.getElementById('banner-input');
const profilePicDiv = document.getElementById('profile-pic');
const profileImage = document.getElementById('profile-image');
const profileInitials = document.getElementById('profile-initials');
const editProfilePicIcon = document.getElementById('edit-profile-pic-icon');
const profilePicInput = document.getElementById('profile-pic-input');
const profileInfoArea = document.getElementById('profile-info-area');
const usernameDisplay = document.getElementById('profile-username');
const emailDisplay = document.getElementById('profile-email');
const adminTag = document.getElementById('admin-tag');
const rankDisplay = document.getElementById('profile-rank');
const titleDisplay = document.getElementById('profile-title');
const profileIdentifiersDiv = document.querySelector('.profile-identifiers');
const profileBadgesContainer = document.getElementById('profile-badges-container');
const friendshipControlsContainer = document.getElementById('friendship-controls-container');
const competitiveStatsSectionWrapper = document.getElementById('competitive-stats-section-wrapper');
const competitiveStatsSection = document.getElementById('competitive-stats-section');
const competitiveStatsDisplay = document.getElementById('stats-display');
const poxelStatsSectionWrapper = document.getElementById('poxel-stats-section-wrapper'); // Reference
const poxelStatsSection = document.getElementById('poxel-stats-section');
const poxelStatsDisplay = document.getElementById('poxel-stats-display');
const friendsSectionWrapper = document.getElementById('friends-section-wrapper');
const friendsSection = document.getElementById('friends-section');
const friendsListUl = document.getElementById('friends-list');
const incomingListUl = document.getElementById('incoming-requests-list');
const outgoingListUl = document.getElementById('outgoing-requests-list');
const incomingCountSpan = document.getElementById('incoming-count');
const outgoingCountSpan = document.getElementById('outgoing-count');
const friendsTabsContainer = document.querySelector('.friends-tabs');
const achievementsSectionOuter = document.getElementById('achievements-section-outer');
const achievementsSection = document.getElementById('achievements-section');
const achievementsListContainer = document.getElementById('achievements-list-container');
const profileLogoutBtn = document.getElementById('profile-logout-btn');
const editModal = document.getElementById('edit-modal');
const modalTitle = document.getElementById('modal-title');
const modalImage = document.getElementById('image-to-crop');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalApplyBtn = document.getElementById('modal-apply-btn');
const modalSpinner = document.getElementById('modal-spinner');

// --- Global/Scoped Variables ---
let allAchievements = null;
let viewingUserProfileData = {};
let viewerProfileData = null;
let miniProfileCache = {};
let isTitleSelectorOpen = false;
let titleSelectorElement = null;
let cropper = null;
let isOwnProfile = false;
let croppingFor = null;

// =============================================================================
// --- CORE FUNCTIONS ---
// =============================================================================
async function fetchPoxelStats(username) {
    // ... (Function content unchanged) ...
    if (!username || typeof username !== 'string' || username.trim() === '') { return null; }
    console.log(`Fetching Poxel.io stats for: ${username}`);
    try {
        const apiUrl = `https://dev-usa-1.poxel.io/api/profile/stats/${encodeURIComponent(username)}`;
        const res = await fetch(apiUrl, { headers: { "Content-Type": "application/json" } });
        if (!res.ok) {
            let errorMsg = `HTTP error ${res.status}`;
             if (res.status === 404) { errorMsg = "User not found on Poxel.io"; }
             else { try { const errorData = await res.json(); errorMsg = errorData.message || errorData.error || errorMsg; } catch (parseError) {} }
            throw new Error(errorMsg);
        }
        const data = await res.json();
        if (typeof data !== 'object' || data === null) throw new Error("Invalid data format from Poxel.io API.");
        if (data.error || data.status === 'error') {
            if (data.message && data.message.toLowerCase().includes('not found')) { throw new Error('User not found on Poxel.io'); }
            throw new Error(data.message || 'Poxel.io API error.');
        }
        return data;
    } catch (e) {
        console.error("Error fetching Poxel.io stats:", e.message || e);
        return null;
    }
}

async function fetchAllAchievements() {
    // ... (Function content unchanged) ...
    if (allAchievements) return allAchievements;
    console.log("Fetching all achievement definitions...");
    try {
        const snapshot = await db.collection('achievements').get();
        const fetchedAchievements = {};
        snapshot.forEach(doc => {
            fetchedAchievements[doc.id] = { id: doc.id, ...doc.data() };
        });
        if (Object.keys(fetchedAchievements).length > 0) {
             allAchievements = fetchedAchievements;
             console.log(`Fetched ${Object.keys(allAchievements).length} achievement definitions.`);
             return allAchievements;
        } else {
             console.warn("Fetched achievement definitions but the result is empty.");
             allAchievements = {};
             return null;
        }
    } catch (error) {
        console.error("Error fetching achievement definitions:", error);
        allAchievements = {};
        return null;
    }
}

function areStatsDifferent(newStats, existingProfileStats) {
    // ... (Function content unchanged) ...
    const normNew = newStats || {}; const normExisting = existingProfileStats || {}; const statKeys = ['wins', 'points', 'kdRatio', 'matchesPlayed', 'matches', 'losses']; let different = false;
    for (const key of statKeys) { let newValue = normNew[key]; let existingValue = normExisting[key]; if(key === 'matchesPlayed' && !normNew.hasOwnProperty('matchesPlayed') && normNew.hasOwnProperty('matches')) { newValue = normNew.matches; } if(key === 'matchesPlayed' && !normExisting.hasOwnProperty('matchesPlayed') && normExisting.hasOwnProperty('matches')) { existingValue = normExisting.matches; } newValue = newValue ?? null; existingValue = existingValue ?? null; if (key === 'kdRatio' && typeof newValue === 'number' && typeof existingValue === 'number') { if (Math.abs(newValue - existingValue) > 0.001) { different = true; break; } } else if (newValue !== existingValue) { different = true; break; } }
    if (!different) { const newRelevantKeys = Object.keys(normNew).filter(k => statKeys.includes(k) || (k === 'matches' && statKeys.includes('matchesPlayed'))); const existingRelevantKeys = Object.keys(normExisting).filter(k => statKeys.includes(k)|| (k === 'matches' && statKeys.includes('matchesPlayed'))); if (newRelevantKeys.length !== existingRelevantKeys.length) { different = true; } else { const newSet = new Set(newRelevantKeys); if (!existingRelevantKeys.every(key => newSet.has(key))) { different = true; } } } return different;
}

async function createUserProfileDocument(userId, authUser) {
    // ... (Function content unchanged) ...
    if (!userId || !authUser) { return null; }
    console.warn(`Client-side: Creating missing user profile doc for UID: ${userId}`);
    const userDocRef = db.collection("users").doc(userId);
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;
    const defaultProfileData = { email: authUser.email ? authUser.email.toLowerCase() : null, displayName: displayName, currentRank: "Unranked", equippedTitle: "", availableTitles: [], friends: {}, createdAt: firebase.firestore.FieldValue.serverTimestamp(), leaderboardStats: {}, profilePictureUrl: authUser.photoURL || null, bannerUrl: null, poxelStats: {} };
    try { await userDocRef.set(defaultProfileData, { merge: false }); console.log(`Successfully created user profile document for UID: ${userId} via client`); return { id: userId, ...defaultProfileData, createdAt: new Date() };
    } catch (error) { console.error(`Error creating user profile document client-side for UID ${userId}:`, error); return null; }
}

async function loadCombinedUserData(targetUserId) {
    // ... (Function content unchanged) ...
    console.log(`Loading combined user data for TARGET UID: ${targetUserId}`); isOwnProfile = loggedInUser && loggedInUser.uid === targetUserId; console.log("Is viewing own profile:", isOwnProfile); viewerProfileData = null; miniProfileCache = {}; viewingUserProfileData = {}; if (profileArea) profileArea.style.display = 'none'; if (notLoggedInMsg) notLoggedInMsg.style.display = 'none'; if (loadingIndicator) loadingIndicator.style.display = 'flex'; if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = '<p class="list-message">Loading...</p>'; if (poxelStatsDisplay) poxelStatsDisplay.innerHTML = '<p class="list-message">Loading...</p>'; if (achievementsListContainer) achievementsListContainer.innerHTML = '<p class="list-message">Loading...</p>'; if(competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'none'; if(poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'none'; if(achievementsSectionOuter) achievementsSectionOuter.style.display = 'none'; if(friendsSectionWrapper) friendsSectionWrapper.style.display = 'none'; updateProfileTitlesAndRank(null, false); displayBanner(null); clearFriendshipControls(); resetFriendsSection();
    const cacheLoaded = loadCombinedDataFromCache(targetUserId); if (!allAchievements) fetchAllAchievements();
    if (loggedInUser && !isOwnProfile) { try { const viewerSnap = await db.collection('users').doc(loggedInUser.uid).get(); if (viewerSnap.exists) { viewerProfileData = { id: viewerSnap.id, ...viewerSnap.data() }; if (!viewerProfileData.friends) viewerProfileData.friends = {}; } else { viewerProfileData = await createUserProfileDocument(loggedInUser.uid, loggedInUser); if (!viewerProfileData) viewerProfileData = { id: loggedInUser.uid, friends: {} }; } } catch (viewerError) { viewerProfileData = { id: loggedInUser.uid, friends: {} }; } }
    const userProfileRef = db.collection('users').doc(targetUserId); const leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId); let userUnlockedAchievementIds = [];
    try { if (isOwnProfile) { userUnlockedAchievementIds = await fetchUserUnlockedAchievements(targetUserId); }
        let profileSnap = await userProfileRef.get(); let profileData = null; if (!profileSnap || !profileSnap.exists) { if (isOwnProfile && loggedInUser) { profileData = await createUserProfileDocument(targetUserId, loggedInUser); if (!profileData) throw new Error(`Profile creation failed`); } else { throw new Error(`Profile not found`); } } else { profileData = { id: profileSnap.id, ...profileSnap.data() }; if (profileData.leaderboardStats === undefined) profileData.leaderboardStats = {}; if (profileData.profilePictureUrl === undefined) profileData.profilePictureUrl = null; if (profileData.bannerUrl === undefined) profileData.bannerUrl = null; if (profileData.friends === undefined) profileData.friends = {}; if (profileData.email) profileData.email = profileData.email.toLowerCase(); } if (isOwnProfile) { viewerProfileData = profileData; if (!viewerProfileData.friends) viewerProfileData.friends = {}; }
        let competitiveStatsData = null; if(profileData) { const statsSnap = await leaderboardStatsRef.get(); competitiveStatsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null; }
        if (profileData && competitiveStatsData) { if (areStatsDifferent(competitiveStatsData, profileData.leaderboardStats)) { try { const statsToSave = { ...competitiveStatsData }; delete statsToSave.id; await userProfileRef.update({ leaderboardStats: statsToSave }); profileData.leaderboardStats = statsToSave; } catch (updateError) { console.error(`Error syncing stats:`, updateError); } } }
        viewingUserProfileData = { profile: profileData, stats: competitiveStatsData };
        displayProfileData(viewingUserProfileData.profile, isOwnProfile); displayBanner(viewingUserProfileData.profile?.bannerUrl); saveCombinedDataToCache(targetUserId, viewingUserProfileData);
        if (competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'block'; displayCompetitiveStats(viewingUserProfileData.stats);
        if (loggedInUser) { if (isOwnProfile) { displayFriendsSection(profileData); } else if (viewerProfileData){ const status = determineFriendshipStatus(loggedInUser.uid, targetUserId); displayFriendshipControls(status, targetUserId); } }
        if (profileData?.displayName) { if(poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'block'; fetchPoxelStats(profileData.displayName) .then(poxelStatsData => displayPoxelStats(poxelStatsData)) .catch(poxelError => displayPoxelStats(null, poxelError.message || 'Error loading stats.')); } else { displayPoxelStats(null, 'Poxel username not found.'); if(poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'block'; }
        if (isOwnProfile) { await displayAchievementsSection(viewingUserProfileData.stats, userUnlockedAchievementIds); }
        if (isOwnProfile && viewingUserProfileData.stats) { let definitions = allAchievements; if (!definitions) definitions = await fetchAllAchievements(); if (definitions) { const potentiallyUpdatedProfile = await checkAndGrantAchievements(targetUserId, viewingUserProfileData.profile, viewingUserProfileData.stats); if (potentiallyUpdatedProfile) { viewingUserProfileData.profile = potentiallyUpdatedProfile; viewerProfileData = viewingUserProfileData.profile; saveCombinedDataToCache(targetUserId, viewingUserProfileData); displayProfileData(viewingUserProfileData.profile, isOwnProfile); displayBanner(viewingUserProfileData.profile.bannerUrl); const latestUnlockedIds = await fetchUserUnlockedAchievements(targetUserId); await displayAchievementsSection(viewingUserProfileData.stats, latestUnlockedIds); displayFriendsSection(viewingUserProfileData.profile); } } else { console.warn("Skipping achievement grant check: definitions failed load."); } }
        if (profileArea) profileArea.style.display = 'block';
    } catch (error) { console.error(`Error loading profile data:`, error); let errorMessage = 'Error loading profile data.'; if (error.message?.includes('Profile not found')) { errorMessage = 'Profile not found.'; viewingUserProfileData.profile = null; } if (profileArea) profileArea.style.display = 'none'; if (notLoggedInMsg) { notLoggedInMsg.textContent = errorMessage; notLoggedInMsg.style.display = 'flex'; } updateProfileTitlesAndRank(null, false); displayBanner(null); if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = '<p class="list-message">Error</p>'; if(competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'block'; if (poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'none'; if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none'; clearFriendshipControls(); resetFriendsSection();
    } finally { if (loadingIndicator) loadingIndicator.style.display = 'none'; }
}

function displayBanner(imageUrl) {
    // ... (Function content unchanged) ...
    if (!profileBanner) return;
    if (imageUrl) { profileBanner.style.backgroundImage = `url('${imageUrl}')`; }
    else { profileBanner.style.backgroundImage = 'none'; }
}

function displayProfileData(profileData, isOwner) {
    // ... (Function content unchanged) ...
    if (!profileData || !profileArea) { if(profileArea) profileArea.style.display = 'none'; if (notLoggedInMsg) { notLoggedInMsg.textContent = 'Profile data unavailable.'; notLoggedInMsg.style.display = 'flex'; } return; }
    profileArea.style.display = 'block'; const displayName = profileData.displayName || 'Anonymous User'; usernameDisplay.textContent = displayName; if (profileData.profilePictureUrl) { profileImage.src = profileData.profilePictureUrl; profileImage.style.display = 'block'; profileInitials.style.display = 'none'; profileImage.onerror = () => { profileImage.style.display = 'none'; profileInitials.textContent = displayName?.charAt(0)?.toUpperCase() || '?'; profileInitials.style.display = 'flex'; }; } else { profileImage.style.display = 'none'; profileImage.src = ''; profileInitials.textContent = displayName?.charAt(0)?.toUpperCase() || '?'; profileInitials.style.display = 'flex'; } editProfilePicIcon.style.display = isOwner ? 'flex' : 'none'; editBannerIcon.style.display = isOwner ? 'flex' : 'none'; displayUserBadges(profileData); updateProfileTitlesAndRank(profileData, isOwner); if (isOwner) { setupProfilePicEditing(); setupBannerEditing(); }
}

function displayCompetitiveStats(statsData) {
    // ... (Function content unchanged) ...
    if (!competitiveStatsDisplay) return; competitiveStatsDisplay.innerHTML = ''; if (!statsData || typeof statsData !== 'object' || Object.keys(statsData).length === 0) { competitiveStatsDisplay.innerHTML = '<p class="list-message">Stats unavailable.</p>'; return; } const statsMap = { wins: 'Wins', points: 'Points', kdRatio: 'K/D Ratio', matchesPlayed: 'Matches Played', losses: 'Losses' }; if (!statsData.hasOwnProperty('matchesPlayed') && statsData.hasOwnProperty('matches')) { statsMap.matches = 'Matches Played'; delete statsMap.matchesPlayed; } let statsAdded = 0; for (const key in statsMap) { if (statsData.hasOwnProperty(key)) { let value = statsData[key]; let displayValue = value; if (key === 'kdRatio' && typeof value === 'number') { displayValue = value.toFixed(2); } else if (value === null || value === undefined){ displayValue = '-'; } competitiveStatsDisplay.appendChild(createStatItem(statsMap[key], displayValue)); statsAdded++; } } if (statsAdded === 0) { competitiveStatsDisplay.innerHTML = '<p class="list-message">No stats found.</p>'; }
}

// --- displayPoxelStats (FIXED) ---
function displayPoxelStats(poxelData, message = null) {
    // ADDED check for the wrapper element here
    if (!poxelStatsDisplay || !poxelStatsSection || !poxelStatsSectionWrapper) {
         console.error("Poxel stats display elements (wrapper, section, or display) not found in DOM.");
         return; // Exit if any required element is missing
    }

    poxelStatsDisplay.innerHTML = ''; // Clear previous content
    poxelStatsSectionWrapper.style.display = 'block'; // Now it's safe to access style

    if (message) { // If an explicit message is passed (e.g., error or loading)
         poxelStatsDisplay.innerHTML = `<p class="list-message">${message}</p>`;
         return;
     }

    if (!poxelData || typeof poxelData !== 'object' || Object.keys(poxelData).length === 0) {
         poxelStatsDisplay.innerHTML = '<p class="list-message">Poxel.io stats unavailable.</p>'; // Generic message if no data and no error message
         return;
    }

    // Map API fields to display names
    const statsMap = {
         kills: 'Kills', deaths: 'Deaths', wins: 'Wins', losses: 'Losses',
         level: 'Level', playtimeHours: 'Playtime (Hours)', gamesPlayed: 'Games Played'
    };
    let statsAdded = 0;

    // Display mapped stats
    for (const key in statsMap) {
         if (poxelData.hasOwnProperty(key) && poxelData[key] !== null && poxelData[key] !== undefined) {
             let value = poxelData[key];
             if (key === 'playtimeHours' && typeof value === 'number') value = value.toFixed(1);
             poxelStatsDisplay.appendChild(createStatItem(statsMap[key], value));
             statsAdded++;
         }
    }

    // Calculate and add K/D specifically
    if (poxelData.hasOwnProperty('kills') && poxelData.hasOwnProperty('deaths') && poxelData.deaths !== null && poxelData.kills !== null) {
         const kills = Number(poxelData.kills) || 0;
         const deaths = Number(poxelData.deaths) || 0;
         const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
         poxelStatsDisplay.appendChild(createStatItem('Poxel K/D', kd));
         statsAdded++;
    }

    if (statsAdded === 0) {
        poxelStatsDisplay.innerHTML = '<p class="list-message">No relevant Poxel.io stats found.</p>';
    }
}


function createStatItem(title, value) {
    // ... (Function content unchanged) ...
    const itemDiv = document.createElement('div'); itemDiv.classList.add('stat-item'); const titleH4 = document.createElement('h4'); titleH4.textContent = title; const valueP = document.createElement('p'); valueP.textContent = (value !== null && value !== undefined) ? value : '-'; itemDiv.appendChild(titleH4); itemDiv.appendChild(valueP); return itemDiv;
}

async function fetchUserUnlockedAchievements(userId) {
    // ... (Function content unchanged) ...
    if (!userId) return []; try { const ref = db.collection('userAchievements').doc(userId); const doc = await ref.get(); return doc.exists ? (doc.data()?.unlocked || []) : []; } catch (e) { console.error(`Err fetch achievements ${userId}:`, e); return []; }
}

function calculateAchievementProgress(achievement, userStats) {
    // ... (Function content unchanged) ...
    const criteria = achievement?.criteria || {}; const targetValue = criteria.value || 0; const operator = criteria.operator || '>='; const statKey = criteria.stat; if (userStats === null || userStats === undefined || !statKey) { const meets = operator === '>=' && (0 >= targetValue); return { progress: 0, currentValue: 0, targetValue, meetsCriteria: meets }; } let currentValue = userStats[statKey]; if(statKey === 'matchesPlayed' && !userStats.hasOwnProperty('matchesPlayed') && userStats.hasOwnProperty('matches')) { currentValue = userStats.matches; } currentValue = Number(currentValue) || 0; if (statKey === 'kdRatio' && typeof currentValue === 'number') { currentValue = parseFloat(currentValue.toFixed(2)); } if (targetValue <= 0) { const meets = operator === '>=' ? currentValue >= targetValue : operator === '==' ? currentValue == targetValue : false; return { progress: (meets ? 100 : 0), currentValue, targetValue, meetsCriteria: meets }; } let progressPercent = 0; let meetsCriteria = false; switch (operator) { case '>=': meetsCriteria = currentValue >= targetValue; progressPercent = (currentValue / targetValue) * 100; break; case '==': meetsCriteria = currentValue == targetValue; progressPercent = meetsCriteria ? 100 : 0; break; default: meetsCriteria = false; progressPercent = 0; break; } progressPercent = Math.max(0, Math.min(100, progressPercent)); return { progress: Math.floor(progressPercent), currentValue, targetValue, meetsCriteria };
}

async function displayAchievementsSection(competitiveStats, unlockedAchievementIds) {
    // ... (Function content updated in previous step, logic is correct now) ...
    if (!achievementsSectionOuter || !achievementsListContainer) { return; } if (!isOwnProfile) { achievementsSectionOuter.style.display = 'none'; return; }
    let currentAchievements = allAchievements; if (!currentAchievements) { console.log("Achiev fetch attempt..."); currentAchievements = await fetchAllAchievements(); if (!currentAchievements || Object.keys(currentAchievements).length === 0) { console.error("Failed Achiev load/empty."); achievementsListContainer.innerHTML = '<p class="list-message">Could not load definitions.</p>'; achievementsSectionOuter.style.display = 'block'; if (!allAchievements) allAchievements = {}; return; } }
    achievementsListContainer.innerHTML = ''; achievementsSectionOuter.style.display = 'block'; const achievementIds = Object.keys(currentAchievements || {}); if (achievementIds.length === 0) { achievementsListContainer.innerHTML = '<p class="list-message">No achievements defined.</p>'; return; }
    console.log(`Displaying ${achievementIds.length} achievements.`); achievementIds.forEach(id => { const ach = currentAchievements[id]; if (!ach?.name || !ach?.criteria) { return; } const isUnlocked = unlockedAchievementIds?.includes(id) || false; const progInfo = calculateAchievementProgress(ach, competitiveStats); const isDispComp = isUnlocked || progInfo.meetsCriteria; const itemDiv = document.createElement('div'); itemDiv.className = `achievement-item ${isUnlocked ? 'achievement-unlocked' : ''} ${isDispComp ? 'achievement-completed' : ''}`; let rewHtml = ''; if (ach.rewards) { const parts = []; if (ach.rewards.title) parts.push(`Title: <strong>${ach.rewards.title}</strong>`); if (ach.rewards.rank) parts.push(`Rank: <strong>${ach.rewards.rank}</strong>`); if (parts.length > 0) { rewHtml = `<div class="achievement-rewards">Reward${parts.length > 1 ? 's': ''}: ${parts.join(', ')}</div>`; } } let progTxt = `${progInfo.progress}%`; let progTitle = ''; const isNumProg = ach.criteria.stat && typeof ach.criteria.value === 'number' && ach.criteria.value > 0 && ach.criteria.operator === '>='; if (isDispComp) { progTxt = "Completed"; progTitle = isNumProg ? `${ach.criteria.stat}: ${progInfo.currentValue}/${progInfo.targetValue} (Done)` : "Completed"; } else if (isNumProg) { progTxt = `${progInfo.currentValue}/${progInfo.targetValue} (${progInfo.progress}%)`; progTitle = `${ach.criteria.stat}: ${progInfo.currentValue}/${progInfo.targetValue}`; } else { progTitle = ach.criteria.stat ? `${ach.criteria.stat} Progress` : 'Progress'; } itemDiv.innerHTML = `<h4><span>${ach.name}</span>${isDispComp ? '<span class="completion-icon" title="Completed!">✔</span>' : ''}</h4><p class="achievement-description">${ach.description || 'No description.'}</p>${ach.criteria.stat && ach.criteria.value !== undefined ? `<div class="achievement-progress-container" title="${progTitle}"><div class="achievement-progress-bar" style="width: ${progInfo.progress}%;"><span>${progTxt}</span></div></div>` : '<div style="height: 5px;"></div>'}${rewHtml}`; achievementsListContainer.appendChild(itemDiv); });
    if (achievementsListContainer.childElementCount === 0 && achievementIds.length > 0) { achievementsListContainer.innerHTML = '<p class="list-message">Could not display achievements.</p>'; } else if (achievementIds.length === 0) { achievementsListContainer.innerHTML = '<p class="list-message">No achievements defined yet.</p>'; }
}


async function checkAndGrantAchievements(userId, currentUserProfile, competitiveStats) {
    // ... (Function content unchanged) ...
    if (!allAchievements || Object.keys(allAchievements).length === 0 || !userId || !currentUserProfile || !competitiveStats) { return null; } console.log(`Checking achievements for UID ${userId}...`); let profileToUpdate = { ...currentUserProfile, availableTitles: currentUserProfile.availableTitles || [], equippedTitle: currentUserProfile.equippedTitle !== undefined ? currentUserProfile.equippedTitle : "", currentRank: currentUserProfile.currentRank || "Unranked", friends: currentUserProfile.friends || {}, leaderboardStats: currentUserProfile.leaderboardStats || {}, bannerUrl: currentUserProfile.bannerUrl || null }; try { const userAchievementsRef = db.collection('userAchievements').doc(userId); let unlockedIds = []; try { const doc = await userAchievementsRef.get(); if (doc.exists) { unlockedIds = doc.data()?.unlocked || []; } } catch(fetchError) { unlockedIds = []; } let newAchievementsUnlocked = []; let needsProfileUpdate = false; let needsUserAchievementsUpdate = false; let bestRankReward = null; const rankOrder = ["Unranked", "Bronze", "Silver", "Gold", "Platinum", "Veteran", "Legend"]; for (const achievementId in allAchievements) { if (unlockedIds.includes(achievementId)) continue; const achievement = allAchievements[achievementId]; if (!achievement?.criteria) continue; const progressInfo = calculateAchievementProgress(achievement, competitiveStats); if (progressInfo.meetsCriteria) { if (!newAchievementsUnlocked.includes(achievementId)) { newAchievementsUnlocked.push(achievementId); needsUserAchievementsUpdate = true; } if (achievement.rewards) { if (achievement.rewards.title && !profileToUpdate.availableTitles.includes(achievement.rewards.title)) { profileToUpdate.availableTitles.push(achievement.rewards.title); needsProfileUpdate = true; if (profileToUpdate.equippedTitle === "") { profileToUpdate.equippedTitle = achievement.rewards.title; } } if (achievement.rewards.rank) { const currentIdx = rankOrder.indexOf(profileToUpdate.currentRank); const newIdx = rankOrder.indexOf(achievement.rewards.rank); const bestIdx = bestRankReward ? rankOrder.indexOf(bestRankReward) : -1; if (newIdx > Math.max(currentIdx, bestIdx)) { bestRankReward = achievement.rewards.rank; needsProfileUpdate = true; } } if (achievement.rewards.bannerUrl && !profileToUpdate.bannerUrl) { profileToUpdate.bannerUrl = achievement.rewards.bannerUrl; needsProfileUpdate = true; } } } } if (bestRankReward) { const currentIdx = rankOrder.indexOf(profileToUpdate.currentRank); const bestIdx = rankOrder.indexOf(bestRankReward); if (bestIdx > currentIdx) { profileToUpdate.currentRank = bestRankReward; } } if (needsProfileUpdate || needsUserAchievementsUpdate) { const batch = db.batch(); const userProfileRef = db.collection('users').doc(userId); if (needsUserAchievementsUpdate && newAchievementsUnlocked.length > 0) { batch.set(userAchievementsRef, { unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsUnlocked) }, { merge: true }); } if (needsProfileUpdate) { const profileUpdateData = {}; if (JSON.stringify(profileToUpdate.availableTitles) !== JSON.stringify(currentUserProfile.availableTitles || [])) { profileUpdateData.availableTitles = profileToUpdate.availableTitles; } if (profileToUpdate.equippedTitle !== (currentUserProfile.equippedTitle !== undefined ? currentUserProfile.equippedTitle : "")) { profileUpdateData.equippedTitle = profileToUpdate.equippedTitle; } if (profileToUpdate.currentRank !== (currentUserProfile.currentRank || "Unranked")) { profileUpdateData.currentRank = profileToUpdate.currentRank; } if (profileToUpdate.bannerUrl !== (currentUserProfile.bannerUrl || null)) { profileUpdateData.bannerUrl = profileToUpdate.bannerUrl; } if (Object.keys(profileUpdateData).length > 0) { batch.update(userProfileRef, profileUpdateData); } else { needsProfileUpdate = false; } } if (needsProfileUpdate || needsUserAchievementsUpdate) { await batch.commit(); return profileToUpdate; } else { return null; } } else { return null; } } catch (error) { console.error(`Error checking/granting achievements for ${userId}:`, error); return null; }
}

// =============================================================================
// --- UI Display Helpers ---
// =============================================================================
function displayUserBadges(profileData) {
     // ... (Function content unchanged) ...
     if (!profileBadgesContainer || !adminTag) return; profileBadgesContainer.innerHTML = ''; adminTag.style.display = 'none'; const userEmail = profileData?.email; if (!userEmail) return; if (adminEmails.includes(userEmail)) { adminTag.style.display = 'inline-block'; } for (const badgeType in badgeConfig) { const config = badgeConfig[badgeType]; if (config.emails.includes(userEmail)) { const badgeSpan = document.createElement('span'); badgeSpan.classList.add('profile-badge', config.className); badgeSpan.setAttribute('title', config.title); profileBadgesContainer.appendChild(badgeSpan); } }
}
function updateProfileTitlesAndRank(profileData, allowInteraction) {
    // ... (Function content unchanged) ...
    if (!rankDisplay || !titleDisplay) return; titleDisplay.classList.remove('selectable-title', 'no-title-placeholder'); titleDisplay.removeEventListener('click', handleTitleClick); closeTitleSelector(); if (profileData && typeof profileData === 'object') { const rank = profileData.currentRank || 'Unranked'; const equippedTitle = profileData.equippedTitle || ''; const availableTitles = profileData.availableTitles || []; rankDisplay.textContent = rank; rankDisplay.className = `profile-rank-display rank-${rank.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`; if (allowInteraction && availableTitles.length > 0) { titleDisplay.classList.add('selectable-title'); titleDisplay.addEventListener('click', handleTitleClick); if (equippedTitle) { titleDisplay.textContent = equippedTitle; titleDisplay.classList.remove('no-title-placeholder'); titleDisplay.style.display = 'inline-block'; } else { titleDisplay.textContent = '[Choose Title]'; titleDisplay.classList.add('no-title-placeholder'); titleDisplay.style.display = 'inline-block'; } } else { if (equippedTitle) { titleDisplay.textContent = equippedTitle; titleDisplay.classList.remove('no-title-placeholder'); titleDisplay.style.display = 'inline-block'; } else { titleDisplay.textContent = ''; titleDisplay.style.display = 'none'; } } } else { rankDisplay.textContent = '...'; rankDisplay.className = 'profile-rank-display rank-unranked'; titleDisplay.textContent = ''; titleDisplay.style.display = 'none'; }
}
function handleTitleClick(event) { /* ... (Function content unchanged) ... */ event.stopPropagation(); if (!isOwnProfile || !viewingUserProfileData.profile || !(viewingUserProfileData.profile.availableTitles?.length > 0)) { return; } if (isTitleSelectorOpen) { closeTitleSelector(); } else { openTitleSelector(); } }
function openTitleSelector() { /* ... (Function content unchanged) ... */ if (isTitleSelectorOpen || !profileIdentifiersDiv || !isOwnProfile || !viewingUserProfileData.profile?.availableTitles?.length > 0) return; const availableTitles = viewingUserProfileData.profile.availableTitles; const currentEquippedTitle = viewingUserProfileData.profile.equippedTitle || ''; if (!titleSelectorElement || !profileIdentifiersDiv.contains(titleSelectorElement)) { titleSelectorElement = document.createElement('div'); titleSelectorElement.className = 'title-selector'; profileIdentifiersDiv.appendChild(titleSelectorElement); } titleSelectorElement.innerHTML = ''; if (currentEquippedTitle) { const opt = document.createElement('button'); opt.className = 'title-option title-option-unequip'; opt.dataset.title = ""; opt.type = 'button'; opt.textContent = '[Remove Title]'; opt.onclick = handleTitleOptionClick; titleSelectorElement.appendChild(opt); } availableTitles.forEach(title => { const opt = document.createElement('button'); opt.className = 'title-option'; opt.dataset.title = title; opt.type = 'button'; opt.textContent = title; if (title === currentEquippedTitle) { opt.classList.add('currently-equipped'); opt.disabled = true; } opt.onclick = handleTitleOptionClick; titleSelectorElement.appendChild(opt); }); titleSelectorElement.style.display = 'block'; isTitleSelectorOpen = true; setTimeout(() => { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }, 0); }
function closeTitleSelector() { /* ... (Function content unchanged) ... */ if (!isTitleSelectorOpen || !titleSelectorElement) return; titleSelectorElement.style.display = 'none'; isTitleSelectorOpen = false; document.removeEventListener('click', handleClickOutsideTitleSelector, { capture: true }); }
function handleClickOutsideTitleSelector(event) { /* ... (Function content unchanged) ... */ if (!isTitleSelectorOpen) return; const isInside = titleSelectorElement?.contains(event.target); const isOnTitle = titleDisplay?.contains(event.target); if (!isInside && !isOnTitle) { closeTitleSelector(); } else { setTimeout(() => { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }, 0); } }
async function handleTitleOptionClick(event) { /* ... (Function content unchanged) ... */ event.stopPropagation(); const buttonElement = event.currentTarget; const selectedTitle = buttonElement.dataset.title; const currentUserId = loggedInUser?.uid; if (!currentUserId || !viewingUserProfileData.profile || viewingUserProfileData.profile.id !== currentUserId) { closeTitleSelector(); return; } const currentlyEquippedTitle = viewingUserProfileData.profile.equippedTitle || ''; if (selectedTitle === currentlyEquippedTitle) { closeTitleSelector(); return; } closeTitleSelector(); titleDisplay.classList.remove('selectable-title', 'no-title-placeholder'); titleDisplay.removeEventListener('click', handleTitleClick); titleDisplay.textContent = "Updating..."; try { const userProfileRef = db.collection('users').doc(currentUserId); await userProfileRef.update({ equippedTitle: selectedTitle }); viewingUserProfileData.profile.equippedTitle = selectedTitle; if(isOwnProfile && viewerProfileData) viewerProfileData.equippedTitle = selectedTitle; saveCombinedDataToCache(currentUserId, viewingUserProfileData); updateProfileTitlesAndRank(viewingUserProfileData.profile, true); } catch (error) { console.error("Error updating title:", error); alert("Failed to update title."); if(viewingUserProfileData.profile) { viewingUserProfileData.profile.equippedTitle = currentlyEquippedTitle; updateProfileTitlesAndRank(viewingUserProfileData.profile, true); } else { updateProfileTitlesAndRank(null, false); } } }

// =============================================================================
// --- Image Editing Functions ---
// =============================================================================
function setupProfilePicEditing() { /* ... (Function content unchanged) ... */ if (!isOwnProfile || !editProfilePicIcon || !profilePicInput) { if(editProfilePicIcon) editProfilePicIcon.style.display = 'none'; return; } editProfilePicIcon.style.display = 'flex'; editProfilePicIcon.onclick = null; profilePicInput.onchange = null; editProfilePicIcon.onclick = () => { croppingFor = 'pfp'; profilePicInput.click(); }; profilePicInput.onchange = (event) => { handleFileSelect(event); }; }
function setupBannerEditing() { /* ... (Function content unchanged) ... */ if (!isOwnProfile || !editBannerIcon || !bannerInput) { if(editBannerIcon) editBannerIcon.style.display = 'none'; return; } editBannerIcon.style.display = 'flex'; editBannerIcon.onclick = null; bannerInput.onchange = null; editBannerIcon.onclick = () => { croppingFor = 'banner'; bannerInput.click(); }; bannerInput.onchange = (event) => { handleFileSelect(event); }; console.log("Banner editing listeners attached."); }
function handleFileSelect(event) { /* ... (Function content unchanged) ... */ const file = event.target?.files?.[0]; if (!file) { event.target.value = null; return; } if (!file.type.startsWith('image/')) { alert('Invalid image file.'); event.target.value = null; return; } const maxSizeMB = 8; if (file.size > maxSizeMB * 1024 * 1024) { alert(`File exceeds ${maxSizeMB}MB limit.`); event.target.value = null; return; } const reader = new FileReader(); reader.onload = (e) => { if (e.target?.result) { modalImage.src = e.target.result; openEditModal(); } else { alert("Error reading file."); } }; reader.onerror = (err) => { alert("Error reading file."); }; reader.readAsDataURL(file); event.target.value = null; }
function openEditModal() { /* ... (Function content unchanged) ... */ if (!editModal || !modalImage || !modalImage.src) { return; } modalTitle.textContent = (croppingFor === 'banner') ? 'Edit Banner Image' : 'Edit Profile Picture'; editModal.style.display = 'flex'; modalImage.style.opacity = 0; modalApplyBtn.disabled = false; modalSpinner.style.display = 'none'; const txt = Array.from(modalApplyBtn.childNodes).find(n => n.nodeType === Node.TEXT_NODE); if (txt) txt.textContent = 'Apply '; if (cropper) { try { cropper.destroy(); } catch(e) {} cropper = null; } const cropperOptions = { viewMode: 1, dragMode: 'move', background: false, autoCropArea: 0.9, responsive: true, modal: true, guides: true, center: true, highlight: false, cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false, ready: () => { modalImage.style.opacity = 1; console.log("Cropper ready for:", croppingFor); } }; if (croppingFor === 'pfp') { cropperOptions.aspectRatio = 1 / 1; } else if (croppingFor === 'banner') { cropperOptions.aspectRatio = 3 / 1; } else { closeEditModal(); return; } setTimeout(() => { try { cropper = new Cropper(modalImage, cropperOptions); } catch (e) { console.error("Cropper init error:", e); alert("Could not init editor."); closeEditModal(); } }, 50); modalCloseBtn.onclick = closeEditModal; modalCancelBtn.onclick = closeEditModal; modalApplyBtn.onclick = handleApplyCrop; editModal.onclick = (e) => { if (e.target === editModal) closeEditModal(); }; }
function closeEditModal() { /* ... (Function content unchanged) ... */ if (!editModal) return; if (cropper) { try { cropper.destroy(); } catch (e) {} cropper = null; } editModal.style.display = 'none'; modalImage.src = ''; modalImage.removeAttribute('src'); croppingFor = null; modalApplyBtn.disabled = false; modalSpinner.style.display = 'none'; const txt = Array.from(modalApplyBtn.childNodes).find(n => n.nodeType === Node.TEXT_NODE); if (txt) txt.textContent = 'Apply '; modalCloseBtn.onclick = null; modalCancelBtn.onclick = null; modalApplyBtn.onclick = null; editModal.onclick = null; }
async function handleApplyCrop() { /* ... (Function content unchanged) ... */ if (!cropper || !loggedInUser || !croppingFor) { alert("Cannot apply crop."); return; } if (modalApplyBtn.disabled) return; modalApplyBtn.disabled = true; modalSpinner.style.display = 'inline-block'; const txt = Array.from(modalApplyBtn.childNodes).find(n => n.nodeType === Node.TEXT_NODE); if (txt) txt.textContent = 'Applying '; try { const outputWidth = (croppingFor === 'banner') ? 1500 : 512; const outputHeight = (croppingFor === 'banner') ? 500 : 512; const canvas = cropper.getCroppedCanvas({ width: outputWidth, height: outputHeight, imageSmoothingEnabled: true, imageSmoothingQuality: 'high' }); if (!canvas) throw new Error("Failed to get canvas."); const blob = await new Promise((res, rej) => { canvas.toBlob((b) => { if (b) res(b); else rej(new Error("Blob conversion failed.")); }, 'image/jpeg', 0.90); }); const imageUrl = await uploadToCloudinary(blob, croppingFor); await saveImageUrlToFirestore(loggedInUser.uid, imageUrl, croppingFor); if (croppingFor === 'pfp') { profileImage.src = `${imageUrl}?t=${Date.now()}`; profileImage.style.display = 'block'; profileInitials.style.display = 'none'; } else if (croppingFor === 'banner') { displayBanner(imageUrl); } if (viewingUserProfileData?.profile?.id === loggedInUser.uid) { if (croppingFor === 'pfp') { viewingUserProfileData.profile.profilePictureUrl = imageUrl; } else if (croppingFor === 'banner') { viewingUserProfileData.profile.bannerUrl = imageUrl; } if (viewerProfileData?.id === loggedInUser.uid) { if (croppingFor === 'pfp') viewerProfileData.profilePictureUrl = imageUrl; else if (croppingFor === 'banner') viewerProfileData.bannerUrl = imageUrl; } saveCombinedDataToCache(loggedInUser.uid, viewingUserProfileData); } closeEditModal(); } catch (error) { console.error(`Error during ${croppingFor} save:`, error); alert(`Failed to update ${croppingFor}: ${error.message || 'Unknown error.'}`); modalApplyBtn.disabled = false; modalSpinner.style.display = 'none'; if (txt) txt.textContent = 'Apply '; } }
async function uploadToCloudinary(blob, type = 'image') { /* ... (Function content unchanged) ... */ if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) { throw new Error("Cloudinary config missing."); } const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`; const formData = new FormData(); const filename = `${type}_${loggedInUser?.uid || 'anon'}_${Date.now()}.jpg`; formData.append('file', blob, filename); formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET); if (type === 'banner') { formData.append('folder', 'user_banners'); } else if (type === 'pfp') { formData.append('folder', 'user_pfps'); } console.log(`Uploading ${type} to Cloudinary...`); try { const response = await fetch(url, { method: 'POST', body: formData }); const data = await response.json(); if (!response.ok) { throw new Error(data.error?.message || `Cloudinary upload failed: ${response.status}`); } if (!data.secure_url) { throw new Error("Upload succeeded but missing secure URL."); } return data.secure_url; } catch (e) { throw new Error(`Network error during image upload.`); } }
async function saveImageUrlToFirestore(userId, imageUrl, type) { /* ... (Function content unchanged) ... */ if (!userId || !imageUrl || !type) { throw new Error("Missing data for saving image URL."); } const userDocRef = db.collection("users").doc(userId); const fieldToUpdate = (type === 'banner') ? 'bannerUrl' : 'profilePictureUrl'; try { await userDocRef.update({ [fieldToUpdate]: imageUrl }); console.log(`Successfully updated ${fieldToUpdate} for ${userId}`); } catch (e) { throw new Error(`Database error saving ${type} link.`); } }

// =============================================================================
// --- Friend System Functions ---
// =============================================================================
async function fetchUserMiniProfile(userId) { /* ... (Function content unchanged) ... */ if (!userId) return null; if (miniProfileCache[userId]?.displayName) { return miniProfileCache[userId]; } try { const userSnap = await db.collection('users').doc(userId).get(); if (userSnap.exists) { const data = userSnap.data(); const miniProfile = { id: userId, displayName: data.displayName || `User...`, profilePictureUrl: data.profilePictureUrl || null }; miniProfileCache[userId] = miniProfile; return miniProfile; } else { miniProfileCache[userId] = { id: userId, displayName: "User Not Found", profilePictureUrl: null }; return miniProfileCache[userId]; } } catch (error) { return { id: userId, displayName: "Error Loading User", profilePictureUrl: null }; } }
function determineFriendshipStatus(viewerUid, profileOwnerUid) { /* ... (Function content unchanged) ... */ if (!viewerUid || !profileOwnerUid || viewerUid === profileOwnerUid || !viewerProfileData?.friends) { return 'none'; } return viewerProfileData.friends[profileOwnerUid] || 'none'; }
function clearFriendshipControls() { /* ... (Function content unchanged) ... */ if (friendshipControlsContainer) { friendshipControlsContainer.innerHTML = ''; } }
function resetFriendsSection() { /* ... (Function content unchanged) ... */ if (friendsSectionWrapper) friendsSectionWrapper.style.display = 'none'; if (friendsSection) { const btns = friendsTabsContainer?.querySelectorAll('.tab-button'); const conts = friendsSection.querySelectorAll('.tab-content'); btns?.forEach((btn, i) => { btn.classList.toggle('active', i === 0); if(btn.dataset.tab === 'incoming-requests' && incomingCountSpan) incomingCountSpan.textContent = '0'; if(btn.dataset.tab === 'outgoing-requests' && outgoingCountSpan) outgoingCountSpan.textContent = '0'; }); conts?.forEach((c, i) => { c.classList.toggle('active', i === 0); const list = c.querySelector('ul.friend-request-list'); if (list) list.innerHTML = `<li class="list-message">Loading...</li>`; }); } }
function displayFriendshipControls(status, profileOwnerUid) { /* ... (Function content unchanged) ... */ clearFriendshipControls(); if (!friendshipControlsContainer || !loggedInUser || isOwnProfile) { return; } friendshipControlsContainer.style.minHeight = '40px'; let btn1 = null, btn2 = null; const act = handleFriendAction; switch (status) { case 'none': btn1 = document.createElement('button'); btn1.textContent = 'Add Friend'; btn1.className = 'btn btn-primary'; btn1.onclick = (e) => act(e.currentTarget, 'sendRequest', profileOwnerUid); break; case 'outgoing': btn1 = document.createElement('button'); btn1.textContent = 'Cancel Request'; btn1.className = 'btn btn-secondary btn-cancel'; btn1.onclick = (e) => act(e.currentTarget, 'cancelRequest', profileOwnerUid); break; case 'incoming': btn1 = document.createElement('button'); btn1.textContent = 'Accept'; btn1.className = 'btn btn-primary btn-accept btn-small'; btn1.onclick = (e) => act(e.currentTarget, 'acceptRequest', profileOwnerUid); btn2 = document.createElement('button'); btn2.textContent = 'Decline'; btn2.className = 'btn btn-secondary btn-decline btn-small'; btn2.onclick = (e) => act(e.currentTarget, 'declineRequest', profileOwnerUid); break; case 'friend': btn1 = document.createElement('button'); btn1.textContent = 'Remove Friend'; btn1.className = 'btn btn-secondary btn-remove'; btn1.onclick = (e) => act(e.currentTarget, 'removeFriend', profileOwnerUid); break; } if (btn1) friendshipControlsContainer.appendChild(btn1); if (btn2) friendshipControlsContainer.appendChild(btn2); }
async function displayFriendsSection(profileData) { /* ... (Function content unchanged) ... */ if (!isOwnProfile || !friendsSectionWrapper || !friendsSection || !profileData || typeof profileData.friends !== 'object') { resetFriendsSection(); return; } if (!friendsListUl || !incomingListUl || !outgoingListUl || !incomingCountSpan || !outgoingCountSpan || !friendsTabsContainer) { resetFriendsSection(); return; } console.log("Displaying friends section..."); friendsSectionWrapper.style.display = 'block'; const friendsMap = profileData.friends || {}; const fIds = [], iIds = [], oIds = []; for (const uId in friendsMap) { if (friendsMap.hasOwnProperty(uId)) { switch (friendsMap[uId]) { case 'friend': fIds.push(uId); break; case 'incoming': iIds.push(uId); break; case 'outgoing': oIds.push(uId); break; } } } incomingCountSpan.textContent = iIds.length; outgoingCountSpan.textContent = oIds.length; try { await Promise.all([ populateFriendList(friendsListUl, fIds, 'friend', 'No friends yet.'), populateFriendList(incomingListUl, iIds, 'incoming', 'No incoming requests.'), populateFriendList(outgoingListUl, oIds, 'outgoing', 'No outgoing requests.') ]); } catch(e) { console.error("Error populating friend lists:", e); } if (friendsTabsContainer && !friendsTabsContainer.dataset.listenerAttached) { friendsTabsContainer.addEventListener('click', (e) => { const btn = e.target.closest('.tab-button'); if (btn) { const targetId = btn.dataset.tab; if (!targetId) return; const curBtns = friendsTabsContainer.querySelectorAll('.tab-button'); const curConts = friendsSection.querySelectorAll('.tab-content'); curBtns.forEach(b => b.classList.remove('active')); curConts.forEach(c => c.classList.remove('active')); btn.classList.add('active'); const targetCont = friendsSection.querySelector(`#${targetId}-container`); if (targetCont) targetCont.classList.add('active'); } }); friendsTabsContainer.dataset.listenerAttached = 'true'; } }
async function populateFriendList(ulElement, userIds, type, emptyMessage) { /* ... (Function content unchanged) ... */ if (!ulElement) return; ulElement.innerHTML = ''; if (!userIds || userIds.length === 0) { ulElement.innerHTML = `<li class="list-message">${emptyMessage}</li>`; return; } ulElement.innerHTML = `<li class="list-message">Loading details...</li>`; const profilePromises = userIds.map(id => fetchUserMiniProfile(id).catch(err => ({ id: id, displayName: "Error Loading", profilePictureUrl: null }))); const profiles = await Promise.all(profilePromises); ulElement.innerHTML = ''; let itemsAdded = 0; profiles.forEach(p => { if (p && p.id && p.displayName) { if (p.displayName === "Error Loading" || p.displayName === "User Not Found") { ulElement.appendChild(createFriendListItemError(p.id, p.displayName)); } else { ulElement.appendChild(createFriendListItem(p, type)); itemsAdded++; } } }); if (itemsAdded === 0 && profiles.length > 0) { ulElement.innerHTML = `<li class="list-message">Could not load user details.</li>`; } else if (ulElement.childElementCount === 0) { ulElement.innerHTML = `<li class="list-message">${emptyMessage}</li>`; } }
function createFriendListItem(miniProfile, type) { /* ... (Function content unchanged) ... */ const li = document.createElement('li'); li.className = 'friend-item'; li.dataset.userId = miniProfile.id; const infoDiv = document.createElement('div'); infoDiv.className = 'friend-item-info'; const pfpElement = createFriendPfpElement(miniProfile); infoDiv.appendChild(pfpElement); const nameSpan = document.createElement('span'); nameSpan.className = 'friend-item-name'; const nameLink = document.createElement('a'); nameLink.href = `profile.html?uid=${miniProfile.id}`; nameLink.textContent = miniProfile.displayName; nameSpan.appendChild(nameLink); infoDiv.appendChild(nameSpan); li.appendChild(infoDiv); const actionsDiv = document.createElement('div'); actionsDiv.className = 'friend-item-actions'; let btn1 = null, btn2 = null; switch(type) { case 'friend': btn1 = createFriendActionButton('Remove', 'remove', 'secondary', miniProfile.id, li); break; case 'incoming': btn1 = createFriendActionButton('Accept', 'accept', 'primary', miniProfile.id, li); btn2 = createFriendActionButton('Decline', 'decline', 'secondary', miniProfile.id, li); break; case 'outgoing': btn1 = createFriendActionButton('Cancel', 'cancel', 'secondary', miniProfile.id, li); break; } if(btn1) actionsDiv.appendChild(btn1); if(btn2) actionsDiv.appendChild(btn2); li.appendChild(actionsDiv); return li; }
function createFriendPfpElement(miniProfile) { /* ... (Function content unchanged) ... */ const container = document.createElement('div'); container.style.cssText = 'width: 40px; height: 40px; flex-shrink: 0; position: relative;'; const initialDiv = document.createElement('div'); initialDiv.className = 'friend-item-pfp-initial'; initialDiv.textContent = miniProfile.displayName?.charAt(0)?.toUpperCase() || '?'; initialDiv.style.display = 'flex'; container.appendChild(initialDiv); if (miniProfile.profilePictureUrl) { const img = document.createElement('img'); img.src = miniProfile.profilePictureUrl; img.alt = `${miniProfile.displayName || 'User'}'s PFP`; img.className = 'friend-item-pfp'; img.style.display = 'none'; img.onload = () => { initialDiv.style.display = 'none'; img.style.display = 'block'; }; img.onerror = () => { img.style.display = 'none'; initialDiv.style.display = 'flex'; }; container.appendChild(img); } return container; }
function createFriendActionButton(text, type, style, userId, listItem) { /* ... (Function content unchanged) ... */ const btn = document.createElement('button'); btn.textContent = text; btn.className = `btn btn-${style} btn-${type} btn-small`; const actionMap = { remove: 'removeFriend', accept: 'acceptRequest', decline: 'declineRequest', cancel: 'cancelRequest' }; btn.onclick = (e) => handleFriendAction(e.currentTarget, actionMap[type], userId, listItem); return btn; }
function createFriendListItemError(userId, message) { /* ... (Function content unchanged) ... */ const li = document.createElement('li'); li.className = 'friend-item list-message'; li.dataset.userId = userId; li.innerHTML = `<div class="friend-item-info" style="opacity: 0.6;"><div class="friend-item-pfp-initial" style="background-color: var(--text-secondary);">?</div><span class="friend-item-name">${message} (ID: ${userId ? userId.substring(0,8) + '...' : 'N/A'})</span></div><div class="friend-item-actions"></div>`; return li; }
async function handleFriendAction(buttonElement, action, otherUserId, listItemToRemove = null) { /* ... (Function content unchanged) ... */ if (!loggedInUser || !otherUserId || !buttonElement) { return; } const currentUserUid = loggedInUser.uid; buttonElement.disabled = true; const originalText = buttonElement.textContent; buttonElement.textContent = '...'; const actionContainer = buttonElement.closest('.friend-item-actions') || friendshipControlsContainer; const siblingButtons = actionContainer ? Array.from(actionContainer.querySelectorAll('button')) : []; siblingButtons.forEach(btn => { if (btn !== buttonElement) btn.disabled = true; }); const userDocRef = db.collection('users').doc(currentUserUid); const otherUserDocRef = db.collection('users').doc(otherUserId); const batch = db.batch(); try { console.log(`Performing friend action: ${action}`); const deleteField = firebase.firestore.FieldValue.delete(); switch (action) { case 'sendRequest': batch.update(userDocRef, { [`friends.${otherUserId}`]: 'outgoing' }); batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: 'incoming' }); break; case 'cancelRequest': case 'declineRequest': case 'removeFriend': batch.update(userDocRef, { [`friends.${otherUserId}`]: deleteField }); batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: deleteField }); break; case 'acceptRequest': batch.update(userDocRef, { [`friends.${otherUserId}`]: 'friend' }); batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: 'friend' }); break; default: throw new Error(`Invalid action: ${action}`); } await batch.commit(); delete miniProfileCache[currentUserUid]; delete miniProfileCache[otherUserId]; try { const viewerSnap = await userDocRef.get(); if (viewerSnap.exists) { const latestViewerData = { id: viewerSnap.id, ...viewerSnap.data() }; if (!latestViewerData.friends) latestViewerData.friends = {}; viewerProfileData = latestViewerData; if (isOwnProfile) { viewingUserProfileData.profile = viewerProfileData; viewingUserProfileData.stats = viewingUserProfileData.stats || null; saveCombinedDataToCache(currentUserUid, viewingUserProfileData); } } } catch (fetchError) {} if (isOwnProfile) { displayFriendsSection(viewerProfileData); } else if (viewingUserProfileData.profile?.id === otherUserId) { const newStatus = determineFriendshipStatus(currentUserUid, otherUserId); displayFriendshipControls(newStatus, otherUserId); } } catch (error) { console.error(`Error action '${action}':`, error); alert(`Error: ${error.message || 'Failed action.'}.`); buttonElement.disabled = false; buttonElement.textContent = originalText; siblingButtons.forEach(btn => { if (btn !== buttonElement) btn.disabled = false; }); } }

// =============================================================================
// --- Authentication and Initialization ---
// =============================================================================
auth.onAuthStateChanged(async (user) => {
    // ... (Function content unchanged) ...
    console.log(`Auth state changed. User: ${user ? user.uid : 'None'}`); loggedInUser = user; const targetUid = profileUidFromUrl || loggedInUser?.uid; viewerProfileData = null; viewingUserProfileData = {}; miniProfileCache = {}; isOwnProfile = loggedInUser && targetUid === loggedInUser.uid;
    if (targetUid) { console.log(`Targeting profile UID: ${targetUid}`); if (loadingIndicator) loadingIndicator.style.display = 'flex'; if (notLoggedInMsg) notLoggedInMsg.style.display = 'none'; if (profileArea) profileArea.style.display = 'none';
        try { await loadCombinedUserData(targetUid); console.log("Initial data load complete."); if (viewingUserProfileData.profile) { if (isOwnProfile) { setupProfilePicEditing(); setupBannerEditing(); } else { if(editProfilePicIcon) editProfilePicIcon.style.display = 'none'; if(editBannerIcon) editBannerIcon.style.display = 'none'; } profileLogoutBtn.style.display = isOwnProfile ? 'inline-block' : 'none'; } else { profileLogoutBtn.style.display = 'none'; }
        } catch (err) { console.error("Critical error during initial load:", err); if (loadingIndicator) loadingIndicator.style.display = 'none'; if (profileArea) profileArea.style.display = 'none'; if (notLoggedInMsg) { notLoggedInMsg.textContent = 'Failed to load profile.'; notLoggedInMsg.style.display = 'flex'; } profileLogoutBtn.style.display = 'none'; clearFriendshipControls(); resetFriendsSection(); /* hide other sections */ }
    } else { console.log('No user logged in and no profile UID.'); if (loadingIndicator) loadingIndicator.style.display = 'none'; if (profileArea) profileArea.style.display = 'none'; if (notLoggedInMsg) { notLoggedInMsg.style.display = 'flex'; notLoggedInMsg.innerHTML = 'Please <a href="index.html#login-section" style="color: var(--primary-orange); margin: 0 5px;">log in</a> or provide a user ID.'; } if (adminTag) adminTag.style.display = 'none'; if (profileBadgesContainer) profileBadgesContainer.innerHTML = ''; if (profileLogoutBtn) profileLogoutBtn.style.display = 'none'; if (editProfilePicIcon) editProfilePicIcon.style.display = 'none'; if (editBannerIcon) editBannerIcon.style.display = 'none'; updateProfileTitlesAndRank(null, false); displayBanner(null); if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = ''; if(competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'none'; if(poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'none'; closeTitleSelector(); closeEditModal(); clearFriendshipControls(); resetFriendsSection(); if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none'; viewingUserProfileData = {}; viewerProfileData = null; miniProfileCache = {}; }
});

// --- Logout Button Event Listener ---
profileLogoutBtn.addEventListener('click', () => {
    // ... (Function content unchanged) ...
    const userId = loggedInUser?.uid; console.log(`Logout clicked by: ${userId || 'N/A'}`); if (titleDisplay) titleDisplay.removeEventListener('click', handleTitleClick); closeTitleSelector(); closeEditModal(); clearFriendshipControls(); resetFriendsSection(); if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none'; if (competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'none'; if (poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'none'; if (editProfilePicIcon) { editProfilePicIcon.onclick = null; editProfilePicIcon.style.display = 'none'; } if (profilePicInput) profilePicInput.onchange = null; if (editBannerIcon) { editBannerIcon.onclick = null; editBannerIcon.style.display = 'none'; } if (bannerInput) bannerInput.onchange = null; auth.signOut().then(() => { console.log('User signed out.'); if (userId) { localStorage.removeItem(`poxelProfileCombinedData_${userId}`); } loggedInUser = null; viewerProfileData = null; viewingUserProfileData = {}; miniProfileCache = {}; isOwnProfile = false; window.location.href = 'index.html'; }).catch((error) => { console.error('Sign out error:', error); });
});

// =============================================================================
// --- Local Storage Caching ---
// =============================================================================
function loadCombinedDataFromCache(viewedUserId) {
    // ... (Function content unchanged) ...
    if (!viewedUserId) return false; const cacheKey = `poxelProfileCombinedData_${viewedUserId}`; try { const cachedDataString = localStorage.getItem(cacheKey); if (!cachedDataString) return false; const cachedData = JSON.parse(cachedDataString); if (cachedData?.profile?.id === viewedUserId) { cachedData.profile.friends = cachedData.profile.friends || {}; cachedData.profile.leaderboardStats = cachedData.profile.leaderboardStats || {}; cachedData.profile.availableTitles = cachedData.profile.availableTitles || []; cachedData.profile.equippedTitle = cachedData.profile.equippedTitle !== undefined ? cachedData.profile.equippedTitle : ""; cachedData.profile.currentRank = cachedData.profile.currentRank || "Unranked"; cachedData.profile.bannerUrl = cachedData.profile.bannerUrl || null; cachedData.stats = cachedData.stats || null; viewingUserProfileData = cachedData; console.log("Loaded cache for:", viewedUserId); const viewingOwnCachedProfile = loggedInUser && loggedInUser.uid === viewedUserId; displayProfileData(viewingUserProfileData.profile, viewingOwnCachedProfile); displayBanner(viewingUserProfileData.profile.bannerUrl); if(competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'block'; displayCompetitiveStats(viewingUserProfileData.stats); return true; } else { localStorage.removeItem(cacheKey); return false; } } catch (error) { console.error("Error loading cache:", error); try { localStorage.removeItem(cacheKey); } catch(e) {} return false; }
}

function saveCombinedDataToCache(viewedUserId, combinedData) {
    // ... (Function content unchanged) ...
     if (!viewedUserId || !combinedData?.profile?.id || viewedUserId !== combinedData.profile.id) { return; } const cacheKey = `poxelProfileCombinedData_${viewedUserId}`; try { const dataToSave = { profile: { ...combinedData.profile, friends: combinedData.profile.friends || {}, availableTitles: combinedData.profile.availableTitles || [], equippedTitle: combinedData.profile.equippedTitle !== undefined ? combinedData.profile.equippedTitle : "", currentRank: combinedData.profile.currentRank || "Unranked", leaderboardStats: combinedData.profile.leaderboardStats || {}, bannerUrl: combinedData.profile.bannerUrl || null }, stats: combinedData.stats || null }; localStorage.setItem(cacheKey, JSON.stringify(dataToSave)); } catch(error) { console.error(`Error saving cache for ${viewedUserId}:`, error); if (error.name === 'QuotaExceededError' || error.message?.toLowerCase().includes('quota')) { console.warn('LocalStorage quota exceeded.'); } }
}

// --- Initial Log ---
console.log("Profile script initialized (v2 Layout). Waiting for Auth state...");
