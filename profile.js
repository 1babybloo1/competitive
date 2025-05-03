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
const profileBadgesContainer = document.getElementById('profile-badges-container'); // Badge container ref
const friendshipControlsContainer = document.getElementById('friendship-controls-container');
const competitiveStatsSectionWrapper = document.getElementById('competitive-stats-section-wrapper');
const competitiveStatsSection = document.getElementById('competitive-stats-section');
const competitiveStatsDisplay = document.getElementById('stats-display');
const poxelStatsSectionWrapper = document.getElementById('poxel-stats-section-wrapper');
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
    if (!username || typeof username !== 'string' || username.trim() === '') { return null; }
    console.log(`Fetching Poxel.io stats for: ${username}`);
    try {
        const apiUrl = `https://dev-usa-1.poxel.io/api/profile/stats/${encodeURIComponent(username)}`;
        const res = await fetch(apiUrl, { headers: { "Content-Type": "application/json" } });
        if (!res.ok) {
            let errorMsg = `HTTP error ${res.status}`;
            if (res.status === 404) { errorMsg = "User not found on Poxel.io"; }
            else { try { const errorData = await res.json(); errorMsg = errorData.message || errorData.error || errorMsg; } catch (parseError) { /* Ignore */ } }
            throw new Error(errorMsg);
        }
        const data = await res.json();
        if (typeof data !== 'object' || data === null) throw new Error("Invalid data format from Poxel.io API.");
        if (data.error || data.status === 'error') {
             if (data.message && data.message.toLowerCase().includes('not found')) throw new Error('User not found on Poxel.io');
             throw new Error(data.message || 'Poxel.io API error.');
        }
        return data;
    } catch (e) {
        console.error("Error fetching Poxel.io stats:", e.message || e);
        return null;
    }
}

async function fetchAllAchievements() {
    if (allAchievements) return allAchievements; // Return cached if available
    console.log("Fetching all achievement definitions...");
    try {
        const snapshot = await db.collection('achievements').get();
        const fetchedAchievements = {};
        snapshot.forEach(doc => {
            fetchedAchievements[doc.id] = { id: doc.id, ...doc.data() };
        });
        // Only update cache if fetch was successful and returned data
        if (Object.keys(fetchedAchievements).length > 0) {
             allAchievements = fetchedAchievements;
             console.log(`Fetched ${Object.keys(allAchievements).length} achievement definitions.`);
             return allAchievements;
        } else {
             console.warn("Fetched achievement definitions but the result is empty.");
             allAchievements = {}; // Cache empty object to prevent retries for empty collection
             return null; // Indicate failure/empty state
        }
    } catch (error) {
        console.error("Error fetching achievement definitions:", error);
        allAchievements = {}; // Set empty object on error to prevent retries
        return null; // Indicate failure
    }
}

