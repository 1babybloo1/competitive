// --- Firebase Configuration ---
const firebaseConfig = {
    // IMPORTANT: Replace with your REAL Firebase configuration values
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
};

// --- Initialize Firebase (Compat Version) ---
// Check if Firebase is already initialized to prevent errors
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// --- Constants ---
const BANNED_USERS_COLLECTION = 'banned_users';
const USERS_COLLECTION = 'users';
const LEADERBOARD_COLLECTION = 'leaderboard'; // Assuming this is where stats are stored
const ACHIEVEMENTS_COLLECTION = 'achievements';
const USER_ACHIEVEMENTS_COLLECTION = 'userAchievements';

// --- Configuration ---
// List of emails considered administrators
const adminEmails = [
    'trixdesignsofficial@gmail.com', // Replace/add your admin emails
    'jackdmbell@outlook.com'
].map(email => email.toLowerCase()); // Normalize to lowercase for comparison

// Configuration for user badges based on email
const badgeConfig = {
    // type: { emails: [list_of_lowercase_emails], className: 'css-class', title: 'Hover Title' }
    verified: { emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()), className: 'badge-verified', title: 'Verified' },
    creator: { emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()), className: 'badge-creator', title: 'Content Creator' },
    moderator: { emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()), className: 'badge-moderator', title: 'Moderator' }
};

// --- DOM Elements ---
// Select elements needed for profile display and interaction
const profileContentDiv = document.getElementById('profile-content'); // Main container for profile info
const loadingIndicatorDiv = document.getElementById('loading-profile'); // Loading message container
const notLoggedInMsgDiv = document.getElementById('not-logged-in'); // Error/Not logged in container
const profilePicDiv = document.getElementById('profile-pic');
const usernameDisplayH2 = document.getElementById('profile-username');
const emailDisplayP = document.getElementById('profile-email');
const statsDisplayDiv = document.getElementById('stats-display'); // Container for stats grid
const profileLogoutBtn = document.getElementById('profile-logout-btn');
const adminTagSpan = document.getElementById('admin-tag'); // Admin indicator
const rankDisplaySpan = document.getElementById('profile-rank');
const titleDisplaySpan = document.getElementById('profile-title');
const profileIdentifiersDiv = document.querySelector('.profile-identifiers'); // Container for rank/title
const profileBadgesContainerSpan = document.getElementById('profile-badges-container');
const banStatusDisplayDiv = document.getElementById('ban-status-display'); // Container for ban info

// --- Global State ---
let loggedInUser = null; // Holds the currently authenticated Firebase user object
let viewingProfileUid = null; // The UID of the profile currently being viewed (from URL or loggedInUser)
let viewingUserProfileData = { // Holds combined data for the VIEWED profile
    profile: null, // Data from /users/{uid}
    stats: null,   // Data from /leaderboard/{uid}
    isBanned: false,
    banReason: null
};
let allAchievements = null; // Cache for achievement definitions from /achievements
let isTitleSelectorOpen = false; // Flag for title dropdown state
let titleSelectorElement = null; // Reference to the dynamically created title dropdown
let profileDataListenerUnsubscribe = null; // Function to detach Firestore listener

