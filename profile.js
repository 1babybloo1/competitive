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
// START FIXED escapeHtml FUNCTION
// =============================================================
// --- Helper Function: Escape HTML (Rewritten for Clarity/Robustness) ---
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

   // Perform replacements sequentially
   let safe = unsafe;
   safe = safe.replace(/&/g, "&");
   safe = safe.replace(/</g, "<");
   safe = safe.replace(/>/g, ">");
   safe = safe.replace(/"/g, """);
   safe = safe.replace(/'/g, "'"); // Also handles single quotes

   return safe;
}
// ===========================================================
// END FIXED escapeHtml FUNCTION
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
    // ... (Keep the function content from the previous full script) ...
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
    // ... (Keep the function content from the previous full script) ...
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
            await loadCombinedUserData(targetUid, signal);
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
                loadingIndicator.style.display = 'none';
                profileContent.style.display = 'none';
                notLoggedInMsg.innerHTML = '<p>Error loading profile data. Please try again later.</p>';
                notLoggedInMsg.style.display = 'flex';
                resetProfileUI();
            }
        } finally {
            currentProfileLoadAbortController = null;
        }
    } else {
        console.log('No user logged in and no profile UID in URL.');
        loadingIndicator.style.display = 'none';
        profileContent.style.display = 'none';
        notLoggedInMsg.innerHTML = '<p>You need to be logged in to view your profile, or specify a user UID in the URL.</p>';
        notLoggedInMsg.style.display = 'flex';
        resetProfileUI();
    }
});

// --- Helper Function: Reset Profile UI elements ---
function resetProfileUI() {
    // ... (Keep the function content from the previous full script) ...
    console.log("Resetting profile UI elements.");
    if (profileContainer) profileContainer.classList.remove('is-banned');
    if (banOverlay) banOverlay.style.display = 'none';
    if (banReasonDisplay) banReasonDisplay.style.display = 'none';
    if (usernameDisplay) usernameDisplay.textContent = '...';
    if (emailDisplay) emailDisplay.textContent = '...';
    if (profilePicDiv) profilePicDiv.textContent = '?';
    if (adminTag) adminTag.style.display = 'none';
    if (profileBadgesContainer) profileBadgesContainer.innerHTML = '';
    if (profileLogoutBtn) profileLogoutBtn.style.display = 'none';
    if (statsDisplay) statsDisplay.innerHTML = '';
    updateProfileTitlesAndRank(null, false);
    closeTitleSelector();
    viewingUserProfileData = {};
}


// --- Helper Function: Client-Side User Profile Document Creation ---
async function createUserProfileDocument(userId, authUser) {
    // ... (Keep the function content from the previous full script) ...
    if (!userId || !authUser || authUser.uid !== userId) {
         console.error("createUserProfileDocument called with invalid arguments.");
         return null;
    }
    console.warn(`Attempting client-side creation/merge of user profile doc for own UID: ${userId}`);
    const userDocRef = db.collection("users").doc(userId);
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;
    const email = authUser.email || null;
    const defaultProfileData = {
        email: email, displayName: displayName, currentRank: "Unranked", equippedTitle: "", availableTitles: [], friends: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        await userDocRef.set(defaultProfileData, { merge: true });
        console.log(`Successfully created/merged user profile document for UID: ${userId} via client`);
        const freshSnap = await userDocRef.get();
        return freshSnap.exists ? { id: freshSnap.id, ...freshSnap.data() } : null;
    } catch (error) {
        console.error(`Error creating/merging user profile document client-side for UID ${userId}:`, error);
        alert("Error setting up your profile details. Please check your connection or contact support if the issue persists.");
        return null;
    }
}

// --- Load Combined Data from Local Storage Cache ---
function loadCombinedDataFromCache(viewedUserId) {
    // ... (Keep the function content from the previous full script) ...
     const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
    const cachedDataString = localStorage.getItem(cacheKey);
    if (cachedDataString) {
        try {
            const cachedFullData = JSON.parse(cachedDataString);
            if (cachedFullData && typeof cachedFullData === 'object') {
                 viewingUserProfileData = cachedFullData;
                 console.log("Loaded combined data from cache for VIEWED UID:", viewedUserId, viewingUserProfileData);
                 displayProfileData( viewingUserProfileData.profile, viewingUserProfileData.stats, viewingUserProfileData.isBanned || false, viewingUserProfileData.banReason || null );
                 return true;
            } else {
                 console.warn("Invalid data structure in cache for UID:", viewedUserId);
                 localStorage.removeItem(cacheKey);
                 viewingUserProfileData = {};
                 return false;
            }
        } catch (error) {
            console.error("Error parsing combined cached data:", error);
            localStorage.removeItem(cacheKey);
            viewingUserProfileData = {};
            return false;
        }
    } else {
        viewingUserProfileData = {};
        return false;
    }
}

