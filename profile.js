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
    verified: {
        emails: ['jackdmbell@outlook.com', 'myrrr@myrrr.myrrr'].map(e => e.toLowerCase()),
        className: 'badge-verified',
        title: 'Verified'
    },
    creator: {
        emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()),
        className: 'badge-creator',
        title: 'Content Creator'
    },
    moderator: {
        emails: ['jackdmbell@outlook.com', 'mod_team@sample.org'].map(e => e.toLowerCase()),
        className: 'badge-moderator',
        title: 'Moderator'
    }
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
let allAchievements = null;
let viewingUserProfileData = {}; // Holds { profile: {...}, stats: {...} } for the user being viewed
let isTitleSelectorOpen = false;
let titleSelectorElement = null;

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

    // Define the keys we care about comparing
    const statKeys = ['wins', 'points', 'kdRatio', 'matchesPlayed', 'matches', 'losses'];
    let different = false;

    // Check if values for relevant keys are different
    for (const key of statKeys) {
        const newValue = normNew[key] ?? null; // Use null if undefined
        const existingValue = normExisting[key] ?? null;

        // Special handling for floating point numbers (e.g., kdRatio)
        if (key === 'kdRatio' && typeof newValue === 'number' && typeof existingValue === 'number') {
            if (Math.abs(newValue - existingValue) > 0.001) { // Tolerance check
                different = true;
                break;
            }
        } else if (newValue !== existingValue) {
            different = true;
            break;
        }
    }

    // Optional: Check if the set of relevant keys themselves differ
    // This catches cases where a stat might be added or removed entirely
    if (!different) {
        const newRelevantKeys = Object.keys(normNew).filter(k => statKeys.includes(k));
        const existingRelevantKeys = Object.keys(normExisting).filter(k => statKeys.includes(k));
        if (newRelevantKeys.length !== existingRelevantKeys.length) {
            different = true;
        } else {
            // Check if keys sets are identical (more robust check if needed)
            const newSet = new Set(newRelevantKeys);
            if (!existingRelevantKeys.every(key => newSet.has(key))) {
                different = true;
            }
        }
    }

    return different;
}


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
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        leaderboardStats: {} // <<< INITIALIZED: Add field for storing stats copy
    };
    try {
        // Use set with merge:true to avoid overwriting existing fields if somehow called again
        await userDocRef.set(defaultProfileData, { merge: true });
        console.log(`Successfully created/merged user profile document for UID: ${userId} via client`);
        return { id: userId, ...defaultProfileData };
    } catch (error) {
        console.error(`Error creating user profile document client-side for UID ${userId}:`, error);
        alert("Error setting up your profile details. Please check your connection or contact support if the issue persists.");
        return null;
    }
}

