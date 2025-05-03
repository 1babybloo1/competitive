// --- Firebase Config (Keep As Is) ---
const firebaseConfig = {
    apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI", // Replace if necessary, keep private
    authDomain: "poxelcomp.firebaseapp.com",
    projectId: "poxelcomp",
    storageBucket: "poxelcomp.appspot.com", // Standard storage bucket domain
    messagingSenderId: "620490990104",
    appId: "1:620490990104:web:709023eb464c7d886b996d",
};

// --- Initialize Firebase (Keep As Is) ---
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// --- Cloudinary Configuration (Keep As Is) ---
const CLOUDINARY_CLOUD_NAME = "djttn4xvk";
const CLOUDINARY_UPLOAD_PRESET = "compmanage";

// --- URL Parameter Parsing & Logged-in User Check (Keep As Is) ---
const urlParams = new URLSearchParams(window.location.search);
const profileUidFromUrl = urlParams.get('uid');
let loggedInUser = null;

// --- Admin Emails & Badge Config (Keep As Is) ---
const adminEmails = [
    'trixdesignsofficial@gmail.com',
    'jackdmbell@outlook.com',
    'myrrr@myrrr.myrrr'
].map(email => email.toLowerCase());
const badgeConfig = {
    verified: { emails: ['jackdmbell@outlook.com', 'myrrr@myrrr.myrrr', 'leezak5555@gmail.com'].map(e => e.toLowerCase()), className: 'badge-verified', title: 'Verified' },
    creator: { emails: ['jackdmbell@outlook.com'].map(e => e.toLowerCase()), className: 'badge-creator', title: 'Content Creator' },
    moderator: { emails: ['jackdmbell@outlook.com', 'mod_team@sample.org'].map(e => e.toLowerCase()), className: 'badge-moderator', title: 'Moderator' }
};

// --- DOM Elements (UPDATED) ---
const profileArea = document.getElementById('profile-area'); // New main wrapper for profile content
const loadingIndicator = document.getElementById('loading-profile');
const notLoggedInMsg = document.getElementById('not-logged-in');
// Profile Header Elements
const profileHeaderArea = document.getElementById('profile-header-area');
const profileBanner = document.getElementById('profile-banner');
const editBannerIcon = document.getElementById('edit-banner-icon');
const bannerInput = document.getElementById('banner-input');
// Profile Pic Elements (references unchanged, but usage changes)
const profilePicDiv = document.getElementById('profile-pic');
const profileImage = document.getElementById('profile-image');
const profileInitials = document.getElementById('profile-initials');
const editProfilePicIcon = document.getElementById('edit-profile-pic-icon');
const profilePicInput = document.getElementById('profile-pic-input');
// Profile Info Area Elements
const profileInfoArea = document.getElementById('profile-info-area');
const usernameDisplay = document.getElementById('profile-username');
const emailDisplay = document.getElementById('profile-email'); // Kept for structure, hidden by CSS
const adminTag = document.getElementById('admin-tag');
const rankDisplay = document.getElementById('profile-rank');
const titleDisplay = document.getElementById('profile-title');
const profileIdentifiersDiv = document.querySelector('.profile-identifiers'); // Container for rank/title
const profileBadgesContainer = document.getElementById('profile-badges-container');
const friendshipControlsContainer = document.getElementById('friendship-controls-container');
// Stats Section Elements (Added wrappers)
const competitiveStatsSectionWrapper = document.getElementById('competitive-stats-section-wrapper');
const competitiveStatsSection = document.getElementById('competitive-stats-section');
const competitiveStatsDisplay = document.getElementById('stats-display');
const poxelStatsSectionWrapper = document.getElementById('poxel-stats-section-wrapper');
const poxelStatsSection = document.getElementById('poxel-stats-section');
const poxelStatsDisplay = document.getElementById('poxel-stats-display');
// Friend Section Elements (Added wrapper)
const friendsSectionWrapper = document.getElementById('friends-section-wrapper');
const friendsSection = document.getElementById('friends-section'); // Inner section
const friendsListUl = document.getElementById('friends-list');
const incomingListUl = document.getElementById('incoming-requests-list');
const outgoingListUl = document.getElementById('outgoing-requests-list');
const incomingCountSpan = document.getElementById('incoming-count');
const outgoingCountSpan = document.getElementById('outgoing-count');
const friendsTabsContainer = document.querySelector('.friends-tabs');
// Achievement Section Elements (Outer wrapper already existed)
const achievementsSectionOuter = document.getElementById('achievements-section-outer'); // Outer wrapper
const achievementsSection = document.getElementById('achievements-section'); // Inner section
const achievementsListContainer = document.getElementById('achievements-list-container');
// Other Global Elements
const profileLogoutBtn = document.getElementById('profile-logout-btn');
// Modal Elements (references unchanged)
const editModal = document.getElementById('edit-modal');
const modalTitle = document.getElementById('modal-title'); // Get modal title element
const modalImage = document.getElementById('image-to-crop');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalApplyBtn = document.getElementById('modal-apply-btn');
const modalSpinner = document.getElementById('modal-spinner');


// --- Global/Scoped Variables (UPDATED) ---
let allAchievements = null;
let viewingUserProfileData = {}; // Holds { profile: {}, stats: {} }
let viewerProfileData = null; // Data of logged-in user { id, ..., friends, bannerUrl, etc. }
let miniProfileCache = {};
let isTitleSelectorOpen = false;
let titleSelectorElement = null;
let cropper = null;
let isOwnProfile = false;
let croppingFor = null; // NEW: Tracks 'pfp' or 'banner' being cropped

// =============================================================================
// --- CORE FUNCTIONS (Minimal changes needed here) ---
// =============================================================================
async function fetchPoxelStats(username) { /* ... unchanged ... */ }
async function fetchAllAchievements() { /* ... unchanged ... */ }
function areStatsDifferent(newStats, existingProfileStats) { /* ... unchanged ... */ }
async function createUserProfileDocument(userId, authUser) {
    // ADD bannerUrl to default data
    if (!userId || !authUser) {
        console.error("Cannot create profile: userId or authUser missing.");
        return null;
    }
    console.warn(`Client-side: Creating missing user profile doc for UID: ${userId}`);
    const userDocRef = db.collection("users").doc(userId);
    const displayName = authUser.displayName || `User_${userId.substring(0, 5)}`;
    const defaultProfileData = {
        email: authUser.email ? authUser.email.toLowerCase() : null,
        displayName: displayName,
        currentRank: "Unranked",
        equippedTitle: "",
        availableTitles: [],
        friends: {},
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        leaderboardStats: {},
        profilePictureUrl: authUser.photoURL || null,
        bannerUrl: null, // ADDED: Default banner URL
        poxelStats: {}
    };
    try {
        await userDocRef.set(defaultProfileData, { merge: false });
        console.log(`Successfully created user profile document for UID: ${userId} via client`);
        // Return structure matching a fetched doc
        return { id: userId, ...defaultProfileData, createdAt: new Date() };
    } catch (error) {
        console.error(`Error creating user profile document client-side for UID ${userId}:`, error);
        return null;
    }
}

