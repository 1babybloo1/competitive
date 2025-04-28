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
   safe = safe.replace(/"/g, """);
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
function resetProfileUI() { console.log("Resetting profile UI."); if (profileContainer) profileContainer.classList.remove('is-banned'); if (banOverlay) banOverlay.style.display='none'; if (banReasonDisplay) banReasonDisplay.style.display='none'; if (usernameDisplay) usernameDisplay.textContent='...'; if (emailDisplay) emailDisplay.textContent='...'; if (profilePicDiv) profilePicDiv.textContent='?'; if (adminTag) adminTag.style.display='none'; if (profileBadgesContainer) profileBadgesContainer.innerHTML=''; if (profileLogoutBtn) profileLogoutBtn.style.display='none'; if (statsDisplay) statsDisplay.innerHTML=''; updateProfileTitlesAndRank(null,false); closeTitleSelector(); viewingUserProfileData={}; }

// --- Helper Function: Client-Side User Profile Document Creation ---
async function createUserProfileDocument(userId, authUser) { if (!userId || !authUser || authUser.uid !== userId) { console.error("createUserProfileDocument args invalid."); return null; } console.warn(`Attempting client-side creation/merge for UID: ${userId}`); const userDocRef = db.collection("users").doc(userId); const displayName = authUser.displayName || `User_${userId.substring(0,5)}`; const email = authUser.email||null; const defaultProfileData = {email,displayName,currentRank:"Unranked",equippedTitle:"",availableTitles:[],friends:[],createdAt:firebase.firestore.FieldValue.serverTimestamp()}; try { await userDocRef.set(defaultProfileData,{merge:true}); console.log(`Created/merged doc for UID: ${userId}`); const freshSnap=await userDocRef.get(); return freshSnap.exists?{id:freshSnap.id,...freshSnap.data()}:null;} catch(error){console.error(`Error creating/merging profile doc:`, error); alert("Error setting up profile."); return null;}}

// --- Load Combined Data from Local Storage Cache ---
function loadCombinedDataFromCache(viewedUserId) { const key=`poxelProfileCombinedData_${viewedUserId}`; const str=localStorage.getItem(key); if(str){try{const data=JSON.parse(str);if(data&&typeof data==='object'){viewingUserProfileData=data;console.log("Loaded data from cache:",viewedUserId,data);displayProfileData(data.profile,data.stats,data.isBanned||false,data.banReason||null);return true;}else{console.warn("Invalid cache:",viewedUserId);localStorage.removeItem(key);viewingUserProfileData={};return false;}}catch(e){console.error("Err parsing cache:",e);localStorage.removeItem(key);viewingUserProfileData={};return false;}}else{viewingUserProfileData={};return false;}}

// --- Save Combined Data to Local Storage Cache ---
function saveCombinedDataToCache(uid,data){if(!uid||!data)return;if(typeof data.isBanned==='undefined')console.warn("Saving cache w/o ban status:",uid);const key=`poxelProfileCombinedData_${uid}`;try{localStorage.setItem(key,JSON.stringify(data));}catch(e){console.error("Err saving cache:",e);}}

