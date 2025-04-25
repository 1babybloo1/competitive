// --- Firebase Configuration ---
// IMPORTANT: Replace with your actual Firebase project config
const firebaseConfig = {
    apiKey: "AIzaSyDWFPys8dbSgis98tbm5PVqMuHqnCpPIxI",
    authDomain: "poxelcomp.firebaseapp.com",
    projectId: "poxelcomp",
    storageBucket: "poxelcomp.firebasestorage.app",
    messagingSenderId: "620490990104",
    appId: "1:620490990104:web:709023eb464c7d886b996d",
};

// --- Initialize Firebase ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(); // Get the Auth service

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

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in
            const user = userCredential.user;
            // Update profile with username
            return user.updateProfile({
                displayName: username
            });
        })
        .then(() => {
            // Profile updated successfully
            console.log('Signup and profile update successful');
            signupModal.classList.remove('active'); // Close modal
            window.location.href = 'profile.html'; // Redirect to profile page
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
            window.location.href = 'profile.html'; // Redirect to profile page
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
            // No need to redirect here, onAuthStateChanged will handle UI update
            // If you WANT to force redirect immediately:
            // window.location.href = 'index.html';
        })
        .catch((error) => {
            console.error('Sign out error:', error);
        });
});


// --- Auth State Change Listener ---
// Listens for authentication state changes (login/logout)
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in
        console.log('User is logged in:', user.displayName || user.email);
        loginBtn.style.display = 'none';
        signupBtn.style.display = 'none';
        profileBtn.style.display = 'inline-block'; // Show profile button
        logoutBtn.style.display = 'inline-block';  // Show logout button

        // Optional: If user is logged in and on index.html, maybe redirect?
        // if (window.location.pathname === '/index.html' || window.location.pathname === '/') {
        //    window.location.href = 'profile.html';
        // }

    } else {
        // User is signed out
        console.log('User is logged out');
        loginBtn.style.display = 'inline-block';
        signupBtn.style.display = 'inline-block';
        profileBtn.style.display = 'none';
        logoutBtn.style.display = 'none';

         // If user logs out while ON the profile page, redirect them
         if (window.location.pathname.includes('profile.html')) {
             window.location.href = 'index.html';
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
            return 'An unknown error occurred. Please try again.';
    }
}