// --- Load Combined User Data (Profile + Leaderboard Stats) ---
// <<< MODIFIED: Includes logic to sync leaderboard stats to the user profile >>>
async function loadCombinedUserData(targetUserId) {
    console.log(`Loading combined user data for TARGET UID: ${targetUserId}`);

    // Attempt to load from cache first for faster initial display
    const cacheLoaded = loadCombinedDataFromCache(targetUserId);
    if (!cacheLoaded) {
        // Only show loading states if nothing came from cache
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
            // If viewing own profile and it doesn't exist, try to create it
            if (loggedInUser && loggedInUser.uid === targetUserId) {
                profileData = await createUserProfileDocument(targetUserId, loggedInUser);
                if (!profileData) {
                    throw new Error(`Profile creation failed for own UID ${targetUserId}.`);
                }
            } else {
                // Viewing someone else's profile that doesn't exist
                console.error(`Cannot find profile for user UID: ${targetUserId}`);
                displayProfileData(null, null); // Show "User Not Found"
                statsDisplay.innerHTML = '<p>Profile not found.</p>';
                return; // Stop execution for this profile load
            }
        } else {
            // Profile exists, get its data
            profileData = { id: profileSnap.id, ...profileSnap.data() };
            // Ensure leaderboardStats field exists locally, even if missing in older Firestore docs
            if (profileData.leaderboardStats === undefined) {
                profileData.leaderboardStats = {};
            }
        }

        // 2. Fetch Leaderboard Stats Data
        const statsSnap = await leaderboardStatsRef.get();
        // If stats exist, create an object, otherwise set to null
        const statsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null;

        // 3. <<< SYNC STATS TO PROFILE >>>
        // Check if we have both profile and fresh stats, and if the stats have changed
        if (profileData && statsData) {
            if (areStatsDifferent(statsData, profileData.leaderboardStats)) {
                console.log(`Leaderboard stats for UID ${targetUserId} differ from profile copy. Updating 'users' document.`);
                try {
                    // Create a clean copy of stats to save (avoid saving the 'id')
                    const statsToSave = { ...statsData };
                    delete statsToSave.id;

                    // Update the 'leaderboardStats' field within the user's document
                    await userProfileRef.update({
                        leaderboardStats: statsToSave
                    });
                    console.log(`Successfully updated 'users' doc for UID ${targetUserId} with new stats.`);
                    // --- IMPORTANT: Update the local profileData object immediately ---
                    // This ensures subsequent operations in this load cycle (cache, achievements)
                    // use the *just updated* profile data structure.
                    profileData.leaderboardStats = statsToSave;

                } catch (updateError) {
                    console.error(`Error updating 'users' document with stats for UID ${targetUserId}:`, updateError);
                    // Log error but continue - page will display fresh stats anyway
                }
            } else {
                 console.log(`Leaderboard stats for UID ${targetUserId} match profile copy. No Firestore 'users' update needed.`);
            }
        } else if (profileData && !statsData && Object.keys(profileData.leaderboardStats || {}).length > 0) {
             // Optional: Handle case where user *had* stats, but now doesn't appear on leaderboard
             // You might want to clear the stats in the profile here, or leave them as the 'last known' stats.
             console.log(`User ${targetUserId} has stats in profile but not found in current leaderboard. Keeping existing profile stats.`);
             // Example: To clear them uncomment below
             // try {
             //     await userProfileRef.update({ leaderboardStats: {} });
             //     profileData.leaderboardStats = {};
             //     console.log(`Cleared leaderboardStats in profile for UID ${targetUserId}.`);
             // } catch(clearError) {
             //     console.error(`Error clearing leaderboardStats for UID ${targetUserId}:`, clearError);
             // }
        }

        // 4. Update Global State
        viewingUserProfileData = {
            profile: profileData, // Contains potentially updated .leaderboardStats
            stats: statsData      // Contains fresh stats direct from 'leaderboard' collection
        };
        console.log("Final Profile Data being viewed:", viewingUserProfileData.profile);
        console.log("Final Stats Data being viewed:", viewingUserProfileData.stats);

        // 5. Display Data, Cache, and Check Achievements
        // Display uses the fresh statsData for the most current view on THIS page load
        displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats);
        saveCombinedDataToCache(targetUserId, viewingUserProfileData); // Cache the combined data

        // Achievement check uses the fresh statsData as the trigger criteria
        if (loggedInUser && loggedInUser.uid === targetUserId && viewingUserProfileData.stats) {
            if (!allAchievements) await fetchAllAchievements();
            if (allAchievements) {
                // Pass the potentially updated profile (for checking existing titles/rank)
                // Pass the fresh stats (for checking achievement criteria)
                const potentiallyUpdatedProfile = await checkAndGrantAchievements(
                    targetUserId,
                    viewingUserProfileData.profile,
                    viewingUserProfileData.stats
                );
                // If achievements granted NEW profile data (titles/rank), update UI/Cache again
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

        // If fetch failed and cache wasn't loaded, show error
        if (!cacheLoaded) {
            profileContent.style.display = 'none';
            notLoggedInMsg.style.display = 'flex';
            notLoggedInMsg.textContent = 'Error loading profile data. Please try again later.';
            statsDisplay.innerHTML = '<p>Error loading data.</p>';
            updateProfileTitlesAndRank(null, false);
        } else {
            // If fetch failed but cache was loaded, log warning but keep cached view
            console.warn("Error fetching fresh data, displaying potentially stale cached view.");
        }
    }
}


