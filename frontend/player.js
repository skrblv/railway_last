// =========================================================================
// == frontend/player.js -- Complete Code with DETAILED DEBUG LOGS
// =========================================================================

// =========================================================================
// == Global Variables & Configuration
// =========================================================================

// --- Data Storage ---
let fetchedVenueData = []; // Will be filled by API call
let fetchedPlanData = []; // Will be filled by API call
let currentVenueIndex = 0; // Track the currently displayed venue in the swiper
let currentPlan = null; // Track the currently active plan (theme/music)

// --- Constants ---
const DOT_WIDTH = 8; // px - For swiper dots calculation
const DOT_MARGIN = 4; // px - For swiper dots calculation
const MAP_ZOOM_LEVEL = 15; // Default zoom level for the venue map
const API_BASE_URL = "/api"; // !!! ADAPT THIS: Your backend API base URL

// !!! CRITICAL CONFIGURATION: Set this to match your backend URL pattern !!!
// Examples: '/venue', '/venues', '/place', '/location'
const VENUE_DETAIL_BASE_PATH = '/venue'; // <<<--- CHECK AND CHANGE THIS PATH IF NEEDED

const PLACEHOLDER_VENUE_IMAGE = './assets/placeholder-building.jpg'; // !!! ADAPT THIS: Fallback image for venues
const PLACEHOLDER_ALBUM_ART = './assets/hq720 (1).jpg'; // !!! ADAPT THIS: Fallback image for album art

// --- Leaflet Map Variables ---
let venueMapInstance = null; // Holds the Leaflet map instance
let venueMarker = null; // Holds the Leaflet marker instance

// =========================================================================
// == API Fetching Functions
// =========================================================================

/**
 * Fetches the list of venues from the backend API.
 */
async function fetchVenues() {
  console.log("[DEBUG fetchVenues] Attempting to fetch venues...");
  try {
    const response = await fetch(`${API_BASE_URL}/venues/`); // Assumes /api/venues/ endpoint
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const rawData = await response.json();
       console.log("[DEBUG fetchVenues] Raw data received:", rawData);
      if (!Array.isArray(rawData)) {
           console.warn("[DEBUG fetchVenues] Fetched venue data is not an array, resetting.", rawData);
           fetchedVenueData = [];
      } else {
          // Quick check for IDs in the fetched data
          if (rawData.length > 0 && (rawData[0].id === undefined || rawData[0].id === null)) {
              console.warn("[DEBUG fetchVenues] First venue in fetched data is missing 'id' property!", rawData[0]);
          }
          fetchedVenueData = rawData;
          console.log("[DEBUG fetchVenues] Successfully fetched and parsed venues:", fetchedVenueData.length, "items");
      }
    } else {
      const textResponse = await response.text();
      throw new Error(`Expected JSON, but received ${contentType}. Response: ${textResponse}`);
    }
  } catch (error) {
    console.error("[DEBUG fetchVenues] Could not fetch venues:", error);
    fetchedVenueData = []; // Ensure it's an empty array on error
    const swiperSection = document.getElementById("venue-details-card")?.parentElement;
     if(swiperSection) swiperSection.innerHTML = `<p class="error-message">Error loading venues: ${error.message}</p>`;
  }
}

/**
 * Fetches the list of plans (themes/music) from the backend API.
 */
async function fetchPlans() {
    console.log("[DEBUG fetchPlans] Attempting to fetch plans...");
  try {
    const response = await fetch(`${API_BASE_URL}/plans/`); // Assumes /api/plans/ endpoint
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      fetchedPlanData = await response.json();
      console.log("[DEBUG fetchPlans] Fetched Plans:", fetchedPlanData);
       if (!Array.isArray(fetchedPlanData)) {
           console.warn("[DEBUG fetchPlans] Fetched plan data is not an array, resetting.", fetchedPlanData);
           fetchedPlanData = [];
      }
      if (fetchedPlanData.length > 0) {
        currentPlan =
          fetchedPlanData.find((p) => p.name?.toLowerCase() === "plan a") || fetchedPlanData[0];
        console.log("[DEBUG fetchPlans] Initial plan set to:", currentPlan?.name || 'First Plan');
        applyPlan(currentPlan);
      } else {
          console.log("[DEBUG fetchPlans] No plans fetched or plans array is empty.");
          applyPlan(null); // Reset theme/player
      }
    } else {
      const textResponse = await response.text();
      throw new Error(`Expected JSON, but received ${contentType}. Response: ${textResponse}`);
    }
  } catch (error) {
    console.error("[DEBUG fetchPlans] Could not fetch plans:", error);
    fetchedPlanData = [];
    applyPlan(null); // Reset on error
  }
}

// =========================================================================
// == Plan Application Function
// =========================================================================

/**
 * Applies a specific plan's theme and updates the music player.
 * @param {object | null} plan - The plan object to apply, or null to reset.
 */
