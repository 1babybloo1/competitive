// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI",
    authDomain: "poxelcomp.firebaseapp.com",
    projectId: "poxelcomp",
    storageBucket: "poxelcomp.appspot.com",
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

// --- CORE DOM Element Lookups (Used Frequently) ---
// It's generally OK to keep *some* high-level ones global if script is deferred or at end of body
const profileArea = document.getElementById('profile-area');
const loadingIndicator = document.getElementById('loading-profile');
const notLoggedInMsg = document.getElementById('not-logged-in');
const profileLogoutBtn = document.getElementById('profile-logout-btn');

// --- Global/Scoped Variables ---
let allAchievements = null;
let viewingUserProfileData = {}; // Holds { profile: {}, stats: {} }
let viewerProfileData = null; // Holds data of the logged-in user
let miniProfileCache = {};
let isTitleSelectorOpen = false;
let titleSelectorElement = null; // Reference to the dropdown itself
let cropper = null;
let isOwnProfile = false;
let croppingFor = null; // Tracks 'pfp' or 'banner'

// =============================================================================
// --- CORE FUNCTIONS ---
// =============================================================================
async function fetchPoxelStats(username) {
    // ... (unchanged) ...
    if (!username || typeof username !== 'string' || username.trim() === '') { return null; } console.log(`Fetching Poxel.io stats for: ${username}`); try { const apiUrl = `https://dev-usa-1.poxel.io/api/profile/stats/${encodeURIComponent(username)}`; const res = await fetch(apiUrl, { headers: { "Content-Type": "application/json" } }); if (!res.ok) { let errorMsg = `HTTP error ${res.status}`; if (res.status === 404) { errorMsg = "User not found on Poxel.io"; } else { try { const errorData = await res.json(); errorMsg = errorData.message || errorData.error || errorMsg; } catch (parseError) {} } throw new Error(errorMsg); } const data = await res.json(); if (typeof data !== 'object' || data === null) throw new Error("Invalid data format from Poxel.io API."); if (data.error || data.status === 'error') { if (data.message && data.message.toLowerCase().includes('not found')) { throw new Error('User not found on Poxel.io'); } throw new Error(data.message || 'Poxel.io API error.'); } return data; } catch (e) { console.error("Error fetching Poxel.io stats:", e.message || e); return null; }
}

async function fetchAllAchievements() {
    // ... (unchanged - caching logic remains) ...
    if (allAchievements) return allAchievements; console.log("Fetching all achievement definitions..."); try { const snapshot = await db.collection('achievements').get(); const fetchedAchievements = {}; snapshot.forEach(doc => { fetchedAchievements[doc.id] = { id: doc.id, ...doc.data() }; }); if (Object.keys(fetchedAchievements).length > 0) { allAchievements = fetchedAchievements; console.log(`Fetched ${Object.keys(allAchievements).length} achievement definitions.`); return allAchievements; } else { console.warn("Fetched empty achievement definitions."); allAchievements = {}; return null; } } catch (error) { console.error("Error fetching achievement definitions:", error); allAchievements = {}; return null; }
}

function areStatsDifferent(newStats, existingProfileStats) {
    // ... (unchanged) ...
    const normNew = newStats || {}; const normExisting = existingProfileStats || {}; const statKeys = ['wins', 'points', 'kdRatio', 'matchesPlayed', 'matches', 'losses']; let different = false; for (const key of statKeys) { let newValue = normNew[key]; let existingValue = normExisting[key]; if(key === 'matchesPlayed' && !normNew.hasOwnProperty('matchesPlayed') && normNew.hasOwnProperty('matches')) { newValue = normNew.matches; } if(key === 'matchesPlayed' && !normExisting.hasOwnProperty('matchesPlayed') && normExisting.hasOwnProperty('matches')) { existingValue = normExisting.matches; } newValue = newValue ?? null; existingValue = existingValue ?? null; if (key === 'kdRatio' && typeof newValue === 'number' && typeof existingValue === 'number') { if (Math.abs(newValue - existingValue) > 0.001) { different = true; break; } } else if (newValue !== existingValue) { different = true; break; } } if (!different) { const newRelevantKeys = Object.keys(normNew).filter(k => statKeys.includes(k) || (k === 'matches' && statKeys.includes('matchesPlayed'))); const existingRelevantKeys = Object.keys(normExisting).filter(k => statKeys.includes(k)|| (k === 'matches' && statKeys.includes('matchesPlayed'))); if (newRelevantKeys.length !== existingRelevantKeys.length) { different = true; } else { const newSet = new Set(newRelevantKeys); if (!existingRelevantKeys.every(key => newSet.has(key))) { different = true; } } } return different;
}