// --- Display Profile Data (Username, Email, Pic, Badges, Rank/Title, Stats) ---
function displayProfileData(profileData, statsData) {
    if (!profileData) {
        // Handle case where profile couldn't be loaded or created
        usernameDisplay.textContent = "User Not Found";
        emailDisplay.textContent = "";
        profilePicDiv.textContent = "?";
        profilePicDiv.style.backgroundColor = '#555'; // Default background
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
    // Optional: Set a color based on UID or name hash for variety
    profilePicDiv.style.backgroundColor = getUserColor(profileData.id);

    // Badges and Admin Tag
    displayUserBadges(profileData);

    // Rank and Title (handles interaction logic internally)
    const isOwnProfile = loggedInUser && loggedInUser.uid === profileData.id;
    updateProfileTitlesAndRank(profileData, isOwnProfile);

    // Stats Grid (uses fresh statsData passed to this function)
    displayStats(statsData);
}

// --- Helper: Get a consistent color based on User ID ---
function getUserColor(uid) {
    if (!uid) return '#555'; // Default grey
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = uid.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // Convert to 32bit integer
    }
    // Simple hash to HSL conversion for pleasant colors
    const hue = hash % 360;
    return `hsl(${hue}, 50%, 40%)`; // Adjust saturation/lightness as needed
}


// --- Display Stats Grid ---
function displayStats(statsData) {
    statsDisplay.innerHTML = ''; // Clear previous stats

    // Check if statsData is valid
    if (!statsData || typeof statsData !== 'object' || Object.keys(statsData).length === 0) {
        statsDisplay.innerHTML = '<p>Leaderboard stats unavailable for this user.</p>';
        return;
    }

    // Define stats to display and their labels
    const statsMap = {
        wins: 'Wins',
        points: 'Points',
        kdRatio: 'K/D Ratio',
        matchesPlayed: 'Matches Played', // Preferred key
        matches: 'Matches Played',      // Fallback key
        losses: 'Losses'
    };

    let statsAdded = 0;

    // Iterate through the map to maintain order and handle formatting
    for (const key in statsMap) {
        let value = statsData[key];

        // Handle fallback for matchesPlayed/matches
        if (key === 'matchesPlayed' && value === undefined) {
            value = statsData['matches']; // Check the fallback key
        }
        // Skip if value is still undefined or if it's the fallback key 'matches' and 'matchesPlayed' was already processed
        if (value === undefined || (key === 'matches' && statsData['matchesPlayed'] !== undefined)) {
             continue;
        }

        let displayValue = value;
        // Format K/D Ratio
        if (key === 'kdRatio' && typeof value === 'number') {
            displayValue = value.toFixed(2);
        }

        statsDisplay.appendChild(createStatItem(statsMap[key], displayValue));
        statsAdded++;
    }


    // Fallback message if no recognized stats were found in the object
    if (statsAdded === 0) {
        statsDisplay.innerHTML = '<p>No specific leaderboard stats found.</p>';
    }
}

// --- Helper: Create a Single Stat Item Element ---
function createStatItem(title, value) {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('stat-item');

    const titleH4 = document.createElement('h4');
    titleH4.textContent = title;

    const valueP = document.createElement('p');
    // Display '-' if value is null or undefined, otherwise the value itself
    valueP.textContent = (value !== null && value !== undefined) ? value : '-';

    itemDiv.appendChild(titleH4);
    itemDiv.appendChild(valueP);
    return itemDiv;
}

