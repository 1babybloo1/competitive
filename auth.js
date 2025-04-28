// --- Firebase Configuration ---
// IMPORTANT: Replace with your actual Firebase project config
const firebaseConfig = {
    apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI", // Replace with your key
    authDomain: "poxelcomp.firebaseapp.com",
    projectId: "poxelcomp",
    storageBucket: "poxelcomp.firebasestorage.app",
    messagingSenderId: "620490990104",
    appId: "1:620490990104:web:709023eb464c7d886b996d",
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// --- Initialize Firebase ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(); // Get the Auth service
const db = firebase.firestore(); // Initialize Firestore **(Added)**

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

// ** NEW Search Elements **
const searchInput = document.getElementById('user-search-input');
const searchResultsContainer = document.getElementById('user-search-results');

// --- Modal Display Logic ---
loginBtn.addEventListener('click', () => {
    loginModal.classList.add('active');
    loginError.textContent = ''; // Clear previous errors
});

signupBtn.addEventListener('click', () => {
    signupModal.classList.add('active');
    signupError.textContent = ''; // Clear previous errors
});

closeLoginBtn.addEventListener('click', () => loginModal.classList.remove('active'));
closeSignupBtn.addEventListener('click', () => signupModal.classList.remove('active'));

// Close modal if clicking outside the content
window.addEventListener('click', (event) => {
    if (event.target === loginModal) {
        loginModal.classList.remove('active');
    }
    if (event.target === signupModal) {
        signupModal.classList.remove('active');
    }
    // ** NEW: Close search results on outside click **
    if (searchResultsContainer.style.display === 'block' &&
        searchInput && !searchInput.contains(event.target) && // Check if searchInput exists
        !searchResultsContainer.contains(event.target)) {
        hideSearchResults();
    }
});

// --- Authentication Logic ---

// Signup
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    signupError.textContent = ''; // Clear previous errors

    const username = signupForm['signup-username'].value.trim();
    const email = signupForm['signup-email'].value;
    const password = signupForm['signup-password'].value;

    if (!username) {
        signupError.textContent = 'Please enter a username.';
        return;
    }

    // Show loading state (optional)
    const signupSubmitBtn = signupForm.querySelector('button');
    signupSubmitBtn.disabled = true;
    signupSubmitBtn.textContent = 'Signing up...';

    let signedInUser; // Variable to hold the user object

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            signedInUser = userCredential.user; // Store the user object
            console.log('User signed up:', signedInUser.uid);
            // Update profile with username
            return signedInUser.updateProfile({
                displayName: username
            });
        })
        .then(() => {
             console.log('Display name set for new user:', username);
             // ** Important: Create user document in Firestore **
             // This is crucial for the search to find the user later
             return db.collection('users').doc(signedInUser.uid).set({
                 displayName: username,
                 email: signedInUser.email, // Store email if needed
                 // Add other default profile fields if necessary
                 // e.g., currentRank: "Unranked", equippedTitle: "", etc.
                 createdAt: firebase.firestore.FieldValue.serverTimestamp()
             });
        })
        .then(() => {
            console.log("User profile document created in Firestore.");
            signupModal.classList.remove('active'); // Close modal
            // Consider removing redirect for better SPA feel
            // window.location.href = 'profile.html'; // Redirect to profile page
        })
        .catch((error) => {
            console.error("Signup Error:", error);
            signupError.textContent = getFirebaseErrorMessage(error);
        })
        .finally(() => {
            // Reset button state
             signupSubmitBtn.disabled = false;
             signupSubmitBtn.textContent = 'Sign Up';
        });
});

// Login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginError.textContent = ''; // Clear previous errors

    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;

     // Show loading state (optional)
    const loginSubmitBtn = loginForm.querySelector('button');
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Logging in...';

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in
            console.log('Login successful');
            loginModal.classList.remove('active'); // Close modal
            // Consider removing redirect for better SPA feel
            // window.location.href = 'profile.html'; // Redirect to profile page
        })
        .catch((error) => {
            console.error("Login Error:", error);
            loginError.textContent = getFirebaseErrorMessage(error);
        })
        .finally(() => {
            // Reset button state
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.textContent = 'Login';
        });
});

// Logout
logoutBtn.addEventListener('click', () => {
    auth.signOut()
        .then(() => {
            console.log('User signed out');
            // UI update is handled by onAuthStateChanged
        })
        .catch((error) => {
            console.error('Sign out error:', error);
        });
});


// --- Auth State Change Listener ---
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in
        console.log('User is logged in:', user.displayName || user.email);
        loginBtn.style.display = 'none';
        signupBtn.style.display = 'none';
        profileBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'inline-block';

        // ** Enable search bar only when logged in **
        if (searchInput) { // Check if element exists
             searchInput.disabled = false;
             searchInput.placeholder = "Search players...";
        }

    } else {
        // User is signed out
        console.log('User is logged out');
        loginBtn.style.display = 'inline-block';
        signupBtn.style.display = 'inline-block';
        profileBtn.style.display = 'none';
        logoutBtn.style.display = 'none';

        // ** Disable search bar when logged out **
        if (searchInput) { // Check if element exists
             searchInput.disabled = true;
             searchInput.placeholder = "Login to search players";
             searchInput.value = ''; // Clear search input on logout
             hideSearchResults(); // Hide any open results
        }

         // Redirect from profile page if logged out
         if (window.location.pathname.includes('profile.html')) {
             // Check if it's a profile page for a *specific user* using UID
             const urlParams = new URLSearchParams(window.location.search);
             const profileUid = urlParams.get('uid');
             // Only redirect if NOT viewing someone else's profile
             if (!profileUid) {
                console.log("Logged out on own profile page, redirecting to index.");
                window.location.href = 'index.html';
             } else {
                 console.log("Logged out, but viewing another user's profile. Staying on page.");
             }
         }
    }
});


