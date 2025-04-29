// --- Firebase Configuration ---
// IMPORTANT: Replace with your actual Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI", // Replace with your real key
    authDomain: "poxelcomp.firebaseapp.com",
    projectId: "poxelcomp",
    storageBucket: "poxelcomp.firebasestorage.app",
    messagingSenderId: "620490990104",
    appId: "1:620490990104:web:709023eb464c7d886b996d",
};

// --- Initialize Firebase ---
// Use Compat version libraries as per the HTML script tags
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth(); // Compat Auth
const db = firebase.firestore(); // Compat Firestore

// --- URL Parameter Parsing & Logged-in User Check ---
const urlParams = new URLSearchParams(window.location.search);
const profileUidFromUrl = urlParams.get('uid');
let loggedInUser = auth.currentUser; // Check initial state (might be null)

// --- Admin Emails ---
const adminEmails = [
    'trixdesignsofficial@gmail.com',
    'jackdmbell@outlook.com',
    'myrrr@myrrr.myrrr'
].map(email => email.toLowerCase());

// --- Badge Configuration ---
const badgeConfig = {
    verified: {
        emails: ['jackdmbell@outlook.com', 'myrrr@myrrr.myrrr'].map(e => e.toLowerCase()),
        className: 'badge-verified',
        title: 'Verified' // Tooltip text
    },
    creator: {
        emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()),
        className: 'badge-creator',
        title: 'Content Creator' // Tooltip text
    },
    moderator: {
        emails: ['jackdmbell@outlook.com', 'mod_team@sample.org'].map(e => e.toLowerCase()),
        className: 'badge-moderator',
        title: 'Moderator' // Tooltip text
    }
    // Add more badge types if needed
};

// --- DOM Elements ---
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

// --- Global/Scoped Variables ---
let allAchievements = null; // Cache for achievement definitions
let viewingUserProfileData = {}; // Holds { profile: {...}, stats: {...} } for the user being viewed
let isTitleSelectorOpen = false;
let titleSelectorElement = null; // Reference to the dynamically created selector

// -----------------------------------------------------------------------------
// --- CORE FUNCTIONS ---
// -----------------------------------------------------------------------------

// --- Fetch all achievement definitions (with caching) ---
async function fetchAllAchievements() {
    if (allAchievements) return allAchievements;
    try {
        const snapshot = await db.collection('achievements').get();
        allAchievements = {};
        snapshot.forEach(doc => {
            allAchievements[doc.id] = { id: doc.id, ...doc.data() };
        });
        console.log("Fetched achievement definitions:", allAchievements);
        return allAchievements;
    } catch (error) {
        console.error("Error fetching achievement definitions:", error);
        return null;
    }
}

// --- Helper: Compare Leaderboard Stats ---
function areStatsDifferent(newStats, existingProfileStats) {
    // Normalize inputs: Treat null/undefined consistently
    const normNew = newStats || {};
    const normExisting = existingProfileStats || {};

    const statKeys = ['wins', 'points', 'kdRatio', 'matchesPlayed', 'matches', 'losses'];
    let different = false;

    for (const key of statKeys) {
        const newValue = normNew[key] ?? null;
        const existingValue = normExisting[key] ?? null;

        if (key === 'kdRatio' && typeof newValue === 'number' && typeof existingValue === 'number') {
            if (Math.abs(newValue - existingValue) > 0.001) {
                different = true;
                break;
            }
        } else if (newValue !== existingValue) {
            different = true;
            break;
        }
    }

    if (!different) {
        const newRelevantKeys = Object.keys(normNew).filter(k => statKeys.includes(k));
        const existingRelevantKeys = Object.keys(normExisting).filter(k => statKeys.includes(k));
        if (newRelevantKeys.length !== existingRelevantKeys.length) {
            different = true;
        } else {
            const newSet = new Set(newRelevantKeys);
            if (!existingRelevantKeys.every(key => newSet.has(key))) {
                different = true;
            }
        }
    }
    return different;
}