function applyPlan(plan) {
  const body = document.body;
  const musicPlayer = document.querySelector(".music-player");
  const audioPlayer = document.getElementById("audio-player");
  const albumArt = musicPlayer?.querySelector(".album-art img");
  const trackTitleEl = musicPlayer?.querySelector("#track-title");
  const artistNameEl = musicPlayer?.querySelector("#artist-name");
  const progress = document.getElementById("progress");
  const currentTimeEl = document.getElementById("current-time");
  const totalTimeEl = document.getElementById("total-time");
  const playPauseIcon = document.getElementById("play-pause-icon");
  const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M8 5v14l11-7z"/></svg>`;

  if (!plan) {
    console.log("[DEBUG applyPlan] Applying default state (no plan or reset).");
    currentPlan = null;
    body.classList.remove("theme-positive", "theme-sad");
    if (audioPlayer) {
        if (!audioPlayer.paused) audioPlayer.pause();
        audioPlayer.src = "";
    }
     if (albumArt) { albumArt.src = PLACEHOLDER_ALBUM_ART; albumArt.alt = "Album Art"; }
    if (trackTitleEl) trackTitleEl.textContent = "Track Title";
    if (artistNameEl) artistNameEl.textContent = "Artist Name";
    if (progress) progress.style.width = "0%";
    if (currentTimeEl) currentTimeEl.textContent = "0:00";
    if (totalTimeEl) totalTimeEl.textContent = "0:00";
    if (playPauseIcon) playPauseIcon.innerHTML = playIconSvg;
    if(audioPlayer) {
        audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad);
        audioPlayer.removeEventListener("error", handleAudioError);
    }
    return;
  }

  console.log(`[DEBUG applyPlan] Applying Plan: ${plan.name || `(ID: ${plan.id})`}`);
  currentPlan = plan;

  body.classList.remove("theme-positive", "theme-sad");
  if (plan.theme === "positive") { body.classList.add("theme-positive"); }
  else if (plan.theme === "sad") { body.classList.add("theme-sad"); }
  else { console.warn(`[DEBUG applyPlan] Plan '${plan.name}' has unknown theme:`, plan.theme); }

  if (!musicPlayer || !audioPlayer) { console.warn("[DEBUG applyPlan] Music player elements missing."); return; }

  let wasPlaying = !audioPlayer.paused && audioPlayer.currentTime > 0;

  if (plan.song_url && audioPlayer.currentSrc !== plan.song_url) {
    console.log("[DEBUG applyPlan] Setting new audio source:", plan.song_url);
    audioPlayer.src = plan.song_url;
    audioPlayer.load();
  } else if (!plan.song_url) {
    console.warn(`[DEBUG applyPlan] Plan "${plan.name}" has no song_url.`);
    if (!audioPlayer.paused) audioPlayer.pause();
    audioPlayer.src = "";
    wasPlaying = false;
  } else { console.log("[DEBUG applyPlan] Audio source is the same."); }

  if (albumArt) { albumArt.src = plan.album_art_url || PLACEHOLDER_ALBUM_ART; albumArt.alt = plan.track_title || "Album Art"; }
  if (trackTitleEl) trackTitleEl.textContent = plan.track_title || "Unknown Track";
  if (artistNameEl) artistNameEl.textContent = plan.artist_name || "Unknown Artist";
  if (progress) progress.style.width = "0%";
  if (currentTimeEl) currentTimeEl.textContent = "0:00";
  if (totalTimeEl) totalTimeEl.textContent = "0:00";
  if (playPauseIcon && audioPlayer.paused) playPauseIcon.innerHTML = playIconSvg;

  audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad);
  audioPlayer.removeEventListener("error", handleAudioError);
  // Pass wasPlaying intent to the metadata handler
  const metadataHandler = () => handleMetadataLoad(wasPlaying, plan.song_url);
  audioPlayer.addEventListener("loadedmetadata", metadataHandler, { once: true });
  audioPlayer.addEventListener("error", handleAudioError, { once: true });

} // --- End applyPlan ---

/**
 * Handles the 'loadedmetadata' event for the audio player.
 * @param {boolean} shouldResume - Whether playback should attempt to resume.
 * @param {string | null} songUrl - The URL of the song that loaded (for checks).
 */
const handleMetadataLoad = (shouldResume, songUrl) => {
    const totalTimeEl = document.getElementById("total-time");
    const audioPlayer = document.getElementById("audio-player");
    console.log("[DEBUG handleMetadataLoad] Metadata loaded.");

    if (totalTimeEl && audioPlayer?.duration && !isNaN(audioPlayer.duration)) {
        console.log(`[DEBUG handleMetadataLoad] Duration: ${audioPlayer.duration}`);
        totalTimeEl.textContent = formatTime(audioPlayer.duration);
    } else if (totalTimeEl) {
        totalTimeEl.textContent = "0:00";
    }

    if (shouldResume && songUrl && audioPlayer?.paused) {
        console.log("[DEBUG handleMetadataLoad] Attempting to resume playback...");
        audioPlayer.play().catch(e => console.error("[DEBUG handleMetadataLoad] Audio play failed:", e));
    } else if (audioPlayer && !audioPlayer.paused) {
        console.log("[DEBUG handleMetadataLoad] Audio already playing or should not resume.");
        updatePlayPauseIconState(); // Ensure pause icon is shown if playing
    } else {
        console.log("[DEBUG handleMetadataLoad] Not resuming playback.");
        updatePlayPauseIconState(); // Ensure play icon is shown if paused
    }
};

