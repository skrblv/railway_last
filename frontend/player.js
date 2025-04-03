// =========================================================================
// == frontend/player.js -- Complete Code with Robust Album Art Update
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
const API_BASE_URL = "/api"; // Deployment API base URL

// !!! CRITICAL CONFIGURATION: Set this to match your backend URL pattern !!!
// Examples: '/venue', '/venues', '/place', '/location'
const VENUE_DETAIL_BASE_PATH = '/venue'; // <<<--- CHECK AND CHANGE THIS PATH IF NEEDED

// !!! VERIFY PATHS RELATIVE TO index.html FOR DEPLOYMENT !!!
const PLACEHOLDER_VENUE_IMAGE = './assets/placeholder-building.jpg';
const PLACEHOLDER_ALBUM_ART = './assets/hq720 (1).jpg'; // Used as fallback in applyPlan

// --- Leaflet Map Variables ---
let venueMapInstance = null; // Holds the Leaflet map instance
let venueMarker = null; // Holds the Leaflet marker instance

// --- Swiper State Variables ---
let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let diffX = 0;
let cardWidth = 0;
let touchStartTime = 0;
const TAP_THRESHOLD_X = 10;
const TAP_THRESHOLD_Y = 15;
const MAX_TAP_DURATION = 300;

// =========================================================================
// == API Fetching Functions (Keep As Is)
// =========================================================================
async function fetchVenues() {
    console.log("Attempting to fetch venues...");
    try { const response = await fetch(`${API_BASE_URL}/venues/`); if (!response.ok) { throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`); } const contentType = response.headers.get("content-type"); if (contentType && contentType.includes("application/json")) { const rawData = await response.json(); const data = rawData.results || rawData; if (!Array.isArray(data)) { console.warn("Fetched venue data is not an array, resetting.", data); fetchedVenueData = []; } else { fetchedVenueData = data; console.log("Fetched Venues:", fetchedVenueData.length, "items"); } } else { const textResponse = await response.text(); throw new Error(`Expected JSON, but received ${contentType}. Response: ${textResponse}`); } } catch (error) { console.error("Could not fetch venues:", error); fetchedVenueData = []; const swiperSection = document.getElementById("venue-details-card")?.parentElement; if(swiperSection) swiperSection.innerHTML = `<p class="error-message">Error loading venues: ${error.message}</p>`; }
}
async function fetchPlans() {
    console.log("Attempting to fetch plans...");
    try { const response = await fetch(`${API_BASE_URL}/plans/`); if (!response.ok) { throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`); } const contentType = response.headers.get("content-type"); if (contentType && contentType.includes("application/json")) { const rawData = await response.json(); fetchedPlanData = rawData.results || rawData; console.log("Fetched Plans:", fetchedPlanData); if (!Array.isArray(fetchedPlanData)) { console.warn("Fetched plan data is not an array, resetting.", fetchedPlanData); fetchedPlanData = []; } if (fetchedPlanData.length > 0) { currentPlan = fetchedPlanData.find((p) => p.name?.toLowerCase() === "plan a") || fetchedPlanData[0]; console.log("Initial plan set to:", currentPlan?.name || 'First Plan'); applyPlan(currentPlan); } else { console.log("No plans fetched."); applyPlan(null); } } else { const textResponse = await response.text(); throw new Error(`Expected JSON, but received ${contentType}. Response: ${textResponse}`); } } catch (error) { console.error("Could not fetch plans:", error); fetchedPlanData = []; applyPlan(null); }
}

// =========================================================================
// == Plan Application & Audio Handling (UPDATED applyPlan for Album Art)
// =========================================================================

// --- Define Handlers Outside applyPlan for Stability ---
const handleMetadataLoad = (shouldResume, songUrl) => {
    const totalTimeEl = document.getElementById("total-time");
    const audioPlayer = document.getElementById("audio-player");
    console.log("Metadata loaded.");
    if (totalTimeEl && audioPlayer?.duration && !isNaN(audioPlayer.duration)) {
        console.log(`Duration: ${audioPlayer.duration}`);
        totalTimeEl.textContent = formatTime(audioPlayer.duration);
    } else if (totalTimeEl) {
        totalTimeEl.textContent = "0:00";
    }
    if (shouldResume && songUrl && audioPlayer?.paused) {
        console.log("Attempting to resume playback...");
        audioPlayer.play().then(updatePlayPauseIconState).catch(e => console.error("Audio play failed after metadata load:", e));
    } else if (audioPlayer && !audioPlayer.paused) {
        console.log("Audio already playing or should not resume.");
        updatePlayPauseIconState();
    } else {
        console.log("Not resuming playback.");
        updatePlayPauseIconState();
    }
    // Clean up listeners added in applyPlan
    if(audioPlayer) {
        audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad); // Remove itself
        audioPlayer.removeEventListener("error", handleAudioError);
    }
};