// --- Helper Function: Client-Side User Profile Document Creation ---
// (Called if profile.js loads and finds no document for the logged-in user)
async function createUserProfileDocument(userId, authUser) {
    console.warn(`Client-side: Creating missing user profile doc for UID: ${userId}`);
    const userDocRef = db.collection("users").doc(userId);
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;

    // Ensure this structure MATCHES the one created in auth.js on signup
    const defaultProfileData = {
        email: authUser.email || null,
        displayName: displayName,
        currentRank: "Unranked",
        equippedTitle: "",
        availableTitles: [],
        friends: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        leaderboardStats: {} // Initialize stats field
    };

    try {
        // Use set with merge:true to avoid overwriting if called unexpectedly
        await userDocRef.set(defaultProfileData, { merge: true });
        console.log(`Successfully created/merged user profile document for UID: ${userId} via client`);
        return { id: userId, ...defaultProfileData }; // Return the data structure
    } catch (error) {
        console.error(`Error creating user profile document client-side for UID ${userId}:`, error);
        alert("Error setting up your profile details. Please check your connection or contact support if the issue persists.");
        return null;
    }
}

// --- Load Combined User Data (Profile + Leaderboard Stats) ---
async function loadCombinedUserData(targetUserId) {
    console.log(`Loading combined user data for TARGET UID: ${targetUserId}`);

    const cacheLoaded = loadCombinedDataFromCache(targetUserId);
    if (!cacheLoaded) {
        statsDisplay.innerHTML = '<p>Loading stats...</p>';
        updateProfileTitlesAndRank(null, false);
    }

    const userProfileRef = db.collection('users').doc(targetUserId);
    const leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId);

    try {
        // 1. Fetch User Profile Data
        let profileSnap = await userProfileRef.get();
        let profileData = null;

        if (!profileSnap || !profileSnap.exists) {
            console.warn(`User profile document does NOT exist for UID: ${targetUserId}`);
            if (loggedInUser && loggedInUser.uid === targetUserId) {
                // If viewing own profile and it's missing, try creating it client-side
                profileData = await createUserProfileDocument(targetUserId, loggedInUser);
                if (!profileData) {
                    throw new Error(`Profile creation failed for own UID ${targetUserId}.`);
                }
            } else {
                // Viewing someone else's profile that doesn't exist
                console.error(`Cannot find profile for user UID: ${targetUserId}`);
                displayProfileData(null, null); // Show "User Not Found" UI state
                statsDisplay.innerHTML = '<p>Profile not found.</p>';
                return; // Stop processing for this user
            }
        } else {
            // Profile exists
            profileData = { id: profileSnap.id, ...profileSnap.data() };
            // Ensure leaderboardStats field exists locally for consistency, even if missing in Firestore
            if (profileData.leaderboardStats === undefined) {
                profileData.leaderboardStats = {};
            }
        }

        // 2. Fetch Leaderboard Stats Data
        const statsSnap = await leaderboardStatsRef.get();
        const statsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null;

        // 3. Sync Leaderboard Stats to User Profile Document if needed
        if (profileData && statsData) {
            if (areStatsDifferent(statsData, profileData.leaderboardStats)) {
                console.log(`Leaderboard stats for UID ${targetUserId} differ from profile copy. Updating 'users' document.`);
                try {
                    const statsToSave = { ...statsData };
                    delete statsToSave.id; // Don't save the doc ID within the field
                    await userProfileRef.update({ leaderboardStats: statsToSave });
                    console.log(`Successfully updated 'users' doc for UID ${targetUserId} with new stats.`);
                    // Update local profileData immediately to reflect the change
                    profileData.leaderboardStats = statsToSave;
                } catch (updateError) {
                    console.error(`Error updating 'users' document with stats for UID ${targetUserId}:`, updateError);
                }
            } else {
                 console.log(`Leaderboard stats for UID ${targetUserId} match profile copy. No Firestore 'users' update needed.`);
            }
        } else if (profileData && !statsData && Object.keys(profileData.leaderboardStats || {}).length > 0) {
             // Optional: Handle case where user HAD stats but now doesn't
             console.log(`User ${targetUserId} has stats in profile but not found in current leaderboard. Keeping existing profile stats.`);
             // Could add logic here to clear profileData.leaderboardStats and update Firestore if desired
        }

        // 4. Update Global State
        viewingUserProfileData = {
            profile: profileData, // Profile data (potentially updated with synced stats)
            stats: statsData      // Fresh leaderboard stats (or null if none)
        };
        console.log("Final Profile Data being viewed:", viewingUserProfileData.profile);
        console.log("Final Stats Data being viewed:", viewingUserProfileData.stats);

        // 5. Display Data, Cache, and Check Achievements
        // Display uses the fresh statsData for the most current view on THIS page load
        displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats);
        saveCombinedDataToCache(targetUserId, viewingUserProfileData); // Cache the combined data

        // Check achievements if it's the user's own profile and they have stats
        if (loggedInUser && loggedInUser.uid === targetUserId && viewingUserProfileData.stats) {
            if (!allAchievements) await fetchAllAchievements(); // Ensure definitions are loaded
            if (allAchievements) {
                // Pass the potentially updated profile (for checking existing rewards)
                // Pass the fresh stats (for checking achievement criteria)
                const potentiallyUpdatedProfile = await checkAndGrantAchievements(
                    targetUserId,
                    viewingUserProfileData.profile,
                    viewingUserProfileData.stats
                );
                // If achievements granted NEW titles/rank, update UI/Cache again
                if (potentiallyUpdatedProfile) {
                    viewingUserProfileData.profile = potentiallyUpdatedProfile; // Update local state
                    displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats); // Refresh display
                    saveCombinedDataToCache(targetUserId, viewingUserProfileData); // Update cache
                    console.log("UI/Cache updated post-achievement grant.");
                }
            }
        } else {
             if (!loggedInUser || loggedInUser.uid !== targetUserId) {
                 console.log("Skipping achievement check: Viewing another user's profile.");
             } else if (!viewingUserProfileData.stats) {
                 console.log("Skipping achievement check: No leaderboard stats found for own profile.");
             }
        }

    } catch (error) {
        console.error(`Error in loadCombinedUserData for TARGET UID ${targetUserId}:`, error);
        if (error.stack) console.error("DEBUG: Full error stack:", error.stack);

        if (!cacheLoaded) {
            // Show error state if initial load failed completely
            profileContent.style.display = 'none';
            notLoggedInMsg.textContent = 'Error loading profile data. Please try again later.';
            notLoggedInMsg.style.display = 'flex'; // Use flex as defined in styles
            loadingIndicator.style.display = 'none';
            statsDisplay.innerHTML = '<p>Error loading data.</p>';
            updateProfileTitlesAndRank(null, false);
        } else {
            // Keep cached view if fresh data fetch fails
            console.warn("Error fetching fresh data, displaying potentially stale cached view.");
        }
    }
}