// --- Helper: Escape HTML ---
// Basic function to prevent XSS by escaping HTML special characters
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    try {
        return unsafe
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, """)
             .replace(/'/g, "'");
    } catch(e) {
        console.warn("HTML escape failed for:", unsafe, e);
        return "Error"; // Return a placeholder on failure
    }
}

// --- Helper: Fetch Achievement Definitions ---
// Fetches all achievement documents and caches them
async function fetchAllAchievements() {
    // Return cached data if available
    if (allAchievements) return allAchievements;
    try {
        console.log("Fetching achievement definitions...");
        const snapshot = await db.collection(ACHIEVEMENTS_COLLECTION).get();
        allAchievements = {}; // Initialize cache object
        snapshot.forEach(doc => {
            allAchievements[doc.id] = { id: doc.id, ...doc.data() };
        });
        console.log("Fetched achievement definitions:", allAchievements);
        return allAchievements;
    } catch (error) {
        console.error("Error fetching achievements:", error);
        return null; // Return null on error
    }
}

// --- Helper: Display User Badges ---
// Dynamically creates and adds badge elements based on profile email and config
function displayUserBadges(profileData) {
    if (!profileBadgesContainerSpan) return; // Ensure container exists
    profileBadgesContainerSpan.innerHTML = ''; // Clear previous badges
    const userEmail = profileData?.email?.toLowerCase();
    if (!userEmail) return; // Exit if no email

    // Show/Hide Admin Tag based on adminEmails list
    adminTagSpan.style.display = adminEmails.includes(userEmail) ? 'inline-block' : 'none';

    // Iterate through badge configurations
    for (const type in badgeConfig) {
        if (badgeConfig[type].emails.includes(userEmail)) {
            // Create badge element if email matches
            const badgeSpan = document.createElement('span');
            badgeSpan.className = `profile-badge ${badgeConfig[type].className}`;
            badgeSpan.title = badgeConfig[type].title; // Set hover title
            profileBadgesContainerSpan.appendChild(badgeSpan);
        }
    }
}

// --- UI State Management ---
// Functions to show/hide different content sections

function showLoadingState() {
    profileContentDiv.style.display = 'none';
    notLoggedInMsgDiv.style.display = 'none';
    loadingIndicatorDiv.style.display = 'flex'; // Use flex to center content
}

function showErrorState(message = "Profile information is unavailable.") {
    profileContentDiv.style.display = 'none';
    loadingIndicatorDiv.style.display = 'none';
    notLoggedInMsgDiv.innerHTML = `<p>${escapeHtml(message)}</p>`; // Display error message
    notLoggedInMsgDiv.style.display = 'flex';

    // Clear potentially stale profile data from UI elements
    clearProfileUI();
}

function showProfileContent() {
    loadingIndicatorDiv.style.display = 'none';
    notLoggedInMsgDiv.style.display = 'none';
    profileContentDiv.style.display = 'block'; // Show the main profile container
}

// Helper to reset UI elements to default/empty state
function clearProfileUI() {
     usernameDisplayH2.textContent = "Error";
     profilePicDiv.textContent = "!";
     adminTagSpan.style.display = 'none';
     if (profileBadgesContainerSpan) profileBadgesContainerSpan.innerHTML = '';
     updateProfileTitlesAndRank(null, false); // Clear rank/title
     if (emailDisplayP) emailDisplayP.style.display = 'none';
     if (statsDisplayDiv) statsDisplayDiv.innerHTML = '<p>Stats unavailable.</p>';
     if (banStatusDisplayDiv) banStatusDisplayDiv.style.display = 'none';
     // Remove banned class if present
     if (profileContentDiv) profileContentDiv.classList.remove('banned-profile');
}


// --- Auth State Listener ---
// Core logic that reacts to user login/logout
auth.onAuthStateChanged(async user => {
    loggedInUser = user; // Update global reference to logged-in user

    // Determine the UID of the profile to view: Check URL param first, then logged-in user
    const urlParams = new URLSearchParams(window.location.search);
    const profileUidFromUrl = urlParams.get('uid'); // Get 'uid' parameter from URL (e.g., profile.html?uid=USER_ID)
    const targetUid = profileUidFromUrl || loggedInUser?.uid; // Use URL UID if present, otherwise logged-in user's UID

    console.log(`Auth state change: LoggedIn=${!!user}, TargetUID=${targetUid}`);

    if (targetUid) {
        // Only reload if the target UID has changed
        if (targetUid !== viewingProfileUid) {
            viewingProfileUid = targetUid; // Update the currently viewed UID
            await loadAndDisplayUserProfile(viewingProfileUid); // Load the new profile
        } else {
            // If target hasn't changed (e.g., user refreshed, or navigated back),
            // but maybe login state did, re-render with existing data if available.
            if (viewingUserProfileData.profile) {
                 displayProfileData(viewingUserProfileData); // Re-render might update things like email visibility
            } else {
                 // If data isn't loaded yet (e.g., fast auth change), load it
                 await loadAndDisplayUserProfile(viewingProfileUid);
            }
        }
        // Show logout button only if the logged-in user is viewing their own profile
        profileLogoutBtn.style.display = (loggedInUser && loggedInUser.uid === targetUid) ? 'inline-block' : 'none';

    } else {
        // No target UID (not logged in, and no UID in URL)
        viewingProfileUid = null;
        showErrorState("Please log in to view your profile or provide a user ID in the URL.");
        profileLogoutBtn.style.display = 'none';
        clearProfileListener(); // Detach any existing Firestore listener
        clearProfileUI(); // Clear the UI
    }
});

// --- Detach Firestore Listener ---
// Stops listening for real-time updates to prevent memory leaks/unnecessary reads
function clearProfileListener() {
    if (profileDataListenerUnsubscribe) {
        console.log("Detaching Firestore profile listener for UID:", viewingProfileUid);
        profileDataListenerUnsubscribe(); // Execute the unsubscribe function returned by onSnapshot
        profileDataListenerUnsubscribe = null;
    }
}

// --- Load and Display User Profile (Main Function) ---
// Fetches all necessary data (ban status, profile, stats) for a given user ID
async function loadAndDisplayUserProfile(userId) {
    if (!userId) {
        showErrorState("No user ID specified.");
        return;
    }
    console.log(`Initiating profile load for UID: ${userId}`);
    showLoadingState(); // Show loading indicator
    clearProfileListener(); // Ensure no old listeners are running

    try {
        // 1. Check Ban Status first
        const banDocRef = db.collection(BANNED_USERS_COLLECTION).doc(userId);
        const banDoc = await banDocRef.get();
        const isBanned = banDoc.exists;
        const banReason = isBanned ? (banDoc.data()?.reason || "No reason provided.") : null;

        if (isBanned) console.log(`User ${userId} IS BANNED. Reason: ${banReason}`);

        // 2. Get User Profile & Leaderboard Stats (Initial Load)
        const userProfileRef = db.collection(USERS_COLLECTION).doc(userId);
        const leaderboardStatsRef = db.collection(LEADERBOARD_COLLECTION).doc(userId);

        // Fetch profile and stats data concurrently
        const [profileSnap, statsSnap] = await Promise.all([
            userProfileRef.get(),
            leaderboardStatsRef.get() // Assumes stats are in leaderboard collection
        ]).catch(err => { throw new Error(`Failed to fetch profile/stats: ${err.message}`); }); // Add error handling for Promise.all

        let profileData = null;
        let statsData = null;

        if (profileSnap.exists) {
            profileData = { id: profileSnap.id, ...profileSnap.data() };
        } else {
             console.warn(`User profile document does NOT exist for UID: ${userId}`);
             // Special handling if user is banned but profile doc is missing
             if (isBanned) {
                 showBannedOnlyState(userId, banReason); // Show a specific banned state
                 return; // Stop further processing
             }
             // Attempt to create profile ONLY if it's the logged-in user viewing their own (non-existent) profile
             else if (loggedInUser && loggedInUser.uid === userId) {
                 console.log("Attempting to create profile for logged-in user.");
                 profileData = await createUserProfileDocument(userId, loggedInUser);
                 if (!profileData) { throw new Error("Profile creation failed."); }
             } else {
                  // Profile doesn't exist, not banned, not logged-in user viewing self
                  showErrorState("Profile not found."); return;
             }
        }

        // Check if stats document exists
        statsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null;
        if (!statsData) console.log(`No leaderboard stats found for UID: ${userId}`);

        // Store the fetched data globally for the viewed profile
        viewingUserProfileData = { profile: profileData, stats: statsData, isBanned: isBanned, banReason: banReason };

        // Display the combined data
        displayProfileData(viewingUserProfileData);
        showProfileContent(); // Show the main profile section

        // 3. Attach Real-time Listener (Optional - Uncomment if needed)
        // This keeps the profile/stats updated live. Note: Ban status isn't real-time here.
        // attachRealtimeListener(userId);

        // 4. Check for Achievements (only if viewing own profile and data exists)
        if (loggedInUser && loggedInUser.uid === userId && viewingUserProfileData.profile && viewingUserProfileData.stats) {
            console.log("Checking achievements for own profile...");
            await checkAndApplyAchievements(userId);
        }

    } catch (error) {
        console.error(`Error loading profile data for ${userId}:`, error);
        showErrorState(`Error loading profile: ${error.message}`);
    }
}

// --- (Optional) Attach Real-time Listener ---
/* // Uncomment this function and the call in loadAndDisplayUserProfile if you want live updates
function attachRealtimeListener(userId) {
    clearProfileListener(); // Ensure no duplicate listeners
    console.log(`Attaching real-time listener for UID: ${userId}`);

    const userProfileRef = db.collection(USERS_COLLECTION).doc(userId);
    const leaderboardStatsRef = db.collection(LEADERBOARD_COLLECTION).doc(userId);

    // Listen specifically to the user profile document
    profileDataListenerUnsubscribe = userProfileRef.onSnapshot(async (profileSnap) => {
        console.log(`Real-time update received for profile UID: ${userId}`);
        const profileExists = profileSnap.exists;
        const updatedProfileData = profileExists ? { id: profileSnap.id, ...profileSnap.data() } : null;

        // Fetch the latest stats data whenever the profile changes to keep them in sync
        // (Alternatively, set up a separate listener for stats if they update independently often)
        try {
            const statsSnap = await leaderboardStatsRef.get();
            const updatedStatsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null;

            // Get current ban status (not real-time from this listener)
            const isBanned = viewingUserProfileData.isBanned;
            const banReason = viewingUserProfileData.banReason;

            if (!profileExists && !isBanned) {
                 console.warn("Profile document deleted and user is not banned.");
                 showErrorState("Profile not found."); // Handle profile deletion
                 clearProfileListener(); // Stop listening if profile deleted
                 return;
            } else if (!profileExists && isBanned) {
                 showBannedOnlyState(userId, banReason); // Show banned state even if profile deleted
            } else {
                 // Update global state and re-render the UI
                 viewingUserProfileData = { profile: updatedProfileData, stats: updatedStatsData, isBanned: isBanned, banReason: banReason };
                 displayProfileData(viewingUserProfileData);
            }

        } catch (statsError) {
             console.error(`Error fetching stats during real-time update for ${userId}:`, statsError);
             // Decide how to handle: show partial update, show error, etc.
        }

    }, (error) => {
        console.error(`Error in profile listener for UID ${userId}:`, error);
        showErrorState("Error listening for profile updates.");
        clearProfileListener(); // Stop listening on error
    });
}
*/


// --- Central Function to Display Profile Data ---
// Updates the UI based on the provided profile, stats, and ban data
function displayProfileData(data) {
    const { profile, stats, isBanned, banReason } = data;

    // Handle cases where profile data might be missing
    if (!profile && !isBanned) {
         showErrorState("Profile data unavailable."); return;
    }
    if (!profile && isBanned) { // User is banned, but profile doc might be missing/deleted
         showBannedOnlyState(viewingProfileUid, banReason); return;
    }

    // --- Apply Banned Styling and Display Ban Message ---
    if (isBanned) {
         profileContentDiv.classList.add('banned-profile'); // Add class for banned styling
         banStatusDisplayDiv.innerHTML = `<strong>BANNED</strong><span>Reason: ${escapeHtml(banReason)}</span>`;
         banStatusDisplayDiv.style.display = 'block'; // Show the ban message div
    } else {
         profileContentDiv.classList.remove('banned-profile'); // Remove banned styling class
         banStatusDisplayDiv.style.display = 'none'; // Hide the ban message div
    }

    // --- Render standard profile info ---
    const displayName = profile.displayName || 'Unnamed User';
    // Use initials from displayName for avatar, fallback to '??'
    const avatarInitials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || "??";

    usernameDisplayH2.textContent = displayName;
    profilePicDiv.textContent = avatarInitials;

    // Determine if the logged-in user is viewing their own profile
    const isOwnProfile = loggedInUser && loggedInUser.uid === profile.id;

    // Conditionally Display Email - only show if viewing own profile
    emailDisplayP.textContent = profile.email || 'Email not available';
    emailDisplayP.style.display = isOwnProfile ? 'block' : 'none';

    // Display Badges & Admin Tag
    displayUserBadges(profile);

    // Update Rank/Title & Interactivity (allow interaction only on own profile)
    updateProfileTitlesAndRank(profile, isOwnProfile && !isBanned); // Disable title interaction if banned

    // Display Stats
    displayStats(stats);

    // Ensure the main profile content area is visible
    showProfileContent();
}

// --- Display Banned Only State ---
// Special UI state for when a user is banned and their profile doc might be missing
function showBannedOnlyState(userId, reason) {
     showProfileContent(); // Show the main content area
     profileContentDiv.classList.add('banned-profile'); // Apply banned styling
     banStatusDisplayDiv.innerHTML = `<strong>BANNED</strong><span>Reason: ${escapeHtml(reason)}</span>`;
     banStatusDisplayDiv.style.display = 'block'; // Show ban message

     // Show placeholders/error messages for other potentially missing data
     usernameDisplayH2.textContent = `User (Banned)`;
     profilePicDiv.textContent = 'X'; // Indicate banned status in avatar
     adminTagSpan.style.display = 'none'; // Hide admin tag
     if (profileBadgesContainerSpan) profileBadgesContainerSpan.innerHTML = ''; // Clear badges
     updateProfileTitlesAndRank(null, false); // Clear rank/title, disable interaction
     if (emailDisplayP) emailDisplayP.style.display = 'none'; // Hide email
     if (statsDisplayDiv) statsDisplayDiv.innerHTML = '<p><em>Profile data unavailable due to ban.</em></p>'; // Specific stats message
}


// --- Client-Side User Profile Document Creation ---
// Creates a basic profile document in Firestore if one doesn't exist for the logged-in user
async function createUserProfileDocument(userId, authUser) {
    console.warn(`Attempting client-side creation of user profile doc for UID: ${userId}`);
    const userDocRef = db.collection(USERS_COLLECTION).doc(userId);

    // Attempt to get a reasonable display name, fallback to generic User_ID
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;

    // Define the default structure for a new user profile
    const defaultProfileData = {
        email: authUser.email || null, // Use email from auth if available
        displayName: displayName,
        currentRank: "Unranked", // Starting rank
        equippedTitle: "", // No title initially
        availableTitles: [], // Empty list of earned titles
        friends: [], // Empty friends list
        createdAt: firebase.firestore.FieldValue.serverTimestamp() // Record creation time
    };

    try {
        // Use set() to create the document (doesn't merge, fails if exists - should be fine here as we check exists before calling)
        await userDocRef.set(defaultProfileData);
        console.log(`Successfully created user profile document for UID: ${userId}`);
        // Return the data structure, including the ID, simulating a read
        return { id: userId, ...defaultProfileData, createdAt: new Date() }; // Use current date as approximation for timestamp
    } catch (error) {
        console.error(`Error creating user profile document for ${userId}:`, error);
        // Potentially show a user-facing error message
        showErrorState("Error setting up your profile. Please try refreshing or contact support.");
        return null; // Indicate failure
    }
}

// --- Achievement Checking ---
// Checks if the user meets criteria for any unearned achievements based on stats
async function checkAndApplyAchievements(userId) {
     // Ensure achievement definitions are loaded
     if (!allAchievements) await fetchAllAchievements();
     // Ensure necessary data is available before proceeding
     if (!allAchievements || !viewingUserProfileData.profile || !viewingUserProfileData.stats) {
          console.log("Skipping achievement check: missing required data (achievements, profile, or stats)."); return;
     }

     console.log(`Checking achievements for UID ${userId}`);
     try {
         // Get the user's current list of unlocked achievements
         const userAchievementsRef = db.collection(USER_ACHIEVEMENTS_COLLECTION).doc(userId);
         const userAchievementsDoc = await userAchievementsRef.get();
         // Initialize unlocked list, handle case where doc doesn't exist
         const unlockedIds = userAchievementsDoc.exists ? (userAchievementsDoc.data()?.unlocked || []) : [];

         let newAchievementsUnlocked = []; // Store IDs of newly unlocked achievements
         let rewardsToApply = { titles: [], rank: null, rankPoints: 0 }; // Accumulate rewards
         let needsDbUpdate = false; // Flag if any changes need to be written

         // Iterate through all defined achievements
         for (const achievementId in allAchievements) {
              // Skip if already unlocked
              if (unlockedIds.includes(achievementId)) continue;

              const achievement = allAchievements[achievementId];
              let criteriaMet = false; // Flag for this specific achievement

              // --- Criteria Evaluation Logic ---
              // Example: Check based on a single stat value
              if (achievement.criteria?.stat && viewingUserProfileData.stats[achievement.criteria.stat] !== undefined) {
                  const statValue = viewingUserProfileData.stats[achievement.criteria.stat];
                  const requiredValue = achievement.criteria.value;
                  switch (achievement.criteria.operator) {
                      case '>=': criteriaMet = statValue >= requiredValue; break;
                      case '<=': criteriaMet = statValue <= requiredValue; break;
                      case '==': criteriaMet = statValue == requiredValue; break; // Use == for potential type flexibility, or === for strict
                      // Add more operators (>, <, !=) if needed
                      default: console.warn(`Unknown operator '${achievement.criteria.operator}' for achievement ${achievementId}`);
                  }
              }
              // Add more complex criteria checks here (e.g., multiple stats, profile fields, specific dates)
              // --- End Criteria Evaluation ---

              // If criteria met, record achievement and rewards
              if (criteriaMet) {
                  console.log(`Criteria MET for achievement: ${achievement.name || achievementId}`);
                  newAchievementsUnlocked.push(achievementId);
                  needsDbUpdate = true; // Mark that DB write is needed
                  // Accumulate rewards
                  if (achievement.rewards?.title) rewardsToApply.titles.push(achievement.rewards.title);
                  // Assuming only one rank reward can be applied, last one wins
                  if (achievement.rewards?.rank) rewardsToApply.rank = achievement.rewards.rank;
                  if (achievement.rewards?.rankPoints) rewardsToApply.rankPoints += achievement.rewards.rankPoints; // Example: sum points
              }
         } // End loop through allAchievements

         // If new achievements were unlocked, update Firestore
         if (needsDbUpdate && newAchievementsUnlocked.length > 0) {
             console.log("Applying new achievements:", newAchievementsUnlocked, "with rewards:", rewardsToApply);
             const batch = db.batch(); // Use a batch for atomic writes
             const userProfileRef = db.collection(USERS_COLLECTION).doc(userId);

             // 1. Update the list of unlocked achievements for the user
             batch.set(userAchievementsRef, {
                 unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsUnlocked) // Atomically add new IDs
             }, { merge: true }); // Merge ensures we don't overwrite other fields in userAchievements doc

             // 2. Prepare updates for the user's main profile document based on rewards
             const profileUpdateData = {};
             let profileNeedsUpdate = false; // Flag if profile doc needs updating

             // Add earned titles to availableTitles array
             if (rewardsToApply.titles.length > 0) {
                 profileUpdateData.availableTitles = firebase.firestore.FieldValue.arrayUnion(...rewardsToApply.titles);
                 // Automatically equip the first new title ONLY if no title is currently equipped
                 if (!viewingUserProfileData.profile.equippedTitle && rewardsToApply.titles[0]) {
                      profileUpdateData.equippedTitle = rewardsToApply.titles[0];
                      console.log(`Auto-equipping new title: ${rewardsToApply.titles[0]}`);
                 }
                 profileNeedsUpdate = true;
             }
             // Update rank if a new rank was awarded
             if (rewardsToApply.rank) {
                 // Optional: Add logic here to only update rank if it's higher than current rank
                 profileUpdateData.currentRank = rewardsToApply.rank;
                 profileNeedsUpdate = true;
             }
             // Add rank points logic if applicable (might need reading current points first - more complex)
             // if (rewardsToApply.rankPoints > 0) { profileUpdateData.rankPoints = firebase.firestore.FieldValue.increment(rewardsToApply.rankPoints); profileNeedsUpdate = true; }

             // If profile needs updates, add the update operation to the batch
             if (profileNeedsUpdate) {
                 batch.update(userProfileRef, profileUpdateData);
             }

             // Commit all batched writes
             await batch.commit();
             console.log(`Achievements and rewards applied successfully in Firestore for UID ${userId}.`);

             // IMPORTANT: Reload profile data locally to reflect changes immediately in the UI
             // This avoids waiting for the real-time listener (if active) or needing a refresh
             console.log("Reloading profile data after applying achievements...");
             await loadAndDisplayUserProfile(userId);

         } else {
             console.log(`No new achievements to apply for UID ${userId}.`);
         }
     } catch (error) {
         console.error(`Error checking/granting achievements for ${userId}:`, error);
         // Optionally inform user of error
     }
}

// --- Display Stats Grid ---
// Renders the statistics items based on fetched stats data
function displayStats(statsData) {
    if (!statsDisplayDiv) return; // Ensure container exists
    statsDisplayDiv.innerHTML = ''; // Clear previous stats/loading message

    // Handle cases where stats are missing or not an object
    if (!statsData || typeof statsData !== 'object' || Object.keys(statsData).length === 0) {
        statsDisplayDiv.innerHTML = '<p>Leaderboard stats unavailable.</p>';
        return;
    }

    // Define a preferred order and titles for stats
    const statDisplayConfig = {
        points: 'Points',
        wins: 'Wins',
        losses: 'Losses',
        matches: 'Matches Played',
        kdRatio: 'K/D Ratio', // Example: Calculated stat
        // Add more stats here as needed
    };

    let statsAddedCount = 0;

    // Add stats in the preferred order first
    for (const key in statDisplayConfig) {
         let value = statsData[key];
         if (value !== undefined && value !== null) {
              // Special formatting for K/D ratio
              if (key === 'kdRatio' && typeof value === 'number') {
                  value = value.toFixed(2); // Format to 2 decimal places
              }
              statsDisplayDiv.appendChild(createStatItem(statDisplayConfig[key], value));
              statsAddedCount++;
         }
    }

    // Add any other stats present in the data but not in the config (optional)
    /* // Uncomment if you want to display all extra stats automatically
    for (const key in statsData) {
         if (!statDisplayConfig.hasOwnProperty(key) && key !== 'id' && key !== 'name' && key !== 'avatar') { // Exclude known non-stat fields
               let title = key.charAt(0).toUpperCase() + key.slice(1); // Basic capitalization
               statsDisplayDiv.appendChild(createStatItem(title, statsData[key]));
               statsAddedCount++;
         }
    }
    */

    // If after checking everything, no stats were actually displayed
    if (statsAddedCount === 0) {
        statsDisplayDiv.innerHTML = '<p>No specific leaderboard stats found.</p>';
    }
}

// --- Helper: Create a Single Stat Item Element ---
// Generates the HTML structure for one stat box
function createStatItem(title, value) {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('stat-item');

    const titleH4 = document.createElement('h4');
    titleH4.textContent = title;

    const valueP = document.createElement('p');
    // Display '-' if value is null or undefined
    valueP.textContent = (value !== null && value !== undefined) ? value : '-';

    itemDiv.appendChild(titleH4);
    itemDiv.appendChild(valueP);
    return itemDiv;
}

// --- Helper: Update Profile Rank/Title Display ---
// Updates the rank span and title span, adding interactivity if allowed
function updateProfileTitlesAndRank(profileData, allowInteraction) {
    if (!rankDisplaySpan || !titleDisplaySpan) return; // Ensure elements exist

    // Reset title interactivity
    titleDisplaySpan.classList.remove('selectable-title');
    titleDisplaySpan.onclick = null; // Remove any previous click listener

    if (profileData && typeof profileData === 'object') {
        const rank = profileData.currentRank || 'Unranked';
        const title = profileData.equippedTitle || '';
        const available = profileData.availableTitles || [];

        // Update Rank display
        rankDisplaySpan.textContent = rank;
        // Apply CSS class based on rank name (e.g., rank-unranked, rank-gold)
        rankDisplaySpan.className = `profile-rank-display rank-${rank.toLowerCase().replace(/\s+/g, '-')}`;

        // Update Title display
        if (title) {
            titleDisplaySpan.textContent = `"${escapeHtml(title)}"`; // Add quotes and escape
            titleDisplaySpan.style.display = 'inline-block'; // Show the title span
            // Enable title selection dropdown if allowed and titles are available
            if (allowInteraction && available.length > 0) {
                titleDisplaySpan.classList.add('selectable-title'); // Add class for pointer/underline
                titleDisplaySpan.onclick = handleTitleClick; // Attach listener to open dropdown
            }
        } else {
            // Hide title span if no title is equipped
            titleDisplaySpan.textContent = '';
            titleDisplaySpan.style.display = 'none';
        }
    } else {
        // Clear display if no profile data is provided (e.g., during loading/error)
        rankDisplaySpan.textContent = '...';
        rankDisplaySpan.className = 'profile-rank-display rank-unranked'; // Default style
        titleDisplaySpan.textContent = '';
        titleDisplaySpan.style.display = 'none';
    }
}

// --- Title Selection Logic ---

// Handles click on the equipped title span
function handleTitleClick(event) {
    event.stopPropagation(); // Prevent click from immediately closing dropdown
    if (isTitleSelectorOpen) {
        closeTitleSelector();
    } else if (viewingUserProfileData.profile?.availableTitles?.length > 0) {
        // Only open if viewing own profile (checked by allowInteraction in updateProfileTitlesAndRank)
        // and there are titles available
        openTitleSelector();
    }
}

// Creates and displays the title selection dropdown
function openTitleSelector() {
    // Double-check conditions for safety
    if (!loggedInUser || loggedInUser.uid !== viewingUserProfileData.profile?.id || isTitleSelectorOpen) return;

    const availableTitles = viewingUserProfileData.profile.availableTitles;
    const currentEquippedTitle = viewingUserProfileData.profile.equippedTitle || '';
    if (!availableTitles || availableTitles.length === 0) return;

    // Create dropdown element if it doesn't exist
    if (!titleSelectorElement) {
        titleSelectorElement = document.createElement('div');
        titleSelectorElement.className = 'title-selector';
        // Append dropdown inside the container holding rank/title for correct positioning
        profileIdentifiersDiv.appendChild(titleSelectorElement);
    }

    titleSelectorElement.innerHTML = ''; // Clear previous options

    // Add an option to unequip title
    const unequipBtn = document.createElement('button');
    unequipBtn.className = 'title-option';
    unequipBtn.dataset.title = ""; // Represents unequipping
    unequipBtn.type = 'button';
    unequipBtn.textContent = "None"; // Display text for unequip
    if (currentEquippedTitle === "") unequipBtn.classList.add('currently-equipped');
    unequipBtn.onclick = handleTitleOptionClick;
    titleSelectorElement.appendChild(unequipBtn);


    // Populate dropdown with available titles
    availableTitles.forEach(title => {
        const optionBtn = document.createElement('button');
        optionBtn.className = 'title-option';
        optionBtn.dataset.title = title; // Store title in data attribute
        optionBtn.type = 'button';
        optionBtn.textContent = escapeHtml(title); // Display title text (escaped)
        // Highlight the currently equipped title
        if (title === currentEquippedTitle) {
            optionBtn.classList.add('currently-equipped');
        }
        optionBtn.onclick = handleTitleOptionClick; // Attach click handler
        titleSelectorElement.appendChild(optionBtn);
    });

    titleSelectorElement.style.display = 'block'; // Show the dropdown
    isTitleSelectorOpen = true;

    // Add a listener to close the dropdown when clicking outside of it
    // Use timeout to prevent the current click from triggering it immediately
    setTimeout(() => {
        document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true });
    }, 0);
}

// Closes the title selection dropdown
function closeTitleSelector() {
    if (!isTitleSelectorOpen || !titleSelectorElement) return;
    titleSelectorElement.style.display = 'none';
    isTitleSelectorOpen = false;
    // Clean up the outside click listener (though 'once' handles it, this is explicit)
    document.removeEventListener('click', handleClickOutsideTitleSelector, { capture: true });
}

// Listener to handle clicks outside the title selector dropdown
function handleClickOutsideTitleSelector(event) {
    if (!isTitleSelectorOpen) return; // Should not happen if logic is correct

    // Check if the click occurred inside the selector or on the title itself
    const clickedInsideSelector = titleSelectorElement && titleSelectorElement.contains(event.target);
    const clickedOnTitle = titleDisplaySpan && titleDisplaySpan.contains(event.target);

    if (clickedInsideSelector || clickedOnTitle) {
        // Click was inside, re-attach the listener because 'once' removed it
        setTimeout(() => {
            document.addEventListener('click', handleClickOutsideTitleSelector, { capture: true, once: true });
        }, 0);
        return; // Do not close
    }

    // Click was outside, close the dropdown
    closeTitleSelector();
}

// Handles click on a specific title option in the dropdown
async function handleTitleOptionClick(event) {
    event.stopPropagation(); // Prevent event bubbling up to outside click listener
    const selectedTitle = event.currentTarget.dataset.title; // Get title from data attribute
    const currentUserId = loggedInUser?.uid;

    // Ensure user is logged in, viewing own profile, and selected title is different
    if (!currentUserId || currentUserId !== viewingUserProfileData.profile?.id || selectedTitle === undefined || selectedTitle === viewingUserProfileData.profile.equippedTitle) {
        closeTitleSelector(); // Close dropdown without action
        return;
    }

    closeTitleSelector(); // Close dropdown immediately

    const oldTitle = viewingUserProfileData.profile.equippedTitle; // Store old title for UI rollback on error
    // Provide visual feedback that update is in progress
    titleDisplaySpan.textContent = "Updating...";
    titleDisplaySpan.classList.remove('selectable-title'); // Temporarily disable clicking
    titleDisplaySpan.onclick = null;

    try {
        // Update the equippedTitle field in the user's document in Firestore
        await db.collection(USERS_COLLECTION).doc(currentUserId).update({
            equippedTitle: selectedTitle // Update to the newly selected title ("" for unequip)
        });
        console.log(`Title updated successfully to "${selectedTitle}" for UID ${currentUserId}`);

        // Update local state immediately for faster UI feedback
        if (viewingUserProfileData.profile) {
            viewingUserProfileData.profile.equippedTitle = selectedTitle;
        }
        // Re-render the title section with the new title and re-enable interaction
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true);

    } catch (error) {
        console.error("Error updating equipped title:", error);
        alert("Failed to update title. Please try again."); // Inform user

        // Rollback UI to the previous state if Firestore update failed
        if (viewingUserProfileData.profile) {
            viewingUserProfileData.profile.equippedTitle = oldTitle; // Restore old title in local state
        }
        // Re-render with the old title, re-enabling interaction
        updateProfileTitlesAndRank(viewingUserProfileData.profile, true);
    }
}

// --- Logout Button ---
// Add event listener safely, checking if the button exists first
if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener('click', () => {
        console.log("Logout button clicked.");
        closeTitleSelector(); // Ensure title dropdown is closed on logout
        clearProfileListener(); // Detach Firestore listener

        auth.signOut().then(() => {
            console.log('User signed out successfully.');
            // Global state (loggedInUser) will be updated by onAuthStateChanged
            // onAuthStateChanged will then handle UI changes (showing error/redirecting)
            // Clear local profile data immediately
            viewingUserProfileData = { profile: null, stats: null, isBanned: false, banReason: null };
            // Optional: Redirect immediately after sign out
            // window.location.href = 'index.html';
        }).catch((error) => {
            console.error('Sign out error:', error);
            alert('Error signing out. Please try again.');
        });
    });
} else {
    // This error indicates a problem with the HTML or the timing of the script
    console.error("Logout button element ('#profile-logout-btn') could not be found in the DOM when trying to add event listener.");
}

// --- Initial log ---
console.log("Profile script initialized.");
// Initial profile load is triggered by the onAuthStateChanged listener.