const handleAudioError = (e) => {
    console.error("Audio Player Error:", e.target.error?.message || 'Unknown error', e);
    const totalTimeEl = document.getElementById("total-time");
    const progress = document.getElementById("progress");
    const currentTimeEl = document.getElementById("current-time");
    const audioPlayer = document.getElementById("audio-player");
    if (totalTimeEl) totalTimeEl.textContent = "Error";
    if (progress) progress.style.width = "0%";
    if (currentTimeEl) currentTimeEl.textContent = "0:00";
    updatePlayPauseIconState();
    // Clean up listeners added in applyPlan
    if(audioPlayer) {
        audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad);
        audioPlayer.removeEventListener("error", handleAudioError); // Remove itself
    }
};

/**
 * Applies the selected plan: sets the theme and updates the music player UI,
 * including robust handling for album art updates.
 * @param {object | null} plan - The plan object or null to reset to default.
 */
function applyPlan(plan) {
    const body = document.body;
    const musicPlayer = document.querySelector(".music-player");
    const audioPlayer = document.getElementById("audio-player");
    const albumArt = musicPlayer?.querySelector(".album-art"); // Select the <img> tag directly
    const trackTitleEl = musicPlayer?.querySelector("#track-title");
    const artistNameEl = musicPlayer?.querySelector("#artist-name");
    const progress = document.getElementById("progress");
    const currentTimeEl = document.getElementById("current-time");
    const totalTimeEl = document.getElementById("total-time");
    const playPauseIcon = document.getElementById("play-pause-icon"); // Needed for default state
    const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M8 5v14l11-7z"/></svg>`; // Needed for default state

    // --- Handle Resetting to Default (No Plan) ---
    if (!plan) {
        console.log("Applying default state (no plan).");
        currentPlan = null;
        body.classList.remove("theme-positive", "theme-sad");
        if (audioPlayer) {
            if (!audioPlayer.paused) audioPlayer.pause();
            audioPlayer.src = "";
        }
        // Reset UI elements
        if (albumArt) { albumArt.src = PLACEHOLDER_ALBUM_ART; albumArt.alt = "Album Art"; albumArt.onerror = null; albumArt.onload = null; } // Reset fallback and handlers
        if (trackTitleEl) trackTitleEl.textContent = "Track Title";
        if (artistNameEl) artistNameEl.textContent = "Artist Name";
        if (progress) progress.style.width = "0%";
        if (currentTimeEl) currentTimeEl.textContent = "0:00";
        if (totalTimeEl) totalTimeEl.textContent = "0:00";
        if (playPauseIcon) playPauseIcon.innerHTML = playIconSvg;
        // Remove potential listeners from previous track
        if(audioPlayer) {
            audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad);
            audioPlayer.removeEventListener("error", handleAudioError);
        }
        return; // Exit after resetting
    }

    // --- Apply Specific Plan ---
    console.log("Applying Plan:", plan.name || `(ID: ${plan.id})`);
    currentPlan = plan; // Update global state

    // 1. Apply Theme
    body.classList.remove("theme-positive", "theme-sad");
    if (plan.theme === "positive") body.classList.add("theme-positive");
    else if (plan.theme === "sad") body.classList.add("theme-sad");
    else console.warn(`Plan '${plan.name}' has unknown theme:`, plan.theme);

    // 2. Update Music Player
    if (!musicPlayer || !audioPlayer) { console.warn("Music player elements missing."); return; }

    let wasPlaying = !audioPlayer.paused && audioPlayer.currentTime > 0 && audioPlayer.src;

    // Update Audio Source
    const newSongUrl = plan.song_url;
    const currentFullSrc = audioPlayer.src;
    if (newSongUrl && currentFullSrc !== newSongUrl) {
        console.log("Setting new audio source:", newSongUrl);
        audioPlayer.src = newSongUrl;
        audioPlayer.load(); // Important to load new source
    } else if (!newSongUrl) {
        console.warn(`Plan "${plan.name}" has no song_url.`);
        if (!audioPlayer.paused) audioPlayer.pause();
        audioPlayer.src = ""; wasPlaying = false;
    } else { console.log("Audio source is the same."); }

    // Update Metadata (Title, Artist)
    if (trackTitleEl) trackTitleEl.textContent = plan.track_title || "Unknown Track";
    if (artistNameEl) artistNameEl.textContent = plan.artist_name || "Unknown Artist";

    // --- *** UPDATE ALBUM ART *** ---
    if (albumArt) {
        const defaultArtSrc = PLACEHOLDER_ALBUM_ART; // Use constant
        const targetAlbumArtSrc = plan.album_art_url || defaultArtSrc;

        console.log(`[AlbumArt] Plan: ${plan.name}. Attempting URL: ${plan.album_art_url}`);
        console.log(`[AlbumArt] Target src determined as: ${targetAlbumArtSrc}`);

        // Only update src if it's actually different to prevent reload/flicker
        if (albumArt.src !== targetAlbumArtSrc) {
            console.log(`[AlbumArt] Current src (${albumArt.src}) differs. Setting new src.`);

            // Clear previous handlers before setting new src
            albumArt.onerror = null;
            albumArt.onload = null;

            albumArt.src = targetAlbumArtSrc; // Set the new source

            // Add error handler for the *new* image source
            albumArt.onerror = () => {
                if (albumArt.src !== defaultArtSrc) { // Avoid infinite loop if default fails
                    console.error(`[AlbumArt] Failed to load: ${targetAlbumArtSrc}. Falling back to default: ${defaultArtSrc}`);
                    albumArt.src = defaultArtSrc; // Set default on error
                } else {
                    console.error(`[AlbumArt] CRITICAL: Failed to load DEFAULT image: ${defaultArtSrc}`);
                    albumArt.alt = "Error loading image"; // Show error state
                }
                albumArt.onerror = null; // Remove handler after it fires
                albumArt.onload = null;
            };

            // Optional: Add onload handler to remove onerror if successful
            albumArt.onload = () => {
                console.log(`[AlbumArt] Successfully loaded: ${albumArt.src}`);
                albumArt.onerror = null; // Clean up error handler
                albumArt.onload = null; // Clean up this handler too
            };

        } else {
            console.log(`[AlbumArt] Target src is the same as current src. No change needed.`);
            // Ensure handlers are cleared if src didn't change but might have failed before
            albumArt.onerror = null;
            albumArt.onload = null;
        }
        // Always update alt text
        albumArt.alt = plan.track_title || "Album Art";
    } else {
        console.warn("Album art element (.album-art img) not found.");
    }
    // --- *** END UPDATE ALBUM ART *** ---

    // Reset player progress UI
    if (progress) progress.style.width = "0%";
    if (currentTimeEl) currentTimeEl.textContent = "0:00";
    if (totalTimeEl) totalTimeEl.textContent = "0:00";

    // Attach one-time listeners for the new audio track
    // Define the handlers using the necessary context (wasPlaying, songUrl)
    const metadataHandler = () => handleMetadataLoad(wasPlaying, plan.song_url);
    const errorHandler = (e) => handleAudioError(e); // Pass event object

    // Remove previous potentially attached listeners before adding new ones
    audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad); // Remove reference to the *function itself*
    audioPlayer.removeEventListener("error", handleAudioError); // Remove reference to the *function itself*

    // Add new one-time listeners
    audioPlayer.addEventListener("loadedmetadata", metadataHandler, { once: true });
    audioPlayer.addEventListener("error", errorHandler, { once: true });

    // Update play/pause icon state immediately
    updatePlayPauseIconState();
}


