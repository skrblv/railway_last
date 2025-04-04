
let fetchedVenueData = []; // Will be filled by API call
let fetchedPlanData = []; // Will be filled by API call (RE-ADDED for themes)
let currentVenueIndex = 0; // Track the currently displayed venue in the swiper
let currentPlan = null; // Track the currently active plan (RE-ADDED for themes)

const DOT_WIDTH = 8; // px
const DOT_MARGIN = 4; // px
const MAP_ZOOM_LEVEL = 15;
const API_BASE_URL = "/api"; 
const VENUE_DETAIL_BASE_PATH = '/venue/'; 

const FIXED_SONG_PATH = './assets/Fifty Fifty - Cupid (Twin Version).mp3'; // Your fixed song path
const PLACEHOLDER_VENUE_IMAGE = './assets/placeholder-building.jpg'; // Fallback image for venues

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
const TAP_THRESHOLD_X = 15; // Max horizontal pixels moved to still be considered a tap
const TAP_THRESHOLD_Y = 20; // Max vertical pixels moved to still be considered a tap
const MAX_TAP_DURATION = 350; // Max milliseconds for a tap

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
}

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

function navigateToVenueDetail(venueId) {
    console.log("[Nav] navigateToVenueDetail called with ID:", venueId);
    if (venueId === null || venueId === undefined || venueId === '') {
        console.warn("[Nav] Cannot navigate: venueId is missing or invalid:", venueId);
        return;
    }

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

async function fetchPlans() {
    console.log("Attempting to fetch plans (for themes)...");
    try {
        const response = await fetch(`${API_BASE_URL}/plans/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            fetchedPlanData = await response.json();
            console.log("Fetched Plans (for themes):", fetchedPlanData);
            if (!Array.isArray(fetchedPlanData)) {
                console.warn("Fetched plan data is not an array, resetting.", fetchedPlanData);
                fetchedPlanData = [];
            }
            if (fetchedPlanData.length > 0) {
                // Look for 'Plan A' case-insensitively, otherwise take the first plan
                const initialPlan = fetchedPlanData.find((p) => p.name?.toLowerCase() === "plan a") || fetchedPlanData[0];
                console.log("Initial theme plan set to:", initialPlan?.name || 'First Plan');
                applyTheme(initialPlan); // Apply the theme from the selected plan
            } else {
                console.log("No plans fetched, applying default theme.");
                applyTheme(null); // Apply default theme state (no specific class)
            }
        } else {
            const textResponse = await response.text();
            throw new Error(`Expected JSON, but received ${contentType}. Response: ${textResponse}`);
        }
    } catch (error) {
        console.error("Could not fetch plans:", error);
        fetchedPlanData = []; // Reset data on error
        applyTheme(null); // Apply default theme state on error
    }
}

function applyTheme(plan) {
    const body = document.body;
    if (!body) {
        console.error("Cannot apply theme: document.body not found.");
        return;
    }

    // If no plan is provided, reset to default theme state
    if (!plan) {
        console.log("Applying default theme state (removing specific theme classes).");
        currentPlan = null;
        body.classList.remove("theme-positive", "theme-sad");
        // Optionally add a default theme class if your CSS requires it:
        // body.classList.add("theme-default");
        return;
    }

    console.log("Applying Theme from Plan:", plan.name || `(ID: ${plan.id})`);
    currentPlan = plan; // Keep track of the plan object for reference

    body.classList.remove("theme-positive", "theme-sad"); // Add any other theme classes here if needed

    if (plan.theme === "positive") {
        console.log("   -> Setting theme: positive");
        body.classList.add("theme-positive");
    } else if (plan.theme === "sad") {
        console.log("   -> Setting theme: sad");
        body.classList.add("theme-sad");
    } else {
        console.warn(`   -> Plan '${plan.name}' has unknown or missing theme property:`, plan.theme, " - Applying default styling (no theme class).");
    }

}


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

    // --- Set the fixed audio source ---
    // Use URL constructor for a reliable comparison, handling relative paths
    const fixedSongUrl = new URL(FIXED_SONG_PATH, window.location.href).href;
    if (audioPlayer.src !== fixedSongUrl) {
        console.log("Setting fixed audio source:", FIXED_SONG_PATH);
        audioPlayer.src = FIXED_SONG_PATH;
        // Metadata (title, artist, album art) should be set directly in the HTML
        // for the fixed player setup. Example:
        // <img class="album-art" src="./assets/hq720 (1).jpg" alt="Album Art">
        // <div id="track-title">Cupid (Twin Ver.)</div>
        // <div id="artist-name">FIFTY FIFTY</div>
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
        console.error("Fixed Audio Player Error:", e.target.error?.message || 'Unknown error', e);
        if (totalTimeEl) totalTimeEl.textContent = "Error";
        if (progress) progress.style.width = "0%";
        if (currentTimeEl) currentTimeEl.textContent = "0:00";
        updatePlayPauseIconState(); // Show play icon if error occurs
    });

    // --- Control Functions ---

    function togglePlayPause() {
        // Verify source is set before attempting to play
        if (!audioPlayer.src || audioPlayer.src === window.location.href) { // Check if src is empty or points to the page itself
            console.warn("Cannot play/pause: Fixed audio source not set or invalid.");
            // Attempt to set it again as a recovery measure
            const currentFixedUrl = new URL(FIXED_SONG_PATH, window.location.href).href;
            if(audioPlayer.src !== currentFixedUrl) {
                audioPlayer.src = FIXED_SONG_PATH;
                audioPlayer.load(); // Trigger loading
                console.log("Attempting to reload fixed audio source.");
            }
            return;
        }

        if (audioPlayer.paused) {
            audioPlayer.play().catch(e => {
                console.error("Audio play failed:", e);
                // Update icon state in case play() promise rejects immediately
                updatePlayPauseIconState();
            });
        } else {
            audioPlayer.pause();
        }
        // Icon state will be updated automatically by the 'play' and 'pause' event listeners attached below
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
        audioPlayer.currentTime = seekRatio * audioPlayer.duration;
        updateProgress(); // Update display immediately after seeking
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
        audioPlayer.currentTime = 0;
        if (audioPlayer.paused) {
            updateProgress(); // Update progress display even when paused
        } else {
            // If it was playing, ensure it continues playing after restarting
            audioPlayer.play().catch(e => console.error("Audio play failed on restart:", e));
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
// == DOMContentLoaded Event Listener (Main Execution Block)
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM loaded. Starting initialization...");

    // 1. Initialize the *fixed* music player immediately
    // It doesn't depend on fetched data.
    initializeFixedPlayer();

    // 2. Fetch venue and plan data concurrently
    console.log("Fetching initial venue and plan data...");
    try {
        // Wait for both asynchronous operations to complete
        await Promise.all([
            fetchVenues(), // Fetches venue data
            fetchPlans()   // Fetches plan data and applies initial theme
        ]);
        console.log("Initial data fetching complete (venues and plans).");
        // Note: The initial theme is applied within fetchPlans if successful.
    } catch (error) {
        console.error("Error during initial data fetch (Promise.all caught):", error);
        // Individual fetch functions should have already shown UI errors.
        // Ensure default theme is applied if fetchPlans failed within the Promise.all context
        if (fetchedPlanData.length === 0 && !document.body.classList.contains('theme-positive') && !document.body.classList.contains('theme-sad')) {
            applyTheme(null);
        }
    }

    // 3. Setup swiper and map *after* venue data is fetched
    // These depend on `fetchedVenueData`.
    setupSwiperInteractions();
    setupLeafletMap();

    // 4. Setup other UI elements (Checklist, Countdown)
    // These are generally independent of fetched data.
    setupChecklist();
    setupCountdownTimer();

    // 5. Setup Plan Switcher Buttons *after* plan data is fetched
    // This depends on `fetchedPlanData`.
    setupPlanSwitcherButtons();

    console.log("Frontend Player Initialization Complete.");
}); // --- END DOMContentLoaded ---


// =========================================================================
// == Plan Switcher Button Setup Function =================================
// =========================================================================

/**
 * Creates and inserts theme switcher buttons into the DOM based on fetched plan data.
 */
function setupPlanSwitcherButtons() {
    console.log("Initializing Plan Switcher Buttons (for themes)...");

    // Find a suitable container for the buttons
    const planSwitcherPlaceholder = document.getElementById('plan-switcher-placeholder'); // Ideal: Use a dedicated placeholder div
    let insertionPoint = null;
    let referenceNode = null;

    // Determine where to insert the buttons
    if (planSwitcherPlaceholder) {
        insertionPoint = planSwitcherPlaceholder; // Replace content of placeholder
        planSwitcherPlaceholder.innerHTML = ''; // Clear placeholder content
        planSwitcherPlaceholder.style.display = 'block'; // Ensure it's visible
    } else {
        // Fallback: Try inserting before the features section
        const featuresSection = document.querySelector(".features");
        if (featuresSection?.parentNode) {
            insertionPoint = featuresSection.parentNode;
            referenceNode = featuresSection; // Insert before this node
            console.log("Inserting plan switcher before features section.");
        } else {
             // Further Fallback: Append to the main container or body
             const mainContainer = document.querySelector(".container");
             if (mainContainer) {
                insertionPoint = mainContainer;
                console.warn("Features section not found, appending plan switcher to main container.");
             } else {
                insertionPoint = document.body;
                console.warn("Features section and main container not found, appending plan switcher to body.");
             }
        }
    }

    // Only create buttons if plan data exists and an insertion point was found
    if (fetchedPlanData.length > 0 && insertionPoint) {
        console.log(`Creating ${fetchedPlanData.length} theme switcher buttons.`);
        const planSwitcherContainer = document.createElement("div");
        planSwitcherContainer.className = "plan-switcher-container";
        planSwitcherContainer.style.textAlign = "center";
        planSwitcherContainer.style.padding = "20px 0";
        planSwitcherContainer.style.marginBottom = "30px"; // Add some space below

        fetchedPlanData.forEach((plan) => {
            const button = document.createElement("button");
            // Make button text descriptive
            button.textContent = `Set Theme: ${plan.name || `Plan ID ${plan.id}`} (${plan.theme || 'default'})`;
            button.className = "btn btn-secondary btn-switch-plan"; // Use existing styles
            button.style.margin = "5px 8px"; // Add vertical margin for wrapping
            button.setAttribute("data-plan-id", plan.id);
            // IMPORTANT: Clicking the button calls applyTheme, not applyPlan
            button.onclick = () => applyTheme(plan);
            planSwitcherContainer.appendChild(button);
        });

        // Insert the container with buttons into the determined location
        if (referenceNode) {
            insertionPoint.insertBefore(planSwitcherContainer, referenceNode);
        } else {
            insertionPoint.appendChild(planSwitcherContainer);
        }

    } else if (fetchedPlanData.length === 0) {
        console.log("No plan data fetched, skipping plan/theme switcher buttons.");
        if (planSwitcherPlaceholder) {
            planSwitcherPlaceholder.style.display = 'none'; // Hide placeholder if no buttons
        }
    } else {
        console.error("Could not find a suitable place to insert plan switcher buttons.");
    }
}


// =========================================================================
// == Countdown Timer Logic (Copied from Deployed Version) =================
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
// == Leaflet Map Initialization (Copied from Deployed Version) ============
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

            // Add attribution control if required by tile provider terms
            // L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(venueMapInstance);

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
            // Especially important if map container size changes after initial load
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
// == Venue Swiper Logic (Setup Function - Copied from Deployed Version) ===
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

    // Calculate and store card width
    function setupCardWidth() {
        cardWidth = venueCard.offsetWidth || 220; // Use offsetWidth, provide fallback
        console.log(`Swiper card width set to: ${cardWidth}px`);
    }

    // Generate dot indicators based on fetched data length
    function generateDots() {
        console.log(`Generating ${fetchedVenueData.length} dots.`);
        allDotsInnerContainers.forEach((dotsInner) => {
            if (dotsInner) {
                dotsInner.innerHTML = ""; // Clear existing dots
                fetchedVenueData.forEach(() => {
                    dotsInner.appendChild(document.createElement("span"));
                });
            } else {
                console.warn("A .dots-inner container is missing.");
            }
        });
    }

    // Update active dot and scroll dots container
    function updateDots(activeIndex) {
        if (activeIndex < 0 || activeIndex >= fetchedVenueData.length) return;
        // console.log(`Updating dots to active index: ${activeIndex}`); // Can be verbose
        allDotsInnerContainers.forEach((dotsInner) => {
            if (!dotsInner) return;
            const dots = dotsInner.querySelectorAll("span");
            const dotsContainer = dotsInner.parentElement; // The '.dots' element

            // Basic sanity checks
            if (!dotsContainer || !dots.length || dots.length !== fetchedVenueData.length) {
                // console.warn("Dots container/dots mismatch or missing."); // Can be verbose
                return;
            }

            // Toggle active class
            dots.forEach((dot, index) => dot.classList.toggle("active", index === activeIndex));

            // Calculate scroll offset to center the active dot
            const dotTotalWidth = DOT_WIDTH + DOT_MARGIN * 2;
            const containerVisibleWidth = dotsContainer.offsetWidth;
            const totalInnerWidth = fetchedVenueData.length * dotTotalWidth;
            const activeDotCenterOffset = activeIndex * dotTotalWidth + dotTotalWidth / 2;

            let translateX = 0;
            if (totalInnerWidth > containerVisibleWidth) {
                // Calculate ideal translation to center the dot
                translateX = containerVisibleWidth / 2 - activeDotCenterOffset;
                // Clamp translation within bounds [minTranslate, maxTranslate]
                const maxTranslate = 0; // Can't scroll past the beginning
                const minTranslate = containerVisibleWidth - totalInnerWidth; // Max scroll amount to the left
                translateX = Math.max(minTranslate, Math.min(maxTranslate, translateX));
            } else {
                // If dots fit within container, center the whole block
                translateX = (containerVisibleWidth - totalInnerWidth) / 2;
            }
            dotsInner.style.transform = `translateX(${translateX}px)`;
        });
    }

    // Update the Leaflet map position and marker
    function updateVenueMap(lat, lng, venueName) {
        if (!venueMapInstance || !venueMarker) {
            // console.warn("Map update skipped: Map instance or marker missing."); // Can be verbose
            return;
        }
        if (typeof lat === "number" && typeof lng === "number") {
            const newLatLng = L.latLng(lat, lng);
            // console.log(`Updating map to [${lat}, ${lng}] for "${venueName}"`); // Can be verbose
            try {
                // Smoothly pan and zoom map view
                venueMapInstance.setView(newLatLng, MAP_ZOOM_LEVEL, {
                    animate: true,
                    pan: { duration: 0.5 } // Animation duration
                });
                // Update marker position
                venueMarker.setLatLng(newLatLng);
                // Update marker popup content
                if (venueName) {
                    venueMarker.setPopupContent(`<b>${venueName}</b>`);
                } else {
                    venueMarker.setPopupContent(''); // Clear popup if no name
                }
                // Invalidate size after animation might start, ensures map redraws correctly
                setTimeout(() => venueMapInstance?.invalidateSize(), 150);
            } catch (mapError) {
                console.error("Error updating map view/marker:", mapError);
            }
        } else {
            console.warn(`Map update skipped for "${venueName || 'Unknown Venue'}": Invalid coords (lat: ${lat}, lng: ${lng}).`);
        }
    }

    // --- Display Venue Function (Updates card UI, map, dots - NO player/theme update) ---
    function displayVenue(index) {
        if (index < 0 || index >= fetchedVenueData.length) {
            console.warn(`Invalid venue index requested: ${index}`);
            return; // Exit if index is out of bounds
        }
        const venueData = fetchedVenueData[index];
        if (!venueData) {
            console.warn(`No venue data found for index: ${index}`);
            return; // Exit if data for index is missing
        }
        const currentVenueId = venueData.id; // Use venueData.id directly
        console.log(`Displaying venue index: ${index}, ID: ${currentVenueId ?? 'N/A'}, Name: ${venueData?.name ?? 'Unknown'}`);

        // Set data-venue-id attribute on both cards for tap navigation
        // Use nullish coalescing operator (??) to provide an empty string if ID is null/undefined
        venueCard.setAttribute('data-venue-id', currentVenueId ?? '');
        chooseVenueCard.setAttribute('data-venue-id', currentVenueId ?? '');
        if (!currentVenueId) {
            console.warn(`   -> Venue ID is missing for index ${index}. Navigation on tap might fail.`);
        }

        // --- Update Card Visuals ---

        // Venue Details Card (#venue-details-card)
        const venueNameEl = venueWrapper.querySelector(".venue-name");
        const venueDateEl = venueWrapper.querySelector(".venue-date");
        if (venueNameEl) venueNameEl.textContent = venueData.name || "Venue Name"; // Fallback text
        if (venueDateEl) venueDateEl.textContent = venueData.date_text || "--";   // Fallback text

        // Set background image with placeholder, fallback color, and error handling
        venueCard.style.backgroundImage = `url('${PLACEHOLDER_VENUE_IMAGE}')`; // Set placeholder first
        venueCard.style.backgroundColor = 'var(--secondary-color)'; // Provide a fallback BG color
        venueCard.style.backgroundSize = 'cover';
        venueCard.style.backgroundPosition = 'center';
        if (venueData.image_url) {
            const imgTest = new Image();
            imgTest.onload = () => {
                // Only update if image loads successfully
                venueCard.style.backgroundImage = `url('${venueData.image_url}')`;
            };
            imgTest.onerror = () => {
                // Log error, placeholder/color remains
                console.warn(`Venue card BG failed to load: ${venueData.image_url}. Using placeholder/fallback color.`);
            };
            imgTest.src = venueData.image_url; // Start loading the image
        }

        // Choose Venue Card (#choose-venue-card)
        const chooseHeaderEl = chooseWrapper.querySelector(".venue-header");
        const ratingEl = chooseWrapper.querySelector(".rating"); // The element containing star spans
        const ratingTextEl = chooseWrapper.querySelector(".rating-text"); // Optional element for text like "Good"
        const iconsContainer = chooseWrapper.querySelector(".venue-icons"); // The container for icons

        if (chooseHeaderEl) chooseHeaderEl.textContent = venueData.rating_text || "Venue Details"; // Use rating_text or fallback
        if (ratingEl) {
            const ratingValue = Math.round(venueData.rating_stars || 0);
            const maxStars = 5; // Assuming a 5-star system
            // Generate HTML for filled and empty stars
            ratingEl.innerHTML = '<span class="filled">' + '★'.repeat(ratingValue) + '</span>' +
                                 '☆'.repeat(maxStars - ratingValue);
        }
        if (ratingTextEl) { // Update the rating text if the element exists
            ratingTextEl.textContent = venueData.rating_text || ''; // Use rating_text or empty string
        }
        if (iconsContainer) { // Populate the icons container
            let iconsHTML = '';
            // Add icons based on available data properties (adjust property names as needed)
            if (venueData.venue_icon1) iconsHTML += `<span class="venue-icon-1">${venueData.venue_icon1}</span>`;
            if (venueData.venue_icon2) iconsHTML += ` <span class="venue-icon-2">${venueData.venue_icon2}</span>`;
            // Add more icons here if your data includes them (e.g., venue_icon3)
            // Set the container's HTML. Use a non-breaking space if empty to prevent collapse.
            iconsContainer.innerHTML = iconsHTML || ' ';
        }

        // --- Update Map & Dots ---
        updateVenueMap(venueData.latitude, venueData.longitude, venueData.name);
        updateDots(index);

        // --- Player/Theme update logic is NOT here ---
    }


    // --- Event Handlers (Defined ONCE) ---

    // Mousedown / Touchstart Handler
    const handlePointerStart = (e) => {
        // Prevent swipe initiation if the target is an interactive element or inside the map popup/controls
        if (e.target.closest("button, input, a, .dots, .leaflet-control, .leaflet-marker-icon, .leaflet-popup")) {
           console.log("Pointer start ignored on interactive element.");
           isDragging = false; // Ensure dragging doesn't start
           startX = null;      // Mark interaction as ignored for move/end handlers
           return;
        }
        isDragging = false; // Reset drag state
        startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
        startY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY; // Record Y for scroll detection
        currentX = startX;
        diffX = 0;
        touchStartTime = Date.now(); // Record time for tap detection
        cardWidth = venueCard.offsetWidth; // Get current width (might change on resize)

        // Add class for visual feedback during swipe attempt (optional)
        venueWrapper.classList.add("is-swiping");
        chooseWrapper.classList.add("is-swiping");

        // Don't preventDefault in touchstart yet, wait for touchmove to determine intent
        // console.log(`Pointer start at X: ${startX}, Y: ${startY}`); // Can be verbose
    };

    // Mousemove / Touchmove Handler
    const handlePointerMove = (e) => {
        // Only process if a valid pointer start occurred (startX is not null)
        if (startX === null) return;

        currentX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
        const currentY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
        diffX = currentX - startX;
        const diffY = currentY - startY; // Calculate vertical difference

        // Determine if it's a drag vs. scroll/tap attempt
        if (!isDragging) {
            // If vertical movement is significant and more dominant than horizontal, assume scrolling
            if (Math.abs(diffY) > TAP_THRESHOLD_Y && Math.abs(diffY) > Math.abs(diffX) * 1.5) { // Added ratio check
                console.log("Vertical scroll detected, canceling swipe.");
                startX = null; // Reset start flag to ignore subsequent moves/ends for this interaction
                // Remove visual feedback if swipe is cancelled
                venueWrapper.classList.remove("is-swiping");
                chooseWrapper.classList.remove("is-swiping");
                return; // Stop processing this move event
            }
            // If horizontal movement exceeds threshold, start dragging
            if (Math.abs(diffX) > TAP_THRESHOLD_X) {
                 console.log("Dragging started.");
                 isDragging = true;
            }
        }

        // If dragging, update card transform and prevent vertical scroll on touch devices
        if (isDragging) {
            const transformValue = `translateX(${diffX}px)`;
            venueWrapper.style.transform = transformValue;
            chooseWrapper.style.transform = transformValue;
            // Prevent default touch actions (like scrolling) ONLY when dragging horizontally
            if (e.cancelable && e.type.includes("touch")) {
                e.preventDefault();
            }
        }
    };

    // Mouseup / Touchend / Touchcancel / Mouseleave Handler
    const handlePointerEnd = (e) => {
        // Only process if a valid pointer start occurred and wasn't cancelled (startX is not null)
        if (startX === null) return;

        const touchDuration = Date.now() - touchStartTime;
        // Use changedTouches for touchend, otherwise use client coordinates for mouseup/mouseleave
        const endX = e.type.includes("touch") ? (e.changedTouches[0]?.clientX ?? currentX) : e.clientX;
        const endY = e.type.includes("touch") ? (e.changedTouches[0]?.clientY ?? currentY) : e.clientY;
        const finalDiffX = endX - startX; // Calculate final difference for accurate tap check
        const finalDiffY = endY - startY;

        // Determine if the interaction was a Tap
        const isTap = !isDragging &&
                      touchDuration < MAX_TAP_DURATION &&
                      Math.abs(finalDiffX) < TAP_THRESHOLD_X &&
                      Math.abs(finalDiffY) < TAP_THRESHOLD_Y;

        console.log(`Pointer end. Drag: ${isDragging}, Dur: ${touchDuration}ms, dx: ${finalDiffX.toFixed(0)}, dy: ${finalDiffY.toFixed(0)}, Tap: ${isTap}`);

        // --- Handle Tap ---
        if (isTap) {
            console.log("[Tap] Tap detected on card!");
            const targetCard = e.currentTarget; // The element the listener is attached to (venueCard or chooseVenueCard)
            const venueId = targetCard.getAttribute('data-venue-id');
            console.log("[Tap] Extracted Venue ID from tapped card:", venueId);
            if (venueId) { // Check if ID is truthy (not null, undefined, or empty string)
                navigateToVenueDetail(venueId); // <<< NAVIGATION CALL ON TAP
            } else {
                console.warn("[Tap] Could not navigate: data-venue-id was missing or empty on the tapped card:", targetCard);
            }
            // Snap back visually immediately (though navigation likely takes over)
            venueWrapper.style.transform = `translateX(0px)`;
            chooseWrapper.style.transform = `translateX(0px)`;
        }
        // --- Handle Swipe ---
        else if (isDragging) {
            console.log("[Swipe] Swipe end processing.");
            const threshold = cardWidth / 3; // Adjust threshold sensitivity (e.g., / 4 for less sensitive)
            let newIndex = currentVenueIndex;

            // Check swipe direction and boundaries
            if (diffX < -threshold && currentVenueIndex < fetchedVenueData.length - 1) {
                newIndex++; console.log("Swipe Left -> new index:", newIndex);
            } else if (diffX > threshold && currentVenueIndex > 0) {
                newIndex--; console.log("Swipe Right -> new index:", newIndex);
            } else {
                 console.log("Swipe did not cross threshold or at boundary.");
            }

            // Animate the snap back to the center position
            venueWrapper.style.transition = "transform 0.3s ease-out";
            chooseWrapper.style.transition = "transform 0.3s ease-out";
            venueWrapper.style.transform = `translateX(0px)`;
            chooseWrapper.style.transform = `translateX(0px)`;

            // Remove the transition after the animation completes to allow immediate dragging again
            setTimeout(() => {
                venueWrapper.style.transition = "";
                chooseWrapper.style.transition = "";
            }, 300);

            // Update the displayed venue ONLY if the index actually changed
            if (newIndex !== currentVenueIndex) {
                currentVenueIndex = newIndex;
                displayVenue(currentVenueIndex); // Update card visuals, map, dots
            }
        }
        // --- Handle Aborted Drag / Long Press / Other ---
        else {
            console.log("Pointer end: Not a swipe, not a tap (e.g., slow release, minimal move). Snapping back.");
            // Just animate snap back without changing index or navigating
            venueWrapper.style.transition = "transform 0.3s ease-out";
            chooseWrapper.style.transition = "transform 0.3s ease-out";
            venueWrapper.style.transform = `translateX(0px)`;
            chooseWrapper.style.transform = `translateX(0px)`;
            setTimeout(() => {
                venueWrapper.style.transition = "";
                chooseWrapper.style.transition = "";
            }, 300);
        }

        // --- Reset state variables for the next interaction ---
        isDragging = false;
        startX = null; // Use null to indicate the interaction sequence has ended
        startY = null;
        diffX = 0;
        touchStartTime = 0;

        // Remove visual feedback class
        venueWrapper.classList.remove("is-swiping");
        chooseWrapper.classList.remove("is-swiping");
    };


    // --- Attach Event Listeners ONCE to the Card Elements ---
    console.log("Attaching pointer/mouse/touch listeners ONCE to swiper cards.");
    [venueCard, chooseVenueCard].forEach(card => {
        // Touch Events (Primary for Mobile)
        card.addEventListener("touchstart", handlePointerStart, { passive: true }); // Passive: OK for start
        card.addEventListener("touchmove", handlePointerMove, { passive: false }); // Active: Needed to preventDefault during drag
        card.addEventListener("touchend", handlePointerEnd);
        card.addEventListener("touchcancel", handlePointerEnd); // Handle cancellation (e.g., call incoming)

        // Mouse Events (for Desktop)
        card.addEventListener("mousedown", handlePointerStart);

        // Explicit Click Listener (Fallback for Desktop / Accessibility)
        // This ensures navigation happens even without touch/drag events,
        // but tries to avoid double navigation after a tap.
        card.addEventListener('click', (e) => {
            // Check if the click should trigger navigation:
            // 1. Was it NOT part of a drag gesture? (isDragging is false)
            // 2. Was the movement minimal? (diffX check as safety)
            // 3. Did the click happen on the card itself, not an inner interactive element?
            if (!isDragging && Math.abs(diffX) < TAP_THRESHOLD_X) {
                if (!e.target.closest("button, input, a, .dots, .leaflet-control, .leaflet-marker-icon, .leaflet-popup")) {
                    // Check if pointerEnd recently handled a tap (difficult to track perfectly without flags)
                    // For simplicity, assume if it wasn't dragging, a clean click should navigate.
                    // Tap detection in pointerEnd should be the primary method.
                    console.log("[Click Fallback] Click detected on card area (not during/after drag).");
                    const targetCard = e.currentTarget;
                    const venueId = targetCard.getAttribute('data-venue-id');
                    console.log("[Click Fallback] Extracted Venue ID:", venueId);
                    if (venueId) {
                        navigateToVenueDetail(venueId);
                    } else {
                        console.warn("[Click Fallback] Could not navigate via click: data-venue-id missing.");
                    }
                } else {
                   console.log("[Click Fallback] Click ignored (target was inner interactive element).");
                }
            } else {
                // Click likely happened after a swipe/drag completed, pointerEnd handled it.
                console.log("[Click Fallback] Click ignored (likely occurred after swipe finished).");
            }
        });
    });

    // Attach Move/End listeners to the document for MOUSE events
    // This catches the mouse moving or being released *outside* the original card element during a drag.
    document.addEventListener("mousemove", handlePointerMove);
    document.addEventListener("mouseup", handlePointerEnd);
    // Handle mouse leaving the window during a drag
    document.addEventListener("mouseleave", (e) => {
       if (isDragging) { // Only trigger if currently dragging when mouse leaves
           console.log("Mouse left window during drag, treating as pointer end.");
           handlePointerEnd(e); // Trigger the end logic
       }
    });

    // --- Initial Swiper Setup ---
    setupCardWidth(); // Get initial card width
    generateDots();   // Create dot indicators
    displayVenue(currentVenueIndex); // Display the first venue (theme/player handled elsewhere)

    // --- Resize Handler ---
    window.addEventListener("resize", () => {
        console.log("Window resized.");
        setupCardWidth(); // Recalculate card width
        updateDots(currentVenueIndex); // Adjust dot scrolling
        // Invalidate map size on resize for responsiveness
        if (venueMapInstance) {
           // Debounce/Throttle this if resize events fire rapidly and cause performance issues
           setTimeout(() => {
               if (venueMapInstance) venueMapInstance.invalidateSize();
           }, 150); // Small delay to allow layout to settle
        }
    });

} // --- End of setupSwiperInteractions ---


// =========================================================================
// == Checklist Logic (Copied from Deployed Version) =======================
// =========================================================================
function setupChecklist() {
    console.log("Initializing Checklist...");
    const checklistKey = "interactiveChecklistState"; // Key for localStorage
    const checklistItems = document.querySelectorAll('.interactive-checklist input[type="checkbox"]');

    if (checklistItems.length > 0) {
        console.log(`Found ${checklistItems.length} checklist items.`);

        // Function to save the state of all checkboxes to localStorage
        function saveChecklistState() {
            const state = {};
            checklistItems.forEach((item) => {
                // Use item.id as the key for its state
                if (item.id) {
                    state[item.id] = item.checked;
                } else {
                    // Warn if a checkbox is missing an ID, as it won't be saved/loaded correctly
                    console.warn("Checklist item missing ID, cannot save state:", item);
                }
            });
            try {
                localStorage.setItem(checklistKey, JSON.stringify(state));
                // console.log("Checklist state saved."); // Can be verbose
            } catch (e) {
                console.error("Error saving checklist state to localStorage:", e);
            }
        }

        // Function to load the state from localStorage and apply it to checkboxes
        function loadChecklistState() {
            const savedState = localStorage.getItem(checklistKey);
            if (savedState) {
                console.log("Loading checklist state from localStorage.");
                try {
                    const state = JSON.parse(savedState);
                    checklistItems.forEach((item) => {
                        // If the item has an ID and its state exists in the saved object
                        if (item.id && state[item.id] !== undefined) {
                            item.checked = state[item.id]; // Set the checkbox state
                        }
                    });
                } catch (e) {
                    console.error("Error parsing checklist state from localStorage:", e);
                    // If parsing fails, remove the invalid item to prevent future errors
                    localStorage.removeItem(checklistKey);
                }
            } else {
                console.log("No saved checklist state found in localStorage.");
            }
        }

        // Add event listener to each checkbox to save state on change
        checklistItems.forEach((item) => {
            item.addEventListener("change", saveChecklistState);
        });

        // Load the initial state when the page loads
        loadChecklistState();

    } else {
        console.warn("No checklist items found (selector: .interactive-checklist input[type='checkbox']).");
    }
}

