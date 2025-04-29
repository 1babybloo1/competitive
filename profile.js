<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Profile - Poxel Competitive</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="icon" type="image/x-icon" href="https://res.cloudinary.com/djttn4xvk/image/upload/v1744016662/iv8s8dkwdzxgnubsnhla.ico"> <!-- Favicon -->

    <!-- Cropper.js CSS -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css" rel="stylesheet">

    <!-- Font Awesome for Icons (Optional, if using fa-pencil-alt) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

    <!-- Your Custom Profile Styles -->
    <link rel="stylesheet" href="profile-styles.css">

    <style>
        /* ======================================== */
        /* Base Styles & Variables                */
        /* ======================================== */
        :root {
            --bg-dark: #121212;
            --bg-secondary: #1e1e1e;
            --text-light: #e0e0e0;
            --text-dark: #121212; /* Text on orange elements */
            --primary-orange: #ff6600;
            --primary-orange-darker: #e65c00;
            --border-light: #444;
            --rank-bronze-bg: #cd7f32;
            --rank-silver-bg: #c0c0c0;
            --rank-gold-bg: #ffd700;
            --rank-default-bg: #555; /* For unranked/other */
            --text-secondary: #aaa;
            /* Badge Colors */
            --badge-verified-bg: #00acee; /* Blue */
            --badge-creator-bg: #a970ff;  /* Purple */
            --badge-moderator-bg: #ff6600; /* Orange (matches primary) */
            --badge-tick-color: #ffffff;
            /* Profile Background Variable (set by JS) */
            --profile-bg-image: none;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Poppins', sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-light);
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        main { flex-grow: 1; padding: 0; } /* Remove default padding if any */

        /* ======================================== */
        /* Header & Navigation (Shared)           */
        /* ======================================== */
        header { background-color: var(--bg-secondary); padding: 1rem 0; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3); width: 100%; }
        .nav-container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 1.8rem; font-weight: 700; color: var(--text-light); text-decoration: none; }
        .auth-buttons button, .auth-buttons a.btn { margin-left: 0.8rem; }

        /* ======================================== */
        /* Buttons (Shared)                       */
        /* ======================================== */
        .btn { padding: 0.7rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem; font-weight: 600; transition: background-color 0.3s ease, color 0.3s ease, transform 0.1s ease, border-color 0.3s ease, box-shadow 0.3s ease; text-decoration: none; display: inline-block; text-align: center; line-height: 1.2; /* Ensure consistent height */ }
        .btn:disabled { cursor: not-allowed; opacity: 0.6; }
        .btn:active:not(:disabled) { transform: scale(0.97); }
        .btn-primary { background-color: var(--primary-orange); color: var(--text-dark); border: 2px solid var(--primary-orange); }
        .btn-primary:hover:not(:disabled) { background-color: var(--primary-orange-darker); border-color: var(--primary-orange-darker); box-shadow: 0 0 10px rgba(255, 102, 0, 0.5); color: var(--text-dark); }
        .btn-secondary { background-color: transparent; color: var(--text-light); border: 2px solid var(--border-light); }
        .btn-secondary:hover:not(:disabled) { background-color: rgba(224, 224, 224, 0.1); border-color: var(--text-light); color: var(--text-light); }

        /* ======================================== */
        /* Profile Page Specific Styles           */
        /* ======================================== */
        .profile-container {
            max-width: 800px;
            margin: 3rem auto;
            padding: 2.5rem 3rem;
            background-color: var(--bg-secondary); /* Fallback background */
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
            text-align: center;
            position: relative; /* Needed for pseudo-element */
            z-index: 1; /* Ensure content is above pseudo-element */
            overflow: hidden; /* Contain pseudo-element within border-radius */
        }

        /* Profile Background Styling */
        .profile-container::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background-image: var(--profile-bg-image); /* Use CSS variable */
            background-size: cover;
            background-position: center center;
            background-repeat: no-repeat;
            opacity: 0; /* Hidden by default */
            z-index: -1; /* Behind the content */
            border-radius: inherit; /* Match container's border radius */
            transition: opacity 0.5s ease-in-out;
        }

        .profile-container.has-background::before {
            opacity: 0.5; /* Show with opacity when class is added */
        }

        /* Profile Header Area */
        .profile-header { display: flex; flex-direction: column; align-items: center; margin-bottom: 3rem; gap: 1rem; }

        /* Profile Picture Area */
        #profile-pic {
            position: relative; /* Needed for icon positioning */
            width: 120px;
            height: 120px;
            background-color: var(--bg-secondary); /* Fallback color if no image */
            color: var(--text-light); /* Fallback text color */
            border-radius: 50%;
            display: flex; /* For centering initials */
            justify-content: center;
            align-items: center;
            border: 4px solid var(--primary-orange);
            box-shadow: 0 0 15px rgba(255, 102, 0, 0.4);
            overflow: hidden; /* Crucial: hide image parts outside circle */
            cursor: default; /* Default cursor */
        }

        #profile-pic #profile-initials {
            font-size: 4.5rem;
            font-weight: 700;
            line-height: 1;
            text-transform: uppercase;
            user-select: none; /* Prevent text selection */
            display: flex; /* Ensure it's a flex item for centering */
            align-items: center;
            justify-content: center;
        }

        #profile-pic img {
            display: none; /* Hidden initially, shown by JS if URL exists */
            width: 100%;
            height: 100%;
            object-fit: cover; /* Scale image nicely within the circle */
            border-radius: 50%; /* Ensure image itself is clipped if somehow larger */
        }

        #edit-profile-pic-icon {
            position: absolute;
            bottom: 5px;
            right: 5px;
            background-color: rgba(0, 0, 0, 0.6);
            color: white;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            display: none; /* Hidden by default, shown via JS for own profile */
            justify-content: center;
            align-items: center;
            cursor: pointer;
            font-size: 0.9rem; /* Size of the icon */
            border: 1px solid rgba(255, 255, 255, 0.5);
            transition: background-color 0.2s ease;
            z-index: 5; /* Above profile image */
        }

        #edit-profile-pic-icon:hover {
            background-color: rgba(0, 0, 0, 0.8);
        }

        /* Container for Username, Badges, Admin Tag */
        .profile-name-container { display: flex; align-items: center; justify-content: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.2rem; }
        #profile-username { font-size: 2.2rem; font-weight: 700; color: var(--text-light); margin: 0; word-break: break-all; /* Prevent long names breaking layout */ }
        #profile-badges-container { display: inline-flex; align-items: center; gap: 0.4rem; line-height: 1; vertical-align: middle; flex-shrink: 0; /* Prevent shrinking */ }
        .profile-badge { display: inline-flex; align-items: center; justify-content: center; width: 1.8em; height: 1.8em; border-radius: 50%; font-size: 0.8em; /* Relative to username font size */ font-weight: bold; color: var(--badge-tick-color); line-height: 1; vertical-align: middle; position: relative; }
        .profile-badge::before { content: '✔'; display: block; }
        .badge-verified { background-color: var(--badge-verified-bg); }
        .badge-creator { background-color: var(--badge-creator-bg); }
        .badge-moderator { background-color: var(--badge-moderator-bg); }
        .admin-tag { display: none; background-color: var(--primary-orange); color: var(--text-dark); padding: 0.6em 0.6em; border-radius: 4px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; vertical-align: middle; line-height: 1; flex-shrink: 0; }
        #profile-email { font-size: 1rem; color: var(--text-secondary); font-weight: 400; margin-top: 0; word-break: break-all; }

        /* Rank and Title Styles */
        .profile-identifiers { margin-top: 0.5rem; margin-bottom: 0.3rem; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0.8rem; position: relative; /* For title selector positioning */ }
        .profile-rank-display { background-color: var(--rank-default-bg); color: var(--text-light); padding: 0.2em 0.7em; border-radius: 15px; font-size: 0.9rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2; display: inline-block; transition: background-color 0.3s ease, color 0.3s ease; }
        .rank-unranked { background-color: var(--rank-default-bg); color: #ccc; }
        .rank-bronze { background-color: var(--rank-bronze-bg); color: var(--text-dark); }
        .rank-silver { background-color: var(--rank-silver-bg); color: var(--text-dark); }
        .rank-gold { background-color: var(--rank-gold-bg); color: var(--text-dark); }
        .rank-veteran { background-color: var(--primary-orange-darker); color: var(--text-dark); }
        .rank-legend { background: linear-gradient(to right, var(--primary-orange), #ffae00); color: var(--text-dark); }
        .profile-title-display { color: var(--primary-orange); font-size: 1rem; font-weight: 600; font-style: italic; display: inline-block; transition: color 0.2s ease; }
        #profile-title.selectable-title { cursor: pointer; text-decoration: underline; text-decoration-style: dotted; text-decoration-color: var(--primary-orange); }
        #profile-title.selectable-title:hover { color: var(--primary-orange-darker); text-decoration-color: var(--primary-orange-darker); }
        #profile-title.no-title-placeholder { color: var(--text-secondary); font-style: normal; }

        /* Title Selector Dropdown Styles */
        .title-selector { display: none; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 0.5rem; min-width: 180px; max-width: 90%; background-color: var(--bg-dark); border: 1px solid var(--border-light); border-radius: 6px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); padding: 0.5rem 0; z-index: 10; max-height: 200px; overflow-y: auto; }
        .title-option { display: block; background: none; border: none; color: var(--text-light); padding: 0.6rem 1rem; text-align: left; width: 100%; cursor: pointer; font-size: 0.95rem; transition: background-color 0.2s ease; white-space: nowrap; position: relative; }
        .title-option:hover { background-color: var(--bg-secondary); }
        .title-option.currently-equipped { font-weight: bold; color: var(--primary-orange); padding-left: 2.2rem; /* Space for tick */ }
        .title-option.currently-equipped::before { content: '✔'; position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); color: var(--primary-orange); font-size: 1em; line-height: 1; }
        .title-option-unequip { color: var(--text-secondary); font-style: italic; }

        /* Stats Sections Common Styles */
        .profile-stats { margin-top: 2.5rem; border-top: 1px solid var(--border-light); padding-top: 2.5rem; }
        .profile-stats h3 { margin-bottom: 2rem; color: var(--primary-orange); font-size: 1.7rem; font-weight: 600; text-align: center; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1.8rem; text-align: left; }
        .stats-grid > p { /* Style for loading/error messages */ color: var(--text-secondary); font-style: italic; grid-column: 1 / -1; text-align: center; padding: 1rem 0; }
        .stat-item { background-color: var(--bg-dark); padding: 1.3rem 1.6rem; border-radius: 8px; border-left: 5px solid var(--primary-orange); box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3); transition: transform 0.2s ease-out, box-shadow 0.2s ease-out; }
        .stat-item:hover { transform: translateY(-4px); box-shadow: 0 5px 10px rgba(0, 0, 0, 0.4); }
        .stat-item h4 { margin-bottom: 0.6rem; color: #ccc; font-size: 0.9rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .stat-item p { font-size: 1.7rem; font-weight: 700; color: var(--primary-orange); line-height: 1.2; margin: 0; word-break: break-word; }

        /* Loading / Not Logged In State */
        #loading-profile, #not-logged-in { max-width: 800px; margin: 3rem auto; padding: 4rem 2rem; background-color: var(--bg-secondary); border-radius: 10px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5); text-align: center; font-size: 1.2rem; color: var(--text-secondary); min-height: 300px; display: flex; justify-content: center; align-items: center; }

        /* ======================================== */
        /* Image Editing Modal Styles             */
        /* ======================================== */
        .modal-overlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background-color: rgba(0, 0, 0, 0.85); /* Darker overlay */
            display: none; /* Hidden by default */
            justify-content: center;
            align-items: center;
            z-index: 1000;
            padding: 20px; /* Padding around modal */
        }

        .modal-content {
            background-color: var(--bg-secondary);
            padding: 25px 30px;
            border-radius: 10px;
            max-width: 600px; /* Max width of modal */
            width: 95%; /* Responsive width */
            max-height: 90vh; /* Max height relative to viewport */
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            overflow: hidden; /* Prevent content spilling */
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid var(--border-light);
            padding-bottom: 15px;
            flex-shrink: 0; /* Prevent header shrinking */
        }

        .modal-header h3 {
            color: var(--primary-orange);
            margin: 0;
            font-size: 1.6rem;
        }

        .modal-close-btn {
            background: none; border: none;
            color: var(--text-secondary);
            font-size: 1.8rem;
            cursor: pointer;
            line-height: 1; padding: 5px;
            transition: color 0.2s ease;
        }
        .modal-close-btn:hover { color: var(--text-light); }

        .modal-body {
            flex-grow: 1; /* Allow body to take available space */
            margin-bottom: 20px;
            overflow: hidden; /* Important for Cropper containment */
            display: flex; /* Ensure container takes space */
            justify-content: center;
            align-items: center;
            background-color: var(--bg-dark); /* Dark background for image area */
            border-radius: 5px; /* Slight rounding */
        }

        #cropper-image-container {
            width: 100%;
            height: 100%; /* Container needs height for Cropper */
            min-height: 300px; /* Ensure minimum space for Cropper */
            max-height: calc(90vh - 200px); /* Rough estimate based on header/footer/padding */
            position: relative; /* For potential absolute positioning inside */
        }

        /* The actual image Cropper will use */
        #image-to-crop {
            display: block; /* Cropper requirement */
            max-width: 100%; /* Cropper requirement */
            max-height: 100%; /* Ensure it fits within container */
            opacity: 0; /* Hide until Cropper is ready and image loaded */
            transition: opacity 0.3s ease-in-out;
        }

        /* Cropper.js specific overrides */
        .cropper-view-box,
        .cropper-face {
            border-radius: 50%; /* Make the crop selection area visually circular */
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5); /* Dim area outside circle */
        }
        .cropper-modal {
            background: none; /* Remove default cropper modal background if using viewbox shadow */
        }
        /* Hide default dashed lines if using circular viewbox */
        .cropper-dashed { display: none; }


        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding-top: 15px;
            border-top: 1px solid var(--border-light);
            flex-shrink: 0; /* Prevent footer shrinking */
        }

        /* Loading Spinner for Apply Button */
        .spinner {
            border: 3px solid rgba(255, 255, 255, 0.3); /* Lighter border */
            border-radius: 50%;
            border-top-color: var(--text-dark); /* Spinner color (for on-button use) */
            width: 16px; height: 16px;
            animation: spin 1s linear infinite;
            display: inline-block;
            margin-left: 8px;
            vertical-align: middle; /* Align with button text */
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        /* Add spinner styles directly to button if preferred */
        .btn .spinner { border-top-color: currentColor; } /* Inherit color */


        /* ======================================== */
        /* Footer (Shared)                        */
        /* ======================================== */
        footer { text-align: center; padding: 1.5rem 1rem; margin-top: auto; background-color: var(--bg-secondary); color: var(--text-secondary); font-size: 0.9rem; border-top: 1px solid var(--border-light); }

        /* ======================================== */
        /* Responsive Adjustments                 */
        /* ======================================== */
        @media (max-width: 768px) {
            .nav-container { flex-direction: column; align-items: center; gap: 0.8rem; }
            .auth-buttons { margin-top: 0.8rem; }
            .profile-container { margin: 2rem auto; padding: 2rem 1.5rem; }
            #profile-pic { width: 100px; height: 100px; border-width: 3px;}
            #profile-pic #profile-initials { font-size: 3.5rem; }
            #edit-profile-pic-icon { width: 25px; height: 25px; font-size: 0.8rem; bottom: 3px; right: 3px; }
            #profile-username { font-size: 1.9rem; }
            .profile-stats h3 { font-size: 1.5rem; }
            .stats-grid { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1.2rem; }
            .stat-item p { font-size: 1.5rem; }
            #loading-profile, #not-logged-in { min-height: 250px; padding: 3rem 1.5rem; }
            .profile-badge { font-size: 0.75em; }
            .modal-content { padding: 20px; }
            .modal-header h3 { font-size: 1.4rem; }
            #cropper-image-container { min-height: 250px; }
        }

        @media (max-width: 480px) {
            .logo { font-size: 1.5rem; }
            .btn { padding: 0.6rem 1.2rem; font-size: 0.9rem; }
            .auth-buttons button, .auth-buttons a.btn { margin-left: 0.5rem; }
            .profile-container { margin: 1.5rem auto; padding: 1.5rem 1.2rem; border-radius: 8px; }
            .profile-header { margin-bottom: 2rem; gap: 0.8rem; }
            #profile-pic { width: 85px; height: 85px; border-width: 3px;}
            #profile-pic #profile-initials { font-size: 3rem; }
            #edit-profile-pic-icon { width: 22px; height: 22px; font-size: 0.7rem; bottom: 2px; right: 2px; }
            #profile-username { font-size: 1.6rem; }
            #profile-email { font-size: 0.9rem; }
            .profile-stats { padding-top: 1.8rem; margin-top: 1.8rem; }
            .profile-stats h3 { font-size: 1.4rem; margin-bottom: 1.5rem; }
            .stats-grid { grid-template-columns: 1fr; /* Stack stats */ gap: 1rem; }
            .stat-item { padding: 1rem 1.2rem; }
            .stat-item h4 { font-size: 0.85rem; }
            .stat-item p { font-size: 1.4rem; }
            #loading-profile, #not-logged-in { min-height: 200px; padding: 2rem 1rem; font-size: 1.1rem; }
            .profile-name-container { gap: 0.3rem; }
            .profile-badge { font-size: 0.7em; }
            .profile-identifiers { gap: 0.5rem; margin-top: 0.3rem; }
            .profile-rank-display { font-size: 0.8rem; padding: 0.2em 0.6em; }
            .profile-title-display { font-size: 0.9rem; }
            .title-selector { min-width: 150px; }
            .title-option { font-size: 0.9rem; padding: 0.5rem 0.8rem; }
            .title-option.currently-equipped { padding-left: 2rem; }
            .title-option.currently-equipped::before { left: 0.6rem; }
            .modal-content { padding: 15px; }
            .modal-header { margin-bottom: 15px; padding-bottom: 10px; }
            .modal-header h3 { font-size: 1.3rem; }
            .modal-body { margin-bottom: 15px; }
            #cropper-image-container { min-height: 200px; max-height: calc(90vh - 160px); }
            .modal-footer { gap: 8px; padding-top: 10px; }
            .modal-footer .btn { padding: 0.6rem 1rem; font-size: 0.9rem; } /* Adjust modal button padding */
        }

    </style>
</head>
<body>
    <!-- Header -->
    <header>
        <div class="nav-container">
            <a href="index.html" class="logo">Poxel Competitive</a>
            <div class="auth-buttons">
                <!-- Navigation buttons (adjust links as needed) -->
                <a href="main.html" class="btn btn-secondary">Matches</a>
                <!-- Logout button is shown/hidden by JS -->
                <button class="btn btn-primary" id="profile-logout-btn" style="display: none;">Logout</button>
                 <!-- Add login/signup buttons if needed, potentially handled by another script or shown when logged out -->
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main>
        <!-- Profile Content Area (Initially Hidden by JS, shown after load) -->
        <div class="profile-container" id="profile-content" style="display: none;">
            <!-- Profile Header: Pic, Name, Badges, Rank, Title, Email -->
            <div class="profile-header">
                <!-- Profile Picture Area -->
                <div id="profile-pic">
                    <!-- Fallback Initials (shown if no image) -->
                    <span id="profile-initials">?</span>
                    <!-- Profile Image (src set by JS) -->
                    <img id="profile-image" src="" alt="Profile Picture" style="display: none;">
                    <!-- Edit Icon (shown by JS only for profile owner) -->
                    <span id="edit-profile-pic-icon" title="Edit Profile Picture">
                        <i class="fas fa-pencil-alt"></i> <!-- Font Awesome Icon -->
                        <!-- Alternative: use text: <span style="font-size: 1.2rem;">✏️</span> -->
                    </span>
                </div>
                 <!-- Hidden File Input (triggered by clicking the edit icon) -->
                <input type="file" id="profile-pic-input" accept="image/png, image/jpeg, image/gif" style="display: none;">

                <!-- User Details Section -->
                <div>
                    <div class="profile-name-container">
                        <h2 id="profile-username">Username</h2>
                        <span id="profile-badges-container"><!-- Badges added by JS --></span>
                        <span id="admin-tag" class="admin-tag">Admin</span>
                    </div>
                    <div class="profile-identifiers">
                        <span id="profile-rank" class="profile-rank-display">...</span>
                        <span id="profile-title" class="profile-title-display" style="display: none;"><!-- Title added/updated by JS --></span>
                         <!-- Title selector dropdown div will be appended here by JS -->
                    </div>
                    <p id="profile-email">user@example.com</p>
                </div>
            </div>

            <!-- Competitive Stats Section -->
            <div class="profile-stats" id="competitive-stats-section">
                <h3>Competitive Stats</h3>
                <div class="stats-grid" id="stats-display">
                    <!-- Stats items or loading/error message added by JS -->
                    <p>Loading competitive stats...</p>
                </div>
            </div>

            <!-- Poxel.io Stats Section -->
            <div class="profile-stats" id="poxel-stats-section" style="display: none;"> <!-- Hidden initially, shown by JS if data exists -->
                <h3>Poxel.io Stats</h3>
                <div class="stats-grid" id="poxel-stats-display">
                    <!-- Poxel stats or loading/error message added by JS -->
                    <p>Loading Poxel.io stats...</p>
                </div>
            </div>

        </div> <!-- End #profile-content -->

        <!-- Loading Profile Message (Shown initially) -->
        <div class="profile-container" id="loading-profile">
            <p>Loading profile...</p>
        </div>

        <!-- Not Logged In / Error Message (Shown by JS if needed) -->
        <div class="profile-container" id="not-logged-in" style="display: none;">
            <!-- Message content set by JS -->
            <p>You need to be logged in to view this page.</p>
        </div>

    </main> <!-- End main -->

    <!-- Footer -->
    <footer>
        <p>© 2024 Poxel Competitive. All rights reserved.</p>
    </footer>

    <!-- Image Editing Modal -->
    <div class="modal-overlay" id="edit-modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Edit Profile Picture</h3>
                <button class="modal-close-btn" id="modal-close-btn" title="Close">×</button>
            </div>
            <div class="modal-body">
                <div id="cropper-image-container">
                    <!-- Image source is set by JS when a file is selected -->
                    <img id="image-to-crop" src="" alt="Image preview for cropping">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                <button class="btn btn-primary" id="modal-apply-btn">
                    Apply
                    <!-- Spinner shown during upload -->
                    <span class="spinner" id="modal-spinner" style="display: none;"></span>
                 </button>
            </div>
        </div>
    </div> <!-- End #edit-modal -->


    <!-- === External Scripts === -->

    <!-- Firebase SDK Scripts (Compat Version) -->
    <script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore-compat.js"></script>

    <!-- Cropper.js Script -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js"></script>

    <!-- Cloudinary Script (Using Upload Widget for simplicity - can be removed if using fetch API only) -->
    <!-- <script src="https://upload-widget.cloudinary.com/global/all.js" type="text/javascript"></script> -->
    <!-- Note: The JS provided uses the fetch API for uploads, so the widget script isn't strictly necessary unless you plan to use its UI features elsewhere. -->

    <!-- Your Profile Logic Script -->
    <script src="profile.js"></script>

</body>
</html>
