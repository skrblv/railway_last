// =========================================================================
// == frontend/player.js -- Complete Code with Robust Mobile Click/Tap Handling
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

// --- Swiper State Variables ---
let isDragging = false;
let startX = 0;
let startY = 0; // For detecting vertical scroll vs horizontal swipe
let currentX = 0;
let diffX = 0;
let cardWidth = 0;
let touchStartTime = 0;
const TAP_THRESHOLD_X = 10; // Max horizontal pixels moved to still be considered a tap
const TAP_THRESHOLD_Y = 15; // Max vertical pixels moved to still be considered a tap
const MAX_TAP_DURATION = 300; // Max milliseconds for a tap

// =========================================================================
// == API Fetching Functions (Keep As Is)
// =========================================================================
async function fetchVenues() { /* ... (Keep implementation from previous version) ... */
    console.log("Attempting to fetch venues...");
    try { const response = await fetch(`${API_BASE_URL}/venues/`); if (!response.ok) { throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`); } const contentType = response.headers.get("content-type"); if (contentType && contentType.includes("application/json")) { const rawData = await response.json(); if (!Array.isArray(rawData)) { console.warn("Fetched venue data is not an array, resetting.", rawData); fetchedVenueData = []; } else { fetchedVenueData = rawData; console.log("Fetched Venues:", fetchedVenueData.length, "items"); } } else { const textResponse = await response.text(); throw new Error(`Expected JSON, but received ${contentType}. Response: ${textResponse}`); } } catch (error) { console.error("Could not fetch venues:", error); fetchedVenueData = []; const swiperSection = document.getElementById("venue-details-card")?.parentElement; if(swiperSection) swiperSection.innerHTML = `<p class="error-message">Error loading venues: ${error.message}</p>`; }
}
async function fetchPlans() { /* ... (Keep implementation from previous version) ... */
    console.log("Attempting to fetch plans...");
    try { const response = await fetch(`${API_BASE_URL}/plans/`); if (!response.ok) { throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`); } const contentType = response.headers.get("content-type"); if (contentType && contentType.includes("application/json")) { fetchedPlanData = await response.json(); console.log("Fetched Plans:", fetchedPlanData); if (!Array.isArray(fetchedPlanData)) { console.warn("Fetched plan data is not an array, resetting.", fetchedPlanData); fetchedPlanData = []; } if (fetchedPlanData.length > 0) { currentPlan = fetchedPlanData.find((p) => p.name?.toLowerCase() === "plan a") || fetchedPlanData[0]; console.log("Initial plan set to:", currentPlan?.name || 'First Plan'); applyPlan(currentPlan); } else { console.log("No plans fetched."); applyPlan(null); } } else { const textResponse = await response.text(); throw new Error(`Expected JSON, but received ${contentType}. Response: ${textResponse}`); } } catch (error) { console.error("Could not fetch plans:", error); fetchedPlanData = []; applyPlan(null); }
}

