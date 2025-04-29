// --- Firebase Configuration ---
// IMPORTANT: Replace with your actual Firebase project config if the placeholders are not correct
const firebaseConfig = {
  apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI",
  authDomain: "poxelcomp.firebaseapp.com",
  projectId: "poxelcomp",
  storageBucket: "poxelcomp.firebasestorage.app",
  messagingSenderId: "620490990104",
  appId: "1:620490990104:web:709023eb464c7d886b996d",
};

// --- Initialize Firebase (Corrected - Initialize only ONCE) ---
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();       // Get the Auth service
const db = firebase.firestore();    // Initialize Firestore

// --- DOM Elements ---
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const profileBtn = document.getElementById('profile-btn'); // Link to profile page
const logoutBtn = document.getElementById('logout-btn');   // Logout button

const loginModal = document.getElementById('login-modal');
const signupModal = document.getElementById('signup-modal');
const closeLoginBtn = document.getElementById('close-login');
const closeSignupBtn = document.getElementById('close-signup');

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');

const searchInput = document.getElementById('user-search-input');
const searchResultsContainer = document.getElementById('user-search-results');

// --- Modal Display Logic ---
loginBtn.addEventListener('click', () => {
    loginModal.classList.add('active');
    loginError.textContent = '';
});

signupBtn.addEventListener('click', () => {
    signupModal.classList.add('active');
    signupError.textContent = '';
});

closeLoginBtn.addEventListener('click', () => loginModal.classList.remove('active'));
closeSignupBtn.addEventListener('click', () => signupModal.classList.remove('active'));

window.addEventListener('click', (event) => {
    if (event.target === loginModal) loginModal.classList.remove('active');
    if (event.target === signupModal) signupModal.classList.remove('active');
    if (searchResultsContainer && searchResultsContainer.style.display === 'block' &&
        searchInput && !searchInput.contains(event.target) &&
        !searchResultsContainer.contains(event.target)) {
        hideSearchResults();
    }
});

// --- Authentication Logic ---

// Signup (WITH ADDED LOGGING)
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    signupError.textContent = '';

    const username = signupForm['signup-username'].value.trim();
    const email = signupForm['signup-email'].value;
    const password = signupForm['signup-password'].value;

    if (!username) {
        signupError.textContent = 'Please enter a username.';
        return;
    }

    const signupSubmitBtn = signupForm.querySelector('button');
    signupSubmitBtn.disabled = true;
    signupSubmitBtn.textContent = 'Signing up...';

    let signedInUser; // Variable to hold the user object from Auth

    // 1. Create Firebase Auth user
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            signedInUser = userCredential.user; // Store the Auth user
            console.log('AUTH.JS: Firebase Auth user created:', signedInUser.uid);

            // 2. Update Firebase Auth Profile (separate from Firestore)
            return signedInUser.updateProfile({
                displayName: username
            });
        })
        .then(() => {
             console.log('AUTH.JS: Firebase Auth display name set:', username);

             // ** START OF DIAGNOSTIC LOGGING **
             console.log('AUTH.JS: Checking Firestore instance `db`:', db); // Check if db is valid
             // ** END OF DIAGNOSTIC LOGGING **

             // 3. **Create User Document in Firestore with FULL Profile Structure**
             const userDocRef = db.collection('users').doc(signedInUser.uid);
             const defaultProfileData = {
                 email: signedInUser.email,
                 displayName: username,
                 currentRank: "Unranked",
                 equippedTitle: "",
                 availableTitles: [],
                 friends: [],
                 createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                 leaderboardStats: {} // Initialize stats field
             };

             // ** ADDED LOGGING **
             console.log(`AUTH.JS: Attempting to SET Firestore document for UID: ${signedInUser.uid} with data:`, JSON.parse(JSON.stringify(defaultProfileData))); // Log clean data
             // ** Use JSON.parse(JSON.stringify()) to avoid logging complex Firebase objects like FieldValue

             // The actual database write:
             return userDocRef.set(defaultProfileData); // Use set() to create or overwrite
        })
        .then(() => {
            // This block ONLY runs if the userDocRef.set() above SUCCEEDS
            // ** ADDED LOGGING **
            console.log(`AUTH.JS: Successfully SET Firestore document for UID: ${signedInUser.uid}`);

            signupModal.classList.remove('active'); // Close modal on success
            // Optional: Redirect or update UI further
        })
        .catch((error) => {
            // This block runs if ANY previous step fails
            // ** ENHANCED LOGGING **
            console.error(`AUTH.JS: Signup Error Encountered!`);
            console.error(`AUTH.JS: Error Code: ${error.code}`);
            console.error(`AUTH.JS: Error Message: ${error.message}`);
            // Log the user state if available to see where it failed
            if (signedInUser) {
                 console.error(`AUTH.JS: Error occurred AFTER Auth user creation (UID: ${signedInUser.uid}). The Firestore document write likely failed.`);
            } else {
                 console.error(`AUTH.JS: Error occurred DURING Auth user creation or Auth profile update.`);
            }
            // Log the full error object for more details if needed
            console.error("AUTH.JS: Full error object:", error);

            signupError.textContent = getFirebaseErrorMessage(error);
        })
        .finally(() => {
            // Reset button state regardless of success or failure
             signupSubmitBtn.disabled = false;
             signupSubmitBtn.textContent = 'Sign Up';
        });
});

