
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
const FIXED_SONG_PATH = './assets/Fifty Fifty - Cupid (Twin Version).mp3'; // Your fixed song
const PLACEHOLDER_VENUE_IMAGE = './assets/placeholder-building.jpg';
// Use album art corresponding to FIXED_SONG_PATH in HTML initially
// const FIXED_ALBUM_ART_PATH = './assets/hq720 (1).jpg'; // Or get from HTML default

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
    // Allow 0 as a valid ID, but check for null/undefined/empty string
    if (venueId === null || venueId === undefined || venueId === '') {
        console.warn("[Nav] Cannot navigate: venueId is missing or invalid:", venueId);
        return;
    }
    const targetUrl = `${VENUE_DETAIL_BASE_PATH}?id=${venueId}`;
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
            const data = rawData.results || rawData;
            if (!Array.isArray(data)) {
                console.warn("Fetched venue data is not an array, resetting.", data);
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
        fetchedVenueData = [];
        const swiperSection = document.getElementById("venue-details-card")?.parentElement;
        if (swiperSection) swiperSection.innerHTML = `<p class="error-message">Error loading venues: ${error.message}</p>`;
        // Reset map if fetch fails
         const venueMapContainer = document.getElementById("venue-map");
         if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Venue data unavailable.</p>";
    }
}

// =========================================================================
// == FIXED Music Player Initialization & Controls =========================
// =========================================================================
function initializeFixedPlayer() {
    console.log("Initializing Fixed Music Player...");
    const audioPlayer = document.getElementById("audio-player");
    const playPauseBtn = document.getElementById("play-pause-btn");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const progressContainer = document.getElementById("progress-container");
    const volumeSlider = document.getElementById("volume-slider");
    const totalTimeEl = document.getElementById("total-time");
    const albumArt = document.querySelector(".music-player .album-art");

    if (!audioPlayer || !playPauseBtn || !prevBtn || !nextBtn || !progressContainer || !volumeSlider || !totalTimeEl || !albumArt) {
        console.warn("Fixed player init failed: One or more elements missing.");
        return;
    }

    // Set the fixed source ONLY if it's not already set (to avoid reloading on potential HMR)
    if (audioPlayer.src !== new URL(FIXED_SONG_PATH, window.location.href).href) {
         console.log("Setting fixed audio source:", FIXED_SONG_PATH);
         audioPlayer.src = FIXED_SONG_PATH;
         // Metadata (title, artist, art) should ideally be set in HTML defaults
         // Or you can set them here if needed
         // document.getElementById("track-title").textContent = "Cupid (Twin Ver.)";
         // document.getElementById("artist-name").textContent = "FIFTY FIFTY";
         // albumArt.src = FIXED_ALBUM_ART_PATH; // If needed
    } else {
         console.log("Fixed audio source already set.");
    }


    // --- Event Listeners for Fixed Player ---
    audioPlayer.addEventListener("loadedmetadata", () => {
        console.log("Fixed song metadata loaded.");
        if (totalTimeEl && audioPlayer.duration && !isNaN(audioPlayer.duration)) {
            totalTimeEl.textContent = formatTime(audioPlayer.duration);
        }
        updatePlayPauseIconState(); // Update icon based on initial state
    });

     audioPlayer.addEventListener("error", (e) => {
         console.error("Fixed Audio Player Error:", e.target.error?.message || 'Unknown error', e);
         totalTimeEl.textContent = "Error";
         document.getElementById("progress").style.width = "0%";
         document.getElementById("current-time").textContent = "0:00";
         updatePlayPauseIconState();
     });


    function togglePlayPause() {
        // Check if src is set (it should be after init)
        if (!audioPlayer.src) {
            console.warn("Cannot play: Fixed audio source not set.");
            // Optionally try setting it again
            // audioPlayer.src = FIXED_SONG_PATH;
            // audioPlayer.load();
            return;
        }
        if (audioPlayer.paused) {
            audioPlayer.play().catch(e => console.error("Audio play failed:", e));
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
             const progress = document.getElementById("progress"); if (progress) progress.style.width = "0%";
             const currentTimeEl = document.getElementById("current-time"); if (currentTimeEl) currentTimeEl.textContent = "0:00";
         }
     }

    function seek(event) {
         if (!audioPlayer.duration || isNaN(audioPlayer.duration) || audioPlayer.duration <= 0) return;
         const progressBar = progressContainer.querySelector('.progress-bar'); if (!progressBar) return;
         const rect = progressBar.getBoundingClientRect(); const offsetX = event.clientX - rect.left; const barWidth = progressBar.clientWidth;
         const seekRatio = Math.max(0, Math.min(1, offsetX / barWidth)); audioPlayer.currentTime = seekRatio * audioPlayer.duration; updateProgress();
     }

    function changeVolume() { if (volumeSlider) audioPlayer.volume = Math.max(0, Math.min(1, volumeSlider.value / 100)); }

    function restartSong() {
         if (!audioPlayer.src || isNaN(audioPlayer.duration)) return; audioPlayer.currentTime = 0;
         if (audioPlayer.paused) updateProgress(); else audioPlayer.play().catch(e => console.error("Audio play failed on restart:", e));
     }

    // --- Attach Listeners ---
    playPauseBtn.addEventListener("click", togglePlayPause);
    audioPlayer.addEventListener("timeupdate", updateProgress);
    audioPlayer.addEventListener("play", updatePlayPauseIconState);
    audioPlayer.addEventListener("pause", updatePlayPauseIconState);
    audioPlayer.addEventListener("ended", restartSong); // Loop the fixed song
    progressContainer.addEventListener("click", seek);
    volumeSlider.addEventListener("input", changeVolume);
    prevBtn.addEventListener("click", restartSong); // Prev button restarts
    nextBtn.addEventListener("click", restartSong); // Next button also restarts (placeholder)

    changeVolume(); // Set initial volume from slider value
    updatePlayPauseIconState(); // Set initial icon state
    console.log("Fixed Music Player Controls Initialized.");
}