// =========================================================================
// == Plan Application & Audio Handling (Keep As Is)
// =========================================================================
function applyPlan(plan) { /* ... (Keep implementation from previous version, including handleMetadataLoad, handleAudioError defined outside) ... */
    const body = document.body; const musicPlayer = document.querySelector(".music-player"); const audioPlayer = document.getElementById("audio-player"); const albumArt = musicPlayer?.querySelector(".album-art img"); const trackTitleEl = musicPlayer?.querySelector("#track-title"); const artistNameEl = musicPlayer?.querySelector("#artist-name"); const progress = document.getElementById("progress"); const currentTimeEl = document.getElementById("current-time"); const totalTimeEl = document.getElementById("total-time"); const playPauseIcon = document.getElementById("play-pause-icon"); const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M8 5v14l11-7z"/></svg>`;
    if (!plan) { console.log("Applying default state (no plan)."); currentPlan = null; body.classList.remove("theme-positive", "theme-sad"); if (audioPlayer) { if (!audioPlayer.paused) audioPlayer.pause(); audioPlayer.src = ""; } if (albumArt) { albumArt.src = PLACEHOLDER_ALBUM_ART; albumArt.alt = "Album Art"; } if (trackTitleEl) trackTitleEl.textContent = "Track Title"; if (artistNameEl) artistNameEl.textContent = "Artist Name"; if (progress) progress.style.width = "0%"; if (currentTimeEl) currentTimeEl.textContent = "0:00"; if (totalTimeEl) totalTimeEl.textContent = "0:00"; if (playPauseIcon) playPauseIcon.innerHTML = playIconSvg; if(audioPlayer) { audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad); audioPlayer.removeEventListener("error", handleAudioError); } return; }
    console.log("Applying Plan:", plan.name || `(ID: ${plan.id})`); currentPlan = plan;
    body.classList.remove("theme-positive", "theme-sad"); if (plan.theme === "positive") { body.classList.add("theme-positive"); } else if (plan.theme === "sad") { body.classList.add("theme-sad"); } else { console.warn(`Plan '${plan.name}' has unknown theme:`, plan.theme); }
    if (!musicPlayer || !audioPlayer) { console.warn("Music player elements missing."); return; }
    let wasPlaying = !audioPlayer.paused && audioPlayer.currentTime > 0;
    if (plan.song_url && audioPlayer.currentSrc !== plan.song_url) { console.log("Setting new audio source:", plan.song_url); audioPlayer.src = plan.song_url; audioPlayer.load(); } else if (!plan.song_url) { console.warn(`Plan "${plan.name}" has no song_url.`); if (!audioPlayer.paused) audioPlayer.pause(); audioPlayer.src = ""; wasPlaying = false; } else { console.log("Audio source is the same."); }
    if (albumArt) { albumArt.src = plan.album_art_url || PLACEHOLDER_ALBUM_ART; albumArt.alt = plan.track_title || "Album Art"; } if (trackTitleEl) trackTitleEl.textContent = plan.track_title || "Unknown Track"; if (artistNameEl) artistNameEl.textContent = plan.artist_name || "Unknown Artist"; if (progress) progress.style.width = "0%"; if (currentTimeEl) currentTimeEl.textContent = "0:00"; if (totalTimeEl) totalTimeEl.textContent = "0:00"; if (playPauseIcon && audioPlayer.paused) playPauseIcon.innerHTML = playIconSvg;
    audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad); audioPlayer.removeEventListener("error", handleAudioError); const metadataHandler = () => handleMetadataLoad(wasPlaying, plan.song_url); audioPlayer.addEventListener("loadedmetadata", metadataHandler, { once: true }); audioPlayer.addEventListener("error", handleAudioError, { once: true });
}
const handleMetadataLoad = (shouldResume, songUrl) => { /* ... (Keep implementation from previous version) ... */ const totalTimeEl = document.getElementById("total-time"); const audioPlayer = document.getElementById("audio-player"); console.log("Metadata loaded."); if (totalTimeEl && audioPlayer?.duration && !isNaN(audioPlayer.duration)) { console.log(`Duration: ${audioPlayer.duration}`); totalTimeEl.textContent = formatTime(audioPlayer.duration); } else if (totalTimeEl) { totalTimeEl.textContent = "0:00"; } if (shouldResume && songUrl && audioPlayer?.paused) { console.log("Attempting to resume playback..."); audioPlayer.play().catch(e => console.error("Audio play failed after metadata load:", e)); } else if (audioPlayer && !audioPlayer.paused) { console.log("Audio already playing or should not resume."); updatePlayPauseIconState(); } else { console.log("Not resuming playback."); updatePlayPauseIconState(); } };
const handleAudioError = (e) => { /* ... (Keep implementation from previous version) ... */ console.error("Audio Player Error:", e.target.error?.message || 'Unknown error', e); const totalTimeEl = document.getElementById("total-time"); const progress = document.getElementById("progress"); const currentTimeEl = document.getElementById("current-time"); if (totalTimeEl) totalTimeEl.textContent = "Error"; if (progress) progress.style.width = "0%"; if (currentTimeEl) currentTimeEl.textContent = "0:00"; updatePlayPauseIconState(); };

// =========================================================================
// == Helper Functions (Keep As Is)
// =========================================================================
function formatTime(seconds) { /* ... (keep existing implementation) ... */ if (isNaN(seconds) || seconds < 0) seconds = 0; const minutes = Math.floor(seconds / 60); const secs = Math.floor(seconds % 60); return `${minutes}:${secs < 10 ? "0" : ""}${secs}`; }
function padZero(num) { /* ... (keep existing implementation) ... */ return num < 10 ? "0" + num : num; }
function updatePlayPauseIconState() { /* ... (keep existing implementation) ... */ const audioPlayer = document.getElementById("audio-player"); const playPauseBtn = document.getElementById("play-pause-btn"); const playPauseIcon = document.getElementById("play-pause-icon"); if (!audioPlayer || !playPauseBtn || !playPauseIcon) return; const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M8 5v14l11-7z"/></svg>`; const pauseIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`; const isPlaying = !audioPlayer.paused && audioPlayer.readyState > 0; playPauseIcon.innerHTML = isPlaying ? pauseIconSvg : playIconSvg; playPauseBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play"); }

// =========================================================================
// == Venue Navigation Function
// =========================================================================
/**
 * Navigates the browser to the detail page for the given venue ID.
 * @param {string | number} venueId - The ID of the venue.
 */
function navigateToVenueDetail(venueId) {
    if (venueId === undefined || venueId === null || venueId === '') {
        console.warn("navigateToVenueDetail called with invalid ID:", venueId);
        return;
    }

    // Construct the URL using the configured base path
    const venueDetailUrl = `${VENUE_DETAIL_BASE_PATH}/${venueId}/`;
    console.log(`Navigating to: ${venueDetailUrl}`);

    try {
        // Use window.location.href for reliable navigation
        window.location.href = venueDetailUrl;
    } catch (navError) {
        console.error(`Error during navigation attempt to ${venueDetailUrl}:`, navError);
        // Optionally alert the user if navigation fails catastrophically
        // alert("Could not navigate to the venue details page.");
    }
}


