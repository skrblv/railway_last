// frontend/player.js

// --- Data Storage ---
let fetchedVenueData = []; // Will be filled by API call
let currentVenueIndex = 0; // Track the currently displayed venue in the swiper

// --- Constants ---
const DOT_WIDTH = 8; // px
const DOT_MARGIN = 4; // px
const MAP_ZOOM_LEVEL = 15;
const API_BASE_URL = "/api"; // Adapt if needed

// !!! CRITICAL CONFIGURATION: Set this to match your backend URL pattern !!!
const VENUE_DETAIL_BASE_PATH = '/venue/'; // <<<--- CHECK AND CHANGE THIS PATH IF NEEDED

// --- Paths relative to index.html (Placeholders - check if needed elsewhere) ---
// Use Django static paths managed by the template tag in index.html
const PLACEHOLDER_VENUE_IMAGE = '/static/assets/placeholder-building.jpg';
const PLACEHOLDER_ALBUM_ART = '/static/assets/placeholder-album.png';

// Theme Class Constants for index.html
const THEME_POSITIVE_CLASS = 'theme-positive'; // Matches style.css body.theme-positive
const THEME_SAD_CLASS = 'theme-sad';       // Matches style.css body.theme-sad

// --- Leaflet Map Variables ---
let venueMapInstance = null;
let venueMarker = null;

// --- Swiper State Variables ---
let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let diffX = 0;
let cardWidth = 0;
let touchStartTime = 0;
const TAP_THRESHOLD_X = 15;
const TAP_THRESHOLD_Y = 20;
const MAX_TAP_DURATION = 350;

// =========================================================================
// == Helper Functions (Format Time, Update Icon, Navigation) ==============
// =========================================================================

/**
 * Formats time in seconds to a mm:ss string.
 * @param {number} seconds - Time in seconds.
 * @returns {string} Formatted time string.
 */
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
}

/**
 * Updates the play/pause button icon based on the audio player's state.
 */
function updatePlayPauseIconState() {
    const audioPlayer = document.getElementById("audio-player");
    const playPauseIcon = document.getElementById("play-pause-icon");
    const playPauseBtn = document.getElementById("play-pause-btn");
    if (!audioPlayer || !playPauseIcon || !playPauseBtn) return;

    const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M8 5v14l11-7z"/></svg>`;
    const pauseIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

    // Update icon based ONLY on the player's paused state
    if (audioPlayer.paused) {
        playPauseIcon.innerHTML = playIconSvg;
        playPauseBtn.setAttribute("aria-label", "Play");
    } else {
        playPauseIcon.innerHTML = pauseIconSvg;
        playPauseBtn.setAttribute("aria-label", "Pause");
    }
}

/**
 * Navigates the browser to the detail page for the given venue ID.
 * Ensures the base path ends with a slash.
 * @param {string | number | null | undefined} venueId - The ID of the venue.
 */
function navigateToVenueDetail(venueId) {
    console.log("[Nav] navigateToVenueDetail called with ID:", venueId);
    if (venueId === null || venueId === undefined || venueId === '') {
        console.warn("[Nav] Cannot navigate: venueId is missing or invalid:", venueId);
        return;
    }

    // --- Ensure trailing slash consistency ---
    let basePath = VENUE_DETAIL_BASE_PATH;
    if (!basePath.endsWith('/')) {
        basePath += '/';
    }
    const targetUrl = `${basePath}${venueId}/`; // Append ID and ensure final slash
    // ------------------------------------------

    console.log("[Nav] Attempting to navigate to:", targetUrl);
    try {
        window.location.href = targetUrl;
    } catch (e) {
        console.error("[Nav] Error during navigation attempt to", targetUrl, ":", e);
        // Optionally, provide user feedback here (e.g., alert)
        // alert("Navigation failed. Please try again.");
    }
}

// =========================================================================
// == API Fetching Functions (Venues Only) =================================
// =========================================================================

/**
 * Fetches venue data from the backend API.
 * Updates `fetchedVenueData`.
 * Handles potential pagination in the response.
 * Shows error messages in the UI on failure.
 */
