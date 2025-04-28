// --- Firebase Configuration ---
// IMPORTANT: Replace with your actual Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI", // Replace with your real key
    authDomain: "poxelcomp.firebaseapp.com",
    projectId: "poxelcomp",
    storageBucket: "poxelcomp.appspot.com", // *** Ensure this is correct ***
    messagingSenderId: "620490990104",
    appId: "1:620490990104:web:709023eb464c7d886b996d",
};

// --- Initialize Firebase (Compat Version) ---
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// --- URL Parameter Parsing & Logged-in User Check ---
const urlParams = new URLSearchParams(window.location.search);
const profileUidFromUrl = urlParams.get('uid');
let loggedInUser = null;

// --- Admin Emails ---
const adminEmails = [
    'trixdesignsofficial@gmail.com', // Replace/add your admin emails
    'jackdmbell@outlook.com',
    'myrrr@myrrr.myrrr'
].map(email => email.toLowerCase());

// --- Badge Configuration ---
const badgeConfig = {
    verified: { emails: ['jackdmbell@outlook.com', 'myrrr@myrrr.myrrr'].map(e => e.toLowerCase()), className: 'badge-verified', title: 'Verified' },
    creator: { emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()), className: 'badge-creator', title: 'Content Creator' },
    moderator: { emails: ['jackdmbell@outlook.com', 'mod_team@sample.org'].map(e => e.toLowerCase()), className: 'badge-moderator', title: 'Moderator' }
};

// --- DOM Elements ---
const profileContainer = document.getElementById('profile-content');
const profileContent = document.getElementById('profile-content');
const loadingIndicator = document.getElementById('loading-profile');
const notLoggedInMsg = document.getElementById('not-logged-in');
const profilePicDiv = document.getElementById('profile-pic');
const usernameDisplay = document.getElementById('profile-username');
const emailDisplay = document.getElementById('profile-email');
const statsDisplay = document.getElementById('stats-display');
const profileLogoutBtn = document.getElementById('profile-logout-btn');
const adminTag = document.getElementById('admin-tag');
const rankDisplay = document.getElementById('profile-rank');
const titleDisplay = document.getElementById('profile-title');
const profileIdentifiersDiv = document.querySelector('.profile-identifiers');
const profileBadgesContainer = document.getElementById('profile-badges-container');
const banOverlay = document.getElementById('ban-overlay');
const banReasonDisplay = document.getElementById('ban-reason-display');

// --- Global/Scoped Variables ---
let allAchievements = null;
let viewingUserProfileData = {};
let isTitleSelectorOpen = false;
let titleSelectorElement = null;
let currentProfileLoadAbortController = null;