// --- Load Combined User Data (UPDATED for new structure/hiding logic) ---
async function loadCombinedUserData(targetUserId) {
    console.log(`Loading combined user data for TARGET UID: ${targetUserId}`);
    isOwnProfile = loggedInUser && loggedInUser.uid === targetUserId;
    console.log("Is viewing own profile:", isOwnProfile);

    // Reset viewer data and caches on new load
    viewerProfileData = null;
    miniProfileCache = {};
    viewingUserProfileData = {};

    // Clear previous content and show loading indicators
    if (profileArea) profileArea.style.display = 'none'; // Hide entire profile area initially
    if (notLoggedInMsg) notLoggedInMsg.style.display = 'none';
    if (loadingIndicator) loadingIndicator.style.display = 'flex';

    // Clear specific section contents
    if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = '<p class="list-message">Loading competitive stats...</p>';
    if (poxelStatsDisplay) poxelStatsDisplay.innerHTML = '<p class="list-message">Loading Poxel.io stats...</p>';
    if (achievementsListContainer) achievementsListContainer.innerHTML = '<p class="list-message">Loading achievements...</p>';
    // Hide section wrappers initially
    if(competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'none';
    if(poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'none';
    if(achievementsSectionOuter) achievementsSectionOuter.style.display = 'none';
    if(friendsSectionWrapper) friendsSectionWrapper.style.display = 'none';


    updateProfileTitlesAndRank(null, false); // Reset rank/title display
    displayBanner(null); // Reset banner
    clearFriendshipControls(); // Clear old friend buttons
    resetFriendsSection(); // Hide and reset friend lists/tabs (also hides wrapper)

    // Try loading from cache first for faster perceived load
    const cacheLoaded = loadCombinedDataFromCache(targetUserId);
    // Fetch definitions needed globally
    if (!allAchievements) fetchAllAchievements();

    // --- Fetch Viewer's Profile Data (if logged in and not viewing self) ---
    // ... (This logic remains largely the same) ...
    if (loggedInUser && !isOwnProfile) {
        try {
            const viewerSnap = await db.collection('users').doc(loggedInUser.uid).get();
            if (viewerSnap.exists) {
                viewerProfileData = { id: viewerSnap.id, ...viewerSnap.data() };
                 if (!viewerProfileData.friends) viewerProfileData.friends = {}; // Ensure map exists
                console.log("Fetched viewer profile data.");
            } else {
                 console.warn("Logged-in user's profile data not found.");
                 viewerProfileData = await createUserProfileDocument(loggedInUser.uid, loggedInUser);
                 if (!viewerProfileData) viewerProfileData = { id: loggedInUser.uid, friends: {} }; // Fallback empty map
            }
        } catch (viewerError) {
            console.error("Error fetching viewing user's profile data:", viewerError);
             viewerProfileData = { id: loggedInUser.uid, friends: {} }; // Assume empty map for checks
        }
    }
    // --- End Fetch Viewer's Profile Data ---


    const userProfileRef = db.collection('users').doc(targetUserId);
    const leaderboardStatsRef = db.collection('leaderboard').doc(targetUserId);
    let userUnlockedAchievementIds = [];

    try {
        // *** Fetch unlocked achievements IF viewing own profile (do early) ***
        // ... (unchanged) ...
        if (isOwnProfile) {
            userUnlockedAchievementIds = await fetchUserUnlockedAchievements(targetUserId);
        }

        // 1. Fetch Target User Profile Data
        // ... (fetch logic including createUserProfileDocument call is unchanged) ...
        let profileSnap = await userProfileRef.get();
        let profileData = null;

        if (!profileSnap || !profileSnap.exists) {
            console.warn(`User profile document does NOT exist for UID: ${targetUserId}`);
            if (isOwnProfile && loggedInUser) {
                profileData = await createUserProfileDocument(targetUserId, loggedInUser);
                if (!profileData) throw new Error(`Profile creation failed for own UID ${targetUserId}.`);
                 viewingUserProfileData = { profile: profileData, stats: null };
            } else {
                throw new Error(`Profile not found for UID ${targetUserId}.`);
            }
        } else {
            profileData = { id: profileSnap.id, ...profileSnap.data() };
            // Ensure essential fields exist
            if (profileData.leaderboardStats === undefined) profileData.leaderboardStats = {};
            if (profileData.profilePictureUrl === undefined) profileData.profilePictureUrl = null;
            if (profileData.bannerUrl === undefined) profileData.bannerUrl = null; // Ensure bannerUrl exists
            if (profileData.friends === undefined) profileData.friends = {};
            if (profileData.email) profileData.email = profileData.email.toLowerCase();
        }


        // If viewing own profile, also set viewerProfileData here
        if (isOwnProfile) {
            viewerProfileData = profileData;
            if (!viewerProfileData.friends) viewerProfileData.friends = {};
        }

        // 2. Fetch Leaderboard Stats Data (Competitive)
        // ... (unchanged) ...
        let competitiveStatsData = null;
        if(profileData) {
            const statsSnap = await leaderboardStatsRef.get();
            competitiveStatsData = statsSnap.exists ? { id: statsSnap.id, ...statsSnap.data() } : null;
        }

        // 3. Sync Competitive Stats to Profile Document if needed
        // ... (unchanged) ...
        if (profileData && competitiveStatsData) {
            if (areStatsDifferent(competitiveStatsData, profileData.leaderboardStats)) {
                console.log(`Competitive stats for UID ${targetUserId} differ. Updating 'users' doc.`);
                try {
                    const statsToSave = { ...competitiveStatsData };
                    delete statsToSave.id;
                    await userProfileRef.update({ leaderboardStats: statsToSave });
                    profileData.leaderboardStats = statsToSave;
                } catch (updateError) {
                    console.error(`Error updating competitive stats in 'users' doc for UID ${targetUserId}:`, updateError);
                }
            }
        }


        // 4. Update Global State for the viewed profile
        viewingUserProfileData = {
            profile: profileData,
            stats: competitiveStatsData // Use synced or fetched stats
        };

        // 5. Display Core Profile Info (Banner, PFP, Name, etc.) & Cache
        displayProfileData(viewingUserProfileData.profile, isOwnProfile); // Pass owner status
        displayBanner(viewingUserProfileData.profile?.bannerUrl); // Display banner
        saveCombinedDataToCache(targetUserId, viewingUserProfileData); // Cache fetched data

        // --- Display Sections ---
        // Competitive Stats
        if (competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'block';
        displayCompetitiveStats(viewingUserProfileData.stats); // Pass competitive stats

        // Friendship Controls or Friends Section
        if (loggedInUser) {
            if (isOwnProfile) {
                 displayFriendsSection(profileData); // Show friends section (also shows wrapper)
            } else if (viewerProfileData){
                 const status = determineFriendshipStatus(loggedInUser.uid, targetUserId);
                 displayFriendshipControls(status, targetUserId);
            }
        }

        // Poxel.io Stats (asynchronously)
        if (profileData?.displayName) {
             if(poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'block'; // Show wrapper
             fetchPoxelStats(profileData.displayName)
                .then(poxelStatsData => displayPoxelStats(poxelStatsData))
                .catch(poxelError => displayPoxelStats(null, poxelError.message || 'Error loading stats.'));
        } else {
             displayPoxelStats(null, 'Poxel username not found.');
             if(poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'block'; // Show wrapper even with message
        }

        // Achievements Section (IF owner)
        if (isOwnProfile) {
             if (!allAchievements) await fetchAllAchievements();
             await displayAchievementsSection(viewingUserProfileData.stats, userUnlockedAchievementIds); // Also shows wrapper
        }

        // --- Post-display Logic (Achievements Granting) ---
        if (isOwnProfile && viewingUserProfileData.stats) {
            // ... (achievement check/grant logic remains the same) ...
             if (!allAchievements) await fetchAllAchievements();
             if (allAchievements) {
                const potentiallyUpdatedProfile = await checkAndGrantAchievements(
                    targetUserId,
                    viewingUserProfileData.profile,
                    viewingUserProfileData.stats
                );
                if (potentiallyUpdatedProfile) {
                    // Update global state and cache
                    viewingUserProfileData.profile = potentiallyUpdatedProfile;
                     viewerProfileData = viewingUserProfileData.profile; // Update viewer data too
                     saveCombinedDataToCache(targetUserId, viewingUserProfileData);
                     // Re-render affected UI
                    displayProfileData(viewingUserProfileData.profile, isOwnProfile); // Re-render core info (reflect title/rank changes)
                    displayBanner(viewingUserProfileData.profile.bannerUrl); // Re-render banner (though unlikely to change here)
                    // Re-fetch/display achievements AFTER granting
                    const latestUnlockedIds = await fetchUserUnlockedAchievements(targetUserId);
                    await displayAchievementsSection(viewingUserProfileData.stats, latestUnlockedIds); // Refresh achievements display
                    displayFriendsSection(viewingUserProfileData.profile); // Refresh friends section (in case rank changed affecting display?)
                }
             }
        }

        // --- Final Step: Show the profile area ---
        if (profileArea) profileArea.style.display = 'block';


    } catch (error) {
        console.error(`Error in loadCombinedUserData for TARGET UID ${targetUserId}:`, error);
        let errorMessage = 'Error loading profile data. Please try again later.';
        if (error.message && error.message.includes('Profile not found')) {
            errorMessage = 'Profile not found.';
             viewingUserProfileData.profile = null; // Mark as not found
        }

        // Show error message, hide profile area
         if (profileArea) profileArea.style.display = 'none';
         if (notLoggedInMsg) notLoggedInMsg.textContent = errorMessage;
         if (notLoggedInMsg) notLoggedInMsg.style.display = 'flex';

        // If cache was loaded, we might leave it visible? Current logic hides it on error.
        // Reset everything else
         updateProfileTitlesAndRank(null, false);
         displayBanner(null);
         if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = '<p class="list-message">Error loading stats.</p>';
         if(competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'block'; // Show section wrapper with error message inside
         if (poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'none';
         if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none';
         clearFriendshipControls();
         resetFriendsSection(); // Hides friends wrapper


    } finally {
         // Ensure loading indicator is always hidden
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        // Visibility of profileArea and notLoggedInMsg is handled in try/catch
    }
} // --- End loadCombinedUserData ---

// --- Display Banner ---
function displayBanner(imageUrl) {
    if (!profileBanner) return;
    if (imageUrl) {
        profileBanner.style.backgroundImage = `url('${imageUrl}')`;
    } else {
        // Reset to fallback color or a default pattern if desired
        profileBanner.style.backgroundImage = 'none'; // Remove image
        // profileBanner.style.backgroundColor = 'var(--banner-fallback-bg)'; // Ensure fallback color is set (already done in CSS)
    }
}

// --- Display Core Profile Data (UPDATED - No Background, No Comp Stats Display Call) ---
function displayProfileData(profileData, isOwner) {
    // No main container check needed, use profileArea visibility instead

    if (!profileData || !profileArea) {
        console.error("displayProfileData called with null profileData or profileArea missing.");
        if(profileArea) profileArea.style.display = 'none';
        if (notLoggedInMsg) {
            notLoggedInMsg.textContent = 'Profile data unavailable.';
            notLoggedInMsg.style.display = 'flex';
        }
        return;
    }

    // Show the main profile area wrapper if data exists
     profileArea.style.display = 'block';


    const displayName = profileData.displayName || 'Anonymous User';
    usernameDisplay.textContent = displayName;

    // --- Profile Picture Logic ---
    if (profileData.profilePictureUrl) {
        profileImage.src = profileData.profilePictureUrl;
        profileImage.style.display = 'block';
        profileInitials.style.display = 'none';
        profileImage.onerror = () => {
            console.error("Failed to load profile image:", profileData.profilePictureUrl);
            profileImage.style.display = 'none';
            profileInitials.textContent = displayName?.charAt(0)?.toUpperCase() || '?';
            profileInitials.style.display = 'flex';
        };
        // No background update needed on load
    } else {
        profileImage.style.display = 'none';
        profileImage.src = '';
        profileInitials.textContent = displayName?.charAt(0)?.toUpperCase() || '?';
        profileInitials.style.display = 'flex';
    }

    // Show edit icons only if it's the owner's profile
    editProfilePicIcon.style.display = isOwner ? 'flex' : 'none';
    editBannerIcon.style.display = isOwner ? 'flex' : 'none'; // Show/hide banner edit icon

    // Display other elements
    displayUserBadges(profileData);
    updateProfileTitlesAndRank(profileData, isOwner); // Pass owner status

    // Setup editing listeners IF owner, AFTER the elements are displayed
    if (isOwner) {
        setupProfilePicEditing();
        setupBannerEditing(); // Setup banner editing
    }
}

// --- REMOVED: updateProfileBackground function ---

// --- Display COMPETITIVE Stats Grid (Unchanged) ---
function displayCompetitiveStats(statsData) { /* ... unchanged ... */ }

// --- Display Poxel.io Stats Grid (Unchanged) ---
function displayPoxelStats(poxelData, message = null) { /* ... unchanged ... */ }

// --- Helper: Create a Single Stat Item Element (Unchanged) ---
function createStatItem(title, value) { /* ... unchanged ... */ }

// --- Helper: Fetch User's Unlocked Achievements (Unchanged) ---
async function fetchUserUnlockedAchievements(userId) { /* ... unchanged ... */ }

// --- Helper: Calculate Achievement Progress Percentage (Unchanged) ---
function calculateAchievementProgress(achievement, userStats) { /* ... unchanged ... */ }

// --- Display Achievements Section (UPDATED to show/hide wrapper) ---
async function displayAchievementsSection(competitiveStats, unlockedAchievementIds) {
     // Check for outer wrapper now
     if (!achievementsSectionOuter || !achievementsListContainer) {
         console.error("Achievement section elements not found in DOM.");
         return;
     }

    if (!isOwnProfile) {
         achievementsSectionOuter.style.display = 'none'; // Hide wrapper if not owner
        return;
    }

    if (!allAchievements) {
        console.log("Achievement definitions not loaded yet, attempting fetch...");
        await fetchAllAchievements();
        if (!allAchievements) {
             console.error("Failed to load achievement definitions after attempting fetch.");
             achievementsListContainer.innerHTML = '<p class="list-message">Could not load achievement definitions.</p>';
             achievementsSectionOuter.style.display = 'block'; // Show wrapper with error message
            return;
        }
    }

    achievementsListContainer.innerHTML = ''; // Clear loading/previous content
    achievementsSectionOuter.style.display = 'block'; // Show the wrapper for the owner

    // ... rest of the display logic is unchanged ...
    const achievementIds = Object.keys(allAchievements || {});
     if (achievementIds.length === 0) {
         achievementsListContainer.innerHTML = '<p class="list-message">No achievements defined yet.</p>';
         return;
     }
     console.log(`Displaying ${achievementIds.length} achievements.`);
     achievementIds.forEach(achievementId => {
         const achievement = allAchievements[achievementId];
         if (!achievement || !achievement.name || !achievement.criteria) {
              console.warn(`Skipping invalid achievement data for ID: ${achievementId}`, achievement);
              return;
         }
         const isUnlocked = unlockedAchievementIds?.includes(achievementId) || false;
         const progressInfo = calculateAchievementProgress(achievement, competitiveStats);
         const meetsCriteriaDirectly = progressInfo.meetsCriteria;
         const isDisplayCompleted = isUnlocked || meetsCriteriaDirectly;
         const itemDiv = document.createElement('div');
         itemDiv.classList.add('achievement-item');
         if (isUnlocked) itemDiv.classList.add('achievement-unlocked');
         if (isDisplayCompleted) itemDiv.classList.add('achievement-completed');
         // ... (HTML generation unchanged) ...
          let rewardsHtml = '';
        if (achievement.rewards) { /* ... rewards string ... */ }
         let progressText = `${progressInfo.progress}%`;
         let progressBarTitle = '';
         const isNumericProgressive = achievement.criteria.stat && typeof achievement.criteria.value === 'number' && achievement.criteria.value > 0 && achievement.criteria.operator === '>=';
         if (isDisplayCompleted) { /* ... completed text ... */ }
         else if (isNumericProgressive) { /* ... numeric progress text ... */ }
         else { /* ... percentage text ... */ }
         itemDiv.innerHTML = `<h4>...</h4><p>...</p><div class="achievement-progress-container">...</div>${rewardsHtml}`; // Simplified HTML structure representation
         achievementsListContainer.appendChild(itemDiv);
     });
     if (achievementsListContainer.childElementCount === 0 && achievementIds.length > 0) {
         achievementsListContainer.innerHTML = '<p class="list-message">Could not display achievements.</p>';
     } else if (achievementIds.length === 0) {
         achievementsListContainer.innerHTML = '<p class="list-message">No achievements defined yet.</p>';
      }
}

// --- Check and Grant Achievements (ADD bannerUrl check if rewards grant banners) ---
async function checkAndGrantAchievements(userId, currentUserProfile, competitiveStats) {
    // ... (Initial checks unchanged) ...
     if (!allAchievements || !userId || !currentUserProfile || !competitiveStats || typeof competitiveStats !== 'object') { return null; }
     console.log(`Checking achievements for UID ${userId}...`);
     let profileToUpdate = { /* ... copy profile, ensure fields exist ... */
         ...currentUserProfile,
         availableTitles: currentUserProfile.availableTitles || [],
         equippedTitle: currentUserProfile.equippedTitle !== undefined ? currentUserProfile.equippedTitle : "",
         currentRank: currentUserProfile.currentRank || "Unranked",
         friends: currentUserProfile.friends || {},
         leaderboardStats: currentUserProfile.leaderboardStats || {},
         bannerUrl: currentUserProfile.bannerUrl || null, // Ensure bannerUrl is included
     };

    try {
        // ... (Fetch unlocked achievements unchanged) ...
        const userAchievementsRef = db.collection('userAchievements').doc(userId);
        let unlockedIds = [];
        try { /* ... fetch ... */ } catch(fetchError) { /* ... handle ... */ unlockedIds = []; }

        let newAchievementsUnlocked = [];
        let needsProfileUpdate = false;
        let needsUserAchievementsUpdate = false;
         let bestRankReward = null;
         const rankOrder = ["Unranked", "Bronze", "Silver", "Gold", "Platinum", "Veteran", "Legend"];

        for (const achievementId in allAchievements) {
             if (unlockedIds.includes(achievementId)) continue;
             const achievement = allAchievements[achievementId];
             if (!achievement?.criteria) continue;
             const progressInfo = calculateAchievementProgress(achievement, competitiveStats);

            if (progressInfo.meetsCriteria) {
                 // ... (Mark as new, needs update) ...
                 if (!newAchievementsUnlocked.includes(achievementId)) {
                      newAchievementsUnlocked.push(achievementId);
                      needsUserAchievementsUpdate = true;
                 }

                // Process rewards
                if (achievement.rewards) {
                    // Title reward logic unchanged
                    if (achievement.rewards.title) { /* ... add title, set needsProfileUpdate ... */ }
                    // Rank reward logic unchanged
                    if (achievement.rewards.rank) { /* ... check best rank, set needsProfileUpdate ... */ }
                    // *** ADD BANNER REWARD (Example) ***
                    if (achievement.rewards.bannerUrl) {
                        // Only apply if user doesn't have a banner OR this one is considered "better" (logic depends on use case)
                        // Simple case: Apply if they don't have one
                        if (!profileToUpdate.bannerUrl) {
                            profileToUpdate.bannerUrl = achievement.rewards.bannerUrl;
                            needsProfileUpdate = true;
                            console.log(`- Added banner: ${achievement.rewards.bannerUrl}`);
                        }
                    }
                    // Add other rewards here...
                }
            }
        }

        // Apply best rank reward (unchanged)
        if (bestRankReward) { /* ... update profileToUpdate.currentRank ... */ }

        // --- Perform Firestore Updates (if needed) ---
        if (needsProfileUpdate || needsUserAchievementsUpdate) {
            // ... (Setup batch unchanged) ...
            const batch = db.batch();
            const userProfileRef = db.collection('users').doc(userId);

            // 1. Update userAchievements doc (unchanged)
             if (needsUserAchievementsUpdate && newAchievementsUnlocked.length > 0) {
                 batch.set(userAchievementsRef, { unlocked: firebase.firestore.FieldValue.arrayUnion(...newAchievementsUnlocked) }, { merge: true });
             }

            // 2. Update user profile doc (ADD bannerUrl check)
             if (needsProfileUpdate) {
                 const profileUpdateData = {};
                 // Check changed fields...
                 if (JSON.stringify(profileToUpdate.availableTitles) !== JSON.stringify(currentUserProfile.availableTitles || [])) { profileUpdateData.availableTitles = profileToUpdate.availableTitles; }
                 if (profileToUpdate.equippedTitle !== (currentUserProfile.equippedTitle !== undefined ? currentUserProfile.equippedTitle : "")) { profileUpdateData.equippedTitle = profileToUpdate.equippedTitle; }
                 if (profileToUpdate.currentRank !== (currentUserProfile.currentRank || "Unranked")) { profileUpdateData.currentRank = profileToUpdate.currentRank; }
                 // ADD Banner Check
                 if (profileToUpdate.bannerUrl !== (currentUserProfile.bannerUrl || null)) { profileUpdateData.bannerUrl = profileToUpdate.bannerUrl; }
                 // Add other fields...

                 if (Object.keys(profileUpdateData).length > 0) {
                     console.log("Updating 'users' doc with:", profileUpdateData);
                     batch.update(userProfileRef, profileUpdateData);
                 } else { needsProfileUpdate = false; }
             }

             // Commit batch (unchanged)
             if (needsProfileUpdate || needsUserAchievementsUpdate) {
                 await batch.commit();
                 console.log(`Achievement Firestore batch committed successfully for UID ${userId}.`);
                 return profileToUpdate; // Return MODIFIED profile
             } else { return null; }

        } else { return null; } // No changes
    } catch (error) {
        console.error(`Error checking/granting achievements for UID ${userId}:`, error);
        return null; // Error
    }
}

// =============================================================================
// --- UI Display Helpers (Badges, Rank/Title Selector - Unchanged) ---
// =============================================================================
function displayUserBadges(profileData) { /* ... unchanged ... */ }
function updateProfileTitlesAndRank(profileData, allowInteraction) { /* ... unchanged ... */ }
function handleTitleClick(event) { /* ... unchanged ... */ }
function openTitleSelector() { /* ... unchanged ... */ }
function closeTitleSelector() { /* ... unchanged ... */ }
function handleClickOutsideTitleSelector(event) { /* ... unchanged ... */ }
async function handleTitleOptionClick(event) { /* ... unchanged ... */ }

// =============================================================================
// --- Profile Picture & NEW Banner Editing Functions ---
// =============================================================================

// --- Setup PFP Editing (Unchanged except for icon check) ---
function setupProfilePicEditing() {
    if (!isOwnProfile || !editProfilePicIcon || !profilePicInput) {
        if(editProfilePicIcon) editProfilePicIcon.style.display = 'none';
        return;
     }
    editProfilePicIcon.style.display = 'flex';
    editProfilePicIcon.onclick = null;
    profilePicInput.onchange = null;
    editProfilePicIcon.onclick = () => {
        croppingFor = 'pfp'; // SET FLAG
        profilePicInput.click();
    };
    profilePicInput.onchange = (event) => { handleFileSelect(event); };
}

// --- Setup NEW Banner Editing ---
function setupBannerEditing() {
    if (!isOwnProfile || !editBannerIcon || !bannerInput) {
        if(editBannerIcon) editBannerIcon.style.display = 'none';
        return;
     }
    editBannerIcon.style.display = 'flex';
    editBannerIcon.onclick = null;
    bannerInput.onchange = null;
    editBannerIcon.onclick = () => {
        croppingFor = 'banner'; // SET FLAG
        bannerInput.click();
    };
    bannerInput.onchange = (event) => { handleFileSelect(event); };
     console.log("Banner editing listeners attached.");
}


// --- Handle File Selection (Unchanged - flag set before call) ---
function handleFileSelect(event) {
    const file = event.target?.files?.[0];
    if (!file) { event.target.value = null; return; }
     if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file (PNG, JPG, GIF).');
        event.target.value = null; return;
    }
     const maxSizeMB = 8; // Allow slightly larger for banners?
     if (file.size > maxSizeMB * 1024 * 1024) {
         alert(`File size exceeds ${maxSizeMB}MB limit.`);
         event.target.value = null; return;
     }
    const reader = new FileReader();
    reader.onload = (e) => {
         if (e.target?.result) {
             modalImage.src = e.target.result;
             openEditModal(); // Open modal AFTER image source is set
         } else { alert("Error reading file data."); }
    };
    reader.onerror = (err) => { alert("Error reading the selected file."); };
    reader.readAsDataURL(file);
    event.target.value = null;
}

// --- Open Image Editing Modal (UPDATED for dynamic title and cropper aspect ratio) ---
function openEditModal() {
    if (!editModal || !modalImage || !modalImage.src) { return; }

     // Set Modal Title based on what's being cropped
    modalTitle.textContent = (croppingFor === 'banner') ? 'Edit Banner Image' : 'Edit Profile Picture';

    editModal.style.display = 'flex';
    modalImage.style.opacity = 0;

    // Reset button state
    modalApplyBtn.disabled = false;
    modalSpinner.style.display = 'none';
    const applyTextNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
    if (applyTextNode) applyTextNode.textContent = 'Apply ';

    if (cropper) { try { cropper.destroy(); } catch(e) {} cropper = null; }

    // Set Cropper options based on target
     const cropperOptions = {
        viewMode: 1,
        dragMode: 'move',
        background: false,
        autoCropArea: 0.9,
        responsive: true,
        modal: true, // Modal overlay *around* cropper container
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        ready: () => {
            modalImage.style.opacity = 1;
            console.log("Cropper is ready for:", croppingFor);
        }
    };

     if (croppingFor === 'pfp') {
         cropperOptions.aspectRatio = 1 / 1;
         // Apply circular styles via JS (or keep in CSS if always circular)
         // document.querySelector('.cropper-view-box').style.borderRadius = '50%';
         // document.querySelector('.cropper-face').style.borderRadius = '50%';
         // If using CSS : `.cropper-view-box, .cropper-face { border-radius: 50%; ... }`
     } else if (croppingFor === 'banner') {
        cropperOptions.aspectRatio = 3 / 1; // Example: 3:1 ratio for banner
        // Remove circular styles if applied by JS or use specific class in CSS
        // document.querySelector('.cropper-view-box').style.borderRadius = '0';
        // document.querySelector('.cropper-face').style.borderRadius = '0';
        // Use CSS to only apply border-radius:50% when a specific class is NOT present, or toggle class
    } else {
         console.error("Unknown 'croppingFor' state:", croppingFor);
         alert("Error opening image editor: Unknown target.");
         closeEditModal();
         return;
     }


    setTimeout(() => {
        try {
             cropper = new Cropper(modalImage, cropperOptions); // Use dynamic options
        } catch (cropperError) {
            console.error("Error initializing Cropper:", cropperError);
            alert("Could not initialize image editor.");
            closeEditModal();
        }
     }, 50);

    // --- Attach listeners (unchanged) ---
    modalCloseBtn.onclick = closeEditModal;
    modalCancelBtn.onclick = closeEditModal;
    modalApplyBtn.onclick = handleApplyCrop;
    editModal.onclick = (event) => { if (event.target === editModal) closeEditModal(); };
}


// --- Close Image Editing Modal (UPDATED - Reset flag) ---
function closeEditModal() {
    if (!editModal) return;
    if (cropper) { try { cropper.destroy(); } catch (e) {} cropper = null; }
    editModal.style.display = 'none';
    modalImage.src = '';
    modalImage.removeAttribute('src');
    croppingFor = null; // RESET FLAG

    // Reset button state
    modalApplyBtn.disabled = false;
    modalSpinner.style.display = 'none';
    const textNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.textContent = 'Apply ';

    // Remove listeners
    modalCloseBtn.onclick = null;
    modalCancelBtn.onclick = null;
    modalApplyBtn.onclick = null;
    editModal.onclick = null;
}

// --- Handle Apply Crop and Upload (UPDATED - Handle PFP vs Banner) ---
async function handleApplyCrop() {
    if (!cropper || !loggedInUser || !croppingFor) { // Check croppingFor flag
        console.error("Cropper/user/target not ready.");
        alert("Cannot apply crop.");
        return;
    }
    if (modalApplyBtn.disabled) return;

    modalApplyBtn.disabled = true;
    modalSpinner.style.display = 'inline-block';
    const textNode = Array.from(modalApplyBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.textContent = 'Applying ';

    try {
        // Get cropped canvas - adjust output size based on target?
        const outputWidth = (croppingFor === 'banner') ? 1500 : 512; // Larger width for banner
         const outputHeight = (croppingFor === 'banner') ? 500 : 512; // Use aspect ratio for banner height

        const canvas = cropper.getCroppedCanvas({
            width: outputWidth,
            height: outputHeight,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });
        if (!canvas) throw new Error("Failed to get cropped canvas.");

        // Convert to Blob
         const blob = await new Promise((resolve, reject) => {
             canvas.toBlob((blobResult) => {
                 if (blobResult) resolve(blobResult);
                 else reject(new Error("Canvas to Blob conversion failed."));
             }, 'image/jpeg', 0.90);
         });

        // Upload to Cloudinary
        const imageUrl = await uploadToCloudinary(blob, croppingFor); // Pass type for potential folder usage
        console.log(`Uploaded ${croppingFor} to Cloudinary:`, imageUrl);

        // Save URL to Firestore (Different field based on type)
        await saveImageUrlToFirestore(loggedInUser.uid, imageUrl, croppingFor);
        console.log(`Saved ${croppingFor} URL to Firestore.`);

        // Update UI immediately
        if (croppingFor === 'pfp') {
             profileImage.src = `${imageUrl}?timestamp=${Date.now()}`;
             profileImage.style.display = 'block';
             profileInitials.style.display = 'none';
         } else if (croppingFor === 'banner') {
             displayBanner(imageUrl); // Update banner display
         }

        // Update local cache
        if (viewingUserProfileData?.profile?.id === loggedInUser.uid) {
             if (croppingFor === 'pfp') {
                 viewingUserProfileData.profile.profilePictureUrl = imageUrl;
             } else if (croppingFor === 'banner') {
                 viewingUserProfileData.profile.bannerUrl = imageUrl;
             }
             // Also update viewer data cache if it's the same user
             if (viewerProfileData?.id === loggedInUser.uid) {
                 if (croppingFor === 'pfp') viewerProfileData.profilePictureUrl = imageUrl;
                 else if (croppingFor === 'banner') viewerProfileData.bannerUrl = imageUrl;
             }
             saveCombinedDataToCache(loggedInUser.uid, viewingUserProfileData);
         }

        closeEditModal();

    } catch (error) {
        console.error(`Error during ${croppingFor} crop/upload/save:`, error);
         alert(`Failed to update ${croppingFor}: ${error.message || 'Unknown error.'}`);
         modalApplyBtn.disabled = false;
         modalSpinner.style.display = 'none';
         if (textNode) textNode.textContent = 'Apply ';
     }
}

// --- Upload Blob to Cloudinary (UPDATED - Optional: Use type for folder) ---
async function uploadToCloudinary(blob, type = 'image') { // Add type parameter
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
         throw new Error("Cloudinary config missing.");
    }
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    const formData = new FormData();
     const filename = `${type}_${loggedInUser?.uid || 'anon'}_${Date.now()}.jpg`; // More unique filename
    formData.append('file', blob, filename);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    // Optional: Use different folders based on type
     if (type === 'banner') {
         formData.append('folder', 'user_banners');
     } else if (type === 'pfp') {
         formData.append('folder', 'user_pfps');
     }
    console.log(`Uploading ${type} to Cloudinary...`);
    try {
        const response = await fetch(url, { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) { throw new Error(data.error?.message || `Cloudinary upload failed. Status: ${response.status}`); }
        if (!data.secure_url) { throw new Error("Upload succeeded but missing secure URL."); }
        return data.secure_url;
    } catch (networkError) { throw new Error(`Network error during image upload.`); }
}

// --- Save Image URL to Firestore (NEW - handles PFP or Banner) ---
async function saveImageUrlToFirestore(userId, imageUrl, type) {
    if (!userId || !imageUrl || !type) {
        throw new Error("Missing userId, imageUrl, or type for saving.");
    }
    const userDocRef = db.collection("users").doc(userId);
    const fieldToUpdate = (type === 'banner') ? 'bannerUrl' : 'profilePictureUrl';

    try {
        await userDocRef.update({ [fieldToUpdate]: imageUrl }); // Use computed property name
        console.log(`Successfully updated ${fieldToUpdate} for user ${userId}`);
    } catch (error) {
        console.error(`Error updating Firestore ${fieldToUpdate} for ${userId}:`, error);
        throw new Error(`Database error saving ${type} link.`);
    }
}

// =============================================================================
// --- Friend System Functions (UPDATED for new structure/hiding logic) ---
// =============================================================================
async function fetchUserMiniProfile(userId) { /* ... unchanged ... */ }
function determineFriendshipStatus(viewerUid, profileOwnerUid) { /* ... unchanged ... */ }
function clearFriendshipControls() { /* ... unchanged ... */ }
function resetFriendsSection() {
    // Also hide the wrapper
    if (friendsSectionWrapper) friendsSectionWrapper.style.display = 'none';
     if (friendsSection) { // Original logic for resetting tabs/content
        const buttons = friendsTabsContainer?.querySelectorAll('.tab-button');
        const contents = friendsSection.querySelectorAll('.tab-content');
        buttons?.forEach((btn, index) => { /* ... reset tabs ... */ });
        contents?.forEach((content, index) => { /* ... reset content ... */ });
     }
}
function displayFriendshipControls(status, profileOwnerUid) { /* ... unchanged (appends buttons to #friendship-controls-container) ... */ }
async function displayFriendsSection(profileData) {
    // Check wrapper existence
    if (!isOwnProfile || !friendsSectionWrapper || !friendsSection || !profileData || typeof profileData.friends !== 'object') {
         resetFriendsSection(); // Hides wrapper
        return;
    }
    if (!friendsListUl || !incomingListUl || !outgoingListUl || !incomingCountSpan || !outgoingCountSpan || !friendsTabsContainer) {
         console.error("Required friend section elements are missing from the DOM.");
         resetFriendsSection();
         return;
     }

    console.log("Displaying friends section for own profile...");
    friendsSectionWrapper.style.display = 'block'; // Show the wrapper

    // ... rest of the logic unchanged (categorizing, updating counts, populating lists) ...
    const friendsMap = profileData.friends || {};
    const friendIds = []; const incomingIds = []; const outgoingIds = [];
    for (const userId in friendsMap) { /* ... categorize ... */ }
     incomingCountSpan.textContent = incomingIds.length;
     outgoingCountSpan.textContent = outgoingIds.length;
     try {
        await Promise.all([
             populateFriendList(friendsListUl, friendIds, 'friend', 'You have no friends yet.'),
             populateFriendList(incomingListUl, incomingIds, 'incoming', 'No incoming friend requests.'),
             populateFriendList(outgoingListUl, outgoingIds, 'outgoing', 'No outgoing friend requests.')
         ]);
    } catch(listError) { /* ... handle ... */ }
    // Attach tab listener if needed (logic unchanged)
    if (friendsTabsContainer && !friendsTabsContainer.dataset.listenerAttached) { /* ... attach listener ... */ }
}
async function populateFriendList(ulElement, userIds, type, emptyMessage) { /* ... unchanged ... */ }
function createFriendListItem(miniProfile, type) { /* ... unchanged ... */ }
function createFriendPfpElement(miniProfile) { /* ... unchanged ... */ }
function createFriendActionButton(text, type, style, userId, listItem) { /* ... unchanged ... */ }
function createFriendListItemError(userId, message) { /* ... unchanged ... */ }
async function handleFriendAction(buttonElement, action, otherUserId, listItemToRemove = null) { /* ... unchanged (updates Firestore, refreshes viewer data, calls displayFriendsSection or displayFriendshipControls) ... */ }


// =============================================================================
// --- Authentication and Initialization (UPDATED for new structure) ---
// =============================================================================
auth.onAuthStateChanged(async (user) => {
    console.log(`Auth state changed. User: ${user ? user.uid : 'None'}`);
    loggedInUser = user;
    const targetUid = profileUidFromUrl || loggedInUser?.uid;

    // Clear stale data
    viewerProfileData = null;
    viewingUserProfileData = {};
    miniProfileCache = {};
    isOwnProfile = loggedInUser && targetUid === loggedInUser.uid;

    if (targetUid) {
        console.log(`Targeting profile UID: ${targetUid}`);

        // Show loading, hide profile area and errors
        if (loadingIndicator) loadingIndicator.style.display = 'flex';
        if (notLoggedInMsg) notLoggedInMsg.style.display = 'none';
        if (profileArea) profileArea.style.display = 'none'; // Hide main profile area

        try {
            if (!allAchievements) fetchAllAchievements();
            await loadCombinedUserData(targetUid); // This function now handles showing content/errors internally
            console.log("Initial data load process completed.");

            // Final UI setup based on loaded data and ownership
             if (viewingUserProfileData.profile) {
                if (isOwnProfile) {
                    setupProfilePicEditing();
                    setupBannerEditing(); // Setup banner edit listener
                } else {
                     if(editProfilePicIcon) editProfilePicIcon.style.display = 'none';
                     if(editBannerIcon) editBannerIcon.style.display = 'none';
                }
                profileLogoutBtn.style.display = isOwnProfile ? 'inline-block' : 'none';
             } else {
                 profileLogoutBtn.style.display = 'none';
            }

        } catch (err) {
            console.error("Critical error during initial profile load sequence:", err);
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            if (profileArea) profileArea.style.display = 'none';
             if (notLoggedInMsg) {
                notLoggedInMsg.textContent = 'Failed to load profile. An unexpected error occurred.';
                notLoggedInMsg.style.display = 'flex';
            }
             profileLogoutBtn.style.display = 'none';
             clearFriendshipControls();
             resetFriendsSection();
             if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none';
             if (competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'none';
             if (poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'none';
        }

    } else {
        // --- No User Logged In AND No UID in URL ---
        console.log('No user logged in and no profile UID in URL.');
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (profileArea) profileArea.style.display = 'none';
        if (notLoggedInMsg) {
            notLoggedInMsg.style.display = 'flex';
            notLoggedInMsg.innerHTML = 'Please <a href="index.html#login-section" style="color: var(--primary-orange); margin: 0 5px;">log in</a> to view your profile, or provide a user ID in the URL.';
        }

        // Reset UI elements fully
        if (adminTag) adminTag.style.display = 'none';
        if (profileBadgesContainer) profileBadgesContainer.innerHTML = '';
        if (profileLogoutBtn) profileLogoutBtn.style.display = 'none';
        if (editProfilePicIcon) editProfilePicIcon.style.display = 'none';
        if (editBannerIcon) editBannerIcon.style.display = 'none';
        updateProfileTitlesAndRank(null, false);
        displayBanner(null);
        if (competitiveStatsDisplay) competitiveStatsDisplay.innerHTML = '';
        if(competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'none';
        if(poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'none';
        closeTitleSelector();
        closeEditModal();
        clearFriendshipControls();
        resetFriendsSection();
        if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none';

        // Clear global data state
        viewingUserProfileData = {};
        viewerProfileData = null;
        miniProfileCache = {};
    }
});

// --- Logout Button Event Listener (UPDATED cleanup) ---
profileLogoutBtn.addEventListener('click', () => {
    const userId = loggedInUser?.uid;
    console.log(`Logout button clicked by user: ${userId || 'N/A'}`);

    // Clean up UI
    if (titleDisplay) titleDisplay.removeEventListener('click', handleTitleClick);
    closeTitleSelector();
    closeEditModal();
    clearFriendshipControls();
    resetFriendsSection();
    if (achievementsSectionOuter) achievementsSectionOuter.style.display = 'none';
    if (competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'none';
    if (poxelStatsSectionWrapper) poxelStatsSectionWrapper.style.display = 'none';
    // Reset editor functionality
    if (editProfilePicIcon) { editProfilePicIcon.onclick = null; editProfilePicIcon.style.display = 'none'; }
    if (profilePicInput) profilePicInput.onchange = null;
    if (editBannerIcon) { editBannerIcon.onclick = null; editBannerIcon.style.display = 'none'; }
    if (bannerInput) bannerInput.onchange = null;

    // Sign out
    auth.signOut().then(() => {
        console.log('User signed out successfully.');
        if (userId) {
            localStorage.removeItem(`poxelProfileCombinedData_${userId}`);
            console.log(`Cleared cached profile data for UID: ${userId}`);
        }
        loggedInUser = null;
        viewerProfileData = null;
        viewingUserProfileData = {};
        miniProfileCache = {};
        isOwnProfile = false;
        window.location.href = 'index.html';
    }).catch((error) => { console.error('Sign out error:', error); });
});

// =============================================================================
// --- Local Storage Caching (UPDATED - Include bannerUrl) ---
// =============================================================================
function loadCombinedDataFromCache(viewedUserId) {
    if (!viewedUserId) return false;
    const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
    try {
        const cachedDataString = localStorage.getItem(cacheKey);
        if (!cachedDataString) return false;
        const cachedData = JSON.parse(cachedDataString);

        // Validation
        if (cachedData && cachedData.profile && cachedData.profile.id === viewedUserId) {
            // Ensure structures exist
            cachedData.profile.friends = cachedData.profile.friends || {};
            cachedData.profile.leaderboardStats = cachedData.profile.leaderboardStats || {};
            cachedData.profile.availableTitles = cachedData.profile.availableTitles || [];
            cachedData.profile.equippedTitle = cachedData.profile.equippedTitle !== undefined ? cachedData.profile.equippedTitle : "";
            cachedData.profile.currentRank = cachedData.profile.currentRank || "Unranked";
            cachedData.profile.bannerUrl = cachedData.profile.bannerUrl || null; // Load bannerUrl
            cachedData.stats = cachedData.stats || null;

            viewingUserProfileData = cachedData; // Load into global state
            console.log("Loaded combined data from cache for VIEWED UID:", viewedUserId);

            const viewingOwnCachedProfile = loggedInUser && loggedInUser.uid === viewedUserId;

            // Display data from cache
            displayProfileData(viewingUserProfileData.profile, viewingOwnCachedProfile);
            displayBanner(viewingUserProfileData.profile.bannerUrl); // Display cached banner
            // Display stats from cache
            if(competitiveStatsSectionWrapper) competitiveStatsSectionWrapper.style.display = 'block';
            displayCompetitiveStats(viewingUserProfileData.stats);
            // Note: Friends/Achievements/Poxel still need live fetch/checks after this initial display

            return true;
        } else {
            localStorage.removeItem(cacheKey); return false;
        }
    } catch (error) {
        console.error("Error loading cached data:", error);
        try { localStorage.removeItem(cacheKey); } catch(e) {}
        return false;
    }
}

function saveCombinedDataToCache(viewedUserId, combinedData) {
     if (!viewedUserId || !combinedData || !combinedData.profile || !combinedData.profile.id || viewedUserId !== combinedData.profile.id) {
         console.warn("Invalid data or ID mismatch for cache save. Aborting.", { viewedUserId, profileId: combinedData?.profile?.id });
        return;
    }
    const cacheKey = `poxelProfileCombinedData_${viewedUserId}`;
    try {
        const dataToSave = {
             profile: {
                 ...combinedData.profile,
                 friends: combinedData.profile.friends || {},
                 availableTitles: combinedData.profile.availableTitles || [],
                 equippedTitle: combinedData.profile.equippedTitle !== undefined ? combinedData.profile.equippedTitle : "",
                 currentRank: combinedData.profile.currentRank || "Unranked",
                 leaderboardStats: combinedData.profile.leaderboardStats || {},
                 bannerUrl: combinedData.profile.bannerUrl || null // Save bannerUrl
            },
             stats: combinedData.stats || null
         };
        localStorage.setItem(cacheKey, JSON.stringify(dataToSave));
    } catch(error) {
        console.error(`Error saving profile data to cache for UID ${viewedUserId}:`, error);
        if (error.name === 'QuotaExceededError' || error.message?.toLowerCase().includes('quota')) {
             console.warn('LocalStorage quota exceeded.');
         }
     }
}

// --- Initial Log ---
console.log("Profile script initialized (v2 Layout). Waiting for Auth state...");