// --- Check and Grant Achievements based on fetched stats ---
async function checkAndGrantAchievements(userId, currentUserProfile, freshLeaderboardStats) {
    // Requires achievement definitions, user ID, the current profile state, and fresh stats
    if (!allAchievements || !userId || !currentUserProfile || !freshLeaderboardStats) {
        console.log("Skipping achievement check due to missing data.", { allAchievements: !!allAchievements, userId, currentUserProfile: !!currentUserProfile, freshLeaderboardStats: !!freshLeaderboardStats });
        return null; // Indicate no profile update occurred
    }

    console.log(`Checking achievements for UID ${userId} using fresh stats:`, freshLeaderboardStats);

    try {
        // 1. Get User's Currently Unlocked Achievements
        const userAchievementsRef = db.collection('userAchievements').doc(userId);
        const userAchievementsDoc = await userAchievementsRef.get();
        const unlockedIds = userAchievementsDoc.exists ? (userAchievementsDoc.data()?.unlocked || []) : [];
        console.log(`User ${userId} already has achievements:`, unlockedIds);

        // 2. Iterate Through All Defined Achievements
        let newAchievementsUnlocked = [];
        let rewardsToApply = { titles: [], rank: null, rankPoints: 0 }; // Collect rewards
        let needsDbUpdate = false; // Flag if any changes are needed

        for (const achievementId in allAchievements) {
            // Skip if already unlocked
            if (unlockedIds.includes(achievementId)) continue;

            const achievement = allAchievements[achievementId];
            let criteriaMet = false;

            // Check criteria against the freshLeaderboardStats
            if (achievement.criteria?.stat && freshLeaderboardStats[achievement.criteria.stat] !== undefined) {
                const statValue = freshLeaderboardStats[achievement.criteria.stat];
                const targetValue = achievement.criteria.value;

                switch (achievement.criteria.operator) {
                    case '>=': criteriaMet = statValue >= targetValue; break;
                    case '<=': criteriaMet = statValue <= targetValue; break;
                    case '==': criteriaMet = statValue == targetValue; break;
                    // Add other operators if needed (e.g., '>', '<')
                    default: console.warn(`Unknown operator ${achievement.criteria.operator} for achievement ${achievementId}`);
                }
            } else if (achievement.criteria?.stat) {
                // Log if the required stat is missing in the user's stats data
                // console.log(`Stat '${achievement.criteria.stat}' not found in user stats for achievement ${achievementId}.`);
            } else {
                 // Handle achievements without stat criteria if necessary (e.g., manual grant)
            }

            // If criteria met, mark for unlock and collect rewards
            if (criteriaMet) {
                console.log(`Criteria MET for achievement: ${achievement.name || achievementId}`);
                newAchievementsUnlocked.push(achievementId);
                needsDbUpdate = true; // We need to update Firestore
                if (achievement.rewards?.title) {
                    rewardsToApply.titles.push(achievement.rewards.title);
                }
                if (achievement.rewards?.rank) {
                    // Consider logic if multiple achievements grant ranks (e.g., take highest?)
                    rewardsToApply.rank = achievement.rewards.rank; // For now, last one wins
                }
                if (achievement.rewards?.rankPoints) {
                    rewardsToApply.rankPoints += achievement.rewards.rankPoints;
                }
            }
        }

        // 3. Apply Updates if New Achievements Were Unlocked
        if (needsDbUpdate && newAchievementsUnlocked.length > 0) {
            console.log(`Unlocking ${newAchievementsUnlocked.length} new achievement(s):`, newAchievementsUnlocked);
            console.log("Applying rewards:", rewardsToApply);

            const batch = db.batch(); // Use a batch for atomic updates
            const userProfileRef = db.collection('users').doc(userId);

            // Update unlocked achievements list
            batch.set(userAchievementsRef, {
                unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsUnlocked)
            }, { merge: true }); // Use merge to not overwrite other fields if any

            // Prepare updates for the user's profile document
            const profileUpdateData = {};
            // Keep track of changes to return the updated profile object
            let updatedLocalProfile = { ...currentUserProfile };

            // Apply Title Rewards
            if (rewardsToApply.titles.length > 0) {
                profileUpdateData.availableTitles = firebase.firestore.FieldValue.arrayUnion(...rewardsToApply.titles);
                // Update local profile state as well
                updatedLocalProfile.availableTitles = [
                    ...new Set([...(updatedLocalProfile.availableTitles || []), ...rewardsToApply.titles])
                ];

                // Equip the first new title if none is currently equipped
                if (!updatedLocalProfile.equippedTitle && rewardsToApply.titles[0]) {
                    profileUpdateData.equippedTitle = rewardsToApply.titles[0];
                    updatedLocalProfile.equippedTitle = rewardsToApply.titles[0];
                    console.log(`Auto-equipping new title: ${rewardsToApply.titles[0]}`);
                }
            }

            // Apply Rank Rewards (if any)
            if (rewardsToApply.rank) {
                profileUpdateData.currentRank = rewardsToApply.rank;
                updatedLocalProfile.currentRank = rewardsToApply.rank;
            }

            // Apply Rank Points (if you have a rankPoints field)
            if (rewardsToApply.rankPoints > 0) {
                 // Assuming you have a 'rankPoints' field in your user profile
                 // profileUpdateData.rankPoints = firebase.firestore.FieldValue.increment(rewardsToApply.rankPoints);
                 // updatedLocalProfile.rankPoints = (updatedLocalProfile.rankPoints || 0) + rewardsToApply.rankPoints;
                 console.warn("Rank points reward found, but 'rankPoints' field update logic is commented out.");
            }

            // Ensure default values if fields were previously empty
            if (!updatedLocalProfile.currentRank) {
                profileUpdateData.currentRank = 'Unranked'; // Set a default if still no rank
                updatedLocalProfile.currentRank = 'Unranked';
            }
             if (updatedLocalProfile.equippedTitle === undefined) { // Check specifically for undefined
                 profileUpdateData.equippedTitle = ''; // Set a default if still no title
                 updatedLocalProfile.equippedTitle = '';
             }


            // Add profile updates to the batch if there are changes
            if (Object.keys(profileUpdateData).length > 0) {
                batch.update(userProfileRef, profileUpdateData);
                console.log("Profile updates added to batch:", profileUpdateData);
            }

            // Commit the batch
            await batch.commit();
            console.log(`Firestore batch committed successfully for UID ${userId}.`);

            // Return the updated profile data reflecting the rewards
            return updatedLocalProfile;

        } else {
            console.log(`No new achievements unlocked for UID ${userId}.`);
            return null; // Indicate no profile update occurred
        }

    } catch (error) {
        console.error(`Error checking/granting achievements for UID ${userId}:`, error);
        return null; // Indicate no profile update occurred due to error
    }
}


