// =========================================================================
// == frontend/player.js -- FIXED SONG + Navigation Focus
// =========================================================================

// =========================================================================
// == Global Variables & Configuration
// =========================================================================

// --- Data Storage ---
let fetchedVenueData = []; // Will be filled by API call
let currentVenueIndex = 0; // Track the currently displayed venue in the swiper

// --- Constants ---
const DOT_WIDTH = 8; // px
const DOT_MARGIN = 4; // px
const MAP_ZOOM_LEVEL = 15;
const API_BASE_URL = "/api";
const VENUE_DETAIL_BASE_PATH = '/venue/'; // Relative path for venue detail pages

// --- Static Paths (Used by JS, ensure these files exist in /frontend/assets/) ---
// NOTE: Paths used *directly* in JS need the /static/ prefix because JS doesn't
//       understand the {% static %} tag. Paths set *initially* in HTML should use {% static %}.
const STATIC_PLACEHOLDER_VENUE_IMAGE = '/static/assets/placeholder-building.jpg';

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
const TAP_THRESHOLD_X = 15; // Max horizontal movement allowed for a tap
const TAP_THRESHOLD_Y = 20; // Max vertical movement allowed for a tap
const MAX_TAP_DURATION = 350; // Max duration in ms for a tap

// =========================================================================
// == Helper Functions (Format Time, Update Icon, Navigation) ==============
// =========================================================================

/**
 * Formats seconds into a MM:SS string.
 * @param {number} seconds - Time in seconds.
 * @returns {string} Formatted time string (e.g., "1:23").
 */
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
}

/**
 * Updates the main play/pause button icon based on the audio player's state.
 */
function updatePlayPauseIconState() {
    const audioPlayer = document.getElementById("audio-player");
    const playPauseIcon = document.getElementById("play-pause-icon");
    const playPauseBtn = document.getElementById("play-pause-btn");
    if (!audioPlayer || !playPauseIcon || !playPauseBtn) {
         console.warn("updatePlayPauseIconState: Missing player elements.");
         return;
    }

    const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M8 5v14l11-7z"/></svg>`;
    const pauseIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

    // Check if the player is currently paused
    if (audioPlayer.paused) {
        playPauseIcon.innerHTML = playIconSvg;
        playPauseBtn.setAttribute("aria-label", "Play");
    } else {
        playPauseIcon.innerHTML = pauseIconSvg;
        playPauseBtn.setAttribute("aria-label", "Pause");
    }
}

/**
 * Navigates the browser to the venue detail page.
 * @param {string|number} venueId - The ID of the venue.
 */
function navigateToVenueDetail(venueId) {
    console.log("[Nav] navigateToVenueDetail called with ID:", venueId);
    if (venueId === null || venueId === undefined || venueId === '') {
        console.warn("[Nav] Cannot navigate: venueId is missing or invalid:", venueId);
        return;
    }
    // Construct the URL relative to the current host
    const targetUrl = `${VENUE_DETAIL_BASE_PATH}${venueId}/`;
    console.log("[Nav] Attempting to navigate to:", targetUrl);
    try {
        window.location.href = targetUrl;
    } catch (e) {
        console.error("[Nav] Error during navigation attempt:", e);
    }
}


// =========================================================================
// == API Fetching Functions
// =========================================================================
/**
 * Fetches venue data from the API and populates fetchedVenueData.
 */
