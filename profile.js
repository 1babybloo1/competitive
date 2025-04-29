// --- Firebase Configuration ---
// IMPORTANT: Replace with your actual Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI",
  authDomain: "poxelcomp.firebaseapp.com",
  projectId: "poxelcomp",
  storageBucket: "poxelcomp.firebasestorage.app",
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
const profileContainer = document.getElementById('profile-content'); // REMOVED: No need for ban overlay class toggle
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
// REMOVED: Ban-related DOM elements
// const banOverlay = document.getElementById('ban-overlay');
// const banReasonDisplay = document.getElementById('ban-reason-display');

// --- Global/Scoped Variables ---
let allAchievements = null;
let viewingUserProfileData = {}; // Structure will no longer contain ban info
let isTitleSelectorOpen = false;
let titleSelectorElement = null;
let currentProfileLoadAbortController = null;

// =============================================================
// START ***CORRECTED*** escapeHtml FUNCTION (Sequential Assign)
// =============================================================
function escapeHtml(unsafe) {
   // Ensure input is a string
   if (typeof unsafe !== 'string') {
        if (unsafe === null || unsafe === undefined) return ''; // Handle null/undefined
        try {
             unsafe = String(unsafe); // Convert other types (like numbers) to string
        } catch (e) {
             console.error("Could not convert value to string for escaping:", unsafe, e);
             return ''; // Return empty if conversion fails
        }
   }
   // Perform replacements sequentially using a temporary variable
   let safe = unsafe;
   safe = safe.replace(/&/g, "&");
   safe = safe.replace(/</g, "<");
   safe = safe.replace(/>/g, ">");
   safe = safe.replace(/"/g, "&quot;");
   safe = safe.replace(/'/g, "'"); // Also handles single quotes
   return safe;
}
// ===========================================================
// END ***CORRECTED*** escapeHtml FUNCTION
// ===========================================================

// --- Function to fetch all achievement definitions ---
async function fetchAllAchievements() {
    if (allAchievements) return allAchievements; try { const snapshot = await db.collection('achievements').get(); allAchievements = {}; snapshot.forEach(doc => { allAchievements[doc.id] = { id: doc.id, ...doc.data() }; }); console.log("Fetched achievement definitions:", allAchievements); return allAchievements; } catch (error) { console.error("Error fetching achievement definitions:", error); return null; }
}

// --- Helper: Display Badges based on the viewed profile's data ---
function displayUserBadges(profileData) { if (!profileBadgesContainer) return; profileBadgesContainer.innerHTML = ''; const userEmail = profileData?.email; if (!userEmail) return; const emailLower = userEmail.toLowerCase(); if (adminTag) { adminTag.style.display = adminEmails.includes(emailLower) ? 'inline-block' : 'none'; } for (const badgeType in badgeConfig) { const config = badgeConfig[badgeType]; if (config.emails.includes(emailLower)) { const badgeSpan = document.createElement('span'); badgeSpan.classList.add('profile-badge', config.className); badgeSpan.setAttribute('title', config.title); profileBadgesContainer.appendChild(badgeSpan); } } }

// --- Auth State Listener ---
auth.onAuthStateChanged(async (user) => { loggedInUser = user; const targetUid = profileUidFromUrl || loggedInUser?.uid; console.log(`Auth state changed. Logged in: ${!!user}, Target UID: ${targetUid}`); if (currentProfileLoadAbortController) { console.log("Aborting previous profile load request."); currentProfileLoadAbortController.abort(); } if (targetUid) { loadingIndicator.style.display = 'block'; notLoggedInMsg.style.display = 'none'; profileContent.style.display = 'none'; currentProfileLoadAbortController = new AbortController(); const signal = currentProfileLoadAbortController.signal; try { if (!allAchievements) await fetchAllAchievements(); await loadCombinedUserData(targetUid, signal); loadingIndicator.style.display = 'none'; profileContent.style.display = 'block'; if (profileLogoutBtn) { profileLogoutBtn.style.display = (loggedInUser && loggedInUser.uid === targetUid) ? 'inline-block' : 'none'; } } catch (error) { if (error.name === 'AbortError') { console.log("Profile load aborted."); } else { console.error("Error during profile loading sequence:", error); loadingIndicator.style.display = 'none'; profileContent.style.display = 'none'; notLoggedInMsg.innerHTML = '<p>Error loading profile data.</p>'; notLoggedInMsg.style.display = 'flex'; resetProfileUI(); } } finally { currentProfileLoadAbortController = null; } } else { console.log('No user logged in or profile UID.'); loadingIndicator.style.display = 'none'; profileContent.style.display = 'none'; notLoggedInMsg.innerHTML = '<p>Login or specify UID.</p>'; notLoggedInMsg.style.display = 'flex'; resetProfileUI(); } });

// --- Helper Function: Reset Profile UI elements ---
function resetProfileUI() {
    console.log("Resetting profile UI.");
    // REMOVED: Ban-related UI resets
    // if (profileContainer) profileContainer.classList.remove('is-banned');
    // if (banOverlay) banOverlay.style.display='none';
    // if (banReasonDisplay) banReasonDisplay.style.display='none';
    if (usernameDisplay) usernameDisplay.textContent='...';
    if (emailDisplay) emailDisplay.textContent='...';
    if (profilePicDiv) profilePicDiv.textContent='?';
    if (adminTag) adminTag.style.display='none';
    if (profileBadgesContainer) profileBadgesContainer.innerHTML='';
    if (profileLogoutBtn) profileLogoutBtn.style.display='none';
    if (statsDisplay) statsDisplay.innerHTML='';
    updateProfileTitlesAndRank(null,false);
    closeTitleSelector();
    viewingUserProfileData={};
}

// --- Helper Function: Client-Side User Profile Document Creation ---
async function createUserProfileDocument(userId, authUser) { if (!userId || !authUser || authUser.uid !== userId) { console.error("createUserProfileDocument args invalid."); return null; } console.warn(`Attempting client-side creation/merge for UID: ${userId}`); const userDocRef = db.collection("users").doc(userId); const displayName = authUser.displayName || `User_${userId.substring(0,5)}`; const email = authUser.email||null; const defaultProfileData = {email,displayName,currentRank:"Unranked",equippedTitle:"",availableTitles:[],friends:[],createdAt:firebase.firestore.FieldValue.serverTimestamp()}; try { await userDocRef.set(defaultProfileData,{merge:true}); console.log(`Created/merged doc for UID: ${userId}`); const freshSnap=await userDocRef.get(); return freshSnap.exists?{id:freshSnap.id,...freshSnap.data()}:null;} catch(error){console.error(`Error creating/merging profile doc:`, error); alert("Error setting up profile."); return null;}}

// --- Load Combined Data from Local Storage Cache ---
function loadCombinedDataFromCache(viewedUserId) {
    const key=`poxelProfileCombinedData_${viewedUserId}`;
    const str=localStorage.getItem(key);
    if(str){
        try {
            const data=JSON.parse(str);
            // Check for core profile/stats data, ignore potential old ban fields
            if(data && typeof data === 'object' && (data.profile || data.stats)) {
                 // Reconstruct viewingUserProfileData without ban info
                 viewingUserProfileData = {
                     profile: data.profile || null,
                     stats: data.stats || null
                 };
                 console.log("Loaded data from cache:", viewedUserId, viewingUserProfileData); // Log the cleaned data
                 // Call displayProfileData without ban info
                 displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats);
                 return true;
             } else {
                 console.warn("Invalid cache structure:", viewedUserId);
                 localStorage.removeItem(key);
                 viewingUserProfileData = {};
                 return false;
             }
        } catch(e) {
             console.error("Err parsing cache:",e);
             localStorage.removeItem(key);
             viewingUserProfileData = {};
             return false;
        }
    } else {
        viewingUserProfileData = {};
        return false;
    }
}

// --- Save Combined Data to Local Storage Cache ---
function saveCombinedDataToCache(uid, data) {
    if (!uid || !data) return;
    // Construct data to save explicitly excluding ban info
    const dataToSave = {
        profile: data.profile || null,
        stats: data.stats || null
    };
    const key = `poxelProfileCombinedData_${uid}`;
    try {
        localStorage.setItem(key, JSON.stringify(dataToSave));
    } catch(e) {
        console.error("Err saving cache:", e);
    }
}

// --- Load Combined User Data (Sequential Fetch Debugging) ---
async function loadCombinedUserData(targetUserId, signal) {
    console.log(`LoadCombined: TARGET ${targetUserId}`);
    // REMOVED: Resetting ban UI elements
    // if (profileContainer) profileContainer.classList.remove('is-banned');
    // if (banOverlay) banOverlay.style.display = 'none';
    // if (banReasonDisplay) banReasonDisplay.style.display = 'none';

    const cacheLoaded = loadCombinedDataFromCache(targetUserId);
    if (!cacheLoaded) {
        if (statsDisplay) statsDisplay.innerHTML = '<p>Loading...</p>';
        updateProfileTitlesAndRank(null, false);
    }

    const uRef = db.collection('users').doc(targetUserId);
    const lRef = db.collection('leaderboard').doc(targetUserId);
    // REMOVED: Reference to banned_users collection
    // const bRef = db.collection('banned_users').doc(targetUserId);

    // REMOVED: Variables for ban status
    // let pS, sS, bS, pD = null, sD = null, iB = false, bR = null;
    let pS, sS, pD = null, sD = null; // Ban variables removed

    try {
        console.log(`[D] S1: Get user ${targetUserId}`);
        pS = await uRef.get();
        if (signal?.aborted) throw new Error('AbortError');
        console.log(`[D] S1: user.get() ${pS.exists ? 'OK' : 'NOT found'}`);
        if (pS.exists) {
            pD = { id: pS.id, ...pS.data() };
        } else {
            console.warn(`Profile doc missing: ${targetUserId}`);
            if (loggedInUser && loggedInUser.uid === targetUserId) {
                console.log(`Attempt create self: ${targetUserId}`);
                pD = await createUserProfileDocument(targetUserId, loggedInUser);
                if (!pD) throw new Error(`Profile create fail: ${targetUserId}.`);
            }
        }

        console.log(`[D] S2: Get stats ${targetUserId}`);
        sS = await lRef.get();
        if (signal?.aborted) throw new Error('AbortError');
        console.log(`[D] S2: stats.get() ${sS.exists ? 'OK' : 'NOT found'}`);
        sD = sS.exists ? { id: sS.id, ...sS.data() } : null;

        // REMOVED: Step 3 - Fetching ban status
        // console.log(`[D] S3: Get ban ${targetUserId}`);
        // bS = await bRef.get();
        // if (signal?.aborted) throw new Error('AbortError');
        // console.log(`[D] S3: ban.get() ${bS.exists ? 'OK (banned)' : 'OK (not banned)'}`);
        // iB = bS.exists;
        // bR = iB ? (bS.data()?.reason || "N/A") : null;

        // Update viewingUserProfileData without ban info
        viewingUserProfileData = { profile: pD, stats: sD };

        console.log("Final State - P:", pD);
        console.log("Final State - S:", sD);
        // REMOVED: Log for ban state
        // console.log(`Final State - B: ${iB}`);

        // Call displayProfileData without ban info
        displayProfileData(pD, sD);
        saveCombinedDataToCache(targetUserId, viewingUserProfileData);

        // REMOVED: Check for !iB before granting achievements
        // Check achievements only if profile exists, user is viewing own profile, and stats exist
        if (pD && loggedInUser && loggedInUser.uid === targetUserId && sD) {
            if (!allAchievements) await fetchAllAchievements();
            if (allAchievements) {
                const updatedProfile = await checkAndGrantAchievements(targetUserId, pD, sD);
                if (updatedProfile) {
                    console.log("Achieve upd, refresh UI.");
                    viewingUserProfileData.profile = updatedProfile;
                    // Call displayProfileData without ban info
                    displayProfileData(updatedProfile, sD);
                    saveCombinedDataToCache(targetUserId, viewingUserProfileData);
                }
            }
        }
    } catch (error) {
        if (error.message === 'AbortError') {
            throw error; // Re-throw AbortError to be caught by the outer handler
        }
        console.error(`!!! Firestore read Err seq fetch ${targetUserId}:`, error.message);
        console.error("Check DEBUG STEP logs.");
        console.error("Full error:", error);
        if (error.stack) console.error("Stack:", error.stack);
        if (!cacheLoaded) {
             // Reset UI on error only if nothing was loaded from cache initially
            if (statsDisplay) statsDisplay.innerHTML = '<p>Error loading stats.</p>';
            updateProfileTitlesAndRank(null, false);
            loadingIndicator.style.display = 'none';
            profileContent.style.display = 'none';
            notLoggedInMsg.innerHTML = '<p>Error loading profile data.</p>';
            notLoggedInMsg.style.display = 'flex';
            resetProfileUI(); // Call reset which no longer deals with ban UI
        } else {
            console.warn("Error fetching fresh data, continuing with cached data.");
            // No UI reset here, as cached data is already displayed
        }
    }
}


// --- Central Function to Display Profile Data ---
// REMOVED: iB and bR parameters
function displayProfileData(pD, sD) {
    // REMOVED: Ban UI reset/setup
    // if (profileContainer) profileContainer.classList.remove('is-banned');
    // if (banOverlay) banOverlay.style.display = 'none';
    // if (banReasonDisplay) banReasonDisplay.style.display = 'none';

    if (!pD) {
        console.log("Display: User Profile Not Found.");
        if (usernameDisplay) usernameDisplay.textContent = "Not Found";
        if (emailDisplay) emailDisplay.textContent = "";
        if (profilePicDiv) profilePicDiv.textContent = "?";
        if (adminTag) adminTag.style.display = 'none';
        if (profileBadgesContainer) profileBadgesContainer.innerHTML = '';
        updateProfileTitlesAndRank(null, false);
        displayStats(null);
        if (profileLogoutBtn) profileLogoutBtn.style.display = 'none';
        closeTitleSelector();
        return;
    }

    const dN = pD.displayName || 'User';
    const em = pD.email || 'N/A';
    if (usernameDisplay) usernameDisplay.textContent = dN;
    if (emailDisplay) emailDisplay.textContent = em;
    if (profilePicDiv) profilePicDiv.textContent = dN.charAt(0).toUpperCase() || '?';

    displayUserBadges(pD);
    displayStats(sD);

    const isOwn = loggedInUser && loggedInUser.uid === pD.id;

    // REMOVED: Conditional logic based on ban status (iB)
    // if (iB) { ... } else { ... }
    // Now always update titles/rank based on profile data
    updateProfileTitlesAndRank(pD, isOwn);

    if (profileLogoutBtn) {
        profileLogoutBtn.style.display = isOwn ? 'inline-block' : 'none';
    }
    // Ensure title selector is closed if profile changes/reloads (was inside the old 'else')
    if (!isOwn) {
        closeTitleSelector();
    }
}


// --- Check and Grant Achievements ---
// No changes needed here as it didn't directly use ban status,
// only the calling function (`loadCombinedUserData`) checked it previously.
async function checkAndGrantAchievements(uid, cProf, cStats) {
    if (!allAchievements || !uid || !cProf || !cStats) {
        console.warn("Skipping achievement check: Missing data.");
        return null;
    }
    console.log(`Checking achievements for ${uid}`);
    try {
        const uaRef = db.collection('userAchievements').doc(uid);
        const uaDoc = await uaRef.get();
        const uIds = uaDoc.exists ? (uaDoc.data()?.unlocked || []) : [];
        let newUnl = [], rwd = { titles: [], rank: null, points: 0 }, upd = false;

        for (const id in allAchievements) {
            if (uIds.includes(id)) continue; // Skip already unlocked

            const a = allAchievements[id];
            let met = false;

            // Check criteria
            if (a.criteria?.stat && cStats[a.criteria.stat] !== undefined) {
                const sV = cStats[a.criteria.stat], rV = a.criteria.value;
                switch (a.criteria.operator) {
                    case '>=': met = sV >= rV; break;
                    case '<=': met = sV <= rV; break;
                    case '==': met = sV == rV; break;
                    case '>': met = sV > rV; break;
                    case '<': met = sV < rV; break;
                    default: console.warn(`Unknown achievement operator: ${a.criteria.operator} for achievement ${id}`);
                }
            } else if (a.criteria && a.criteria.stat) {
                 console.warn(`Stat ${a.criteria.stat} not found in user stats for achievement ${id}`);
            } else if (a.criteria) {
                 console.warn(`Invalid criteria definition for achievement ${id}:`, a.criteria);
            } // Achievements without criteria might exist (e.g., manual grant - not handled here)


            if (met) {
                console.log(`Achievement Met: ${a.name || id}`);
                newUnl.push(id);
                upd = true;
                if (a.rewards?.title) rwd.titles.push(a.rewards.title);
                if (a.rewards?.rank) rwd.rank = a.rewards.rank; // Consider precedence if multiple ranks unlocked
                if (a.rewards?.rankPoints) rwd.points += a.rewards.rankPoints;
            }
        }

        if (upd && newUnl.length > 0) {
            console.log(`Unlocking achievements:`, newUnl);
            const b = db.batch();
            const pRef = db.collection('users').doc(uid);

            // Update userAchievements document
            b.set(uaRef, { unlocked: firebase.firestore.FieldValue.arrayUnion(...newUnl) }, { merge: true });

            // Prepare updates for the user profile document
            const pU = {}; // Profile Updates
            let lP = { ...cProf }; // Local Profile copy for immediate UI update

            if (rwd.titles.length > 0) {
                pU.availableTitles = firebase.firestore.FieldValue.arrayUnion(...rwd.titles);
                // Update local profile state correctly
                lP.availableTitles = [...new Set([...(lP.availableTitles || []), ...rwd.titles])];
                // Equip first unlocked title if none is equipped
                if (!lP.equippedTitle) {
                    const firstNewTitle = rwd.titles[0];
                    pU.equippedTitle = firstNewTitle;
                    lP.equippedTitle = firstNewTitle;
                    console.log(`Auto-equipping first unlocked title: ${firstNewTitle}`);
                }
            }
            if (rwd.rank) { // Consider logic if multiple achievements grant rank
                pU.currentRank = rwd.rank;
                lP.currentRank = rwd.rank;
            }
            if (rwd.points > 0) {
                 console.warn("Rank Points TBD/Not implemented in this update.");
                 // Example: pU.rankPoints = firebase.firestore.FieldValue.increment(rwd.points);
            }

            // Ensure rank/title have default values if not set/updated
            if (!lP.currentRank) {
                 pU.currentRank = 'Unranked'; lP.currentRank = 'Unranked';
            }
            if (!lP.equippedTitle && !pU.equippedTitle) { // Check if still not equipped after potential reward
                 pU.equippedTitle = ''; lP.equippedTitle = '';
            }

            let profileUpdateNeeded = false;
            if (Object.keys(pU).length > 0) {
                b.update(pRef, pU);
                profileUpdateNeeded = true;
            }

            await b.commit();
            console.log(`Batch commit for ${uid}. Profile Updated: ${profileUpdateNeeded}`);
            return profileUpdateNeeded ? lP : null; // Return updated local profile if changes occurred
        } else {
            // console.log(`No new achievements met for ${uid}`);
            return null; // No updates
        }
    } catch (e) {
        console.error(`Error checking/granting achievements for ${uid}:`, e);
        return null; // Return null on error
    }
}


// --- Display Stats Grid ---
function displayStats(sD){if(!statsDisplay)return;statsDisplay.innerHTML='';if(!sD||typeof sD!=='object'||Object.keys(sD).length===0){statsDisplay.innerHTML='<p>No stats.</p>';return;}const sTs=[{k:'wins',l:'W'},{k:'points',l:'P'},{k:'kdRatio',l:'K/D',f:(v)=>typeof v==='number'?v.toFixed(2):v},{k:'matchesPlayed',l:'MP',fBk:'matches'},{k:'losses',l:'L'}];let iA=0;sTs.forEach(s=>{const k=s.k,fBk=s.fBk;let v=(sD[k]!==undefined&&sD[k]!==null)?sD[k]:(fBk&&sD[fBk]!==undefined&&sD[fBk]!==null)?sD[fBk]:'-';const fv=s.f?s.f(v):v;statsDisplay.appendChild(createStatItem(s.l,fv));iA++;});if(iA===0){statsDisplay.innerHTML='<p>No stats found.</p>';}}

// --- Helper: Create a Single Stat Item Element ---
function createStatItem(t,v){const d=document.createElement('div');d.classList.add('stat-item');const h=document.createElement('h4');h.textContent=t;const p=document.createElement('p');p.textContent=(v!==null&&v!==undefined)?escapeHtml(v):'-';d.appendChild(h);d.appendChild(p);return d;}

// --- Helper: Update Profile Rank/Title Display ---
function updateProfileTitlesAndRank(pD,aI){if(!rankDisplay||!titleDisplay)return;titleDisplay.classList.remove('selectable-title');titleDisplay.removeEventListener('click',handleTitleClick);if(pD&&typeof pD==='object'){const r=pD.currentRank||'Unr',t=pD.equippedTitle||'',aT=pD.availableTitles||[];rankDisplay.textContent=r;rankDisplay.className=`profile-rank-display rank-${r.toLowerCase().replace(/\s+/g,'-')}`;if(t){titleDisplay.textContent=escapeHtml(t);titleDisplay.style.display='inline-block';if(aI&&aT.length>0){titleDisplay.classList.add('selectable-title');titleDisplay.addEventListener('click',handleTitleClick);}}else{titleDisplay.textContent='';titleDisplay.style.display='none';}}else{rankDisplay.textContent='---';rankDisplay.className='profile-rank-display rank-unr';titleDisplay.textContent='';titleDisplay.style.display='none';closeTitleSelector();}}

// --- Handle Clicks on the Equipped Title ---
function handleTitleClick(e){
    e.stopPropagation();
    // REMOVED: Ban check
    // if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id || viewingUserProfileData.isBanned) return;
    if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id) return; // Check if user owns the profile
    if(isTitleSelectorOpen) closeTitleSelector();
    else if (viewingUserProfileData.profile?.availableTitles?.length > 0) openTitleSelector();
}