// -----------------------------------------------------------------------------
// --- UI Display Helpers (Badges, Rank/Title Selector) ---
// -----------------------------------------------------------------------------

// --- Helper: Display Badges based on the viewed profile's data ---
function displayUserBadges(profileData) {
    profileBadgesContainer.innerHTML = ''; // Clear existing badges
    const userEmail = profileData?.email;
    if (!userEmail) {
        adminTag.style.display = 'none'; // Hide admin tag if no email
        return;
    }

    const emailLower = userEmail.toLowerCase();

    // Check Admin Tag based on VIEWED profile's email
    adminTag.style.display = adminEmails.includes(emailLower) ? 'inline-block' : 'none';

    // Check other badges based on config
    for (const badgeType in badgeConfig) {
        const config = badgeConfig[badgeType];
        if (config.emails.includes(emailLower)) {
            const badgeSpan = document.createElement('span');
            badgeSpan.classList.add('profile-badge', config.className);
            badgeSpan.setAttribute('title', config.title); // Tooltip for badge name
            profileBadgesContainer.appendChild(badgeSpan);
        }
    }
}

// --- Helper: Update Profile Rank/Title Display & Interaction ---
function updateProfileTitlesAndRank(profileData, allowInteraction) {
    if (!rankDisplay || !titleDisplay) {
        console.error("Rank or Title display element not found.");
        return;
    }

    // Reset interaction state
    titleDisplay.classList.remove('selectable-title');
    titleDisplay.removeEventListener('click', handleTitleClick);
    closeTitleSelector(); // Ensure selector is closed if profile data changes

    if (profileData && typeof profileData === 'object') {
        const rank = profileData.currentRank || 'Unranked';
        const title = profileData.equippedTitle || '';
        const available = profileData.availableTitles || [];

        // Update Rank Display
        rankDisplay.textContent = rank;
        // Apply CSS class based on rank for potential styling
        rankDisplay.className = `profile-rank-display rank-${rank.toLowerCase().replace(/\s+/g, '-')}`;

        // Update Title Display
        if (title) {
            titleDisplay.textContent = title;
            titleDisplay.style.display = 'inline-block'; // Show title

            // Enable interaction ONLY if it's the logged-in user's profile AND they have titles available
            if (allowInteraction && available.length > 0) {
                titleDisplay.classList.add('selectable-title');
                titleDisplay.addEventListener('click', handleTitleClick);
            }
        } else {
            // No equipped title
            titleDisplay.textContent = '';
            titleDisplay.style.display = 'none'; // Hide title element

            // Still allow opening selector if titles are available but none equipped
             if (allowInteraction && available.length > 0) {
                 // Maybe add a placeholder or button to select a title?
                 // For now, clicking the (hidden) title won't work, might need another trigger
                 // Or, show a placeholder like "[No Title]" and make that clickable
                 // Example: Display a placeholder if interaction allowed and titles available
                 titleDisplay.textContent = '[Choose Title]';
                 titleDisplay.style.display = 'inline-block';
                 titleDisplay.classList.add('selectable-title', 'no-title-placeholder'); // Add class for styling
                 titleDisplay.addEventListener('click', handleTitleClick);
             }
        }
    } else {
        // No profile data available
        rankDisplay.textContent = '...';
        rankDisplay.className = 'profile-rank-display rank-unranked'; // Default class
        titleDisplay.textContent = '';
        titleDisplay.style.display = 'none';
    }
}