/**
 * Handles the 'error' event for the audio player.
 * @param {Event} e - The error event object.
 */
const handleAudioError = (e) => {
    console.error("[DEBUG handleAudioError] Audio Player Error:", e.target.error?.message || 'Unknown error', e);
    const totalTimeEl = document.getElementById("total-time");
    const progress = document.getElementById("progress");
    const currentTimeEl = document.getElementById("current-time");
    if (totalTimeEl) totalTimeEl.textContent = "Error";
    if (progress) progress.style.width = "0%";
    if (currentTimeEl) currentTimeEl.textContent = "0:00";
     updatePlayPauseIconState(); // Show play icon on error
};


// =========================================================================
// == Helper Functions
// =========================================================================

function formatTime(seconds) { /* ... (keep existing implementation) ... */
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
}
function padZero(num) { /* ... (keep existing implementation) ... */
    return num < 10 ? "0" + num : num;
}
function updatePlayPauseIconState() { /* ... (keep existing implementation) ... */
    const audioPlayer = document.getElementById("audio-player");
    const playPauseBtn = document.getElementById("play-pause-btn");
    const playPauseIcon = document.getElementById("play-pause-icon");
    if (!audioPlayer || !playPauseBtn || !playPauseIcon) return;
    const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M8 5v14l11-7z"/></svg>`;
    const pauseIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    const isPlaying = !audioPlayer.paused && audioPlayer.readyState > 0;
    playPauseIcon.innerHTML = isPlaying ? pauseIconSvg : playIconSvg;
    playPauseBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
}