// --- Display Profile Data (Username, Email, Pic, Badges, Rank/Title, Stats) ---
// <<< MODIFIED: Removed dynamic background color setting for profile pic >>>
function displayProfileData(profileData, statsData) {
    if (!profileData) {
        // Handle profile not found/loaded state
        usernameDisplay.textContent = "User Not Found";
        emailDisplay.textContent = "";
        profilePicDiv.textContent = "?";
        // Let CSS handle the default background color
        adminTag.style.display = 'none';
        profileBadgesContainer.innerHTML = '';
        updateProfileTitlesAndRank(null, false);
        displayStats(null); // Show stats unavailable
        return;
    }

    // Basic Info
    const displayName = profileData.displayName || 'Anonymous User';
    const email = profileData.email || 'No email provided';
    usernameDisplay.textContent = displayName;
    emailDisplay.textContent = email;
    profilePicDiv.textContent = displayName.charAt(0).toUpperCase();
    // --- REMOVED DYNAMIC BACKGROUND COLOR SETTING ---
    // profilePicDiv.style.backgroundColor = getUserColor(profileData.id);

    // Badges and Admin Tag
    displayUserBadges(profileData);

    // Rank and Title (handles interaction logic internally)
    const isOwnProfile = loggedInUser && loggedInUser.uid === profileData.id;
    updateProfileTitlesAndRank(profileData, isOwnProfile);

    // Stats Grid (uses fresh statsData passed to this function)
    displayStats(statsData);
}

/*
// --- REMOVED FUNCTION - No longer needed ---
// Helper: Get a consistent color based on User ID
function getUserColor(uid) {
    if (!uid) return '#555'; // Default grey
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = uid.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // Convert to 32bit integer
    }
    const hue = hash % 360;
    return `hsl(${hue}, 50%, 40%)`;
}
*/


