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
// Moved this block to the TOP to ensure auth and db are defined before use
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth(); // Define auth right after init
const db = firebase.firestore(); // Define db right after init

// --- URL Parameter Parsing & Logged-in User Check ---
// Now this code can safely use 'auth'
const urlParams = new URLSearchParams(window.location.search);
const profileUidFromUrl = urlParams.get('uid'); // Get UID from ?uid=... (Renamed for clarity)
let loggedInUser = auth.currentUser; // Check initial auth state (might be null initially)

// --- Admin Emails ---
const adminEmails = [
    'trixdesignsofficial@gmail.com', // Replace/add your admin emails
    'jackdmbell@outlook.com',
    'myrrr@myrrr.myrrr'
].map(email => email.toLowerCase()); // Normalize to lowercase

// --- Badge Configuration ---
// Add emails (lowercase) of users who should get each badge
const badgeConfig = {
    verified: {
        emails: ['jackdmbell@outlook.com', 'myrrr@myrrr.myrrr'].map(e => e.toLowerCase()), // Replace with actual emails
        className: 'badge-verified',
        title: 'Verified'
    },
    creator: {
        emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()), // Replace with actual emails
        className: 'badge-creator',
        title: 'Content Creator'
    },
    moderator: {
        emails: ['jackdmbell@outlook.com', 'mod_team@sample.org'].map(e => e.toLowerCase()), // Replace with actual emails
        className: 'badge-moderator',
        title: 'Moderator'
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
const profileIdentifiersDiv = document.querySelector('.profile-identifiers'); // Parent for title selector
const profileBadgesContainer = document.getElementById('profile-badges-container');

// --- Global/Scoped Variables ---
let allAchievements = null; // Cache for achievement definitions
let viewingUserProfileData = {}; // Data for the profile *being viewed*
let isTitleSelectorOpen = false;
let titleSelectorElement = null; // Reference to the created selector dropdown div


// --- Function to fetch all achievement definitions ---
async function fetchAllAchievements() {
    // Use cache if available
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

// --- Helper: Display Badges based on the viewed profile's data ---
function displayUserBadges(profileData) {
    profileBadgesContainer.innerHTML = ''; // Clear existing badges
    const userEmail = profileData?.email; // Get email from the profile data being viewed
    if (!userEmail) return;

    const emailLower = userEmail.toLowerCase();

    // Check Admin Tag based on VIEWED profile's email
    adminTag.style.display = adminEmails.includes(emailLower) ? 'inline-block' : 'none';

    // Check other badges
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
auth.onAuthStateChanged(user => {
    loggedInUser = user; // Update the global variable
    const targetUid = profileUidFromUrl || loggedInUser?.uid;
    console.log(`Auth state changed. Logged in: ${!!user}, Target UID: ${targetUid}`);

    if (targetUid) {
        loadingIndicator.style.display = 'none';
        notLoggedInMsg.style.display = 'none';
        profileContent.style.display = 'block';
        fetchAllAchievements();
        loadCombinedUserData(targetUid); // Load the specific profile
        profileLogoutBtn.style.display = (loggedInUser && loggedInUser.uid === targetUid) ? 'inline-block' : 'none';
    } else {
        console.log('No user logged in and no profile UID in URL.');
        loadingIndicator.style.display = 'none';
        profileContent.style.display = 'none';
        notLoggedInMsg.style.display = 'flex';
        adminTag.style.display = 'none';
        profileBadgesContainer.innerHTML = '';
        profileLogoutBtn.style.display = 'none';
        updateProfileTitlesAndRank(null, false);
        statsDisplay.innerHTML = '';
        viewingUserProfileData = {};
        closeTitleSelector();
    }
});

// --- Helper Function: Client-Side User Profile Document Creation ---
async function createUserProfileDocument(userId, authUser) {
    console.warn(`Attempting client-side creation of user profile doc for UID: ${userId}`);
    const userDocRef = db.collection("users").doc(userId);
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;
    const defaultProfileData = {
        email: authUser.email || null,
        displayName: displayName,
        currentRank: "Unranked",
        equippedTitle: "",
        availableTitles: [],
        friends: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        await userDocRef.set(defaultProfileData, { merge: true });
        console.log(`Successfully created/merged user profile document for UID: ${userId} via client`);
        return { id: userId, ...defaultProfileData };
    } catch (error) {
        console.error(`Error creating user profile document client-side for UID ${userId}:`, error);
        alert("Error setting up your profile details. Please check your connection or contact support if the issue persists.");
        return null;
    }
}

// --- Load Combined Data from Cache ---
function loadCombinedDataFromCache(viewedUserId) {
    const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
    const cachedDataString = localStorage.getItem(cacheKey);
    if (cachedDataString) {
        try {
            viewingUserProfileData = JSON.parse(cachedDataString);
            console.log("Loaded combined data from cache for VIEWED UID:", viewedUserId);
            displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats);
            return true;
        } catch (error) {
            console.error("Error parsing combined cached data:", error);
            localStorage.removeItem(cacheKey);
            viewingUserProfileData = {};
            return false;
        }
    } else {
        console.log("No combined data found in cache for VIEWED UID:", viewedUserId);
        viewingUserProfileData = {};
        return false;
    }
}

// --- Save Combined Data to Cache ---
function saveCombinedDataToCache(viewedUserId, combinedData) {
     if (!viewedUserId || !combinedData) return;
     const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
     try {
         localStorage.setItem(cacheKey, JSON.stringify(combinedData));
         console.log("Saved combined data to cache for VIEWED UID:", viewedUserId);
     } catch(error) {
         console.error("Error saving combined data to cache:", error);
     }
}

// --- Load Combined User Data (Handles Client-Side Profile Creation) ---
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
        console.log(`DEBUG: Attempting to get profile for ${targetUserId}`);
        let profileSnap = await userProfileRef.get();
        let profileData = null;

        console.log('DEBUG: Result of userProfileRef.get():', profileSnap);
        console.log('DEBUG: Type of profileSnap:', typeof profileSnap);
         if (profileSnap) {
             console.log('DEBUG: profileSnap constructor name:', profileSnap.constructor?.name);
             console.log('DEBUG: Does profileSnap have .exists property?', 'exists' in profileSnap); // Check property
             console.log('DEBUG: Does profileSnap have .data method?', 'data' in profileSnap && typeof profileSnap.data === 'function'); // Check method
        }

        // <<< --- CORRECTED CHECK --- >>>
        // Check existence using the 'exists' PROPERTY
        if (!profileSnap || !profileSnap.exists) { // Access the 'exists' property
            console.warn(`User profile document does NOT exist (or fetch result invalid) for UID: ${targetUserId}`);
            if (loggedInUser && loggedInUser.uid === targetUserId) {
                 profileData = await createUserProfileDocument(targetUserId, loggedInUser);
                 if (!profileData) {
                     throw new Error(`Profile creation failed for own UID ${targetUserId}.`);
                 }
            } else {
                 console.error(`Cannot find profile for user UID: ${targetUserId}`);
                 displayProfileData(null, null);
                 statsDisplay.innerHTML = '<p>Profile not found.</p>';
                 return;
            }
        } else {
            // Profile existed, use its data (data() IS a function in Compat)
            profileData = { id: profileSnap.id, ...profileSnap.data() };
        }

        // <<< --- CORRECTED CHECK --- >>>
        const statsSnap = await leaderboardStatsRef.get();
        // Correct check for statsSnap too using 'exists' PROPERTY
        const statsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null; // Use statsSnap.exists property

        // --- Combine and Update State ---
        viewingUserProfileData = {
            profile: profileData,
            stats: statsData
        };
        console.log("Final Profile Data being viewed:", viewingUserProfileData.profile);
        console.log("Final Stats Data being viewed:", viewingUserProfileData.stats);

        // --- Display, Cache, Check Achievements ---
        displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats);
        saveCombinedDataToCache(targetUserId, viewingUserProfileData);

        if (loggedInUser && loggedInUser.uid === targetUserId && viewingUserProfileData.stats) {
            if (!allAchievements) await fetchAllAchievements();
            if (allAchievements) {
                const potentiallyUpdatedProfile = await checkAndGrantAchievements(
                    targetUserId,
                    viewingUserProfileData.profile,
                    viewingUserProfileData.stats
                );
                if (potentiallyUpdatedProfile) {
                    viewingUserProfileData.profile = potentiallyUpdatedProfile;
                    displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats);
                    saveCombinedDataToCache(targetUserId, viewingUserProfileData);
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
        if (error.stack) {
            console.error("DEBUG: Full error stack:", error.stack);
        }
        if (!cacheLoaded) {
            statsDisplay.innerHTML = '<p>Error loading data.</p>';
            updateProfileTitlesAndRank(null, false);
        } else {
            console.warn("Error fetching fresh data, restoring cached view.");
            loadCombinedDataFromCache(targetUserId);
        }
    }
}


// --- NEW: Central Function to Display Profile Data ---
function displayProfileData(profileData, statsData) {
    if (!profileData) {
        usernameDisplay.textContent = "User Not Found";
        emailDisplay.textContent = "";
        profilePicDiv.textContent = "?";
        adminTag.style.display = 'none';
        profileBadgesContainer.innerHTML = '';
        updateProfileTitlesAndRank(null, false);
        displayStats(null);
        return;
    }
    const displayName = profileData.displayName || 'User';
    const email = profileData.email || 'No email provided';
    usernameDisplay.textContent = displayName;
    emailDisplay.textContent = email;
    profilePicDiv.textContent = displayName.charAt(0).toUpperCase();
    displayUserBadges(profileData);
    displayStats(statsData);
    const isOwnProfile = loggedInUser && loggedInUser.uid === profileData.id;
    updateProfileTitlesAndRank(profileData, isOwnProfile);
}


// --- Check and Grant Achievements ---
async function checkAndGrantAchievements(userId, currentUserProfile, currentUserStats) {
    if (!allAchievements || !userId || !currentUserProfile || !currentUserStats) return null;
    console.log(`Checking achievements for UID ${userId}`);
    try {
        const userAchievementsRef = db.collection('userAchievements').doc(userId);
        const userAchievementsDoc = await userAchievementsRef.get();
        // <<< --- CORRECTED CHECK --- >>>
        const unlockedIds = userAchievementsDoc.exists ? (userAchievementsDoc.data()?.unlocked || []) : []; // Use .exists property

        let newAchievementsUnlocked = [], rewardsToApply = { titles: [], rank: null, rankPoints: 0 }, needsDbUpdate = false;

        for (const achievementId in allAchievements) {
             if (unlockedIds.includes(achievementId)) continue;
             const achievement = allAchievements[achievementId]; let criteriaMet = false;
             if (achievement.criteria?.stat && currentUserStats[achievement.criteria.stat] !== undefined) {
                 const statValue = currentUserStats[achievement.criteria.stat];
                 switch (achievement.criteria.operator) {
                     case '>=': criteriaMet = statValue >= achievement.criteria.value; break;
                     case '<=': criteriaMet = statValue <= achievement.criteria.value; break;
                     case '==': criteriaMet = statValue == achievement.criteria.value; break;
                 }
             }
             if (criteriaMet) {
                 newAchievementsUnlocked.push(achievementId); needsDbUpdate = true;
                 if (achievement.rewards?.title) rewardsToApply.titles.push(achievement.rewards.title);
                 if (achievement.rewards?.rank) rewardsToApply.rank = achievement.rewards.rank;
                 if (achievement.rewards?.rankPoints) rewardsToApply.rankPoints += achievement.rewards.rankPoints;
             }
        }
        if (needsDbUpdate && newAchievementsUnlocked.length > 0) {
            const batch = db.batch();
            const userProfileRef = db.collection('users').doc(userId);
            let updatedLocalProfile = { ...currentUserProfile };
            batch.set(userAchievementsRef, { unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsUnlocked) }, { merge: true });
            const profileUpdateData = {}; let titleToEquip = null;
            if (rewardsToApply.titles.length > 0) {
                profileUpdateData.availableTitles = firebase.firestore.FieldValue.arrayUnion(...rewardsToApply.titles);
                updatedLocalProfile.availableTitles = [...new Set([...(updatedLocalProfile.availableTitles || []), ...rewardsToApply.titles])];
                if (!updatedLocalProfile.equippedTitle) { titleToEquip = rewardsToApply.titles[0]; profileUpdateData.equippedTitle = titleToEquip; updatedLocalProfile.equippedTitle = titleToEquip; }
            }
            if (rewardsToApply.rank) { profileUpdateData.currentRank = rewardsToApply.rank; updatedLocalProfile.currentRank = rewardsToApply.rank; }
            if (!updatedLocalProfile.currentRank) { profileUpdateData.currentRank = 'Unranked'; updatedLocalProfile.currentRank = 'Unranked'; }
            if (!updatedLocalProfile.equippedTitle && !titleToEquip) { profileUpdateData.equippedTitle = ''; updatedLocalProfile.equippedTitle = ''; }
            let committedProfileUpdate = false;
             if (Object.keys(profileUpdateData).length > 0) { batch.update(userProfileRef, profileUpdateData); committedProfileUpdate = true; }
            await batch.commit(); console.log(`Firestore updated for UID ${userId}. Profile updated: ${committedProfileUpdate}`);
            return committedProfileUpdate ? updatedLocalProfile : null;
        } else { console.log(`No new achievements unlocked for UID ${userId}.`); return null; }
    } catch (error) { console.error(`Error check/grant achievements for UID ${userId}:`, error); return null; }
}