// --- Save Combined Data to Local Storage Cache ---
function saveCombinedDataToCache(viewedUserId, combinedData) {
    // ... (Keep the function content from the previous full script) ...
    if (!viewedUserId || !combinedData) return;
     if (typeof combinedData.isBanned === 'undefined') {
          console.warn("Attempting to save cache without ban status for UID:", viewedUserId);
     }
     const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
     try {
         localStorage.setItem(cacheKey, JSON.stringify(combinedData));
     } catch(error) {
         console.error("Error saving combined data to cache:", error);
     }
}

// --- Load Combined User Data (Using Sequential Fetch Debugging) ---
// Keep the sequential fetch version from the previous response here
async function loadCombinedUserData(targetUserId, signal) {
    console.log(`Loading combined user data for TARGET UID: ${targetUserId}`);
    if (profileContainer) profileContainer.classList.remove('is-banned');
    if (banOverlay) banOverlay.style.display = 'none';
    if (banReasonDisplay) banReasonDisplay.style.display = 'none';
    const cacheLoaded = loadCombinedDataFromCache(targetUserId);
    if (!cacheLoaded) {
        if (statsDisplay) statsDisplay.innerHTML = '<p>Loading stats...</p>';
        updateProfileTitlesAndRank(null, false);
    }
    const userProfileRef = db.collection('users').doc(targetUserId);
    const leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId);
    const banDocRef = db.collection('banned_users').doc(targetUserId);
    let profileSnap, statsSnap, banSnap;
    let profileData = null, statsData = null, isBanned = false, banReason = null;
    try {
        console.log(`[DEBUG] STEP 1: Attempting userProfileRef.get() for ${targetUserId}`);
        profileSnap = await userProfileRef.get();
        if (signal?.aborted) { throw new Error('AbortError'); }
        console.log(`[DEBUG] STEP 1: userProfileRef.get() ${profileSnap.exists ? 'succeeded (doc found)' : 'succeeded (doc NOT found)'}`);
        if (profileSnap.exists) {
            profileData = { id: profileSnap.id, ...profileSnap.data() };
        } else {
            console.warn(`User profile document does NOT exist for UID: ${targetUserId}`);
            if (loggedInUser && loggedInUser.uid === targetUserId) {
                 console.log(`Attempting profile creation for self (UID: ${targetUserId})`);
                 profileData = await createUserProfileDocument(targetUserId, loggedInUser);
                 if (!profileData) throw new Error(`Profile creation failed for own UID ${targetUserId}.`);
            }
        }
        console.log(`[DEBUG] STEP 2: Attempting leaderboardStatsRef.get() for ${targetUserId}`);
        statsSnap = await leaderboardStatsRef.get();
        if (signal?.aborted) { throw new Error('AbortError'); }
        console.log(`[DEBUG] STEP 2: leaderboardStatsRef.get() ${statsSnap.exists ? 'succeeded (doc found)' : 'succeeded (doc NOT found)'}`);
        statsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null;
        console.log(`[DEBUG] STEP 3: Attempting banDocRef.get() for ${targetUserId}`);
        banSnap = await banDocRef.get();
        if (signal?.aborted) { throw new Error('AbortError'); }
        console.log(`[DEBUG] STEP 3: banDocRef.get() ${banSnap.exists ? 'succeeded (doc found - user banned)' : 'succeeded (doc NOT found - user not banned)'}`);
        isBanned = banSnap.exists;
        banReason = isBanned ? (banSnap.data()?.reason || "No reason specified") : null;
        viewingUserProfileData = { profile: profileData, stats: statsData, isBanned: isBanned, banReason: banReason };
        console.log("Final Fetched State - Profile:", profileData);
        console.log("Final Fetched State - Stats:", statsData);
        console.log(`Final Fetched State - Banned: ${isBanned}`);
        displayProfileData( profileData, statsData, isBanned, banReason );
        saveCombinedDataToCache(targetUserId, viewingUserProfileData);
        if (profileData && !isBanned) {
             if (loggedInUser && loggedInUser.uid === targetUserId && statsData) {
                 if (!allAchievements) await fetchAllAchievements();
                 if (allAchievements) {
                     const potentiallyUpdatedProfile = await checkAndGrantAchievements(targetUserId, profileData, statsData);
                     if (potentiallyUpdatedProfile) {
                         console.log("Achievements granted, refreshing UI.");
                         viewingUserProfileData.profile = potentiallyUpdatedProfile;
                         displayProfileData( viewingUserProfileData.profile, statsData, isBanned, banReason );
                         saveCombinedDataToCache(targetUserId, viewingUserProfileData);
                     }
                 }
             }
        }
    } catch (error) {
        if (error.message === 'AbortError') { throw error; }
        console.error(`!!! Firestore read error occurred during sequential fetch for TARGET UID ${targetUserId}:`, error.message);
        console.error("Check the [DEBUG] STEP logs above to see which fetch might have failed.");
        console.error("Full error object:", error);
        if (error.stack) console.error("DEBUG: Full error stack:", error.stack);
        if (!cacheLoaded) {
             if (statsDisplay) statsDisplay.innerHTML = '<p>Error loading data.</p>';
             updateProfileTitlesAndRank(null, false);
             loadingIndicator.style.display = 'none'; profileContent.style.display = 'none';
             notLoggedInMsg.innerHTML = '<p>Error loading profile data. Please try again later.</p>'; notLoggedInMsg.style.display = 'flex';
             resetProfileUI();
        } else {
             console.warn("Error fetching fresh data, continuing with cached view (if available). Error occurred at some point during fresh fetch.");
        }
    }
}