// --- Open Title Selector Dropdown ---
function openTitleSelector(){
    // REMOVED: Ban check
    // if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id || viewingUserProfileData.isBanned || isTitleSelectorOpen || !profileIdentifiersDiv || !viewingUserProfileData.profile?.availableTitles?.length > 0) return;
    if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id || isTitleSelectorOpen || !profileIdentifiersDiv || !viewingUserProfileData.profile?.availableTitles?.length > 0) return;

    const aT=viewingUserProfileData.profile.availableTitles,cET=viewingUserProfileData.profile.equippedTitle||'';
    if(!titleSelectorElement){titleSelectorElement=document.createElement('div');titleSelectorElement.className='title-selector';profileIdentifiersDiv.appendChild(titleSelectorElement);}
    titleSelectorElement.innerHTML='';
    // Add "Remove Title" option if a title is currently equipped
    if(cET){const rO=document.createElement('button');rO.className='title-option remove-title';rO.dataset.title="";rO.type='button';rO.textContent='(Remove Title)';rO.setAttribute('aria-pressed','false');rO.addEventListener('click',handleTitleOptionClick);titleSelectorElement.appendChild(rO);}
    // Add available titles
    aT.forEach(tO=>{const oE=document.createElement('button');oE.className='title-option';oE.dataset.title=tO;oE.type='button';oE.textContent=escapeHtml(tO);if(tO===cET){oE.classList.add('currently-equipped');oE.setAttribute('aria-pressed','true');}else{oE.setAttribute('aria-pressed','false');}oE.addEventListener('click',handleTitleOptionClick);titleSelectorElement.appendChild(oE);});
    titleSelectorElement.style.display='block';isTitleSelectorOpen=true;setTimeout(()=>{document.addEventListener('click',handleClickOutsideTitleSelector,{capture:true,once:true});},0);
}