async function createUserProfileDocument(userId, authUser) {
    // ... (unchanged) ...
    if (!userId || !authUser) { return null; } console.warn(`Client-side: Creating profile doc for UID: ${userId}`); const userDocRef = db.collection("users").doc(userId); const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`; const defaultProfileData = { email: authUser.email ? authUser.email.toLowerCase() : null, displayName: displayName, currentRank: "Unranked", equippedTitle: "", availableTitles: [], friends: {}, createdAt: firebase.firestore.FieldValue.serverTimestamp(), leaderboardStats: {}, profilePictureUrl: authUser.photoURL || null, bannerUrl: null, poxelStats: {} }; try { await userDocRef.set(defaultProfileData, { merge: false }); console.log(`Created profile doc for UID: ${userId}`); return { id: userId, ...defaultProfileData, createdAt: new Date() }; } catch (error) { console.error(`Error creating profile doc for ${userId}:`, error); return null; }
}

async function loadCombinedUserData(targetUserId) {
    // ... (reset logic mostly unchanged) ...
    console.log(`Loading data for TARGET UID: ${targetUserId}`); isOwnProfile = loggedInUser && loggedInUser.uid === targetUserId; console.log("Is own profile:", isOwnProfile); viewerProfileData = null; miniProfileCache = {}; viewingUserProfileData = {};
    if (profileArea) profileArea.style.display = 'none'; if (notLoggedInMsg) notLoggedInMsg.style.display = 'none'; if (loadingIndicator) loadingIndicator.style.display = 'flex';

    // Local lookup for section elements before clearing/hiding
    const compStatsDisp = document.getElementById('stats-display');
    const poxelStatsDisp = document.getElementById('poxel-stats-display');
    const achievListCont = document.getElementById('achievements-list-container');
    const compStatsWrap = document.getElementById('competitive-stats-section-wrapper');
    const poxelStatsWrap = document.getElementById('poxel-stats-section-wrapper');
    const achievOuter = document.getElementById('achievements-section-outer');
    const friendsWrap = document.getElementById('friends-section-wrapper');

    if(compStatsDisp) compStatsDisp.innerHTML = '<p class="list-message">Loading...</p>';
    if(poxelStatsDisp) poxelStatsDisp.innerHTML = '<p class="list-message">Loading...</p>';
    if(achievListCont) achievListCont.innerHTML = '<p class="list-message">Loading...</p>';
    if(compStatsWrap) compStatsWrap.style.display = 'none';
    if(poxelStatsWrap) poxelStatsWrap.style.display = 'none';
    if(achievOuter) achievOuter.style.display = 'none';
    if(friendsWrap) friendsWrap.style.display = 'none'; // resetFriendsSection also hides it

    updateProfileTitlesAndRank(null, false); displayBanner(null); clearFriendshipControls(); resetFriendsSection();

    const cacheLoaded = loadCombinedDataFromCache(targetUserId);
    if (!allAchievements) fetchAllAchievements(); // Pre-fetch definitions

    if (loggedInUser && !isOwnProfile) { /* ... fetch viewer data unchanged ... */ }

    const userProfileRef = db.collection('users').doc(targetUserId);
    const leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId);
    let userUnlockedAchievementIds = [];

    try {
        if (isOwnProfile) { userUnlockedAchievementIds = await fetchUserUnlockedAchievements(targetUserId); }

        // 1. Fetch Profile Data (unchanged logic)
        let profileSnap = await userProfileRef.get(); let profileData = null; if (!profileSnap?.exists) { if (isOwnProfile && loggedInUser) { profileData = await createUserProfileDocument(targetUserId, loggedInUser); if (!profileData) throw new Error(`Profile creation failed`); } else { throw new Error(`Profile not found`); } } else { profileData = { id: profileSnap.id, ...profileSnap.data() }; /* Ensure fields */ if(!profileData.bannerUrl) profileData.bannerUrl=null; if(!profileData.friends) profileData.friends={}; /*etc*/ } if (isOwnProfile) { viewerProfileData = profileData; if (!viewerProfileData.friends) viewerProfileData.friends = {}; }

        // 2. Fetch Comp Stats (unchanged)
        let competitiveStatsData = null; if(profileData) { const statsSnap = await leaderboardStatsRef.get(); competitiveStatsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null; }

        // 3. Sync Stats (unchanged)
        if (profileData && competitiveStatsData) { if (areStatsDifferent(competitiveStatsData, profileData.leaderboardStats)) { /* Sync */ } }

        // 4. Update Global State (unchanged)
        viewingUserProfileData = { profile: profileData, stats: competitiveStatsData };

        // 5. Display Core Profile & Cache (unchanged)
        displayProfileData(viewingUserProfileData.profile, isOwnProfile);
        displayBanner(viewingUserProfileData.profile?.bannerUrl);
        saveCombinedDataToCache(targetUserId, viewingUserProfileData);

        // --- Display Sections ---
        displayCompetitiveStats(viewingUserProfileData.stats); // Gets elements internally
        if (loggedInUser) { /* display friend controls/section */ }
        if (profileData?.displayName) { displayPoxelStats(null, 'Loading Poxel.io stats...'); fetchPoxelStats(profileData.displayName).then(poxelData => displayPoxelStats(poxelData)).catch(e => displayPoxelStats(null, e.message||'Error')); } else { displayPoxelStats(null, 'Poxel username unavailable.'); }
        if (isOwnProfile) { await displayAchievementsSection(viewingUserProfileData.stats, userUnlockedAchievementIds); } // Gets elements internally

        // --- Post-display Achievement Granting (unchanged) ---
        if (isOwnProfile && viewingUserProfileData.stats) { /* ... check and grant achievements ... */ }

        if (profileArea) profileArea.style.display = 'block'; // Show main area

    } catch (error) { // Error handling (unchanged)
        console.error(`Error loading profile data:`, error); /* Show error message, hide content */
    } finally { if (loadingIndicator) loadingIndicator.style.display = 'none'; }
}

function displayBanner(imageUrl) {
    const bannerEl = document.getElementById('profile-banner'); // Local lookup
    if (!bannerEl) return;
    if (imageUrl) { bannerEl.style.backgroundImage = `url('${imageUrl}')`; }
    else { bannerEl.style.backgroundImage = 'none'; }
}

function displayProfileData(profileData, isOwner) {
    // Look up elements used here specifically
    const usernameDisp = document.getElementById('profile-username');
    const profileImg = document.getElementById('profile-image');
    const profileInit = document.getElementById('profile-initials');
    const editPicIcon = document.getElementById('edit-profile-pic-icon');
    const editBannerIcon = document.getElementById('edit-banner-icon');
    const profilePicInput = document.getElementById('profile-pic-input');
    const bannerInput = document.getElementById('banner-input');

    if (!profileData || !profileArea || !usernameDisp || !profileImg || !profileInit) {
         console.error("Core display elements missing in displayProfileData");
         if(profileArea) profileArea.style.display = 'none';
         if (notLoggedInMsg) { notLoggedInMsg.textContent = 'Profile unavailable.'; notLoggedInMsg.style.display = 'flex'; }
        return;
    }

    profileArea.style.display = 'block';
    const displayName = profileData.displayName || 'Anonymous User';
    usernameDisp.textContent = displayName;

    if (profileData.profilePictureUrl) {
        profileImg.src = profileData.profilePictureUrl; profileImg.style.display = 'block'; profileInit.style.display = 'none';
        profileImg.onerror = () => { profileImg.style.display = 'none'; profileInit.textContent = displayName?.charAt(0)?.toUpperCase() || '?'; profileInit.style.display = 'flex'; };
    } else {
        profileImg.style.display = 'none'; profileImg.src = ''; profileInit.textContent = displayName?.charAt(0)?.toUpperCase() || '?'; profileInit.style.display = 'flex';
    }

    if (editPicIcon) editPicIcon.style.display = isOwner ? 'flex' : 'none';
    if (editBannerIcon) editBannerIcon.style.display = isOwner ? 'flex' : 'none';

    displayUserBadges(profileData); // Calls its own lookups now
    updateProfileTitlesAndRank(profileData, isOwner); // Calls its own lookups now

    if (isOwner) {
        setupProfilePicEditing(editPicIcon, profilePicInput); // Pass elements
        setupBannerEditing(editBannerIcon, bannerInput); // Pass elements
    }
}

function displayCompetitiveStats(statsData) {
    const displayEl = document.getElementById('stats-display');
    const wrapperEl = document.getElementById('competitive-stats-section-wrapper');

    if (!displayEl || !wrapperEl) {
        console.error("Competitive stats display elements missing.");
        if (wrapperEl) wrapperEl.style.display = 'none'; // Hide wrapper if display area is missing
        return;
    }
    wrapperEl.style.display = 'block'; // Show wrapper
    displayEl.innerHTML = ''; // Clear previous

    if (!statsData || typeof statsData !== 'object' || Object.keys(statsData).length === 0) {
        displayEl.innerHTML = '<p class="list-message">Competitive stats unavailable.</p>'; return;
    }
    const statsMap = { /* ... */ }; /* (unchanged map) */ let statsAdded = 0;
    // ... (loop and append stat items unchanged) ...
    for (const key in statsMap) { if (statsData.hasOwnProperty(key)) { /*...*/ displayEl.appendChild(createStatItem(statsMap[key], displayValue)); statsAdded++; } } if (statsAdded === 0) { displayEl.innerHTML = '<p class="list-message">No stats found.</p>'; }
}

// --- displayPoxelStats (FIXED with local lookup) ---
function displayPoxelStats(poxelData, message = null) {
    // Local Lookups
    const poxelStatsDisp = document.getElementById('poxel-stats-display');
    const poxelStatsWrap = document.getElementById('poxel-stats-section-wrapper');
    // No need to look up poxelStatsSection if only using wrapper and display area

    if (!poxelStatsDisp || !poxelStatsWrap) { // Check required elements
         console.error("Poxel stats display elements (wrapper or display) not found in DOM.");
         return;
    }

    poxelStatsDisp.innerHTML = ''; // Clear previous content
    poxelStatsWrap.style.display = 'block'; // Show wrapper

    if (message) { poxelStatsDisp.innerHTML = `<p class="list-message">${message}</p>`; return; }
    if (!poxelData || typeof poxelData !== 'object' || Object.keys(poxelData).length === 0) { poxelStatsDisp.innerHTML = '<p class="list-message">Poxel.io stats unavailable.</p>'; return; }

    const statsMap = { /* ... */ }; let statsAdded = 0;
    // ... (loop and display logic unchanged) ...
    for (const key in statsMap) { if (poxelData.hasOwnProperty(key) && poxelData[key] !== null) { /*...*/ poxelStatsDisp.appendChild(createStatItem(statsMap[key], value)); statsAdded++; } }
    if (poxelData.kills !== undefined && poxelData.deaths !== undefined) { /* Calculate/display K/D */ statsAdded++; }
    if (statsAdded === 0) { poxelStatsDisp.innerHTML = '<p class="list-message">No relevant stats found.</p>'; }
}

function createStatItem(title, value) {
    // ... (unchanged) ...
    const itemDiv = document.createElement('div'); itemDiv.classList.add('stat-item'); const titleH4 = document.createElement('h4'); titleH4.textContent = title; const valueP = document.createElement('p'); valueP.textContent = (value != null) ? value : '-'; itemDiv.appendChild(titleH4); itemDiv.appendChild(valueP); return itemDiv;
}

async function fetchUserUnlockedAchievements(userId) { /* ... (unchanged) ... */ }
function calculateAchievementProgress(achievement, userStats) { /* ... (unchanged) ... */ }

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
    achievementIds.forEach(id => { /* ... item generation unchanged using currentAchievements ... */ });
    if (listContainer.childElementCount === 0 && achievementIds.length > 0) { listContainer.innerHTML = '<p class="list-message">Display error.</p>'; }
}

async function checkAndGrantAchievements(userId, currentUserProfile, competitiveStats) {
    // ... (unchanged - relies on global allAchievements being populated correctly) ...
    if (!allAchievements || Object.keys(allAchievements).length === 0 || !userId || !currentUserProfile || !competitiveStats) { return null; } /* Rest of function */
}

// --- UI Display Helpers ---
function displayUserBadges(profileData) {
     const badgeContainer = document.getElementById('profile-badges-container');
     const adminTagEl = document.getElementById('admin-tag');
     if (!badgeContainer || !adminTagEl) { console.warn("Badge/Admin elements not found."); return; }
     // ... (rest of logic unchanged) ...
     badgeContainer.innerHTML = ''; adminTagEl.style.display = 'none'; const userEmail = profileData?.email; if (!userEmail) return; if (adminEmails.includes(userEmail)) { adminTagEl.style.display = 'inline-block'; } for (const badgeType in badgeConfig) { const config = badgeConfig[badgeType]; if (config.emails.includes(userEmail)) { const badgeSpan = document.createElement('span'); badgeSpan.classList.add('profile-badge', config.className); badgeSpan.setAttribute('title', config.title); badgeContainer.appendChild(badgeSpan); } }
}

function updateProfileTitlesAndRank(profileData, allowInteraction) {
    const rankDisp = document.getElementById('profile-rank');
    const titleDisp = document.getElementById('profile-title');
    if (!rankDisp || !titleDisp) { console.warn("Rank/Title display elements missing."); return; }
    // ... (rest of logic unchanged, using rankDisp and titleDisp) ...
    titleDisp.classList.remove('selectable-title', 'no-title-placeholder'); titleDisp.removeEventListener('click', handleTitleClick); closeTitleSelector(); if (profileData) { /* set rank/title content and classes */ } else { /* set loading state */ }
}
function handleTitleClick(event) { /* ... (unchanged - needs global isOwnProfile, viewingUserProfileData) ... */ }
function openTitleSelector() {
    // Need profileIdentifiersDiv here
    const profileIdentifiersDiv = document.querySelector('.profile-identifiers');
    if (!profileIdentifiersDiv) { console.error("Cannot open title selector: identifiers div missing."); return; }
    // ... (rest of logic unchanged - appending/showing titleSelectorElement) ...
     if (isTitleSelectorOpen || !isOwnProfile || !viewingUserProfileData.profile?.availableTitles?.length > 0) return; const titles = viewingUserProfileData.profile.availableTitles; const current = viewingUserProfileData.profile.equippedTitle||''; if (!titleSelectorElement || !profileIdentifiersDiv.contains(titleSelectorElement)) { titleSelectorElement = document.createElement('div'); titleSelectorElement.className = 'title-selector'; profileIdentifiersDiv.appendChild(titleSelectorElement); } titleSelectorElement.innerHTML = ''; if(current){/*add unequip*/} titles.forEach(t => {/*add option*/}); titleSelectorElement.style.display = 'block'; isTitleSelectorOpen = true; setTimeout(() => { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }, 0);
}
function closeTitleSelector() { /* ... (unchanged) ... */ }
function handleClickOutsideTitleSelector(event) { /* ... (unchanged) ... */ }
async function handleTitleOptionClick(event) {
     // Need titleDisplay element here for temp text
     const titleDisp = document.getElementById('profile-title');
     if(!titleDisp) { console.error("Title display missing in handleTitleOptionClick"); return; }
     // ... (rest of logic unchanged - updates Firestore, global state, calls updateProfileTitlesAndRank) ...
      event.stopPropagation(); const btn = event.currentTarget; const selTitle = btn.dataset.title; const curId = loggedInUser?.uid; if(!curId || !viewingUserProfileData.profile || viewingUserProfileData.profile.id!==curId){closeTitleSelector(); return;} const curEquip = viewingUserProfileData.profile.equippedTitle||''; if(selTitle === curEquip) {closeTitleSelector(); return;} closeTitleSelector(); titleDisp.classList.remove('selectable-title', 'no-title-placeholder'); titleDisp.removeEventListener('click', handleTitleClick); titleDisp.textContent="Updating..."; try {const ref = db.collection('users').doc(curId); await ref.update({equippedTitle:selTitle}); /* update state, cache, UI */} catch(e){/* handle error */}
}

// --- Image Editing Functions ---
// Pass elements they need if they weren't found globally
function setupProfilePicEditing(editIconElement, inputElement) {
    if (!isOwnProfile || !editIconElement || !inputElement) { if(editIconElement) editIconElement.style.display = 'none'; return; }
    editIconElement.style.display = 'flex'; editIconElement.onclick = null; inputElement.onchange = null;
    editIconElement.onclick = () => { croppingFor = 'pfp'; inputElement.click(); };
    inputElement.onchange = (event) => { handleFileSelect(event); };
}
function setupBannerEditing(editIconElement, inputElement) {
     if (!isOwnProfile || !editIconElement || !inputElement) { if(editIconElement) editIconElement.style.display = 'none'; return; }
     editIconElement.style.display = 'flex'; editIconElement.onclick = null; inputElement.onchange = null;
     editIconElement.onclick = () => { croppingFor = 'banner'; inputElement.click(); };
     inputElement.onchange = (event) => { handleFileSelect(event); };
     console.log("Banner editing listeners attached.");
}
function handleFileSelect(event) { /* ... (unchanged - calls openEditModal) ... */ }
function openEditModal() {
    // Local lookup for modal elements
    const modalEl = document.getElementById('edit-modal');
    const modalTitleEl = document.getElementById('modal-title');
    const modalImgEl = document.getElementById('image-to-crop');
    const closeBtn = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const applyBtn = document.getElementById('modal-apply-btn');
    const spinnerEl = document.getElementById('modal-spinner');

    if (!modalEl || !modalTitleEl || !modalImgEl || !closeBtn || !cancelBtn || !applyBtn || !spinnerEl || !modalImgEl.src) return;
    // ... (rest of function unchanged - uses local refs: modalEl, modalTitleEl etc.) ...
    modalTitleEl.textContent = (croppingFor === 'banner') ? 'Edit Banner' : 'Edit PFP'; modalEl.style.display='flex'; modalImgEl.style.opacity=0; applyBtn.disabled=false; spinnerEl.style.display='none'; const txt = Array.from(applyBtn.childNodes).find(n => n.nodeType === Node.TEXT_NODE); if (txt) txt.textContent = 'Apply '; if(cropper) try{cropper.destroy();}catch(e){} cropper=null; /* set options */ setTimeout(()=>{/* init cropper */}, 50); closeBtn.onclick=closeEditModal; cancelBtn.onclick=closeEditModal; applyBtn.onclick=handleApplyCrop; modalEl.onclick=(e)=>{if(e.target===modalEl)closeEditModal();};
}
function closeEditModal() {
    // Local lookup
    const modalEl = document.getElementById('edit-modal');
    const modalImgEl = document.getElementById('image-to-crop');
    const applyBtn = document.getElementById('modal-apply-btn');
    const spinnerEl = document.getElementById('modal-spinner');
    // ... (rest unchanged - uses local refs) ...
     if (!modalEl) return; if (cropper) { try { cropper.destroy(); } catch (e) {} cropper = null; } modalEl.style.display = 'none'; if(modalImgEl){modalImgEl.src = ''; modalImgEl.removeAttribute('src');} croppingFor = null; if(applyBtn) {applyBtn.disabled = false; if(spinnerEl) spinnerEl.style.display = 'none'; const txt = Array.from(applyBtn.childNodes).find(n => n.nodeType === Node.TEXT_NODE); if (txt) txt.textContent = 'Apply '; } /* remove listeners */
}
async function handleApplyCrop() {
    // Local lookup for button/spinner
    const applyBtn = document.getElementById('modal-apply-btn');
    const spinnerEl = document.getElementById('modal-spinner');
    // ... (rest unchanged - uses local refs, calls displayBanner) ...
    if(!cropper || !loggedInUser || !croppingFor || !applyBtn) {return;} if(applyBtn.disabled)return; applyBtn.disabled=true; if(spinnerEl)spinnerEl.style.display='inline-block'; /* update btn text */ try{ /* crop, blob, upload, save */ if(croppingFor==='pfp'){/*update pfp img*/}else if(croppingFor==='banner'){displayBanner(imageUrl);} /* update cache */ closeEditModal(); } catch(e){ /* handle error, reset button */ }
}
async function uploadToCloudinary(blob, type = 'image') { /* ... (unchanged) ... */ }
async function saveImageUrlToFirestore(userId, imageUrl, type) { /* ... (unchanged) ... */ }

// =============================================================================
// --- Friend System Functions ---
// =============================================================================
async function fetchUserMiniProfile(userId) { /* ... (unchanged) ... */ }
function determineFriendshipStatus(viewerUid, profileOwnerUid) { /* ... (unchanged) ... */ }
function clearFriendshipControls() {
     const container = document.getElementById('friendship-controls-container');
     if (container) container.innerHTML = '';
}
function resetFriendsSection() {
    const wrapper = document.getElementById('friends-section-wrapper');
    if (wrapper) wrapper.style.display = 'none';
    // Also reset internal state if needed (tabs, lists) - Find elements locally if required
}
function displayFriendshipControls(status, profileOwnerUid) {
     const container = document.getElementById('friendship-controls-container');
     if (!container || !loggedInUser || isOwnProfile) { clearFriendshipControls(); return; } // Clear if not applicable
     // ... (rest of function unchanged - creates/appends buttons to container) ...
     clearFriendshipControls(); container.style.minHeight = '40px'; /*...*/ if(btn1)container.appendChild(btn1); if(btn2)container.appendChild(btn2);
}
async function displayFriendsSection(profileData) {
    const wrapper = document.getElementById('friends-section-wrapper');
    const listUl = document.getElementById('friends-list'); // Get one required list el to check
    if (!isOwnProfile || !wrapper || !listUl || !profileData?.friends) { resetFriendsSection(); return; }
    console.log("Displaying friends section..."); wrapper.style.display = 'block';
    // ... (rest of function unchanged - categorizes, populates lists) ...
     const friendsMap=profileData.friends||{}; /* Cat IDs */ const inCount=document.getElementById('incoming-count'); const outCount=document.getElementById('outgoing-count'); /* Update counts */ try{/* Populate lists */}catch(e){} /* Add tab listener */
}
async function populateFriendList(ulElement, userIds, type, emptyMessage) { /* ... (unchanged - needs ulElement passed in) ... */ }
function createFriendListItem(miniProfile, type) { /* ... (unchanged - creates elements) ... */ }
function createFriendPfpElement(miniProfile) { /* ... (unchanged - creates elements) ... */ }
function createFriendActionButton(text, type, style, userId, listItem) { /* ... (unchanged - creates button) ... */ }
function createFriendListItemError(userId, message) { /* ... (unchanged - creates element) ... */ }
async function handleFriendAction(buttonElement, action, otherUserId, listItemToRemove = null) {
    // ... (unchanged - updates firestore, refreshes viewer data, calls display functions) ...
     if(!loggedInUser || !otherUserId || !buttonElement)return; const curUid=loggedInUser.uid; /* Disable buttons */ try { /* Perform batch update */ /* Refresh viewer data */ if(isOwnProfile){displayFriendsSection(viewerProfileData);} else if(viewingUserProfileData.profile?.id===otherUserId){/* Update controls */} } catch(e){ /* Handle error, re-enable buttons */}
}

// =============================================================================
// --- Authentication and Initialization ---
// =============================================================================
auth.onAuthStateChanged(async (user) => {
    // ... (reset logic largely unchanged, relies on display funcs getting own elements) ...
    console.log(`Auth state change. User: ${user?.uid}`); loggedInUser = user; const targetUid = profileUidFromUrl || loggedInUser?.uid; viewerProfileData = null; viewingUserProfileData = {}; miniProfileCache = {}; isOwnProfile = loggedInUser && targetUid === loggedInUser.uid;
    if (targetUid) { console.log(`Targeting profile: ${targetUid}`); if (loadingIndicator) loadingIndicator.style.display = 'flex'; if (notLoggedInMsg) notLoggedInMsg.style.display = 'none'; if (profileArea) profileArea.style.display = 'none';
        try { await loadCombinedUserData(targetUid); console.log("Initial load complete."); if (viewingUserProfileData.profile) { /* Setup editing, logout btn */ if (profileLogoutBtn) profileLogoutBtn.style.display = isOwnProfile ? 'inline-block' : 'none'; } else { if(profileLogoutBtn) profileLogoutBtn.style.display = 'none'; } }
        catch (err) { console.error("Critical load error:", err); /* Show error msg, hide profile */ }
    } else { /* Handle no user/no target UID */ console.log('No user/target.'); if (loadingIndicator) loadingIndicator.style.display = 'none'; if (profileArea) profileArea.style.display = 'none'; if (notLoggedInMsg) { notLoggedInMsg.style.display = 'flex'; notLoggedInMsg.innerHTML = 'Please <a href="index.html#login">log in</a> or provide user ID.'; } /* Reset UI state */ if(profileLogoutBtn) profileLogoutBtn.style.display='none'; updateProfileTitlesAndRank(null,false); displayBanner(null); }
});

// --- Logout Button Event Listener ---
profileLogoutBtn.addEventListener('click', () => {
    // ... (unchanged - calls reset/cleanup functions) ...
     const userId=loggedInUser?.uid; console.log(`Logout ${userId}`); /* Cleanup UI */ closeTitleSelector(); closeEditModal(); /* Remove listeners if needed */ auth.signOut().then(()=> { /* Clear state, redirect */ }).catch((e)=>{/* Error */});
});

// =============================================================================
// --- Local Storage Caching ---
// =============================================================================
function loadCombinedDataFromCache(viewedUserId) {
    // ... (unchanged) ...
    if (!viewedUserId) return false; const cacheKey = `poxelProfileCombinedData_${viewedUserId}`; try { const cachedDataString = localStorage.getItem(cacheKey); if (!cachedDataString) return false; const cachedData = JSON.parse(cachedDataString); if (cachedData?.profile?.id === viewedUserId) { /* ensure fields */ viewingUserProfileData = cachedData; console.log("Loaded cache for:", viewedUserId); const viewingOwnCachedProfile = loggedInUser && loggedInUser.uid === viewedUserId; displayProfileData(viewingUserProfileData.profile, viewingOwnCachedProfile); displayBanner(viewingUserProfileData.profile.bannerUrl); displayCompetitiveStats(viewingUserProfileData.stats); return true; } else { localStorage.removeItem(cacheKey); return false; } } catch (error) { console.error("Error loading cache:", error); try { localStorage.removeItem(cacheKey); } catch(e) {} return false; }
}

function saveCombinedDataToCache(viewedUserId, combinedData) {
    // ... (unchanged) ...
     if (!viewedUserId || !combinedData?.profile?.id || viewedUserId !== combinedData.profile.id) { return; } const cacheKey = `poxelProfileCombinedData_${viewedUserId}`; try { const dataToSave = { profile: { ...combinedData.profile, /* Ensure fields */ bannerUrl: combinedData.profile.bannerUrl || null }, stats: combinedData.stats || null }; localStorage.setItem(cacheKey, JSON.stringify(dataToSave)); } catch(error) { console.error(`Error saving cache:`, error); if (error.name === 'QuotaExceededError' || error.message?.toLowerCase().includes('quota')) { console.warn('Quota exceeded.'); } }
}

// --- Initial Log ---
console.log("Profile script initialized. Waiting for Auth state...");