// --- Display Stats Grid ---
function displayStats(statsData) {
    statsDisplay.innerHTML = '';
    if (!statsData || typeof statsData !== 'object') { statsDisplay.innerHTML = '<p>Leaderboard stats unavailable.</p>'; return; }
    if (statsData.wins !== undefined) statsDisplay.appendChild(createStatItem('Wins', statsData.wins));
    if (statsData.points !== undefined) statsDisplay.appendChild(createStatItem('Points', statsData.points));
    if (statsData.kdRatio !== undefined) statsDisplay.appendChild(createStatItem('K/D Ratio', typeof statsData.kdRatio === 'number' ? statsData.kdRatio.toFixed(2) : statsData.kdRatio));
    const matchesPlayed = statsData.matchesPlayed !== undefined ? statsData.matchesPlayed : statsData.matches;
    if (matchesPlayed !== undefined) statsDisplay.appendChild(createStatItem('Matches Played', matchesPlayed));
    if (statsData.losses !== undefined) statsDisplay.appendChild(createStatItem('Losses', statsData.losses));
    if (statsDisplay.innerHTML === '') { statsDisplay.innerHTML = '<p>No specific leaderboard stats found.</p>'; }
}

// --- Helper: Create a Single Stat Item Element ---
function createStatItem(title, value) {
    const itemDiv = document.createElement('div'); itemDiv.classList.add('stat-item');
    const titleH4 = document.createElement('h4'); titleH4.textContent = title;
    const valueP = document.createElement('p');
    valueP.textContent = (value !== null && value !== undefined) ? value : '-';
    itemDiv.appendChild(titleH4); itemDiv.appendChild(valueP); return itemDiv;
}