// --- Load Combined User Data (Sequential Fetch Debugging) ---
async function loadCombinedUserData(targetUserId,signal){console.log(`LoadCombined: TARGET ${targetUserId}`);if(profileContainer)profileContainer.classList.remove('is-banned');if(banOverlay)banOverlay.style.display='none';if(banReasonDisplay)banReasonDisplay.style.display='none';const cacheLoaded=loadCombinedDataFromCache(targetUserId);if(!cacheLoaded){if(statsDisplay)statsDisplay.innerHTML='<p>Loading...</p>';updateProfileTitlesAndRank(null,false);}const uRef=db.collection('users').doc(targetUserId),lRef=db.collection('leaderboard').doc(targetUserId),bRef=db.collection('banned_users').doc(targetUserId);let pS,sS,bS,pD=null,sD=null,iB=false,bR=null;try{console.log(`[D] S1: Get user ${targetUserId}`);pS=await uRef.get();if(signal?.aborted)throw new Error('AbortError');console.log(`[D] S1: user.get() ${pS.exists?'OK':'NOT found'}`);if(pS.exists){pD={id:pS.id,...pS.data()};}else{console.warn(`Profile doc missing: ${targetUserId}`);if(loggedInUser&&loggedInUser.uid===targetUserId){console.log(`Attempt create self: ${targetUserId}`);pD=await createUserProfileDocument(targetUserId,loggedInUser);if(!pD)throw new Error(`Profile create fail: ${targetUserId}.`);}} console.log(`[D] S2: Get stats ${targetUserId}`);sS=await lRef.get();if(signal?.aborted)throw new Error('AbortError');console.log(`[D] S2: stats.get() ${sS.exists?'OK':'NOT found'}`);sD=sS.exists?{id:sS.id,...sS.data()}:null; console.log(`[D] S3: Get ban ${targetUserId}`);bS=await bRef.get();if(signal?.aborted)throw new Error('AbortError');console.log(`[D] S3: ban.get() ${bS.exists?'OK (banned)':'OK (not banned)'}`);iB=bS.exists;bR=iB?(bS.data()?.reason||"N/A"):null;viewingUserProfileData={profile:pD,stats:sD,isBanned:iB,banReason:bR};console.log("Final State - P:",pD);console.log("Final State - S:",sD);console.log(`Final State - B: ${iB}`);displayProfileData(pD,sD,iB,bR);saveCombinedDataToCache(targetUserId,viewingUserProfileData);if(pD&&!iB&&loggedInUser&&loggedInUser.uid===targetUserId&&sD){if(!allAchievements)await fetchAllAchievements();if(allAchievements){const pu=await checkAndGrantAchievements(targetUserId,pD,sD);if(pu){console.log("Achieve upd, refresh UI.");viewingUserProfileData.profile=pu;displayProfileData(pu,sD,iB,bR);saveCombinedDataToCache(targetUserId,viewingUserProfileData);}}}}catch(error){if(error.message==='AbortError'){throw error;}console.error(`!!! Firestore read Err seq fetch ${targetUserId}:`,error.message);console.error("Check DEBUG STEP logs.");console.error("Full error:",error);if(error.stack)console.error("Stack:",error.stack);if(!cacheLoaded){if(statsDisplay)statsDisplay.innerHTML='<p>Error.</p>';updateProfileTitlesAndRank(null,false);loadingIndicator.style.display='none';profileContent.style.display='none';notLoggedInMsg.innerHTML='<p>Error loading data.</p>';notLoggedInMsg.style.display='flex';resetProfileUI();}else{console.warn("Error fetching fresh, using cache.");}}}

// --- Central Function to Display Profile Data ---
function displayProfileData(pD,sD,iB=false,bR=null){if(profileContainer)profileContainer.classList.remove('is-banned');if(banOverlay)banOverlay.style.display='none';if(banReasonDisplay)banReasonDisplay.style.display='none';if(!pD){console.log("Display: User Not Found.");if(usernameDisplay)usernameDisplay.textContent="Not Found";if(emailDisplay)emailDisplay.textContent="";if(profilePicDiv)profilePicDiv.textContent="?";if(adminTag)adminTag.style.display='none';if(profileBadgesContainer)profileBadgesContainer.innerHTML='';updateProfileTitlesAndRank(null,false);displayStats(null);if(profileLogoutBtn)profileLogoutBtn.style.display='none';closeTitleSelector();return;}const dN=pD.displayName||'User',em=pD.email||'N/A';if(usernameDisplay)usernameDisplay.textContent=dN;if(emailDisplay)emailDisplay.textContent=em;if(profilePicDiv)profilePicDiv.textContent=dN.charAt(0).toUpperCase()||'?';displayUserBadges(pD);displayStats(sD);const isOwn=loggedInUser&&loggedInUser.uid===pD.id;if(iB){console.log("Apply banned styles:",pD.id);if(profileContainer)profileContainer.classList.add('is-banned');if(banOverlay)banOverlay.style.display='block';if(banReasonDisplay&&bR){banReasonDisplay.textContent=`Reason: ${escapeHtml(bR)}`;banReasonDisplay.style.display='block';}updateProfileTitlesAndRank(null,false);closeTitleSelector();}else{updateProfileTitlesAndRank(pD,isOwn);}if(profileLogoutBtn){profileLogoutBtn.style.display=isOwn?'inline-block':'none';}}