// --- Central Function to Display Profile Data (Handles Banned State) ---
function displayProfileData(profileData, statsData, isBanned = false, banReason = null) {
    // ... (Keep the function content from the previous full script) ...
    if (profileContainer) profileContainer.classList.remove('is-banned');
    if (banOverlay) banOverlay.style.display = 'none';
    if (banReasonDisplay) banReasonDisplay.style.display = 'none';
    if (!profileData) {
        console.log("Displaying 'User Not Found' state.");
        if (usernameDisplay) usernameDisplay.textContent = "User Not Found";
        if (emailDisplay) emailDisplay.textContent = "";
        if (profilePicDiv) profilePicDiv.textContent = "?";
        if (adminTag) adminTag.style.display = 'none';
        if (profileBadgesContainer) profileBadgesContainer.innerHTML = '';
        updateProfileTitlesAndRank(null, false); displayStats(null);
        if (profileLogoutBtn) profileLogoutBtn.style.display = 'none';
        closeTitleSelector(); return;
    }
    const displayName = profileData.displayName || 'User';
    const email = profileData.email || 'No email provided';
    if (usernameDisplay) usernameDisplay.textContent = displayName;
    if (emailDisplay) emailDisplay.textContent = email;
    if (profilePicDiv) profilePicDiv.textContent = displayName.charAt(0).toUpperCase() || '?';
    displayUserBadges(profileData); displayStats(statsData);
    const isOwnProfile = loggedInUser && loggedInUser.uid === profileData.id;
    if (isBanned) {
        console.log("Applying banned styles for user:", profileData.id);
        if (profileContainer) profileContainer.classList.add('is-banned');
        if (banOverlay) banOverlay.style.display = 'block';
        if (banReasonDisplay && banReason) { banReasonDisplay.textContent = `Reason: ${escapeHtml(banReason)}`; banReasonDisplay.style.display = 'block'; }
        updateProfileTitlesAndRank(null, false); closeTitleSelector();
    } else { updateProfileTitlesAndRank(profileData, isOwnProfile); }
    if (profileLogoutBtn) { profileLogoutBtn.style.display = isOwnProfile ? 'inline-block' : 'none'; }
}