// --- Helper: Update Profile Rank/Title Display ---
function updateProfileTitlesAndRank(profileData, allowInteraction) {
    if (!rankDisplay || !titleDisplay) return;
    titleDisplay.classList.remove('selectable-title');
    titleDisplay.removeEventListener('click', handleTitleClick);
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
            titleDisplay.textContent = '';
            titleDisplay.style.display = 'none';
        }
    } else {
        rankDisplay.textContent = '...';
        rankDisplay.className = 'profile-rank-display rank-unranked';
        titleDisplay.textContent = '';
        titleDisplay.style.display = 'none';
    }
}

// --- Handle Clicks on the Equipped Title ---
function handleTitleClick(event) {
    event.stopPropagation();
    if (isTitleSelectorOpen) { closeTitleSelector(); }
    else if (viewingUserProfileData.profile?.availableTitles?.length > 0) { openTitleSelector(); }
    else { console.log("No available titles in profile data."); }
}

// --- Open Title Selector Dropdown ---
function openTitleSelector() {
    if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id) return;
    if (isTitleSelectorOpen || !profileIdentifiersDiv || !viewingUserProfileData.profile?.availableTitles?.length > 0) return;
    const availableTitles = viewingUserProfileData.profile.availableTitles;
    const currentEquippedTitle = viewingUserProfileData.profile.equippedTitle || '';
    if (!titleSelectorElement) {
        titleSelectorElement = document.createElement('div');
        titleSelectorElement.className = 'title-selector';
        profileIdentifiersDiv.appendChild(titleSelectorElement);
    }
    titleSelectorElement.innerHTML = '';
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