// --- Display Stats Grid ---
function displayStats(statsData) {
    statsDisplay.innerHTML = ''; // Clear previous stats

    if (!statsData || typeof statsData !== 'object' || Object.keys(statsData).length === 0) {
        // Display message directly in the grid container
        const noStatsPara = document.createElement('p');
        noStatsPara.textContent = 'Leaderboard stats unavailable for this user.';
        statsDisplay.appendChild(noStatsPara);
        return;
    }

    const statsMap = {
        wins: 'Wins',
        points: 'Points',
        kdRatio: 'K/D Ratio',
        matchesPlayed: 'Matches Played', // Preferred key
        matches: 'Matches Played',      // Fallback key
        losses: 'Losses'
    };

    let statsAdded = 0;
    const addedKeys = new Set(); // Keep track of keys already added (for fallback logic)

    for (const key in statsMap) {
        let value;
        let actualKeyUsed = key;

        // Handle primary key and fallback (matchesPlayed vs matches)
        if (key === 'matchesPlayed') {
            if (statsData.hasOwnProperty('matchesPlayed')) {
                value = statsData.matchesPlayed;
            } else if (statsData.hasOwnProperty('matches')) {
                value = statsData.matches;
                actualKeyUsed = 'matches'; // Note that we used the fallback
            }
        } else {
             value = statsData[key];
        }

        // Skip if value is undefined or if this specific key combination was already added
        if (value === undefined || addedKeys.has(actualKeyUsed)) {
             continue;
        }

        let displayValue = value;
        if (key === 'kdRatio' && typeof value === 'number') {
            displayValue = value.toFixed(2);
        }

        statsDisplay.appendChild(createStatItem(statsMap[key], displayValue));
        addedKeys.add(actualKeyUsed); // Mark this key/fallback as added
        statsAdded++;
    }

    if (statsAdded === 0) {
        const noStatsPara = document.createElement('p');
        noStatsPara.textContent = 'No specific leaderboard stats found.';
        statsDisplay.appendChild(noStatsPara);
    }
}

// --- Helper: Create a Single Stat Item Element ---
function createStatItem(title, value) {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('stat-item');

    const titleH4 = document.createElement('h4');
    titleH4.textContent = title;

    const valueP = document.createElement('p');
    valueP.textContent = (value !== null && value !== undefined) ? value : '-'; // Display '-' if null/undefined

    itemDiv.appendChild(titleH4);
    itemDiv.appendChild(valueP);
    return itemDiv;
}

