// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI",
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

// --- URL Parameter Parsing & Logged-in User Check ---
const urlParams = new URLSearchParams(window.location.search);
const profileUidFromUrl = urlParams.get('uid');
let loggedInUser = auth.currentUser;

// --- Admin Emails ---
const adminEmails = [
    'trixdesignsofficial@gmail.com',
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
const profileContent = document.getElementById('profile-content');
const loadingIndicator = document.getElementById('loading-profile');
const notLoggedInMsg = document.getElementById('not-logged-in');
const profilePicDiv = document.getElementById('profile-pic');
const usernameDisplay = document.getElementById('profile-username');
const emailDisplay = document.getElementById('profile-email');
const competitiveStatsDisplay = document.getElementById('stats-display'); // Renamed for clarity
const profileLogoutBtn = document.getElementById('profile-logout-btn');
const adminTag = document.getElementById('admin-tag');
const rankDisplay = document.getElementById('profile-rank');
const titleDisplay = document.getElementById('profile-title');
const profileIdentifiersDiv = document.querySelector('.profile-identifiers');
const profileBadgesContainer = document.getElementById('profile-badges-container');
// --- NEW Poxel Stats Elements ---
const poxelStatsSection = document.getElementById('poxel-stats-section');
const poxelStatsDisplay = document.getElementById('poxel-stats-display');

// --- Global/Scoped Variables ---
let allAchievements = null;
let viewingUserProfileData = {};
let isTitleSelectorOpen = false;
let titleSelectorElement = null;

// -----------------------------------------------------------------------------
// --- CORE FUNCTIONS ---
// -----------------------------------------------------------------------------

// --- Fetch Poxel.io Stats from API ---
async function fetchPoxelStats(username) {
  // Validate username
  if (!username || typeof username !== 'string' || username.trim() === '') {
      console.warn("fetchPoxelStats: Invalid username provided.");
      return null;
  }
  console.log(`Fetching Poxel.io stats for: ${username}`);
  try {
    // Using the provided endpoint structure
    const apiUrl = `https://dev-usa-1.poxel.io/api/profile/stats/${encodeURIComponent(username)}`;
    const res = await fetch(apiUrl, {
      headers: { "Content-Type": "application/json" } // Header might not be strictly needed for GET but good practice
    });

    // Check for network errors or non-successful HTTP status codes
    if (!res.ok) {
        // Try to get error details from response body if possible
        let errorMsg = `HTTP error ${res.status}`;
        try {
            const errorData = await res.json();
            errorMsg = errorData.message || errorData.error || errorMsg; // Use message from API if available
        } catch (parseError) {
            // Ignore if response body isn't JSON or empty
        }
        throw new Error(errorMsg);
    }

    const data = await res.json();
    console.log("Poxel.io API Stats Received:", data);

    // Basic validation of returned data (adjust as needed based on actual API response)
    if (typeof data !== 'object' || data === null) {
        throw new Error("Invalid data format received from Poxel.io API.");
    }
    // Check for potential error structure within a 200 OK response
    if (data.error || data.status === 'error') {
         throw new Error(data.message || 'API returned an error status.');
    }

    return data; // Return the valid stats data

  } catch (e) {
    console.error("Error fetching Poxel.io stats:", e.message || e);
    return null; // Return null on any fetch error
  }
}

// --- Fetch all achievement definitions ---
async function fetchAllAchievements() {
    // ... (keep existing code)
     if (allAchievements) return allAchievements; try { const snapshot = await db.collection('achievements').get(); allAchievements = {}; snapshot.forEach(doc => { allAchievements[doc.id] = { id: doc.id, ...doc.data() }; }); console.log("Fetched achievement definitions:", allAchievements); return allAchievements; } catch (error) { console.error("Error fetching achievement definitions:", error); return null; }
}

// --- Helper: Compare Leaderboard Stats ---
function areStatsDifferent(newStats, existingProfileStats) {
    // ... (keep existing code)
     const normNew = newStats || {}; const normExisting = existingProfileStats || {}; const statKeys = ['wins', 'points', 'kdRatio', 'matchesPlayed', 'matches', 'losses']; let different = false; for (const key of statKeys) { const newValue = normNew[key] ?? null; const existingValue = normExisting[key] ?? null; if (key === 'kdRatio' && typeof newValue === 'number' && typeof existingValue === 'number') { if (Math.abs(newValue - existingValue) > 0.001) { different = true; break; } } else if (newValue !== existingValue) { different = true; break; } } if (!different) { const newRelevantKeys = Object.keys(normNew).filter(k => statKeys.includes(k)); const existingRelevantKeys = Object.keys(normExisting).filter(k => statKeys.includes(k)); if (newRelevantKeys.length !== existingRelevantKeys.length) { different = true; } else { const newSet = new Set(newRelevantKeys); if (!existingRelevantKeys.every(key => newSet.has(key))) { different = true; } } } return different;
}

// --- Helper Function: Client-Side User Profile Document Creation ---
async function createUserProfileDocument(userId, authUser) {
    // ... (keep existing code)
     console.warn(`Client-side: Creating missing user profile doc for UID: ${userId}`); const userDocRef = db.collection("users").doc(userId); const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`; const defaultProfileData = { email: authUser.email || null, displayName: displayName, currentRank: "Unranked", equippedTitle: "", availableTitles: [], friends: [], createdAt: firebase.firestore.FieldValue.serverTimestamp(), leaderboardStats: {} }; try { await userDocRef.set(defaultProfileData, { merge: true }); console.log(`Successfully created/merged user profile document for UID: ${userId} via client`); return { id: userId, ...defaultProfileData }; } catch (error) { console.error(`Error creating user profile document client-side for UID ${userId}:`, error); alert("Error setting up your profile details. Please check your connection or contact support if the issue persists."); return null; }
}

// --- Load Combined User Data (Profile + Leaderboard Stats) ---
// <<< MODIFIED: To also fetch and trigger display of Poxel.io Stats >>>
async function loadCombinedUserData(targetUserId) {
    console.log(`Loading combined user data for TARGET UID: ${targetUserId}`);

    // Clear previous Poxel stats and show loading
    displayPoxelStats(null, true); // Shows loading message

    const cacheLoaded = loadCombinedDataFromCache(targetUserId); // Tries to display cached data first
    if (!cacheLoaded) {
        competitiveStatsDisplay.innerHTML = '<p>Loading competitive stats...</p>'; // Use renamed var
        updateProfileTitlesAndRank(null, false);
    }

    const userProfileRef = db.collection('users').doc(targetUserId);
    const leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId);

    try {
        // 1. Fetch User Profile Data
        let profileSnap = await userProfileRef.get();
        let profileData = null;

        // ... (keep existing profile fetch/create logic) ...
        if (!profileSnap || !profileSnap.exists) { console.warn(`User profile document does NOT exist for UID: ${targetUserId}`); if (loggedInUser && loggedInUser.uid === targetUserId) { profileData = await createUserProfileDocument(targetUserId, loggedInUser); if (!profileData) throw new Error(`Profile creation failed for own UID ${targetUserId}.`); } else { console.error(`Cannot find profile for user UID: ${targetUserId}`); displayProfileData(null, null); competitiveStatsDisplay.innerHTML = '<p>Profile not found.</p>'; displayPoxelStats(null); /* Clear poxel section too */ return; } } else { profileData = { id: profileSnap.id, ...profileSnap.data() }; if (profileData.leaderboardStats === undefined) profileData.leaderboardStats = {}; }


        // 2. Fetch Leaderboard Stats Data (Competitive)
        const statsSnap = await leaderboardStatsRef.get();
        const competitiveStatsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null; // Renamed for clarity

        // 3. Sync Competitive Stats to Profile Document if needed
        // ... (keep existing sync logic using competitiveStatsData) ...
        if (profileData && competitiveStatsData) { if (areStatsDifferent(competitiveStatsData, profileData.leaderboardStats)) { console.log(`Competitive stats for UID ${targetUserId} differ from profile copy. Updating 'users' document.`); try { const statsToSave = { ...competitiveStatsData }; delete statsToSave.id; await userProfileRef.update({ leaderboardStats: statsToSave }); console.log(`Successfully updated 'users' doc for UID ${targetUserId} with new competitive stats.`); profileData.leaderboardStats = statsToSave; } catch (updateError) { console.error(`Error updating 'users' document with competitive stats for UID ${targetUserId}:`, updateError); } } else { console.log(`Competitive stats for UID ${targetUserId} match profile copy. No Firestore 'users' update needed.`); } } else if (profileData && !competitiveStatsData && Object.keys(profileData.leaderboardStats || {}).length > 0) { console.log(`User ${targetUserId} has competitive stats in profile but not found in current leaderboard. Keeping existing profile stats.`); }


        // 4. Update Global State (for profile and COMPETITIVE stats)
        viewingUserProfileData = {
            profile: profileData,
            stats: competitiveStatsData // Store competitive stats here
        };
        console.log("Final Profile Data being viewed:", viewingUserProfileData.profile);
        console.log("Final Competitive Stats Data being viewed:", viewingUserProfileData.stats);

        // 5. Display Core Profile & Competitive Stats, Cache
        // Uses the competitiveStatsData for the first grid
        displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats);
        saveCombinedDataToCache(targetUserId, viewingUserProfileData); // Cache combined data

        // 6. --- Fetch and Display Poxel.io Stats (asynchronously) ---
        if (profileData && profileData.displayName) {
            const poxelUsername = profileData.displayName; // Use the profile display name
            // Fetching happens after main profile display, doesn't block UI
            fetchPoxelStats(poxelUsername)
                .then(poxelStatsData => {
                    displayPoxelStats(poxelStatsData); // Display results or error message from API
                })
                .catch(poxelError => {
                    // Catch potential errors from fetchPoxelStats promise itself (though it should return null)
                    console.error("Caught error during Poxel.io fetch chain:", poxelError);
                    displayPoxelStats(null); // Display error state
                });
        } else {
             console.warn("No displayName found in profile data, cannot fetch Poxel.io stats.");
             displayPoxelStats(null); // Display error/unavailable state if no username
        }

        // 7. Check Achievements (uses competitive stats)
        // ... (keep existing achievement check logic using viewingUserProfileData.stats) ...
         if (loggedInUser && loggedInUser.uid === targetUserId && viewingUserProfileData.stats) { if (!allAchievements) await fetchAllAchievements(); if (allAchievements) { const potentiallyUpdatedProfile = await checkAndGrantAchievements( targetUserId, viewingUserProfileData.profile, viewingUserProfileData.stats ); if (potentiallyUpdatedProfile) { viewingUserProfileData.profile = potentiallyUpdatedProfile; displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats); saveCombinedDataToCache(targetUserId, viewingUserProfileData); console.log("UI/Cache updated post-achievement grant."); } } } else { if (!loggedInUser || loggedInUser.uid !== targetUserId) console.log("Skipping achievement check: Viewing another user's profile."); else if (!viewingUserProfileData.stats) console.log("Skipping achievement check: No competitive stats found for own profile."); }


    } catch (error) {
        console.error(`Error in loadCombinedUserData for TARGET UID ${targetUserId}:`, error);
        if (error.stack) console.error("DEBUG: Full error stack:", error.stack);
        if (!cacheLoaded) {
            profileContent.style.display = 'none';
            notLoggedInMsg.textContent = 'Error loading profile data. Please try again later.';
            notLoggedInMsg.style.display = 'flex';
            loadingIndicator.style.display = 'none';
            competitiveStatsDisplay.innerHTML = '<p>Error loading data.</p>';
            updateProfileTitlesAndRank(null, false);
            displayPoxelStats(null); // Ensure Poxel section is also cleared on main error
        } else {
            console.warn("Error fetching fresh data, displaying potentially stale cached view.");
            // Optionally: try to fetch poxel stats even if main fresh load failed, using cached name?
            if (viewingUserProfileData.profile?.displayName) {
                 fetchPoxelStats(viewingUserProfileData.profile.displayName)
                    .then(poxelStatsData => displayPoxelStats(poxelStatsData))
                    .catch(e => displayPoxelStats(null));
            } else {
                 displayPoxelStats(null); // Clear if cached profile also lacks name
            }
        }
    }
}

// --- Display Core Profile Data (No changes needed here) ---
function displayProfileData(profileData, competitiveStatsData) {
    // ... (keep existing code, ensure competitiveStatsData is passed to displayCompetitiveStats) ...
    if (!profileData) { usernameDisplay.textContent = "User Not Found"; emailDisplay.textContent = ""; profilePicDiv.textContent = "?"; adminTag.style.display = 'none'; profileBadgesContainer.innerHTML = ''; updateProfileTitlesAndRank(null, false); displayCompetitiveStats(null); /* Use renamed func */ return; }
    const displayName = profileData.displayName || 'Anonymous User'; const email = profileData.email || 'No email provided'; usernameDisplay.textContent = displayName; emailDisplay.textContent = email; profilePicDiv.textContent = displayName.charAt(0).toUpperCase(); /* profilePicDiv.style.backgroundColor = getUserColor(profileData.id); // Keep removed */ displayUserBadges(profileData); const isOwnProfile = loggedInUser && loggedInUser.uid === profileData.id; updateProfileTitlesAndRank(profileData, isOwnProfile);
    displayCompetitiveStats(competitiveStatsData); // Use renamed func
}

// --- Display COMPETITIVE Stats Grid ---
// Renamed from displayStats for clarity
function displayCompetitiveStats(statsData) {
    competitiveStatsDisplay.innerHTML = ''; // Use renamed var

    if (!statsData || typeof statsData !== 'object' || Object.keys(statsData).length === 0) {
        const noStatsPara = document.createElement('p');
        noStatsPara.textContent = 'Competitive stats unavailable for this user.';
        competitiveStatsDisplay.appendChild(noStatsPara);
        return;
    }
    // ... (keep the rest of the logic from the old displayStats function) ...
     const statsMap = { wins: 'Wins', points: 'Points', kdRatio: 'K/D Ratio', matchesPlayed: 'Matches Played', matches: 'Matches Played', losses: 'Losses' }; let statsAdded = 0; const addedKeys = new Set(); for (const key in statsMap) { let value; let actualKeyUsed = key; if (key === 'matchesPlayed') { if (statsData.hasOwnProperty('matchesPlayed')) { value = statsData.matchesPlayed; } else if (statsData.hasOwnProperty('matches')) { value = statsData.matches; actualKeyUsed = 'matches'; } } else { value = statsData[key]; } if (value === undefined || addedKeys.has(actualKeyUsed)) { continue; } let displayValue = value; if (key === 'kdRatio' && typeof value === 'number') { displayValue = value.toFixed(2); } competitiveStatsDisplay.appendChild(createStatItem(statsMap[key], displayValue)); addedKeys.add(actualKeyUsed); statsAdded++; } if (statsAdded === 0) { const noStatsPara = document.createElement('p'); noStatsPara.textContent = 'No specific competitive stats found.'; competitiveStatsDisplay.appendChild(noStatsPara); }
}


// --- NEW: Display Poxel.io Stats Grid ---
function displayPoxelStats(poxelData, loading = false) {
    if (!poxelStatsDisplay || !poxelStatsSection) {
        console.error("Poxel stats container elements not found!");
        return;
    }

    poxelStatsDisplay.innerHTML = ''; // Clear previous content

    if (loading) {
        poxelStatsSection.style.display = 'block'; // Show section
        poxelStatsDisplay.innerHTML = '<p>Loading Poxel.io stats...</p>';
        return;
    }

    if (!poxelData) {
         poxelStatsSection.style.display = 'block'; // Show section for the message
         poxelStatsDisplay.innerHTML = '<p>Could not load Poxel.io stats for this user.</p>';
         return;
    }

    // NOTE: Adjust the keys ('kills', 'deaths', etc.) based on the ACTUAL response
    // structure you get from fetchPoxelStats("lizakh") or another valid user.
    // Inspect the console log from fetchPoxelStats to confirm the names.
    const statsMap = {
         kills: 'Kills',
         deaths: 'Deaths',
         wins: 'Wins',
         losses: 'Losses',
         level: 'Level',
         playtimeHours: 'Playtime (Hours)', // Example, check if API provides this
         gamesPlayed: 'Games Played'        // Example
         // Add more fields from the API response as desired
    };

    let statsAdded = 0;
    for (const key in statsMap) {
         // Use hasOwnProperty for safety, especially if API response might vary
         if (poxelData.hasOwnProperty(key) && poxelData[key] !== null && poxelData[key] !== undefined) {
             let value = poxelData[key];
             // Optional formatting can go here (e.g., Number(value).toLocaleString())
             poxelStatsDisplay.appendChild(createStatItem(statsMap[key], value));
             statsAdded++;
         }
    }

     // Calculate K/D Ratio specifically if kills and deaths exist
     if (poxelData.hasOwnProperty('kills') && poxelData.hasOwnProperty('deaths')) {
         const kills = Number(poxelData.kills) || 0;
         const deaths = Number(poxelData.deaths) || 0;
         const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2); // Avoid NaN/Infinity
         poxelStatsDisplay.appendChild(createStatItem('K/D Ratio', kd));
         statsAdded++;
     }

    if (statsAdded > 0) {
        poxelStatsSection.style.display = 'block'; // Show section if stats were added
    } else {
        // If API call was successful but no relevant stats found in our map
         poxelStatsSection.style.display = 'block';
         poxelStatsDisplay.innerHTML = '<p>No relevant Poxel.io stats found or available for this user.</p>';
    }
}


// --- Helper: Create a Single Stat Item Element (Used by both grids) ---
function createStatItem(title, value) {
    // ... (keep existing code) ...
    const itemDiv = document.createElement('div'); itemDiv.classList.add('stat-item'); const titleH4 = document.createElement('h4'); titleH4.textContent = title; const valueP = document.createElement('p'); valueP.textContent = (value !== null && value !== undefined) ? value : '-'; itemDiv.appendChild(titleH4); itemDiv.appendChild(valueP); return itemDiv;
}

// --- Check and Grant Achievements (uses competitive stats) ---
async function checkAndGrantAchievements(userId, currentUserProfile, competitiveStats) {
    // Pass competitiveStats (viewingUserProfileData.stats) here
    // ... (keep existing achievement logic, ensure it uses the correct stats variable) ...
     if (!allAchievements || !userId || !currentUserProfile || !competitiveStats) { console.log("Skipping achievement check due to missing data."); return null; } console.log(`Checking achievements for UID ${userId} using competitive stats:`, competitiveStats); try { const userAchievementsRef = db.collection('userAchievements').doc(userId); const userAchievementsDoc = await userAchievementsRef.get(); const unlockedIds = userAchievementsDoc.exists ? (userAchievementsDoc.data()?.unlocked || []) : []; let newAchievementsUnlocked = []; let rewardsToApply = { titles: [], rank: null, rankPoints: 0 }; let needsDbUpdate = false; for (const achievementId in allAchievements) { if (unlockedIds.includes(achievementId)) continue; const achievement = allAchievements[achievementId]; let criteriaMet = false; if (achievement.criteria?.stat && competitiveStats[achievement.criteria.stat] !== undefined) { const statValue = competitiveStats[achievement.criteria.stat]; const targetValue = achievement.criteria.value; switch (achievement.criteria.operator) { case '>=': criteriaMet = statValue >= targetValue; break; case '<=': criteriaMet = statValue <= targetValue; break; case '==': criteriaMet = statValue == targetValue; break; default: console.warn(`Unknown operator ${achievement.criteria.operator}`); } } if (criteriaMet) { console.log(`Criteria MET for achievement: ${achievement.name || achievementId}`); newAchievementsUnlocked.push(achievementId); needsDbUpdate = true; if (achievement.rewards?.title) rewardsToApply.titles.push(achievement.rewards.title); if (achievement.rewards?.rank) rewardsToApply.rank = achievement.rewards.rank; if (achievement.rewards?.rankPoints) rewardsToApply.rankPoints += achievement.rewards.rankPoints; } } if (needsDbUpdate && newAchievementsUnlocked.length > 0) { console.log(`Unlocking ${newAchievementsUnlocked.length} new achievement(s):`, newAchievementsUnlocked); console.log("Applying rewards:", rewardsToApply); const batch = db.batch(); const userProfileRef = db.collection('users').doc(userId); batch.set(userAchievementsRef, { unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsUnlocked) }, { merge: true }); const profileUpdateData = {}; let updatedLocalProfile = { ...currentUserProfile }; if (rewardsToApply.titles.length > 0) { profileUpdateData.availableTitles = firebase.firestore.FieldValue.arrayUnion(...rewardsToApply.titles); updatedLocalProfile.availableTitles = [...new Set([...(updatedLocalProfile.availableTitles || []), ...rewardsToApply.titles])]; if (!updatedLocalProfile.equippedTitle && rewardsToApply.titles[0]) { profileUpdateData.equippedTitle = rewardsToApply.titles[0]; updatedLocalProfile.equippedTitle = rewardsToApply.titles[0]; } } if (rewardsToApply.rank) { profileUpdateData.currentRank = rewardsToApply.rank; updatedLocalProfile.currentRank = rewardsToApply.rank; } if (!updatedLocalProfile.currentRank) { profileUpdateData.currentRank = 'Unranked'; updatedLocalProfile.currentRank = 'Unranked'; } if (updatedLocalProfile.equippedTitle === undefined) { profileUpdateData.equippedTitle = ''; updatedLocalProfile.equippedTitle = ''; } if (Object.keys(profileUpdateData).length > 0) { batch.update(userProfileRef, profileUpdateData); } await batch.commit(); console.log(`Firestore batch committed successfully for UID ${userId}.`); return updatedLocalProfile; } else { console.log(`No new achievements unlocked for UID ${userId}.`); return null; } } catch (error) { console.error(`Error checking/granting achievements for UID ${userId}:`, error); return null; }
}


// -----------------------------------------------------------------------------
// --- UI Display Helpers (Badges, Rank/Title Selector) ---
// -----------------------------------------------------------------------------
function displayUserBadges(profileData) { /* ... Keep existing ... */ profileBadgesContainer.innerHTML = ''; const userEmail = profileData?.email; if (!userEmail) { adminTag.style.display = 'none'; return; } const emailLower = userEmail.toLowerCase(); adminTag.style.display = adminEmails.includes(emailLower) ? 'inline-block' : 'none'; for (const badgeType in badgeConfig) { const config = badgeConfig[badgeType]; if (config.emails.includes(emailLower)) { const badgeSpan = document.createElement('span'); badgeSpan.classList.add('profile-badge', config.className); badgeSpan.setAttribute('title', config.title); profileBadgesContainer.appendChild(badgeSpan); } } }
function updateProfileTitlesAndRank(profileData, allowInteraction) { /* ... Keep existing ... */ if (!rankDisplay || !titleDisplay) return; titleDisplay.classList.remove('selectable-title', 'no-title-placeholder'); titleDisplay.removeEventListener('click', handleTitleClick); closeTitleSelector(); if (profileData && typeof profileData === 'object') { const rank = profileData.currentRank || 'Unranked'; const title = profileData.equippedTitle || ''; const available = profileData.availableTitles || []; rankDisplay.textContent = rank; rankDisplay.className = `profile-rank-display rank-${rank.toLowerCase().replace(/\s+/g, '-')}`; if (title) { titleDisplay.textContent = title; titleDisplay.style.display = 'inline-block'; if (allowInteraction && available.length > 0) { titleDisplay.classList.add('selectable-title'); titleDisplay.addEventListener('click', handleTitleClick); } } else { if (allowInteraction && available.length > 0) { titleDisplay.textContent = '[Choose Title]'; titleDisplay.style.display = 'inline-block'; titleDisplay.classList.add('selectable-title', 'no-title-placeholder'); titleDisplay.addEventListener('click', handleTitleClick); } else { titleDisplay.textContent = ''; titleDisplay.style.display = 'none'; } } } else { rankDisplay.textContent = '...'; rankDisplay.className = 'profile-rank-display rank-unranked'; titleDisplay.textContent = ''; titleDisplay.style.display = 'none'; } }
function handleTitleClick(event) { /* ... Keep existing ... */ event.stopPropagation(); if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id) return; if (isTitleSelectorOpen) { closeTitleSelector(); } else if (viewingUserProfileData.profile?.availableTitles?.length > 0) { openTitleSelector(); } else { console.log("No available titles to select."); } }
function openTitleSelector() { /* ... Keep existing ... */ if (isTitleSelectorOpen || !profileIdentifiersDiv || !viewingUserProfileData.profile?.availableTitles?.length > 0) return; const availableTitles = viewingUserProfileData.profile.availableTitles; const currentEquippedTitle = viewingUserProfileData.profile.equippedTitle || ''; if (!titleSelectorElement) { titleSelectorElement = document.createElement('div'); titleSelectorElement.className = 'title-selector'; profileIdentifiersDiv.appendChild(titleSelectorElement); } titleSelectorElement.innerHTML = ''; if (currentEquippedTitle) { const unequipOption = document.createElement('button'); unequipOption.className = 'title-option title-option-unequip'; unequipOption.dataset.title = ""; unequipOption.type = 'button'; unequipOption.textContent = '[Remove Title]'; unequipOption.addEventListener('click', handleTitleOptionClick); titleSelectorElement.appendChild(unequipOption); } availableTitles.forEach(titleOptionText => { const optionElement = document.createElement('button'); optionElement.className = 'title-option'; optionElement.dataset.title = titleOptionText; optionElement.type = 'button'; optionElement.textContent = titleOptionText; if (titleOptionText === currentEquippedTitle) { optionElement.classList.add('currently-equipped'); optionElement.setAttribute('aria-pressed', 'true'); } else { optionElement.setAttribute('aria-pressed', 'false'); } optionElement.addEventListener('click', handleTitleOptionClick); titleSelectorElement.appendChild(optionElement); }); titleSelectorElement.style.display = 'block'; isTitleSelectorOpen = true; setTimeout(() => { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }, 0); }
function closeTitleSelector() { /* ... Keep existing ... */ if (!isTitleSelectorOpen || !titleSelectorElement) return; titleSelectorElement.style.display = 'none'; isTitleSelectorOpen = false; document.removeEventListener('click', handleClickOutsideTitleSelector, { capture: true }); }
function handleClickOutsideTitleSelector(event) { /* ... Keep existing ... */ if (!isTitleSelectorOpen) return; const clickedInsideSelector = titleSelectorElement && titleSelectorElement.contains(event.target); const clickedOnTitleDisplay = titleDisplay && titleDisplay.contains(event.target); if (clickedInsideSelector || clickedOnTitleDisplay) { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); return; } closeTitleSelector(); }
async function handleTitleOptionClick(event) { /* ... Keep existing ... */ event.stopPropagation(); const selectedTitle = event.currentTarget.dataset.title; const currentUserId = loggedInUser?.uid; const currentlyViewedProfile = viewingUserProfileData.profile; if (!currentUserId || !currentlyViewedProfile || currentUserId !== currentlyViewedProfile.id) { console.error("Attempted to change title for wrong user."); closeTitleSelector(); return; } const currentEquipped = currentlyViewedProfile.equippedTitle || ''; if (selectedTitle === currentEquipped) { closeTitleSelector(); return; } closeTitleSelector(); titleDisplay.textContent = "Updating..."; titleDisplay.classList.remove('selectable-title', 'no-title-placeholder'); try { const userProfileRef = db.collection('users').doc(currentUserId); await userProfileRef.update({ equippedTitle: selectedTitle }); console.log(`Firestore 'users' doc updated title to "${selectedTitle || 'None'}" for UID ${currentUserId}`); viewingUserProfileData.profile.equippedTitle = selectedTitle; saveCombinedDataToCache(currentUserId, viewingUserProfileData); updateProfileTitlesAndRank(viewingUserProfileData.profile, true); } catch (error) { console.error("Error updating equipped title in Firestore 'users':", error); alert("Failed to update title."); if (viewingUserProfileData.profile) { viewingUserProfileData.profile.equippedTitle = currentEquipped; } updateProfileTitlesAndRank(viewingUserProfileData.profile, true); } }


// -----------------------------------------------------------------------------
// --- Authentication and Initialization ---
// -----------------------------------------------------------------------------
auth.onAuthStateChanged(user => {
    loggedInUser = user;
    const targetUid = profileUidFromUrl || loggedInUser?.uid;
    console.log(`Auth state changed. Logged in: ${!!user}, Target UID: ${targetUid}`);

    if (targetUid) {
        loadingIndicator.style.display = 'none';
        notLoggedInMsg.style.display = 'none';
        profileContent.style.display = 'block';

        fetchAllAchievements();
        loadCombinedUserData(targetUid); // This now handles both comp and poxel stats loading

        profileLogoutBtn.style.display = (loggedInUser && loggedInUser.uid === targetUid) ? 'inline-block' : 'none';
    } else {
        // No user logged in AND no UID in URL
        console.log('No user logged in and no profile UID in URL.');
        loadingIndicator.style.display = 'none';
        profileContent.style.display = 'none';
        notLoggedInMsg.style.display = 'flex';
        notLoggedInMsg.textContent = 'Please log in to view your profile, or provide a user ID in the URL (e.g., ?uid=USER_ID).';
        adminTag.style.display = 'none';
        profileBadgesContainer.innerHTML = '';
        profileLogoutBtn.style.display = 'none';
        updateProfileTitlesAndRank(null, false);
        competitiveStatsDisplay.innerHTML = ''; // Clear comp stats
        displayPoxelStats(null); // Clear poxel stats section
        viewingUserProfileData = {};
        closeTitleSelector();
    }
});

profileLogoutBtn.addEventListener('click', () => { /* ... Keep existing ... */ const userId = loggedInUser?.uid; if (titleDisplay) titleDisplay.removeEventListener('click', handleTitleClick); closeTitleSelector(); auth.signOut().then(() => { console.log('User signed out successfully.'); if (userId) { localStorage.removeItem(`poxelProfileCombinedData_${userId}`); console.log(`Cleared cache for UID: ${userId}`); } viewingUserProfileData = {}; window.location.href = 'index.html'; }).catch((error) => { console.error('Sign out error:', error); alert('Error signing out.'); }); });

// -----------------------------------------------------------------------------
// --- Local Storage Caching ---
// -----------------------------------------------------------------------------
function loadCombinedDataFromCache(viewedUserId) { /* ... Keep existing ... */ if (!viewedUserId) return false; const cacheKey = `poxelProfileCombinedData_${viewedUserId}`; const cachedDataString = localStorage.getItem(cacheKey); if (!cachedDataString) return false; try { const cachedData = JSON.parse(cachedDataString); if (cachedData && cachedData.profile) { viewingUserProfileData = cachedData; console.log("Loaded combined data from cache for VIEWED UID:", viewedUserId); displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats); return true; } else { localStorage.removeItem(cacheKey); return false; } } catch (error) { console.error("Error parsing cached data:", error); localStorage.removeItem(cacheKey); return false; } }
function saveCombinedDataToCache(viewedUserId, combinedData) { /* ... Keep existing ... */ if (!viewedUserId || !combinedData || !combinedData.profile) return; const cacheKey = `poxelProfileCombinedData_${viewedUserId}`; try { localStorage.setItem(cacheKey, JSON.stringify(combinedData)); } catch(error) { console.error("Error saving data to cache:", error); if (error.name === 'QuotaExceededError') console.warn('Browser storage quota exceeded. Cannot cache profile data.'); } }

// --- Initial Log ---
console.log("Profile script initialized. Waiting for Auth state...");