// =========================================================================
// == DOMContentLoaded Event Listener (Main Execution Block)
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM loaded. Starting initialization...");

    // 1. Initialize the *fixed* player immediately
    initializeFixedPlayer();

    // 2. Fetch venue data
    console.log("Fetching initial venue data...");
    try {
        await fetchVenues();
        console.log("Venue data fetching complete.");
    } catch (error) {
        console.error("Error during initial venue data fetch:", error);
        // Error message already shown by fetchVenues
    }

    // 3. Setup swiper and map *after* fetching data
    setupSwiperInteractions();
    setupLeafletMap(); // Separate function for map setup

    // 4. Setup other UI elements (Checklist, Countdown)
    setupChecklist();
    setupCountdownTimer();

    // 5. Remove global plan switcher logic
    console.log("Removing global plan switcher button logic.");
    const planSwitcherPlaceholder = document.getElementById('plan-switcher-placeholder');
    if (planSwitcherPlaceholder) {
        planSwitcherPlaceholder.innerHTML = '';
        planSwitcherPlaceholder.style.display = 'none';
    }

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
             const initialCoords = firstVenue?.latitude != null && firstVenue?.longitude != null ? [firstVenue.latitude, firstVenue.longitude] : [42.8749, 74.6049]; // Default fallback coords
             console.log("Initializing map at coords:", initialCoords);
             venueMapInstance = L.map(venueMapContainer, { zoomControl: false, attributionControl: false }).setView(initialCoords, MAP_ZOOM_LEVEL);
             L.control.zoom({ position: "bottomright" }).addTo(venueMapInstance);
             L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(venueMapInstance);
             venueMarker = L.marker(initialCoords).addTo(venueMapInstance);
             if (firstVenue?.name) {
                 venueMarker.bindPopup(`<b>${firstVenue.name}</b>`).openPopup();
                 setTimeout(() => venueMarker?.closePopup(), 2500); // Close popup after delay
             }
             setTimeout(() => { if (venueMapInstance) { console.log("Invalidating map size."); venueMapInstance.invalidateSize(); } }, 300); // Increased delay slightly
         } catch (error) {
             console.error("Error initializing Leaflet map:", error);
             if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Error loading map.</p>";
         }
     } else {
         console.warn("Map init skipped: No venue data fetched.");
         if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>No venues for map.</p>";
     }
}