// --- Check and Grant Achievements based on fetched stats ---
async function checkAndGrantAchievements(userId, currentUserProfile, freshLeaderboardStats) {
    if (!allAchievements || !userId || !currentUserProfile || !freshLeaderboardStats) {
        console.log("Skipping achievement check due to missing data.");
        return null; // Indicate no profile update occurred
    }
    console.log(`Checking achievements for UID ${userId} using fresh stats:`, freshLeaderboardStats);

    try {
        const userAchievementsRef = db.collection('userAchievements').doc(userId);
        const userAchievementsDoc = await userAchievementsRef.get();
        const unlockedIds = userAchievementsDoc.exists ? (userAchievementsDoc.data()?.unlocked || []) : [];

        let newAchievementsUnlocked = [];
        let rewardsToApply = { titles: [], rank: null, rankPoints: 0 };
        let needsDbUpdate = false;

        for (const achievementId in allAchievements) {
            if (unlockedIds.includes(achievementId)) continue;

            const achievement = allAchievements[achievementId];
            let criteriaMet = false;

            if (achievement.criteria?.stat && freshLeaderboardStats[achievement.criteria.stat] !== undefined) {
                const statValue = freshLeaderboardStats[achievement.criteria.stat];
                const targetValue = achievement.criteria.value;
                switch (achievement.criteria.operator) {
                    case '>=': criteriaMet = statValue >= targetValue; break;
                    case '<=': criteriaMet = statValue <= targetValue; break;
                    case '==': criteriaMet = statValue == targetValue; break;
                    default: console.warn(`Unknown operator ${achievement.criteria.operator}`);
                }
            }

            if (criteriaMet) {
                console.log(`Criteria MET for achievement: ${achievement.name || achievementId}`);
                newAchievementsUnlocked.push(achievementId);
                needsDbUpdate = true;
                if (achievement.rewards?.title) rewardsToApply.titles.push(achievement.rewards.title);
                if (achievement.rewards?.rank) rewardsToApply.rank = achievement.rewards.rank;
                if (achievement.rewards?.rankPoints) rewardsToApply.rankPoints += achievement.rewards.rankPoints;
            }
        }

        if (needsDbUpdate && newAchievementsUnlocked.length > 0) {
            console.log(`Unlocking ${newAchievementsUnlocked.length} new achievement(s):`, newAchievementsUnlocked);
            console.log("Applying rewards:", rewardsToApply);

            const batch = db.batch();
            const userProfileRef = db.collection('users').doc(userId);

            // Update unlocked achievements list
            batch.set(userAchievementsRef, { unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsUnlocked) }, { merge: true });

            // Prepare profile updates
            const profileUpdateData = {};
            let updatedLocalProfile = { ...currentUserProfile }; // Start with current profile

            // Apply Title Rewards
            if (rewardsToApply.titles.length > 0) {
                profileUpdateData.availableTitles = firebase.firestore.FieldValue.arrayUnion(...rewardsToApply.titles);
                updatedLocalProfile.availableTitles = [...new Set([...(updatedLocalProfile.availableTitles || []), ...rewardsToApply.titles])];
                // Equip first new title if none is equipped
                if (!updatedLocalProfile.equippedTitle && rewardsToApply.titles[0]) {
                    profileUpdateData.equippedTitle = rewardsToApply.titles[0];
                    updatedLocalProfile.equippedTitle = rewardsToApply.titles[0];
                }
            }

            // Apply Rank Rewards
            if (rewardsToApply.rank) {
                profileUpdateData.currentRank = rewardsToApply.rank;
                updatedLocalProfile.currentRank = rewardsToApply.rank;
            }

            // Ensure defaults if fields were empty
             if (!updatedLocalProfile.currentRank) {
                 profileUpdateData.currentRank = 'Unranked'; updatedLocalProfile.currentRank = 'Unranked';
             }
             if (updatedLocalProfile.equippedTitle === undefined) {
                 profileUpdateData.equippedTitle = ''; updatedLocalProfile.equippedTitle = '';
             }

            // Add profile updates to batch if needed
            if (Object.keys(profileUpdateData).length > 0) {
                batch.update(userProfileRef, profileUpdateData);
            }

            await batch.commit();
            console.log(`Firestore batch committed successfully for UID ${userId}.`);
            return updatedLocalProfile; // Return the locally updated profile object

        } else {
            console.log(`No new achievements unlocked for UID ${userId}.`);
            return null; // No update occurred
        }

    } catch (error) {
        console.error(`Error checking/granting achievements for UID ${userId}:`, error);
        return null; // Error occurred
    }
}

// -----------------------------------------------------------------------------
// --- UI Display Helpers (Badges, Rank/Title Selector) ---
// -----------------------------------------------------------------------------

function displayUserBadges(profileData) {
    profileBadgesContainer.innerHTML = '';
    const userEmail = profileData?.email;
    if (!userEmail) {
        adminTag.style.display = 'none';
        return;
    }
    const emailLower = userEmail.toLowerCase();
    adminTag.style.display = adminEmails.includes(emailLower) ? 'inline-block' : 'none';

    for (const badgeType in badgeConfig) {
        const config = badgeConfig[badgeType];
        if (config.emails.includes(emailLower)) {
            const badgeSpan = document.createElement('span');
            badgeSpan.classList.add('profile-badge', config.className);
            badgeSpan.setAttribute('title', config.title); // Tooltip
            profileBadgesContainer.appendChild(badgeSpan);
        }
    }
}

function updateProfileTitlesAndRank(profileData, allowInteraction) {
    if (!rankDisplay || !titleDisplay) return;

    titleDisplay.classList.remove('selectable-title', 'no-title-placeholder');
    titleDisplay.removeEventListener('click', handleTitleClick);
    closeTitleSelector();

    if (profileData && typeof profileData === 'object') {
        const rank = profileData.currentRank || 'Unranked';
        const title = profileData.equippedTitle || '';
        const available = profileData.availableTitles || [];

        rankDisplay.textContent = rank;
        rankDisplay.className = `profile-rank-display rank-${rank.toLowerCase().replace(/\s+/g, '-')}`;

        if (title) {
            titleDisplay.textContent = title;
            titleDisplay.style.display = 'inline-block';
            if (allowInteraction && available.length > 0) {
                titleDisplay.classList.add('selectable-title');
                titleDisplay.addEventListener('click', handleTitleClick);
            }
        } else {
            // No title equipped
            if (allowInteraction && available.length > 0) {
                 // Show placeholder if interaction allowed and titles exist but none equipped
                 titleDisplay.textContent = '[Choose Title]';
                 titleDisplay.style.display = 'inline-block';
                 titleDisplay.classList.add('selectable-title', 'no-title-placeholder');
                 titleDisplay.addEventListener('click', handleTitleClick);
            } else {
                 // Hide completely if no interaction or no titles available
                 titleDisplay.textContent = '';
                 titleDisplay.style.display = 'none';
            }
        }
    } else {
        // No profile data
        rankDisplay.textContent = '...';
        rankDisplay.className = 'profile-rank-display rank-unranked';
        titleDisplay.textContent = '';
        titleDisplay.style.display = 'none';
    }
}