// Login (No changes needed here)
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;
    const loginSubmitBtn = loginForm.querySelector('button');
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Logging in...';

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log('Login successful for UID:', userCredential.user.uid);
            loginModal.classList.remove('active');
        })
        .catch((error) => {
            console.error("Login Error:", error);
            loginError.textContent = getFirebaseErrorMessage(error);
        })
        .finally(() => {
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.textContent = 'Login';
        });
});

// Logout (No changes needed here)
logoutBtn.addEventListener('click', () => {
    auth.signOut()
        .then(() => console.log('User signed out'))
        .catch((error) => console.error('Sign out error:', error));
});

// --- Auth State Change Listener (No changes needed here) ---
auth.onAuthStateChanged(user => {
    if (user) {
        console.log('Auth state: Logged in -', user.uid, user.displayName);
        loginBtn.style.display = 'none';
        signupBtn.style.display = 'none';
        profileBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'inline-block';
        if (searchInput) {
             searchInput.disabled = false;
             searchInput.placeholder = "Search players...";
        }
    } else {
        console.log('Auth state: Logged out');
        loginBtn.style.display = 'inline-block';
        signupBtn.style.display = 'inline-block';
        profileBtn.style.display = 'none';
        logoutBtn.style.display = 'none';
        if (searchInput) {
             searchInput.disabled = true;
             searchInput.placeholder = "Login to search players";
             searchInput.value = '';
             hideSearchResults();
        }
         // Optional: Redirect logic when logged out on profile page
         if (window.location.pathname.includes('profile.html')) {
             const urlParams = new URLSearchParams(window.location.search);
             const profileUid = urlParams.get('uid');
             if (!profileUid) {
                console.log("Logged out on own profile page, redirecting to index might be desired.");
                // window.location.href = 'index.html'; // Uncomment to enable redirect
             }
         }
    }
});

// --- Helper Function for Firebase Error Messages (No changes needed) ---
function getFirebaseErrorMessage(error) {
    switch (error.code) {
        case 'auth/invalid-email': return 'Invalid email format.';
        case 'auth/user-disabled': return 'This user account has been disabled.';
        case 'auth/user-not-found': return 'No account found with this email.';
        case 'auth/wrong-password': return 'Incorrect password.';
        case 'auth/email-already-in-use': return 'This email is already registered.';
        case 'auth/weak-password': return 'Password is too weak (should be at least 6 characters).'; // Corrected typo
        case 'auth/operation-not-allowed': return 'Email/password accounts are not enabled.';
        // Add specific Firestore error codes if needed, e.g., 'permission-denied'
        case 'permission-denied': return 'Database permission denied. Could not save profile.';
        default: return error.message || 'An unknown error occurred. Please try again.';
    }
}

// --- User Search Functionality (No changes needed here) ---
let searchTimeout;

async function searchUsers(searchTerm) {
    if (!searchResultsContainer) return;
     if (searchTerm.length < 2) { hideSearchResults(); return; }
     searchResultsContainer.innerHTML = ''; searchResultsContainer.style.display = 'block';
     try {
         const querySnapshot = await db.collection('users')
             .orderBy('displayName') .startAt(searchTerm) .endAt(searchTerm + '\uf8ff') .limit(10) .get();
         if (querySnapshot.empty) { displayResults([]); return; }
         const users = []; querySnapshot.forEach(doc => { if (doc.data().displayName) users.push({ id: doc.id, displayName: doc.data().displayName }); });
         const currentUser = auth.currentUser; const filteredUsers = currentUser ? users.filter(user => user.id !== currentUser.uid) : users;
         displayResults(filteredUsers);
     } catch (error) { console.error("Error searching users:", error); if (searchResultsContainer) searchResultsContainer.innerHTML = '<div class="search-result-item no-results">Error loading results</div>'; }
}

function displayResults(users) {
    if (!searchResultsContainer) return; searchResultsContainer.innerHTML = '';
     if (users.length === 0) { searchResultsContainer.innerHTML = '<div class="search-result-item no-results">No players found</div>'; }
     else { users.forEach(user => { const userElement = document.createElement('a'); userElement.classList.add('search-result-item'); userElement.textContent = user.displayName; userElement.href = `profile.html?uid=${user.id}`; userElement.addEventListener('click', (e) => { console.log(`Selected profile: ${user.displayName} (UID: ${user.id})`); setTimeout(hideSearchResults, 50); }); searchResultsContainer.appendChild(userElement); }); }
     searchResultsContainer.style.display = 'block';
}

function hideSearchResults() {
    if (searchResultsContainer) { searchResultsContainer.style.display = 'none'; searchResultsContainer.innerHTML = ''; }
}

if (searchInput) {
    searchInput.addEventListener('input', () => { clearTimeout(searchTimeout); const searchTerm = searchInput.value.trim(); if (!searchTerm) { hideSearchResults(); return; } searchTimeout = setTimeout(() => { if (auth.currentUser) searchUsers(searchTerm); else hideSearchResults(); }, 300); });
    searchInput.addEventListener('search', () => { if (!searchInput.value) hideSearchResults(); });
} else { console.warn("Search input element ('user-search-input') not found."); }

// --- Initial Check ---
console.log("Auth script loaded.");