// --- Check and Grant Achievements ---
async function checkAndGrantAchievements(userId, currentUserProfile, currentUserStats) {
    // ... (Keep the function content from the previous full script) ...
    if (!allAchievements || !userId || !currentUserProfile || !currentUserStats) { console.warn("Skipping achievement check due to missing data."); return null; }
    console.log(`Checking achievements for UID ${userId}`);
    try {
        const userAchievementsRef = db.collection('userAchievements').doc(userId);
        const userAchievementsDoc = await userAchievementsRef.get();
        const unlockedIds = userAchievementsDoc.exists ? (userAchievementsDoc.data()?.unlocked || []) : [];
        let newAchievementsToUnlock = [], rewardsToApply = { titles: [], rank: null, rankPoints: 0 }, needsDbUpdate = false;
        for (const achievementId in allAchievements) {
             if (unlockedIds.includes(achievementId)) continue;
             const achievement = allAchievements[achievementId]; let criteriaMet = false;
             if (achievement.criteria?.stat && currentUserStats[achievement.criteria.stat] !== undefined) {
                 const statValue = currentUserStats[achievement.criteria.stat], requiredValue = achievement.criteria.value;
                 switch (achievement.criteria.operator) {
                     case '>=': criteriaMet = statValue >= requiredValue; break; case '<=': criteriaMet = statValue <= requiredValue; break;
                     case '==': criteriaMet = statValue == requiredValue; break; case '>':  criteriaMet = statValue > requiredValue; break;
                     case '<':  criteriaMet = statValue < requiredValue; break; default: console.warn(`Unknown operator ${achievement.criteria.operator}`); }
             } else if (achievement.criteria) { console.warn(`Criteria invalid/missing stat for ${achievementId}`); }
             if (criteriaMet) {
                 console.log(`Criteria MET for achievement: ${achievement.name || achievementId}`);
                 newAchievementsToUnlock.push(achievementId); needsDbUpdate = true;
                 if (achievement.rewards?.title) rewardsToApply.titles.push(achievement.rewards.title);
                 if (achievement.rewards?.rank) rewardsToApply.rank = achievement.rewards.rank;
                 if (achievement.rewards?.rankPoints) rewardsToApply.rankPoints += achievement.rewards.rankPoints;
             }
        }
        if (needsDbUpdate && newAchievementsToUnlock.length > 0) {
            console.log(`Unlocking ${newAchievementsToUnlock.length} new achievements:`, newAchievementsToUnlock);
            const batch = db.batch(); const userProfileRef = db.collection('users').doc(userId);
            batch.set(userAchievementsRef, { unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsToUnlock) }, { merge: true });
            const profileUpdateData = {}; let updatedLocalProfile = { ...currentUserProfile };
            if (rewardsToApply.titles.length > 0) {
                 profileUpdateData.availableTitles = firebase.firestore.FieldValue.arrayUnion(...rewardsToApply.titles);
                 updatedLocalProfile.availableTitles = [...new Set([...(updatedLocalProfile.availableTitles || []), ...rewardsToApply.titles])];
                 if (!updatedLocalProfile.equippedTitle) {
                     const titleToEquip = rewardsToApply.titles[0]; profileUpdateData.equippedTitle = titleToEquip;
                     updatedLocalProfile.equippedTitle = titleToEquip; console.log(`Auto-equipping title: ${titleToEquip}`); }
            }
            if (rewardsToApply.rank) { profileUpdateData.currentRank = rewardsToApply.rank; updatedLocalProfile.currentRank = rewardsToApply.rank; }
            if (rewardsToApply.rankPoints > 0) { console.warn("Rank point rewards not implemented yet."); }
             if (!updatedLocalProfile.currentRank) { profileUpdateData.currentRank = 'Unranked'; updatedLocalProfile.currentRank = 'Unranked'; }
             if (!updatedLocalProfile.equippedTitle && !profileUpdateData.equippedTitle) { profileUpdateData.equippedTitle = ''; updatedLocalProfile.equippedTitle = ''; }
            let committedProfileUpdate = false; if (Object.keys(profileUpdateData).length > 0) { batch.update(userProfileRef, profileUpdateData); committedProfileUpdate = true; }
            await batch.commit(); console.log(`Firestore committed achievements batch for UID ${userId}. Profile updated: ${committedProfileUpdate}`);
            return committedProfileUpdate ? updatedLocalProfile : null;
        } else { return null; }
    } catch (error) { console.error(`Error check/grant achievements for UID ${userId}:`, error); return null; }
}