// =============================================================
// START ***CORRECTED*** escapeHtml FUNCTION
// =============================================================
// --- Helper Function: Escape HTML (Sequential Replacements) ---
function escapeHtml(unsafe) {
   // Ensure input is a string
   if (typeof unsafe !== 'string') {
        if (unsafe === null || unsafe === undefined) return ''; // Handle null/undefined
        try {
             unsafe = String(unsafe); // Convert other types (like numbers) to string
        } catch (e) {
             return ''; // Return empty if conversion fails
        }
   }

   // Perform replacements sequentially on the result of the previous one
   return unsafe
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, """)
        .replace(/'/g, "'"); // Also handles single quotes
}
// ===========================================================
// END ***CORRECTED*** escapeHtml FUNCTION
// ===========================================================


// --- Function to fetch all achievement definitions ---
async function fetchAllAchievements() {
    if (allAchievements) return allAchievements;
    try {
        const snapshot = await db.collection('achievements').get();
        allAchievements = {};
        snapshot.forEach(doc => { allAchievements[doc.id] = { id: doc.id, ...doc.data() }; });
        console.log("Fetched achievement definitions:", allAchievements);
        return allAchievements;
    } catch (error) {
        console.error("Error fetching achievement definitions:", error);
        return null;
    }
}

// --- Helper: Display Badges based on the viewed profile's data ---
function displayUserBadges(profileData) {
    if (!profileBadgesContainer) return;
    profileBadgesContainer.innerHTML = ''; // Clear existing badges
    const userEmail = profileData?.email;
    if (!userEmail) return;
    const emailLower = userEmail.toLowerCase();
    if (adminTag) {
        adminTag.style.display = adminEmails.includes(emailLower) ? 'inline-block' : 'none';
    }
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

// --- Auth State Listener ---
auth.onAuthStateChanged(async (user) => {
    loggedInUser = user;
    const targetUid = profileUidFromUrl || loggedInUser?.uid;
    console.log(`Auth state changed. Logged in: ${!!user}, Target UID: ${targetUid}`);
    if (currentProfileLoadAbortController) {
        console.log("Aborting previous profile load request.");
        currentProfileLoadAbortController.abort();
    }
    if (targetUid) {
        loadingIndicator.style.display = 'block';
        notLoggedInMsg.style.display = 'none';
        profileContent.style.display = 'none';
        currentProfileLoadAbortController = new AbortController();
        const signal = currentProfileLoadAbortController.signal;
        try {
            if (!allAchievements) await fetchAllAchievements();
            await loadCombinedUserData(targetUid, signal); // Using sequential debug version
            loadingIndicator.style.display = 'none';
            profileContent.style.display = 'block';
            if (profileLogoutBtn) {
                profileLogoutBtn.style.display = (loggedInUser && loggedInUser.uid === targetUid) ? 'inline-block' : 'none';
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log("Profile load aborted.");
            } else {
                console.error("Error during profile loading sequence:", error);
                loadingIndicator.style.display = 'none'; profileContent.style.display = 'none';
                notLoggedInMsg.innerHTML = '<p>Error loading profile data. Please try again later.</p>';
                notLoggedInMsg.style.display = 'flex'; resetProfileUI();
            }
        } finally {
            currentProfileLoadAbortController = null;
        }
    } else {
        console.log('No user logged in and no profile UID in URL.');
        loadingIndicator.style.display = 'none'; profileContent.style.display = 'none';
        notLoggedInMsg.innerHTML = '<p>You need to be logged in to view your profile, or specify a user UID in the URL.</p>';
        notLoggedInMsg.style.display = 'flex'; resetProfileUI();
    }
});

// --- Helper Function: Reset Profile UI elements ---
function resetProfileUI() {
    console.log("Resetting profile UI elements.");
    if (profileContainer) profileContainer.classList.remove('is-banned');
    if (banOverlay) banOverlay.style.display = 'none';
    if (banReasonDisplay) banReasonDisplay.style.display = 'none';
    if (usernameDisplay) usernameDisplay.textContent = '...'; if (emailDisplay) emailDisplay.textContent = '...';
    if (profilePicDiv) profilePicDiv.textContent = '?'; if (adminTag) adminTag.style.display = 'none';
    if (profileBadgesContainer) profileBadgesContainer.innerHTML = ''; if (profileLogoutBtn) profileLogoutBtn.style.display = 'none';
    if (statsDisplay) statsDisplay.innerHTML = ''; updateProfileTitlesAndRank(null, false);
    closeTitleSelector(); viewingUserProfileData = {};
}

// --- Helper Function: Client-Side User Profile Document Creation ---
async function createUserProfileDocument(userId, authUser) {
    if (!userId || !authUser || authUser.uid !== userId) { console.error("createUserProfileDocument args invalid."); return null; }
    console.warn(`Attempting client-side creation/merge for UID: ${userId}`);
    const userDocRef = db.collection("users").doc(userId);
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;
    const email = authUser.email || null;
    const defaultProfileData = { email, displayName, currentRank: "Unranked", equippedTitle: "", availableTitles: [], friends: [], createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    try {
        await userDocRef.set(defaultProfileData, { merge: true });
        console.log(`Successfully created/merged doc for UID: ${userId}`);
        const freshSnap = await userDocRef.get();
        return freshSnap.exists ? { id: freshSnap.id, ...freshSnap.data() } : null;
    } catch (error) { console.error(`Error creating/merging profile doc for UID ${userId}:`, error); alert("Error setting up profile details."); return null; }
}

// --- Load Combined Data from Local Storage Cache ---
function loadCombinedDataFromCache(viewedUserId) {
     const cacheKey = `poxelProfileCombinedData_${viewedUserId}`; const cachedDataString = localStorage.getItem(cacheKey);
     if (cachedDataString) {
         try { const cachedFullData = JSON.parse(cachedDataString); if (cachedFullData && typeof cachedFullData === 'object') { viewingUserProfileData = cachedFullData; console.log("Loaded data from cache for VIEWED UID:", viewedUserId, viewingUserProfileData); displayProfileData( viewingUserProfileData.profile, viewingUserProfileData.stats, viewingUserProfileData.isBanned || false, viewingUserProfileData.banReason || null ); return true; } else { console.warn("Invalid cache structure:", viewedUserId); localStorage.removeItem(cacheKey); viewingUserProfileData = {}; return false; }
         } catch (error) { console.error("Error parsing cache:", error); localStorage.removeItem(cacheKey); viewingUserProfileData = {}; return false; }
     } else { viewingUserProfileData = {}; return false; }
}

// --- Save Combined Data to Local Storage Cache ---
function saveCombinedDataToCache(viewedUserId, combinedData) {
     if (!viewedUserId || !combinedData) return; if (typeof combinedData.isBanned === 'undefined') { console.warn("Saving cache without ban status:", viewedUserId); }
     const cacheKey = `poxelProfileCombinedData_${viewedUserId}`; try { localStorage.setItem(cacheKey, JSON.stringify(combinedData)); } catch(error) { console.error("Error saving cache:", error); }
}

// --- Load Combined User Data (Using Sequential Fetch Debugging) ---
async function loadCombinedUserData(targetUserId, signal) {
    console.log(`Loading combined user data for TARGET UID: ${targetUserId}`);
    if (profileContainer) profileContainer.classList.remove('is-banned');
    if (banOverlay) banOverlay.style.display = 'none'; if (banReasonDisplay) banReasonDisplay.style.display = 'none';
    const cacheLoaded = loadCombinedDataFromCache(targetUserId);
    if (!cacheLoaded) { if (statsDisplay) statsDisplay.innerHTML = '<p>Loading stats...</p>'; updateProfileTitlesAndRank(null, false); }
    const userProfileRef = db.collection('users').doc(targetUserId), leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId), banDocRef = db.collection('banned_users').doc(targetUserId);
    let profileSnap, statsSnap, banSnap, profileData = null, statsData = null, isBanned = false, banReason = null;
    try {
        console.log(`[DEBUG] STEP 1: Attempting userProfileRef.get() for ${targetUserId}`);
        profileSnap = await userProfileRef.get(); if (signal?.aborted) { throw new Error('AbortError'); } console.log(`[DEBUG] STEP 1: userProfileRef.get() ${profileSnap.exists ? 'succeeded (found)' : 'succeeded (NOT found)'}`);
        if (profileSnap.exists) { profileData = { id: profileSnap.id, ...profileSnap.data() }; } else { console.warn(`User profile doc NOT exist: ${targetUserId}`); if (loggedInUser && loggedInUser.uid === targetUserId) { console.log(`Attempting profile creation for self: ${targetUserId}`); profileData = await createUserProfileDocument(targetUserId, loggedInUser); if (!profileData) throw new Error(`Profile creation failed: ${targetUserId}.`); } }
        console.log(`[DEBUG] STEP 2: Attempting leaderboardStatsRef.get() for ${targetUserId}`);
        statsSnap = await leaderboardStatsRef.get(); if (signal?.aborted) { throw new Error('AbortError'); } console.log(`[DEBUG] STEP 2: leaderboardStatsRef.get() ${statsSnap.exists ? 'succeeded (found)' : 'succeeded (NOT found)'}`); statsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null;
        console.log(`[DEBUG] STEP 3: Attempting banDocRef.get() for ${targetUserId}`);
        banSnap = await banDocRef.get(); if (signal?.aborted) { throw new Error('AbortError'); } console.log(`[DEBUG] STEP 3: banDocRef.get() ${banSnap.exists ? 'succeeded (found - banned)' : 'succeeded (NOT found - not banned)'}`); isBanned = banSnap.exists; banReason = isBanned ? (banSnap.data()?.reason || "N/A") : null;
        viewingUserProfileData = { profile: profileData, stats: statsData, isBanned: isBanned, banReason: banReason }; console.log("Final State - Profile:", profileData); console.log("Final State - Stats:", statsData); console.log(`Final State - Banned: ${isBanned}`);
        displayProfileData( profileData, statsData, isBanned, banReason ); saveCombinedDataToCache(targetUserId, viewingUserProfileData);
        if (profileData && !isBanned && loggedInUser && loggedInUser.uid === targetUserId && statsData) { if (!allAchievements) await fetchAllAchievements(); if (allAchievements) { const pu = await checkAndGrantAchievements(targetUserId, profileData, statsData); if (pu) { console.log("Achievements updated, refreshing."); viewingUserProfileData.profile = pu; displayProfileData( pu, statsData, isBanned, banReason ); saveCombinedDataToCache(targetUserId, viewingUserProfileData); } } }
    } catch (error) { if (error.message === 'AbortError') { throw error; } console.error(`!!! Read error in sequential fetch:`, error.message); console.error("Check logs for failed STEP."); console.error("Full error:", error); if (error.stack) console.error("Stack:", error.stack); if (!cacheLoaded) { if (statsDisplay) statsDisplay.innerHTML = '<p>Error loading.</p>'; updateProfileTitlesAndRank(null, false); loadingIndicator.style.display = 'none'; profileContent.style.display = 'none'; notLoggedInMsg.innerHTML = '<p>Error loading data.</p>'; notLoggedInMsg.style.display = 'flex'; resetProfileUI(); } else { console.warn("Error fetching fresh, using cache."); } }
}

// --- Central Function to Display Profile Data ---
function displayProfileData(profileData, statsData, isBanned = false, banReason = null) {
    if (profileContainer) profileContainer.classList.remove('is-banned'); if (banOverlay) banOverlay.style.display = 'none'; if (banReasonDisplay) banReasonDisplay.style.display = 'none';
    if (!profileData) { console.log("Displaying 'User Not Found'."); if (usernameDisplay) usernameDisplay.textContent="User Not Found"; if (emailDisplay) emailDisplay.textContent=""; if (profilePicDiv) profilePicDiv.textContent="?"; if (adminTag) adminTag.style.display='none'; if (profileBadgesContainer) profileBadgesContainer.innerHTML=''; updateProfileTitlesAndRank(null,false); displayStats(null); if (profileLogoutBtn) profileLogoutBtn.style.display='none'; closeTitleSelector(); return; }
    const displayName = profileData.displayName || 'User', email = profileData.email || 'N/A'; if (usernameDisplay) usernameDisplay.textContent = displayName; if (emailDisplay) emailDisplay.textContent = email; if (profilePicDiv) profilePicDiv.textContent = displayName.charAt(0).toUpperCase() || '?'; displayUserBadges(profileData); displayStats(statsData); const isOwnProfile = loggedInUser && loggedInUser.uid === profileData.id;
    if (isBanned) { console.log("Applying banned styles:", profileData.id); if (profileContainer) profileContainer.classList.add('is-banned'); if (banOverlay) banOverlay.style.display='block'; if (banReasonDisplay && banReason) { banReasonDisplay.textContent=`Reason: ${escapeHtml(banReason)}`; banReasonDisplay.style.display='block'; } updateProfileTitlesAndRank(null, false); closeTitleSelector(); } else { updateProfileTitlesAndRank(profileData, isOwnProfile); } if (profileLogoutBtn) { profileLogoutBtn.style.display = isOwnProfile ? 'inline-block' : 'none'; }
}

// --- Check and Grant Achievements ---
async function checkAndGrantAchievements(userId, currentUserProfile, currentUserStats) {
    if (!allAchievements || !userId || !currentUserProfile || !currentUserStats) { console.warn("Skip achievement check."); return null; } console.log(`Checking achievements for UID ${userId}`);
    try { const uaRef = db.collection('userAchievements').doc(userId); const uaDoc = await uaRef.get(); const unlockedIds = uaDoc.exists ? (uaDoc.data()?.unlocked || []) : []; let newUnlocks = [], rewards = { titles: [], rank: null, points: 0 }, update = false;
        for (const id in allAchievements) { if (unlockedIds.includes(id)) continue; const a = allAchievements[id]; let met = false; if (a.criteria?.stat && currentUserStats[a.criteria.stat] !== undefined) { const sv = currentUserStats[a.criteria.stat], rv = a.criteria.value; switch (a.criteria.operator) { case '>=': met=sv>=rv; break; case '<=': met=sv<=rv; break; case '==': met=sv==rv; break; case '>': met=sv>rv; break; case '<': met=sv<rv; break; default: console.warn(`Unknown op: ${a.criteria.operator}`); } } else if(a.criteria) { console.warn(`Invalid criteria/stat for ${id}`);} if (met) { console.log(`Met: ${a.name||id}`); newUnlocks.push(id); update=true; if(a.rewards?.title) rewards.titles.push(a.rewards.title); if(a.rewards?.rank) rewards.rank = a.rewards.rank; if(a.rewards?.rankPoints) rewards.points += a.rewards.rankPoints; } }
        if (update && newUnlocks.length > 0) { console.log(`Unlocking:`, newUnlocks); const batch=db.batch(), pRef=db.collection('users').doc(userId); batch.set(uaRef,{unlocked:firebase.firestore.FieldValue.arrayUnion(...newUnlocks)},{merge:true}); const pUpd={}; let lProf={...currentUserProfile}; if(rewards.titles.length>0){ pUpd.availableTitles=firebase.firestore.FieldValue.arrayUnion(...rewards.titles); lProf.availableTitles=[...new Set([...(lProf.availableTitles||[]), ...rewards.titles])]; if(!lProf.equippedTitle){ const t=rewards.titles[0]; pUpd.equippedTitle=t; lProf.equippedTitle=t; console.log(`Equip: ${t}`); } } if(rewards.rank){pUpd.currentRank=rewards.rank; lProf.currentRank=rewards.rank;} if(rewards.points>0){console.warn("Rank points TBD");} if(!lProf.currentRank){pUpd.currentRank='Unranked'; lProf.currentRank='Unranked';} if(!lProf.equippedTitle&&!pUpd.equippedTitle){pUpd.equippedTitle=''; lProf.equippedTitle='';} let pComm=false; if(Object.keys(pUpd).length>0){batch.update(pRef,pUpd);pComm=true;} await batch.commit(); console.log(`Batch commit ${userId}. Profile upd: ${pComm}`); return pComm?lProf:null; } else { return null; }
    } catch (error) { console.error(`Achieve error ${userId}:`, error); return null; }
}

// --- Display Stats Grid ---
function displayStats(statsData) {
    if (!statsDisplay) return; statsDisplay.innerHTML = ''; if (!statsData || typeof statsData!=='object' || Object.keys(statsData).length === 0) { statsDisplay.innerHTML = '<p>No stats available.</p>'; return; } const sTs=[{k:'wins',l:'Wins'}, {k:'points',l:'Points'}, {k:'kdRatio',l:'K/D Ratio',f:(v)=>typeof v==='number'?v.toFixed(2):v}, {k:'matchesPlayed',l:'Matches Played',fBk:'matches'}, {k:'losses',l:'Losses'}]; let iA=0; sTs.forEach(s=>{const k=s.k,fBk=s.fBk;let v=(statsData[k]!==undefined&&statsData[k]!==null)?statsData[k] : (fBk&&statsData[fBk]!==undefined&&statsData[fBk]!==null)?statsData[fBk] : '-';const fv=s.f?s.f(v):v; statsDisplay.appendChild(createStatItem(s.l,fv)); iA++;}); if (iA===0) { statsDisplay.innerHTML='<p>No stats found.</p>';}
}

// --- Helper: Create a Single Stat Item Element ---
function createStatItem(title, value) { const d=document.createElement('div');d.classList.add('stat-item');const h=document.createElement('h4');h.textContent=title;const p=document.createElement('p'); p.textContent=(value !== null && value !== undefined) ? escapeHtml(value) : '-'; d.appendChild(h);d.appendChild(p); return d;}

// --- Helper: Update Profile Rank/Title Display ---
function updateProfileTitlesAndRank(pData, allowInteract) { if(!rankDisplay||!titleDisplay) return; titleDisplay.classList.remove('selectable-title');titleDisplay.removeEventListener('click',handleTitleClick); if(pData&&typeof pData==='object'){const r=pData.currentRank||'Unranked',t=pData.equippedTitle||'',aT=pData.availableTitles||[];rankDisplay.textContent=r;rankDisplay.className=`profile-rank-display rank-${r.toLowerCase().replace(/\s+/g,'-')}`; if(t){titleDisplay.textContent=escapeHtml(t);titleDisplay.style.display='inline-block';if(allowInteract&&aT.length>0){titleDisplay.classList.add('selectable-title');titleDisplay.addEventListener('click',handleTitleClick);}}else{titleDisplay.textContent='';titleDisplay.style.display='none';}}else{rankDisplay.textContent='---';rankDisplay.className='profile-rank-display rank-unranked';titleDisplay.textContent='';titleDisplay.style.display='none';closeTitleSelector();}}

// --- Handle Clicks on the Equipped Title ---
function handleTitleClick(event) { event.stopPropagation(); if(!loggedInUser || loggedInUser.uid!==viewingUserProfileData.profile?.id || viewingUserProfileData.isBanned){console.log("Title interact blocked."); return;} if(isTitleSelectorOpen){closeTitleSelector();} else if(viewingUserProfileData.profile?.availableTitles?.length > 0){openTitleSelector();}else{console.log("No titles available.");}}

// --- Open Title Selector Dropdown ---
function openTitleSelector() { if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id || viewingUserProfileData.isBanned) return; if (isTitleSelectorOpen || !profileIdentifiersDiv || !viewingUserProfileData.profile?.availableTitles?.length > 0) return; const aT = viewingUserProfileData.profile.availableTitles, cET = viewingUserProfileData.profile.equippedTitle || ''; if (!titleSelectorElement) { titleSelectorElement = document.createElement('div'); titleSelectorElement.className = 'title-selector'; profileIdentifiersDiv.appendChild(titleSelectorElement); } titleSelectorElement.innerHTML=''; if (cET){const rO=document.createElement('button'); rO.className='title-option r'; rO.dataset.title=""; rO.type='button'; rO.textContent='(Remove)'; rO.setAttribute('aria-pressed','false'); rO.addEventListener('click',handleTitleOptionClick); titleSelectorElement.appendChild(rO);} aT.forEach(tO => { const oE=document.createElement('button'); oE.className='title-option'; oE.dataset.title = tO; oE.type = 'button'; oE.textContent = escapeHtml(tO); if (tO===cET){ oE.classList.add('currently-equipped'); oE.setAttribute('aria-pressed','true'); } else { oE.setAttribute('aria-pressed','false'); } oE.addEventListener('click', handleTitleOptionClick); titleSelectorElement.appendChild(oE); }); titleSelectorElement.style.display = 'block'; isTitleSelectorOpen = true; setTimeout(() => { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }, 0); }

// --- Close Title Selector Dropdown ---
function closeTitleSelector() { if (!isTitleSelectorOpen||!titleSelectorElement)return; titleSelectorElement.style.display='none';isTitleSelectorOpen=false; document.removeEventListener('click',handleClickOutsideTitleSelector,{capture:true});}

// --- Handle Clicks Outside the Selector ---
function handleClickOutsideTitleSelector(event) { if (!isTitleSelectorOpen) return; const inSel=titleSelectorElement&&titleSelectorElement.contains(event.target); const onTit=titleDisplay&&titleDisplay.contains(event.target); if (!inSel && !onTit) { closeTitleSelector(); } else { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }}

// --- Handle Clicks on a Title Option ---
async function handleTitleOptionClick(event) { event.stopPropagation();const sT=event.currentTarget.dataset.title; const cUId=loggedInUser?.uid; const cVP=viewingUserProfileData.profile; if(!cUId||!cVP||cUId!==cVP.id||viewingUserProfileData.isBanned){console.error("Invalid title change attempt."); closeTitleSelector(); return;} const cEq=cVP.equippedTitle||''; if (sT===cEq){closeTitleSelector();return;} closeTitleSelector(); if(titleDisplay){titleDisplay.textContent="Updating...";titleDisplay.classList.remove('selectable-title');titleDisplay.removeEventListener('click',handleTitleClick);} try {const uRef=db.collection('users').doc(cUId); await uRef.update({equippedTitle:sT}); console.log(`Title updated to "${sT}" for ${cUId}`); viewingUserProfileData.profile.equippedTitle=sT; saveCombinedDataToCache(cUId,viewingUserProfileData); updateProfileTitlesAndRank(viewingUserProfileData.profile,true); } catch(error){ console.error("Error updating title:", error); alert("Failed title update."); if(viewingUserProfileData.profile){viewingUserProfileData.profile.equippedTitle=cEq;} updateProfileTitlesAndRank(viewingUserProfileData.profile,true); }}

// --- Logout Button Event Listener ---
if(profileLogoutBtn) { profileLogoutBtn.addEventListener('click',()=>{ const userId=loggedInUser?.uid; if(titleDisplay) titleDisplay.removeEventListener('click',handleTitleClick); closeTitleSelector(); auth.signOut().then(()=>{ console.log('Signed out.'); if(userId){ localStorage.removeItem(`poxelProfileCombinedData_${userId}`); console.log(`Cache cleared: ${userId}`); } viewingUserProfileData={}; }).catch((error)=>{ console.error('Sign out error:', error); alert('Sign out error.'); }); }); } else { console.warn("Logout button not found."); }

// --- Initial log ---
console.log("Profile script initialized.");