// --- Close Title Selector Dropdown ---
function closeTitleSelector(){if(!isTitleSelectorOpen||!titleSelectorElement)return;titleSelectorElement.style.display='none';isTitleSelectorOpen=false;document.removeEventListener('click',handleClickOutsideTitleSelector,{capture:true});}

// --- Handle Clicks Outside the Selector ---
function handleClickOutsideTitleSelector(e){if(!isTitleSelectorOpen)return;const iS=titleSelectorElement?.contains(e.target);const oT=titleDisplay?.contains(e.target);if(!iS&&!oT){closeTitleSelector();}else{document.addEventListener('click',handleClickOutsideTitleSelector,{capture:true,once:true});}}

// --- Handle Clicks on a Title Option ---
async function handleTitleOptionClick(e){
    e.stopPropagation();
    const sT=e.currentTarget.dataset.title; // Selected title (can be "" for remove)
    const cUId=loggedInUser?.uid;
    const cVP=viewingUserProfileData.profile;

    // REMOVED: Ban check
    // if (!cUId || !cVP || cUId !== cVP.id || viewingUserProfileData.isBanned) {
    if (!cUId || !cVP || cUId !== cVP.id) { // Check if user owns the profile
        closeTitleSelector();
        return;
    }

    const cEq=cVP.equippedTitle||'';
    if(sT===cEq){ // Clicked the already equipped title or trying to remove when none is equipped
        closeTitleSelector();
        return;
    }

    closeTitleSelector();
    if(titleDisplay){ // Indicate loading state
        titleDisplay.textContent="Updating...";
        titleDisplay.classList.remove('selectable-title');
        titleDisplay.removeEventListener('click',handleTitleClick);
    }

    try{
        const uRef=db.collection('users').doc(cUId);
        await uRef.update({equippedTitle:sT});
        console.log(`Set title "${sT || '(none)'}" for ${cUId}`);
        // Update local state immediately
        viewingUserProfileData.profile.equippedTitle=sT;
        saveCombinedDataToCache(cUId,viewingUserProfileData); // Update cache
        updateProfileTitlesAndRank(viewingUserProfileData.profile,true); // Refresh UI with new title
    } catch(err){
        console.error("Title update error:",err);
        alert("Failed to update title.");
        // Revert local state and UI on error
        if(viewingUserProfileData.profile){viewingUserProfileData.profile.equippedTitle=cEq;}
        updateProfileTitlesAndRank(viewingUserProfileData.profile,true); // Refresh UI with old title
    }
}

// --- Logout Button Event Listener ---
if(profileLogoutBtn){profileLogoutBtn.addEventListener('click',()=>{const uId=loggedInUser?.uid;if(titleDisplay)titleDisplay.removeEventListener('click',handleTitleClick);closeTitleSelector();auth.signOut().then(()=>{console.log('Signed out.');if(uId){localStorage.removeItem(`poxelProfileCombinedData_${uId}`);console.log(`Cache cleared for ${uId}`);}viewingUserProfileData={};}).catch((e)=>{console.error('SignOut err:',e);alert('SignOut err.');});});}else{console.warn("No logout btn found.");}

// --- Initial log ---
console.log("Profile script initialized (Ban features removed).");