// --- Check and Grant Achievements ---
async function checkAndGrantAchievements(uid,cProf,cStats){if(!allAchievements||!uid||!cProf||!cStats){console.warn("Skip achieve check.");return null;}console.log(`Checking achieve for ${uid}`);try{const uaRef=db.collection('userAchievements').doc(uid);const uaDoc=await uaRef.get();const uIds=uaDoc.exists?(uaDoc.data()?.unlocked||[]):[];let newUnl=[],rwd={titles:[],rank:null,points:0},upd=false;for(const id in allAchievements){if(uIds.includes(id))continue;const a=allAchievements[id];let met=false;if(a.criteria?.stat&&cStats[a.criteria.stat]!==undefined){const sV=cStats[a.criteria.stat],rV=a.criteria.value;switch(a.criteria.operator){case'>=':met=sV>=rV;break;case'<=':met=sV<=rV;break;case'==':met=sV==rV;break;case'>':met=sV>rV;break;case'<':met=sV<rV;break;default:console.warn(`Unk op ${a.criteria.operator}`);}}else if(a.criteria)console.warn(`Inv criteria ${id}`);if(met){console.log(`Met: ${a.name||id}`);newUnl.push(id);upd=true;if(a.rewards?.title)rwd.titles.push(a.rewards.title);if(a.rewards?.rank)rwd.rank=a.rewards.rank;if(a.rewards?.rankPoints)rwd.points+=a.rewards.rankPoints;}}if(upd&&newUnl.length>0){console.log(`Unlocking:`,newUnl);const b=db.batch(),pRef=db.collection('users').doc(uid);b.set(uaRef,{unlocked:firebase.firestore.FieldValue.arrayUnion(...newUnl)},{merge:true});const pU={};let lP={...cProf};if(rwd.titles.length>0){pU.availableTitles=firebase.firestore.FieldValue.arrayUnion(...rwd.titles);lP.availableTitles=[...new Set([...(lP.availableTitles||[]),...rwd.titles])];if(!lP.equippedTitle){const t=rwd.titles[0];pU.equippedTitle=t;lP.equippedTitle=t;console.log(`Equip: ${t}`);}}if(rwd.rank){pU.currentRank=rwd.rank;lP.currentRank=rwd.rank;}if(rwd.points>0)console.warn("RP TBD");if(!lP.currentRank){pU.currentRank='Unranked';lP.currentRank='Unranked';}if(!lP.equippedTitle&&!pU.equippedTitle){pU.equippedTitle='';lP.equippedTitle='';}let pC=false;if(Object.keys(pU).length>0){b.update(pRef,pU);pC=true;}await b.commit();console.log(`Batch ${uid}. PU:${pC}`);return pC?lP:null;}else{return null;}}catch(e){console.error(`Achieve err ${uid}:`,e);return null;}}

// --- Display Stats Grid ---
function displayStats(sD){if(!statsDisplay)return;statsDisplay.innerHTML='';if(!sD||typeof sD!=='object'||Object.keys(sD).length===0){statsDisplay.innerHTML='<p>No stats.</p>';return;}const sTs=[{k:'wins',l:'W'},{k:'points',l:'P'},{k:'kdRatio',l:'K/D',f:(v)=>typeof v==='number'?v.toFixed(2):v},{k:'matchesPlayed',l:'MP',fBk:'matches'},{k:'losses',l:'L'}];let iA=0;sTs.forEach(s=>{const k=s.k,fBk=s.fBk;let v=(sD[k]!==undefined&&sD[k]!==null)?sD[k]:(fBk&&sD[fBk]!==undefined&&sD[fBk]!==null)?sD[fBk]:'-';const fv=s.f?s.f(v):v;statsDisplay.appendChild(createStatItem(s.l,fv));iA++;});if(iA===0){statsDisplay.innerHTML='<p>No stats found.</p>';}}

// --- Helper: Create a Single Stat Item Element ---
function createStatItem(t,v){const d=document.createElement('div');d.classList.add('stat-item');const h=document.createElement('h4');h.textContent=t;const p=document.createElement('p');p.textContent=(v!==null&&v!==undefined)?escapeHtml(v):'-';d.appendChild(h);d.appendChild(p);return d;}

// --- Helper: Update Profile Rank/Title Display ---
function updateProfileTitlesAndRank(pD,aI){if(!rankDisplay||!titleDisplay)return;titleDisplay.classList.remove('selectable-title');titleDisplay.removeEventListener('click',handleTitleClick);if(pD&&typeof pD==='object'){const r=pD.currentRank||'Unr',t=pD.equippedTitle||'',aT=pD.availableTitles||[];rankDisplay.textContent=r;rankDisplay.className=`profile-rank-display rank-${r.toLowerCase().replace(/\s+/g,'-')}`;if(t){titleDisplay.textContent=escapeHtml(t);titleDisplay.style.display='inline-block';if(aI&&aT.length>0){titleDisplay.classList.add('selectable-title');titleDisplay.addEventListener('click',handleTitleClick);}}else{titleDisplay.textContent='';titleDisplay.style.display='none';}}else{rankDisplay.textContent='---';rankDisplay.className='profile-rank-display rank-unr';titleDisplay.textContent='';titleDisplay.style.display='none';closeTitleSelector();}}

