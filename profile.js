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
const adminEmails = [ 'trixdesignsofficial@gmail.com', 'jackdmbell@outlook.com', 'myrrr@myrrr.myrrr' ].map(e => e.toLowerCase());
const badgeConfig = {
    verified: { emails: ['jackdmbell@outlook.com', 'myrrr@myrrr.myrrr', 'leezak5555@gmail.com'].map(e => e.toLowerCase()), className: 'badge-verified', title: 'Verified' },
    creator: { emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()), className: 'badge-creator', title: 'Creator' },
    moderator: { emails: ['jackdmbell@outlook.com', 'mod_team@sample.org'].map(e => e.toLowerCase()), className: 'badge-moderator', title: 'Moderator' }
};

// --- CORE DOM Element Lookups ---
const profileArea = document.getElementById('profile-area');
const loadingIndicator = document.getElementById('loading-profile');
const notLoggedInMsg = document.getElementById('not-logged-in');
const profileLogoutBtn = document.getElementById('profile-logout-btn');

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
async function fetchPoxelStats(username) { /* ... (unchanged) ... */ if (!username || typeof username !== 'string' || username.trim() === '') { return null; } console.log(`Fetching Poxel.io stats for: ${username}`); try { const apiUrl = `https://dev-usa-1.poxel.io/api/profile/stats/${encodeURIComponent(username)}`; const res = await fetch(apiUrl, { headers: { "Content-Type": "application/json" } }); if (!res.ok) { let errorMsg = `HTTP error ${res.status}`; if (res.status === 404) { errorMsg = "User not found on Poxel.io"; } else { try { const errorData = await res.json(); errorMsg = errorData.message || errorData.error || errorMsg; } catch (parseError) {} } throw new Error(errorMsg); } const data = await res.json(); if (typeof data !== 'object' || data === null) throw new Error("Invalid data format from Poxel.io API."); if (data.error || data.status === 'error') { if (data.message && data.message.toLowerCase().includes('not found')) { throw new Error('User not found on Poxel.io'); } throw new Error(data.message || 'Poxel.io API error.'); } return data; } catch (e) { console.error("Error fetching Poxel.io stats:", e.message || e); return null; } }
async function fetchAllAchievements() { /* ... (unchanged - fetch logic) ... */ if (allAchievements) return allAchievements; console.log("Fetching all achievement definitions..."); try { const snapshot = await db.collection('achievements').get(); const fetchedAchievements = {}; snapshot.forEach(doc => { fetchedAchievements[doc.id] = { id: doc.id, ...doc.data() }; }); if (Object.keys(fetchedAchievements).length > 0) { allAchievements = fetchedAchievements; console.log(`Fetched ${Object.keys(allAchievements).length} achievement definitions.`); return allAchievements; } else { console.warn("Fetched empty achievement definitions."); allAchievements = {}; return null; } } catch (error) { console.error("Error fetching achievement definitions:", error); allAchievements = {}; return null; } }
function areStatsDifferent(newStats, existingProfileStats) { /* ... (unchanged) ... */ const normNew = newStats || {}; const normExisting = existingProfileStats || {}; const statKeys = ['wins', 'points', 'kdRatio', 'matchesPlayed', 'matches', 'losses']; let different = false; for (const key of statKeys) { let newValue = normNew[key]; let existingValue = normExisting[key]; if(key === 'matchesPlayed' && !normNew.hasOwnProperty('matchesPlayed') && normNew.hasOwnProperty('matches')) { newValue = normNew.matches; } if(key === 'matchesPlayed' && !normExisting.hasOwnProperty('matchesPlayed') && normExisting.hasOwnProperty('matches')) { existingValue = normExisting.matches; } newValue = newValue ?? null; existingValue = existingValue ?? null; if (key === 'kdRatio' && typeof newValue === 'number' && typeof existingValue === 'number') { if (Math.abs(newValue - existingValue) > 0.001) { different = true; break; } } else if (newValue !== existingValue) { different = true; break; } } if (!different) { const newRelevantKeys = Object.keys(normNew).filter(k => statKeys.includes(k) || (k === 'matches' && statKeys.includes('matchesPlayed'))); const existingRelevantKeys = Object.keys(normExisting).filter(k => statKeys.includes(k)|| (k === 'matches' && statKeys.includes('matchesPlayed'))); if (newRelevantKeys.length !== existingRelevantKeys.length) { different = true; } else { const newSet = new Set(newRelevantKeys); if (!existingRelevantKeys.every(key => newSet.has(key))) { different = true; } } } return different; }
async function createUserProfileDocument(userId, authUser) { /* ... (unchanged) ... */ if (!userId || !authUser) { return null; } console.warn(`Client-side: Creating profile doc for UID: ${userId}`); const userDocRef = db.collection("users").doc(userId); const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`; const defaultProfileData = { email: authUser.email ? authUser.email.toLowerCase() : null, displayName: displayName, currentRank: "Unranked", equippedTitle: "", availableTitles: [], friends: {}, createdAt: firebase.firestore.FieldValue.serverTimestamp(), leaderboardStats: {}, profilePictureUrl: authUser.photoURL || null, bannerUrl: null, poxelStats: {} }; try { await userDocRef.set(defaultProfileData, { merge: false }); console.log(`Created profile doc for UID: ${userId}`); return { id: userId, ...defaultProfileData, createdAt: new Date() }; } catch (error) { console.error(`Error creating profile doc for ${userId}:`, error); return null; } }

async function loadCombinedUserData(targetUserId) {
    // ... (reset logic mostly unchanged) ...
    console.log(`Loading data for TARGET UID: ${targetUserId}`); isOwnProfile = loggedInUser && loggedInUser.uid === targetUserId; console.log("Is own profile:", isOwnProfile); viewerProfileData = null; miniProfileCache = {}; viewingUserProfileData = {}; if (profileArea) profileArea.style.display = 'none'; if (notLoggedInMsg) notLoggedInMsg.style.display = 'none'; if (loadingIndicator) loadingIndicator.style.display = 'flex'; const compStatsWrap = document.getElementById('competitive-stats-section-wrapper'); const poxelStatsWrap = document.getElementById('poxel-stats-section-wrapper'); const achievOuter = document.getElementById('achievements-section-outer'); const friendsWrap = document.getElementById('friends-section-wrapper'); if(compStatsWrap) compStatsWrap.style.display = 'none'; if(poxelStatsWrap) poxelStatsWrap.style.display = 'none'; if(achievOuter) achievOuter.style.display = 'none'; if(friendsWrap) friendsWrap.style.display = 'none'; updateProfileTitlesAndRank(null, false); displayBanner(null); clearFriendshipControls(); resetFriendsSection();

    const cacheLoaded = loadCombinedDataFromCache(targetUserId);
    if (!allAchievements) fetchAllAchievements();

    // Fetch Viewer's Profile Data (if needed) - unchanged
     if (loggedInUser && !isOwnProfile) { try { /* ... fetch viewer ... */ } catch(e){ /* ... */ } }

    const userProfileRef = db.collection('users').doc(targetUserId);
    const leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId);
    let userUnlockedAchievementIds = [];

    try {
        if (isOwnProfile) { userUnlockedAchievementIds = await fetchUserUnlockedAchievements(targetUserId); }
        let profileSnap = await userProfileRef.get(); let profileData = null; if (!profileSnap?.exists) { /* Create if owner or throw error */ } else { profileData = { id: profileSnap.id, ...profileSnap.data() }; /* Ensure fields exist */ } if (isOwnProfile) { /* Set viewer data */ }
        let competitiveStatsData = null; if(profileData) { /* Fetch comp stats */ } if (profileData && competitiveStatsData) { /* Sync stats if needed */ }
        viewingUserProfileData = { profile: profileData, stats: competitiveStatsData };

        // Core display (now safer internally)
        displayProfileData(viewingUserProfileData.profile, isOwnProfile);
        displayBanner(viewingUserProfileData.profile?.bannerUrl);
        saveCombinedDataToCache(targetUserId, viewingUserProfileData);

        // Section displays (now safer internally)
        displayCompetitiveStats(viewingUserProfileData.stats);
        if (loggedInUser) { /* display friend controls/section */ }
        // Poxel stats fetch + display
        if (profileData?.displayName) { displayPoxelStats(null, 'Loading...'); fetchPoxelStats(profileData.displayName).then(displayPoxelStats).catch(e => displayPoxelStats(null, e.message||'Error')); } else { displayPoxelStats(null, 'Username unavailable.'); }
        // Achievement display
        if (isOwnProfile) { await displayAchievementsSection(viewingUserProfileData.stats, userUnlockedAchievementIds); }
        // Achievement granting (after display)
        if (isOwnProfile && viewingUserProfileData.stats) { /* Grant achievements logic */ }

        if (profileArea) profileArea.style.display = 'block';

    } catch (error) { // Error Handling
        console.error(`Error loading profile data:`, error);
        if (profileArea) profileArea.style.display = 'none';
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (notLoggedInMsg) { /* Display error */ }
        closeEditModal(); // Ensure modal closes on main load error
        /* Hide section wrappers on error */
        if(compStatsWrap) compStatsWrap.style.display = 'none';
        if(poxelStatsWrap) poxelStatsWrap.style.display = 'none';
        if(achievOuter) achievOuter.style.display = 'none';
        if(friendsWrap) friendsWrap.style.display = 'none';
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

function displayBanner(imageUrl) { /* ... (unchanged - gets element locally) ... */ }

function displayProfileData(profileData, isOwner) {
    // ... (unchanged - uses local lookups now) ...
    const usernameDisp = document.getElementById('profile-username'); const profileImg = document.getElementById('profile-image'); const profileInit = document.getElementById('profile-initials'); /*...*/ if (!profileData || !profileArea || !usernameDisp || !profileImg || !profileInit) { console.error("Core elements missing"); return; } profileArea.style.display = 'block'; /* Display PFP */ /* Display/Hide edit icons */ displayUserBadges(profileData); updateProfileTitlesAndRank(profileData, isOwner); if (isOwner) { /* setup editing */ }
}

// --- Display COMPETITIVE Stats (FIXED: Hides section if no stats) ---
function displayCompetitiveStats(statsData) {
    const displayEl = document.getElementById('stats-display');
    const wrapperEl = document.getElementById('competitive-stats-section-wrapper');

    if (!displayEl || !wrapperEl) {
        console.error("Competitive stats display elements missing.");
        return; // Exit if elements aren't there
    }

    // Check if data is actually present
    const hasStats = statsData && typeof statsData === 'object' && Object.keys(statsData).length > 0;

    if (!hasStats) {
        // If no stats, HIDE the entire section wrapper
        wrapperEl.style.display = 'none';
        displayEl.innerHTML = ''; // Clear just in case
        return;
    }

    // If we have stats, show the wrapper and display them
    wrapperEl.style.display = 'block';
    displayEl.innerHTML = ''; // Clear previous (loading message)

    const statsMap = { wins: 'Wins', points: 'Points', kdRatio: 'K/D Ratio', matchesPlayed: 'Matches Played', losses: 'Losses' };
    if (!statsData.hasOwnProperty('matchesPlayed') && statsData.hasOwnProperty('matches')) { statsMap.matches = 'Matches Played'; delete statsMap.matchesPlayed; }
    let statsAdded = 0;
    for (const key in statsMap) {
        if (statsData.hasOwnProperty(key)) {
            let value = statsData[key]; let displayValue = value;
            if (key === 'kdRatio' && typeof value === 'number') { displayValue = value.toFixed(2); }
            else if (value === null || value === undefined){ displayValue = '-'; }
            displayEl.appendChild(createStatItem(statsMap[key], displayValue));
            statsAdded++;
        }
    }
    if (statsAdded === 0) { // Should be redundant now due to the hasStats check, but safe fallback
        displayEl.innerHTML = '<p class="list-message">No specific stats found.</p>';
    }
}

// --- Display Poxel.io Stats (FIXED: Hides section if no data/error unless message is passed) ---
function displayPoxelStats(poxelData, message = null) {
    const poxelStatsDisp = document.getElementById('poxel-stats-display');
    const poxelStatsWrap = document.getElementById('poxel-stats-section-wrapper');

    if (!poxelStatsDisp || !poxelStatsWrap) {
         console.error("Poxel stats display elements not found.");
         return;
    }
    poxelStatsDisp.innerHTML = ''; // Clear previous

    const hasData = poxelData && typeof poxelData === 'object' && Object.keys(poxelData).length > 0;

    // Determine if the section should be visible
    // Show if: there's data OR there's an explicit message (like "Loading..." or an error message)
    const shouldShow = hasData || message;

    if (!shouldShow) {
        poxelStatsWrap.style.display = 'none'; // Hide if no data and no message
        return;
    }

    poxelStatsWrap.style.display = 'block'; // Show section

    if (message && !hasData) { // Show message only if there's no actual data to display
         poxelStatsDisp.innerHTML = `<p class="list-message">${message}</p>`;
         return;
     }
     if (!hasData && !message){ // Should not happen if shouldShow is true, but safe fallback
        poxelStatsDisp.innerHTML = '<p class="list-message">Poxel.io stats unavailable.</p>';
        return;
     }

    // --- Display Actual Stats (only runs if hasData is true) ---
    const statsMap = { /* ... */ }; let statsAdded = 0;
    for (const key in statsMap) { /* Append items */ }
    if (poxelData.kills !== undefined && poxelData.deaths !== undefined) { /* Append K/D */ statsAdded++; }
    if (statsAdded === 0) { poxelStatsDisp.innerHTML = '<p class="list-message">No relevant stats found.</p>'; }
}


function createStatItem(title, value) { /* ... (unchanged) ... */ }
async function fetchUserUnlockedAchievements(userId) { /* ... (unchanged) ... */ }
function calculateAchievementProgress(achievement, userStats) { /* ... (unchanged) ... */ }

// --- Display Achievements Section (FIXED: More robust item rendering) ---
async function displayAchievementsSection(competitiveStats, unlockedAchievementIds) {
    const outerWrapper = document.getElementById('achievements-section-outer');
    const listContainer = document.getElementById('achievements-list-container');

    if (!outerWrapper || !listContainer) { console.error("Achievement elements missing."); return; }
    if (!isOwnProfile) { outerWrapper.style.display = 'none'; return; }

    let currentAchievements = allAchievements;
    if (!currentAchievements) { console.log("Achiev fetch attempt..."); currentAchievements = await fetchAllAchievements(); if (!currentAchievements || Object.keys(currentAchievements).length === 0) { console.error("Failed Achiev load/empty."); listContainer.innerHTML = '<p class="list-message">Defs load error.</p>'; outerWrapper.style.display = 'block'; if (!allAchievements) allAchievements = {}; return; } }

    listContainer.innerHTML = ''; outerWrapper.style.display = 'block';
    const achievementIds = Object.keys(currentAchievements || {}); if (achievementIds.length === 0) { listContainer.innerHTML = '<p class="list-message">No achievements yet.</p>'; return; }

    console.log(`Displaying ${achievementIds.length} achievements.`);
    let itemsRendered = 0; // Track successfully rendered items

    achievementIds.forEach(id => {
        const achievement = currentAchievements[id];
        // Robust Check: Ensure essential properties exist before proceeding
        if (!achievement || typeof achievement !== 'object' || !achievement.name || !achievement.criteria || !achievement.criteria.stat) {
             console.warn(`Skipping malformed achievement definition for ID: ${id}`, achievement);
             return; // Skip this iteration
        }

        try { // Add try...catch around individual item generation
            const isUnlocked = unlockedAchievementIds?.includes(id) || false;
            const progressInfo = calculateAchievementProgress(achievement, competitiveStats);
            const isDisplayCompleted = isUnlocked || progressInfo.meetsCriteria;
            const itemDiv = document.createElement('div');
            itemDiv.className = `achievement-item ${isUnlocked ? 'achievement-unlocked' : ''} ${isDisplayCompleted ? 'achievement-completed' : ''}`;

            let rewardsHtml = '';
            if (achievement.rewards) { /* ... build rewardsHtml ... */ }

            let progressText = `${progressInfo.progress}%`;
            let progressBarTitle = '';
            const isNumericProgressive = typeof achievement.criteria.value === 'number' && achievement.criteria.value > 0 && achievement.criteria.operator === '>=';
             if (isDisplayCompleted) { /* ... completed text ... */ }
             else if (isNumericProgressive) { /* ... numeric progress text ... */ }
             else { /* ... percentage text ... */ }

            // Build innerHTML carefully
             itemDiv.innerHTML = `
                 <h4>
                     <span>${achievement.name || 'Unnamed Achievement'}</span>
                     ${isDisplayCompleted ? '<span class="completion-icon" title="Completed!">✔</span>' : ''}
                 </h4>
                 <p class="achievement-description">${achievement.description || 'No description available.'}</p>
                 ${achievement.criteria.value !== undefined ? `
                     <div class="achievement-progress-container" title="${progressBarTitle || 'Progress'}">
                         <div class="achievement-progress-bar" style="width: ${progressInfo.progress || 0}%;">
                             <span>${progressText || '0%'}</span>
                         </div>
                     </div>
                 ` : '<div style="height: 5px;"></div>' /* Spacer if no progress */ }
                 ${rewardsHtml}
             `;

            listContainer.appendChild(itemDiv);
            itemsRendered++; // Increment counter

        } catch (itemError) {
            console.error(`Error rendering achievement item ID ${id}:`, itemError);
             // Optionally append an error placeholder for this specific item
             const errorLi = document.createElement('div');
             errorLi.className = 'achievement-item'; // Use same base class
             errorLi.style.opacity = '0.5';
             errorLi.style.borderColor = 'red';
             errorLi.innerHTML = `<h4>Error loading achievement: ${id}</h4><p class="list-message">${itemError.message}</p>`;
             listContainer.appendChild(errorLi);
        }
    });

    // Final check if *nothing* rendered despite having definitions
    if (itemsRendered === 0 && achievementIds.length > 0) {
         // Only show "Display error." if NO items could be rendered at all
        listContainer.innerHTML = '<p class="list-message">Display error.</p>';
    }
}

async function checkAndGrantAchievements(userId, currentUserProfile, competitiveStats) { /* ... (unchanged) ... */ }

// --- UI Display Helpers ---
function displayUserBadges(profileData) { /* ... (unchanged - uses local lookup) ... */ }
function updateProfileTitlesAndRank(profileData, allowInteraction) { /* ... (unchanged - uses local lookup) ... */ }
function handleTitleClick(event) { /* ... (unchanged) ... */ }
function openTitleSelector() { /* ... (unchanged - uses local lookup) ... */ }
function closeTitleSelector() { /* ... (unchanged) ... */ }
function handleClickOutsideTitleSelector(event) { /* ... (unchanged) ... */ }
async function handleTitleOptionClick(event) { /* ... (unchanged - uses local lookup) ... */ }

// --- Image Editing Functions ---
function setupProfilePicEditing(editIconElement, inputElement) { /* ... (unchanged) ... */ if (!isOwnProfile || !editIconElement || !inputElement) { if(editIconElement) editIconElement.style.display = 'none'; return; } editIconElement.style.display = 'flex'; editIconElement.onclick = null; inputElement.onchange = null; editIconElement.onclick = () => { croppingFor = 'pfp'; inputElement.click(); }; inputElement.onchange = (event) => { handleFileSelect(event); }; }
function setupBannerEditing(editIconElement, inputElement) { /* ... (unchanged) ... */ if (!isOwnProfile || !editIconElement || !inputElement) { if(editIconElement) editIconElement.style.display = 'none'; return; } editIconElement.style.display = 'flex'; editIconElement.onclick = null; inputElement.onchange = null; editIconElement.onclick = () => { croppingFor = 'banner'; inputElement.click(); }; inputElement.onchange = (event) => { handleFileSelect(event); }; console.log("Banner editing listeners attached."); }
function handleFileSelect(event) { /* ... (unchanged) ... */ }
function openEditModal() { /* ... (unchanged - uses local lookups) ... */ }
function closeEditModal() { /* ... (unchanged - uses local lookups) ... */ }
async function handleApplyCrop() { /* ... (unchanged - uses local lookups) ... */ }
async function uploadToCloudinary(blob, type = 'image') { /* ... (unchanged) ... */ }
async function saveImageUrlToFirestore(userId, imageUrl, type) { /* ... (unchanged) ... */ }

// --- Friend System Functions ---
async function fetchUserMiniProfile(userId) { /* ... (unchanged) ... */ }
function determineFriendshipStatus(viewerUid, profileOwnerUid) { /* ... (unchanged) ... */ }
function clearFriendshipControls() { /* ... (unchanged - uses local lookup) ... */ }
function resetFriendsSection() { /* ... (unchanged - uses local lookup) ... */ }
function displayFriendshipControls(status, profileOwnerUid) { /* ... (unchanged - uses local lookup) ... */ }
async function displayFriendsSection(profileData) { /* ... (unchanged - uses local lookups) ... */ }
async function populateFriendList(ulElement, userIds, type, emptyMessage) { /* ... (unchanged) ... */ }
function createFriendListItem(miniProfile, type) { /* ... (unchanged) ... */ }
function createFriendPfpElement(miniProfile) { /* ... (unchanged) ... */ }
function createFriendActionButton(text, type, style, userId, listItem) { /* ... (unchanged) ... */ }
function createFriendListItemError(userId, message) { /* ... (unchanged) ... */ }
async function handleFriendAction(buttonElement, action, otherUserId, listItemToRemove = null) { /* ... (unchanged) ... */ }

// =============================================================================
// --- Authentication and Initialization ---
// =============================================================================
auth.onAuthStateChanged(async (user) => { /* ... (unchanged) ... */ });
// --- Logout Button Event Listener ---
profileLogoutBtn.addEventListener('click', () => { closeEditModal(); /* ... (rest unchanged) ... */ });

// =============================================================================
// --- Local Storage Caching ---
// =============================================================================
function loadCombinedDataFromCache(viewedUserId) { /* ... (unchanged) ... */ }
function saveCombinedDataToCache(viewedUserId, combinedData) { /* ... (unchanged) ... */ }

// --- Initial Log ---
console.log("Profile script initialized (v2 Layout - Local Lookups). Waiting for Auth state...");
