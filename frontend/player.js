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
const VENUE_DETAIL_BASE_PATH = '/venue/'; // Relative path for local serving

// --- Paths relative to index.html ---
// REMOVED: const FIXED_SONG_PATH = './assets/Fifty Fifty - Cupid (Twin Version).mp3';
// REMOVED: const PLACEHOLDER_VENUE_IMAGE = './assets/placeholder-building.jpg';
// Path for placeholder image if needed elsewhere (use /static/ prefix)
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
const TAP_THRESHOLD_X = 15; // Threshold for X movement during tap
const TAP_THRESHOLD_Y = 20; // Threshold for Y movement during tap
const MAX_TAP_DURATION = 350; // Max duration for a tap

// =========================================================================
// == Helper Functions (Format Time, Update Icon, Navigation) ==============
// =========================================================================

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
async function fetchVenues() {
    console.log("Attempting to fetch venues...");
    try {
        const response = await fetch(`${API_BASE_URL}/venues/`);
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`); }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const rawData = await response.json();
            // Handle potential pagination structure from DRF
            const data = rawData.results || rawData; // Use results if present, otherwise assume raw data is the array
            if (!Array.isArray(data)) {
                console.warn("Fetched venue data is not an array, resetting.", data);
                fetchedVenueData = [];
            } else {
                fetchedVenueData = data;
                console.log("Fetched Venues:", fetchedVenueData.length, "items");
                 // Log first few items for debugging structure
                 console.log("First few venues:", fetchedVenueData.slice(0, 2));
            }
        } else {
            const textResponse = await response.text();
            throw new Error(`Expected JSON, but received ${contentType}. Response: ${textResponse}`);
        }
    } catch (error) {
        console.error("Could not fetch venues:", error);
        fetchedVenueData = [];
        const swiperSection = document.getElementById("venue-details-card")?.parentElement;
        if (swiperSection) swiperSection.innerHTML = `<p class="error-message">Error loading venues: ${error.message}</p>`;
        const venueMapContainer = document.getElementById("venue-map");
        if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Venue data unavailable.</p>";
    }
}


// =========================================================================
// == FIXED Music Player Initialization & Controls =========================
// =========================================================================
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

    if (!audioPlayer || !playPauseBtn || !prevBtn || !nextBtn || !progressContainer || !volumeSlider || !totalTimeEl || !albumArt) {
        console.warn("Fixed player init failed: One or more elements missing.");
        return;
    }

    // --- REMOVE the block that sets audioPlayer.src from FIXED_SONG_PATH ---
    // We now trust that the HTML's {% static %} tag has set the correct initial src.
    // Log the src that was set by the HTML template tag.
    if (audioPlayer.src) {
        console.log("Audio source already set by HTML:", audioPlayer.src);
    } else {
        // This case should ideally not happen if {% static %} works, but add a warning.
        console.warn("Audio source was NOT set by HTML. Player might not work.");
    }
    // --- END REMOVAL ---

    // --- Event Listeners for Fixed Player ---
    audioPlayer.addEventListener("loadedmetadata", () => {
        console.log("Fixed song metadata loaded. Duration:", audioPlayer.duration);
        if (totalTimeEl && audioPlayer.duration && !isNaN(audioPlayer.duration)) {
            totalTimeEl.textContent = formatTime(audioPlayer.duration);
        } else {
            console.warn("Could not set total time. Duration:", audioPlayer.duration);
            if (totalTimeEl) totalTimeEl.textContent = "0:00"; // Reset if invalid
        }
        updatePlayPauseIconState(); // Update icon based on initial state after metadata loads
    });

    audioPlayer.addEventListener("error", (e) => {
        // Log the specific error from the event object
        let errorMsg = 'Unknown error';
        if (e.target && e.target.error) {
            switch (e.target.error.code) {
                case MediaError.MEDIA_ERR_ABORTED: errorMsg = 'Fetch aborted by user.'; break;
                case MediaError.MEDIA_ERR_NETWORK: errorMsg = 'Network error.'; break;
                case MediaError.MEDIA_ERR_DECODE: errorMsg = 'Decode error.'; break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMsg = 'Source not supported.'; break;
                default: errorMsg = `Code ${e.target.error.code}`;
            }
            errorMsg += ` (${e.target.error.message || ''})`;
        }
        console.error("Fixed Audio Player Error:", errorMsg, "Attempted source:", audioPlayer.currentSrc || "N/A", e);

        // Update UI to show error state
        if (totalTimeEl) totalTimeEl.textContent = "Error";
        const progress = document.getElementById("progress");
        if (progress) progress.style.width = "0%";
        const currentTimeEl = document.getElementById("current-time");
        if (currentTimeEl) currentTimeEl.textContent = "0:00";
        updatePlayPauseIconState(); // Ensure icon shows 'play'
    });


    function togglePlayPause() {
        // Check if the src attribute has a value (set by HTML {% static %})
        // Use audioPlayer.currentSrc for a more reliable check of what the browser is *actually* trying to load
        if (!audioPlayer.currentSrc && !audioPlayer.src) { // Check both just in case
            console.warn("Cannot play: Audio source not set or empty. Check HTML {% static %} tag.");
            // Optionally, try to reload if you suspect a temporary issue, but usually indicates a config problem.
            // audioPlayer.load();
            return;
        }

        console.log(`Toggle Play/Pause. Current state: ${audioPlayer.paused ? 'Paused' : 'Playing'}. Src: ${audioPlayer.currentSrc || audioPlayer.src}`);

        if (audioPlayer.paused) {
            audioPlayer.play().catch(e => console.error("Audio play() failed:", e));
        } else {
            audioPlayer.pause();
        }
        // Icon updated by 'play'/'pause' events attached below
    }

    function updateProgress() {
         if (audioPlayer.duration && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
             const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
             const progress = document.getElementById("progress"); if (progress) progress.style.width = `${progressPercent}%`;
             const currentTimeEl = document.getElementById("current-time"); if (currentTimeEl) currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
         } else {
             // Reset progress if duration is invalid (e.g., after an error)
             const progress = document.getElementById("progress"); if (progress) progress.style.width = "0%";
             const currentTimeEl = document.getElementById("current-time"); if (currentTimeEl) currentTimeEl.textContent = "0:00";
             // Don't reset totalTimeEl here, it's set on loadedmetadata or error
         }
     }

    function seek(event) {
         if (!audioPlayer.duration || isNaN(audioPlayer.duration) || audioPlayer.duration <= 0) {
             console.warn("Cannot seek: Invalid audio duration.");
             return;
         }
         const progressBar = progressContainer.querySelector('.progress-bar'); if (!progressBar) return;
         const rect = progressBar.getBoundingClientRect();
         const offsetX = event.clientX - rect.left;
         const barWidth = progressBar.clientWidth;
         if (barWidth <= 0) return; // Avoid division by zero

         const seekRatio = Math.max(0, Math.min(1, offsetX / barWidth));
         audioPlayer.currentTime = seekRatio * audioPlayer.duration;
         updateProgress(); // Update UI immediately after seek
     }

    function changeVolume() {
        if (volumeSlider) {
             const volumeValue = parseFloat(volumeSlider.value) / 100;
             audioPlayer.volume = Math.max(0, Math.min(1, volumeValue));
            // console.log("Volume changed to:", audioPlayer.volume); // Optional debug log
        }
    }

    function restartSong() {
         // Check duration as well, restarting a non-loaded track makes no sense
         if (!audioPlayer.src || isNaN(audioPlayer.duration) || audioPlayer.duration <= 0) {
              console.warn("Cannot restart song: Source or duration invalid.");
              return;
         }
         console.log("Restarting song.");
         audioPlayer.currentTime = 0;
         if (audioPlayer.paused) {
             updateProgress(); // Update UI if paused
         } else {
             // If it was playing, start playing again from the beginning
             audioPlayer.play().catch(e => console.error("Audio play() failed on restart:", e));
         }
     }

    // --- Attach Listeners ---
    playPauseBtn.addEventListener("click", togglePlayPause);
    audioPlayer.addEventListener("timeupdate", updateProgress);
    audioPlayer.addEventListener("play", updatePlayPauseIconState); // Update icon when playback starts
    audioPlayer.addEventListener("pause", updatePlayPauseIconState); // Update icon when playback pauses
    audioPlayer.addEventListener("ended", restartSong); // Loop the fixed song
    progressContainer.addEventListener("click", seek);
    volumeSlider.addEventListener("input", changeVolume); // Use 'input' for immediate feedback
    prevBtn.addEventListener("click", restartSong); // Prev button restarts
    nextBtn.addEventListener("click", restartSong); // Next button also restarts (placeholder)

    // --- Initial State ---
    changeVolume(); // Set initial volume from slider value
    updatePlayPauseIconState(); // Set initial icon state (should show 'play' initially)
    updateProgress(); // Set initial progress display (0:00 / 0:00 until metadata loads)
    console.log("Fixed Music Player Controls Initialized.");
}


// =========================================================================
// == DOMContentLoaded Event Listener (Main Execution Block)
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM loaded. Starting initialization...");

    // 1. Initialize the *fixed* player immediately
    // It will rely on the src set by the {% static %} tag in index.html
    initializeFixedPlayer();

    // 2. Fetch venue data for the swiper/map
    console.log("Fetching initial venue data for swiper/map...");
    try {
        await fetchVenues();
        console.log("Venue data fetching complete.");
        // 3. Setup swiper and map *after* fetching data SUCCEEDS
        setupSwiperInteractions();
        setupLeafletMap(); // Separate function for map setup
    } catch (error) {
        console.error("Error during initial venue data fetch:", error);
        // Error message already shown by fetchVenues
        // Swiper/Map setup is skipped if fetch fails
    }

    // 4. Setup other UI elements (Checklist, Countdown) - can run even if venue fetch fails
    setupChecklist();
    setupCountdownTimer();

    // 5. Remove global plan switcher logic (specific to index.html, not needed)
    // No plan switcher on the main page in this setup.
    // const planSwitcherPlaceholder = document.getElementById('plan-switcher-placeholder'); // This ID doesn't exist on index.html
    // if (planSwitcherPlaceholder) { ... }

    console.log("Frontend Player Initialization Complete.");
}); // --- END DOMContentLoaded ---


// =========================================================================
// == Countdown Timer Logic ===============================================
// =========================================================================
function setupCountdownTimer() {
     console.log("Initializing Countdown Timer...");
     const datePicker = document.getElementById("event-date-picker"); const setDateBtn = document.getElementById("set-date-btn"); const daysNumEl = document.getElementById("days-num"); const hoursNumEl = document.getElementById("hours-num"); const minutesNumEl = document.getElementById("minutes-num"); const secondsNumEl = document.getElementById("seconds-num"); const calDay1El = document.getElementById("cal-day-1"); const calDay2El = document.getElementById("cal-day-2"); const calDay3El = document.getElementById("cal-day-3");
     if (datePicker && setDateBtn && daysNumEl && hoursNumEl && minutesNumEl && secondsNumEl && calDay1El && calDay2El && calDay3El ) {
         console.log("Countdown timer elements found."); const localStorageKey = "targetEventDate"; let targetDate = null; let countdownInterval = null; function padZero(num) { return num < 10 ? "0" + num : num; } function updateCalendarDisplay(dateObj) { if (!dateObj || isNaN(dateObj.getTime())) { calDay1El.textContent = "--"; calDay2El.textContent = "--"; calDay3El.textContent = "--"; calDay1El.classList.remove("highlight"); calDay2El.classList.add("highlight"); calDay3El.classList.remove("highlight"); return; } const targetDay = dateObj.getUTCDate(); const prevDate = new Date(dateObj); prevDate.setUTCDate(targetDay - 1); const nextDate = new Date(dateObj); nextDate.setUTCDate(targetDay + 1); calDay1El.textContent = padZero(prevDate.getUTCDate()); calDay2El.textContent = padZero(targetDay); calDay3El.textContent = padZero(nextDate.getUTCDate()); calDay1El.classList.remove("highlight"); calDay2El.classList.add("highlight"); calDay3El.classList.remove("highlight"); } function updateCountdown() { if (!targetDate || isNaN(targetDate.getTime())) { daysNumEl.textContent = "--"; hoursNumEl.textContent = "--"; minutesNumEl.textContent = "--"; secondsNumEl.textContent = "--"; return; } const now = new Date().getTime(); const difference = targetDate.getTime() - now; if (difference <= 0) { daysNumEl.textContent = "00"; hoursNumEl.textContent = "00"; minutesNumEl.textContent = "00"; secondsNumEl.textContent = "00"; if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; } return; } const days = Math.floor(difference / 86400000); const hours = Math.floor((difference % 86400000) / 3600000); const minutes = Math.floor((difference % 3600000) / 60000); const seconds = Math.floor((difference % 60000) / 1000); daysNumEl.textContent = padZero(days); hoursNumEl.textContent = padZero(hours); minutesNumEl.textContent = padZero(minutes); secondsNumEl.textContent = padZero(seconds); } function startCountdown() { if (countdownInterval) clearInterval(countdownInterval); if (targetDate && !isNaN(targetDate.getTime()) && targetDate.getTime() > new Date().getTime()) { updateCountdown(); countdownInterval = setInterval(updateCountdown, 1000); } else { updateCountdown(); } } function handleSetDate() { const selectedDateString = datePicker.value; if (!selectedDateString) { alert("Please select a date."); return; } const parts = selectedDateString.split("-"); if (parts.length !== 3) { alert("Invalid date format."); return; } const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10) - 1; const day = parseInt(parts[2], 10); if (isNaN(year) || isNaN(month) || isNaN(day)) { alert("Invalid date components."); return; } const potentialTargetDate = new Date(Date.UTC(year, month, day, 0, 0, 0)); if (isNaN(potentialTargetDate.getTime())) { alert("Invalid date selected."); return; } const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0); if (potentialTargetDate < todayUTC) { alert("Please select today or a future date."); return; } localStorage.setItem(localStorageKey, selectedDateString); targetDate = potentialTargetDate; updateCalendarDisplay(targetDate); startCountdown(); console.log("New target date set:", targetDate); } function loadDateFromStorage() { const storedDateString = localStorage.getItem(localStorageKey); if (storedDateString) { const parts = storedDateString.split("-"); if (parts.length === 3) { const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10) - 1; const day = parseInt(parts[2], 10); if (!isNaN(year) && !isNaN(month) && !isNaN(day)) { const loadedDate = new Date(Date.UTC(year, month, day, 0, 0, 0)); if (!isNaN(loadedDate.getTime())) { targetDate = loadedDate; datePicker.value = storedDateString; console.log("Loaded target date from storage:", targetDate); updateCalendarDisplay(targetDate); startCountdown(); return; } } } console.warn("Invalid date string in localStorage, removing."); localStorage.removeItem(localStorageKey); } console.log("No valid date in storage, initializing default display."); updateCalendarDisplay(null); updateCountdown(); } setDateBtn.addEventListener("click", handleSetDate); loadDateFromStorage();
     } else { console.warn("Countdown timer elements missing."); }
}

// =========================================================================
// == Leaflet Map Initialization ==========================================
// =========================================================================
function setupLeafletMap() {
    console.log("Initializing Leaflet Map...");
    const venueMapContainer = document.getElementById("venue-map");
    if (!venueMapContainer || typeof L === "undefined") {
         if (!venueMapContainer) console.warn("Map container #venue-map missing.");
         if (typeof L === "undefined") console.warn("Leaflet library (L) missing.");
         if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Map disabled.</p>";
         return;
     }

     if (fetchedVenueData.length > 0) {
         try {
             const firstVenue = fetchedVenueData[0];
             // Validate coordinates before using them
             const lat = firstVenue?.latitude;
             const lng = firstVenue?.longitude;
             const isValidCoords = typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng);
             const initialCoords = isValidCoords ? [lat, lng] : [42.8749, 74.6049]; // Default fallback coords (Bishkek)

             if (!isValidCoords) {
                 console.warn(`Using fallback coordinates because venue 0 data is invalid: lat=${lat}, lng=${lng}`);
             }

             console.log("Initializing map at coords:", initialCoords);
             // Destroy previous map instance if it exists
             if (venueMapInstance) {
                 console.log("Removing previous map instance.");
                 venueMapInstance.remove();
                 venueMapInstance = null;
                 venueMarker = null;
             }

             venueMapInstance = L.map(venueMapContainer, { zoomControl: false, attributionControl: false }).setView(initialCoords, MAP_ZOOM_LEVEL);
             L.control.zoom({ position: "bottomright" }).addTo(venueMapInstance);
             L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(venueMapInstance);

             // Only add marker if coordinates were valid
             if (isValidCoords) {
                 venueMarker = L.marker(initialCoords).addTo(venueMapInstance);
                 if (firstVenue?.name) {
                     venueMarker.bindPopup(`<b>${firstVenue.name}</b>`).openPopup();
                     setTimeout(() => venueMarker?.closePopup(), 2500); // Close popup after delay
                 }
             } else {
                  venueMapContainer.innerHTML += "<p class='map-warning'>Default map location shown (venue coordinates missing/invalid).</p>";
             }

             // Invalidate size after a short delay
             setTimeout(() => {
                 if (venueMapInstance) {
                    try {
                         console.log("Invalidating map size.");
                         venueMapInstance.invalidateSize();
                     } catch(e) {
                         console.error("Error invalidating map size:", e);
                     }
                 }
             }, 300);
         } catch (error) {
             console.error("Error initializing Leaflet map:", error);
             if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Error loading map.</p>";
         }
     } else {
         console.warn("Map init skipped: No venue data fetched.");
         if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>No venues to display on map.</p>";
     }
}

// =========================================================================
// == Venue Swiper Logic (Setup Function) =================================
// =========================================================================
function setupSwiperInteractions() {
    console.log("Initializing Venue Swiper...");
    const venueCard = document.getElementById("venue-details-card");
    const chooseVenueCard = document.getElementById("choose-venue-card");

    if (!venueCard || !chooseVenueCard) {
         console.warn("Swiper base card elements missing (#venue-details-card or #choose-venue-card).");
         // Maybe hide the whole features section or show a message?
          const featuresSection = document.getElementById("venue-section");
          if (featuresSection) featuresSection.innerHTML = '<p class="error-message">Venue display components are missing.</p>';
         return;
    }

    // Check if data exists AND is an array with items
    if (!Array.isArray(fetchedVenueData) || fetchedVenueData.length === 0) {
        console.warn("Swiper setup skipped: No valid venue data fetched or data is empty.");
        if(venueCard) venueCard.innerHTML = '<div class="card-content-wrapper"><p class="info-message">No venues available to display.</p></div>';
        if(chooseVenueCard) chooseVenueCard.style.display = 'none'; // Hide the second card
        // Hide dots containers if they exist
         document.querySelectorAll(".dots").forEach(dots => dots.style.display = 'none');
        // Hide the map container as well if it exists
        const mapCard = document.querySelector(".venue-suggestion");
        if(mapCard) mapCard.style.display = 'none';
        const remindersCard = document.querySelector(".reminders-ideas");
        if(remindersCard) remindersCard.style.display = 'none'; // Example for other cards
        const cutleryCard = document.querySelector(".cutlery");
        if(cutleryCard) cutleryCard.style.display = 'none'; // Example for other cards

        return; // Stop setup
    }

     // --- Proceed with setup if data is valid ---
     console.log("Venue data found, setting up swiper interactions.");
     const venueWrapper = venueCard.querySelector(".card-content-wrapper");
     const chooseWrapper = chooseVenueCard.querySelector(".card-content-wrapper");
     const allDotsInnerContainers = document.querySelectorAll(".dots-inner"); // Should target both sets of dots

     if (!venueWrapper || !chooseWrapper || allDotsInnerContainers.length < 2) { // Ensure both cards have wrappers and dots
         console.error("Swiper setup failed: Inner elements (.card-content-wrapper) or dots containers (.dots-inner) missing in one or both swiper cards.");
         return;
     }

     console.log("Swiper inner wrappers and dots containers found.");

     // --- Swiper Helper Functions ---
     function setupCardWidth() { cardWidth = venueCard.offsetWidth || 220; } // Use actual card width
     function generateDots() {
         allDotsInnerContainers.forEach((dotsInner) => {
             if (dotsInner) {
                 dotsInner.innerHTML = ""; // Clear existing dots
                 fetchedVenueData.forEach(() => {
                     dotsInner.appendChild(document.createElement("span"));
                 });
             }
         });
     }
     function updateDots(activeIndex) {
        if (activeIndex < 0 || activeIndex >= fetchedVenueData.length) return;

        allDotsInnerContainers.forEach((dotsInner) => {
            if (!dotsInner) return;
            const dots = dotsInner.querySelectorAll("span");
            const dotsContainer = dotsInner.parentElement; // The '.dots' element

            if (!dotsContainer || dots.length !== fetchedVenueData.length) {
                 console.warn("Dots mismatch or container missing.");
                 // Optionally regenerate dots here if needed: generateDots(); updateDots(activeIndex);
                 return; // Or handle error more gracefully
             }

            dots.forEach((dot, i) => {
                dot.classList.toggle("active", i === activeIndex);
            });

            // --- Dots scrolling logic ---
            const dotTotalWidth = (DOT_WIDTH + DOT_MARGIN * 2); // Width of one dot + margins
            const containerWidth = dotsContainer.offsetWidth;
            const totalDotsWidth = dots.length * dotTotalWidth;
            const activeDotOffset = activeIndex * dotTotalWidth + dotTotalWidth / 2;
            let translateOffset = containerWidth / 2 - activeDotOffset;

            // Limit translation so dots don't scroll too far left or right
            if (totalDotsWidth > containerWidth) {
                 // Don't scroll past the beginning or the end
                 translateOffset = Math.max(containerWidth - totalDotsWidth, Math.min(0, translateOffset));
            } else {
                 // Center dots if they all fit
                 translateOffset = (containerWidth - totalDotsWidth) / 2;
            }
            dotsInner.style.transform = `translateX(${translateOffset}px)`;
        });
    }
     function updateVenueMap(lat, lng, venueName) {
        if (!venueMapInstance || !venueMarker) {
            // If map wasn't initialized (e.g., no coords for first venue), try initializing now
             if (!venueMapInstance && typeof lat === 'number' && typeof lng === 'number') {
                 console.log("Map not initialized, attempting setup in updateVenueMap.");
                 setupLeafletMap(); // This will use fetchedVenueData[currentVenueIndex]
                 // Re-get instances after potential setup
                 venueMapInstance = window.venueMapInstance; // Assuming setupLeafletMap might set global
                 venueMarker = window.venueMarker;
                 if (!venueMapInstance || !venueMarker) {
                     console.warn("Map setup failed during updateVenueMap.");
                     return;
                 }
             } else if (!venueMapInstance) {
                  console.warn(`Map update skipped: Map not initialized.`);
                  return;
             }
        }

         if (typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng)) {
             const newLatLng = L.latLng(lat, lng);
             // Check if map center needs significant change before animating view
             if (!venueMapInstance.getBounds().contains(newLatLng)) {
                  venueMapInstance.flyTo(newLatLng, MAP_ZOOM_LEVEL, { animate: true, duration: 0.7 });
             } else {
                 venueMapInstance.panTo(newLatLng, { animate: true, duration: 0.5 });
             }
             venueMarker.setLatLng(newLatLng);
             if (venueName) {
                 venueMarker.setPopupContent(`<b>${venueName}</b>`);
                 // Optionally open popup briefly
                 // venueMarker.openPopup();
                 // setTimeout(() => venueMarker?.closePopup(), 1500);
             }
             // Ensure map size is correct after potential layout changes
             setTimeout(() => venueMapInstance?.invalidateSize(), 150);
         } else {
             console.warn(`Map update skipped: Invalid coords (lat=${lat}, lng=${lng}) for venue: ${venueName}`);
              // Maybe hide marker or show a default location?
              // venueMarker.setLatLng([DEFAULT_LAT, DEFAULT_LNG]); // Example
              // venueMarker.setPopupContent("Coordinates unavailable");
         }
     }


     // --- Display Venue Function (Updates card UI, map, dots - NO player update) ---
     function displayVenue(index) {
         if (index < 0 || index >= fetchedVenueData.length) {
             console.warn(`Invalid venue index requested: ${index}`);
             return; // Avoid errors with invalid index
         }
         const venueData = fetchedVenueData[index];
         // Ensure venueData is an object
         if (!venueData || typeof venueData !== 'object') {
              console.error(`Invalid venue data at index ${index}:`, venueData);
              // Optionally display an error state on the card
              venueWrapper.innerHTML = `<p class="error-message">Error loading venue data</p>`;
              chooseWrapper.innerHTML = `<p class="error-message">Error loading details</p>`;
              return;
         }

         const currentVenueId = venueData.id; // Get ID for navigation
         console.log(`Displaying venue index: ${index}, ID: ${currentVenueId}, Name: ${venueData?.name}`);

         // Set data-venue-id for tap navigation on both cards
         venueCard.setAttribute('data-venue-id', currentVenueId ?? '');
         chooseVenueCard.setAttribute('data-venue-id', currentVenueId ?? '');

         // === Update Venue Details Card (Left) ===
         venueWrapper.querySelector(".venue-name").textContent = venueData.name || "Venue Name Unavailable";
         venueWrapper.querySelector(".venue-date").textContent = venueData.date_text || "--"; // Use date_text or fallback

         // Background Image handling with fallback and error check
         const imageUrl = venueData.image_url;
         venueCard.style.backgroundColor = 'var(--secondary-color)'; // Default background if no image
         venueCard.style.backgroundImage = 'none'; // Reset first

         if (imageUrl) {
             // Test image loading
             const imgTest = new Image();
             imgTest.onload = () => {
                  // Apply background image only if it loads successfully
                  venueCard.style.backgroundImage = `url('${imageUrl}')`;
                  venueCard.style.backgroundColor = ''; // Remove fallback color
             };
             imgTest.onerror = () => {
                 console.warn(`Venue card background image failed to load: ${imageUrl}. Using fallback color.`);
                 venueCard.style.backgroundImage = 'none'; // Ensure no broken image link shown
                 venueCard.style.backgroundColor = 'var(--secondary-color)';
             };
             imgTest.src = imageUrl;
         } else {
              console.log(`No image_url for venue ${venueData.name}, using fallback color.`);
         }


         // === Update Choose Venue Card (Right) ===
         chooseWrapper.querySelector(".venue-header").textContent = venueData.rating_text || "Details"; // Use rating_text or fallback
         const ratingEl = chooseWrapper.querySelector(".rating");
         if (ratingEl) {
             const ratingValue = Math.round(venueData.rating_stars || 0);
             const clampedRating = Math.max(0, Math.min(5, ratingValue)); // Ensure rating is 0-5
             ratingEl.innerHTML = '<span class="filled">' + '★'.repeat(clampedRating) + '</span>' + '☆'.repeat(5 - clampedRating);
         }
         // Icons
         const iconsContainer = chooseWrapper.querySelector(".venue-icons");
         if (iconsContainer) {
             let iconsHTML = '';
             if (venueData.venue_icon1) iconsHTML += `<span class="venue-icon-1">${venueData.venue_icon1}</span>`;
             if (venueData.venue_icon2) iconsHTML += ` <span class="venue-icon-2">${venueData.venue_icon2}</span>`;
             iconsContainer.innerHTML = iconsHTML || '<span>-</span>'; // Show a placeholder if no icons
         }

         // Update Map & Dots
         updateVenueMap(venueData.latitude, venueData.longitude, venueData.name);
         updateDots(index);

         // --- Player update REMOVED from here ---
         // Player is completely static on this page
     }

     // --- Event Handlers (Pointer/Touch/Mouse) ---
     const handlePointerStart = (e) => {
         // Ignore clicks/taps on interactive elements within the card
         if (e.target.closest("button, input, a, .dots, .leaflet-container, .leaflet-control")) return;

         isDragging = false; // Reset dragging flag
         startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
         startY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
         currentX = startX;
         diffX = 0;
         touchStartTime = Date.now();
         cardWidth = venueCard.offsetWidth; // Get current card width

         // Add class for visual feedback during swipe (optional)
         venueWrapper.classList.add("is-swiping");
         chooseWrapper.classList.add("is-swiping");
         // Change cursor for mouse drag
         if (e.type.includes("mouse")) {
              venueCard.style.cursor = 'grabbing';
              chooseVenueCard.style.cursor = 'grabbing';
         }
     };

     const handlePointerMove = (e) => {
         // Only process move if startX is set (meaning a pointerdown started on the card)
         if (startX === null) return;

         // Allow vertical scroll by checking Y movement first
          const currentY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
          const diffY = currentY - startY;

         currentX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
         diffX = currentX - startX;

         // If not already dragging, check thresholds
         if (!isDragging) {
            // Prioritize vertical scroll if Y movement is significant and more vertical than horizontal
            if (Math.abs(diffY) > TAP_THRESHOLD_Y && Math.abs(diffY) > Math.abs(diffX) * 1.5) {
                // Allow vertical scroll, cancel swipe attempt
                console.log("Vertical scroll detected, cancelling swipe.");
                startX = null; // Reset start position to stop tracking
                venueWrapper.classList.remove("is-swiping");
                chooseWrapper.classList.remove("is-swiping");
                if (e.type.includes("mouse")) {
                     venueCard.style.cursor = 'grab';
                     chooseVenueCard.style.cursor = 'grab';
                }
                return;
            }
            // If horizontal movement exceeds threshold, start dragging
            if (Math.abs(diffX) > TAP_THRESHOLD_X) {
                console.log("Swipe drag started.");
                isDragging = true;
            }
         }

         // If dragging, update card position and prevent default touch action (like scrolling)
         if (isDragging) {
             venueWrapper.style.transform = `translateX(${diffX}px)`;
             chooseWrapper.style.transform = `translateX(${diffX}px)`;
             // Prevent vertical scrolling ONLY when actively dragging horizontally
             if (e.cancelable && e.type.includes("touch")) {
                  e.preventDefault();
             }
         }
     };

      const handlePointerEnd = (e) => {
         // Only process if a pointer interaction started on the card
         if (startX === null) return;

         const touchDuration = Date.now() - touchStartTime;
         // Use changedTouches for touchend, fall back to clientX/Y for mouseup
          const endX = e.type === 'touchend' ? e.changedTouches[0].clientX : e.clientX;
          const endY = e.type === 'touchend' ? e.changedTouches[0].clientY : e.clientY;
          const finalDiffX = endX - startX;
          const finalDiffY = endY - startY;


         // Determine if it was a tap or a swipe
         const isTap = !isDragging && touchDuration < MAX_TAP_DURATION && Math.abs(finalDiffX) < TAP_THRESHOLD_X && Math.abs(finalDiffY) < TAP_THRESHOLD_Y;

         console.log(`Pointer end. Drag: ${isDragging}, Dur: ${touchDuration}ms, dx: ${finalDiffX.toFixed(0)}, dy: ${finalDiffY.toFixed(0)}, Tap: ${isTap}`);

         // Reset cursor for mouse events
          if (e.type.includes("mouse")) {
               venueCard.style.cursor = 'grab';
               chooseVenueCard.style.cursor = 'grab';
          }
          // Remove swiping class
           venueWrapper.classList.remove("is-swiping");
           chooseWrapper.classList.remove("is-swiping");

         if (isTap) {
             console.log("[Tap] Tap detected on card!");
             const targetCard = e.currentTarget; // The card element the listener is attached to
             const venueId = targetCard.getAttribute('data-venue-id');
             console.log("[Tap] Extracted Venue ID:", venueId);
             if (venueId !== null && venueId !== undefined && venueId !== '') {
                 navigateToVenueDetail(venueId); // <<< NAVIGATION CALL
             } else {
                 console.warn("[Tap] Could not navigate: data-venue-id missing or empty on tapped card:", targetCard);
             }
             // Reset transforms immediately if it was a tap and not a drag
              venueWrapper.style.transform = `translateX(0px)`;
              chooseWrapper.style.transform = `translateX(0px)`;

         } else if (isDragging) {
             console.log("[Swipe] Swipe end processing.");
             const threshold = cardWidth / 3; // Adjust threshold as needed
             let newIndex = currentVenueIndex;

             if (diffX < -threshold && currentVenueIndex < fetchedVenueData.length - 1) {
                 newIndex++; // Swipe left, go to next
                 console.log("Swipe Left detected.");
             } else if (diffX > threshold && currentVenueIndex > 0) {
                 newIndex--; // Swipe right, go to previous
                 console.log("Swipe Right detected.");
             } else {
                  console.log("Swipe threshold not met.");
             }

             // Animate snapping back or to the new card
             venueWrapper.style.transition = "transform 0.3s ease-out";
             chooseWrapper.style.transition = "transform 0.3s ease-out";
             venueWrapper.style.transform = `translateX(0px)`; // Snap back visually
             chooseWrapper.style.transform = `translateX(0px)`; // Snap back visually

             // Use timeout to remove transition *after* animation finishes
             setTimeout(() => {
                 venueWrapper.style.transition = "";
                 chooseWrapper.style.transition = "";
             }, 300);

             // Update content ONLY if index actually changed
             if (newIndex !== currentVenueIndex) {
                 console.log(`Index changed from ${currentVenueIndex} to ${newIndex}`);
                 currentVenueIndex = newIndex;
                 displayVenue(currentVenueIndex); // Update card visuals, map, dots for the new index
             }
         } else {
              // Not a tap, not a swipe that met threshold - just snap back
               console.log("Pointer up, but neither tap nor swipe threshold met. Snapping back.");
               venueWrapper.style.transition = "transform 0.3s ease-out";
               chooseWrapper.style.transition = "transform 0.3s ease-out";
               venueWrapper.style.transform = `translateX(0px)`;
               chooseWrapper.style.transform = `translateX(0px)`;
               setTimeout(() => {
                   venueWrapper.style.transition = "";
                   chooseWrapper.style.transition = "";
               }, 300);
         }

         // Reset state variables for the next interaction
         isDragging = false;
         startX = null; // Use null to indicate no active interaction
         startY = null;
         diffX = 0;
         touchStartTime = 0;
     };


     // --- Attach Event Listeners ---
     console.log("Attaching pointer/mouse/touch listeners ONCE to swiper cards.");
      [venueCard, chooseVenueCard].forEach(card => {
          // Use pointer events if available, fallback to mouse/touch
           if (window.PointerEvent) {
               console.log("Using Pointer Events");
               card.addEventListener('pointerdown', handlePointerStart);
               // Attach move/up listeners to the document to handle dragging outside the element
           } else {
                console.log("Using Mouse/Touch Events");
                card.addEventListener('mousedown', handlePointerStart);
                card.addEventListener('touchstart', handlePointerStart, { passive: true }); // Passive for touchstart often recommended
           }
          // touchend/cancel always on the element itself
          card.addEventListener('touchend', handlePointerEnd);
          card.addEventListener('touchcancel', handlePointerEnd); // Handle cancellation (e.g., system interruption)
      });

       // Attach move and end listeners to the document for better drag handling
       if (window.PointerEvent) {
           document.addEventListener('pointermove', handlePointerMove);
           document.addEventListener('pointerup', handlePointerEnd);
           document.addEventListener('pointercancel', handlePointerEnd); // Handle pointer cancel
       } else {
           document.addEventListener('mousemove', handlePointerMove);
           document.addEventListener('mouseup', handlePointerEnd);
           // Touch move needs to be non-passive if preventDefault is called
           document.addEventListener('touchmove', handlePointerMove, { passive: false });
           // mouseleave on document isn't standard for ending drag, rely on mouseup
       }


     // --- Initial Swiper Setup ---
     setupCardWidth(); // Calculate initial width
     generateDots();   // Create dots based on fetched data
     displayVenue(currentVenueIndex); // Display the first venue

     // --- Resize Handler ---
     window.addEventListener("resize", () => {
         setupCardWidth(); // Recalculate card width on resize
         updateDots(currentVenueIndex); // Recalculate dot positions
         // Invalidate map size on resize after a short delay
         if (venueMapInstance) {
            setTimeout(() => {
                 try { venueMapInstance.invalidateSize(); } catch(e) { console.error("Error invalidating map size on resize:", e); }
             }, 150);
         }
     });

} // End of setupSwiperInteractions


// =========================================================================
// == Checklist Logic =====================================================
// =========================================================================
function setupChecklist() {
    console.log("Initializing Checklist...");
    const checklistKey = "interactiveChecklistState";
    const checklistItems = document.querySelectorAll('.interactive-checklist input[type="checkbox"]');
    if (checklistItems.length > 0) {
        console.log(`Found ${checklistItems.length} checklist items.`);
        function saveChecklistState() {
             const state = {};
             checklistItems.forEach((item) => {
                  if (item.id) { // Only save if item has an ID
                      state[item.id] = item.checked;
                  }
             });
             try {
                 localStorage.setItem(checklistKey, JSON.stringify(state));
                 console.log("Checklist state saved."); // Log success
             } catch (e) {
                 console.error("Error saving checklist state to localStorage:", e);
             }
         }
        function loadChecklistState() {
             const savedState = localStorage.getItem(checklistKey);
             if (savedState) {
                 console.log("Loading checklist state from localStorage.");
                 try {
                     const state = JSON.parse(savedState);
                     checklistItems.forEach((item) => {
                         // Check if item has ID and if that ID exists in the saved state
                         if (item.id && state[item.id] !== undefined) {
                             item.checked = state[item.id];
                         }
                     });
                 } catch (e) {
                     console.error("Error parsing checklist state from localStorage:", e);
                     localStorage.removeItem(checklistKey); // Remove invalid data
                 }
             } else {
                 console.log("No saved checklist state found.");
             }
         }
        // Add change listener to each checkbox
        checklistItems.forEach((item) => {
            item.addEventListener("change", saveChecklistState);
        });
        // Load initial state when the page loads
        loadChecklistState();
    } else {
        console.warn("No checklist items (.interactive-checklist input[type='checkbox']) found.");
    }
}