function areStatsDifferent(newStats, existingProfileStats) {
    const normNew = newStats || {};
    const normExisting = existingProfileStats || {};
    const statKeys = ['wins', 'points', 'kdRatio', 'matchesPlayed', 'matches', 'losses'];
    let different = false;
    for (const key of statKeys) {
        let newValue = normNew[key];
        let existingValue = normExisting[key];
        if(key === 'matchesPlayed' && !normNew.hasOwnProperty('matchesPlayed') && normNew.hasOwnProperty('matches')) { newValue = normNew.matches; }
        if(key === 'matchesPlayed' && !normExisting.hasOwnProperty('matchesPlayed') && normExisting.hasOwnProperty('matches')) { existingValue = normExisting.matches; }
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
    if (!userId || !authUser) { return null; }
    console.warn(`Client-side: Creating missing user profile doc for UID: ${userId}`);
    const userDocRef = db.collection("users").doc(userId);
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;
    const defaultProfileData = {
        email: authUser.email ? authUser.email.toLowerCase() : null,
        displayName: displayName, currentRank: "Unranked", equippedTitle: "",
        availableTitles: [], friends: {},
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        leaderboardStats: {}, profilePictureUrl: authUser.photoURL || null,
        bannerUrl: null, // Default banner URL
        poxelStats: {}
    };
    try {
        await userDocRef.set(defaultProfileData, { merge: false });
        console.log(`Successfully created user profile document for UID: ${userId} via client`);
        return { id: userId, ...defaultProfileData, createdAt: new Date() };
    } catch (error) {
        console.error(`Error creating user profile document client-side for UID ${userId}:`, error);
        return null;
    }
}

async function loadCombinedUserData(targetUserId) {
    console.log(`Loading combined user data for TARGET UID: ${targetUserId}`);
    isOwnProfile = loggedInUser && loggedInUser.uid === targetUserId;
    console.log("Is viewing own profile:", isOwnProfile);
    viewerProfileData = null; miniProfileCache = {}; viewingUserProfileData = {};
    if (profileArea) profileArea.style.display = 'none';
    if (notLoggedInMsg) notLoggedInMsg.style.display = 'none';
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = '<p class="list-message">Loading competitive stats...</p>';
    if (poxelStatsDisplay) poxelStatsDisplay.innerHTML = '<p class="list-message">Loading Poxel.io stats...</p>';
    if (achievementsListContainer) achievementsListContainer.innerHTML = '<p class="list-message">Loading achievements...</p>';
    if(competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'none';
    if(poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'none';
    if(achievementsSectionOuter) achievementsSectionOuter.style.display = 'none';
    if(friendsSectionWrapper) friendsSectionWrapper.style.display = 'none';
    updateProfileTitlesAndRank(null, false); displayBanner(null); clearFriendshipControls(); resetFriendsSection();

    const cacheLoaded = loadCombinedDataFromCache(targetUserId);
    // Pre-fetch definitions - moved error handling inside display func
    if (!allAchievements) fetchAllAchievements();

    // Fetch Viewer's Profile Data (if logged in and not viewing self)
    if (loggedInUser && !isOwnProfile) {
        try {
            const viewerSnap = await db.collection('users').doc(loggedInUser.uid).get();
            if (viewerSnap.exists) {
                viewerProfileData = { id: viewerSnap.id, ...viewerSnap.data() };
                if (!viewerProfileData.friends) viewerProfileData.friends = {};
                console.log("Fetched viewer profile data.");
            } else {
                console.warn("Logged-in user's profile data not found.");
                viewerProfileData = await createUserProfileDocument(loggedInUser.uid, loggedInUser);
                if (!viewerProfileData) viewerProfileData = { id: loggedInUser.uid, friends: {} };
            }
        } catch (viewerError) {
            console.error("Error fetching viewing user's profile data:", viewerError);
            viewerProfileData = { id: loggedInUser.uid, friends: {} };
        }
    }

    const userProfileRef = db.collection('users').doc(targetUserId);
    const leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId);
    let userUnlockedAchievementIds = [];

    try {
        // Fetch unlocked achievements IF owner
        if (isOwnProfile) { userUnlockedAchievementIds = await fetchUserUnlockedAchievements(targetUserId); }

        // 1. Fetch Target User Profile Data
        let profileSnap = await userProfileRef.get();
        let profileData = null;
        if (!profileSnap || !profileSnap.exists) {
            console.warn(`User profile document does NOT exist for UID: ${targetUserId}`);
            if (isOwnProfile && loggedInUser) {
                profileData = await createUserProfileDocument(targetUserId, loggedInUser);
                if (!profileData) throw new Error(`Profile creation failed for own UID ${targetUserId}.`);
                viewingUserProfileData = { profile: profileData, stats: null };
            } else {
                throw new Error(`Profile not found for UID ${targetUserId}.`);
            }
        } else {
            profileData = { id: profileSnap.id, ...profileSnap.data() };
            // Ensure essential fields exist
            profileData.leaderboardStats ??= {};
            profileData.profilePictureUrl ??= null;
            profileData.bannerUrl ??= null;
            profileData.friends ??= {};
            if (profileData.email) profileData.email = profileData.email.toLowerCase();
        }
        if (isOwnProfile) { viewerProfileData = profileData; if (!viewerProfileData.friends) viewerProfileData.friends = {}; }

        // 2. Fetch Leaderboard Stats Data (Competitive)
        let competitiveStatsData = null;
        if(profileData) {
            const statsSnap = await leaderboardStatsRef.get();
            competitiveStatsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null;
        }

        // 3. Sync Competitive Stats to Profile Document if needed
        if (profileData && competitiveStatsData) {
            if (areStatsDifferent(competitiveStatsData, profileData.leaderboardStats)) {
                console.log(`Competitive stats for UID ${targetUserId} differ. Updating 'users' doc.`);
                try {
                    const statsToSave = { ...competitiveStatsData }; delete statsToSave.id;
                    await userProfileRef.update({ leaderboardStats: statsToSave });
                    profileData.leaderboardStats = statsToSave;
                } catch (updateError) { console.error(`Error updating competitive stats in 'users' doc for UID ${targetUserId}:`, updateError); }
            }
        }

        // 4. Update Global State for the viewed profile
        viewingUserProfileData = { profile: profileData, stats: competitiveStatsData };

        // 5. Display Core Profile Info & Cache
        displayProfileData(viewingUserProfileData.profile, isOwnProfile);
        displayBanner(viewingUserProfileData.profile?.bannerUrl);
        saveCombinedDataToCache(targetUserId, viewingUserProfileData);

        // --- Display Sections ---
        if (competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'block';
        displayCompetitiveStats(viewingUserProfileData.stats);

        if (loggedInUser) {
            if (isOwnProfile) { await displayFriendsSection(profileData); } // Use await here if displayFriendsSection becomes async
            else if (viewerProfileData){ const status = determineFriendshipStatus(loggedInUser.uid, targetUserId); displayFriendshipControls(status, targetUserId); }
        }

        if (profileData?.displayName) {
             if(poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'block';
             fetchPoxelStats(profileData.displayName)
                .then(poxelStatsData => displayPoxelStats(poxelStatsData))
                .catch(poxelError => displayPoxelStats(null, poxelError.message || 'Error loading stats.'));
        } else {
             displayPoxelStats(null, 'Poxel username not found.');
             if(poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'block';
        }

        // Achievements - Now handles fetch errors internally
        if (isOwnProfile) { await displayAchievementsSection(viewingUserProfileData.stats, userUnlockedAchievementIds); }

        // --- Post-display Logic (Achievements Granting) ---
        if (isOwnProfile && viewingUserProfileData.stats) {
             let definitions = allAchievements;
             if (!definitions) definitions = await fetchAllAchievements();

             if (definitions && Object.keys(definitions).length > 0) { // Check if definitions are valid
                const potentiallyUpdatedProfile = await checkAndGrantAchievements(
                    targetUserId, viewingUserProfileData.profile, viewingUserProfileData.stats
                );
                if (potentiallyUpdatedProfile) {
                    viewingUserProfileData.profile = potentiallyUpdatedProfile;
                    viewerProfileData = viewingUserProfileData.profile;
                    saveCombinedDataToCache(targetUserId, viewingUserProfileData);
                    displayProfileData(viewingUserProfileData.profile, isOwnProfile);
                    displayBanner(viewingUserProfileData.profile.bannerUrl);
                    const latestUnlockedIds = await fetchUserUnlockedAchievements(targetUserId);
                    await displayAchievementsSection(viewingUserProfileData.stats, latestUnlockedIds);
                    await displayFriendsSection(viewingUserProfileData.profile); // Refresh friends section if it's async
                }
             } else { console.warn("Skipping achievement grant check because definitions failed to load or are empty."); }
        }

        // --- Final Step: Show the profile area ---
        if (profileArea) profileArea.style.display = 'block';

    } catch (error) {
        console.error(`Error in loadCombinedUserData for TARGET UID ${targetUserId}:`, error);
        let errorMessage = 'Error loading profile data. Please try again later.';
        if (error.message && error.message.includes('Profile not found')) { errorMessage = 'Profile not found.'; viewingUserProfileData.profile = null; }
        if (profileArea) profileArea.style.display = 'none';
        if (notLoggedInMsg) notLoggedInMsg.textContent = errorMessage; if (notLoggedInMsg) notLoggedInMsg.style.display = 'flex';
        updateProfileTitlesAndRank(null, false); displayBanner(null);
        if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = '<p class="list-message">Error loading stats.</p>';
        if(competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'block';
        if (poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'none';
        if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none';
        clearFriendshipControls(); resetFriendsSection();
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

function displayBanner(imageUrl) {
    if (!profileBanner) return;
    if (imageUrl) { profileBanner.style.backgroundImage = `url('${imageUrl}')`; }
    else { profileBanner.style.backgroundImage = 'none'; }
}

function displayProfileData(profileData, isOwner) {
    if (!profileData || !profileArea) {
        console.error("displayProfileData called with null profileData or profileArea missing.");
        if(profileArea) profileArea.style.display = 'none';
        if (notLoggedInMsg) { notLoggedInMsg.textContent = 'Profile data unavailable.'; notLoggedInMsg.style.display = 'flex'; }
        return;
    }
    profileArea.style.display = 'block';
    const displayName = profileData.displayName || 'Anonymous User';
    usernameDisplay.textContent = displayName;
    // Profile Picture Logic
    if (profileData.profilePictureUrl) {
        profileImage.src = profileData.profilePictureUrl; profileImage.style.display = 'block'; profileInitials.style.display = 'none';
        profileImage.onerror = () => { console.error("Failed to load profile image:", profileData.profilePictureUrl); profileImage.style.display = 'none'; profileInitials.textContent = displayName?.charAt(0)?.toUpperCase() || '?'; profileInitials.style.display = 'flex'; };
    } else { profileImage.style.display = 'none'; profileImage.src = ''; profileInitials.textContent = displayName?.charAt(0)?.toUpperCase() || '?'; profileInitials.style.display = 'flex'; }
    // Show/hide edit icons
    editProfilePicIcon.style.display = isOwner ? 'flex' : 'none';
    editBannerIcon.style.display = isOwner ? 'flex' : 'none';
    // Display badges and rank/title
    displayUserBadges(profileData);
    updateProfileTitlesAndRank(profileData, isOwner);
    // Setup editing listeners IF owner
    if (isOwner) { setupProfilePicEditing(); setupBannerEditing(); }
}

function displayCompetitiveStats(statsData) {
    if (!competitiveStatsDisplay) return; competitiveStatsDisplay.innerHTML = '';
    if (!statsData || typeof statsData !== 'object' || Object.keys(statsData).length === 0) { competitiveStatsDisplay.innerHTML = '<p class="list-message">Competitive stats unavailable.</p>'; return; }
    const statsMap = { wins: 'Wins', points: 'Points', kdRatio: 'K/D Ratio', matchesPlayed: 'Matches Played', losses: 'Losses' };
    if (!statsData.hasOwnProperty('matchesPlayed') && statsData.hasOwnProperty('matches')) { statsMap.matches = 'Matches Played'; delete statsMap.matchesPlayed; }
    let statsAdded = 0;
    for (const key in statsMap) {
        if (statsData.hasOwnProperty(key)) {
            let value = statsData[key]; let displayValue = value;
            if (key === 'kdRatio' && typeof value === 'number') { displayValue = value.toFixed(2); } else if (value === null || value === undefined){ displayValue = '-'; }
            competitiveStatsDisplay.appendChild(createStatItem(statsMap[key], displayValue)); statsAdded++;
        }
    }
    if (statsAdded === 0) { competitiveStatsDisplay.innerHTML = '<p class="list-message">No specific competitive stats found.</p>'; }
}

function displayPoxelStats(poxelData, message = null) {
    if (!poxelStatsDisplay || !poxelStatsSectionWrapper) return; // Check wrapper
    poxelStatsDisplay.innerHTML = '';
    poxelStatsSectionWrapper.style.display = 'block'; // Show wrapper
    if (message) { poxelStatsDisplay.innerHTML = `<p class="list-message">${message}</p>`; return; }
    if (!poxelData || typeof poxelData !== 'object' || Object.keys(poxelData).length === 0) { poxelStatsDisplay.innerHTML = '<p class="list-message">Poxel.io stats unavailable.</p>'; return; }
    const statsMap = { kills: 'Kills', deaths: 'Deaths', wins: 'Wins', losses: 'Losses', level: 'Level', playtimeHours: 'Playtime (Hours)', gamesPlayed: 'Games Played' };
    let statsAdded = 0;
    for (const key in statsMap) { if (poxelData.hasOwnProperty(key) && poxelData[key] !== null && poxelData[key] !== undefined) { let value = poxelData[key]; if (key === 'playtimeHours' && typeof value === 'number') value = value.toFixed(1); poxelStatsDisplay.appendChild(createStatItem(statsMap[key], value)); statsAdded++; } }
    if (poxelData.hasOwnProperty('kills') && poxelData.hasOwnProperty('deaths') && poxelData.deaths !== null && poxelData.kills !== null) { const kills = Number(poxelData.kills) || 0; const deaths = Number(poxelData.deaths) || 0; const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2); poxelStatsDisplay.appendChild(createStatItem('Poxel K/D', kd)); statsAdded++; }
    if (statsAdded === 0) { poxelStatsDisplay.innerHTML = '<p class="list-message">No relevant Poxel.io stats found.</p>'; }
}

function createStatItem(title, value) {
    const itemDiv = document.createElement('div'); itemDiv.classList.add('stat-item');
    const titleH4 = document.createElement('h4'); titleH4.textContent = title;
    const valueP = document.createElement('p'); valueP.textContent = (value !== null && value !== undefined) ? value : '-';
    itemDiv.appendChild(titleH4); itemDiv.appendChild(valueP); return itemDiv;
}

async function fetchUserUnlockedAchievements(userId) {
    if (!userId) return [];
    try {
        const userAchievementsRef = db.collection('userAchievements').doc(userId);
        const doc = await userAchievementsRef.get();
        return doc.exists ? (doc.data()?.unlocked || []) : [];
    } catch (error) { console.error(`Error fetching unlocked achievements for UID ${userId}:`, error); return []; }
}

function calculateAchievementProgress(achievement, userStats) {
     const criteria = achievement?.criteria || {}; const targetValue = criteria.value || 0; const operator = criteria.operator || '>='; const statKey = criteria.stat;
     if (userStats === null || userStats === undefined || !statKey) { const meetsCriteria = operator === '>=' && (0 >= targetValue); return { progress: 0, currentValue: 0, targetValue, meetsCriteria }; }
     let currentValue = userStats[statKey];
     if(statKey === 'matchesPlayed' && !userStats.hasOwnProperty('matchesPlayed') && userStats.hasOwnProperty('matches')) { currentValue = userStats.matches; }
     currentValue = Number(currentValue) || 0;
     if (statKey === 'kdRatio' && typeof currentValue === 'number') { currentValue = parseFloat(currentValue.toFixed(2)); }
     if (targetValue <= 0) { const meetsCriteria = operator === '>=' ? currentValue >= targetValue : operator === '==' ? currentValue == targetValue : false; return { progress: (meetsCriteria ? 100 : 0), currentValue, targetValue, meetsCriteria }; }
     let progressPercent = 0; let meetsCriteria = false;
     switch (operator) {
         case '>=': meetsCriteria = currentValue >= targetValue; progressPercent = (currentValue / targetValue) * 100; break;
         case '==': meetsCriteria = currentValue == targetValue; progressPercent = meetsCriteria ? 100 : 0; break;
         default: console.warn(`Unsupported achievement operator: ${operator}`); meetsCriteria = false; progressPercent = 0; break;
     }
     progressPercent = Math.max(0, Math.min(100, progressPercent));
     return { progress: Math.floor(progressPercent), currentValue, targetValue, meetsCriteria };
}

// --- Display Achievements Section (UPDATED with corrected error handling) ---
async function displayAchievementsSection(competitiveStats, unlockedAchievementIds) {
    if (!achievementsSectionOuter || !achievementsListContainer) {
        console.error("Achievement section elements not found in DOM.");
        return;
    }
    if (!isOwnProfile) {
        achievementsSectionOuter.style.display = 'none';
        return;
    }

    let currentAchievements = allAchievements; // Use cached first

    // Attempt fetch ONLY if not cached
    if (!currentAchievements) {
        console.log("Achievement definitions not loaded yet, attempting fetch...");
        currentAchievements = await fetchAllAchievements(); // Fetch and get result

        // Check if fetch failed (returned null) or returned empty object
        if (!currentAchievements || Object.keys(currentAchievements).length === 0) {
            console.error("Failed to load achievement definitions after attempting fetch, or definitions are empty.");
            achievementsListContainer.innerHTML = '<p class="list-message">Could not load achievement definitions.</p>';
            achievementsSectionOuter.style.display = 'block'; // Show wrapper with error
            // Ensure global reflects failure/empty state if just fetched
            if (!allAchievements) allAchievements = {};
            return; // Stop
        }
        // If fetch succeeded, global 'allAchievements' is updated internally by fetchAllAchievements
    }

    // Proceed with loaded/cached definitions
    achievementsListContainer.innerHTML = '';
    achievementsSectionOuter.style.display = 'block';

    const achievementIds = Object.keys(currentAchievements || {}); // Use local var

    if (achievementIds.length === 0) {
        achievementsListContainer.innerHTML = '<p class="list-message">No achievements defined yet.</p>';
        return;
    }

    console.log(`Displaying ${achievementIds.length} achievements.`);
    achievementIds.forEach(achievementId => {
        const achievement = currentAchievements[achievementId]; // Use local var
        if (!achievement || !achievement.name || !achievement.criteria) { console.warn(`Skipping invalid achievement data for ID: ${achievementId}`, achievement); return; }
        const isUnlocked = unlockedAchievementIds?.includes(achievementId) || false;
        const progressInfo = calculateAchievementProgress(achievement, competitiveStats);
        const meetsCriteriaDirectly = progressInfo.meetsCriteria;
        const isDisplayCompleted = isUnlocked || meetsCriteriaDirectly;
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('achievement-item');
        if (isUnlocked) itemDiv.classList.add('achievement-unlocked');
        if (isDisplayCompleted) itemDiv.classList.add('achievement-completed');
        // Format rewards string
        let rewardsHtml = '';
        if (achievement.rewards) {
            const rewardsParts = [];
            if (achievement.rewards.title) rewardsParts.push(`Title: <strong>${achievement.rewards.title}</strong>`);
            if (achievement.rewards.rank) rewardsParts.push(`Rank: <strong>${achievement.rewards.rank}</strong>`);
            if (rewardsParts.length > 0) { rewardsHtml = `<div class="achievement-rewards">Reward${rewardsParts.length > 1 ? 's': ''}: ${rewardsParts.join(', ')}</div>`; }
        }
        // Determine progress bar text
        let progressText = `${progressInfo.progress}%`; let progressBarTitle = '';
        const isNumericProgressive = achievement.criteria.stat && typeof achievement.criteria.value === 'number' && achievement.criteria.value > 0 && achievement.criteria.operator === '>=';
        if (isDisplayCompleted) { progressText = "Completed"; progressBarTitle = isNumericProgressive ? `${achievement.criteria.stat}: ${progressInfo.currentValue} / ${progressInfo.targetValue} (Completed)`: "Completed"; }
        else if (isNumericProgressive) { progressText = `${progressInfo.currentValue} / ${progressInfo.targetValue} (${progressInfo.progress}%)`; progressBarTitle = `${achievement.criteria.stat}: ${progressInfo.currentValue} / ${progressInfo.targetValue}`; }
        else { progressText = `${progressInfo.progress}%`; progressBarTitle = achievement.criteria.stat ? `${achievement.criteria.stat} Progress` : 'Progress'; }
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
            ` : '<div style="height: 5px;"></div>' }
           ${rewardsHtml}
       `;
       achievementsListContainer.appendChild(itemDiv);
    });

    // Final checks for empty list
    if (achievementsListContainer.childElementCount === 0 && achievementIds.length > 0) { achievementsListContainer.innerHTML = '<p class="list-message">Could not display achievements.</p>'; }
    else if (achievementIds.length === 0) { achievementsListContainer.innerHTML = '<p class="list-message">No achievements defined yet.</p>'; }
}

async function checkAndGrantAchievements(userId, currentUserProfile, competitiveStats) {
    // Use globally cached 'allAchievements' which should be populated by loadCombinedUserData/displayAchievementsSection
     if (!allAchievements || Object.keys(allAchievements).length === 0 || !userId || !currentUserProfile || !competitiveStats) {
        console.log("Skipping achievement check: Missing definitions, user data, or stats.");
        return null;
    }
    console.log(`Checking achievements for UID ${userId}...`);
    let profileToUpdate = {
         ...currentUserProfile,
         availableTitles: currentUserProfile.availableTitles || [],
         equippedTitle: currentUserProfile.equippedTitle !== undefined ? currentUserProfile.equippedTitle : "",
         currentRank: currentUserProfile.currentRank || "Unranked",
         friends: currentUserProfile.friends || {},
         leaderboardStats: currentUserProfile.leaderboardStats || {},
         bannerUrl: currentUserProfile.bannerUrl || null,
     };
    try {
        const userAchievementsRef = db.collection('userAchievements').doc(userId); let unlockedIds = [];
        try { const userAchievementsDoc = await userAchievementsRef.get(); if (userAchievementsDoc.exists) { unlockedIds = userAchievementsDoc.data()?.unlocked || []; } }
        catch(fetchError) { console.error("Error fetching existing unlocked achievements:", fetchError); unlockedIds = []; }
        let newAchievementsUnlocked = []; let needsProfileUpdate = false; let needsUserAchievementsUpdate = false;
        let bestRankReward = null; const rankOrder = ["Unranked", "Bronze", "Silver", "Gold", "Platinum", "Veteran", "Legend"];
        for (const achievementId in allAchievements) {
             if (unlockedIds.includes(achievementId)) continue;
             const achievement = allAchievements[achievementId]; if (!achievement?.criteria) continue;
             const progressInfo = calculateAchievementProgress(achievement, competitiveStats);
             if (progressInfo.meetsCriteria) {
                if (!newAchievementsUnlocked.includes(achievementId)) { newAchievementsUnlocked.push(achievementId); needsUserAchievementsUpdate = true; }
                if (achievement.rewards) {
                    if (achievement.rewards.title) { if (!profileToUpdate.availableTitles.includes(achievement.rewards.title)) { profileToUpdate.availableTitles.push(achievement.rewards.title); needsProfileUpdate = true; console.log(`- Added title: ${achievement.rewards.title}`); if (profileToUpdate.equippedTitle === "") { profileToUpdate.equippedTitle = achievement.rewards.title; console.log(`- Auto-equipped title: ${achievement.rewards.title}`); } } }
                    if (achievement.rewards.rank) { const currentRankIndex = rankOrder.indexOf(profileToUpdate.currentRank); const newRankIndex = rankOrder.indexOf(achievement.rewards.rank); const bestRewardRankIndex = bestRankReward ? rankOrder.indexOf(bestRankReward) : -1; if (newRankIndex > Math.max(currentRankIndex, bestRewardRankIndex)) { bestRankReward = achievement.rewards.rank; console.log(`- New best rank reward candidate: ${bestRankReward}`); needsProfileUpdate = true; } }
                    if (achievement.rewards.bannerUrl) { if (!profileToUpdate.bannerUrl) { profileToUpdate.bannerUrl = achievement.rewards.bannerUrl; needsProfileUpdate = true; console.log(`- Added banner: ${achievement.rewards.bannerUrl}`); } }
                }
            }
        }
        if (bestRankReward) { const currentRankIndex = rankOrder.indexOf(profileToUpdate.currentRank); const bestRewardRankIndex = rankOrder.indexOf(bestRankReward); if (bestRewardRankIndex > currentRankIndex) { profileToUpdate.currentRank = bestRankReward; console.log(`Updating profile rank to highest awarded: ${bestRankReward}`); } }
        if (needsProfileUpdate || needsUserAchievementsUpdate) {
            console.log(`Needs Firestore update. Profile: ${needsProfileUpdate}, UserAchievements: ${needsUserAchievementsUpdate}`);
            const batch = db.batch(); const userProfileRef = db.collection('users').doc(userId);
            if (needsUserAchievementsUpdate && newAchievementsUnlocked.length > 0) { batch.set(userAchievementsRef, { unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsUnlocked) }, { merge: true }); }
            if (needsProfileUpdate) { const profileUpdateData = {}; if (JSON.stringify(profileToUpdate.availableTitles) !== JSON.stringify(currentUserProfile.availableTitles || [])) { profileUpdateData.availableTitles = profileToUpdate.availableTitles; } if (profileToUpdate.equippedTitle !== (currentUserProfile.equippedTitle !== undefined ? currentUserProfile.equippedTitle : "")) { profileUpdateData.equippedTitle = profileToUpdate.equippedTitle; } if (profileToUpdate.currentRank !== (currentUserProfile.currentRank || "Unranked")) { profileUpdateData.currentRank = profileToUpdate.currentRank; } if (profileToUpdate.bannerUrl !== (currentUserProfile.bannerUrl || null)) { profileUpdateData.bannerUrl = profileToUpdate.bannerUrl; } if (Object.keys(profileUpdateData).length > 0) { console.log("Updating 'users' doc with:", profileUpdateData); batch.update(userProfileRef, profileUpdateData); } else { needsProfileUpdate = false; } }
            if (needsProfileUpdate || needsUserAchievementsUpdate) { await batch.commit(); console.log(`Achievement Firestore batch committed successfully for UID ${userId}.`); return profileToUpdate; }
            else { console.log("Update flags set, but no ops added to batch."); return null; }
        } else { return null; }
    } catch (error) { console.error(`Error checking/granting achievements for UID ${userId}:`, error); return null; }
}

// --- UI Display Helpers (Badges, Rank/Title Selector) ---
function displayUserBadges(profileData) {
     if (!profileBadgesContainer || !adminTag) return;
     profileBadgesContainer.innerHTML = ''; adminTag.style.display = 'none';
     const userEmail = profileData?.email; if (!userEmail) return;
     if (adminEmails.includes(userEmail)) { adminTag.style.display = 'inline-block'; }
     for (const badgeType in badgeConfig) { if (badgeConfig[badgeType].emails.includes(userEmail)) { const badgeSpan = document.createElement('span'); badgeSpan.classList.add('profile-badge', badgeConfig[badgeType].className); badgeSpan.setAttribute('title', badgeConfig[badgeType].title); profileBadgesContainer.appendChild(badgeSpan); } }
}
function updateProfileTitlesAndRank(profileData, allowInteraction) {
     if (!rankDisplay || !titleDisplay) return; titleDisplay.classList.remove('selectable-title', 'no-title-placeholder'); titleDisplay.removeEventListener('click', handleTitleClick); closeTitleSelector();
     if (profileData && typeof profileData === 'object') { const rank = profileData.currentRank || 'Unranked'; const equippedTitle = profileData.equippedTitle || ''; const availableTitles = profileData.availableTitles || []; rankDisplay.textContent = rank; rankDisplay.className = `profile-rank-display rank-${rank.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`; if (allowInteraction && availableTitles.length > 0) { titleDisplay.classList.add('selectable-title'); titleDisplay.addEventListener('click', handleTitleClick); if (equippedTitle) { titleDisplay.textContent = equippedTitle; titleDisplay.classList.remove('no-title-placeholder'); titleDisplay.style.display = 'inline-block'; } else { titleDisplay.textContent = '[Choose Title]'; titleDisplay.classList.add('no-title-placeholder'); titleDisplay.style.display = 'inline-block'; } } else { if (equippedTitle) { titleDisplay.textContent = equippedTitle; titleDisplay.classList.remove('no-title-placeholder'); titleDisplay.style.display = 'inline-block'; } else { titleDisplay.textContent = ''; titleDisplay.style.display = 'none'; } } }
     else { rankDisplay.textContent = '...'; rankDisplay.className = 'profile-rank-display rank-unranked'; titleDisplay.textContent = ''; titleDisplay.style.display = 'none'; }
}
function handleTitleClick(event) { event.stopPropagation(); if (!isOwnProfile || !viewingUserProfileData.profile || !(viewingUserProfileData.profile.availableTitles?.length > 0)) { return; } if (isTitleSelectorOpen) { closeTitleSelector(); } else { openTitleSelector(); } }
function openTitleSelector() { if (isTitleSelectorOpen || !profileIdentifiersDiv || !isOwnProfile || !viewingUserProfileData.profile?.availableTitles?.length > 0) return; const availableTitles = viewingUserProfileData.profile.availableTitles; const currentEquippedTitle = viewingUserProfileData.profile.equippedTitle || ''; if (!titleSelectorElement || !profileIdentifiersDiv.contains(titleSelectorElement)) { titleSelectorElement = document.createElement('div'); titleSelectorElement.className = 'title-selector'; profileIdentifiersDiv.appendChild(titleSelectorElement); } titleSelectorElement.innerHTML = ''; if (currentEquippedTitle) { const unequipOption = document.createElement('button'); unequipOption.className = 'title-option title-option-unequip'; unequipOption.dataset.title = ""; unequipOption.type = 'button'; unequipOption.textContent = '[Remove Title]'; unequipOption.onclick = handleTitleOptionClick; titleSelectorElement.appendChild(unequipOption); } availableTitles.forEach(titleOptionText => { const optionElement = document.createElement('button'); optionElement.className = 'title-option'; optionElement.dataset.title = titleOptionText; optionElement.type = 'button'; optionElement.textContent = titleOptionText; if (titleOptionText === currentEquippedTitle) { optionElement.classList.add('currently-equipped'); optionElement.disabled = true; } optionElement.onclick = handleTitleOptionClick; titleSelectorElement.appendChild(optionElement); }); titleSelectorElement.style.display = 'block'; isTitleSelectorOpen = true; setTimeout(() => { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }, 0); }
function closeTitleSelector() { if (!isTitleSelectorOpen || !titleSelectorElement) return; titleSelectorElement.style.display = 'none'; isTitleSelectorOpen = false; document.removeEventListener('click', handleClickOutsideTitleSelector, { capture: true }); }
function handleClickOutsideTitleSelector(event) { if (!isTitleSelectorOpen) return; const isClickInsideSelector = titleSelectorElement?.contains(event.target); const isClickOnTitle = titleDisplay?.contains(event.target); if (!isClickInsideSelector && !isClickOnTitle) { closeTitleSelector(); } else { setTimeout(() => { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }, 0); } }
async function handleTitleOptionClick(event) { event.stopPropagation(); const buttonElement = event.currentTarget; const selectedTitle = buttonElement.dataset.title; const currentUserId = loggedInUser?.uid; if (!currentUserId || !viewingUserProfileData.profile || viewingUserProfileData.profile.id !== currentUserId) { console.error("Title change validation failed"); closeTitleSelector(); return; } const currentlyEquippedTitle = viewingUserProfileData.profile.equippedTitle || ''; if (selectedTitle === currentlyEquippedTitle) { closeTitleSelector(); return; } closeTitleSelector(); titleDisplay.classList.remove('selectable-title', 'no-title-placeholder'); titleDisplay.removeEventListener('click', handleTitleClick); titleDisplay.textContent = "Updating..."; try { const userProfileRef = db.collection('users').doc(currentUserId); await userProfileRef.update({ equippedTitle: selectedTitle }); console.log(`Firestore updated title to "${selectedTitle || 'None'}" for UID ${currentUserId}`); viewingUserProfileData.profile.equippedTitle = selectedTitle; if(isOwnProfile && viewerProfileData) viewerProfileData.equippedTitle = selectedTitle; saveCombinedDataToCache(currentUserId, viewingUserProfileData); updateProfileTitlesAndRank(viewingUserProfileData.profile, true); } catch (error) { console.error("Error updating equipped title:", error); alert("Failed to update title."); if(viewingUserProfileData.profile) { viewingUserProfileData.profile.equippedTitle = currentlyEquippedTitle; updateProfileTitlesAndRank(viewingUserProfileData.profile, true); } else { updateProfileTitlesAndRank(null, false); } } }

// --- Profile Picture & Banner Editing Functions ---
function setupProfilePicEditing() { if (!isOwnProfile || !editProfilePicIcon || !profilePicInput) { if(editProfilePicIcon) editProfilePicIcon.style.display = 'none'; return; } editProfilePicIcon.style.display = 'flex'; editProfilePicIcon.onclick = null; profilePicInput.onchange = null; editProfilePicIcon.onclick = () => { croppingFor = 'pfp'; profilePicInput.click(); }; profilePicInput.onchange = (event) => { handleFileSelect(event); }; }
function setupBannerEditing() { if (!isOwnProfile || !editBannerIcon || !bannerInput) { if(editBannerIcon) editBannerIcon.style.display = 'none'; return; } editBannerIcon.style.display = 'flex'; editBannerIcon.onclick = null; bannerInput.onchange = null; editBannerIcon.onclick = () => { croppingFor = 'banner'; bannerInput.click(); }; bannerInput.onchange = (event) => { handleFileSelect(event); }; console.log("Banner editing listeners attached."); }
function handleFileSelect(event) { const file = event.target?.files?.[0]; if (!file) { event.target.value = null; return; } if (!file.type.startsWith('image/')) { alert('Please select a valid image file (PNG, JPG, GIF).'); event.target.value = null; return; } const maxSizeMB = 8; if (file.size > maxSizeMB * 1024 * 1024) { alert(`File size exceeds ${maxSizeMB}MB limit.`); event.target.value = null; return; } const reader = new FileReader(); reader.onload = (e) => { if (e.target?.result) { modalImage.src = e.target.result; openEditModal(); } else { alert("Error reading file data."); } }; reader.onerror = (err) => { alert("Error reading the selected file."); }; reader.readAsDataURL(file); event.target.value = null; }
function openEditModal() { if (!editModal || !modalImage || !modalImage.src) { return; } modalTitle.textContent = (croppingFor === 'banner') ? 'Edit Banner Image' : 'Edit Profile Picture'; editModal.style.display = 'flex'; modalImage.style.opacity = 0; modalApplyBtn.disabled = false; modalSpinner.style.display = 'none'; const applyTextNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE); if (applyTextNode) applyTextNode.textContent = 'Apply '; if (cropper) { try { cropper.destroy(); } catch(e) {} cropper = null; } const cropperOptions = { viewMode: 1, dragMode: 'move', background: false, autoCropArea: 0.9, responsive: true, modal: true, guides: true, center: true, highlight: false, cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false, ready: () => { modalImage.style.opacity = 1; console.log("Cropper is ready for:", croppingFor); } }; if (croppingFor === 'pfp') { cropperOptions.aspectRatio = 1 / 1; } else if (croppingFor === 'banner') { cropperOptions.aspectRatio = 3 / 1; } else { console.error("Unknown 'croppingFor' state:", croppingFor); alert("Error opening image editor: Unknown target."); closeEditModal(); return; } setTimeout(() => { try { cropper = new Cropper(modalImage, cropperOptions); } catch (cropperError) { console.error("Error initializing Cropper:", cropperError); alert("Could not initialize image editor."); closeEditModal(); } }, 50); modalCloseBtn.onclick = closeEditModal; modalCancelBtn.onclick = closeEditModal; modalApplyBtn.onclick = handleApplyCrop; editModal.onclick = (event) => { if (event.target === editModal) closeEditModal(); }; }
function closeEditModal() { if (!editModal) return; if (cropper) { try { cropper.destroy(); } catch (e) {} cropper = null; } editModal.style.display = 'none'; modalImage.src = ''; modalImage.removeAttribute('src'); croppingFor = null; modalApplyBtn.disabled = false; modalSpinner.style.display = 'none'; const textNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE); if (textNode) textNode.textContent = 'Apply '; modalCloseBtn.onclick = null; modalCancelBtn.onclick = null; modalApplyBtn.onclick = null; editModal.onclick = null; }
async function handleApplyCrop() { if (!cropper || !loggedInUser || !croppingFor) { console.error("Cropper/user/target not ready."); alert("Cannot apply crop."); return; } if (modalApplyBtn.disabled) return; modalApplyBtn.disabled = true; modalSpinner.style.display = 'inline-block'; const textNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE); if (textNode) textNode.textContent = 'Applying '; try { const outputWidth = (croppingFor === 'banner') ? 1500 : 512; const outputHeight = (croppingFor === 'banner') ? 500 : 512; const canvas = cropper.getCroppedCanvas({ width: outputWidth, height: outputHeight, imageSmoothingEnabled: true, imageSmoothingQuality: 'high', }); if (!canvas) throw new Error("Failed to get cropped canvas."); const blob = await new Promise((resolve, reject) => { canvas.toBlob((blobResult) => { if (blobResult) resolve(blobResult); else reject(new Error("Canvas to Blob conversion failed.")); }, 'image/jpeg', 0.90); }); const imageUrl = await uploadToCloudinary(blob, croppingFor); console.log(`Uploaded ${croppingFor} to Cloudinary:`, imageUrl); await saveImageUrlToFirestore(loggedInUser.uid, imageUrl, croppingFor); console.log(`Saved ${croppingFor} URL to Firestore.`); if (croppingFor === 'pfp') { profileImage.src = `${imageUrl}?timestamp=${Date.now()}`; profileImage.style.display = 'block'; profileInitials.style.display = 'none'; } else if (croppingFor === 'banner') { displayBanner(imageUrl); } if (viewingUserProfileData?.profile?.id === loggedInUser.uid) { if (croppingFor === 'pfp') { viewingUserProfileData.profile.profilePictureUrl = imageUrl; } else if (croppingFor === 'banner') { viewingUserProfileData.profile.bannerUrl = imageUrl; } if (viewerProfileData?.id === loggedInUser.uid) { if (croppingFor === 'pfp') viewerProfileData.profilePictureUrl = imageUrl; else if (croppingFor === 'banner') viewerProfileData.bannerUrl = imageUrl; } saveCombinedDataToCache(loggedInUser.uid, viewingUserProfileData); } closeEditModal(); } catch (error) { console.error(`Error during ${croppingFor} crop/upload/save:`, error); alert(`Failed to update ${croppingFor}: ${error.message || 'Unknown error.'}`); modalApplyBtn.disabled = false; modalSpinner.style.display = 'none'; if (textNode) textNode.textContent = 'Apply '; } }
async function uploadToCloudinary(blob, type = 'image') { if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) { throw new Error("Cloudinary config missing."); } const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`; const formData = new FormData(); const filename = `${type}_${loggedInUser?.uid || 'anon'}_${Date.now()}.jpg`; formData.append('file', blob, filename); formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET); if (type === 'banner') { formData.append('folder', 'user_banners'); } else if (type === 'pfp') { formData.append('folder', 'user_pfps'); } console.log(`Uploading ${type} to Cloudinary...`); try { const response = await fetch(url, { method: 'POST', body: formData }); const data = await response.json(); if (!response.ok) { throw new Error(data.error?.message || `Cloudinary upload failed. Status: ${response.status}`); } if (!data.secure_url) { throw new Error("Upload succeeded but missing secure URL."); } return data.secure_url; } catch (networkError) { throw new Error(`Network error during image upload.`); } }
async function saveImageUrlToFirestore(userId, imageUrl, type) { if (!userId || !imageUrl || !type) { throw new Error("Missing userId, imageUrl, or type for saving."); } const userDocRef = db.collection("users").doc(userId); const fieldToUpdate = (type === 'banner') ? 'bannerUrl' : 'profilePictureUrl'; try { await userDocRef.update({ [fieldToUpdate]: imageUrl }); console.log(`Successfully updated ${fieldToUpdate} for user ${userId}`); } catch (error) { console.error(`Error updating Firestore ${fieldToUpdate} for ${userId}:`, error); throw new Error(`Database error saving ${type} link.`); } }

// --- Friend System Functions ---
async function fetchUserMiniProfile(userId) { if (!userId) return null; if (miniProfileCache[userId]?.displayName) { return miniProfileCache[userId]; } try { const userSnap = await db.collection('users').doc(userId).get(); if (userSnap.exists) { const data = userSnap.data(); const miniProfile = { id: userId, displayName: data.displayName || `User...`, profilePictureUrl: data.profilePictureUrl || null, }; miniProfileCache[userId] = miniProfile; return miniProfile; } else { miniProfileCache[userId] = { id: userId, displayName: "User Not Found", profilePictureUrl: null }; return miniProfileCache[userId]; } } catch (error) { console.error(`Error fetching mini profile for ${userId}:`, error); return { id: userId, displayName: "Error Loading User", profilePictureUrl: null }; } }
function determineFriendshipStatus(viewerUid, profileOwnerUid) { if (!viewerUid || !profileOwnerUid || viewerUid === profileOwnerUid || !viewerProfileData?.friends) { return 'none'; } return viewerProfileData.friends[profileOwnerUid] || 'none'; }
function clearFriendshipControls() { if (friendshipControlsContainer) { friendshipControlsContainer.innerHTML = ''; } }
function resetFriendsSection() { if (friendsSectionWrapper) friendsSectionWrapper.style.display = 'none'; if (friendsSection) { const buttons = friendsTabsContainer?.querySelectorAll('.tab-button'); const contents = friendsSection.querySelectorAll('.tab-content'); buttons?.forEach((btn, index) => { btn.classList.toggle('active', index === 0); if(btn.dataset.tab === 'incoming-requests' && incomingCountSpan) incomingCountSpan.textContent = '0'; if(btn.dataset.tab === 'outgoing-requests' && outgoingCountSpan) outgoingCountSpan.textContent = '0'; }); contents?.forEach((content, index) => { content.classList.toggle('active', index === 0); const list = content.querySelector('ul.friend-request-list'); if (list) list.innerHTML = `<li class="list-message">Loading...</li>`; }); } }
function displayFriendshipControls(status, profileOwnerUid) { clearFriendshipControls(); if (!friendshipControlsContainer || !loggedInUser || isOwnProfile) return; friendshipControlsContainer.style.minHeight = '40px'; let button = null; let button2 = null; switch (status) { case 'none': button = document.createElement('button'); button.textContent = 'Add Friend'; button.className = 'btn btn-primary'; button.title = `Send a friend request`; button.onclick = (e) => handleFriendAction(e.currentTarget, 'sendRequest', profileOwnerUid); break; case 'outgoing': button = document.createElement('button'); button.textContent = 'Cancel Request'; button.className = 'btn btn-secondary btn-cancel'; button.title = `Cancel friend request`; button.onclick = (e) => handleFriendAction(e.currentTarget, 'cancelRequest', profileOwnerUid); break; case 'incoming': button = document.createElement('button'); button.textContent = 'Accept'; button.className = 'btn btn-primary btn-accept btn-small'; button.title = `Accept friend request`; button.onclick = (e) => handleFriendAction(e.currentTarget, 'acceptRequest', profileOwnerUid); button2 = document.createElement('button'); button2.textContent = 'Decline'; button2.className = 'btn btn-secondary btn-decline btn-small'; button2.title = `Decline friend request`; button2.onclick = (e) => handleFriendAction(e.currentTarget, 'declineRequest', profileOwnerUid); break; case 'friend': button = document.createElement('button'); button.textContent = 'Remove Friend'; button.className = 'btn btn-secondary btn-remove'; button.title = `Remove friend`; button.onclick = (e) => handleFriendAction(e.currentTarget, 'removeFriend', profileOwnerUid); break; default: break; } if (button) friendshipControlsContainer.appendChild(button); if (button2) friendshipControlsContainer.appendChild(button2); }
async function displayFriendsSection(profileData) { if (!isOwnProfile || !friendsSectionWrapper || !friendsSection || !profileData || typeof profileData.friends !== 'object') { resetFriendsSection(); return; } if (!friendsListUl || !incomingListUl || !outgoingListUl || !incomingCountSpan || !outgoingCountSpan || !friendsTabsContainer) { console.error("Required friend section elements are missing."); resetFriendsSection(); return; } console.log("Displaying friends section for own profile..."); friendsSectionWrapper.style.display = 'block'; const friendsMap = profileData.friends || {}; const friendIds = []; const incomingIds = []; const outgoingIds = []; for (const userId in friendsMap) { if (friendsMap.hasOwnProperty(userId)) { switch (friendsMap[userId]) { case 'friend': friendIds.push(userId); break; case 'incoming': incomingIds.push(userId); break; case 'outgoing': outgoingIds.push(userId); break; } } } incomingCountSpan.textContent = incomingIds.length; outgoingCountSpan.textContent = outgoingIds.length; try { await Promise.all([ populateFriendList(friendsListUl, friendIds, 'friend', 'You have no friends yet.'), populateFriendList(incomingListUl, incomingIds, 'incoming', 'No incoming friend requests.'), populateFriendList(outgoingListUl, outgoingIds, 'outgoing', 'No outgoing friend requests.') ]); } catch(listError) { console.error("Error populating friend lists:", listError); } if (friendsTabsContainer && !friendsTabsContainer.dataset.listenerAttached) { friendsTabsContainer.addEventListener('click', (event) => { const clickedButton = event.target.closest('.tab-button'); if (clickedButton) { const targetTabId = clickedButton.dataset.tab; if (!targetTabId) return; const currentTabButtons = friendsTabsContainer.querySelectorAll('.tab-button'); const currentTabContents = friendsSection.querySelectorAll('.tab-content'); currentTabButtons.forEach(btn => btn.classList.remove('active')); currentTabContents.forEach(content => content.classList.remove('active')); clickedButton.classList.add('active'); const targetContent = friendsSection.querySelector(`#${targetTabId}-container`); if (targetContent) targetContent.classList.add('active'); else console.error(`Could not find tab content for ID: #${targetTabId}-container`); } }); friendsTabsContainer.dataset.listenerAttached = 'true'; } }
async function populateFriendList(ulElement, userIds, type, emptyMessage) { if (!ulElement) return; ulElement.innerHTML = ''; if (!userIds || userIds.length === 0) { ulElement.innerHTML = `<li class="list-message">${emptyMessage}</li>`; return; } ulElement.innerHTML = `<li class="list-message">Loading user details...</li>`; const profilePromises = userIds.map(id => fetchUserMiniProfile(id).catch(err => { console.error(`Error fetching mini profile for ${id} in list ${type}:`, err); return { id: id, displayName: "Error Loading", profilePictureUrl: null }; })); const profiles = await Promise.all(profilePromises); const validProfiles = profiles.filter(p => p !== null); ulElement.innerHTML = ''; let itemsAdded = 0; validProfiles.forEach(miniProfile => { if (miniProfile && miniProfile.id && miniProfile.displayName) { if (miniProfile.displayName === "Error Loading User" || miniProfile.displayName === "User Not Found") { ulElement.appendChild(createFriendListItemError(miniProfile.id, miniProfile.displayName)); } else { ulElement.appendChild(createFriendListItem(miniProfile, type)); itemsAdded++; } } else { console.warn(`Skipping invalid miniProfile object for list ${type}:`, miniProfile); } }); if (itemsAdded === 0 && validProfiles.length > 0) { ulElement.innerHTML = `<li class="list-message">Could not load user details.</li>`; } else if (ulElement.childElementCount === 0) { ulElement.innerHTML = `<li class="list-message">${emptyMessage}</li>`; } }
function createFriendListItem(miniProfile, type) { const li = document.createElement('li'); li.className = 'friend-item'; li.dataset.userId = miniProfile.id; const infoDiv = document.createElement('div'); infoDiv.className = 'friend-item-info'; const pfpElement = createFriendPfpElement(miniProfile); infoDiv.appendChild(pfpElement); const nameSpan = document.createElement('span'); nameSpan.className = 'friend-item-name'; const nameLink = document.createElement('a'); nameLink.href = `profile.html?uid=${miniProfile.id}`; nameLink.textContent = miniProfile.displayName; nameLink.title = `View ${miniProfile.displayName}'s profile`; nameSpan.appendChild(nameLink); infoDiv.appendChild(nameSpan); li.appendChild(infoDiv); const actionsDiv = document.createElement('div'); actionsDiv.className = 'friend-item-actions'; let button1 = null; let button2 = null; switch(type) { case 'friend': button1 = createFriendActionButton('Remove', 'remove', 'secondary', miniProfile.id, li); break; case 'incoming': button1 = createFriendActionButton('Accept', 'accept', 'primary', miniProfile.id, li); button2 = createFriendActionButton('Decline', 'decline', 'secondary', miniProfile.id, li); break; case 'outgoing': button1 = createFriendActionButton('Cancel', 'cancel', 'secondary', miniProfile.id, li); break; } if(button1) actionsDiv.appendChild(button1); if(button2) actionsDiv.appendChild(button2); li.appendChild(actionsDiv); return li; }
function createFriendPfpElement(miniProfile) { const container = document.createElement('div'); container.style.width = '40px'; container.style.height = '40px'; container.style.flexShrink = '0'; const initialDiv = document.createElement('div'); initialDiv.className = 'friend-item-pfp-initial'; initialDiv.textContent = miniProfile.displayName?.charAt(0)?.toUpperCase() || '?'; initialDiv.style.display = 'flex'; container.appendChild(initialDiv); if (miniProfile.profilePictureUrl) { const img = document.createElement('img'); img.src = miniProfile.profilePictureUrl; img.alt = `${miniProfile.displayName || 'User'}'s profile picture`; img.className = 'friend-item-pfp'; img.style.display = 'none'; img.onload = () => { initialDiv.style.display = 'none'; img.style.display = 'block'; }; img.onerror = () => { console.warn(`Failed to load PFP image for ${miniProfile.id}`); img.style.display = 'none'; initialDiv.style.display = 'flex'; }; container.appendChild(img); } return container; }
function createFriendActionButton(text, type, style, userId, listItem) { const btn = document.createElement('button'); btn.textContent = text; btn.className = `btn btn-${style} btn-${type} btn-small`; const actionMap = { remove: 'removeFriend', accept: 'acceptRequest', decline: 'declineRequest', cancel: 'cancelRequest' }; btn.onclick = (e) => handleFriendAction(e.currentTarget, actionMap[type], userId, listItem); btn.title = `${text} friend request/friendship`; return btn; }
function createFriendListItemError(userId, message) { const li = document.createElement('li'); li.className = 'friend-item list-message'; li.dataset.userId = userId; li.innerHTML = `<div class="friend-item-info" style="opacity: 0.6;"><div class="friend-item-pfp-initial" style="background-color: var(--text-secondary);">?</div><span class="friend-item-name">${message} (ID: ${userId ? userId.substring(0,8) + '...' : 'N/A'})</span></div><div class="friend-item-actions"></div>`; return li; }
async function handleFriendAction(buttonElement, action, otherUserId, listItemToRemove = null) { if (!loggedInUser || !otherUserId) { console.error("Friend action validation failed."); alert("Could not perform action."); return; } if (!buttonElement) { console.error("Button element missing."); return; } const currentUserUid = loggedInUser.uid; buttonElement.disabled = true; const originalText = buttonElement.textContent; buttonElement.textContent = '...'; const actionContainer = buttonElement.closest('.friend-item-actions') || friendshipControlsContainer; const siblingButtons = actionContainer ? Array.from(actionContainer.querySelectorAll('button')) : []; siblingButtons.forEach(btn => { if (btn !== buttonElement) btn.disabled = true; }); const userDocRef = db.collection('users').doc(currentUserUid); const otherUserDocRef = db.collection('users').doc(otherUserId); const batch = db.batch(); try { console.log(`Performing friend action: ${action} between ${currentUserUid} and ${otherUserId}`); const deleteField = firebase.firestore.FieldValue.delete(); switch (action) { case 'sendRequest': batch.update(userDocRef, { [`friends.${otherUserId}`]: 'outgoing' }); batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: 'incoming' }); break; case 'cancelRequest': case 'declineRequest': case 'removeFriend': batch.update(userDocRef, { [`friends.${otherUserId}`]: deleteField }); batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: deleteField }); break; case 'acceptRequest': batch.update(userDocRef, { [`friends.${otherUserId}`]: 'friend' }); batch.update(otherUserDocRef, { [`friends.${currentUserUid}`]: 'friend' }); break; default: throw new Error(`Invalid friend action: ${action}`); } await batch.commit(); console.log("Friend action batch committed successfully."); delete miniProfileCache[currentUserUid]; delete miniProfileCache[otherUserId]; try { const viewerSnap = await userDocRef.get(); if (viewerSnap.exists) { const latestViewerData = { id: viewerSnap.id, ...viewerSnap.data() }; if (!latestViewerData.friends) latestViewerData.friends = {}; viewerProfileData = latestViewerData; if (isOwnProfile) { viewingUserProfileData.profile = viewerProfileData; viewingUserProfileData.stats = viewingUserProfileData.stats || null; saveCombinedDataToCache(currentUserUid, viewingUserProfileData); } console.log("Refreshed viewerProfileData after action."); } else { console.error("Failed to refetch viewer profile after action!"); } } catch (fetchError) { console.error("Error refetching viewer profile after action:", fetchError); } if (isOwnProfile) { await displayFriendsSection(viewerProfileData); } else if (viewingUserProfileData.profile?.id === otherUserId) { const newStatus = determineFriendshipStatus(currentUserUid, otherUserId); displayFriendshipControls(newStatus, otherUserId); } } catch (error) { console.error(`Error performing friend action '${action}':`, error); alert(`An error occurred: ${error.message || 'Failed to perform friend action.'}. Please try again.`); buttonElement.disabled = false; buttonElement.textContent = originalText; siblingButtons.forEach(btn => { if (btn !== buttonElement) btn.disabled = false; }); } }

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
        if (profileArea) profileArea.style.display = 'none';
        try {
            if (!allAchievements) fetchAllAchievements(); // Attempt pre-fetch
            await loadCombinedUserData(targetUid);
            console.log("Initial data load process completed.");
            if (viewingUserProfileData.profile) {
                if (isOwnProfile) { setupProfilePicEditing(); setupBannerEditing(); }
                else { if(editProfilePicIcon) editProfilePicIcon.style.display = 'none'; if(editBannerIcon) editBannerIcon.style.display = 'none'; }
                profileLogoutBtn.style.display = isOwnProfile ? 'inline-block' : 'none';
            } else { profileLogoutBtn.style.display = 'none'; }
        } catch (err) {
            console.error("Critical error during initial profile load sequence:", err);
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            if (profileArea) profileArea.style.display = 'none';
            if (notLoggedInMsg) { notLoggedInMsg.textContent = 'Failed to load profile. An unexpected error occurred.'; notLoggedInMsg.style.display = 'flex'; }
            profileLogoutBtn.style.display = 'none'; clearFriendshipControls(); resetFriendsSection();
            if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none';
            if (competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'none';
            if (poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'none';
        }
    } else {
        console.log('No user logged in and no profile UID in URL.');
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (profileArea) profileArea.style.display = 'none';
        if (notLoggedInMsg) { notLoggedInMsg.style.display = 'flex'; notLoggedInMsg.innerHTML = 'Please <a href="index.html#login-section" style="color: var(--primary-orange); margin: 0 5px;">log in</a> to view your profile, or provide a user ID in the URL.'; }
        if (adminTag) adminTag.style.display = 'none'; if (profileBadgesContainer) profileBadgesContainer.innerHTML = ''; if (profileLogoutBtn) profileLogoutBtn.style.display = 'none'; if (editProfilePicIcon) editProfilePicIcon.style.display = 'none'; if (editBannerIcon) editBannerIcon.style.display = 'none'; updateProfileTitlesAndRank(null, false); displayBanner(null); if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = ''; if(competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'none'; if(poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'none'; closeTitleSelector(); closeEditModal(); clearFriendshipControls(); resetFriendsSection(); if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none';
        viewingUserProfileData = {}; viewerProfileData = null; miniProfileCache = {};
    }
});

// --- Logout Button Event Listener ---
profileLogoutBtn.addEventListener('click', () => {
    const userId = loggedInUser?.uid; console.log(`Logout button clicked by user: ${userId || 'N/A'}`);
    if (titleDisplay) titleDisplay.removeEventListener('click', handleTitleClick); closeTitleSelector(); closeEditModal(); clearFriendshipControls(); resetFriendsSection(); if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none'; if (competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'none'; if (poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'none'; if (editProfilePicIcon) { editProfilePicIcon.onclick = null; editProfilePicIcon.style.display = 'none'; } if (profilePicInput) profilePicInput.onchange = null; if (editBannerIcon) { editBannerIcon.onclick = null; editBannerIcon.style.display = 'none'; } if (bannerInput) bannerInput.onchange = null;
    auth.signOut().then(() => {
        console.log('User signed out successfully.');
        if (userId) { localStorage.removeItem(`poxelProfileCombinedData_${userId}`); console.log(`Cleared cached profile data for UID: ${userId}`); }
        loggedInUser = null; viewerProfileData = null; viewingUserProfileData = {}; miniProfileCache = {}; isOwnProfile = false;
        window.location.href = 'index.html';
    }).catch((error) => { console.error('Sign out error:', error); alert('Error signing out.'); });
});

// =============================================================================
// --- Local Storage Caching ---
// =============================================================================
function loadCombinedDataFromCache(viewedUserId) {
    if (!viewedUserId) return false; const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
    try { const cachedDataString = localStorage.getItem(cacheKey); if (!cachedDataString) return false; const cachedData = JSON.parse(cachedDataString);
        if (cachedData?.profile?.id === viewedUserId) {
            cachedData.profile.friends ??= {}; cachedData.profile.leaderboardStats ??= {}; cachedData.profile.availableTitles ??= []; cachedData.profile.equippedTitle = cachedData.profile.equippedTitle !== undefined ? cachedData.profile.equippedTitle : ""; cachedData.profile.currentRank ??= "Unranked"; cachedData.profile.bannerUrl ??= null; cachedData.stats ??= null;
            viewingUserProfileData = cachedData; console.log("Loaded combined data from cache for VIEWED UID:", viewedUserId);
            const viewingOwnCachedProfile = loggedInUser && loggedInUser.uid === viewedUserId;
            displayProfileData(viewingUserProfileData.profile, viewingOwnCachedProfile); displayBanner(viewingUserProfileData.profile.bannerUrl);
            if(competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'block'; displayCompetitiveStats(viewingUserProfileData.stats);
            return true;
        } else { localStorage.removeItem(cacheKey); return false; }
    } catch (error) { console.error("Error loading cached data:", error); try { localStorage.removeItem(cacheKey); } catch(e) {} return false; }
}

function saveCombinedDataToCache(viewedUserId, combinedData) {
     if (!viewedUserId || !combinedData?.profile?.id || viewedUserId !== combinedData.profile.id) { console.warn("Invalid data or ID mismatch for cache save.", { viewedUserId, profileId: combinedData?.profile?.id }); return; }
    const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
    try { const dataToSave = { profile: { ...combinedData.profile, friends: combinedData.profile.friends || {}, availableTitles: combinedData.profile.availableTitles || [], equippedTitle: combinedData.profile.equippedTitle !== undefined ? combinedData.profile.equippedTitle : "", currentRank: combinedData.profile.currentRank || "Unranked", leaderboardStats: combinedData.profile.leaderboardStats || {}, bannerUrl: combinedData.profile.bannerUrl || null }, stats: combinedData.stats || null }; localStorage.setItem(cacheKey, JSON.stringify(dataToSave)); }
    catch(error) { console.error(`Error saving profile data to cache for UID ${viewedUserId}:`, error); if (error.name === 'QuotaExceededError' || error.message?.toLowerCase().includes('quota')) { console.warn('LocalStorage quota exceeded.'); } }
}

// --- Initial Log ---
console.log("Profile script initialized (v2 Layout). Waiting for Auth state...");
