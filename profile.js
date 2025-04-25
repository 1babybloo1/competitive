// --- Firebase Configuration ---
// IMPORTANT: Needs the same config as auth.js
const firebaseConfig = {
    apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI",
    authDomain: "poxelcomp.firebaseapp.com",
    projectId: "poxelcomp",
    storageBucket: "poxelcomp.firebasestorage.app",
    messagingSenderId: "620490990104",
    appId: "1:620490990104:web:709023eb464c7d886b996d",
};

// --- Initialize Firebase ---
if (!firebase.apps.length) { // Avoid re-initializing
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore(); // <<<=== Initialize Firestore

// --- DOM Elements ---
const profileContent = document.getElementById('profile-content');
const loadingIndicator = document.getElementById('loading-profile');
const notLoggedInMsg = document.getElementById('not-logged-in');
const profilePicDiv = document.getElementById('profile-pic');
const usernameDisplay = document.getElementById('profile-username');
const emailDisplay = document.getElementById('profile-email');
const statsDisplay = document.getElementById('stats-display');
const profileLogoutBtn = document.getElementById('profile-logout-btn');

// --- Auth State Listener ---
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in, display their info
        console.log('User found on profile page:', user.uid, user.displayName);
        loadingIndicator.style.display = 'none';
        notLoggedInMsg.style.display = 'none';
        profileContent.style.display = 'block';

        // Display Username and Email (using Auth info)
        usernameDisplay.textContent = user.displayName || 'User';
        emailDisplay.textContent = user.email || 'No email provided';

        // Generate and Display Profile Picture Letter
        const usernameForPic = user.displayName || 'U';
        const firstLetter = usernameForPic.charAt(0).toUpperCase();
        profilePicDiv.textContent = firstLetter;

        // --- Load Stats from Firestore using User UID --- <<<=== MODIFIED
        loadUserStats(user.uid); // Pass user ID to fetch stats

    } else {
        // User is signed out
        console.log('No user found on profile page.');
        loadingIndicator.style.display = 'none';
        profileContent.style.display = 'none';
        notLoggedInMsg.style.display = 'flex';

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
});

// --- Load User Stats Function (Fetches from Firestore) --- <<<=== MODIFIED
function loadUserStats(userId) {
    console.log('Attempting to load stats from Firestore for user:', userId);
    statsDisplay.innerHTML = '<p>Loading stats...</p>'; // Show loading message

    const leaderboardRef = db.collection('leaderboard').doc(userId); // <<<=== Assumes Document ID is the userId

    leaderboardRef.get()
        .then((doc) => {
            if (doc.exists) {
                const stats = doc.data();
                console.log("Stats data found:", stats);

                // Optional: If username in Firestore is more authoritative, update display
                // if (stats.username && usernameDisplay.textContent !== stats.username) {
                //    usernameDisplay.textContent = stats.username;
                // }

                displayStats(stats); // Call function to render stats

            } else {
                // Document doesn't exist for this user ID
                console.log("No stats document found for user ID:", userId);
                statsDisplay.innerHTML = '<p>No stats found for this user.</p>';
            }
        }).catch((error) => {
            console.error("Error getting stats document:", error);
            statsDisplay.innerHTML = '<p>Error loading stats. Please try again later.</p>';
        });
}

// --- Function to Display Stats in the Grid ---
// (No changes needed here, it expects a stats object)
function displayStats(stats) {
     statsDisplay.innerHTML = ''; // Clear previous content (loading message or old stats)

    // Create and append stat items based on fields found in the stats object
    if (stats.rank !== undefined) {
         statsDisplay.appendChild(createStatItem('Rank', `#${stats.rank}`));
    } else {
         console.log('Rank field missing in stats data');
    }
     if (stats.wins !== undefined) {
         statsDisplay.appendChild(createStatItem('Wins', stats.wins));
    } else {
         console.log('Wins field missing in stats data');
    }
      if (stats.kdRatio !== undefined) {
         // Ensure kdRatio is displayed nicely (e.g., to 2 decimal places)
         const kdDisplay = typeof stats.kdRatio === 'number' ? stats.kdRatio.toFixed(2) : stats.kdRatio;
         statsDisplay.appendChild(createStatItem('K/D Ratio', kdDisplay));
    } else {
         console.log('kdRatio field missing in stats data');
    }
     if (stats.matchesPlayed !== undefined) {
         statsDisplay.appendChild(createStatItem('Matches Played', stats.matchesPlayed));
    } else {
         console.log('matchesPlayed field missing in stats data');
    }

    // Add more stats as needed based on your Firestore document fields
     if (stats.score !== undefined) { // Example: If you have a 'score' field
         statsDisplay.appendChild(createStatItem('Score', stats.score));
     }

     // If after checking all fields, nothing was added, show a message
     if (statsDisplay.innerHTML === '') {
         statsDisplay.innerHTML = '<p>Stats data found, but fields might be missing or empty.</p>';
     }
}

// --- Helper to Create a Single Stat Item Element ---
// (No changes needed here)
function createStatItem(title, value) {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('stat-item');

    const titleH4 = document.createElement('h4');
    titleH4.textContent = title;

    const valueP = document.createElement('p');
    valueP.textContent = value; // Value can be number or string

    itemDiv.appendChild(titleH4);
    itemDiv.appendChild(valueP);

    return itemDiv;
}


// --- Logout Button on Profile Page ---
// (No changes needed here)
profileLogoutBtn.addEventListener('click', () => {
    auth.signOut()
        .then(() => {
            console.log('User signed out from profile page');
            // onAuthStateChanged handles redirection
        })
        .catch((error) => {
            console.error('Sign out error:', error);
            alert('Error signing out. Please try again.');
        });
});