// --- Handle Clicks on the Equipped Title (or placeholder) ---
function handleTitleClick(event) {
    event.stopPropagation(); // Prevent triggering outer listeners
    if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id) return; // Safety check

    if (isTitleSelectorOpen) {
        closeTitleSelector();
    } else if (viewingUserProfileData.profile?.availableTitles?.length > 0) {
        openTitleSelector();
    } else {
        console.log("No available titles to select.");
        // Optionally provide feedback to user (e.g., tooltip, brief message)
    }
}

// --- Open Title Selector Dropdown ---
function openTitleSelector() {
    // Should only be callable if interaction is allowed and titles exist (checked in caller)
    if (isTitleSelectorOpen || !profileIdentifiersDiv || !viewingUserProfileData.profile?.availableTitles?.length > 0) {
        return;
    }

    const availableTitles = viewingUserProfileData.profile.availableTitles;
    const currentEquippedTitle = viewingUserProfileData.profile.equippedTitle || '';

    // Create selector element if it doesn't exist
    if (!titleSelectorElement) {
        titleSelectorElement = document.createElement('div');
        titleSelectorElement.className = 'title-selector';
        // Append it near the title display for better positioning context
        profileIdentifiersDiv.appendChild(titleSelectorElement);
    }

    titleSelectorElement.innerHTML = ''; // Clear previous options

    // Add option to unequip title if one is currently equipped
    if (currentEquippedTitle) {
        const unequipOption = document.createElement('button');
        unequipOption.className = 'title-option title-option-unequip';
        unequipOption.dataset.title = ""; // Represent unequip with empty string
        unequipOption.type = 'button';
        unequipOption.textContent = '[Remove Title]';
        unequipOption.addEventListener('click', handleTitleOptionClick);
        titleSelectorElement.appendChild(unequipOption);
    }


    // Add button for each available title
    availableTitles.forEach(titleOptionText => {
        const optionElement = document.createElement('button');
        optionElement.className = 'title-option';
        optionElement.dataset.title = titleOptionText; // Store title in data attribute
        optionElement.type = 'button';
        optionElement.textContent = titleOptionText;

        // Highlight the currently equipped title
        if (titleOptionText === currentEquippedTitle) {
            optionElement.classList.add('currently-equipped');
            optionElement.setAttribute('aria-pressed', 'true');
        } else {
            optionElement.setAttribute('aria-pressed', 'false');
        }

        optionElement.addEventListener('click', handleTitleOptionClick);
        titleSelectorElement.appendChild(optionElement);
    });

    titleSelectorElement.style.display = 'block'; // Show the dropdown
    isTitleSelectorOpen = true;

    // Add listener to close dropdown when clicking outside
    // Use timeout to ensure this listener is added *after* the current click event finishes
    setTimeout(() => {
        document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true });
    }, 0);
}