async function fetchVenues() {
    console.log("Attempting to fetch venues...");
    try {
        const response = await fetch(`${API_BASE_URL}/venues/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        }
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
             const textResponse = await response.text();
             throw new Error(`Expected JSON, but received ${contentType}. Response: ${textResponse}`);
        }

        const rawData = await response.json();
        // Handle potential pagination structure from DRF (common case)
        const data = rawData.results || rawData; // Use 'results' array if present

        if (!Array.isArray(data)) {
            console.warn("Fetched venue data is not an array, resetting.", data);
            fetchedVenueData = [];
        } else {
            fetchedVenueData = data;
            console.log("Fetched Venues:", fetchedVenueData.length, "items");
            // Log first few items for debugging structure if needed
            // console.log("First few venues:", fetchedVenueData.slice(0, 2));
        }
    } catch (error) {
        console.error("Could not fetch venues:", error);
        fetchedVenueData = []; // Reset data on error
        // Display error message in the swiper area
        const swiperSection = document.getElementById("venue-details-card")?.parentElement;
        if (swiperSection) {
             swiperSection.innerHTML = `<p class="error-message">Error loading venues: ${error.message}</p>`;
        }
        // Display error message in the map area
        const venueMapContainer = document.getElementById("venue-map");
        if (venueMapContainer) {
             venueMapContainer.innerHTML = "<p class='map-error'>Venue data unavailable.</p>";
        }
        // Re-throw the error so the caller knows fetching failed
        throw error;
    }
}

// =========================================================================
// == FIXED Music Player Initialization & Controls (for index.html) ========
// =========================================================================
/**
 * Initializes the static music player on the main page.
 * Relies on the initial src being set correctly by the HTML template tag {% static %}.
 */
function initializeFixedPlayer() {
    console.log("Initializing Fixed Music Player (relying on HTML src)...");
    const audioPlayer = document.getElementById("audio-player");
    const playPauseBtn = document.getElementById("play-pause-btn");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const progressContainer = document.getElementById("progress-container");
    const volumeSlider = document.getElementById("volume-slider");
    const totalTimeEl = document.getElementById("total-time");
    const albumArt = document.querySelector(".music-player .album-art"); // Should be set by HTML {% static %}

    // Check if all essential elements are present
    if (!audioPlayer || !playPauseBtn || !prevBtn || !nextBtn || !progressContainer || !volumeSlider || !totalTimeEl || !albumArt) {
        console.warn("Fixed player initialization failed: One or more essential elements are missing.");
        return;
    }

    // --- Trust HTML for Initial Source ---
    // Log the source provided by the HTML {% static %} tag.
    if (audioPlayer.src) {
        console.log("Audio source set by HTML:", audioPlayer.src);
        // Check if the src looks valid (basic check)
        if (!audioPlayer.src.startsWith('http') && !audioPlayer.src.startsWith('/')) {
            console.warn("Potential issue: Audio source from HTML doesn't look like a valid URL or absolute path:", audioPlayer.src);
        }
    } else {
        console.error("CRITICAL: Audio source was NOT set by the HTML {% static %} tag. The player will not work.");
        // Display an error message to the user might be good here.
        if(totalTimeEl) totalTimeEl.textContent = "Error";
        return; // Stop initialization if no source
    }

    // --- Event Listeners for Fixed Player ---

    // Metadata Loaded Handler
    audioPlayer.addEventListener("loadedmetadata", () => {
        console.log("Fixed song metadata loaded. Duration:", audioPlayer.duration);
        if (totalTimeEl && audioPlayer.duration && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
            totalTimeEl.textContent = formatTime(audioPlayer.duration);
        } else {
            console.warn("Could not set total time. Duration invalid:", audioPlayer.duration);
            if (totalTimeEl) totalTimeEl.textContent = "0:00"; // Reset if invalid
        }
        updatePlayPauseIconState(); // Update icon based on initial state (usually paused)
        updateProgress(); // Ensure progress bar is updated to 0%
    });

    // Error Handler
    audioPlayer.addEventListener("error", (e) => {
        let errorMsg = 'Unknown error';
        let errorCode = 'N/A';
        if (e.target && e.target.error) {
            errorCode = e.target.error.code;
            switch (errorCode) {
                case MediaError.MEDIA_ERR_ABORTED: errorMsg = 'Playback aborted.'; break;
                case MediaError.MEDIA_ERR_NETWORK: errorMsg = 'Network error loading audio.'; break;
                case MediaError.MEDIA_ERR_DECODE: errorMsg = 'Audio decoding error.'; break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMsg = 'Audio source format not supported or unreachable.'; break;
                default: errorMsg = `Unexpected error code ${errorCode}.`;
            }
            errorMsg += ` (${e.target.error.message || 'No specific message'})`;
        }
        // Log detailed error information
        console.error(`Fixed Audio Player Error (Code: ${errorCode}): ${errorMsg}`, "Attempted source:", audioPlayer.currentSrc || audioPlayer.src || "N/A", e);

        // Update UI to show error state
        if (totalTimeEl) totalTimeEl.textContent = "Error";
        const progress = document.getElementById("progress");
        if (progress) progress.style.width = "0%";
        const currentTimeEl = document.getElementById("current-time");
        if (currentTimeEl) currentTimeEl.textContent = "0:00";
        updatePlayPauseIconState(); // Ensure icon shows 'play'
    });

    // --- Control Functions ---

    function togglePlayPause() {
        // Use audioPlayer.currentSrc for the most reliable check of what the browser *tried* to load
        if (!audioPlayer.currentSrc && !audioPlayer.src) {
            console.warn("Cannot play/pause: Audio source is empty. Check HTML {% static %} tag is correct and file exists.");
            return;
        }
        // Check if player is in an error state
        if (audioPlayer.error) {
             console.warn("Cannot play/pause: Player is in an error state.", audioPlayer.error);
             // Maybe attempt to reload?
             // audioPlayer.load();
             return;
        }

        console.log(`Toggle Play/Pause. Current state: ${audioPlayer.paused ? 'Paused' : 'Playing'}. Src: ${audioPlayer.currentSrc || audioPlayer.src}`);

        if (audioPlayer.paused) {
            // Attempt to play
            const playPromise = audioPlayer.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Audio play() failed:", error);
                    // Update icon to reflect failure (should show play again)
                    updatePlayPauseIconState();
                });
            }
            // 'play' event listener will update icon on success
        } else {
            // Pause playback
            audioPlayer.pause();
            // 'pause' event listener will update icon
        }
    }

    function updateProgress() {
        // Update current time and progress bar width
        if (audioPlayer.duration && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
            const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            const progress = document.getElementById("progress");
            if (progress) progress.style.width = `${progressPercent}%`;
            const currentTimeEl = document.getElementById("current-time");
            if (currentTimeEl) currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
        } else {
            // Reset progress display if duration is invalid (e.g., after an error or before loading)
            const progress = document.getElementById("progress");
            if (progress) progress.style.width = "0%";
            const currentTimeEl = document.getElementById("current-time");
            if (currentTimeEl) currentTimeEl.textContent = "0:00";
        }
    }

    function seek(event) {
        // Allow seeking only if audio is loaded and has valid duration
        if (!audioPlayer.duration || isNaN(audioPlayer.duration) || audioPlayer.duration <= 0 || audioPlayer.readyState < 1) { // readyState >= 1 (HAVE_METADATA)
            console.warn("Cannot seek: Audio not ready or duration invalid.");
            return;
        }
        const progressBar = progressContainer.querySelector('.progress-bar');
        if (!progressBar) {
             console.warn("Cannot seek: Progress bar element not found.");
             return;
        }

        const rect = progressBar.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const barWidth = progressBar.clientWidth;

        // Prevent division by zero if progress bar has no width
        if (barWidth <= 0) return;

        const seekRatio = Math.max(0, Math.min(1, offsetX / barWidth)); // Clamp between 0 and 1
        const seekTime = seekRatio * audioPlayer.duration;

        console.log(`Seeking to ${formatTime(seekTime)} (${(seekRatio * 100).toFixed(1)}%)`);
        audioPlayer.currentTime = seekTime;
        updateProgress(); // Update UI immediately after seek
    }

    function changeVolume() {
        // Update audio volume based on slider value
        if (volumeSlider) {
            const volumeValue = parseFloat(volumeSlider.value) / 100;
            audioPlayer.volume = Math.max(0, Math.min(1, volumeValue)); // Clamp between 0 and 1
        }
    }

    function restartSong() {
        // Restart playback from the beginning
        // Check if audio has a valid duration before attempting to seek/play
        if (!audioPlayer.src || isNaN(audioPlayer.duration) || audioPlayer.duration <= 0) {
            console.warn("Cannot restart song: Source or duration invalid.");
            return;
        }
        console.log("Restarting song.");
        audioPlayer.currentTime = 0; // Go to beginning
        if (audioPlayer.paused) {
            updateProgress(); // Update UI if it was paused
        } else {
            // If it was playing, ensure it starts playing again from the beginning
            const playPromise = audioPlayer.play();
             if (playPromise !== undefined) {
                playPromise.catch(e => console.error("Audio play() failed on restart:", e));
            }
        }
    }

    // --- Attach Event Listeners ---
    playPauseBtn.addEventListener("click", togglePlayPause);
    audioPlayer.addEventListener("timeupdate", updateProgress);
    audioPlayer.addEventListener("play", updatePlayPauseIconState); // Update icon when playback actually starts
    audioPlayer.addEventListener("pause", updatePlayPauseIconState); // Update icon when playback actually pauses
    audioPlayer.addEventListener("ended", restartSong); // Loop the fixed song when it ends
    progressContainer.addEventListener("click", seek); // Allow seeking by clicking progress bar
    volumeSlider.addEventListener("input", changeVolume); // Update volume immediately as slider moves
    prevBtn.addEventListener("click", restartSong); // Previous button restarts the current song
    nextBtn.addEventListener("click", restartSong); // Next button also restarts (placeholder action)

    // --- Set Initial State ---
    changeVolume(); // Set initial volume based on the slider's default value
    updatePlayPauseIconState(); // Set the initial icon state (should show 'play')
    updateProgress(); // Display initial time as 0:00 / 0:00
    console.log("Fixed Music Player controls initialized.");
}


// =========================================================================
// == DOMContentLoaded Event Listener (Main Execution Block for index.html)
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM loaded. Starting initialization for index.html...");

    // 1. Initialize the fixed music player immediately.
    //    It relies on the src set by {% static %} in index.html.
    initializeFixedPlayer();

    // 2. Fetch venue data required for the swiper and map.
    console.log("Fetching initial venue data for swiper/map...");
    try {
        await fetchVenues();
        console.log("Venue data fetching complete.");
        // 3. Setup swiper and map only AFTER venue data is successfully fetched.
        setupSwiperInteractions();
        setupLeafletMap();
    } catch (error) {
        console.error("Initialization failed: Could not fetch venue data. Swiper/Map setup skipped.", error);
        // Error messages are displayed within fetchVenues function.
    }

    // 4. Setup other UI elements that don't depend on venue data.
    setupChecklist();
    setupCountdownTimer();

    // 5. No plan switcher logic needed on index.html.

    console.log("Frontend Player (index.html) initialization complete.");
}); // --- END DOMContentLoaded ---


// =========================================================================
// == Countdown Timer Logic ===============================================
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

    // Check if all elements exist
    if (!datePicker || !setDateBtn || !daysNumEl || !hoursNumEl || !minutesNumEl || !secondsNumEl || !calDay1El || !calDay2El || !calDay3El) {
         console.warn("Countdown timer initialization failed: One or more elements missing.");
         return;
    }

    console.log("Countdown timer elements found.");
    const localStorageKey = "targetEventDate"; // Key for storing the target date
    let targetDate = null; // Holds the target Date object
    let countdownInterval = null; // Holds the interval timer

    // Helper to add leading zeros
    function padZero(num) {
        return num < 10 ? "0" + num : num;
    }

    // Updates the 3-day calendar display
    function updateCalendarDisplay(dateObj) {
        if (!dateObj || isNaN(dateObj.getTime())) {
            // Reset to default if no valid date
            calDay1El.textContent = "--";
            calDay2El.textContent = "--";
            calDay3El.textContent = "--";
            calDay1El.classList.remove("highlight");
            calDay2El.classList.add("highlight"); // Highlight middle by default
            calDay3El.classList.remove("highlight");
            return;
        }
        // Calculate previous and next days in UTC
        const targetDay = dateObj.getUTCDate();
        const prevDate = new Date(dateObj);
        prevDate.setUTCDate(targetDay - 1);
        const nextDate = new Date(dateObj);
        nextDate.setUTCDate(targetDay + 1);

        // Update text content with padding
        calDay1El.textContent = padZero(prevDate.getUTCDate());
        calDay2El.textContent = padZero(targetDay);
        calDay3El.textContent = padZero(nextDate.getUTCDate());

        // Ensure only the target day is highlighted
        calDay1El.classList.remove("highlight");
        calDay2El.classList.add("highlight");
        calDay3El.classList.remove("highlight");
    }

    // Updates the D/H/M/S countdown display
    function updateCountdown() {
        if (!targetDate || isNaN(targetDate.getTime())) {
             // Reset if no valid target date
             daysNumEl.textContent = "--";
             hoursNumEl.textContent = "--";
             minutesNumEl.textContent = "--";
             secondsNumEl.textContent = "--";
             return;
        }

        const now = new Date().getTime();
        const difference = targetDate.getTime() - now;

        // Handle countdown finished or date in the past
        if (difference <= 0) {
            daysNumEl.textContent = "00";
            hoursNumEl.textContent = "00";
            minutesNumEl.textContent = "00";
            secondsNumEl.textContent = "00";
            if (countdownInterval) {
                clearInterval(countdownInterval); // Stop the interval
                countdownInterval = null;
            }
            console.log("Countdown finished.");
            return;
        }

        // Calculate remaining time components
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        // Update display with padding
        daysNumEl.textContent = padZero(days);
        hoursNumEl.textContent = padZero(hours);
        minutesNumEl.textContent = padZero(minutes);
        secondsNumEl.textContent = padZero(seconds);
    }

    // Starts or restarts the countdown interval
    function startCountdown() {
        if (countdownInterval) {
             clearInterval(countdownInterval); // Clear existing interval first
             countdownInterval = null;
        }
        // Start interval only if target date is valid and in the future
        if (targetDate && !isNaN(targetDate.getTime()) && targetDate.getTime() > new Date().getTime()) {
            updateCountdown(); // Update immediately
            countdownInterval = setInterval(updateCountdown, 1000); // Then update every second
            console.log("Countdown started/restarted.");
        } else {
             updateCountdown(); // Update display even if date is past/invalid (shows 00 or --)
             console.log("Countdown not started (date past or invalid).");
        }
    }

    // Handles the click on the "Set" button
    function handleSetDate() {
        const selectedDateString = datePicker.value; // Get value from YYYY-MM-DD input
        if (!selectedDateString) {
            alert("Please select a date.");
            return;
        }

        // Basic validation of the date string format
        const parts = selectedDateString.split("-");
        if (parts.length !== 3) {
            alert("Invalid date format selected.");
            return;
        }

        // Parse date components as integers
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed in JS Date
        const day = parseInt(parts[2], 10);

        if (isNaN(year) || isNaN(month) || isNaN(day)) {
            alert("Invalid date components.");
            return;
        }

        // Create Date object in UTC, assuming start of the day
        const potentialTargetDate = new Date(Date.UTC(year, month, day, 0, 0, 0));

        if (isNaN(potentialTargetDate.getTime())) {
            alert("Invalid date selected.");
            return;
        }

        // Prevent selecting past dates (compare against start of today UTC)
        const todayUTC = new Date();
        todayUTC.setUTCHours(0, 0, 0, 0);
        if (potentialTargetDate < todayUTC) {
            alert("Please select today or a future date.");
            return;
        }

        // If valid, save to localStorage and update state
        localStorage.setItem(localStorageKey, selectedDateString);
        targetDate = potentialTargetDate;
        updateCalendarDisplay(targetDate); // Update calendar visual
        startCountdown(); // Start/restart countdown timer
        console.log("New target date set and saved:", targetDate.toISOString());
    }

    // Loads the target date from localStorage on page load
    function loadDateFromStorage() {
        const storedDateString = localStorage.getItem(localStorageKey);
        if (storedDateString) {
            console.log("Found stored date string:", storedDateString);
             // Validate stored string before parsing
             const parts = storedDateString.split("-");
            if (parts.length === 3) {
                 const year = parseInt(parts[0], 10);
                 const month = parseInt(parts[1], 10) - 1;
                 const day = parseInt(parts[2], 10);

                if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                    const loadedDate = new Date(Date.UTC(year, month, day, 0, 0, 0));
                    if (!isNaN(loadedDate.getTime())) {
                         // Successfully loaded and parsed
                         targetDate = loadedDate;
                         datePicker.value = storedDateString; // Set input field value
                         console.log("Loaded target date from storage:", targetDate.toISOString());
                         updateCalendarDisplay(targetDate);
                         startCountdown();
                         return; // Exit function after successful load
                    }
                 }
             }
             // If parsing failed or format was wrong
             console.warn("Invalid date string found in localStorage, removing it.");
             localStorage.removeItem(localStorageKey);
         }
         // If no valid date found in storage
         console.log("No valid target date in storage, initializing default display.");
         updateCalendarDisplay(null); // Show default calendar
         updateCountdown(); // Show default countdown (--)
     }

    // Attach event listener to the button
    setDateBtn.addEventListener("click", handleSetDate);

    // Load initial state from storage
    loadDateFromStorage();
}


// =========================================================================
// == Leaflet Map Initialization (for index.html) ==========================
// =========================================================================
/**
 * Initializes the Leaflet map on the main page, showing the first venue.
 */
function setupLeafletMap() {
    console.log("Initializing Leaflet Map...");
    const venueMapContainer = document.getElementById("venue-map");

    // Check for container and Leaflet library
    if (!venueMapContainer) {
        console.warn("Map initialization failed: Container #venue-map not found.");
        return;
    }
    if (typeof L === "undefined") {
        console.warn("Map initialization failed: Leaflet library (L) is not defined.");
        venueMapContainer.innerHTML = "<p class='map-error'>Map library missing.</p>";
        return;
    }

    // Check if venue data is available and valid
    if (!Array.isArray(fetchedVenueData) || fetchedVenueData.length === 0) {
        console.warn("Map initialization skipped: No valid venue data fetched.");
        venueMapContainer.innerHTML = "<p class='map-error'>No venues to display on map.</p>";
        return;
    }

    // If a map instance already exists, remove it first
    if (venueMapInstance) {
        console.log("Removing previous map instance before re-initializing.");
        try {
             venueMapInstance.remove();
        } catch(e) { console.warn("Error removing previous map:", e); }
        venueMapInstance = null;
        venueMarker = null;
    }

    // Proceed with map setup
    try {
        const firstVenue = fetchedVenueData[0]; // Use the first venue for initial display

        // Validate coordinates
        const lat = firstVenue?.latitude;
        const lng = firstVenue?.longitude;
        const isValidCoords = typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng);

        // Use venue coords or fallback to default (e.g., Bishkek)
        const initialCoords = isValidCoords ? [lat, lng] : [42.8749, 74.6049];
        const initialZoom = isValidCoords ? MAP_ZOOM_LEVEL : 12; // Zoom out if using fallback

        if (!isValidCoords) {
            console.warn(`Using fallback coordinates for map init because venue 0 data is invalid: lat=${lat}, lng=${lng}`);
            // Optionally clear the container or show a specific warning
            // venueMapContainer.innerHTML = "<p class='map-warning'>Default map location shown (venue coordinates missing/invalid).</p>";
        }

        console.log("Initializing map at coords:", initialCoords, "Zoom:", initialZoom);

        // Create map instance
        venueMapInstance = L.map(venueMapContainer, {
             zoomControl: false, // Disable default zoom control
             attributionControl: false // Disable default attribution
        }).setView(initialCoords, initialZoom);

        // Add controls explicitly
        L.control.zoom({ position: "bottomright" }).addTo(venueMapInstance);
        // L.control.attribution({ position: 'bottomleft' }).addTo(venueMapInstance); // Add attribution if needed

        // Add tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
             attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
             maxZoom: 19
        }).addTo(venueMapInstance);

        // Add marker ONLY if coordinates were valid
        if (isValidCoords) {
            venueMarker = L.marker(initialCoords).addTo(venueMapInstance);
            if (firstVenue?.name) {
                venueMarker.bindPopup(`<b>${firstVenue.name}</b>`).openPopup();
                // Close popup after a short delay
                setTimeout(() => venueMarker?.closePopup(), 2500);
            }
        } else {
             // Optionally add text overlay if using fallback coords
             if(venueMapContainer.querySelector('.map-warning') == null){ // Prevent duplicate messages
                venueMapContainer.insertAdjacentHTML('beforeend', "<p class='map-warning map-overlay-warning'>Default map location (coordinates missing)</p>");
             }
        }

        // Invalidate map size after a short delay to ensure proper rendering
        setTimeout(() => {
            if (venueMapInstance) {
                try {
                    console.log("Invalidating map size after setup.");
                    venueMapInstance.invalidateSize({ animate: true, pan: false }); // Smooth resize
                } catch(e) {
                    console.error("Error invalidating map size:", e);
                }
            }
        }, 300);

    } catch (error) {
        console.error("Error during Leaflet map initialization:", error);
        if (venueMapContainer) {
            venueMapContainer.innerHTML = `<p class='map-error'>Error loading map: ${error.message}</p>`;
        }
        // Reset instances on error
        venueMapInstance = null;
        venueMarker = null;
    }
}

// =========================================================================
// == Venue Swiper Logic (Setup Function for index.html) ===================
// =========================================================================
/**
 * Sets up the interactive swiping behavior for the venue cards.
 */
function setupSwiperInteractions() {
    console.log("Initializing Venue Swiper...");
    const venueCard = document.getElementById("venue-details-card"); // Left card
    const chooseVenueCard = document.getElementById("choose-venue-card"); // Right card

    // Check if base card elements exist
    if (!venueCard || !chooseVenueCard) {
        console.warn("Swiper setup failed: Base card elements missing (#venue-details-card or #choose-venue-card).");
         // Consider hiding the parent container or showing an error
         const featuresSection = document.getElementById("venue-section");
         if (featuresSection) featuresSection.innerHTML = '<p class="error-message">Venue display components are missing.</p>';
        return;
    }

    // Check if valid venue data is present
    if (!Array.isArray(fetchedVenueData) || fetchedVenueData.length === 0) {
        console.warn("Swiper setup skipped: No valid venue data available.");
        // Display message on the first card, hide others
        venueCard.innerHTML = '<div class="card-content-wrapper"><p class="info-message">No venues available.</p></div>';
        chooseVenueCard.style.display = 'none';
        document.querySelectorAll(".dots").forEach(dots => dots.style.display = 'none'); // Hide all dot indicators
        const mapCard = document.querySelector(".venue-suggestion"); if(mapCard) mapCard.style.display = 'none';
        const remindersCard = document.querySelector(".reminders-ideas"); if(remindersCard) remindersCard.style.display = 'none';
        const cutleryCard = document.querySelector(".cutlery"); if(cutleryCard) cutleryCard.style.display = 'none';
        return; // Stop setup
    }

    console.log("Venue data found, setting up swiper interactions.");
    // Get references to the inner content wrappers that will be transformed
    const venueWrapper = venueCard.querySelector(".card-content-wrapper");
    const chooseWrapper = chooseVenueCard.querySelector(".card-content-wrapper");
    // Get references to the containers holding the dots
    const allDotsInnerContainers = document.querySelectorAll(".dots-inner");

    // Check if necessary inner elements are present
    if (!venueWrapper || !chooseWrapper || allDotsInnerContainers.length < 2) {
        console.error("Swiper setup failed: Inner elements (.card-content-wrapper or .dots-inner) missing.");
        return;
    }

    console.log("Swiper inner wrappers and dots containers found.");

    // --- Swiper Helper Functions ---

    function setupCardWidth() {
         // Calculate card width for swipe threshold calculations
         cardWidth = venueCard.offsetWidth || 220; // Use actual width or fallback
    }

    function generateDots() {
        // Create dot elements based on the number of venues
        allDotsInnerContainers.forEach((dotsInner) => {
            if (dotsInner) {
                dotsInner.innerHTML = ""; // Clear existing dots
                fetchedVenueData.forEach(() => {
                    dotsInner.appendChild(document.createElement("span"));
                });
                 console.log(`Generated ${fetchedVenueData.length} dots in`, dotsInner);
            }
        });
    }

    function updateDots(activeIndex) {
        // Update dot appearance and scroll position
        if (activeIndex < 0 || activeIndex >= fetchedVenueData.length) {
             console.warn("updateDots: Invalid activeIndex", activeIndex);
             return;
        }

        allDotsInnerContainers.forEach((dotsInner) => {
            if (!dotsInner) return;
            const dots = dotsInner.querySelectorAll("span");
            const dotsContainer = dotsInner.parentElement; // The '.dots' element

            if (!dotsContainer || dots.length !== fetchedVenueData.length) {
                 console.warn("Dots count mismatch or container missing. Regenerating dots might be needed.");
                 // Optionally regenerate dots here: generateDots(); updateDots(activeIndex); return;
                 return;
            }

            // Highlight the active dot
            dots.forEach((dot, i) => {
                dot.classList.toggle("active", i === activeIndex);
            });

            // --- Dots Scrolling Logic ---
            const dotTotalWidth = (DOT_WIDTH + DOT_MARGIN * 2); // Width of one dot + its margins
            const containerWidth = dotsContainer.offsetWidth; // Width of the visible dots area
            const totalDotsWidth = dots.length * dotTotalWidth; // Total width of all dots combined
            const activeDotCenter = activeIndex * dotTotalWidth + dotTotalWidth / 2; // Center position of the active dot
            let translateOffset = containerWidth / 2 - activeDotCenter; // Desired offset to center active dot

            // Limit scrolling if all dots don't fit
            if (totalDotsWidth > containerWidth) {
                // Prevent scrolling beyond the last dot or before the first dot
                translateOffset = Math.max(containerWidth - totalDotsWidth, Math.min(0, translateOffset));
            } else {
                // Center the dots if they all fit within the container
                translateOffset = (containerWidth - totalDotsWidth) / 2;
            }
            // Apply the calculated translation
            dotsInner.style.transform = `translateX(${translateOffset}px)`;
        });
    }

    function updateVenueMap(lat, lng, venueName) {
        // Update the Leaflet map position and marker
        if (!venueMapInstance || !venueMarker) {
            // Attempt to re-initialize map if it's missing but should be there
            if (!venueMapInstance && typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)) {
                 console.log("Map not initialized, attempting setup in updateVenueMap.");
                 setupLeafletMap(); // This uses fetchedVenueData[currentVenueIndex] implicitly
                 // Check again if setup succeeded
                  if (!venueMapInstance || !venueMarker) {
                     console.warn("Map setup failed during updateVenueMap attempt.");
                     return;
                  }
            } else {
                console.warn(`Map update skipped: Map or marker not initialized.`);
                return;
            }
        }

        // Proceed only if coordinates are valid numbers
        if (typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng)) {
            const newLatLng = L.latLng(lat, lng);

            // Animate map movement smoothly
            // Check if the new point is far from the current view
            if (!venueMapInstance.getBounds().contains(newLatLng)) {
                 venueMapInstance.flyTo(newLatLng, MAP_ZOOM_LEVEL, { animate: true, duration: 0.7 });
            } else {
                 venueMapInstance.panTo(newLatLng, { animate: true, duration: 0.5 }); // Pan if nearby
            }

            // Update marker position and popup content
            venueMarker.setLatLng(newLatLng);
            if (venueName) {
                venueMarker.bindPopup(`<b>${venueName}</b>`); // Update popup content
                // Optional: Briefly open the popup
                // venueMarker.openPopup();
                // setTimeout(() => venueMarker?.closePopup(), 1500);
            }
            // Invalidate size after potential layout changes
            setTimeout(() => venueMapInstance?.invalidateSize(), 150);
        } else {
            console.warn(`Map update skipped: Invalid coords (lat=${lat}, lng=${lng}) for venue: ${venueName}`);
             // Optional: Hide marker or move to default?
             // venueMarker.setLatLng([DEFAULT_LAT, DEFAULT_LNG]).setPopupContent("Coordinates unavailable");
        }
    }

    // --- Display Venue Function (Updates card UI, map, dots) ---
    function displayVenue(index) {
        if (index < 0 || index >= fetchedVenueData.length) {
            console.warn(`Invalid venue index requested: ${index}. Cannot display.`);
            return;
        }
        const venueData = fetchedVenueData[index];
        if (!venueData || typeof venueData !== 'object') {
             console.error(`Invalid venue data structure at index ${index}:`, venueData);
             // Show error state on cards
             venueWrapper.innerHTML = `<p class="error-message">Error loading data</p>`;
             chooseWrapper.innerHTML = `<p class="error-message">Error loading data</p>`;
             return;
        }

        const currentVenueId = venueData.id ?? `no-id-${index}`; // Fallback ID if missing
        console.log(`Displaying venue index: ${index}, ID: ${currentVenueId}, Name: ${venueData.name || 'N/A'}`);

        // --- Update Both Cards ---
        venueCard.setAttribute('data-venue-id', currentVenueId);
        chooseVenueCard.setAttribute('data-venue-id', currentVenueId);

        // == Card 1: Venue Details (Left) ==
        venueWrapper.querySelector(".venue-name").textContent = venueData.name || "Venue Name Unavailable";
        venueWrapper.querySelector(".venue-date").textContent = venueData.date_text || "--";

        // Background Image Logic
        const imageUrl = venueData.image_url;
        venueCard.style.backgroundColor = 'var(--secondary-color)'; // Set default color
        venueCard.style.backgroundImage = 'none'; // Clear previous image

        if (imageUrl) {
            const imgTest = new Image();
            imgTest.onload = () => {
                venueCard.style.backgroundImage = `url('${imageUrl}')`; // Apply if loads
                venueCard.style.backgroundColor = ''; // Remove default color
            };
            imgTest.onerror = () => { // Keep default color on error
                console.warn(`Venue card BG image failed: ${imageUrl}.`);
                venueCard.style.backgroundImage = 'none';
                venueCard.style.backgroundColor = 'var(--secondary-color)';
            };
            imgTest.src = imageUrl;
        } else {
             // Use placeholder constant if no image URL from API
             venueCard.style.backgroundImage = `url('${STATIC_PLACEHOLDER_VENUE_IMAGE}')`;
             console.log(`No image_url for venue ${venueData.name}, using placeholder.`);
              // Add error handling for the placeholder itself
             const placeholderTest = new Image();
             placeholderTest.onerror = () => {
                  console.warn(`Placeholder image failed to load: ${STATIC_PLACEHOLDER_VENUE_IMAGE}`);
                  venueCard.style.backgroundImage = 'none'; // Remove broken placeholder
                  venueCard.style.backgroundColor = 'var(--secondary-color)';
                  placeholderTest.onerror = null;
             }
             placeholderTest.src = STATIC_PLACEHOLDER_VENUE_IMAGE;
        }


        // == Card 2: Choose Venue / Details (Right) ==
        chooseWrapper.querySelector(".venue-header").textContent = venueData.rating_text || "Details";
        const ratingEl = chooseWrapper.querySelector(".rating");
        if (ratingEl) {
            const ratingValue = Math.round(venueData.rating_stars || 0);
            const clampedRating = Math.max(0, Math.min(5, ratingValue));
            ratingEl.innerHTML = '<span class="filled">' + '★'.repeat(clampedRating) + '</span>' + '☆'.repeat(5 - clampedRating);
        }
        const iconsContainer = chooseWrapper.querySelector(".venue-icons");
        if (iconsContainer) {
            let iconsHTML = '';
            if (venueData.venue_icon1) iconsHTML += `<span class="venue-icon-1">${venueData.venue_icon1}</span>`;
            if (venueData.venue_icon2) iconsHTML += ` <span class="venue-icon-2">${venueData.venue_icon2}</span>`;
            iconsContainer.innerHTML = iconsHTML || '<span>-</span>'; // Placeholder if no icons
        }

        // == Update Map and Dots ==
        updateVenueMap(venueData.latitude, venueData.longitude, venueData.name);
        updateDots(index); // Update dot indicators for the current index

        // Player is static, no updates needed here.
    }


    // --- Event Handlers (Pointer/Touch/Mouse) ---

    const handlePointerStart = (e) => {
        // Ignore interaction if it starts on an interactive element or map control
        if (e.target.closest("button, input, a, .dots, .leaflet-container, .leaflet-control-container")) {
             console.log("Interaction started on ignored element, skipping swipe/tap.");
             return;
        }

        isDragging = false; // Reset flag
        startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
        startY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
        currentX = startX;
        diffX = 0;
        touchStartTime = Date.now();
        cardWidth = venueCard.offsetWidth; // Get current width

        // Add visual feedback class
        venueWrapper.classList.add("is-swiping");
        chooseWrapper.classList.add("is-swiping");
        if (e.type.includes("mouse")) { // Change cursor for mouse
            venueCard.style.cursor = 'grabbing';
            chooseVenueCard.style.cursor = 'grabbing';
        }
         console.log("Pointer Start"); // Debug log
    };

    const handlePointerMove = (e) => {
        // Only track movement if interaction started on the card
        if (startX === null) return;

        const currentY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
        const diffY = currentY - startY;
        currentX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
        diffX = currentX - startX;

        // If not already dragging, determine if it's a swipe or vertical scroll
        if (!isDragging) {
            // Prioritize vertical scroll: if Y movement is significant & more vertical than horizontal
            if (Math.abs(diffY) > TAP_THRESHOLD_Y && Math.abs(diffY) > Math.abs(diffX) * 1.5) {
                // It's likely a scroll attempt, cancel swipe tracking
                console.log("Vertical scroll detected, canceling swipe tracking.");
                startX = null; // Stop tracking this interaction
                venueWrapper.classList.remove("is-swiping");
                chooseWrapper.classList.remove("is-swiping");
                if (e.type.includes("mouse")) { // Reset cursor
                     venueCard.style.cursor = 'grab';
                     chooseVenueCard.style.cursor = 'grab';
                }
                return; // Allow default scroll behavior
            }
            // If horizontal movement exceeds threshold, start dragging
            if (Math.abs(diffX) > TAP_THRESHOLD_X) {
                console.log("Horizontal drag started.");
                isDragging = true;
            }
        }

        // If dragging horizontally, translate the cards and prevent default touch scroll
        if (isDragging) {
            venueWrapper.style.transform = `translateX(${diffX}px)`;
            chooseWrapper.style.transform = `translateX(${diffX}px)`;
            // Prevent vertical page scroll ONLY when actively dragging horizontally
            if (e.cancelable && e.type.includes("touch")) {
                e.preventDefault();
            }
        }
    };

    const handlePointerEnd = (e) => {
        // Only process if an interaction was actually started on the card
        if (startX === null) return;

        const touchDuration = Date.now() - touchStartTime;
        // Use changedTouches for touchend, clientX/Y for mouseup
        const endX = e.type === 'touchend' ? e.changedTouches[0]?.clientX ?? currentX : e.clientX; // Use last known X if changedTouches missing
        const endY = e.type === 'touchend' ? e.changedTouches[0]?.clientY ?? startY + diffY : e.clientY; // Use last known Y
        const finalDiffX = endX - startX;
        const finalDiffY = endY - startY;

        // Determine if the interaction qualifies as a tap
        const isTap = !isDragging && touchDuration < MAX_TAP_DURATION && Math.abs(finalDiffX) < TAP_THRESHOLD_X && Math.abs(finalDiffY) < TAP_THRESHOLD_Y;

        // Reset cursor and visual state immediately
        if (e.type.includes("mouse") || e.type === 'pointerup' || e.type === 'pointercancel') {
            venueCard.style.cursor = 'grab';
            chooseVenueCard.style.cursor = 'grab';
        }
        venueWrapper.classList.remove("is-swiping");
        chooseWrapper.classList.remove("is-swiping");

        console.log(`Pointer End. Drag: ${isDragging}, Dur: ${touchDuration}ms, dx: ${finalDiffX.toFixed(0)}, dy: ${finalDiffY.toFixed(0)}, Tap: ${isTap}`);

        if (isTap) {
            console.log("[Action] Tap detected.");
            const targetCard = e.currentTarget; // Card the listener is on
            const venueId = targetCard.getAttribute('data-venue-id');
            console.log("[Tap] Venue ID:", venueId);
            if (venueId && venueId !== 'null' && venueId !== 'undefined' && !venueId.startsWith('no-id-')) {
                navigateToVenueDetail(venueId); // Navigate on tap
            } else {
                console.warn("[Tap] Cannot navigate: Invalid or missing data-venue-id:", venueId);
            }
            // Snap back immediately if it was just a tap
            venueWrapper.style.transform = 'translateX(0px)';
            chooseWrapper.style.transform = 'translateX(0px)';

        } else if (isDragging) {
            console.log("[Action] Swipe detected.");
            const threshold = cardWidth / 3; // Swipe threshold (e.g., 1/3 of card width)
            let newIndex = currentVenueIndex;

            // Determine swipe direction and update index if threshold met
            if (diffX < -threshold && currentVenueIndex < fetchedVenueData.length - 1) {
                newIndex++; // Swiped left, go to next venue
                console.log("Swipe Left - New Index:", newIndex);
            } else if (diffX > threshold && currentVenueIndex > 0) {
                newIndex--; // Swiped right, go to previous venue
                console.log("Swipe Right - New Index:", newIndex);
            } else {
                console.log("Swipe did not meet threshold.");
            }

            // Animate snapping back to original position or sliding to new card (visually snaps back here)
            venueWrapper.style.transition = "transform 0.3s ease-out";
            chooseWrapper.style.transition = "transform 0.3s ease-out";
            venueWrapper.style.transform = 'translateX(0px)';
            chooseWrapper.style.transform = 'translateX(0px)';

            // Remove transition after animation completes
            setTimeout(() => {
                venueWrapper.style.transition = "";
                chooseWrapper.style.transition = "";
            }, 300);

            // If the index actually changed, update the displayed venue
            if (newIndex !== currentVenueIndex) {
                currentVenueIndex = newIndex;
                displayVenue(currentVenueIndex); // Update cards, map, dots
            }
        } else {
            // Interaction ended, but wasn't a tap and didn't meet swipe threshold
            console.log("[Action] Interaction ended (no tap/swipe). Snapping back.");
             venueWrapper.style.transition = "transform 0.3s ease-out";
             chooseWrapper.style.transition = "transform 0.3s ease-out";
             venueWrapper.style.transform = 'translateX(0px)';
             chooseWrapper.style.transform = 'translateX(0px)';
             setTimeout(() => {
                 venueWrapper.style.transition = "";
                 chooseWrapper.style.transition = "";
             }, 300);
        }

        // Reset state variables for the next interaction AFTER processing end event
        isDragging = false;
        startX = null; // Indicate no active interaction
        startY = null;
        diffX = 0;
        touchStartTime = 0;
    };


    // --- Attach Event Listeners ---
    console.log("Attaching pointer/mouse/touch listeners to swiper cards.");
    [venueCard, chooseVenueCard].forEach(card => {
        // Prefer Pointer Events for unified handling
        if (window.PointerEvent) {
            card.addEventListener('pointerdown', handlePointerStart);
            // Move/Up listeners are attached to the document below
        } else {
            // Fallback to Mouse and Touch events
            card.addEventListener('mousedown', handlePointerStart);
            card.addEventListener('touchstart', handlePointerStart, { passive: true }); // Passive start is ok if move handles preventDefault
            // Touch end listeners remain on the card
             card.addEventListener('touchend', handlePointerEnd);
             card.addEventListener('touchcancel', handlePointerEnd);
        }
    });

    // Attach Move and End listeners to the document to capture events outside the card during drag
    if (window.PointerEvent) {
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerEnd);
        document.addEventListener('pointercancel', handlePointerEnd); // Handle interruptions
    } else {
        document.addEventListener('mousemove', handlePointerMove);
        document.addEventListener('mouseup', handlePointerEnd);
        // Touch move needs to be non-passive IF preventDefault might be called inside handler
        document.addEventListener('touchmove', handlePointerMove, { passive: false });
    }


    // --- Initial Swiper Setup ---
    setupCardWidth(); // Calculate initial card width
    generateDots();   // Create the correct number of dots
    displayVenue(currentVenueIndex); // Display the first venue's data

    // --- Resize Handler ---
    window.addEventListener("resize", () => {
        console.log("Window resized.");
        setupCardWidth(); // Recalculate width
        updateDots(currentVenueIndex); // Update dot positions based on new container width
        // Invalidate map size to ensure it redraws correctly
        if (venueMapInstance) {
            setTimeout(() => {
                 try {
                     venueMapInstance.invalidateSize();
                      console.log("Map size invalidated on resize.");
                 } catch(e) {
                      console.error("Error invalidating map size on resize:", e);
                 }
            }, 150); // Slight delay
        }
    });

} // End of setupSwiperInteractions


// =========================================================================
// == Checklist Logic =====================================================
// =========================================================================
/**
 * Sets up the interactive checklist, saving and loading state from localStorage.
 */
function setupChecklist() {
    console.log("Initializing Checklist...");
    const checklistKey = "interactiveChecklistState"; // localStorage key
    // Select all checkboxes within the specific checklist container
    const checklistItems = document.querySelectorAll('.interactive-checklist input[type="checkbox"]');

    if (checklistItems.length > 0) {
        console.log(`Found ${checklistItems.length} checklist items.`);

        // Function to save the current state of all checkboxes
        function saveChecklistState() {
            const state = {};
            checklistItems.forEach((item) => {
                // Use item's ID as the key in the saved state object
                if (item.id) {
                    state[item.id] = item.checked;
                } else {
                     console.warn("Checklist item missing ID, cannot save its state:", item);
                }
            });
            try {
                localStorage.setItem(checklistKey, JSON.stringify(state));
                // console.log("Checklist state saved:", state); // Optional: log saved state
            } catch (e) {
                console.error("Error saving checklist state to localStorage:", e);
            }
        }

        // Function to load and apply the saved state
        function loadChecklistState() {
            const savedStateJSON = localStorage.getItem(checklistKey);
            if (savedStateJSON) {
                console.log("Loading checklist state from localStorage.");
                try {
                    const savedState = JSON.parse(savedStateJSON);
                    checklistItems.forEach((item) => {
                        // Apply saved state if item has an ID and that ID exists in storage
                        if (item.id && savedState[item.id] !== undefined) {
                            item.checked = savedState[item.id];
                        }
                    });
                } catch (e) {
                    console.error("Error parsing checklist state from localStorage:", e);
                    localStorage.removeItem(checklistKey); // Clear invalid data
                }
            } else {
                console.log("No saved checklist state found.");
            }
        }

        // Add event listener to each checkbox to save state on change
        checklistItems.forEach((item) => {
            item.addEventListener("change", saveChecklistState);
        });

        // Load the initial state when the page loads
        loadChecklistState();

    } else {
        // Log if no checklist items were found
        console.warn("No checklist items found with selector: .interactive-checklist input[type='checkbox']");
    }
}