function handleTitleClick(event) {
    event.stopPropagation();
    if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id) return;

    if (isTitleSelectorOpen) {
        closeTitleSelector();
    } else if (viewingUserProfileData.profile?.availableTitles?.length > 0) {
        openTitleSelector();
    } else {
        console.log("No available titles to select.");
    }
}

function openTitleSelector() {
    if (isTitleSelectorOpen || !profileIdentifiersDiv || !viewingUserProfileData.profile?.availableTitles?.length > 0) return;

    const availableTitles = viewingUserProfileData.profile.availableTitles;
    const currentEquippedTitle = viewingUserProfileData.profile.equippedTitle || '';

    if (!titleSelectorElement) {
        titleSelectorElement = document.createElement('div');
        titleSelectorElement.className = 'title-selector';
        profileIdentifiersDiv.appendChild(titleSelectorElement); // Append near parent
    }
    titleSelectorElement.innerHTML = ''; // Clear previous

    // Add 'Remove Title' option if a title is currently equipped
    if (currentEquippedTitle) {
        const unequipOption = document.createElement('button');
        unequipOption.className = 'title-option title-option-unequip'; // Add class for styling?
        unequipOption.dataset.title = ""; // Use empty string to signify unequip
        unequipOption.type = 'button';
        unequipOption.textContent = '[Remove Title]';
        unequipOption.addEventListener('click', handleTitleOptionClick);
        titleSelectorElement.appendChild(unequipOption);
    }

    availableTitles.forEach(titleOptionText => {
        const optionElement = document.createElement('button');
        optionElement.className = 'title-option';
        optionElement.dataset.title = titleOptionText;
        optionElement.type = 'button';
        optionElement.textContent = titleOptionText;
        if (titleOptionText === currentEquippedTitle) {
            optionElement.classList.add('currently-equipped');
            optionElement.setAttribute('aria-pressed', 'true');
        } else {
            optionElement.setAttribute('aria-pressed', 'false');
        }
        optionElement.addEventListener('click', handleTitleOptionClick);
        titleSelectorElement.appendChild(optionElement);
    });

    titleSelectorElement.style.display = 'block';
    isTitleSelectorOpen = true;
    setTimeout(() => { document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true }); }, 0);
}

function closeTitleSelector() {
    if (!isTitleSelectorOpen || !titleSelectorElement) return;
    titleSelectorElement.style.display = 'none';
    isTitleSelectorOpen = false;
    document.removeEventListener('click', handleClickOutsideTitleSelector, { capture: true });
}

function handleClickOutsideTitleSelector(event) {
    if (!isTitleSelectorOpen) return;
    const clickedInsideSelector = titleSelectorElement && titleSelectorElement.contains(event.target);
    const clickedOnTitleDisplay = titleDisplay && titleDisplay.contains(event.target);

    if (clickedInsideSelector || clickedOnTitleDisplay) {
        document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true });
        return;
    }
    closeTitleSelector();
}