// --- Close Title Selector Dropdown ---
function closeTitleSelector() {
    if (!isTitleSelectorOpen || !titleSelectorElement) return;
    titleSelectorElement.style.display = 'none';
    isTitleSelectorOpen = false;
    // Clean up the outside click listener (though 'once' handles it, this is good practice)
    document.removeEventListener('click', handleClickOutsideTitleSelector, { capture: true });
}

// --- Handle Clicks Outside Selector to Close It ---
function handleClickOutsideTitleSelector(event) {
    if (!isTitleSelectorOpen) return;

    // Check if the click was inside the selector itself or on the title display that opened it
    const clickedInsideSelector = titleSelectorElement && titleSelectorElement.contains(event.target);
    const clickedOnTitleDisplay = titleDisplay && titleDisplay.contains(event.target);

    if (clickedInsideSelector || clickedOnTitleDisplay) {
        // Click was inside, re-attach the listener for the *next* click outside
        document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true });
        return;
    }

    // Click was outside, close the selector
    closeTitleSelector();
}

// --- Handle Clicks on a Title Option Button ---
async function handleTitleOptionClick(event) {
    event.stopPropagation(); // Prevent event bubbling
    const selectedTitle = event.currentTarget.dataset.title; // Get title from data attribute
    const currentUserId = loggedInUser?.uid;
    const currentlyViewedProfile = viewingUserProfileData.profile;

    // Safety checks: Ensure it's the logged-in user modifying their own profile
    if (!currentUserId || !currentlyViewedProfile || currentUserId !== currentlyViewedProfile.id) {
        console.error("Attempted to change title for wrong user or not logged in.");
        closeTitleSelector();
        return;
    }

    const currentEquipped = currentlyViewedProfile.equippedTitle || '';

    // Don't do anything if clicking the already equipped title (unless it's the unequip button)
    if (selectedTitle === currentEquipped) {
        closeTitleSelector();
        return;
    }

    // Close selector immediately
    closeTitleSelector();

    // Provide visual feedback
    titleDisplay.textContent = "Updating...";
    titleDisplay.classList.remove('selectable-title'); // Disable clicking while updating

    try {
        const userProfileRef = db.collection('users').doc(currentUserId);
        // Update Firestore with the selected title (empty string for unequip)
        await userProfileRef.update({ equippedTitle: selectedTitle });
        console.log(`Firestore 'users' doc updated title to "${selectedTitle}" for UID ${currentUserId}`);

        // Update local state immediately
        viewingUserProfileData.profile.equippedTitle = selectedTitle;
        // Update cache with the new profile state
        saveCombinedDataToCache(currentUserId, viewingUserProfileData);
        // Refresh the title display area (reenables interaction)
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true);

    } catch (error) {
        console.error("Error updating equipped title in Firestore 'users':", error);
        alert("Failed to update title. Please try again.");
        // Revert local state and UI on error (optional but good UX)
        if (viewingUserProfileData.profile) {
             viewingUserProfileData.profile.equippedTitle = currentEquipped; // Revert local state
        }
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true); // Refresh display with old title
    }
}


// -----------------------------------------------------------------------------
// --- Authentication and Initialization ---
// -----------------------------------------------------------------------------