// --- Handle Clicks on the Equipped Title ---
function handleTitleClick(e){e.stopPropagation();if(!loggedInUser||loggedInUser.uid!==viewingUserProfileData.profile?.id||viewingUserProfileData.isBanned)return;if(isTitleSelectorOpen)closeTitleSelector();else if(viewingUserProfileData.profile?.availableTitles?.length>0)openTitleSelector();}

// --- Open Title Selector Dropdown ---
function openTitleSelector(){if(!loggedInUser||loggedInUser.uid!==viewingUserProfileData.profile?.id||viewingUserProfileData.isBanned||isTitleSelectorOpen||!profileIdentifiersDiv||!viewingUserProfileData.profile?.availableTitles?.length>0)return;const aT=viewingUserProfileData.profile.availableTitles,cET=viewingUserProfileData.profile.equippedTitle||'';if(!titleSelectorElement){titleSelectorElement=document.createElement('div');titleSelectorElement.className='title-selector';profileIdentifiersDiv.appendChild(titleSelectorElement);}titleSelectorElement.innerHTML='';if(cET){const rO=document.createElement('button');rO.className='title-option r';rO.dataset.title="";rO.type='button';rO.textContent='(X)';rO.setAttribute('aria-pressed','false');rO.addEventListener('click',handleTitleOptionClick);titleSelectorElement.appendChild(rO);}aT.forEach(tO=>{const oE=document.createElement('button');oE.className='title-option';oE.dataset.title=tO;oE.type='button';oE.textContent=escapeHtml(tO);if(tO===cET){oE.classList.add('currently-equipped');oE.setAttribute('aria-pressed','true');}else{oE.setAttribute('aria-pressed','false');}oE.addEventListener('click',handleTitleOptionClick);titleSelectorElement.appendChild(oE);});titleSelectorElement.style.display='block';isTitleSelectorOpen=true;setTimeout(()=>{document.addEventListener('click',handleClickOutsideTitleSelector,{capture:true,once:true});},0);}

// --- Close Title Selector Dropdown ---
function closeTitleSelector(){if(!isTitleSelectorOpen||!titleSelectorElement)return;titleSelectorElement.style.display='none';isTitleSelectorOpen=false;document.removeEventListener('click',handleClickOutsideTitleSelector,{capture:true});}

// --- Handle Clicks Outside the Selector ---
function handleClickOutsideTitleSelector(e){if(!isTitleSelectorOpen)return;const iS=titleSelectorElement?.contains(e.target);const oT=titleDisplay?.contains(e.target);if(!iS&&!oT){closeTitleSelector();}else{document.addEventListener('click',handleClickOutsideTitleSelector,{capture:true,once:true});}}

// --- Handle Clicks on a Title Option ---
async function handleTitleOptionClick(e){e.stopPropagation();const sT=e.currentTarget.dataset.title;const cUId=loggedInUser?.uid;const cVP=viewingUserProfileData.profile;if(!cUId||!cVP||cUId!==cVP.id||viewingUserProfileData.isBanned){closeTitleSelector();return;}const cEq=cVP.equippedTitle||'';if(sT===cEq){closeTitleSelector();return;}closeTitleSelector();if(titleDisplay){titleDisplay.textContent="...";titleDisplay.classList.remove('selectable-title');titleDisplay.removeEventListener('click',handleTitleClick);}try{const uRef=db.collection('users').doc(cUId);await uRef.update({equippedTitle:sT});console.log(`Set title "${sT}" for ${cUId}`);viewingUserProfileData.profile.equippedTitle=sT;saveCombinedDataToCache(cUId,viewingUserProfileData);updateProfileTitlesAndRank(viewingUserProfileData.profile,true);}catch(err){console.error("Title upd err:",err);alert("Fail upd title.");if(viewingUserProfileData.profile){viewingUserProfileData.profile.equippedTitle=cEq;}updateProfileTitlesAndRank(viewingUserProfileData.profile,true);}}

// --- Logout Button Event Listener ---
if(profileLogoutBtn){profileLogoutBtn.addEventListener('click',()=>{const uId=loggedInUser?.uid;if(titleDisplay)titleDisplay.removeEventListener('click',handleTitleClick);closeTitleSelector();auth.signOut().then(()=>{console.log('Signed out.');if(uId){localStorage.removeItem(`poxelProfileCombinedData_${uId}`);console.log(`Cache clear ${uId}`);}viewingUserProfileData={};}).catch((e)=>{console.error('SignOut err:',e);alert('SignOut err.');});});}else{console.warn("No logout btn.");}

// --- Initial log ---
console.log("Profile script initialized.");