// --- Helper Function for Firebase Error Messages ---
function getFirebaseErrorMessage(error) {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'Invalid email format.';
        case 'auth/user-disabled':
            return 'This user account has been disabled.';
        case 'auth/user-not-found':
            return 'No account found with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        case 'auth/email-already-in-use':
            return 'This email is already registered.';
        case 'auth/weak-password':
            return 'Password is too weak (should be at least 6 characters).';
        case 'auth/operation-not-allowed':
            return 'Email/password accounts are not enabled.';
        // Add more specific cases as needed
        default:
            // Try to return the default Firebase message if available
            return error.message || 'An unknown error occurred. Please try again.';
    }
}


// --- NEW: User Search Functionality ---

let searchTimeout;

// Function to fetch and display users
async function searchUsers(searchTerm) {
    // Ensure elements exist before proceeding
    if (!searchResultsContainer) return;

    if (searchTerm.length < 2) { // Minimum characters to search
        hideSearchResults();
        return;
    }

    searchResultsContainer.innerHTML = ''; // Clear previous results
    searchResultsContainer.style.display = 'block'; // Show dropdown

    try {
        // Query Firestore for users whose displayName starts with the searchTerm
        // Note: Default Firestore queries are case-sensitive.
        // For case-insensitive, consider storing a lowercase version of displayName.
        const querySnapshot = await db.collection('users')
            .orderBy('displayName') // Order by name for the range query
            .startAt(searchTerm)
            .endAt(searchTerm + '\uf8ff') // '\uf8ff' is a high Unicode character for range matching
            .limit(10) // Limit results for performance
            .get();

        if (querySnapshot.empty) {
            displayResults([]); // Show "no results" message
            return;
        }

        const users = [];
        querySnapshot.forEach(doc => {
            // Basic check if displayName exists
            if (doc.data().displayName) {
                users.push({
                    id: doc.id, // User UID
                    displayName: doc.data().displayName
                });
            }
        });

        // Filter out the current user from results if logged in
        const currentUser = auth.currentUser;
        const filteredUsers = currentUser
             ? users.filter(user => user.id !== currentUser.uid)
             : users;

        displayResults(filteredUsers);

    } catch (error) {
        console.error("Error searching users:", error);
        if (searchResultsContainer) { // Check again before modifying
             searchResultsContainer.innerHTML = '<div class="search-result-item no-results">Error loading results</div>';
        }
    }
}

// Function to render results in the dropdown
function displayResults(users) {
    if (!searchResultsContainer) return; // Ensure element exists

    searchResultsContainer.innerHTML = ''; // Clear previous

    if (users.length === 0) {
        searchResultsContainer.innerHTML = '<div class="search-result-item no-results">No players found</div>';
    } else {
        users.forEach(user => {
            const userElement = document.createElement('a'); // Use <a> for navigation
            userElement.classList.add('search-result-item');
            userElement.textContent = user.displayName;
            // ** CRUCIAL: Link to profile page with UID query parameter **
            userElement.href = `profile.html?uid=${user.id}`;

            // Add click listener to hide results *after* navigation starts
            userElement.addEventListener('click', (e) => {
                 // Don't prevent default navigation
                 console.log(`Selected profile: ${user.displayName} (UID: ${user.id})`);
                 // Hide results slightly delayed to ensure navigation occurs
                 setTimeout(hideSearchResults, 50);
            });

            searchResultsContainer.appendChild(userElement);
        });
    }
     searchResultsContainer.style.display = 'block';
}

// Function to hide the search results dropdown
function hideSearchResults() {
    if (searchResultsContainer) { // Ensure element exists
        searchResultsContainer.style.display = 'none';
        searchResultsContainer.innerHTML = ''; // Clear content
    }
}

// Event Listener for search input (Only add if searchInput exists)
if (searchInput) {
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout); // Clear previous timeout
        const searchTerm = searchInput.value.trim();

        if (!searchTerm) {
            hideSearchResults();
            return;
        }

        // Debounce: Wait 300ms after user stops typing before searching
        searchTimeout = setTimeout(() => {
            // Make sure user is still logged in before searching
            if (auth.currentUser) {
                searchUsers(searchTerm);
            } else {
                hideSearchResults(); // Should already be hidden by auth state, but safety check
            }
        }, 300);
    });

    // Hide results if input loses focus (handled by window click now)

    // Ensure dropdown closes if the search input is cleared manually (e.g., clicking 'x')
    searchInput.addEventListener('search', () => {
        if (!searchInput.value) {
            hideSearchResults();
        }
    });
} else {
    console.warn("Search input element ('user-search-input') not found.");
}


// --- Initial Check ---
console.log("Auth script loaded.");