// --- Auth State Listener ---
auth.onAuthStateChanged(user => {
    loggedInUser = user; // Update global loggedInUser state
    // Determine whose profile to load: URL param > logged-in user > none
    const targetUid = profileUidFromUrl || loggedInUser?.uid;

    console.log(`Auth state changed. Logged in: ${!!user}, Target UID: ${targetUid}`);

    if (targetUid) {
        // User is logged in OR a UID is provided in the URL
        loadingIndicator.style.display = 'none';
        notLoggedInMsg.style.display = 'none';
        profileContent.style.display = 'block';

        // Pre-fetch achievement definitions (can happen in parallel)
        fetchAllAchievements();

        // Load the profile data for the target user
        loadCombinedUserData(targetUid);

        // Show logout button only if viewing own profile
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

// --- Logout Button Event Listener ---
profileLogoutBtn.addEventListener('click', () => {
    const userId = loggedInUser?.uid; // Get ID before sign out

    // Clean up listeners and state related to the logged-out user
    if (titleDisplay) titleDisplay.removeEventListener('click', handleTitleClick);
    closeTitleSelector();

    auth.signOut().then(() => {
        console.log('User signed out successfully.');
        // Clear cached data for the logged-out user
        if (userId) {
            localStorage.removeItem(`poxelProfileCombinedData_${userId}`);
            console.log(`Cleared cache for UID: ${userId}`);
        }
        viewingUserProfileData = {}; // Clear global state
        // The onAuthStateChanged listener will automatically handle UI updates
        // (e.g., showing the "not logged in" message or redirecting)
    }).catch((error) => {
        console.error('Sign out error:', error);
        alert('Error signing out. Please try again.');
    });
});


// -----------------------------------------------------------------------------
// --- Local Storage Caching ---
// -----------------------------------------------------------------------------

// --- Load Combined Data from Local Storage Cache ---
function loadCombinedDataFromCache(viewedUserId) {
    if (!viewedUserId) return false;
    const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
    const cachedDataString = localStorage.getItem(cacheKey);

    if (cachedDataString) {
        try {
            const cachedData = JSON.parse(cachedDataString);
            // Basic validation: Check if it has profile and potentially stats
            if (cachedData && cachedData.profile) {
                viewingUserProfileData = cachedData; // Load into global state
                console.log("Loaded combined data from cache for VIEWED UID:", viewedUserId);
                // Display cached data immediately for faster perceived load
                displayProfileData(viewingUserProfileData.profile, viewingUserProfileData.stats);
                return true; // Indicate cache was successfully loaded
            } else {
                console.warn("Cached data format invalid for UID:", viewedUserId);
                localStorage.removeItem(cacheKey); // Remove invalid cache entry
                viewingUserProfileData = {};
                return false;
            }
        } catch (error) {
            console.error("Error parsing combined cached data:", error);
            localStorage.removeItem(cacheKey); // Remove corrupted cache entry
            viewingUserProfileData = {};
            return false;
        }
    } else {
        // console.log("No combined data found in cache for VIEWED UID:", viewedUserId);
        viewingUserProfileData = {}; // Ensure state is clear if no cache
        return false; // Indicate cache was not found or not loaded
    }
}

// --- Save Combined Data to Local Storage Cache ---
function saveCombinedDataToCache(viewedUserId, combinedData) {
     // Ensure we have valid data and a user ID to cache for
     if (!viewedUserId || !combinedData || !combinedData.profile) {
         console.warn("Attempted to save invalid data to cache. Aborted.", { viewedUserId, combinedData });
         return;
     }

     const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
     try {
         // Add a timestamp to the cached data (optional, for expiry logic later)
         // combinedData.cacheTimestamp = Date.now();
         localStorage.setItem(cacheKey, JSON.stringify(combinedData));
         // console.log("Saved combined data to cache for VIEWED UID:", viewedUserId);
     } catch(error) {
         console.error("Error saving combined data to cache:", error);
         // Handle potential storage limit errors (though unlikely for this small data)
         if (error.name === 'QuotaExceededError') {
             alert('Could not save profile data locally - browser storage might be full.');
             // Consider implementing cache clearing logic here
         }
     }
}

// --- Initial Log ---
console.log("Profile script initialized. Waiting for Auth state...");
// Initial data load is triggered by the onAuthStateChanged listener.