// --- Display Stats Grid ---
function displayStats(statsData) {
    // ... (Keep the function content from the previous full script) ...
    if (!statsDisplay) return; statsDisplay.innerHTML = '';
    if (!statsData || typeof statsData !== 'object' || Object.keys(statsData).length === 0) { statsDisplay.innerHTML = '<p>Leaderboard stats not available for this user.</p>'; return; }
    const statsToShow = [ { key: 'wins', label: 'Wins' }, { key: 'points', label: 'Points' }, { key: 'kdRatio', label: 'K/D Ratio', format: (v) => typeof v==='number'?v.toFixed(2):v }, { key: 'matchesPlayed', label: 'Matches Played', fallbackKey: 'matches'}, { key: 'losses', label: 'Losses' } ];
    let itemsAdded = 0; statsToShow.forEach(s => { const k=s.key, f=s.fallbackKey; let v = (statsData[k] !== undefined && statsData[k] !== null)?statsData[k] : (f && statsData[f] !== undefined && statsData[f] !== null)?statsData[f] : '-'; const fv = s.format ? s.format(v) : v; statsDisplay.appendChild(createStatItem(s.label, fv)); itemsAdded++; });
    if (itemsAdded === 0) { statsDisplay.innerHTML = '<p>No specific leaderboard stats found to display.</p>'; }
}


// --- Helper: Create a Single Stat Item Element ---
function createStatItem(title, value) {
    // ... (Keep the function content from the previous full script) ...
    const d=document.createElement('div'); d.classList.add('stat-item'); const h=document.createElement('h4'); h.textContent=title; const p=document.createElement('p'); p.textContent = (value !== null && value !== undefined) ? escapeHtml(value) : '-'; d.appendChild(h); d.appendChild(p); return d;
}

// --- Helper: Update Profile Rank/Title Display ---
function updateProfileTitlesAndRank(profileData, allowInteraction) {
    // ... (Keep the function content from the previous full script) ...
    if (!rankDisplay || !titleDisplay) { console.warn("Rank/Title element missing."); return; }
    titleDisplay.classList.remove('selectable-title'); titleDisplay.removeEventListener('click', handleTitleClick);
    if (profileData && typeof profileData === 'object') {
        const rank = profileData.currentRank || 'Unranked'; const title = profileData.equippedTitle || ''; const availableTitles = profileData.availableTitles || [];
        rankDisplay.textContent = rank; rankDisplay.className = `profile-rank-display rank-${rank.toLowerCase().replace(/\s+/g, '-')}`;
        if (title) { titleDisplay.textContent = escapeHtml(title); titleDisplay.style.display = 'inline-block'; if (allowInteraction && availableTitles.length > 0) { titleDisplay.classList.add('selectable-title'); titleDisplay.addEventListener('click', handleTitleClick); }
        } else { titleDisplay.textContent = ''; titleDisplay.style.display = 'none'; }
    } else { rankDisplay.textContent = '---'; rankDisplay.className = 'profile-rank-display rank-unranked'; titleDisplay.textContent = ''; titleDisplay.style.display = 'none'; closeTitleSelector(); }
}


// --- Handle Clicks on the Equipped Title ---
function handleTitleClick(event) {
    // ... (Keep the function content from the previous full script) ...
    event.stopPropagation();
    if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id || viewingUserProfileData.isBanned) { console.log("Title interaction blocked."); return; }
    if (isTitleSelectorOpen) { closeTitleSelector(); } else if (viewingUserProfileData.profile?.availableTitles?.length > 0) { openTitleSelector(); } else { console.log("No available titles."); }
}