async function fetchVenues() {
    console.log("Attempting to fetch venues...");
    try {
        const response = await fetch(`${API_BASE_URL}/venues/`);
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`); }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const rawData = await response.json();
            // Handle potential pagination structure ({ count, next, previous, results })
            const data = rawData.results || rawData;
            if (!Array.isArray(data)) {
                console.warn("Fetched venue data (or results) is not an array, resetting.", data);
                fetchedVenueData = [];
            } else {
                fetchedVenueData = data;
                console.log("Fetched Venues:", fetchedVenueData.length, "items");
            }
        } else {
            const textResponse = await response.text();
            throw new Error(`Expected JSON, but received ${contentType}. Response: ${textResponse}`);
        }
    } catch (error) {
        console.error("Could not fetch venues:", error);
        fetchedVenueData = []; // Reset data on error
        // Display error in the swiper area
        const swiperSection = document.getElementById("venue-details-card")?.parentElement;
        if (swiperSection) swiperSection.innerHTML = `<p class="error-message">Error loading venues: ${error.message}</p>`;
        // Display error in the map area
        const venueMapContainer = document.getElementById("venue-map");
        if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Venue data unavailable.</p>";
    }
}

// =========================================================================
// == VISUAL Theme Application Function (NO AUDIO LOGIC) ===================
// =========================================================================

/**
 * Applies the visual theme by adding/removing CSS classes on the body element.
 * Does NOT interact with the audio player. Accepts 'positive' or 'sad'.
 * @param {string} themeName - The name of the theme ('positive' or 'sad').
 */
function applyTheme(themeName) {
    const body = document.body;
    if (!body) {
        console.error("Cannot apply theme: document.body not found.");
        return;
    }

    console.log(`Applying visual theme: ${themeName}`);

    // Remove existing theme classes first
    body.classList.remove(THEME_POSITIVE_CLASS, THEME_SAD_CLASS);

    // Add the new theme class based on the name
    if (themeName === 'positive') {
        // For index.html, positive theme might just be the absence of theme-sad
        // Or add the specific class if your style.css requires it
        body.classList.add(THEME_POSITIVE_CLASS); // Use the class defined in style.css
    } else if (themeName === 'sad') {
        body.classList.add(THEME_SAD_CLASS); // Use the class defined in style.css
    } else {
        console.warn(`Unknown theme name: '${themeName}'. Applying default (using .theme-positive).`);
        // Apply default theme (e.g., positive)
         body.classList.add(THEME_POSITIVE_CLASS);
    }

    // NO AUDIO PLAYER LOGIC HERE.
    console.log("Body classes after theme update:", body.className);
}

// =========================================================================
// == FIXED Music Player Initialization & Controls =========================
// =========================================================================

/**
 * Initializes the music player to play the fixed song and sets up its controls.
 * Gets the correct static path from the data attribute.
 */
function initializeFixedPlayer() {
    console.log("Initializing Fixed Music Player...");
    const audioPlayer = document.getElementById("audio-player");
    const playPauseBtn = document.getElementById("play-pause-btn");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const progressContainer = document.getElementById("progress-container");
    const volumeSlider = document.getElementById("volume-slider");
    const totalTimeEl = document.getElementById("total-time");
    const currentTimeEl = document.getElementById("current-time");
    const progress = document.getElementById("progress"); // The progress fill element

    // Check for essential elements
    if (!audioPlayer || !playPauseBtn || !prevBtn || !nextBtn || !progressContainer || !volumeSlider || !totalTimeEl || !currentTimeEl || !progress) {
        console.warn("Fixed player init failed: One or more core elements missing. Check IDs: audio-player, play-pause-btn, prev-btn, next-btn, progress-container, volume-slider, total-time, current-time, progress");
        return;
    }

    // --- Get the correct static audio source from data attribute ---
    const fixedSongUrl = audioPlayer.dataset.staticSrc; // Read from data-static-src
    if (!fixedSongUrl) {
        console.error("Fixed player init failed: Missing 'data-static-src' attribute on audio element. Make sure the {% static %} tag rendered correctly.");
        if (totalTimeEl) totalTimeEl.textContent = "Error";
        return; // Stop initialization if source URL is missing
    }


    // --- Set the fixed audio source ---
    // Use URL constructor for a reliable comparison, in case Django returns a full URL
    const absoluteFixedUrl = new URL(fixedSongUrl, window.location.href).href;
    if (audioPlayer.src !== absoluteFixedUrl) {
        console.log("Setting fixed audio source from data attribute:", fixedSongUrl);
        audioPlayer.src = fixedSongUrl; // Set src to the value from data attribute
        // Metadata (title, artist, album art) should be set directly in the HTML
    } else {
        console.log("Fixed audio source already set:", audioPlayer.src);
    }

    // --- Event Listeners for Fixed Player ---

    // Update total time display when metadata loads
    audioPlayer.addEventListener("loadedmetadata", () => {
        console.log("Fixed song metadata loaded.");
        if (totalTimeEl && audioPlayer.duration && !isNaN(audioPlayer.duration)) {
            totalTimeEl.textContent = formatTime(audioPlayer.duration);
        } else if (totalTimeEl) {
            totalTimeEl.textContent = "0:00"; // Fallback display
        }
        updatePlayPauseIconState(); // Ensure icon matches initial state (usually paused)
    });

    // Handle audio loading errors
    audioPlayer.addEventListener("error", (e) => {
        // Log a more informative error message
        let errorMsg = 'Unknown error';
        if (e.target && e.target.error) {
            switch (e.target.error.code) {
                case e.target.error.MEDIA_ERR_ABORTED: errorMsg = 'Fetch aborted by user.'; break;
                case e.target.error.MEDIA_ERR_NETWORK: errorMsg = 'Network error occurred.'; break;
                case e.target.error.MEDIA_ERR_DECODE: errorMsg = 'Decoding error occurred.'; break;
                case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMsg = 'Audio source not supported (check path/format/server).'; break;
                default: errorMsg = 'An unknown error occurred.'; break;
            }
        }
        console.error(`Fixed Audio Player Error: ${errorMsg}. Source: ${audioPlayer.src}`, e); // Log specific error
        if (totalTimeEl) totalTimeEl.textContent = "Error";
        if (progress) progress.style.width = "0%";
        if (currentTimeEl) currentTimeEl.textContent = "0:00";
        updatePlayPauseIconState(); // Show play icon if error occurs
    });

    // --- Control Functions ---

    function togglePlayPause() {
        // Verify source is set before attempting to play
        if (!audioPlayer.src || audioPlayer.src === window.location.href) { // Check if src is empty or points to the page itself
            console.warn("Cannot play/pause: Fixed audio source not set or invalid.", audioPlayer.src);
            // Attempt to recover using data attribute if needed
            const correctSrc = audioPlayer.dataset.staticSrc;
            if (correctSrc && audioPlayer.src !== correctSrc) {
                console.log("Attempting to reload fixed audio source from data attribute.");
                audioPlayer.src = correctSrc;
                audioPlayer.load(); // Trigger loading
            }
            return;
        }

        if (audioPlayer.paused) {
            console.log("Attempting to play...");
            // Check readyState before playing
            if (audioPlayer.readyState >= 2) { // HAVE_CURRENT_DATA or more
                 const playPromise = audioPlayer.play();
                 if (playPromise !== undefined) {
                     playPromise.catch(e => {
                        console.error("Audio play failed:", e);
                        // Common issue: User hasn't interacted with the page yet.
                        if (e.name === 'NotAllowedError') {
                            console.warn("Autoplay was prevented. User interaction is required to start audio.");
                            // Optionally display a message to the user
                        }
                        updatePlayPauseIconState(); // Update icon on immediate failure
                     });
                 }
                 // Icon state will be updated by the 'play' event listener on success
            } else {
                console.log("Audio not ready to play yet (readyState:", audioPlayer.readyState,"), attempting load...");
                audioPlayer.load(); // Try loading again
                // Optionally, try playing once loadedmetadata fires again
            }
        } else {
            console.log("Attempting to pause...");
            audioPlayer.pause();
            // Icon state will be updated by the 'pause' event listener
        }
    }

    function updateProgress() {
        // Ensure elements exist before updating
        if (!progress || !currentTimeEl) return;

        if (audioPlayer.duration && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
            const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            progress.style.width = `${progressPercent}%`;
            currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
        } else {
            // Reset progress if duration is invalid or 0
            progress.style.width = "0%";
            currentTimeEl.textContent = "0:00";
        }
    }

    function seek(event) {
        if (!audioPlayer.duration || isNaN(audioPlayer.duration) || audioPlayer.duration <= 0) {
            console.warn("Cannot seek: Audio duration not available or invalid.");
            return;
        }
        // Use progressContainer for the clickable area
        if (!progressContainer) return;
        const rect = progressContainer.getBoundingClientRect();
        const offsetX = event.clientX - rect.left; // Click position relative to the container start
        const barWidth = progressContainer.clientWidth; // Full width of the container

        if (barWidth <= 0) return; // Avoid division by zero if container has no width

        // Calculate seek position as a ratio (0 to 1)
        const seekRatio = Math.max(0, Math.min(1, offsetX / barWidth));
        // Check if ready to seek
        if (audioPlayer.seekable.length > 0) {
             audioPlayer.currentTime = seekRatio * audioPlayer.duration;
             updateProgress(); // Update display immediately after seeking
        } else {
            console.warn("Cannot seek: Audio is not seekable yet.");
        }
    }

    function changeVolume() {
        if (volumeSlider) {
            audioPlayer.volume = Math.max(0, Math.min(1, volumeSlider.value / 100));
        }
    }

    function restartSong() {
        if (!audioPlayer.src || isNaN(audioPlayer.duration)) {
            console.warn("Cannot restart: Audio source or duration invalid.");
            return;
        }
        // Check if seekable before setting currentTime
        if (audioPlayer.seekable.length > 0) {
            audioPlayer.currentTime = 0;
            if (audioPlayer.paused) {
                updateProgress(); // Update progress display even when paused
            } else {
                // If it was playing, ensure it continues playing after restarting
                audioPlayer.play().catch(e => console.error("Audio play failed on restart:", e));
            }
        } else {
             console.warn("Cannot restart: Audio not seekable yet.");
        }
    }

    // --- Attach Event Listeners to Controls ---
    playPauseBtn.addEventListener("click", togglePlayPause);
    audioPlayer.addEventListener("timeupdate", updateProgress); // Update progress bar and time display
    audioPlayer.addEventListener("play", updatePlayPauseIconState); // Update icon when playing starts
    audioPlayer.addEventListener("pause", updatePlayPauseIconState); // Update icon when paused
    audioPlayer.addEventListener("ended", restartSong); // Loop the fixed song when it ends
    progressContainer.addEventListener("click", seek); // Allow seeking by clicking progress bar
    volumeSlider.addEventListener("input", changeVolume); // Adjust volume on slider change
    prevBtn.addEventListener("click", restartSong); // Previous button restarts the song
    nextBtn.addEventListener("click", restartSong); // Next button also restarts (acts like replay)

    // Set initial state
    changeVolume(); // Set initial volume based on the slider's default value
    updatePlayPauseIconState(); // Set initial play/pause icon state

    console.log("Fixed Music Player Controls Initialized.");
}

// =========================================================================
// == DOMContentLoaded Event Listener (Main Execution Block) ================
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM loaded. Starting initialization...");

    // 1. Initialize the *fixed* music player immediately
    initializeFixedPlayer();

    // 2. Fetch ONLY venue data
    console.log("Fetching initial venue data...");
    try {
        await fetchVenues();
        console.log("Initial venue data fetching complete.");
    } catch (error) {
        console.error("Error during initial venue data fetch:", error);
        // UI errors handled within fetchVenues
    }

    // 3. Setup swiper and map *after* venue data is fetched (if successful)
    if (fetchedVenueData.length > 0) {
        setupSwiperInteractions();
        setupLeafletMap();
    } else {
        console.warn("Skipping swiper and map setup due to lack of venue data.");
    }

    // 4. Setup other UI elements (Checklist, Countdown)
    setupChecklist();
    setupCountdownTimer();

    // 5. Setup VISUAL Theme Switcher Buttons (no data dependency needed now)
    setupThemeSwitcherButtons();

    // 6. Apply a default theme visually on load (e.g., positive)
    applyTheme('positive'); // Or 'sad' if you prefer that default

    console.log("Frontend Player Initialization Complete.");
}); // --- END DOMContentLoaded ---

// =========================================================================
// == VISUAL Theme Switcher Button Setup Function ==========================
// =========================================================================

/**
 * Creates and inserts HARDCODED theme switcher buttons into the DOM.
 * These buttons ONLY call applyTheme to change CSS classes.
 */
function setupThemeSwitcherButtons() {
    console.log("Initializing VISUAL Theme Switcher Buttons...");

    const planSwitcherPlaceholder = document.getElementById('plan-switcher-placeholder');

    if (!planSwitcherPlaceholder) {
        console.error("Could not find #plan-switcher-placeholder div in HTML to insert theme buttons.");
        return;
    }

    planSwitcherPlaceholder.innerHTML = ''; // Clear placeholder content
    planSwitcherPlaceholder.style.display = 'block'; // Ensure it's visible

    console.log("Creating hardcoded theme switcher buttons.");
    const planSwitcherContainer = document.createElement("div");
    planSwitcherContainer.className = "plan-switcher-container"; // Optional class for styling container

    // --- Create Positive Theme Button ---
    const positiveButton = document.createElement("button");
    positiveButton.textContent = `Positive Theme`; // Button text
    // Use existing button styles - adjust if needed
    positiveButton.className = "btn btn-secondary btn-switch-theme";
    positiveButton.style.margin = "5px 8px"; // Add some spacing
    // IMPORTANT: Calls applyTheme with 'positive'
    positiveButton.onclick = () => applyTheme('positive');
    planSwitcherContainer.appendChild(positiveButton);

    // --- Create Sad Theme Button ---
    const sadButton = document.createElement("button");
    sadButton.textContent = `Sad Theme`; // Button text
    sadButton.className = "btn btn-secondary btn-switch-theme";
    sadButton.style.margin = "5px 8px"; // Add some spacing
    // IMPORTANT: Calls applyTheme with 'sad'
    sadButton.onclick = () => applyTheme('sad');
    planSwitcherContainer.appendChild(sadButton);

    // Append the container with buttons to the placeholder
    planSwitcherPlaceholder.appendChild(planSwitcherContainer);
    console.log("Theme switcher buttons added.");
}

// =========================================================================
// == Countdown Timer Logic (Copied from Previous Version) =================
// =========================================================================
function setupCountdownTimer() {
    console.log("Initializing Countdown Timer...");
    const datePicker = document.getElementById("event-date-picker");
    const setDateBtn = document.getElementById("set-date-btn");
    const daysNumEl = document.getElementById("days-num");
    const hoursNumEl = document.getElementById("hours-num");
    const minutesNumEl = document.getElementById("minutes-num");
    const secondsNumEl = document.getElementById("seconds-num");
    const calDay1El = document.getElementById("cal-day-1");
    const calDay2El = document.getElementById("cal-day-2");
    const calDay3El = document.getElementById("cal-day-3");

    if (datePicker && setDateBtn && daysNumEl && hoursNumEl && minutesNumEl && secondsNumEl && calDay1El && calDay2El && calDay3El) {
        console.log("Countdown timer elements found.");
        const localStorageKey = "targetEventDate";
        let targetDate = null;
        let countdownInterval = null;

        function padZero(num) { return num < 10 ? "0" + num : num; }

        function updateCalendarDisplay(dateObj) {
            if (!dateObj || isNaN(dateObj.getTime())) {
                calDay1El.textContent = "--"; calDay2El.textContent = "--"; calDay3El.textContent = "--";
                calDay1El.classList.remove("highlight"); calDay2El.classList.add("highlight"); calDay3El.classList.remove("highlight");
                return;
            }
            const targetDay = dateObj.getUTCDate();
            const prevDate = new Date(dateObj); prevDate.setUTCDate(targetDay - 1);
            const nextDate = new Date(dateObj); nextDate.setUTCDate(targetDay + 1);
            calDay1El.textContent = padZero(prevDate.getUTCDate());
            calDay2El.textContent = padZero(targetDay);
            calDay3El.textContent = padZero(nextDate.getUTCDate());
            calDay1El.classList.remove("highlight"); calDay2El.classList.add("highlight"); calDay3El.classList.remove("highlight");
        }

        function updateCountdown() {
            if (!targetDate || isNaN(targetDate.getTime())) {
                daysNumEl.textContent = "--"; hoursNumEl.textContent = "--"; minutesNumEl.textContent = "--"; secondsNumEl.textContent = "--";
                return;
            }
            const now = new Date().getTime();
            const difference = targetDate.getTime() - now;

            if (difference <= 0) {
                daysNumEl.textContent = "00"; hoursNumEl.textContent = "00"; minutesNumEl.textContent = "00"; secondsNumEl.textContent = "00";
                if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
                return;
            }
            const days = Math.floor(difference / 86400000); // (1000 * 60 * 60 * 24)
            const hours = Math.floor((difference % 86400000) / 3600000); // (1000 * 60 * 60)
            const minutes = Math.floor((difference % 3600000) / 60000); // (1000 * 60)
            const seconds = Math.floor((difference % 60000) / 1000);
            daysNumEl.textContent = padZero(days); hoursNumEl.textContent = padZero(hours); minutesNumEl.textContent = padZero(minutes); secondsNumEl.textContent = padZero(seconds);
        }

        function startCountdown() {
            if (countdownInterval) clearInterval(countdownInterval);
            if (targetDate && !isNaN(targetDate.getTime()) && targetDate.getTime() > new Date().getTime()) {
                updateCountdown(); // Update immediately
                countdownInterval = setInterval(updateCountdown, 1000); // Then update every second
            } else {
                updateCountdown(); // Update display to 0 or --
            }
        }

        function handleSetDate() {
            const selectedDateString = datePicker.value;
            if (!selectedDateString) { alert("Please select a date."); return; }
            // Basic validation (YYYY-MM-DD)
            const parts = selectedDateString.split("-");
            if (parts.length !== 3) { alert("Invalid date format. Please use YYYY-MM-DD."); return; }
            const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
            const day = parseInt(parts[2], 10);
            if (isNaN(year) || isNaN(month) || isNaN(day) || month < 0 || month > 11 || day < 1 || day > 31) {
                 alert("Invalid date components."); return;
            }
            // Create date in UTC at the beginning of the day
            const potentialTargetDate = new Date(Date.UTC(year, month, day, 0, 0, 0));
            if (isNaN(potentialTargetDate.getTime())) { alert("Invalid date selected."); return; }

            // Ensure date is not in the past (compare UTC dates)
            const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0);
            if (potentialTargetDate < todayUTC) { alert("Please select today or a future date."); return; }

            localStorage.setItem(localStorageKey, selectedDateString);
            targetDate = potentialTargetDate;
            updateCalendarDisplay(targetDate);
            startCountdown();
            console.log("New target date set:", targetDate.toUTCString());
        }

        function loadDateFromStorage() {
            const storedDateString = localStorage.getItem(localStorageKey);
            if (storedDateString) {
                const parts = storedDateString.split("-");
                if (parts.length === 3) {
                    const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10) - 1; const day = parseInt(parts[2], 10);
                    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
                        const loadedDate = new Date(Date.UTC(year, month, day, 0, 0, 0));
                        if (!isNaN(loadedDate.getTime())) {
                            // Optional: Check if the loaded date is still in the future
                            const todayUTC = new Date(); todayUTC.setUTCHours(0,0,0,0);
                            if (loadedDate >= todayUTC) {
                                targetDate = loadedDate;
                                datePicker.value = storedDateString; // Set input value
                                console.log("Loaded target date from storage:", targetDate.toUTCString());
                                updateCalendarDisplay(targetDate);
                                startCountdown();
                                return; // Successfully loaded and started
                            } else {
                                console.log("Stored date is in the past, removing.");
                                localStorage.removeItem(localStorageKey);
                            }
                        }
                    }
                }
                 // If parsing failed or date invalid/past, remove from storage
                 console.warn("Invalid date string found in localStorage, removing:", storedDateString);
                 localStorage.removeItem(localStorageKey);
            }
            // If no valid date loaded from storage
            console.log("No valid future date in storage, initializing default display.");
            updateCalendarDisplay(null); // Show default ('--')
            updateCountdown(); // Show default ('--')
        }

        setDateBtn.addEventListener("click", handleSetDate);
        loadDateFromStorage(); // Load and start timer on page load

    } else { console.warn("Countdown timer elements missing. Check element IDs."); }
}

// =========================================================================
// == Leaflet Map Initialization (Copied from Previous Version) ============
// =========================================================================
function setupLeafletMap() {
    console.log("Initializing Leaflet Map...");
    const venueMapContainer = document.getElementById("venue-map");

    // Check for container and Leaflet library
    if (!venueMapContainer || typeof L === "undefined") {
         if (!venueMapContainer) console.warn("Map container #venue-map missing.");
         if (typeof L === "undefined") console.warn("Leaflet library (L) missing.");
         if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Map disabled.</p>";
         return;
     }

    // Only initialize if venue data was successfully fetched
    if (fetchedVenueData.length > 0) {
        try {
            const firstVenue = fetchedVenueData[0];
            // Determine initial coordinates: Use first venue if valid, else fallback
            const initialCoords = (firstVenue?.latitude != null && firstVenue?.longitude != null)
                ? [firstVenue.latitude, firstVenue.longitude]
                : [42.8749, 74.6049]; // <<< ADAPT FALLBACK COORDINATES IF NEEDED

            console.log("Initializing map at coords:", initialCoords);

            // Create map instance
            venueMapInstance = L.map(venueMapContainer, {
                zoomControl: false, // Disable default zoom control
                attributionControl: false // Disable default attribution (add manually if needed)
            }).setView(initialCoords, MAP_ZOOM_LEVEL);

            // Add zoom control to a different position
            L.control.zoom({ position: "bottomright" }).addTo(venueMapInstance);

            // Add tile layer (OpenStreetMap)
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19
            }).addTo(venueMapInstance);

            // Add marker for the initial venue
            venueMarker = L.marker(initialCoords).addTo(venueMapInstance);

            // Bind popup to marker
            if (firstVenue?.name) {
                venueMarker.bindPopup(`<b>${firstVenue.name}</b>`).openPopup();
                // Close popup automatically after a short delay
                setTimeout(() => venueMarker?.closePopup(), 2500);
            }

            // Invalidate map size after a short delay to ensure correct rendering
            setTimeout(() => {
                if (venueMapInstance) {
                    console.log("Invalidating map size.");
                    venueMapInstance.invalidateSize();
                }
            }, 300); // Increased delay slightly

        } catch (error) {
            console.error("Error initializing Leaflet map:", error);
            if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Error loading map.</p>";
            // Clean up map instance if partially created
            if (venueMapInstance) { try { venueMapInstance.remove(); } catch(e){} venueMapInstance = null; }
            venueMarker = null;
        }
    } else {
        // Handle case where no venue data was fetched
        console.warn("Map init skipped: No venue data fetched.");
        if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>No venues available for map.</p>";
    }
}

// =========================================================================
// == Venue Swiper Logic (Setup Function - Includes TypeError Fix) ========
// =========================================================================
function setupSwiperInteractions() {
    console.log("Initializing Venue Swiper...");
    const venueCard = document.getElementById("venue-details-card");
    const chooseVenueCard = document.getElementById("choose-venue-card");

    // Check if essential card elements exist
    if (!venueCard || !chooseVenueCard) {
        console.warn("Swiper base card elements missing. Check IDs: venue-details-card, choose-venue-card");
        return;
    }

    // Handle case where no venue data is available
    if (fetchedVenueData.length === 0) {
        console.warn("Swiper setup skipped: No venue data.");
        if(venueCard) venueCard.innerHTML = '<p class="info-message">No venues available.</p>';
        if(chooseVenueCard) chooseVenueCard.style.display = 'none'; // Hide the second card
        // Hide dot containers if no data
        document.querySelectorAll(".dots").forEach(dots => { if(dots) dots.style.display = 'none'; });
        return;
    }

    // Proceed with setup if data and elements are present
    console.log("Venue data found, setting up swiper interactions.");
    const venueWrapper = venueCard.querySelector(".card-content-wrapper");
    const chooseWrapper = chooseVenueCard.querySelector(".card-content-wrapper");
    const allDotsInnerContainers = document.querySelectorAll(".dots-inner");

    // Check for inner wrappers and dot containers
    if (!venueWrapper || !chooseWrapper || allDotsInnerContainers.length < 2) {
        console.error("Swiper setup failed: Inner elements (.card-content-wrapper) or dot containers (.dots-inner) missing.");
        return;
    }

    console.log("Swiper inner wrappers and dots containers found.");

    // --- Swiper Helper Functions ---

    function setupCardWidth() { cardWidth = venueCard.offsetWidth || 220; }
    function generateDots() { allDotsInnerContainers.forEach((di) => { if (di) { di.innerHTML = ""; fetchedVenueData.forEach(() => di.appendChild(document.createElement("span"))); } else { console.warn("A .dots-inner container is missing."); } }); }
    function updateDots(activeIndex) { if (activeIndex < 0 || activeIndex >= fetchedVenueData.length) return; allDotsInnerContainers.forEach((di) => { if (!di) return; const dots = di.querySelectorAll("span"); const dc = di.parentElement; if (!dc || !dots.length || dots.length !== fetchedVenueData.length) return; dots.forEach((d, i) => d.classList.toggle("active", i === activeIndex)); const dw = (DOT_WIDTH + DOT_MARGIN * 2), cw = dc.offsetWidth, tw = dots.length * dw, aco = activeIndex * dw + dw / 2; let tx = 0; if (tw > cw) { tx = cw / 2 - aco; const maxT = 0, minT = cw - tw; tx = Math.max(minT, Math.min(maxT, tx)); } else { tx = (cw - tw) / 2; } di.style.transform = `translateX(${tx}px)`; }); }
    function updateVenueMap(lat, lng, venueName) { if (!venueMapInstance || !venueMarker) return; if (typeof lat === "number" && typeof lng === "number") { const ll = L.latLng(lat, lng); try { venueMapInstance.setView(ll, MAP_ZOOM_LEVEL, { animate: true, pan: { duration: 0.5 } }); venueMarker.setLatLng(ll); if (venueName) venueMarker.setPopupContent(`<b>${venueName}</b>`); else venueMarker.setPopupContent(''); setTimeout(() => venueMapInstance?.invalidateSize(), 150); } catch (mapError) { console.error("Error updating map view/marker:", mapError); } } else { console.warn(`Map update skipped for "${venueName || 'Unknown'}": Invalid coords (lat: ${lat}, lng: ${lng}).`); } }

    // --- Display Venue Function ---
    function displayVenue(index) {
        if (index < 0 || index >= fetchedVenueData.length) { console.warn(`Invalid venue index requested: ${index}`); return; }
        const venueData = fetchedVenueData[index];
        if (!venueData) { console.warn(`No venue data found for index: ${index}`); return; }
        const currentVenueId = venueData.id;
        console.log(`Displaying venue index: ${index}, ID: ${currentVenueId ?? 'N/A'}, Name: ${venueData?.name ?? 'Unknown'}`);

        venueCard.setAttribute('data-venue-id', currentVenueId ?? '');
        chooseVenueCard.setAttribute('data-venue-id', currentVenueId ?? '');
        if (!currentVenueId) { console.warn(`   -> Venue ID is missing for index ${index}. Navigation on tap might fail.`); }

        const venueNameEl = venueWrapper.querySelector(".venue-name");
        const venueDateEl = venueWrapper.querySelector(".venue-date");
        if (venueNameEl) venueNameEl.textContent = venueData.name || "Venue Name";
        if (venueDateEl) venueDateEl.textContent = venueData.date_text || "--";

        // Use static path for placeholder
        venueCard.style.backgroundImage = `url('${PLACEHOLDER_VENUE_IMAGE}')`;
        venueCard.style.backgroundColor = 'var(--secondary-color)';
        venueCard.style.backgroundSize = 'cover';
        venueCard.style.backgroundPosition = 'center';
        if (venueData.image_url) {
            const imgTest = new Image();
            imgTest.onload = () => { venueCard.style.backgroundImage = `url('${venueData.image_url}')`; };
            imgTest.onerror = () => { console.warn(`Venue card BG failed to load: ${venueData.image_url}. Using placeholder.`); };
            imgTest.src = venueData.image_url;
        }

        const chooseHeaderEl = chooseWrapper.querySelector(".venue-header");
        const ratingEl = chooseWrapper.querySelector(".rating");
        const ratingTextEl = chooseWrapper.querySelector(".rating-text");
        const iconsContainer = chooseWrapper.querySelector(".venue-icons");

        if (chooseHeaderEl) chooseHeaderEl.textContent = venueData.rating_text || "Venue Details";
        if (ratingEl) { const rVal = Math.round(venueData.rating_stars || 0); const maxStars = 5; ratingEl.innerHTML = '<span class="filled">' + '★'.repeat(rVal) + '</span>' + '☆'.repeat(maxStars - rVal); }
        if (ratingTextEl) { ratingTextEl.textContent = venueData.rating_text || ''; }
        if (iconsContainer) { let iconsHTML = ''; if (venueData.venue_icon1) iconsHTML += `<span class="venue-icon-1">${venueData.venue_icon1}</span>`; if (venueData.venue_icon2) iconsHTML += ` <span class="venue-icon-2">${venueData.venue_icon2}</span>`; iconsContainer.innerHTML = iconsHTML || ' '; }

        updateVenueMap(venueData.latitude, venueData.longitude, venueData.name);
        updateDots(index);
    }

    // --- Event Handlers (Defined ONCE) ---
    const handlePointerStart = (e) => {
        if (e.target.closest("button, input, a, .dots, .leaflet-control, .leaflet-marker-icon, .leaflet-popup")) { isDragging = false; startX = null; return; }
        isDragging = false; startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX; startY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY; currentX = startX; diffX = 0; touchStartTime = Date.now(); cardWidth = venueCard.offsetWidth;
        venueWrapper.classList.add("is-swiping"); chooseWrapper.classList.add("is-swiping");
    };
    const handlePointerMove = (e) => {
        if (startX === null) return;
        currentX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
        const currentY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
        diffX = currentX - startX; const diffY = currentY - startY;
        if (!isDragging) { if (Math.abs(diffY) > TAP_THRESHOLD_Y && Math.abs(diffY) > Math.abs(diffX) * 1.5) { startX = null; venueWrapper.classList.remove("is-swiping"); chooseWrapper.classList.remove("is-swiping"); return; } if (Math.abs(diffX) > TAP_THRESHOLD_X) { isDragging = true; } }
        if (isDragging) { const tV = `translateX(${diffX}px)`; venueWrapper.style.transform = tV; chooseWrapper.style.transform = tV; if (e.cancelable && e.type.includes("touch")) e.preventDefault(); }
    };
    const handlePointerEnd = (e) => {
        if (startX === null) return; // Interaction was cancelled or ignored

        const touchDuration = Date.now() - touchStartTime;
        const endX = e.type.includes("touch") ? (e.changedTouches[0]?.clientX ?? currentX) : e.clientX;
        const endY = e.type.includes("touch") ? (e.changedTouches[0]?.clientY ?? currentY) : e.clientY;
        const finalDiffX = endX - startX;
        const finalDiffY = endY - startY;

        const isTap = !isDragging &&
                      touchDuration < MAX_TAP_DURATION &&
                      Math.abs(finalDiffX) < TAP_THRESHOLD_X &&
                      Math.abs(finalDiffY) < TAP_THRESHOLD_Y;

        // --- Handle Tap ---
        if (isTap) {
            const targetCard = e.currentTarget;
            if (targetCard === venueCard || targetCard === chooseVenueCard) {
                console.log("[Tap] Tap detected on card:", targetCard.id);
                const venueId = targetCard.getAttribute('data-venue-id');
                console.log("[Tap] Extracted Venue ID from tapped card:", venueId);
                if (venueId) {
                    navigateToVenueDetail(venueId); // <<< NAVIGATION CALL ON TAP
                } else {
                    console.warn("[Tap] Could not navigate: data-venue-id was missing or empty on the tapped card:", targetCard.id);
                }
            } else {
                 console.log("[Tap] Tap detected, but event target was not a card (likely document mouseup). Ignoring tap navigation.");
            }
            // Snap back visually anyway
            venueWrapper.style.transform = `translateX(0px)`;
            chooseWrapper.style.transform = `translateX(0px)`;
        }
        // --- Handle Swipe ---
        else if (isDragging) {
            console.log("[Swipe] Swipe end processing.");
            const threshold = cardWidth / 3;
            let newIndex = currentVenueIndex;
            if (diffX < -threshold && currentVenueIndex < fetchedVenueData.length - 1) {
                newIndex++; console.log("Swipe Left -> new index:", newIndex);
            } else if (diffX > threshold && currentVenueIndex > 0) {
                newIndex--; console.log("Swipe Right -> new index:", newIndex);
            } else {
                 console.log("Swipe did not cross threshold or at boundary.");
            }

            venueWrapper.style.transition = "transform 0.3s ease-out";
            chooseWrapper.style.transition = "transform 0.3s ease-out";
            venueWrapper.style.transform = `translateX(0px)`;
            chooseWrapper.style.transform = `translateX(0px)`;
            setTimeout(() => { venueWrapper.style.transition = ""; chooseWrapper.style.transition = ""; }, 300);

            if (newIndex !== currentVenueIndex) {
                currentVenueIndex = newIndex;
                displayVenue(currentVenueIndex);
            }
        }
        // --- Handle Aborted Drag / Other ---
        else {
             venueWrapper.style.transition = "transform 0.3s ease-out";
             chooseWrapper.style.transition = "transform 0.3s ease-out";
             venueWrapper.style.transform = `translateX(0px)`;
             chooseWrapper.style.transform = `translateX(0px)`;
             setTimeout(() => { venueWrapper.style.transition = ""; chooseWrapper.style.transition = ""; }, 300);
        }

        // --- Reset state variables ---
        isDragging = false; startX = null; startY = null; diffX = 0; touchStartTime = 0;
        venueWrapper.classList.remove("is-swiping"); chooseWrapper.classList.remove("is-swiping");
    };

    // --- Attach Event Listeners ONCE ---
    console.log("Attaching pointer/mouse/touch listeners ONCE to swiper cards.");
    [venueCard, chooseVenueCard].forEach(card => {
        card.addEventListener("touchstart", handlePointerStart, { passive: true });
        card.addEventListener("touchmove", handlePointerMove, { passive: false });
        card.addEventListener("touchend", handlePointerEnd); // Will have card as currentTarget
        card.addEventListener("touchcancel", handlePointerEnd);
        card.addEventListener("mousedown", handlePointerStart);
        card.addEventListener('click', (e) => { // Click fallback
            if (!isDragging && Math.abs(diffX) < TAP_THRESHOLD_X) { if (!e.target.closest("button, input, a, .dots, .leaflet-control, .leaflet-marker-icon, .leaflet-popup")) { console.log("[Click Fallback] Click detected on card area."); const targetCard = e.currentTarget; const venueId = targetCard.getAttribute('data-venue-id'); console.log("[Click Fallback] Extracted Venue ID:", venueId); if (venueId) navigateToVenueDetail(venueId); else console.warn("[Click Fallback] Could not navigate via click: data-venue-id missing."); } else { console.log("[Click Fallback] Click ignored (on inner interactive element)."); } } else { console.log("[Click Fallback] Click ignored (likely after swipe)."); }
        });
    });

    // Attach Move/End listeners to the document for MOUSE events
    document.addEventListener("mousemove", handlePointerMove);
    document.addEventListener("mouseup", handlePointerEnd);     // Will have document as currentTarget if outside card
    document.addEventListener("mouseleave", (e) => { if (isDragging) { console.log("Mouse left window during drag, treating as pointer end."); handlePointerEnd(e); } }); // Will have document as currentTarget

    // --- Initial Swiper Setup ---
    setupCardWidth();
    generateDots();
    displayVenue(currentVenueIndex);

    // --- Resize Handler ---
    window.addEventListener("resize", () => { console.log("Window resized."); setupCardWidth(); updateDots(currentVenueIndex); if (venueMapInstance) { setTimeout(() => { if (venueMapInstance) venueMapInstance.invalidateSize(); }, 150); } });

} // --- End of setupSwiperInteractions ---


// =========================================================================
// == Checklist Logic (Copied from Previous Version) =======================
// =========================================================================
function setupChecklist() {
    console.log("Initializing Checklist...");
    const checklistKey = "interactiveChecklistState"; // Key for localStorage
    const checklistItems = document.querySelectorAll('.interactive-checklist input[type="checkbox"]');

    if (checklistItems.length > 0) {
        console.log(`Found ${checklistItems.length} checklist items.`);

        function saveChecklistState() { const state = {}; checklistItems.forEach((item) => { if (item.id) { state[item.id] = item.checked; } else { console.warn("Checklist item missing ID, cannot save state:", item); } }); try { localStorage.setItem(checklistKey, JSON.stringify(state)); } catch (e) { console.error("Error saving checklist state to localStorage:", e); } }
        function loadChecklistState() { const savedState = localStorage.getItem(checklistKey); if (savedState) { console.log("Loading checklist state from localStorage."); try { const state = JSON.parse(savedState); checklistItems.forEach((item) => { if (item.id && state[item.id] !== undefined) { item.checked = state[item.id]; } }); } catch (e) { console.error("Error parsing checklist state from localStorage:", e); localStorage.removeItem(checklistKey); } } else { console.log("No saved checklist state found in localStorage."); } }
        checklistItems.forEach((item) => { item.addEventListener("change", saveChecklistState); });
        loadChecklistState();

    } else {
        console.warn("No checklist items found (selector: .interactive-checklist input[type='checkbox']).");
    }
}