async function handleTitleOptionClick(event) {
    event.stopPropagation();
    const selectedTitle = event.currentTarget.dataset.title;
    const currentUserId = loggedInUser?.uid;
    const currentlyViewedProfile = viewingUserProfileData.profile;

    if (!currentUserId || !currentlyViewedProfile || currentUserId !== currentlyViewedProfile.id) {
        console.error("Attempted to change title for wrong user.");
        closeTitleSelector();
        return;
    }

    const currentEquipped = currentlyViewedProfile.equippedTitle || '';
    if (selectedTitle === currentEquipped) {
        closeTitleSelector(); return; // No change
    }

    closeTitleSelector();
    titleDisplay.textContent = "Updating...";
    titleDisplay.classList.remove('selectable-title', 'no-title-placeholder');

    try {
        const userProfileRef = db.collection('users').doc(currentUserId);
        await userProfileRef.update({ equippedTitle: selectedTitle }); // Update Firestore
        console.log(`Firestore 'users' doc updated title to "${selectedTitle || 'None'}" for UID ${currentUserId}`);

        // Update local state and cache
        viewingUserProfileData.profile.equippedTitle = selectedTitle;
        saveCombinedDataToCache(currentUserId, viewingUserProfileData);
        // Refresh display
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true);

    } catch (error) {
        console.error("Error updating equipped title in Firestore 'users':", error);
        alert("Failed to update title.");
        // Revert local state and refresh display on error
        if (viewingUserProfileData.profile) {
             viewingUserProfileData.profile.equippedTitle = currentEquipped;
        }
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true);
    }
}

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
        profileContent.style.display = 'block'; // Use block as defined in styles

        fetchAllAchievements(); // Start fetching definitions early
        loadCombinedUserData(targetUid); // Load profile data

        profileLogoutBtn.style.display = (loggedInUser && loggedInUser.uid === targetUid) ? 'inline-block' : 'none';
    } else {
        // No user logged in AND no UID in URL
        console.log('No user logged in and no profile UID in URL.');
        loadingIndicator.style.display = 'none';
        profileContent.style.display = 'none';
        notLoggedInMsg.style.display = 'flex'; // Show "Please log in" message
        notLoggedInMsg.textContent = 'Please log in to view your profile, or provide a user ID in the URL (e.g., ?uid=USER_ID).';
        adminTag.style.display = 'none';
        profileBadgesContainer.innerHTML = '';
        profileLogoutBtn.style.display = 'none';
        updateProfileTitlesAndRank(null, false); // Reset rank/title display
        statsDisplay.innerHTML = ''; // Clear stats display
        viewingUserProfileData = {}; // Clear profile data
        closeTitleSelector(); // Ensure selector is closed
    }
});

profileLogoutBtn.addEventListener('click', () => {
    const userId = loggedInUser?.uid;
    if (titleDisplay) titleDisplay.removeEventListener('click', handleTitleClick);
    closeTitleSelector();

    auth.signOut().then(() => {
        console.log('User signed out successfully.');
        if (userId) {
            localStorage.removeItem(`poxelProfileCombinedData_${userId}`);
            console.log(`Cleared cache for UID: ${userId}`);
        }
        viewingUserProfileData = {};
        // onAuthStateChanged will handle UI changes (potentially redirecting or showing login message)
         window.location.href = 'index.html'; // Or wherever you want logged-out users to go
    }).catch((error) => {
        console.error('Sign out error:', error);
        alert('Error signing out.');
    });
});

// -----------------------------------------------------------------------------
// --- Local Storage Caching ---
// -----------------------------------------------------------------------------

function loadCombinedDataFromCache(viewedUserId) {
    if (!viewedUserId) return false;
    const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
    const cachedDataString = localStorage.getItem(cacheKey);
    if (!cachedDataString) return false;

    try {
        const cachedData = JSON.parse(cachedDataString);
        if (cachedData && cachedData.profile) {
            viewingUserProfileData = cachedData;
            console.log("Loaded combined data from cache for VIEWED UID:", viewedUserId);
            displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats); // Display cached data immediately
            return true;
        } else {
            localStorage.removeItem(cacheKey); return false;
        }
    } catch (error) {
        console.error("Error parsing cached data:", error);
        localStorage.removeItem(cacheKey); return false;
    }
}

function saveCombinedDataToCache(viewedUserId, combinedData) {
     if (!viewedUserId || !combinedData || !combinedData.profile) return;
     const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
     try {
         localStorage.setItem(cacheKey, JSON.stringify(combinedData));
         // console.log("Saved combined data to cache for VIEWED UID:", viewedUserId);
     } catch(error) {
         console.error("Error saving data to cache:", error);
         if (error.name === 'QuotaExceededError') {
             console.warn('Browser storage quota exceeded. Cannot cache profile data.');
             // Consider clearing older cache items here if necessary
         }
     }
}

// --- Initial Log ---
console.log("Profile script initialized. Waiting for Auth state...");
// Initial data load is triggered by the onAuthStateChanged listener.