// --- Open Title Selector Dropdown ---
function openTitleSelector() {
    // ... (Keep the function content from the previous full script) ...
     if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id || viewingUserProfileData.isBanned) return;
    if (isTitleSelectorOpen || !profileIdentifiersDiv || !viewingUserProfileData.profile?.availableTitles?.length > 0) return;
    const availableTitles = viewingUserProfileData.profile.availableTitles, currentEquippedTitle = viewingUserProfileData.profile.equippedTitle || '';
    if (!titleSelectorElement) { titleSelectorElement = document.createElement('div'); titleSelectorElement.className = 'title-selector'; profileIdentifiersDiv.appendChild(titleSelectorElement); }
    titleSelectorElement.innerHTML = '';
    if (currentEquippedTitle) { const r=document.createElement('button'); r.className='title-option remove-title-option'; r.dataset.title=""; r.type='button'; r.textContent='(Remove Title)'; r.setAttribute('aria-pressed','false'); r.addEventListener('click',handleTitleOptionClick); titleSelectorElement.appendChild(r); }
    availableTitles.forEach(t => { const o=document.createElement('button'); o.className='title-option'; o.dataset.title=t; o.type='button'; o.textContent=escapeHtml(t); if(t===currentEquippedTitle){ o.classList.add('currently-equipped'); o.setAttribute('aria-pressed','true');} else { o.setAttribute('aria-pressed','false');} o.addEventListener('click', handleTitleOptionClick); titleSelectorElement.appendChild(o); });
    titleSelectorElement.style.display = 'block'; isTitleSelectorOpen = true;
    setTimeout(() => { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }, 0);
}


// --- Close Title Selector Dropdown ---
function closeTitleSelector() {
    // ... (Keep the function content from the previous full script) ...
    if (!isTitleSelectorOpen || !titleSelectorElement) return;
    titleSelectorElement.style.display = 'none'; isTitleSelectorOpen = false;
    document.removeEventListener('click', handleClickOutsideTitleSelector, { capture: true });
}

// --- Handle Clicks Outside the Selector ---
function handleClickOutsideTitleSelector(event) {
    // ... (Keep the function content from the previous full script) ...
     if (!isTitleSelectorOpen) return;
    const isClickInsideSelector = titleSelectorElement && titleSelectorElement.contains(event.target);
    const isClickOnTitleDisplay = titleDisplay && titleDisplay.contains(event.target);
    if (!isClickInsideSelector && !isClickOnTitleDisplay) { closeTitleSelector(); }
    else { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }
}


// --- Handle Clicks on a Title Option in the Dropdown ---
async function handleTitleOptionClick(event) {
    // ... (Keep the function content from the previous full script) ...
    event.stopPropagation(); const selectedTitle = event.currentTarget.dataset.title; const currentUserId = loggedInUser?.uid; const currentlyViewedProfile = viewingUserProfileData.profile;
    if (!currentUserId || !currentlyViewedProfile || currentUserId !== currentlyViewedProfile.id || viewingUserProfileData.isBanned) { console.error("Title change blocked."); closeTitleSelector(); return; }
    const currentEquipped = currentlyViewedProfile.equippedTitle || ''; if (selectedTitle === currentEquipped) { closeTitleSelector(); return; }
    closeTitleSelector(); if (titleDisplay) { titleDisplay.textContent = "Updating..."; titleDisplay.classList.remove('selectable-title'); titleDisplay.removeEventListener('click', handleTitleClick); }
    try { const userProfileRef = db.collection('users').doc(currentUserId); await userProfileRef.update({ equippedTitle: selectedTitle }); console.log(`Firestore updated title to "${selectedTitle}" for UID ${currentUserId}`); viewingUserProfileData.profile.equippedTitle = selectedTitle; saveCombinedDataToCache(currentUserId, viewingUserProfileData); updateProfileTitlesAndRank(viewingUserProfileData.profile, true); }
    catch (error) { console.error("Error updating equipped title:", error); alert("Failed to update title."); if (viewingUserProfileData.profile) { viewingUserProfileData.profile.equippedTitle = currentEquipped; } updateProfileTitlesAndRank(viewingUserProfileData.profile, true); }
}


// --- Logout Button Event Listener ---
if (profileLogoutBtn) {
    // ... (Keep the function content from the previous full script) ...
     profileLogoutBtn.addEventListener('click', () => { const userId = loggedInUser?.uid; if (titleDisplay) titleDisplay.removeEventListener('click', handleTitleClick); closeTitleSelector();
        auth.signOut().then(() => { console.log('User signed out.'); if (userId) { localStorage.removeItem(`poxelProfileCombinedData_${userId}`); console.log(`Cleared cache for UID: ${userId}`); } viewingUserProfileData = {}; }).catch((error) => { console.error('Sign out error:', error); alert('Error signing out.'); });
    });
} else { console.warn("Logout button not found."); }

// --- Initial log ---
console.log("Profile script initialized.");