// =========================================================================
// == DOMContentLoaded Event Listener (Main Execution Block)
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM loaded. Starting initialization...");

  // --- Fetch data FIRST ---
  console.log("Fetching initial venue and plan data...");
  try {
      await Promise.all([ fetchVenues(), fetchPlans() ]); // Fetch in parallel
      console.log("Initial data fetching complete.");
  } catch (error) { console.error("Error during initial data fetch:", error); /* Error handled in fetch functions */ }

  // =========================================================================
  // == MUSIC PLAYER LOGIC (Attaching Controls - Keep As Is)
  // =========================================================================
  console.log("Initializing Music Player Controls...");
  const audioPlayer = document.getElementById("audio-player");
  const playPauseBtn = document.getElementById("play-pause-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const progressContainer = document.getElementById("progress-container");
  const volumeSlider = document.getElementById("volume-slider");

  if (audioPlayer && playPauseBtn && prevBtn && nextBtn && progressContainer && volumeSlider)
  {
      console.log("Music player elements found. Attaching listeners.");
      function togglePlayPause() {
         if (!audioPlayer.src && currentPlan?.song_url) {
             console.log("No audio source, applying plan to play.");
             // Set flag *before* applyPlan so handleMetadataLoad knows to play
             const playNowMetadataHandler = () => handleMetadataLoad(true, currentPlan.song_url);
             // Make sure old one is removed before adding new specific one
             audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad); // Remove generic handler if exists
             audioPlayer.removeEventListener("loadedmetadata", playNowMetadataHandler); // Remove previous intent handler
             audioPlayer.addEventListener("loadedmetadata", playNowMetadataHandler, { once: true }); // Add specific intent handler
             applyPlan(currentPlan);
             return;
         } else if (!audioPlayer.src) { console.warn("Cannot play: No audio source."); return; }
         if (audioPlayer.paused) { audioPlayer.play().catch(e => console.error("Audio play failed:", e)); }
         else { audioPlayer.pause(); }
         // updatePlayPauseIconState will be called by play/pause events
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
      function changeVolume() { if(volumeSlider) audioPlayer.volume = Math.max(0, Math.min(1, volumeSlider.value / 100)); }
      function restartSong() { if (!audioPlayer.src || isNaN(audioPlayer.duration)) return; audioPlayer.currentTime = 0; if (audioPlayer.paused) updateProgress(); else audioPlayer.play().catch(e => console.error("Audio play failed on restart:", e)); }
      function nextSongPlaceholder() { console.log("Next button: placeholder action (restarting)."); restartSong(); }

      playPauseBtn.addEventListener("click", togglePlayPause);
      audioPlayer.addEventListener("timeupdate", updateProgress);
      audioPlayer.addEventListener("play", updatePlayPauseIconState); // Persistent listener
      audioPlayer.addEventListener("pause", updatePlayPauseIconState); // Persistent listener
      audioPlayer.addEventListener("ended", restartSong); // Persistent listener (Looping)
      progressContainer.addEventListener("click", seek);
      volumeSlider.addEventListener("input", changeVolume);
      prevBtn.addEventListener("click", restartSong);
      nextBtn.addEventListener("click", nextSongPlaceholder); // Using placeholder action

      changeVolume(); // Set initial volume
      updatePlayPauseIconState(); // Set initial icon state
  } else { console.warn("Music player core elements missing, controls not fully attached."); }

  // =========================================================================
  // == COUNTDOWN TIMER LOGIC (Keep As Is)
  // =========================================================================
  console.log("Initializing Countdown Timer...");
  const datePicker = document.getElementById("event-date-picker"); const setDateBtn = document.getElementById("set-date-btn"); const daysNumEl = document.getElementById("days-num"); const hoursNumEl = document.getElementById("hours-num"); const minutesNumEl = document.getElementById("minutes-num"); const secondsNumEl = document.getElementById("seconds-num"); const calDay1El = document.getElementById("cal-day-1"); const calDay2El = document.getElementById("cal-day-2"); const calDay3El = document.getElementById("cal-day-3");
  if (datePicker && setDateBtn && daysNumEl && hoursNumEl && minutesNumEl && secondsNumEl && calDay1El && calDay2El && calDay3El ) { console.log("Countdown timer elements found."); const localStorageKey = "targetEventDate"; let targetDate = null; let countdownInterval = null; function updateCalendarDisplay(dateObj) { if (!dateObj || isNaN(dateObj.getTime())) { calDay1El.textContent = "--"; calDay2El.textContent = "--"; calDay3El.textContent = "--"; calDay1El.classList.remove("highlight"); calDay2El.classList.add("highlight"); calDay3El.classList.remove("highlight"); return; } const targetDay = dateObj.getUTCDate(); const prevDate = new Date(dateObj); prevDate.setUTCDate(targetDay - 1); const nextDate = new Date(dateObj); nextDate.setUTCDate(targetDay + 1); calDay1El.textContent = padZero(prevDate.getUTCDate()); calDay2El.textContent = padZero(targetDay); calDay3El.textContent = padZero(nextDate.getUTCDate()); calDay1El.classList.remove("highlight"); calDay2El.classList.add("highlight"); calDay3El.classList.remove("highlight"); } function updateCountdown() { if (!targetDate || isNaN(targetDate.getTime())) { daysNumEl.textContent = "--"; hoursNumEl.textContent = "--"; minutesNumEl.textContent = "--"; secondsNumEl.textContent = "--"; return; } const now = new Date().getTime(); const difference = targetDate.getTime() - now; if (difference <= 0) { daysNumEl.textContent = "00"; hoursNumEl.textContent = "00"; minutesNumEl.textContent = "00"; secondsNumEl.textContent = "00"; if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; } return; } const days = Math.floor(difference / 86400000); const hours = Math.floor((difference % 86400000) / 3600000); const minutes = Math.floor((difference % 3600000) / 60000); const seconds = Math.floor((difference % 60000) / 1000); daysNumEl.textContent = padZero(days); hoursNumEl.textContent = padZero(hours); minutesNumEl.textContent = padZero(minutes); secondsNumEl.textContent = padZero(seconds); } function startCountdown() { if (countdownInterval) clearInterval(countdownInterval); if (targetDate && !isNaN(targetDate.getTime()) && targetDate.getTime() > new Date().getTime()) { updateCountdown(); countdownInterval = setInterval(updateCountdown, 1000); } else { updateCountdown(); } } function handleSetDate() { const selectedDateString = datePicker.value; if (!selectedDateString) { alert("Please select a date."); return; } const parts = selectedDateString.split("-"); if (parts.length !== 3) { alert("Invalid date format."); return; } const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10) - 1; const day = parseInt(parts[2], 10); if (isNaN(year) || isNaN(month) || isNaN(day)) { alert("Invalid date components."); return; } const potentialTargetDate = new Date(Date.UTC(year, month, day, 0, 0, 0)); if (isNaN(potentialTargetDate.getTime())) { alert("Invalid date selected."); return; } const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0); if (potentialTargetDate < todayUTC) { alert("Please select today or a future date."); return; } localStorage.setItem(localStorageKey, selectedDateString); targetDate = potentialTargetDate; updateCalendarDisplay(targetDate); startCountdown(); console.log("New target date set:", targetDate); } function loadDateFromStorage() { const storedDateString = localStorage.getItem(localStorageKey); if (storedDateString) { const parts = storedDateString.split("-"); if (parts.length === 3) { const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10) - 1; const day = parseInt(parts[2], 10); if (!isNaN(year) && !isNaN(month) && !isNaN(day)) { const loadedDate = new Date(Date.UTC(year, month, day, 0, 0, 0)); if (!isNaN(loadedDate.getTime())) { targetDate = loadedDate; datePicker.value = storedDateString; console.log("Loaded target date from storage:", targetDate); updateCalendarDisplay(targetDate); startCountdown(); return; } } } console.warn("Invalid date string found in localStorage, removing."); localStorage.removeItem(localStorageKey); } console.log("No valid date in storage, initializing default display."); updateCalendarDisplay(null); updateCountdown(); } setDateBtn.addEventListener("click", handleSetDate); loadDateFromStorage(); } else { console.warn("Countdown timer elements missing."); }

  // =========================================================================
  // == LEAFLET MAP INITIALIZATION (Keep As Is)
  // =========================================================================
  console.log("Initializing Leaflet Map...");
  const venueMapContainer = document.getElementById("venue-map"); if (venueMapContainer && typeof L !== "undefined") { console.log("Map container and Leaflet library found."); if (fetchedVenueData.length > 0) { try { const firstVenue = fetchedVenueData[0]; const initialCoords = firstVenue?.latitude != null && firstVenue?.longitude != null ? [firstVenue.latitude, firstVenue.longitude] : [42.8749, 74.6049]; console.log("Initializing map at coords:", initialCoords); venueMapInstance = L.map(venueMapContainer, { zoomControl: false, attributionControl: false }).setView(initialCoords, MAP_ZOOM_LEVEL); L.control.zoom({ position: "bottomright" }).addTo(venueMapInstance); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(venueMapInstance); venueMarker = L.marker(initialCoords).addTo(venueMapInstance); if (firstVenue?.name) { venueMarker.bindPopup(`<b>${firstVenue.name}</b>`).openPopup(); } setTimeout(() => { if (venueMapInstance) { console.log("Invalidating map size."); venueMapInstance.invalidateSize(); } }, 250); } catch (error) { console.error("Error initializing Leaflet map:", error); if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Error loading map.</p>"; } } else { console.warn("Map init skipped: No venue data."); if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>No venues for map.</p>"; } } else { if (!venueMapContainer) console.warn("Map container #venue-map missing."); if (typeof L === "undefined") console.warn("Leaflet library (L) missing."); if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Map disabled.</p>"; }

  // =========================================================================
  // == VENUE SWIPER LOGIC (Using Robust Tap/Click Handling)
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

              // --- Swiper Helper Functions ---
              function setupCardWidth() { cardWidth = venueCard.offsetWidth || 220; }
              function generateDots() { allDotsInnerContainers.forEach((di) => { if(di){ di.innerHTML=""; fetchedVenueData.forEach(()=>di.appendChild(document.createElement("span"))); }}); }
              function updateDots(activeIndex) { if (activeIndex < 0 || activeIndex >= fetchedVenueData.length) return; allDotsInnerContainers.forEach((di)=>{ if(!di) return; const dots = di.querySelectorAll("span"); const dc = di.parentElement; if(!dc||!dots.length) return; dots.forEach((d,i)=>d.classList.toggle("active",i===activeIndex)); const dw=(DOT_WIDTH+DOT_MARGIN*2), cw=dc.offsetWidth, tw=dots.length*dw, aco=activeIndex*dw+dw/2, tx=cw/2-aco; if(tw>cw){di.style.transform=`translateX(${Math.max(cw-tw,Math.min(0,tx))}px)`;}else{di.style.transform=`translateX(${(cw-tw)/2}px)`;} }); }
              function updateVenueMap(lat, lng, venueName) { if (!venueMapInstance || !venueMarker) return; if (typeof lat==="number" && typeof lng==="number"){const ll=L.latLng(lat,lng); venueMapInstance.setView(ll,MAP_ZOOM_LEVEL,{animate:true,pan:{duration:0.5}}); venueMarker.setLatLng(ll); if(venueName) venueMarker.setPopupContent(`<b>${venueName}</b>`); setTimeout(()=>venueMapInstance?.invalidateSize(),150);} else { console.warn(`Map update skipped: Invalid coords for ${venueName}`);} }

              // --- Display Venue (Updates UI Only) ---
              function displayVenue(index) {
                  if (index < 0 || index >= fetchedVenueData.length) return;
                  const venueData = fetchedVenueData[index];
                  const currentVenueId = venueData.id;
                  console.log(`Displaying venue index: ${index}, ID: ${currentVenueId}, Name: ${venueData?.name}`);

                  // Set data-id on the main card elements for the unified click/tap handler
                  venueCard.setAttribute('data-venue-id', currentVenueId ?? '');
                  chooseVenueCard.setAttribute('data-venue-id', currentVenueId ?? '');

                  // Update content (assuming querySelectors work within the correct scope)
                  venueWrapper.querySelector(".venue-name").textContent = venueData.name || "Venue";
                  venueWrapper.querySelector(".venue-date").textContent = venueData.date_text || "--";
                  venueCard.style.backgroundImage = venueData.image_url ? `url('${venueData.image_url}')` : `url('${PLACEHOLDER_VENUE_IMAGE}')`;
                  chooseWrapper.querySelector(".venue-header").textContent = venueData.rating_text || "Details";
                  const ratingEl = chooseWrapper.querySelector(".rating");
                  if(ratingEl) { const rVal=Math.round(venueData.rating_stars||0); ratingEl.innerHTML = '★'.repeat(rVal)+'☆'.repeat(5-rVal); }
                  const iconsContainer = chooseWrapper.querySelector(".venue-icons");
                  if(iconsContainer) { iconsContainer.innerHTML = `${venueData.venue_icon1 ? `<span>${venueData.venue_icon1}</span>`: ''} ${venueData.venue_icon2 ? `<span>${venueData.venue_icon2}</span>`: ''}`; }

                  updateVenueMap(venueData.latitude, venueData.longitude, venueData.name);
                  updateDots(index);
              }

              // --- Event Handlers (Defined ONCE) ---
              const handlePointerStart = (e) => {
                 if (e.target.closest("button, input, a, .dots, .leaflet-container")) return;
                 isDragging = false; startX = e.type.includes("mouse")?e.clientX:e.touches[0].clientX; startY = e.type.includes("mouse")?e.clientY:e.touches[0].clientY; currentX = startX; diffX = 0; touchStartTime = Date.now(); cardWidth = venueCard.offsetWidth; venueWrapper.classList.add("is-swiping"); chooseWrapper.classList.add("is-swiping"); console.log(`Pointer start at X: ${startX}, Y: ${startY}`);
              };
              const handlePointerMove = (e) => {
                 if (startX === null) return; // Check if interaction already ended
                 currentX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
                 const currentY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
                 diffX = currentX - startX;
                 const diffY = currentY - startY;
                 if (!isDragging) {
                     if (Math.abs(diffY) > TAP_THRESHOLD_Y && Math.abs(diffY) > Math.abs(diffX) * 1.2) { // More vertical movement? Likely scroll.
                        console.log("Vertical scroll detected, cancel swipe drag."); startX = null; venueWrapper.classList.remove("is-swiping"); chooseWrapper.classList.remove("is-swiping"); return;
                     }
                     if (Math.abs(diffX) > TAP_THRESHOLD_X) { isDragging = true; console.log("Dragging started."); }
                 }
                 if (isDragging) {
                     venueWrapper.style.transform = `translateX(${diffX}px)`; chooseWrapper.style.transform = `translateX(${diffX}px)`;
                     if (e.cancelable && e.type.includes("touch")) e.preventDefault(); // Prevent scroll only when dragging horizontally
                 }
              };
              const handlePointerEnd = (e) => {
                 if (startX === null) return; // Interaction already ended/cancelled
                 const touchDuration = Date.now() - touchStartTime;
                 const isTap = !isDragging && touchDuration < MAX_TAP_DURATION && Math.abs(diffX) < TAP_THRESHOLD_X && Math.abs((e.type.includes("mouse")?e.clientY:e.changedTouches[0].clientY) - startY) < TAP_THRESHOLD_Y;
                 console.log(`Pointer end. Dragging: ${isDragging}, Duration: ${touchDuration}ms, diffX: ${diffX}, isTap: ${isTap}`);

                 if (isTap) {
                     console.log("Tap detected!");
                     const targetCard = e.currentTarget; // Card element where listener is attached
                     const venueId = targetCard.getAttribute('data-venue-id');
                     navigateToVenueDetail(venueId);
                     // No need to snap back manually, navigation will occur
                 } else if (isDragging) { // Handle swipe end
                      console.log("Swipe end processing.");
                      const threshold = cardWidth / 4; let newIndex = currentVenueIndex;
                      if (diffX < -threshold && currentVenueIndex < fetchedVenueData.length - 1) newIndex++;
                      else if (diffX > threshold && currentVenueIndex > 0) newIndex--;
                      // Snap back animation
                      venueWrapper.style.transition = "transform 0.3s ease-out"; chooseWrapper.style.transition = "transform 0.3s ease-out";
                      venueWrapper.style.transform = `translateX(0px)`; chooseWrapper.style.transform = `translateX(0px)`;
                      setTimeout(() => { venueWrapper.style.transition = ""; chooseWrapper.style.transition = ""; }, 300);
                      if (newIndex !== currentVenueIndex) { currentVenueIndex = newIndex; displayVenue(currentVenueIndex); }
                 } else { // Not a tap, not a swipe (e.g., long press, slow release) - just snap back
                     console.log("Pointer end: Not tap/swipe. Snapping back.");
                     venueWrapper.style.transition = "transform 0.3s ease-out"; chooseWrapper.style.transition = "transform 0.3s ease-out";
                     venueWrapper.style.transform = `translateX(0px)`; chooseWrapper.style.transform = `translateX(0px)`;
                     setTimeout(() => { venueWrapper.style.transition = ""; chooseWrapper.style.transition = ""; }, 300);
                 }
                 // Reset state for next interaction
                 isDragging = false; startX = null; startY = null; diffX = 0; touchStartTime = 0;
                 venueWrapper.classList.remove("is-swiping"); chooseWrapper.classList.remove("is-swiping");
              };

              // --- Attach Event Listeners ONCE to the main card elements ---
              console.log("Attaching pointer/mouse/touch listeners ONCE to swiper cards.");
              [venueCard, chooseVenueCard].forEach(card => {
                  card.addEventListener("touchstart", handlePointerStart, { passive: true });
                  card.addEventListener("touchmove", handlePointerMove, { passive: false });
                  card.addEventListener("touchend", handlePointerEnd);
                  card.addEventListener("touchcancel", handlePointerEnd);
                  card.addEventListener("mousedown", handlePointerStart);
                  // Mouse move/up listeners are on document
              });
              // Attach mouse move/up to document
              document.addEventListener("mousemove", handlePointerMove);
              document.addEventListener("mouseup", handlePointerEnd);
              document.addEventListener("mouseleave", handlePointerEnd); // Handle mouse leaving window

              // --- Initial Swiper Setup ---
              setupCardWidth(); generateDots(); displayVenue(currentVenueIndex);

              // --- Resize Handler ---
              window.addEventListener("resize", () => { setupCardWidth(); updateDots(currentVenueIndex); if(venueMapInstance) setTimeout(()=>venueMapInstance.invalidateSize(),150); });

           } else { console.error("Swiper setup failed: Inner elements missing."); }
      } else { console.warn("Swiper setup skipped: No venue data."); if(venueCard) venueCard.innerHTML = '<p class="info-message">No venues available.</p>'; if(chooseVenueCard) chooseVenueCard.style.display = 'none'; }
  } else { console.warn("Swiper base card elements missing."); }


  // =========================================================================
  // == INTERACTIVE CHECKLIST LOGIC (Keep As Is)
  // =========================================================================
  console.log("Initializing Checklist...");
  const checklistKey = "interactiveChecklistState"; const checklistItems = document.querySelectorAll('.interactive-checklist input[type="checkbox"]'); if (checklistItems.length > 0) { console.log(`Found ${checklistItems.length} checklist items.`); function saveChecklistState() { const state = {}; checklistItems.forEach((item) => { if (item.id) state[item.id] = item.checked; }); try { localStorage.setItem(checklistKey, JSON.stringify(state)); } catch (e) { console.error("Error saving checklist state:", e); } } function loadChecklistState() { const savedState = localStorage.getItem(checklistKey); if (savedState) { console.log("Loading checklist state."); try { const state = JSON.parse(savedState); checklistItems.forEach((item) => { if (item.id && state[item.id] !== undefined) item.checked = state[item.id]; }); } catch (e) { console.error("Error parsing checklist state:", e); localStorage.removeItem(checklistKey); } } else { console.log("No saved checklist state."); } } checklistItems.forEach((item) => { item.addEventListener("change", saveChecklistState); }); loadChecklistState(); } else { console.warn("No checklist items found."); }

  // =========================================================================
  // == PLAN SWITCHER BUTTONS (Keep As Is)
  // =========================================================================
  console.log("Initializing Plan Switcher Buttons...");
  const planSwitcherPlaceholder = document.getElementById('plan-switcher-placeholder'); if (planSwitcherPlaceholder) { planSwitcherPlaceholder.innerHTML = ''; if (fetchedPlanData?.length) { console.log(`Creating ${fetchedPlanData.length} plan switcher buttons.`); planSwitcherPlaceholder.style.textAlign = "center"; planSwitcherPlaceholder.style.padding = "20px 0"; fetchedPlanData.forEach((plan) => { const button = document.createElement("button"); button.textContent = `Activate ${plan.name || `Plan (ID: ${plan.id})`}`; button.className = "btn btn-secondary btn-switch-plan"; button.style.margin = "0 8px"; button.setAttribute("data-plan-id", plan.id); button.onclick = () => applyPlan(plan); planSwitcherPlaceholder.appendChild(button); }); const featuresSection = document.querySelector(".features"); if (featuresSection?.parentNode) { console.log("Inserting plan switcher before features section."); featuresSection.parentNode.insertBefore(planSwitcherPlaceholder, featuresSection); } else { console.warn("Target section for plan switcher not found, appending to body."); document.body.appendChild(planSwitcherPlaceholder); } } else { console.log("No plan data, skipping plan switcher buttons."); planSwitcherPlaceholder.textContent = 'No alternative plans available.'; planSwitcherPlaceholder.style.fontSize='0.9em'; planSwitcherPlaceholder.style.color='var(--text-color)'; planSwitcherPlaceholder.style.padding='10px 0'; } } else { console.warn("Plan switcher placeholder not found in HTML."); }

  console.log("Frontend Player Initialization Complete.");
}); // --- END DOMContentLoaded ---