// =========================================================================
// == DOMContentLoaded Event Listener (Main Execution Block)
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DEBUG: DOM loaded. Starting initialization...");

  // --- Fetch data FIRST ---
  console.log("DEBUG: Fetching initial venue and plan data...");
  try {
      await Promise.all([ fetchVenues(), fetchPlans() ]);
      console.log("DEBUG: Initial data fetching complete.");
  } catch (error) { console.error("DEBUG: Error during initial data fetch:", error); }


  // =========================================================================
  // == MUSIC PLAYER LOGIC (Event Listeners & Core Controls)
  // =========================================================================
  console.log("DEBUG: Initializing Music Player...");
  const audioPlayer = document.getElementById("audio-player");
  const playPauseBtn = document.getElementById("play-pause-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const progressContainer = document.getElementById("progress-container");
  const progress = document.getElementById("progress");
  const currentTimeEl = document.getElementById("current-time");
  const totalTimeEl = document.getElementById("total-time");
  const volumeSlider = document.getElementById("volume-slider");

  if (audioPlayer && playPauseBtn && prevBtn && nextBtn && progressContainer && progress && currentTimeEl && totalTimeEl && volumeSlider) {
    console.log("DEBUG: Music player elements found. Attaching listeners.");

    function togglePlayPause() { /* ... (keep existing implementation, ensure updatePlayPauseIconState is called/event triggers it) ... */
        if (!audioPlayer.src && currentPlan?.song_url) {
            console.log("[DEBUG togglePlayPause] No audio source, attempting to load and play from current plan.");
            // Set intent for handleMetadataLoad
            const playIntentHandler = () => handleMetadataLoad(true, currentPlan.song_url);
             audioPlayer.removeEventListener("loadedmetadata", playIntentHandler); // Remove previous just in case
             audioPlayer.addEventListener("loadedmetadata", playIntentHandler, { once: true });
            applyPlan(currentPlan); // Load the source
            return;
        } else if (!audioPlayer.src) {
            console.warn("[DEBUG togglePlayPause] Cannot play: No audio source set.");
            return;
        }
        if (audioPlayer.paused) {
            audioPlayer.play().catch((e) => { console.error("[DEBUG togglePlayPause] Audio play failed:", e); updatePlayPauseIconState(); });
        } else { audioPlayer.pause(); }
    }
    function updateProgress() { /* ... (keep existing implementation) ... */
        if (audioPlayer.duration && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
            const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            if (progress) progress.style.width = `${progressPercent}%`;
            if (currentTimeEl) currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
        } else {
            if (progress) progress.style.width = "0%";
            if (currentTimeEl) currentTimeEl.textContent = "0:00";
        }
    }
    function seek(event) { /* ... (keep existing implementation) ... */
        if (!audioPlayer.duration || isNaN(audioPlayer.duration) || audioPlayer.duration <= 0) { console.warn("[DEBUG seek] Cannot seek: Invalid duration."); return; }
        const rect = progressContainer.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const width = progressContainer.clientWidth;
        const seekRatio = Math.max(0, Math.min(1, clickX / width));
        audioPlayer.currentTime = seekRatio * audioPlayer.duration;
        updateProgress();
    }
    function changeVolume() { /* ... (keep existing implementation) ... */ audioPlayer.volume = Math.max(0, Math.min(1, volumeSlider.value / 100)); }
    function restartSong() { /* ... (keep existing implementation) ... */
         if (!audioPlayer.src || isNaN(audioPlayer.duration)) return;
         audioPlayer.currentTime = 0;
         if (audioPlayer.paused) { updateProgress(); }
         else { audioPlayer.play().catch((e) => console.error("[DEBUG restartSong] Audio play failed:", e)); }
    }
    function nextSong() { console.log("DEBUG: Next button clicked - placeholder action (restart)."); restartSong(); } // Placeholder

    playPauseBtn.addEventListener("click", togglePlayPause);
    audioPlayer.addEventListener("timeupdate", updateProgress);
    audioPlayer.addEventListener("play", updatePlayPauseIconState);
    audioPlayer.addEventListener("pause", updatePlayPauseIconState);
    audioPlayer.addEventListener("ended", restartSong); // Loop by default
    progressContainer.addEventListener("click", seek);
    volumeSlider.addEventListener("input", changeVolume);
    prevBtn.addEventListener("click", restartSong);
    nextBtn.addEventListener("click", nextSong);

    changeVolume(); // Init volume
    updatePlayPauseIconState(); // Init icon

  } else { console.warn("DEBUG: Music player core elements missing. Player non-functional."); }

  // =========================================================================
  // == COUNTDOWN TIMER LOGIC
  // =========================================================================
  console.log("DEBUG: Initializing Countdown Timer...");
  const datePicker = document.getElementById("event-date-picker");
  const setDateBtn = document.getElementById("set-date-btn");
  const daysNumEl = document.getElementById("days-num"); // ... (and others)
  const calDay1El = document.getElementById("cal-day-1"); // ... (and others)
  if (datePicker && setDateBtn && daysNumEl /* ... add other checks ... */) {
      console.log("DEBUG: Countdown timer elements found.");
      const localStorageKey = "targetEventDate";
      let targetDate = null;
      let countdownInterval = null;
      function updateCalendarDisplay(dateObj) { /* ... (keep existing implementation) ... */
            if (!dateObj || isNaN(dateObj.getTime())) { calDay1El.textContent = "--"; calDay2El.textContent = "--"; calDay3El.textContent = "--"; calDay1El.classList.remove("highlight"); calDay2El.classList.add("highlight"); calDay3El.classList.remove("highlight"); return; }
            const targetDay = dateObj.getUTCDate(); const prevDate = new Date(dateObj); prevDate.setUTCDate(targetDay - 1); const nextDate = new Date(dateObj); nextDate.setUTCDate(targetDay + 1); calDay1El.textContent = padZero(prevDate.getUTCDate()); calDay2El.textContent = padZero(targetDay); calDay3El.textContent = padZero(nextDate.getUTCDate()); calDay1El.classList.remove("highlight"); calDay2El.classList.add("highlight"); calDay3El.classList.remove("highlight");
      }
      function updateCountdown() { /* ... (keep existing implementation) ... */
            if (!targetDate || isNaN(targetDate.getTime())) { daysNumEl.textContent = "--"; hoursNumEl.textContent = "--"; minutesNumEl.textContent = "--"; secondsNumEl.textContent = "--"; return; }
            const now = new Date().getTime(); const difference = targetDate.getTime() - now;
            if (difference <= 0) { daysNumEl.textContent = "00"; hoursNumEl.textContent = "00"; minutesNumEl.textContent = "00"; secondsNumEl.textContent = "00"; if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; } return; }
            const days = Math.floor(difference / 86400000); const hours = Math.floor((difference % 86400000) / 3600000); const minutes = Math.floor((difference % 3600000) / 60000); const seconds = Math.floor((difference % 60000) / 1000); daysNumEl.textContent = padZero(days); hoursNumEl.textContent = padZero(hours); minutesNumEl.textContent = padZero(minutes); secondsNumEl.textContent = padZero(seconds);
      }
      function startCountdown() { /* ... (keep existing implementation) ... */
            if (countdownInterval) clearInterval(countdownInterval); if (targetDate && !isNaN(targetDate.getTime()) && targetDate.getTime() > new Date().getTime()) { updateCountdown(); countdownInterval = setInterval(updateCountdown, 1000); } else { updateCountdown(); }
      }
      function handleSetDate() { /* ... (keep existing implementation) ... */
            const selectedDateString = datePicker.value; if (!selectedDateString) { alert("Please select a date."); return; } const parts = selectedDateString.split("-"); if (parts.length !== 3) { alert("Invalid date format."); return; } const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10) - 1; const day = parseInt(parts[2], 10); if (isNaN(year) || isNaN(month) || isNaN(day)) { alert("Invalid date components."); return; } const potentialTargetDate = new Date(Date.UTC(year, month, day, 0, 0, 0)); if (isNaN(potentialTargetDate.getTime())) { alert("Invalid date selected."); return; } const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0); if (potentialTargetDate < todayUTC) { alert("Please select today or a future date."); return; } localStorage.setItem(localStorageKey, selectedDateString); targetDate = potentialTargetDate; updateCalendarDisplay(targetDate); startCountdown(); console.log("DEBUG: New target date set:", targetDate);
      }
      function loadDateFromStorage() { /* ... (keep existing implementation) ... */
            const storedDateString = localStorage.getItem(localStorageKey); if (storedDateString) { const parts = storedDateString.split("-"); if (parts.length === 3) { const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10) - 1; const day = parseInt(parts[2], 10); if (!isNaN(year) && !isNaN(month) && !isNaN(day)) { const loadedDate = new Date(Date.UTC(year, month, day, 0, 0, 0)); if (!isNaN(loadedDate.getTime())) { targetDate = loadedDate; datePicker.value = storedDateString; console.log("DEBUG: Loaded target date from storage:", targetDate); updateCalendarDisplay(targetDate); startCountdown(); return; } } } console.warn("DEBUG: Invalid date string in localStorage, removing."); localStorage.removeItem(localStorageKey); } console.log("DEBUG: No valid date in storage."); updateCalendarDisplay(null); updateCountdown();
      }
      setDateBtn.addEventListener("click", handleSetDate);
      loadDateFromStorage();
  } else { console.warn("DEBUG: Countdown timer elements missing."); }

  // =========================================================================
  // == LEAFLET MAP INITIALIZATION
  // =========================================================================
  console.log("DEBUG: Initializing Leaflet Map...");
  const venueMapContainer = document.getElementById("venue-map");
  if (venueMapContainer && typeof L !== "undefined") {
      console.log("DEBUG: Map container and Leaflet library found.");
      if (fetchedVenueData.length > 0) {
          try { /* ... (keep existing map init logic, check fallback coords) ... */
                const firstVenue = fetchedVenueData[0]; const initialCoords = firstVenue?.latitude != null && firstVenue?.longitude != null ? [firstVenue.latitude, firstVenue.longitude] : [42.8749, 74.6049]; /* <<< ADAPT FALLBACK */ console.log("DEBUG: Initializing map at coords:", initialCoords); venueMapInstance = L.map(venueMapContainer, { zoomControl: false }).setView(initialCoords, MAP_ZOOM_LEVEL); L.control.zoom({ position: "bottomright" }).addTo(venueMapInstance); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(venueMapInstance); venueMarker = L.marker(initialCoords).addTo(venueMapInstance); if (firstVenue?.name) { venueMarker.bindPopup(`<b>${firstVenue.name}</b>`).openPopup(); } setTimeout(() => { if (venueMapInstance) { console.log("DEBUG: Invalidating map size."); venueMapInstance.invalidateSize(); } }, 250);
          } catch (error) { console.error("DEBUG: Error initializing Leaflet map:", error); if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Error loading map.</p>"; }
      } else { console.warn("DEBUG: Map init skipped: No venue data."); if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>No venues for map.</p>"; }
  } else { if (!venueMapContainer) console.warn("DEBUG: Map container #venue-map missing."); if (typeof L === "undefined") console.warn("DEBUG: Leaflet library (L) missing."); if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Map disabled.</p>"; }

  // =========================================================================
  // == VENUE SWIPER LOGIC (Includes the Click Handler Fix & Debugging)
  // =========================================================================
  console.log("DEBUG: Initializing Venue Swiper...");
  const venueCard = document.getElementById("venue-details-card");
  const chooseVenueCard = document.getElementById("choose-venue-card");
  if (venueCard && chooseVenueCard) {
       console.log("DEBUG: Swiper card elements found.");
      if (fetchedVenueData.length > 0) {
           console.log("DEBUG: Venue data found, setting up swiper interactions.");
           const venueWrapper = venueCard.querySelector(".card-content-wrapper");
           const chooseWrapper = chooseVenueCard.querySelector(".card-content-wrapper");
           const allDotsInnerContainers = document.querySelectorAll(".dots-inner");
           if (venueWrapper && chooseWrapper && allDotsInnerContainers.length >= 2) {
                console.log("DEBUG: Swiper inner wrappers and dots containers found.");
                let isDragging = false, startX = 0, currentX = 0, diffX = 0, cardWidth = venueCard.offsetWidth;

                function generateDots() { /* ... (keep existing implementation) ... */ console.log(`DEBUG: Generating ${fetchedVenueData.length} dots.`); allDotsInnerContainers.forEach((dotsInner) => { if (dotsInner) { dotsInner.innerHTML = ""; fetchedVenueData.forEach(() => { dotsInner.appendChild(document.createElement("span")); }); } else { console.warn("DEBUG: A .dots-inner container missing."); } }); }
                function updateDots(activeIndex) { /* ... (keep existing implementation) ... */ if (activeIndex < 0 || activeIndex >= fetchedVenueData.length) return; console.log(`DEBUG: Updating dots to active index: ${activeIndex}`); allDotsInnerContainers.forEach((dotsInner) => { if (!dotsInner) return; const dots = dotsInner.querySelectorAll("span"); const dotsContainer = dotsInner.parentElement; if (!dotsContainer || dots.length !== fetchedVenueData.length || dots.length === 0) { console.warn("DEBUG: Dots container/dots mismatch."); return; } dots.forEach((dot, index) => dot.classList.toggle("active", index === activeIndex)); const dotTotalWidth = DOT_WIDTH + DOT_MARGIN * 2; const containerVisibleWidth = dotsContainer.offsetWidth; const totalInnerWidth = fetchedVenueData.length * dotTotalWidth; const activeDotCenterOffset = activeIndex * dotTotalWidth + dotTotalWidth / 2; let translateX = containerVisibleWidth / 2 - activeDotCenterOffset; if (totalInnerWidth > containerVisibleWidth) { const maxTranslate = 0; const minTranslate = containerVisibleWidth - totalInnerWidth; translateX = Math.max(minTranslate, Math.min(maxTranslate, translateX)); } else { translateX = (containerVisibleWidth - totalInnerWidth) / 2; } dotsInner.style.transform = `translateX(${translateX}px)`; }); }
                function updateVenueMap(lat, lng, venueName) { /* ... (keep existing implementation) ... */ if (!venueMapInstance || !venueMarker) { console.warn("DEBUG: Map update skipped: instance/marker missing."); return; } if (typeof lat === "number" && typeof lng === "number") { const newLatLng = [lat, lng]; console.log(`DEBUG: Updating map to [${lat}, ${lng}] for "${venueName}"`); venueMapInstance.setView(newLatLng, MAP_ZOOM_LEVEL, { animate: true, pan: { duration: 0.5 } }); venueMarker.setLatLng(newLatLng); if (venueName) { venueMarker.setPopupContent(`<b>${venueName}</b>`); } setTimeout(() => { if (venueMapInstance) venueMapInstance.invalidateSize(); }, 150); } else { console.warn(`DEBUG: Map update skipped for "${venueName}": Invalid coords (lat: ${lat}, lng: ${lng}).`); } }

                // *** THIS FUNCTION CONTAINS THE CLICK FIX AND DEBUG LOGS ***
                function displayVenue(index) {
                    const venueCard = document.getElementById("venue-details-card");
                    const chooseVenueCard = document.getElementById("choose-venue-card");
                    if (!venueCard || !chooseVenueCard) { console.error("DEBUG displayVenue: Cannot find venueCard or chooseVenueCard."); return; }
                    const venueWrapper = venueCard.querySelector(".card-content-wrapper");
                    const chooseWrapper = chooseVenueCard.querySelector(".card-content-wrapper");
                    if (!venueWrapper || !chooseWrapper) { console.error("DEBUG displayVenue: Could not find .card-content-wrapper."); return; }

                    if (index < 0 || index >= fetchedVenueData.length) { console.error(`DEBUG displayVenue: Invalid venue index requested: ${index}`); return; }
                    const venueDataForThisCard = fetchedVenueData[index];
                    console.log(`DEBUG displayVenue: Displaying index: ${index}, ID: ${venueDataForThisCard?.id}, Name: ${venueDataForThisCard?.name}`);

                    if (venueDataForThisCard.id === undefined || venueDataForThisCard.id === null) {
                        console.error("DEBUG displayVenue: Venue data missing 'id'! Click navigation will fail.", venueDataForThisCard);
                    }

                    // --- Update Card Content --- (Adapt selectors/properties if needed)
                    const venueNameEl = venueWrapper.querySelector(".venue-name");
                    const venueDateEl = venueWrapper.querySelector(".venue-date");
                    const ratingEl = chooseWrapper.querySelector(".rating");
                    const ratingTextEl = chooseWrapper.querySelector(".rating-text");
                    const venueIcon1El = chooseWrapper.querySelector(".venue-icon-1 img");
                    const venueIcon2El = chooseWrapper.querySelector(".venue-icon-2 img");

                    if (venueNameEl) venueNameEl.textContent = venueDataForThisCard.name || "Venue Name";
                    if (venueDateEl) venueDateEl.textContent = venueDataForThisCard.date_text || "Date Info";
                    if (ratingEl) { const ratingValue = Math.round(venueDataForThisCard.rating_stars || 0); ratingEl.textContent = '★'.repeat(ratingValue) + '☆'.repeat(5 - ratingValue); }
                    if (ratingTextEl) ratingTextEl.textContent = venueDataForThisCard.rating_text || 'Rating';
                    if (venueIcon1El) venueIcon1El.src = venueDataForThisCard.icon1_url || './assets/default-icon.png';
                    if (venueIcon2El) venueIcon2El.src = venueDataForThisCard.icon2_url || './assets/default-icon.png';
                    if (venueDataForThisCard.image_url) { venueCard.style.backgroundImage = `url('${venueDataForThisCard.image_url}')`; venueCard.style.backgroundSize = 'cover'; venueCard.style.backgroundPosition = 'center'; }
                    else { venueCard.style.backgroundImage = `url('${PLACEHOLDER_VENUE_IMAGE}')`; venueCard.style.backgroundSize = 'cover'; venueCard.style.backgroundPosition = 'center'; }

                    updateVenueMap(venueDataForThisCard.latitude, venueDataForThisCard.longitude, venueDataForThisCard.name);
                    updateDots(index);

                    // --- CLICK LISTENER LOGIC (REVISED + DEBUG LOGS) ---
                    const currentVenueId = venueDataForThisCard.id;
                    if (currentVenueId !== undefined && currentVenueId !== null) {
                        venueWrapper.setAttribute('data-venue-id', currentVenueId);
                        chooseWrapper.setAttribute('data-venue-id', currentVenueId);
                        // DEBUG LOG 1
                        console.log(`[DEBUG displayVenue index ${index}] Set data-venue-id="${currentVenueId}" on wrappers.`);
                    } else {
                        venueWrapper.removeAttribute('data-venue-id');
                        chooseWrapper.removeAttribute('data-venue-id');
                        // DEBUG LOG 2
                        console.warn(`[DEBUG displayVenue index ${index}] No valid venue ID found, click will not navigate.`);
                    }

                    const handleCardClick = (event) => {
                        // DEBUG LOG 3
                        console.log(`[DEBUG handleCardClick] Handler fired for element:`, event.currentTarget);
                        alert(`[DEBUG] Click detected on card wrapper!`); // Immediate feedback

                        const clickedWrapper = event.currentTarget;
                        const venueId = clickedWrapper.getAttribute('data-venue-id');
                        // DEBUG LOG 4
                        console.log(`[DEBUG handleCardClick] Read data-venue-id: "${venueId}"`);

                        if (venueId) {
                            const venueDetailUrl = `${VENUE_DETAIL_BASE_PATH}/${venueId}/`;
                            // DEBUG LOG 5
                            console.log(`[DEBUG handleCardClick] Constructed URL: "${venueDetailUrl}"`);
                            alert(`[DEBUG] Attempting to navigate to: ${venueDetailUrl}`);

                            try {
                                // DEBUG LOG Before Navigation
                                console.log(`[DEBUG handleCardClick] Executing: window.location.href = "${venueDetailUrl}";`);
                                window.location.href = venueDetailUrl;
                                // DEBUG LOG After Navigation (only runs if navigation fails instantly)
                                console.log(`[DEBUG handleCardClick] Navigation command apparently issued without immediate error.`);
                            } catch (navError) {
                                // DEBUG LOG 6
                                console.error(`[DEBUG handleCardClick] Error during window.location.href assignment:`, navError);
                                alert(`[DEBUG] Error during navigation: ${navError.message}`);
                            }
                        } else {
                            // DEBUG LOG 7
                            console.warn("[DEBUG handleCardClick] Cannot navigate: data-venue-id attribute missing or empty.", clickedWrapper);
                            alert("[DEBUG] Cannot navigate: Venue ID missing.");
                        }
                    };

                    venueWrapper.onclick = null;
                    chooseWrapper.onclick = null;
                    venueWrapper.removeEventListener('click', handleCardClick); // Attempt removal first
                    chooseWrapper.removeEventListener('click', handleCardClick);
                    venueWrapper.addEventListener('click', handleCardClick);
                    chooseWrapper.addEventListener('click', handleCardClick);
                    // DEBUG LOG 8
                    console.log(`[DEBUG displayVenue index ${index}] Click listeners attached.`);

                } // --- End displayVenue ---


                // --- Swipe Event Handlers ---
                function handleSwipeStart(e) { /* ... (keep existing implementation, check preventDefault logic) ... */ if (e.target.closest("button, input, a, .dots, .leaflet-container")) { console.log("DEBUG: Swipe prevented on interactive element."); return; } isDragging = true; startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX; currentX = startX; diffX = 0; cardWidth = venueCard.offsetWidth; venueWrapper.classList.add("is-swiping"); chooseWrapper.classList.add("is-swiping"); if (e.cancelable && e.type.includes("touch")) e.preventDefault(); }
                function handleSwipeMove(e) { /* ... (keep existing implementation, check preventDefault logic) ... */ if (!isDragging) return; currentX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX; diffX = currentX - startX; const transformValue = `translateX(${diffX}px)`; venueWrapper.style.transform = transformValue; chooseWrapper.style.transform = transformValue; if (e.cancelable && e.type.includes("touch")) e.preventDefault(); }
                function handleSwipeEnd(e) { /* ... (keep existing implementation) ... */ if (!isDragging) return; isDragging = false; venueWrapper.classList.remove("is-swiping"); chooseWrapper.classList.remove("is-swiping"); const threshold = cardWidth / 4; let newIndex = currentVenueIndex; if (diffX < -threshold && currentVenueIndex < fetchedVenueData.length - 1) { newIndex++; console.log("DEBUG: Swipe Left detected."); } else if (diffX > threshold && currentVenueIndex > 0) { newIndex--; console.log("DEBUG: Swipe Right detected."); } else { console.log("DEBUG: Swipe below threshold or at boundary."); } venueWrapper.style.transition = "transform 0.3s ease-out"; chooseWrapper.style.transition = "transform 0.3s ease-out"; venueWrapper.style.transform = `translateX(0px)`; chooseWrapper.style.transform = `translateX(0px)`; setTimeout(() => { venueWrapper.style.transition = ""; chooseWrapper.style.transition = ""; }, 300); if (newIndex !== currentVenueIndex) { currentVenueIndex = newIndex; displayVenue(currentVenueIndex); } diffX = 0; }

                // Attach Swipe Listeners
                venueCard.addEventListener("mousedown", handleSwipeStart);
                venueCard.addEventListener("touchstart", handleSwipeStart, { passive: false });
                chooseVenueCard.addEventListener("mousedown", handleSwipeStart);
                chooseVenueCard.addEventListener("touchstart", handleSwipeStart, { passive: false });
                document.addEventListener("mousemove", handleSwipeMove);
                document.addEventListener("touchmove", handleSwipeMove, { passive: false });
                document.addEventListener("mouseup", handleSwipeEnd);
                document.addEventListener("touchend", handleSwipeEnd);
                document.addEventListener("mouseleave", handleSwipeEnd);

                // Init Swiper
                generateDots();
                displayVenue(currentVenueIndex);

                // Resize Handler
                window.addEventListener("resize", () => { console.log("DEBUG: Window resized."); if (venueCard) cardWidth = venueCard.offsetWidth; updateDots(currentVenueIndex); if (venueMapInstance) { setTimeout(() => { if (venueMapInstance) venueMapInstance.invalidateSize(); }, 150); } });

           } else { console.error("DEBUG: Swiper setup failed: Inner elements missing."); }
      } else { console.warn("DEBUG: Swiper setup skipped: No venue data."); venueCard.innerHTML = '<p class="info-message">No venues available.</p>'; chooseVenueCard.style.display = 'none'; }
  } else { console.warn("DEBUG: Swiper base card elements missing."); }


  // =========================================================================
  // == INTERACTIVE CHECKLIST LOGIC
  // =========================================================================
  console.log("DEBUG: Initializing Checklist...");
  const checklistKey = "interactiveChecklistState";
  const checklistItems = document.querySelectorAll('.interactive-checklist input[type="checkbox"]');
  if (checklistItems.length > 0) {
      console.log(`DEBUG: Found ${checklistItems.length} checklist items.`);
      function saveChecklistState() { /* ... (keep existing implementation) ... */ const state = {}; checklistItems.forEach((item) => { if (item.id) { state[item.id] = item.checked; } else { console.warn("DEBUG: Checklist item missing ID:", item); } }); try { localStorage.setItem(checklistKey, JSON.stringify(state)); console.log("DEBUG: Checklist state saved."); } catch (e) { console.error("DEBUG: Error saving checklist state:", e); } }
      function loadChecklistState() { /* ... (keep existing implementation) ... */ const savedState = localStorage.getItem(checklistKey); if (savedState) { console.log("DEBUG: Loading checklist state."); try { const state = JSON.parse(savedState); checklistItems.forEach((item) => { if (item.id && state[item.id] !== undefined) { item.checked = state[item.id]; } }); } catch (e) { console.error("DEBUG: Error parsing checklist state:", e); localStorage.removeItem(checklistKey); } } else { console.log("DEBUG: No saved checklist state."); } }
      checklistItems.forEach((item) => { item.addEventListener("change", saveChecklistState); });
      loadChecklistState();
  } else { console.warn("DEBUG: No checklist items found."); }


  // =========================================================================
  // == PLAN SWITCHER BUTTONS (Dynamically Created)
  // =========================================================================
  console.log("DEBUG: Initializing Plan Switcher Buttons...");
  if (fetchedPlanData.length > 0) {
       console.log(`DEBUG: Creating ${fetchedPlanData.length} plan switcher buttons.`);
       /* ... (keep existing button creation logic) ... */
        const planSwitcherContainer = document.createElement("div"); planSwitcherContainer.className = "plan-switcher-container"; planSwitcherContainer.style.textAlign = "center"; planSwitcherContainer.style.padding = "20px 0"; fetchedPlanData.forEach((plan) => { const button = document.createElement("button"); button.textContent = `Activate ${plan.name || `Plan (ID: ${plan.id})`}`; button.className = "btn btn-secondary btn-switch-plan"; button.style.margin = "0 8px"; button.setAttribute("data-plan-id", plan.id); button.onclick = () => applyPlan(plan); planSwitcherContainer.appendChild(button); }); const featuresSection = document.querySelector(".features"); /* <<< ADAPT SELECTOR */ if (featuresSection?.parentNode) { console.log("DEBUG: Inserting plan switcher before features section."); featuresSection.parentNode.insertBefore(planSwitcherContainer, featuresSection); } else { console.warn("DEBUG: Target section for plan switcher not found, appending to body."); document.body.appendChild(planSwitcherContainer); }
  } else { console.log("DEBUG: No plan data, skipping plan switcher buttons."); }


  console.log("DEBUG: Frontend Player Initialization Complete.");
}); // --- END DOMContentLoaded ---
