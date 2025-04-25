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

// --- !! IMPORTANT: Define Admin Emails Here !! ---
// --- Make sure these are lowercase ---
const adminEmails = [
    'trixdesignsofficial@gmail.com',       // Replace with YOUR admin email(s)
    'jackdmbell@outlook.com'    // Add more if needed
];
// --- --- --- --- --- --- --- --- --- --- --- --- ---

// --- DOM Elements ---
const profileContent = document.getElementById('profile-content');
const loadingIndicator = document.getElementById('loading-profile');
const notLoggedInMsg = document.getElementById('not-logged-in');
const profilePicDiv = document.getElementById('profile-pic');
const usernameDisplay = document.getElementById('profile-username');
const emailDisplay = document.getElementById('profile-email');
const statsDisplay = document.getElementById('stats-display');
const profileLogoutBtn = document.getElementById('profile-logout-btn');
const adminTag = document.getElementById('admin-tag'); // Get the admin tag element

// --- Auth State Listener ---
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in
        console.log('User found on profile page:', user.uid, user.displayName);
        loadingIndicator.style.display = 'none';
        notLoggedInMsg.style.display = 'none';
        profileContent.style.display = 'block';

        // Display Username and Email
        usernameDisplay.textContent = user.displayName || 'User';
        emailDisplay.textContent = user.email || 'No email provided';

        // Generate and Display Profile Picture Letter
        const usernameForPic = user.displayName || 'U';
        const firstLetter = usernameForPic.charAt(0).toUpperCase();
        profilePicDiv.textContent = firstLetter;

        // --- Check if user is admin and show tag ---
        const userEmailLower = user.email ? user.email.toLowerCase() : null;

        if (userEmailLower && adminEmails.includes(userEmailLower)) {
            adminTag.style.display = 'inline-block'; // Show the tag
            console.log('User is an admin.');
        } else {
            adminTag.style.display = 'none'; // Hide the tag
            console.log('User is not an admin.');
        }
        // --- --- --- --- --- --- --- --- --- --- ---

        // Load Stats from Firestore
        loadUserStats(user.uid);

    } else {
        // User is signed out
        console.log('No user found on profile page.');
        loadingIndicator.style.display = 'none';
        profileContent.style.display = 'none';
        notLoggedInMsg.style.display = 'flex';
        adminTag.style.display = 'none'; // Ensure tag is hidden if logged out

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
});

// --- Load User Stats Function (Fetches from Firestore) ---
function loadUserStats(userId) {
    console.log('Attempting to load stats from Firestore for user:', userId);
    statsDisplay.innerHTML = '<p>Loading stats...</p>';

    const leaderboardRef = db.collection('leaderboard').doc(userId);

    leaderboardRef.get()
        .then((doc) => {
            if (doc.exists) {
                const stats = doc.data();
                console.log("Stats data found:", stats);
                displayStats(stats);
            } else {
                console.log("No stats document found for user ID:", userId);
                statsDisplay.innerHTML = '<p>No stats found for this user.</p>';
            }
        }).catch((error) => {
            console.error("Error getting stats document:", error);
            statsDisplay.innerHTML = '<p>Error loading stats. Please try again later.</p>';
        });
}

// --- Function to Display Stats in the Grid ---
function displayStats(stats) {
     statsDisplay.innerHTML = '';

    if (stats.rank !== undefined) {
         statsDisplay.appendChild(createStatItem('Rank', `#${stats.rank}`));
    }
     if (stats.wins !== undefined) {
         statsDisplay.appendChild(createStatItem('Wins', stats.wins));
    }
      if (stats.kdRatio !== undefined) {
         const kdDisplay = typeof stats.kdRatio === 'number' ? stats.kdRatio.toFixed(2) : stats.kdRatio;
         statsDisplay.appendChild(createStatItem('K/D Ratio', kdDisplay));
    }
     if (stats.matchesPlayed !== undefined) {
         statsDisplay.appendChild(createStatItem('Matches Played', stats.matchesPlayed));
    }
     if (stats.score !== undefined) {
         statsDisplay.appendChild(createStatItem('Score', stats.score));
     }

     if (statsDisplay.innerHTML === '') {
         statsDisplay.innerHTML = '<p>Stats data found, but relevant fields might be missing or empty.</p>';
     }
}

// --- Helper to Create a Single Stat Item Element ---
function createStatItem(title, value) {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('stat-item');
    const titleH4 = document.createElement('h4');
    titleH4.textContent = title;
    const valueP = document.createElement('p');
    valueP.textContent = value;
    itemDiv.appendChild(titleH4);
    itemDiv.appendChild(valueP);
    return itemDiv;
}

// --- Logout Button on Profile Page ---
profileLogoutBtn.addEventListener('click', () => {
    auth.signOut()
        .then(() => {
            console.log('User signed out from profile page');
        })
        .catch((error) => {
            console.error('Sign out error:', error);
            alert('Error signing out. Please try again.');
        });
});