// =========================================================================
// == Venue Swiper Logic (Setup Function) =================================
// =========================================================================
function setupSwiperInteractions() {
    console.log("Initializing Venue Swiper...");
    const venueCard = document.getElementById("venue-details-card");
    const chooseVenueCard = document.getElementById("choose-venue-card");

    if (!venueCard || !chooseVenueCard) { console.warn("Swiper base card elements missing."); return; }

    if (fetchedVenueData.length === 0) {
        console.warn("Swiper setup skipped: No venue data.");
        if(venueCard) venueCard.innerHTML = '<p class="info-message">No venues available.</p>';
        if(chooseVenueCard) chooseVenueCard.style.display = 'none';
        document.querySelectorAll(".dots").forEach(dots => dots.style.display = 'none');
        return;
    }

     console.log("Venue data found, setting up swiper interactions.");
     const venueWrapper = venueCard.querySelector(".card-content-wrapper");
     const chooseWrapper = chooseVenueCard.querySelector(".card-content-wrapper");
     const allDotsInnerContainers = document.querySelectorAll(".dots-inner");

     if (!venueWrapper || !chooseWrapper || allDotsInnerContainers.length < 2) {
         console.error("Swiper setup failed: Inner elements or dots containers missing."); return;
     }

     console.log("Swiper inner wrappers and dots containers found.");

     // --- Swiper Helper Functions ---
     function setupCardWidth() { cardWidth = venueCard.offsetWidth || 220; }
     function generateDots() { allDotsInnerContainers.forEach((di) => { if (di) { di.innerHTML = ""; fetchedVenueData.forEach(() => di.appendChild(document.createElement("span"))); } }); }
     function updateDots(activeIndex) { if (activeIndex < 0 || activeIndex >= fetchedVenueData.length) return; allDotsInnerContainers.forEach((di) => { if (!di) return; const dots = di.querySelectorAll("span"); const dc = di.parentElement; if (!dc || !dots.length) return; dots.forEach((d, i) => d.classList.toggle("active", i === activeIndex)); const dw = (DOT_WIDTH + DOT_MARGIN * 2), cw = dc.offsetWidth, tw = dots.length * dw, aco = activeIndex * dw + dw / 2, tx = cw / 2 - aco; if (tw > cw) { di.style.transform = `translateX(${Math.max(cw - tw, Math.min(0, tx))}px)`; } else { di.style.transform = `translateX(${(cw - tw) / 2}px)`; } }); }
     function updateVenueMap(lat, lng, venueName) { if (!venueMapInstance || !venueMarker) return; if (typeof lat === "number" && typeof lng === "number") { const ll = L.latLng(lat, lng); venueMapInstance.setView(ll, MAP_ZOOM_LEVEL, { animate: true, pan: { duration: 0.5 } }); venueMarker.setLatLng(ll); if (venueName) venueMarker.setPopupContent(`<b>${venueName}</b>`); setTimeout(() => venueMapInstance?.invalidateSize(), 150); } else { console.warn(`Map update skipped: Invalid coords for ${venueName}`); } }

     // --- Display Venue Function (Updates card UI, map, dots - NO player update) ---
     function displayVenue(index) {
         if (index < 0 || index >= fetchedVenueData.length) { console.warn(`Invalid venue index: ${index}`); return; }
         const venueData = fetchedVenueData[index];
         const currentVenueId = venueData.id;
         console.log(`Displaying venue index: ${index}, ID: ${currentVenueId}, Name: ${venueData?.name}`);

         // Set data-venue-id for tap navigation
         venueCard.setAttribute('data-venue-id', currentVenueId ?? '');
         chooseVenueCard.setAttribute('data-venue-id', currentVenueId ?? '');

         // Update Card Visuals
         venueWrapper.querySelector(".venue-name").textContent = venueData.name || "Venue";
         venueWrapper.querySelector(".venue-date").textContent = venueData.date_text || "--";
         venueCard.style.backgroundImage = venueData.image_url ? `url('${venueData.image_url}')` : `url('${PLACEHOLDER_VENUE_IMAGE}')`;
         const imgTest = new Image();
         imgTest.onerror = () => { if(venueCard.style.backgroundImage !== 'none') { console.warn(`Venue card BG failed: ${venueData.image_url}`); venueCard.style.backgroundImage = 'none'; venueCard.style.backgroundColor = 'var(--secondary-color)';}};
         if(venueData.image_url) imgTest.src = venueData.image_url; else venueCard.style.backgroundColor = 'var(--secondary-color)';

         chooseWrapper.querySelector(".venue-header").textContent = venueData.rating_text || "Details";
         const ratingEl = chooseWrapper.querySelector(".rating");
         if (ratingEl) { const rVal = Math.round(venueData.rating_stars || 0); ratingEl.innerHTML = '<span class="filled">' + '★'.repeat(rVal) + '</span>' + '☆'.repeat(5 - rVal); }
         const iconsContainer = chooseWrapper.querySelector(".venue-icons");
         if (iconsContainer) { let iconsHTML = ''; if (venueData.venue_icon1) iconsHTML += `<span class="venue-icon-1">${venueData.venue_icon1}</span>`; if (venueData.venue_icon2) iconsHTML += ` <span class="venue-icon-2">${venueData.venue_icon2}</span>`; iconsContainer.innerHTML = iconsHTML; }

         // Update Map & Dots
         updateVenueMap(venueData.latitude, venueData.longitude, venueData.name);
         updateDots(index);

         // --- Player update REMOVED from here ---
     }

     // --- Event Handlers ---
     const handlePointerStart = (e) => {
         if (e.target.closest("button, input, a, .dots, .leaflet-container")) return;
         isDragging = false; startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX; startY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY; currentX = startX; diffX = 0; touchStartTime = Date.now(); cardWidth = venueCard.offsetWidth; venueWrapper.classList.add("is-swiping"); chooseWrapper.classList.add("is-swiping");
     };
     const handlePointerMove = (e) => {
         if (startX === null) return;
         currentX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
         const currentY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
         diffX = currentX - startX; const diffY = currentY - startY;
         if (!isDragging) { if (Math.abs(diffY) > TAP_THRESHOLD_Y && Math.abs(diffY) > Math.abs(diffX) * 1.5) { startX = null; venueWrapper.classList.remove("is-swiping"); chooseWrapper.classList.remove("is-swiping"); return; } if (Math.abs(diffX) > TAP_THRESHOLD_X) { isDragging = true; } }
         if (isDragging) { venueWrapper.style.transform = `translateX(${diffX}px)`; chooseWrapper.style.transform = `translateX(${diffX}px)`; if (e.cancelable && e.type.includes("touch")) e.preventDefault(); }
     };
     const handlePointerEnd = (e) => {
         if (startX === null) return;
         const touchDuration = Date.now() - touchStartTime;
         const endY = e.type.includes("mouse") ? e.clientY : e.changedTouches[0].clientY;
         const finalDiffY = endY - startY;
         // Check tap conditions carefully
         const isTap = !isDragging && touchDuration < MAX_TAP_DURATION && Math.abs(diffX) < TAP_THRESHOLD_X && Math.abs(finalDiffY) < TAP_THRESHOLD_Y;
         console.log(`Pointer end. Drag: ${isDragging}, Dur: ${touchDuration}ms, dx: ${diffX.toFixed(0)}, dy: ${finalDiffY.toFixed(0)}, Tap: ${isTap}`);

         if (isTap) {
             console.log("[Tap] Tap detected on card!");
             const targetCard = e.currentTarget; // The card element itself
             const venueId = targetCard.getAttribute('data-venue-id');
             console.log("[Tap] Extracted Venue ID:", venueId);
             if (venueId !== null && venueId !== undefined) { // Check if ID exists
                 navigateToVenueDetail(venueId); // <<< NAVIGATION CALL
             } else {
                 console.warn("[Tap] Could not navigate because data-venue-id was missing or empty on the tapped card:", targetCard);
             }
             // No swipe logic needed if it was a tap
         } else if (isDragging) {
             console.log("[Swipe] Swipe end processing.");
             const threshold = cardWidth / 3; let newIndex = currentVenueIndex;
             if (diffX < -threshold && currentVenueIndex < fetchedVenueData.length - 1) { newIndex++; }
             else if (diffX > threshold && currentVenueIndex > 0) { newIndex--; }

             // Snap back animation
             venueWrapper.style.transition = "transform 0.3s ease-out"; chooseWrapper.style.transition = "transform 0.3s ease-out";
             venueWrapper.style.transform = `translateX(0px)`; chooseWrapper.style.transform = `translateX(0px)`;
             setTimeout(() => { venueWrapper.style.transition = ""; chooseWrapper.style.transition = ""; }, 300);

             // Update content ONLY if index changed
             if (newIndex !== currentVenueIndex) {
                 currentVenueIndex = newIndex;
                 displayVenue(currentVenueIndex); // Update card visuals, map, dots
             }
         } else { // Not a tap, not a swipe - just snap back
             venueWrapper.style.transition = "transform 0.3s ease-out"; chooseWrapper.style.transition = "transform 0.3s ease-out";
             venueWrapper.style.transform = `translateX(0px)`; chooseWrapper.style.transform = `translateX(0px)`;
             setTimeout(() => { venueWrapper.style.transition = ""; chooseWrapper.style.transition = ""; }, 300);
         }
         // Reset state for next interaction
         isDragging = false; startX = null; startY = null; diffX = 0; touchStartTime = 0;
         venueWrapper.classList.remove("is-swiping"); chooseWrapper.classList.remove("is-swiping");
     };


     // --- Attach Event Listeners ---
     console.log("Attaching pointer/mouse/touch listeners ONCE to swiper cards.");
     [venueCard, chooseVenueCard].forEach(card => {
         card.addEventListener("touchstart", handlePointerStart, { passive: true });
         card.addEventListener("touchmove", handlePointerMove, { passive: false });
         card.addEventListener("touchend", handlePointerEnd);
         card.addEventListener("touchcancel", handlePointerEnd);
         card.addEventListener("mousedown", handlePointerStart);
     });
     document.addEventListener("mousemove", handlePointerMove);
     document.addEventListener("mouseup", handlePointerEnd);
     document.addEventListener("mouseleave", handlePointerEnd);

     // --- Initial Swiper Setup ---
     setupCardWidth();
     generateDots();
     // Display the first venue; player is initialized separately now
     displayVenue(currentVenueIndex);

     // --- Resize Handler ---
     window.addEventListener("resize", () => {
         setupCardWidth(); updateDots(currentVenueIndex);
         if (venueMapInstance) setTimeout(() => venueMapInstance.invalidateSize(), 150);
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
        function saveChecklistState() { const state = {}; checklistItems.forEach((item) => { if (item.id) state[item.id] = item.checked; }); try { localStorage.setItem(checklistKey, JSON.stringify(state)); } catch (e) { console.error("Error saving checklist state:", e); } }
        function loadChecklistState() { const savedState = localStorage.getItem(checklistKey); if (savedState) { console.log("Loading checklist state."); try { const state = JSON.parse(savedState); checklistItems.forEach((item) => { if (item.id && state[item.id] !== undefined) item.checked = state[item.id]; }); } catch (e) { console.error("Error parsing checklist state:", e); localStorage.removeItem(checklistKey); } } else { console.log("No saved checklist state."); } }
        checklistItems.forEach((item) => { item.addEventListener("change", saveChecklistState); });
        loadChecklistState();
    } else { console.warn("No checklist items found."); }
}