// =========================================================================
// == DOMContentLoaded Event Listener (Main Execution Block)
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM loaded. Starting initialization...");

  // --- Fetch data FIRST ---
  console.log("Fetching initial venue and plan data...");
  try {
      await Promise.all([ fetchVenues(), fetchPlans() ]);
      console.log("Initial data fetching complete.");
  } catch (error) { console.error("Error during initial data fetch:", error); }


  // =========================================================================
  // == MUSIC PLAYER LOGIC (Keep As Is)
  // =========================================================================
  console.log("Initializing Music Player...");
  const audioPlayer = document.getElementById("audio-player");
  const playPauseBtn = document.getElementById("play-pause-btn");
  // ... (other player elements)
  if (audioPlayer && playPauseBtn /* ... && other elements ... */) {
      console.log("Music player elements found. Attaching listeners.");
      function togglePlayPause() { /* ... (Keep implementation from previous version) ... */ if (!audioPlayer.src && currentPlan?.song_url) { console.log("No audio source, load/play from plan."); const playIntentHandler = () => handleMetadataLoad(true, currentPlan.song_url); audioPlayer.removeEventListener("loadedmetadata", playIntentHandler); audioPlayer.addEventListener("loadedmetadata", playIntentHandler, { once: true }); applyPlan(currentPlan); return; } else if (!audioPlayer.src) { console.warn("Cannot play: No audio source."); return; } if (audioPlayer.paused) { audioPlayer.play().catch((e) => { console.error("Audio play failed:", e); updatePlayPauseIconState(); }); } else { audioPlayer.pause(); } }
      function updateProgress() { /* ... (Keep implementation from previous version) ... */ if (audioPlayer.duration && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) { const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100; const progress = document.getElementById("progress"); if (progress) progress.style.width = `${progressPercent}%`; const currentTimeEl = document.getElementById("current-time"); if (currentTimeEl) currentTimeEl.textContent = formatTime(audioPlayer.currentTime); } else { const progress = document.getElementById("progress"); if (progress) progress.style.width = "0%"; const currentTimeEl = document.getElementById("current-time"); if (currentTimeEl) currentTimeEl.textContent = "0:00"; } }
      function seek(event) { /* ... (Keep implementation from previous version) ... */ const progressContainer = document.getElementById("progress-container"); if (!audioPlayer.duration || isNaN(audioPlayer.duration) || audioPlayer.duration <= 0 || !progressContainer) { console.warn("Cannot seek."); return; } const rect = progressContainer.getBoundingClientRect(); const clickX = event.clientX - rect.left; const width = progressContainer.clientWidth; const seekRatio = Math.max(0, Math.min(1, clickX / width)); audioPlayer.currentTime = seekRatio * audioPlayer.duration; updateProgress(); }
      function changeVolume() { /* ... (Keep implementation from previous version) ... */ const volumeSlider = document.getElementById("volume-slider"); if(volumeSlider) audioPlayer.volume = Math.max(0, Math.min(1, volumeSlider.value / 100)); }
      function restartSong() { /* ... (Keep implementation from previous version) ... */ if (!audioPlayer.src || isNaN(audioPlayer.duration)) return; audioPlayer.currentTime = 0; if (audioPlayer.paused) { updateProgress(); } else { audioPlayer.play().catch((e) => console.error("Audio play failed on restart:", e)); } }
      function nextSong() { console.log("Next button: placeholder action."); restartSong(); }
      playPauseBtn.addEventListener("click", togglePlayPause);
      audioPlayer.addEventListener("timeupdate", updateProgress);
      audioPlayer.addEventListener("play", updatePlayPauseIconState);
      audioPlayer.addEventListener("pause", updatePlayPauseIconState);
      audioPlayer.addEventListener("ended", restartSong);
      document.getElementById("progress-container")?.addEventListener("click", seek);
      document.getElementById("volume-slider")?.addEventListener("input", changeVolume);
      document.getElementById("prev-btn")?.addEventListener("click", restartSong);
      document.getElementById("next-btn")?.addEventListener("click", nextSong);
      changeVolume(); updatePlayPauseIconState();
  } else { console.warn("Music player core elements missing."); }

  // =========================================================================
  // == COUNTDOWN TIMER LOGIC (Keep As Is)
  // =========================================================================
  console.log("Initializing Countdown Timer...");
  // ... (Keep the countdown timer logic exactly as in the previous version) ...
  const datePicker = document.getElementById("event-date-picker"); const setDateBtn = document.getElementById("set-date-btn"); const daysNumEl = document.getElementById("days-num"); const hoursNumEl = document.getElementById("hours-num"); const minutesNumEl = document.getElementById("minutes-num"); const secondsNumEl = document.getElementById("seconds-num"); const calDay1El = document.getElementById("cal-day-1"); const calDay2El = document.getElementById("cal-day-2"); const calDay3El = document.getElementById("cal-day-3");
  if (datePicker && setDateBtn && daysNumEl && hoursNumEl && minutesNumEl && secondsNumEl && calDay1El && calDay2El && calDay3El ) { console.log("Countdown timer elements found."); const localStorageKey = "targetEventDate"; let targetDate = null; let countdownInterval = null; function updateCalendarDisplay(dateObj) { if (!dateObj || isNaN(dateObj.getTime())) { calDay1El.textContent = "--"; calDay2El.textContent = "--"; calDay3El.textContent = "--"; calDay1El.classList.remove("highlight"); calDay2El.classList.add("highlight"); calDay3El.classList.remove("highlight"); return; } const targetDay = dateObj.getUTCDate(); const prevDate = new Date(dateObj); prevDate.setUTCDate(targetDay - 1); const nextDate = new Date(dateObj); nextDate.setUTCDate(targetDay + 1); calDay1El.textContent = padZero(prevDate.getUTCDate()); calDay2El.textContent = padZero(targetDay); calDay3El.textContent = padZero(nextDate.getUTCDate()); calDay1El.classList.remove("highlight"); calDay2El.classList.add("highlight"); calDay3El.classList.remove("highlight"); } function updateCountdown() { if (!targetDate || isNaN(targetDate.getTime())) { daysNumEl.textContent = "--"; hoursNumEl.textContent = "--"; minutesNumEl.textContent = "--"; secondsNumEl.textContent = "--"; return; } const now = new Date().getTime(); const difference = targetDate.getTime() - now; if (difference <= 0) { daysNumEl.textContent = "00"; hoursNumEl.textContent = "00"; minutesNumEl.textContent = "00"; secondsNumEl.textContent = "00"; if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; } return; } const days = Math.floor(difference / 86400000); const hours = Math.floor((difference % 86400000) / 3600000); const minutes = Math.floor((difference % 3600000) / 60000); const seconds = Math.floor((difference % 60000) / 1000); daysNumEl.textContent = padZero(days); hoursNumEl.textContent = padZero(hours); minutesNumEl.textContent = padZero(minutes); secondsNumEl.textContent = padZero(seconds); } function startCountdown() { if (countdownInterval) clearInterval(countdownInterval); if (targetDate && !isNaN(targetDate.getTime()) && targetDate.getTime() > new Date().getTime()) { updateCountdown(); countdownInterval = setInterval(updateCountdown, 1000); } else { updateCountdown(); } } function handleSetDate() { const selectedDateString = datePicker.value; if (!selectedDateString) { alert("Please select a date."); return; } const parts = selectedDateString.split("-"); if (parts.length !== 3) { alert("Invalid date format."); return; } const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10) - 1; const day = parseInt(parts[2], 10); if (isNaN(year) || isNaN(month) || isNaN(day)) { alert("Invalid date components."); return; } const potentialTargetDate = new Date(Date.UTC(year, month, day, 0, 0, 0)); if (isNaN(potentialTargetDate.getTime())) { alert("Invalid date selected."); return; } const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0); if (potentialTargetDate < todayUTC) { alert("Please select today or a future date."); return; } localStorage.setItem(localStorageKey, selectedDateString); targetDate = potentialTargetDate; updateCalendarDisplay(targetDate); startCountdown(); console.log("New target date set:", targetDate); } function loadDateFromStorage() { const storedDateString = localStorage.getItem(localStorageKey); if (storedDateString) { const parts = storedDateString.split("-"); if (parts.length === 3) { const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10) - 1; const day = parseInt(parts[2], 10); if (!isNaN(year) && !isNaN(month) && !isNaN(day)) { const loadedDate = new Date(Date.UTC(year, month, day, 0, 0, 0)); if (!isNaN(loadedDate.getTime())) { targetDate = loadedDate; datePicker.value = storedDateString; console.log("Loaded target date from storage:", targetDate); updateCalendarDisplay(targetDate); startCountdown(); return; } } } console.warn("Invalid date string found in localStorage, removing."); localStorage.removeItem(localStorageKey); } console.log("No valid date in storage, initializing default display."); updateCalendarDisplay(null); updateCountdown(); } setDateBtn.addEventListener("click", handleSetDate); loadDateFromStorage(); } else { console.warn("Countdown timer elements missing."); }

  // =========================================================================
  // == LEAFLET MAP INITIALIZATION (Keep As Is)
  // =========================================================================
  console.log("Initializing Leaflet Map...");
  // ... (Keep map initialization logic exactly as in the previous version) ...
  const venueMapContainer = document.getElementById("venue-map"); if (venueMapContainer && typeof L !== "undefined") { console.log("Map container and Leaflet library found."); if (fetchedVenueData.length > 0) { try { const firstVenue = fetchedVenueData[0]; const initialCoords = firstVenue?.latitude != null && firstVenue?.longitude != null ? [firstVenue.latitude, firstVenue.longitude] : [42.8749, 74.6049]; /* <<< ADAPT FALLBACK */ console.log("Initializing map at coords:", initialCoords); venueMapInstance = L.map(venueMapContainer, { zoomControl: false }).setView(initialCoords, MAP_ZOOM_LEVEL); L.control.zoom({ position: "bottomright" }).addTo(venueMapInstance); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(venueMapInstance); venueMarker = L.marker(initialCoords).addTo(venueMapInstance); if (firstVenue?.name) { venueMarker.bindPopup(`<b>${firstVenue.name}</b>`).openPopup(); } setTimeout(() => { if (venueMapInstance) { console.log("Invalidating map size."); venueMapInstance.invalidateSize(); } }, 250); } catch (error) { console.error("Error initializing Leaflet map:", error); if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Error loading map.</p>"; } } else { console.warn("Map init skipped: No venue data."); if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>No venues for map.</p>"; } } else { if (!venueMapContainer) console.warn("Map container #venue-map missing."); if (typeof L === "undefined") console.warn("Leaflet library (L) missing."); if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Map disabled.</p>"; }

  // =========================================================================
  // == VENUE SWIPER LOGIC (Revised for Mobile Taps)
  // =========================================================================
  console.log("Initializing Venue Swiper...");
  const venueCard = document.getElementById("venue-details-card");
  const chooseVenueCard = document.getElementById("choose-venue-card");

  if (venueCard && chooseVenueCard) {
      console.log("Swiper card elements found.");
      if (fetchedVenueData.length > 0) {
          console.log("Venue data found, setting up swiper interactions.");
          const venueWrapper = venueCard.querySelector(".card-content-wrapper");
          const chooseWrapper = chooseVenueCard.querySelector(".card-content-wrapper");
          const allDotsInnerContainers = document.querySelectorAll(".dots-inner");

          if (venueWrapper && chooseWrapper && allDotsInnerContainers.length >= 2) {
              console.log("Swiper inner wrappers and dots containers found.");

              // --- Swiper Helper Functions (Keep generateDots, updateDots, updateVenueMap as is) ---
              function generateDots() { /* ... (Keep implementation from previous version) ... */ console.log(`Generating ${fetchedVenueData.length} dots.`); allDotsInnerContainers.forEach((dotsInner) => { if (dotsInner) { dotsInner.innerHTML = ""; fetchedVenueData.forEach(() => { dotsInner.appendChild(document.createElement("span")); }); } else { console.warn("A .dots-inner container missing."); } }); }
              function updateDots(activeIndex) { /* ... (Keep implementation from previous version) ... */ if (activeIndex < 0 || activeIndex >= fetchedVenueData.length) return; console.log(`Updating dots to active index: ${activeIndex}`); allDotsInnerContainers.forEach((dotsInner) => { if (!dotsInner) return; const dots = dotsInner.querySelectorAll("span"); const dotsContainer = dotsInner.parentElement; if (!dotsContainer || dots.length !== fetchedVenueData.length || dots.length === 0) { console.warn("Dots container/dots mismatch."); return; } dots.forEach((dot, index) => dot.classList.toggle("active", index === activeIndex)); const dotTotalWidth = DOT_WIDTH + DOT_MARGIN * 2; const containerVisibleWidth = dotsContainer.offsetWidth; const totalInnerWidth = fetchedVenueData.length * dotTotalWidth; const activeDotCenterOffset = activeIndex * dotTotalWidth + dotTotalWidth / 2; let translateX = containerVisibleWidth / 2 - activeDotCenterOffset; if (totalInnerWidth > containerVisibleWidth) { const maxTranslate = 0; const minTranslate = containerVisibleWidth - totalInnerWidth; translateX = Math.max(minTranslate, Math.min(maxTranslate, translateX)); } else { translateX = (containerVisibleWidth - totalInnerWidth) / 2; } dotsInner.style.transform = `translateX(${translateX}px)`; }); }
              function updateVenueMap(lat, lng, venueName) { /* ... (Keep implementation from previous version) ... */ if (!venueMapInstance || !venueMarker) { console.warn("Map update skipped: instance/marker missing."); return; } if (typeof lat === "number" && typeof lng === "number") { const newLatLng = [lat, lng]; console.log(`Updating map to [${lat}, ${lng}] for "${venueName}"`); venueMapInstance.setView(newLatLng, MAP_ZOOM_LEVEL, { animate: true, pan: { duration: 0.5 } }); venueMarker.setLatLng(newLatLng); if (venueName) { venueMarker.setPopupContent(`<b>${venueName}</b>`); } setTimeout(() => { if (venueMapInstance) venueMapInstance.invalidateSize(); }, 150); } else { console.warn(`Map update skipped for "${venueName}": Invalid coords (lat: ${lat}, lng: ${lng}).`); } }

              // --- Display Venue Function (WITHOUT CLICK LISTENERS INSIDE) ---
              function displayVenue(index) {
                  // Get elements, data, check validity (as before)
                  if (!venueCard || !chooseVenueCard) { console.error("Cannot find venueCard or chooseVenueCard."); return; }
                  const venueWrapper = venueCard.querySelector(".card-content-wrapper");
                  const chooseWrapper = chooseVenueCard.querySelector(".card-content-wrapper");
                  if (!venueWrapper || !chooseWrapper) { console.error("Could not find .card-content-wrapper."); return; }
                  if (index < 0 || index >= fetchedVenueData.length) { console.error(`Invalid venue index: ${index}`); return; }
                  const venueData = fetchedVenueData[index];
                  console.log(`Displaying venue index: ${index}, ID: ${venueData?.id}, Name: ${venueData?.name}`);

                  // Check for ID and set data attribute (CRUCIAL for click/tap handler)
                  const currentVenueId = venueData.id;
                  if (currentVenueId !== undefined && currentVenueId !== null) {
                      // Set ID on the elements that have the listeners attached
                      venueCard.setAttribute('data-venue-id', currentVenueId);
                      chooseVenueCard.setAttribute('data-venue-id', currentVenueId);
                       console.log(`   -> Set data-venue-id="${currentVenueId}" on MAIN card elements for index ${index}`);
                  } else {
                      venueCard.removeAttribute('data-venue-id');
                      chooseVenueCard.removeAttribute('data-venue-id');
                      console.warn(`   -> No valid venue ID found for index ${index}, navigation might fail.`);
                  }

                  // Update Card Content (as before, using venueData)
                  const venueNameEl = venueWrapper.querySelector(".venue-name");
                  const venueDateEl = venueWrapper.querySelector(".venue-date");
                  const ratingEl = chooseWrapper.querySelector(".rating");
                  const ratingTextEl = chooseWrapper.querySelector(".rating-text");
                  const venueIcon1El = chooseWrapper.querySelector(".venue-icon-1 img");
                  const venueIcon2El = chooseWrapper.querySelector(".venue-icon-2 img");
                  if (venueNameEl) venueNameEl.textContent = venueData.name || "Venue Name";
                  if (venueDateEl) venueDateEl.textContent = venueData.date_text || "Date Info";
                  if (ratingEl) { const rVal = Math.round(venueData.rating_stars || 0); ratingEl.textContent = '★'.repeat(rVal) + '☆'.repeat(5 - rVal); }
                  if (ratingTextEl) ratingTextEl.textContent = venueData.rating_text || 'Rating';
                  if (venueIcon1El) venueIcon1El.src = venueData.icon1_url || './assets/default-icon.png';
                  if (venueIcon2El) venueIcon2El.src = venueData.icon2_url || './assets/default-icon.png';
                  if (venueData.image_url) { venueCard.style.backgroundImage = `url('${venueData.image_url}')`; venueCard.style.backgroundSize = 'cover'; venueCard.style.backgroundPosition = 'center'; }
                  else { venueCard.style.backgroundImage = `url('${PLACEHOLDER_VENUE_IMAGE}')`; venueCard.style.backgroundSize = 'cover'; venueCard.style.backgroundPosition = 'center'; }

                  // Update Map & Dots (as before)
                  updateVenueMap(venueData.latitude, venueData.longitude, venueData.name);
                  updateDots(index);

                  // --- NO CLICK LISTENER ATTACHMENT HERE ---
                  // Listeners are attached ONCE outside this function.

              } // --- End displayVenue ---


              // --- Event Handlers (Defined ONCE) ---

              // Mousedown/Touchstart Handler
              const handlePointerStart = (e) => {
                  // Prevent swipe if clicking on interactive elements inside the card or the map
                   if (e.target.closest("button, input, a, .dots, .leaflet-container")) {
                       console.log("Pointer start ignored on interactive element.");
                       isDragging = false; // Ensure dragging doesn't start
                       return;
                   }
                  isDragging = false; // Reset drag state initially
                  startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
                  startY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY; // Record Y for scroll detection
                  currentX = startX;
                  diffX = 0;
                  touchStartTime = Date.now(); // Record time for tap detection
                  cardWidth = venueCard.offsetWidth;

                  // Add class for visual feedback (optional)
                  venueWrapper.classList.add("is-swiping");
                  chooseWrapper.classList.add("is-swiping");

                  // Don't preventDefault immediately in touchstart, wait for touchmove
                  console.log(`Pointer start at X: ${startX}, Y: ${startY}`);
              };

              // Mousemove/Touchmove Handler
              const handlePointerMove = (e) => {
                  // Only process if a pointer start occurred on a valid element
                  if (startX === null) return; // Use startX as a flag that start occurred

                   currentX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
                   const currentY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
                   diffX = currentX - startX;
                   const diffY = currentY - startY; // Calculate vertical difference

                   // Check if dragging has started (more X movement than Y, and exceeds threshold)
                   if (!isDragging) {
                       // If it moves more vertically OR doesn't move much horizontally, it's likely scroll or tap
                       if (Math.abs(diffY) > TAP_THRESHOLD_Y && Math.abs(diffY) > Math.abs(diffX)) {
                           // Vertical movement detected, likely scrolling - cancel swipe
                           console.log("Vertical scroll detected, canceling swipe.");
                           startX = null; // Reset start flag to ignore subsequent moves/ends for this interaction
                           venueWrapper.classList.remove("is-swiping");
                           chooseWrapper.classList.remove("is-swiping");
                           return;
                       }
                       // If horizontal movement exceeds threshold, start dragging
                       if (Math.abs(diffX) > TAP_THRESHOLD_X) {
                            console.log("Dragging started.");
                            isDragging = true;
                       }
                   }

                  // If dragging, update transform and prevent default scroll
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

              // Mouseup/Touchend/Mouseleave Handler
              const handlePointerEnd = (e) => {
                   // Only process if a pointer start occurred and wasn't cancelled (startX is not null)
                   if (startX === null) return;

                   const touchDuration = Date.now() - touchStartTime;
                   console.log(`Pointer end. Dragging: ${isDragging}, Duration: ${touchDuration}ms, diffX: ${diffX}`);

                   // --- TAP DETECTION ---
                   // Check if NOT dragging, AND movement was minimal, AND duration is short
                   if (!isDragging && touchDuration < MAX_TAP_DURATION) {
                       console.log("Tap detected!");
                       // Find the card element the event originated from or bubbled to
                       const targetCard = e.currentTarget; // The element the listener is on
                       const venueId = targetCard.getAttribute('data-venue-id');
                        console.log(`   -> Tapped card ID: ${venueId}`);
                       navigateToVenueDetail(venueId); // Navigate on tap

                       // Reset styles immediately if needed (though navigation will likely happen first)
                       venueWrapper.classList.remove("is-swiping");
                       chooseWrapper.classList.remove("is-swiping");
                       venueWrapper.style.transform = `translateX(0px)`;
                       chooseWrapper.style.transform = `translateX(0px)`;
                   }
                   // --- SWIPE END LOGIC ---
                   else if (isDragging) {
                       console.log("Swipe end processing.");
                       const threshold = cardWidth / 4;
                       let newIndex = currentVenueIndex;

                       if (diffX < -threshold && currentVenueIndex < fetchedVenueData.length - 1) {
                           newIndex++; console.log("Swipe Left -> new index:", newIndex);
                       } else if (diffX > threshold && currentVenueIndex > 0) {
                           newIndex--; console.log("Swipe Right -> new index:", newIndex);
                       } else {
                            console.log("Swipe did not cross threshold or at boundary.");
                       }

                       // Snap back animation
                       venueWrapper.style.transition = "transform 0.3s ease-out";
                       chooseWrapper.style.transition = "transform 0.3s ease-out";
                       venueWrapper.style.transform = `translateX(0px)`;
                       chooseWrapper.style.transform = `translateX(0px)`;

                       setTimeout(() => {
                           venueWrapper.style.transition = "";
                           chooseWrapper.style.transition = "";
                       }, 300);

                       // Update venue if index changed
                       if (newIndex !== currentVenueIndex) {
                           currentVenueIndex = newIndex;
                           displayVenue(currentVenueIndex);
                       }
                   } else {
                       // It wasn't a drag, wasn't a quick tap (e.g., long press or slow release)
                       // Just snap back without navigating or changing index
                       console.log("Pointer end: Not a swipe, not a tap. Snapping back.");
                       venueWrapper.classList.remove("is-swiping");
                       chooseWrapper.classList.remove("is-swiping");
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
                   startX = null; // Use null to indicate interaction ended
                   startY = null;
                   diffX = 0;
                   touchStartTime = 0;

              }; // --- End handlePointerEnd ---


              // --- Attach Event Listeners ONCE ---
              console.log("Attaching pointer/mouse/touch listeners ONCE.");
              [venueCard, chooseVenueCard].forEach(card => {
                  // Touch Events (Primary for Mobile)
                  card.addEventListener("touchstart", handlePointerStart, { passive: true }); // Can be passive now
                  card.addEventListener("touchmove", handlePointerMove, { passive: false }); // Must be active to preventDefault
                  card.addEventListener("touchend", handlePointerEnd);
                  card.addEventListener("touchcancel", handlePointerEnd); // Handle cancellation

                  // Mouse Events (for Desktop)
                  card.addEventListener("mousedown", handlePointerStart);

                  // Click Listener (Fallback for Desktop / Accessibility)
                  // We use the same navigation function, but triggered by 'click'
                  card.addEventListener('click', (e) => {
                      // IMPORTANT: Prevent click if a touch event already handled navigation
                      // This check is difficult without flags. Let's assume if it wasn't dragging,
                      // and touchend didn't navigate (maybe due to duration), click should work.
                      // A simple check: if the pointer end logic recently ran and *wasn't* a tap, maybe ignore click.
                      // For now, let's rely on the browser's default behavior, hoping touchend navigation stops click.
                      // If double navigation occurs, we might need a flag set in touchend's tap logic.

                      // Only navigate on click if it wasn't part of a drag/swipe
                       if (!isDragging && Math.abs(diffX) < TAP_THRESHOLD_X) {
                           console.log("Click event fallback triggered.");
                           const targetCard = e.currentTarget;
                           const venueId = targetCard.getAttribute('data-venue-id');
                           navigateToVenueDetail(venueId);
                       } else {
                            console.log("Click event ignored (likely after swipe).");
                       }
                  });
              });

              // Attach move/end listeners to the document for mouse events
              document.addEventListener("mousemove", handlePointerMove);
              document.addEventListener("mouseup", handlePointerEnd);
              document.addEventListener("mouseleave", handlePointerEnd); // Catch mouse leaving window

              // --- Initial Swiper Setup ---
              generateDots();
              displayVenue(currentVenueIndex); // Display the first venue

              // --- Resize Handler ---
              window.addEventListener("resize", () => { /* ... (keep existing implementation) ... */ console.log("Window resized."); if (venueCard) cardWidth = venueCard.offsetWidth; updateDots(currentVenueIndex); if (venueMapInstance) { setTimeout(() => { if (venueMapInstance) venueMapInstance.invalidateSize(); }, 150); } });

           } else { console.error("Swiper setup failed: Inner elements missing."); }
      } else { console.warn("Swiper setup skipped: No venue data."); venueCard.innerHTML = '<p class="info-message">No venues available.</p>'; chooseVenueCard.style.display = 'none'; }
  } else { console.warn("Swiper base card elements missing."); }


  // =========================================================================
  // == INTERACTIVE CHECKLIST LOGIC (Keep As Is)
  // =========================================================================
  console.log("Initializing Checklist...");
  // ... (Keep checklist logic exactly as in the previous version) ...
  const checklistKey = "interactiveChecklistState"; const checklistItems = document.querySelectorAll('.interactive-checklist input[type="checkbox"]'); if (checklistItems.length > 0) { console.log(`Found ${checklistItems.length} checklist items.`); function saveChecklistState() { const state = {}; checklistItems.forEach((item) => { if (item.id) { state[item.id] = item.checked; } else { console.warn("Checklist item missing ID:", item); } }); try { localStorage.setItem(checklistKey, JSON.stringify(state)); console.log("Checklist state saved."); } catch (e) { console.error("Error saving checklist state:", e); } } function loadChecklistState() { const savedState = localStorage.getItem(checklistKey); if (savedState) { console.log("Loading checklist state."); try { const state = JSON.parse(savedState); checklistItems.forEach((item) => { if (item.id && state[item.id] !== undefined) { item.checked = state[item.id]; } }); } catch (e) { console.error("Error parsing checklist state:", e); localStorage.removeItem(checklistKey); } } else { console.log("No saved checklist state."); } } checklistItems.forEach((item) => { item.addEventListener("change", saveChecklistState); }); loadChecklistState(); } else { console.warn("No checklist items found."); }

  // =========================================================================
  // == PLAN SWITCHER BUTTONS (Keep As Is)
  // =========================================================================
  console.log("Initializing Plan Switcher Buttons...");
  // ... (Keep plan switcher logic exactly as in the previous version) ...
  if (fetchedPlanData.length > 0) { console.log(`Creating ${fetchedPlanData.length} plan switcher buttons.`); const planSwitcherContainer = document.createElement("div"); planSwitcherContainer.className = "plan-switcher-container"; planSwitcherContainer.style.textAlign = "center"; planSwitcherContainer.style.padding = "20px 0"; fetchedPlanData.forEach((plan) => { const button = document.createElement("button"); button.textContent = `Activate ${plan.name || `Plan (ID: ${plan.id})`}`; button.className = "btn btn-secondary btn-switch-plan"; button.style.margin = "0 8px"; button.setAttribute("data-plan-id", plan.id); button.onclick = () => applyPlan(plan); planSwitcherContainer.appendChild(button); }); const featuresSection = document.querySelector(".features"); /* <<< ADAPT SELECTOR */ if (featuresSection?.parentNode) { console.log("Inserting plan switcher before features section."); featuresSection.parentNode.insertBefore(planSwitcherContainer, featuresSection); } else { console.warn("Target section for plan switcher not found, appending to body."); document.body.appendChild(planSwitcherContainer); } } else { console.log("No plan data, skipping plan switcher buttons."); }


  console.log("Frontend Player Initialization Complete.");
}); // --- END DOMContentLoaded ---