// --- Close Title Selector Dropdown ---
function closeTitleSelector() {
    if (!isTitleSelectorOpen || !titleSelectorElement) return;
    titleSelectorElement.style.display = 'none';
    isTitleSelectorOpen = false;
    document.removeEventListener('click', handleClickOutsideTitleSelector, { capture: true });
}

// --- Handle Clicks Outside Selector ---
function handleClickOutsideTitleSelector(event) {
    if (!isTitleSelectorOpen) return;
    if ((titleSelectorElement && titleSelectorElement.contains(event.target)) || (titleDisplay && titleDisplay.contains(event.target))) {
        document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true });
        return;
    }
    closeTitleSelector();
}

// --- Handle Clicks on a Title Option ---
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
    if (!selectedTitle || selectedTitle === currentEquipped) {
        closeTitleSelector();
        return;
    }
    closeTitleSelector();
    titleDisplay.textContent = "Updating...";
    titleDisplay.classList.remove('selectable-title');
    try {
        const userProfileRef = db.collection('users').doc(currentUserId);
        await userProfileRef.update({ equippedTitle: selectedTitle });
        console.log(`Firestore 'users' doc updated title for UID ${currentUserId}`);
        viewingUserProfileData.profile.equippedTitle = selectedTitle;
        saveCombinedDataToCache(currentUserId, viewingUserProfileData);
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true);
    } catch (error) {
        console.error("Error updating equipped title in Firestore 'users':", error);
        alert("Failed to update title.");
        if (viewingUserProfileData.profile) {
            viewingUserProfileData.profile.equippedTitle = currentEquipped;
        }
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true);
    }
}

// --- Logout Button ---
profileLogoutBtn.addEventListener('click', () => {
    const userId = loggedInUser?.uid;
    if (titleDisplay) titleDisplay.removeEventListener('click', handleTitleClick);
    closeTitleSelector();
    auth.signOut().then(() => {
        console.log('User signed out.');
        if (userId) localStorage.removeItem(`poxelProfileCombinedData_${userId}`);
        viewingUserProfileData = {};
        // Auth listener will handle UI changes or redirection
    }).catch((error) => { console.error('Sign out error:', error); alert('Error signing out.'); });
});

// --- Initial log ---
console.log("Profile script initialized (Supports viewing others, conditional interaction).");
// Initial load is triggered by the onAuthStateChanged listener
