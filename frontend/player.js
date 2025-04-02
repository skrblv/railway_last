// =========================================================================
// == frontend/player.js -- Complete Code with Click Fix
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
const VENUE_DETAIL_BASE_PATH = '/venue'; // !!! ADAPT THIS: Base path for venue detail URLs (e.g., /venue/{id}/ or /venues/{id}/)
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
  console.log("Attempting to fetch venues...");
  try {
    const response = await fetch(`${API_BASE_URL}/venues/`); // Assumes /api/venues/ endpoint
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      fetchedVenueData = await response.json();
      console.log("Fetched Venues:", fetchedVenueData);
      if (!Array.isArray(fetchedVenueData)) {
           console.warn("Fetched venue data is not an array, resetting.", fetchedVenueData);
           fetchedVenueData = [];
      }
    } else {
      const textResponse = await response.text();
      throw new Error(`Expected JSON, but received ${contentType}. Response: ${textResponse}`);
    }
  } catch (error) {
    console.error("Could not fetch venues:", error);
    fetchedVenueData = []; // Ensure it's an empty array on error
    // Optionally display an error message to the user on the page
    const swiperSection = document.getElementById("venue-details-card")?.parentElement; // Find swiper container
     if(swiperSection) swiperSection.innerHTML = `<p class="error-message">Error loading venues: ${error.message}</p>`;
  }
}

/**
 * Fetches the list of plans (themes/music) from the backend API.
 */
async function fetchPlans() {
    console.log("Attempting to fetch plans...");
  try {
    const response = await fetch(`${API_BASE_URL}/plans/`); // Assumes /api/plans/ endpoint
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      fetchedPlanData = await response.json();
      console.log("Fetched Plans:", fetchedPlanData);
       if (!Array.isArray(fetchedPlanData)) {
           console.warn("Fetched plan data is not an array, resetting.", fetchedPlanData);
           fetchedPlanData = [];
      }
      // Set a default plan initially if plans were fetched
      if (fetchedPlanData.length > 0) {
        // Try to find 'Plan A' (case-insensitive), otherwise default to the first plan
        currentPlan =
          fetchedPlanData.find((p) => p.name?.toLowerCase() === "plan a") || fetchedPlanData[0];
        console.log("Initial plan set to:", currentPlan?.name || 'First Plan');
        applyPlan(currentPlan); // Apply the initial plan's theme and music
      } else {
          console.log("No plans fetched or plans array is empty.");
          // Apply default theme/reset player if needed when no plans exist
          applyPlan(null); // Call with null to reset
      }
    } else {
      const textResponse = await response.text();
      throw new Error(`Expected JSON, but received ${contentType}. Response: ${textResponse}`);
    }
  } catch (error) {
    console.error("Could not fetch plans:", error);
    fetchedPlanData = [];
    applyPlan(null); // Reset on error
     // Optionally display an error message to the user related to plans/themes
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
  const musicPlayer = document.querySelector(".music-player"); // Main player container
  const audioPlayer = document.getElementById("audio-player"); // <audio> element
  const albumArt = musicPlayer?.querySelector(".album-art img"); // Find img inside .album-art
  const trackTitleEl = musicPlayer?.querySelector("#track-title");
  const artistNameEl = musicPlayer?.querySelector("#artist-name");
  const progress = document.getElementById("progress");
  const currentTimeEl = document.getElementById("current-time");
  const totalTimeEl = document.getElementById("total-time");
  const playPauseIcon = document.getElementById("play-pause-icon");
  const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M8 5v14l11-7z"/></svg>`;

  // --- Reset/Defaults if no plan ---
  if (!plan) {
    console.log("Applying default state (no plan or reset).");
    currentPlan = null;
    body.classList.remove("theme-positive", "theme-sad"); // Remove specific themes
    // You might want a default theme class here if applicable

    if (audioPlayer) {
        if (!audioPlayer.paused) audioPlayer.pause();
        audioPlayer.src = ""; // Clear audio source
    }
     if (albumArt) {
         albumArt.src = PLACEHOLDER_ALBUM_ART;
         albumArt.alt = "Album Art";
     }
    if (trackTitleEl) trackTitleEl.textContent = "Track Title";
    if (artistNameEl) artistNameEl.textContent = "Artist Name";
    if (progress) progress.style.width = "0%";
    if (currentTimeEl) currentTimeEl.textContent = "0:00";
    if (totalTimeEl) totalTimeEl.textContent = "0:00";
    if (playPauseIcon) playPauseIcon.innerHTML = playIconSvg; // Show play icon

    // Remove event listeners specific to a track
    if(audioPlayer) {
        audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad);
        audioPlayer.removeEventListener("error", handleAudioError);
    }
    return; // Exit after resetting
  }

  console.log("Applying Plan:", plan.name || `(ID: ${plan.id})`);
  currentPlan = plan; // Update the global current plan

  // --- 1. Apply Theme Class ---
  body.classList.remove("theme-positive", "theme-sad"); // Remove old themes first
  // Assuming plan object has a 'theme' property like 'positive' or 'sad'
  // Adapt this logic if your plan data structure is different
  if (plan.theme === "positive") { // Check plan.theme property
    body.classList.add("theme-positive");
  } else if (plan.theme === "sad") {
    body.classList.add("theme-sad");
  } else {
    console.warn(`Plan '${plan.name}' has unknown or missing theme property:`, plan.theme);
  }

  // --- 2. Update Music Player ---
  if (!musicPlayer || !audioPlayer) {
    console.warn("Music player elements not found, cannot update music.");
    return; // Exit if essential player parts are missing
  }

  let wasPlaying = !audioPlayer.paused && audioPlayer.currentTime > 0; // Check state *before* changing src

  // Update audio source only if a valid URL is provided AND it's different
  if (plan.song_url && audioPlayer.currentSrc !== plan.song_url) {
    console.log("Setting new audio source:", plan.song_url);
    audioPlayer.src = plan.song_url;
    audioPlayer.load(); // Important: load the new source
  } else if (!plan.song_url) {
    console.warn(`Plan "${plan.name}" has no song_url.`);
    if (!audioPlayer.paused) audioPlayer.pause();
    audioPlayer.src = ""; // Clear source
    wasPlaying = false; // Ensure it doesn't try to play nothing
  } else {
      console.log("Audio source is the same, not reloading.");
      // If the source is the same, but it wasn't playing, do nothing extra here.
      // If it *was* playing, it should continue unless paused manually.
  }

  // Update metadata
  if (albumArt) {
    albumArt.src = plan.album_art_url || PLACEHOLDER_ALBUM_ART; // Use default if missing
    albumArt.alt = plan.track_title || "Album Art";
  }
  if (trackTitleEl) {
    trackTitleEl.textContent = plan.track_title || "Unknown Track";
  }
  if (artistNameEl) {
    artistNameEl.textContent = plan.artist_name || "Unknown Artist";
  }

  // Reset player progress UI immediately
  if (progress) progress.style.width = "0%";
  if (currentTimeEl) currentTimeEl.textContent = "0:00";
  if (totalTimeEl) totalTimeEl.textContent = "0:00"; // Reset total time initially
  if (playPauseIcon && audioPlayer.paused) playPauseIcon.innerHTML = playIconSvg; // Ensure play icon if paused

  // --- Set up listeners for the NEW track ---
  // Remove previous listeners before adding new ones to prevent duplicates and memory leaks
  audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad);
  audioPlayer.removeEventListener("error", handleAudioError);

  // Add new one-time listeners
  audioPlayer.addEventListener("loadedmetadata", () => handleMetadataLoad(wasPlaying, plan.song_url), { once: true });
  audioPlayer.addEventListener("error", handleAudioError, { once: true });

} // --- End applyPlan ---

// Define handler functions outside applyPlan to ensure stable references for removal
/**
 * Handles the 'loadedmetadata' event for the audio player.
 * Updates the total time display and attempts to resume playback if needed.
 * @param {boolean} shouldResume - Whether playback should attempt to resume.
 * @param {string | null} songUrl - The URL of the song that loaded (for checks).
 */
const handleMetadataLoad = (shouldResume, songUrl) => {
    const totalTimeEl = document.getElementById("total-time");
    const audioPlayer = document.getElementById("audio-player");

    if (totalTimeEl && audioPlayer && audioPlayer.duration && !isNaN(audioPlayer.duration)) {
        console.log(`Metadata loaded. Duration: ${audioPlayer.duration}`);
        totalTimeEl.textContent = formatTime(audioPlayer.duration);
    } else if (totalTimeEl) {
        totalTimeEl.textContent = "0:00"; // Reset if duration invalid
    }

    // Attempt to resume playing *after* metadata is loaded
    if (shouldResume && songUrl && audioPlayer && !audioPlayer.paused) {
         // This condition is tricky. If shouldResume is true, it implies it *was* playing.
         // If audioPlayer.paused is now false, it might have auto-played.
         // Let's refine: only explicitly call play if it *was* playing AND is *now* paused.
         if (audioPlayer.paused) {
              console.log("Attempting to resume playback after metadata load...");
              audioPlayer.play().catch(e => console.error("Audio play failed after metadata load:", e));
         } else {
             console.log("Audio already playing after metadata load.");
             // Ensure icon is correct (pause)
             updatePlayPauseIconState();
         }
    } else if (audioPlayer && audioPlayer.paused){
         console.log("Not resuming playback (was not playing before or no song URL).");
         // Ensure icon is correct (play)
         updatePlayPauseIconState();
    }
};

/**
 * Handles the 'error' event for the audio player. Logs the error and resets UI.
 * @param {Event} e - The error event object.
 */
const handleAudioError = (e) => {
    console.error("Audio Player Error:", e.target.error?.message || 'Unknown error', e);
    const totalTimeEl = document.getElementById("total-time");
    const progress = document.getElementById("progress");
    const currentTimeEl = document.getElementById("current-time");
    // Reset UI elements on error
    if (totalTimeEl) totalTimeEl.textContent = "Error";
    if (progress) progress.style.width = "0%";
    if (currentTimeEl) currentTimeEl.textContent = "0:00";
     updatePlayPauseIconState(); // Show play icon on error
};


// =========================================================================
// == Helper Functions
// =========================================================================

/**
 * Formats time in seconds to a M:SS string.
 * @param {number} seconds - The total seconds.
 * @returns {string} The formatted time string.
 */
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
}

/**
 * Adds a leading zero to a number if it's less than 10.
 * @param {number} num - The number.
 * @returns {string|number} The number, potentially with a leading zero.
 */
function padZero(num) {
  return num < 10 ? "0" + num : num;
}

/**
 * Updates the play/pause button icon and ARIA label based on audio state.
 */
function updatePlayPauseIconState() {
    const audioPlayer = document.getElementById("audio-player");
    const playPauseBtn = document.getElementById("play-pause-btn");
    const playPauseIcon = document.getElementById("play-pause-icon");
    if (!audioPlayer || !playPauseBtn || !playPauseIcon) return;

    const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M8 5v14l11-7z"/></svg>`;
    const pauseIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

    const isPlaying = !audioPlayer.paused && audioPlayer.readyState > 0; // Check if actually playing
    playPauseIcon.innerHTML = isPlaying ? pauseIconSvg : playIconSvg;
    playPauseBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
}


// =========================================================================
// == DOMContentLoaded Event Listener (Main Execution Block)
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  // Make the main listener async to await data fetching

  console.log("DOM loaded. Starting initialization...");

  // --- Fetch data FIRST ---
  // Use Promise.all to fetch in parallel for potentially faster loading
  console.log("Fetching initial venue and plan data...");
  try {
      await Promise.all([
          fetchVenues(), // Wait for venues
          fetchPlans()   // Wait for plans (this also applies initial plan via applyPlan)
      ]);
      console.log("Initial data fetching complete.");
  } catch (error) {
      console.error("Error during initial parallel data fetch:", error);
      // Error messages should be handled within fetchVenues/fetchPlans
  }


  // =========================================================================
  // == MUSIC PLAYER LOGIC (Event Listeners & Core Controls)
  // =========================================================================
  console.log("Initializing Music Player...");
  const audioPlayer = document.getElementById("audio-player");
  const playPauseBtn = document.getElementById("play-pause-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const progressContainer = document.getElementById("progress-container");
  const progress = document.getElementById("progress");
  const currentTimeEl = document.getElementById("current-time");
  const totalTimeEl = document.getElementById("total-time");
  const volumeSlider = document.getElementById("volume-slider");

  // Check if all essential player elements exist before adding listeners
  if (
    audioPlayer &&
    playPauseBtn &&
    prevBtn &&
    nextBtn &&
    progressContainer &&
    progress &&
    currentTimeEl &&
    totalTimeEl &&
    volumeSlider
  ) {
    console.log("Music player elements found. Attaching listeners.");

    // Toggle Play/Pause Functionality
    function togglePlayPause() {
      if (!audioPlayer.src && currentPlan?.song_url) {
        // If no src, try applying current plan's song AND indicate intent to play
        console.log("No audio source, attempting to load and play from current plan.");
        applyPlan(currentPlan); // This will load the source
        // We need to tell handleMetadataLoad to play after loading
        // Let's modify applyPlan slightly or handle it here.
        // Easiest here: set a flag or directly call play after a short delay (less robust)
        // Better: modify applyPlan or handleMetadataLoad to accept 'playIntent'
        // For now, let's assume applyPlan's handler will try playing if `wasPlaying` was true (which it wasn't here)
        // We might need to call play explicitly after load. Let's try this:
        const playAfterLoad = () => {
            audioPlayer.play().catch(e => console.error("Delayed play failed:", e));
            audioPlayer.removeEventListener('canplay', playAfterLoad); // Clean up listener
        };
        audioPlayer.addEventListener('canplay', playAfterLoad, { once: true });

        return;
      } else if (!audioPlayer.src) {
        console.warn("Cannot play: No audio source set and no current plan with song.");
        return; // Nothing to play
      }

      // If source exists, toggle play/pause
      if (audioPlayer.paused) {
        audioPlayer
          .play()
          // updatePlayPauseIconState will be called by the 'play' event listener
          .catch((e) => {
                console.error("Audio play failed:", e);
                 updatePlayPauseIconState(); // Ensure icon resets on failure
          });
      } else {
        audioPlayer.pause();
        // updatePlayPauseIconState will be called by the 'pause' event listener
      }
    }

    // Update Progress Bar Functionality
    function updateProgress() {
      if (
        audioPlayer.duration &&
        !isNaN(audioPlayer.duration) &&
        audioPlayer.duration > 0
      ) {
        const progressPercent =
          (audioPlayer.currentTime / audioPlayer.duration) * 100;
        if (progress) progress.style.width = `${progressPercent}%`;
        if (currentTimeEl)
          currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
      } else {
        // Reset if duration is invalid (e.g., before load or after error)
        if (progress) progress.style.width = "0%";
        if (currentTimeEl) currentTimeEl.textContent = "0:00";
      }
    }

    // Seek Functionality (Click on Progress Bar)
    function seek(event) {
        // Ensure we have a valid duration before seeking
      if (!audioPlayer.duration || isNaN(audioPlayer.duration) || audioPlayer.duration <= 0) {
          console.warn("Cannot seek: Audio duration not available or invalid.");
          return;
      }
      const rect = progressContainer.getBoundingClientRect(); // Get dimensions/position
      const clickX = event.clientX - rect.left; // X position within the container
      const width = progressContainer.clientWidth; // Total width of the container
      // Calculate seek ratio (0 to 1), ensuring it's within bounds
      const seekRatio = Math.max(0, Math.min(1, clickX / width));
      audioPlayer.currentTime = seekRatio * audioPlayer.duration; // Set the new time
      updateProgress(); // Update UI immediately after seek
    }

    // Volume Control Functionality
    function changeVolume() {
      // Ensure volume is between 0 and 1
      audioPlayer.volume = Math.max(0, Math.min(1, volumeSlider.value / 100));
    }

    // Previous/Restart Button Functionality (currently just restarts)
    function restartSong() {
      if (!audioPlayer.src || isNaN(audioPlayer.duration)) return; // Don't restart if no song loaded or duration unknown
      audioPlayer.currentTime = 0;
      if (audioPlayer.paused) {
        // If paused, just reset time, don't auto-play
        updateProgress();
      } else {
        // If it was playing, ensure it continues playing from start
        audioPlayer
          .play()
          .catch((e) => console.error("Audio play failed on restart:", e));
      }
    }

    // Next Button Functionality (Placeholder - currently restarts)
    function nextSong() {
        console.log("Next button clicked - functionality not implemented (currently restarts).");
        // TODO: Implement logic to play the next song in a playlist if applicable
        restartSong(); // Placeholder action
    }

    // Attach Core Player Event Listeners
    playPauseBtn.addEventListener("click", togglePlayPause);
    audioPlayer.addEventListener("timeupdate", updateProgress); // Update progress bar during playback
    audioPlayer.addEventListener("play", updatePlayPauseIconState); // Update icon when play starts
    audioPlayer.addEventListener("pause", updatePlayPauseIconState); // Update icon when pause happens
    audioPlayer.addEventListener("ended", () => {
        console.log("Audio ended.");
        // Option: Loop the current song
         restartSong();

        // Option: Stop at end (reset UI)
        // audioPlayer.currentTime = 0;
        // updatePlayPauseIconState();
        // updateProgress();

        // Option: Go to next song (requires playlist logic)
        // nextSong();
    });
    progressContainer.addEventListener("click", seek); // Allow seeking by clicking progress bar
    volumeSlider.addEventListener("input", changeVolume); // Update volume on slider change
    prevBtn.addEventListener("click", restartSong); // Previous button restarts
    nextBtn.addEventListener("click", nextSong); // Next button action (currently restarts)

    // Set initial state
    changeVolume(); // Set initial volume from slider
    updatePlayPauseIconState(); // Set initial play/pause icon

  } else {
    console.warn("Initialization Warning: One or more core music player elements not found in the DOM. Player may be non-functional.");
    // Optionally disable player controls visually if elements are missing
  }

  // =========================================================================
  // == COUNTDOWN TIMER LOGIC
  // =========================================================================
  console.log("Initializing Countdown Timer...");
  const datePicker = document.getElementById("event-date-picker");
  const setDateBtn = document.getElementById("set-date-btn");
  const daysNumEl = document.getElementById("days-num");
  const hoursNumEl = document.getElementById("hours-num");
  const minutesNumEl = document.getElementById("minutes-num");
  const secondsNumEl = document.getElementById("seconds-num");
  const calDay1El = document.getElementById("cal-day-1"); // Previous day
  const calDay2El = document.getElementById("cal-day-2"); // Target day
  const calDay3El = document.getElementById("cal-day-3"); // Next day

  if (
    datePicker && setDateBtn && daysNumEl && hoursNumEl &&
    minutesNumEl && secondsNumEl && calDay1El && calDay2El && calDay3El
  ) {
    console.log("Countdown timer elements found.");
    const localStorageKey = "targetEventDate"; // Key for saving the date
    let targetDate = null; // Will hold the Date object for the target
    let countdownInterval = null; // Holds the interval timer

    // Function to update the mini calendar display
    function updateCalendarDisplay(dateObj) {
      if (!dateObj || isNaN(dateObj.getTime())) {
        // Reset if date is invalid or null
        calDay1El.textContent = "--";
        calDay2El.textContent = "--";
        calDay3El.textContent = "--";
        calDay1El.classList.remove("highlight");
        calDay2El.classList.add("highlight"); // Highlight middle as default
        calDay3El.classList.remove("highlight");
        return;
      }
      const targetDay = dateObj.getUTCDate(); // Use UTC day
      const prevDate = new Date(dateObj);
      prevDate.setUTCDate(targetDay - 1); // Calculate previous UTC day
      const nextDate = new Date(dateObj);
      nextDate.setUTCDate(targetDay + 1); // Calculate next UTC day

      calDay1El.textContent = padZero(prevDate.getUTCDate());
      calDay2El.textContent = padZero(targetDay);
      calDay3El.textContent = padZero(nextDate.getUTCDate());

      // Highlight the middle (target) day
      calDay1El.classList.remove("highlight");
      calDay2El.classList.add("highlight");
      calDay3El.classList.remove("highlight");
    }

    // Function to update the countdown numbers
    function updateCountdown() {
      if (!targetDate || isNaN(targetDate.getTime())) {
        // Reset if no valid target date
        daysNumEl.textContent = "--";
        hoursNumEl.textContent = "--";
        minutesNumEl.textContent = "--";
        secondsNumEl.textContent = "--";
        return;
      }

      const now = new Date().getTime(); // Current time in milliseconds
      const difference = targetDate.getTime() - now; // Difference in milliseconds

      if (difference <= 0) {
        // If target date has passed
        daysNumEl.textContent = "00";
        hoursNumEl.textContent = "00";
        minutesNumEl.textContent = "00";
        secondsNumEl.textContent = "00";
        if (countdownInterval) {
          clearInterval(countdownInterval); // Stop the interval
          countdownInterval = null;
        }
        return;
      }

      // Calculate remaining time parts
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      // Update the DOM elements
      daysNumEl.textContent = padZero(days);
      hoursNumEl.textContent = padZero(hours);
      minutesNumEl.textContent = padZero(minutes);
      secondsNumEl.textContent = padZero(seconds);
    }

    // Function to start (or restart) the countdown interval
    function startCountdown() {
      if (countdownInterval) clearInterval(countdownInterval); // Clear any existing interval

      if (targetDate && !isNaN(targetDate.getTime()) && targetDate.getTime() > new Date().getTime()) {
        // If we have a valid future date
        updateCountdown(); // Update immediately
        countdownInterval = setInterval(updateCountdown, 1000); // Update every second
      } else {
        // If date is in the past or invalid, just show the final state (00 or --)
        updateCountdown();
      }
    }

    // Handler for the "Set Date" button click
    function handleSetDate() {
      const selectedDateString = datePicker.value; // Get YYYY-MM-DD string
      if (!selectedDateString) {
        alert("Please select a date.");
        return;
      }

      // Attempt to parse the date string as UTC to avoid timezone confusion
      // Input format is YYYY-MM-DD, Date.UTC needs year, monthIndex, day
      const parts = selectedDateString.split("-");
      if (parts.length !== 3) { alert("Invalid date format."); return; }
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[2], 10);

      if (isNaN(year) || isNaN(month) || isNaN(day)) { alert("Invalid date components."); return; }

      const potentialTargetDate = new Date(Date.UTC(year, month, day, 0, 0, 0)); // Set time to start of day UTC

      if (isNaN(potentialTargetDate.getTime())) { alert("Invalid date selected."); return; }

      // Optional: Prevent selecting dates in the past (relative to start of today UTC)
      const todayUTC = new Date();
      todayUTC.setUTCHours(0, 0, 0, 0);
      if (potentialTargetDate < todayUTC) {
        alert("Please select today or a future date.");
        return;
      }

      // If valid, save to localStorage and update state
      localStorage.setItem(localStorageKey, selectedDateString);
      targetDate = potentialTargetDate;
      updateCalendarDisplay(targetDate);
      startCountdown();
      console.log("New target date set:", targetDate);
    }

    // Function to load the saved date from localStorage on page load
    function loadDateFromStorage() {
      const storedDateString = localStorage.getItem(localStorageKey);
      if (storedDateString) {
          // Validate and parse the stored string
          const parts = storedDateString.split("-");
          if (parts.length === 3) {
             const year = parseInt(parts[0], 10);
             const month = parseInt(parts[1], 10) - 1;
             const day = parseInt(parts[2], 10);
             if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                 const loadedDate = new Date(Date.UTC(year, month, day, 0, 0, 0));
                 if (!isNaN(loadedDate.getTime())) {
                     targetDate = loadedDate;
                     datePicker.value = storedDateString; // Set the picker value to match
                     console.log("Loaded target date from storage:", targetDate);
                     updateCalendarDisplay(targetDate);
                     startCountdown();
                     return; // Exit if loaded successfully
                 }
             }
          }
          // If stored data is invalid, remove it
          console.warn("Invalid date string found in localStorage, removing.");
          localStorage.removeItem(localStorageKey);
      }
      // If no valid data loaded, initialize display to default
      console.log("No valid date in storage, initializing default display.");
      updateCalendarDisplay(null);
      updateCountdown();
    }

    // Attach Listener and Load Initial State for Countdown
    setDateBtn.addEventListener("click", handleSetDate);
    loadDateFromStorage(); // Load saved date when the page loads

  } else {
    console.warn("Initialization Warning: Countdown timer elements not found. Timer non-functional.");
  }

  // =========================================================================
  // == LEAFLET MAP INITIALIZATION
  // =========================================================================
  console.log("Initializing Leaflet Map...");
  const venueMapContainer = document.getElementById("venue-map"); // The div for the map

  if (venueMapContainer && typeof L !== "undefined") { // Check if container and Leaflet library exist
    console.log("Map container and Leaflet library found.");
    if (fetchedVenueData.length > 0) { // Check if we have venue data
      try {
        const firstVenue = fetchedVenueData[0]; // Use the first venue for initial view
        // Determine initial coordinates, use defaults if first venue lacks lat/lng
        const initialCoords =
          firstVenue?.latitude != null && firstVenue?.longitude != null
            ? [firstVenue.latitude, firstVenue.longitude]
            : [42.8749, 74.6049]; // !! ADAPT THIS: Default fallback coordinates (e.g., city center)

        console.log("Initializing map at coords:", initialCoords);
        venueMapInstance = L.map(venueMapContainer, {
          zoomControl: false, // Disable default zoom control
        }).setView(initialCoords, MAP_ZOOM_LEVEL); // Set initial view

        // Add custom zoom control to bottom right
        L.control.zoom({ position: "bottomright" }).addTo(venueMapInstance);

        // Add OpenStreetMap tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19, // Max zoom level for tiles
        }).addTo(venueMapInstance);

        // Add a marker at the initial location
        venueMarker = L.marker(initialCoords).addTo(venueMapInstance);

        // Add a popup to the marker (optional)
        if (firstVenue?.name) {
          venueMarker.bindPopup(`<b>${firstVenue.name}</b>`).openPopup(); // Open popup initially
          // Close it after a few seconds if desired
          // setTimeout(() => { if (venueMarker) venueMarker.closePopup(); }, 3000);
        }

        // Invalidate map size after a short delay to ensure proper rendering,
        // especially if the container was hidden initially.
        setTimeout(() => {
          if (venueMapInstance) {
              console.log("Invalidating map size.");
              venueMapInstance.invalidateSize();
          }
        }, 250);

      } catch (error) {
        console.error("Error initializing Leaflet map:", error);
        if (venueMapContainer)
          venueMapContainer.innerHTML = "<p class='map-error'>Error loading map.</p>"; // Display error in map div
      }
    } else {
      // Handle case where no venues were fetched
      console.warn("Map initialization skipped: No venue data available.");
      if (venueMapContainer)
        venueMapContainer.innerHTML = "<p class='map-error'>No venues found to display on map.</p>";
    }
  } else {
    if (!venueMapContainer) console.warn("Initialization Warning: Map container #venue-map not found.");
    if (typeof L === "undefined") console.warn("Initialization Warning: Leaflet library (L) is not loaded.");
    // Display a message if the map can't load
    if (venueMapContainer) venueMapContainer.innerHTML = "<p class='map-error'>Map could not be loaded.</p>";
  }

  // =========================================================================
  // == VENUE SWIPER LOGIC (Handles the main venue cards)
  // =========================================================================
  console.log("Initializing Venue Swiper...");
  // --- Swiper Element Selection ---
  const venueCard = document.getElementById("venue-details-card"); // Card showing name, date, background
  const chooseVenueCard = document.getElementById("choose-venue-card"); // Card showing rating, icons
  // Ensure both swiper cards exist before proceeding
  if (venueCard && chooseVenueCard) {
       console.log("Swiper card elements found.");
      // Check if we have data to display
      if (fetchedVenueData.length > 0) {
           console.log("Venue data found, setting up swiper interactions.");
           // --- Inner Element & State Variables ---
           const venueWrapper = venueCard.querySelector(".card-content-wrapper"); // Swipable content area 1
           const chooseWrapper = chooseVenueCard.querySelector(".card-content-wrapper"); // Swipable content area 2
           const allDotsInnerContainers = document.querySelectorAll(".dots-inner"); // Dots containers in *both* cards

           // Check if crucial inner elements exist
           if (venueWrapper && chooseWrapper && allDotsInnerContainers.length >= 2) {
                console.log("Swiper inner wrappers and dots containers found.");
                let isDragging = false,
                    startX = 0,
                    currentX = 0,
                    diffX = 0,
                    cardWidth = venueCard.offsetWidth; // Initial width

                // --- Swiper Helper Functions ---

                // Generates the dots based on the number of venues
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

                // Updates the active dot and scrolls the dots container
                function updateDots(activeIndex) {
                     if (activeIndex < 0 || activeIndex >= fetchedVenueData.length) return;
                     console.log(`Updating dots to active index: ${activeIndex}`);
                    allDotsInnerContainers.forEach((dotsInner) => {
                        if (!dotsInner) return;
                        const dots = dotsInner.querySelectorAll("span");
                        const dotsContainer = dotsInner.parentElement; // The element with class 'dots'

                        if (!dotsContainer || dots.length !== fetchedVenueData.length || dots.length === 0) {
                             console.warn("Dots container or dots mismatch, cannot update dots visuals.");
                             return;
                        }

                        // Update active class
                        dots.forEach((dot, index) =>
                            dot.classList.toggle("active", index === activeIndex)
                        );

                        // Centering logic for dots container scroll
                        const dotTotalWidth = DOT_WIDTH + DOT_MARGIN * 2; // Width + margin on both sides
                        const containerVisibleWidth = dotsContainer.offsetWidth;
                        const totalInnerWidth = fetchedVenueData.length * dotTotalWidth;

                        // Calculate the desired left offset of the active dot's center
                        const activeDotCenterOffset = activeIndex * dotTotalWidth + dotTotalWidth / 2;
                        // Calculate the target translateX to center the active dot
                        let translateX = containerVisibleWidth / 2 - activeDotCenterOffset;

                        // Constrain translateX if the dots overflow the container
                        if (totalInnerWidth > containerVisibleWidth) {
                            const maxTranslate = 0; // Cannot scroll past the beginning
                            const minTranslate = containerVisibleWidth - totalInnerWidth; // Max scroll amount (negative)
                            translateX = Math.max(minTranslate, Math.min(maxTranslate, translateX));
                        } else {
                            // If all dots fit, center the whole block
                            translateX = (containerVisibleWidth - totalInnerWidth) / 2;
                        }
                        dotsInner.style.transform = `translateX(${translateX}px)`;
                    });
                }

                // Updates the Leaflet map to the specified venue's location
                function updateVenueMap(lat, lng, venueName) {
                    if (!venueMapInstance || !venueMarker) {
                        console.warn("Map update skipped: Map instance or marker not available.");
                        return;
                    }
                    if (typeof lat === "number" && typeof lng === "number") {
                        const newLatLng = [lat, lng];
                        console.log(`Updating map view to [${lat}, ${lng}] for "${venueName}"`);
                        // Smoothly pan/zoom the map
                        venueMapInstance.setView(newLatLng, MAP_ZOOM_LEVEL, {
                            animate: true,
                            pan: { duration: 0.5 } // Animation duration
                        });
                        // Move the marker
                        venueMarker.setLatLng(newLatLng);
                        // Update the marker's popup content
                        if (venueName) {
                            venueMarker.setPopupContent(`<b>${venueName}</b>`);
                            // venueMarker.openPopup(); // Optionally re-open popup on change
                        }
                        // Ensure map size is correct after potential layout changes
                        setTimeout(() => { if (venueMapInstance) venueMapInstance.invalidateSize(); }, 150);
                    } else {
                        console.warn(`Map update skipped for "${venueName}": Invalid coordinates (lat: ${lat}, lng: ${lng}).`);
                        // Optionally hide marker or show default location
                    }
                }

                // *** THIS IS THE CORRECTED FUNCTION ***
                // Displays the venue data for the given index in the swiper cards
                function displayVenue(index) {
                    // --- Get DOM Elements (Redundant checks for safety) ---
                    const venueCard = document.getElementById("venue-details-card");
                    const chooseVenueCard = document.getElementById("choose-venue-card");
                    if (!venueCard || !chooseVenueCard) { console.error("Cannot find venueCard or chooseVenueCard elements."); return; }
                    const venueWrapper = venueCard.querySelector(".card-content-wrapper");
                    const chooseWrapper = chooseVenueCard.querySelector(".card-content-wrapper");
                    if (!venueWrapper || !chooseWrapper) { console.error("Could not find .card-content-wrapper in cards."); return; }

                    // --- Get Data ---
                    if (index < 0 || index >= fetchedVenueData.length) { console.error(`Invalid venue index requested: ${index}`); return; }
                    const venueDataForThisCard = fetchedVenueData[index];
                    console.log(`Displaying venue index: ${index}, ID: ${venueDataForThisCard?.id}, Name: ${venueDataForThisCard?.name}`);

                    // --- Check for ID (Crucial for clicks) ---
                    if (venueDataForThisCard.id === undefined || venueDataForThisCard.id === null) {
                        console.error("Venue data is missing 'id' property! Click navigation will fail.", venueDataForThisCard);
                    }

                    // --- Update Card Content (Adapt selectors/properties to your actual data) ---
                    const venueNameEl = venueWrapper.querySelector(".venue-name");
                    const venueDateEl = venueWrapper.querySelector(".venue-date"); // Example element
                    const ratingEl = chooseWrapper.querySelector(".rating"); // Example stars/number
                    const ratingTextEl = chooseWrapper.querySelector(".rating-text"); // Example "Good", "Excellent"
                    const venueIcon1El = chooseWrapper.querySelector(".venue-icon-1 img"); // Example img inside icon wrapper
                    const venueIcon2El = chooseWrapper.querySelector(".venue-icon-2 img"); // Example img inside icon wrapper

                    if (venueNameEl) venueNameEl.textContent = venueDataForThisCard.name || "Venue Name";
                    if (venueDateEl) venueDateEl.textContent = venueDataForThisCard.date_text || "Date Info"; // Use relevant property
                    if (ratingEl) {
                         const ratingValue = Math.round(venueDataForThisCard.rating_stars || 0);
                         // Example: Display stars
                         ratingEl.textContent = '★'.repeat(ratingValue) + '☆'.repeat(5 - ratingValue);
                    }
                    if (ratingTextEl) ratingTextEl.textContent = venueDataForThisCard.rating_text || 'Rating';
                    // Update icons based on your data (e.g., venue type, features)
                    if (venueIcon1El) venueIcon1El.src = venueDataForThisCard.icon1_url || './assets/default-icon.png';
                    if (venueIcon2El) venueIcon2El.src = venueDataForThisCard.icon2_url || './assets/default-icon.png';

                    // Update background image for the main venue card
                    if (venueDataForThisCard.image_url) {
                        venueCard.style.backgroundImage = `url('${venueDataForThisCard.image_url}')`;
                        venueCard.style.backgroundSize = 'cover'; // Ensure proper display
                        venueCard.style.backgroundPosition = 'center';
                    } else {
                        venueCard.style.backgroundImage = `url('${PLACEHOLDER_VENUE_IMAGE}')`; // Fallback
                        venueCard.style.backgroundSize = 'cover';
                        venueCard.style.backgroundPosition = 'center';
                    }

                    // --- Update Map & Dots ---
                    updateVenueMap(venueDataForThisCard.latitude, venueDataForThisCard.longitude, venueDataForThisCard.name);
                    updateDots(index);

                    // --- CLICK LISTENER LOGIC (Revised for Correct Navigation) ---
                    // 1. Store the venue ID on the clickable wrapper elements using a data attribute
                    const currentVenueId = venueDataForThisCard.id;
                    if (currentVenueId !== undefined && currentVenueId !== null) {
                        venueWrapper.setAttribute('data-venue-id', currentVenueId);
                        chooseWrapper.setAttribute('data-venue-id', currentVenueId);
                        console.log(`   -> Set data-venue-id="${currentVenueId}" on wrappers for index ${index}`);
                    } else {
                        // Remove attribute if ID is missing to prevent errors
                        venueWrapper.removeAttribute('data-venue-id');
                        chooseWrapper.removeAttribute('data-venue-id');
                        console.warn(`   -> No valid venue ID found for index ${index}, click will not navigate.`);
                    }

                    // 2. Define the click handler function
                    const handleCardClick = (event) => {
                        const clickedWrapper = event.currentTarget; // Get the element the listener is attached to (the wrapper)
                        console.log("Card content wrapper clicked!", clickedWrapper);
                        const venueId = clickedWrapper.getAttribute('data-venue-id'); // Read the ID *at the time of the click*
                        console.log(`   -> Click handler fired. Read data-venue-id: "${venueId}"`);

                        if (venueId) {
                            // *** CONSTRUCT THE CORRECT URL ***
                            // This MUST match the URL pattern defined in your backend (e.g., Django urls.py)
                            const venueDetailUrl = `${VENUE_DETAIL_BASE_PATH}/${venueId}/`; // Uses constant defined at top

                            console.log(`   -> Attempting to navigate to: ${venueDetailUrl}`);

                            // *** NAVIGATE THE CURRENT WINDOW *** (More reliable than window.open)
                            window.location.href = venueDetailUrl;

                        } else {
                            console.warn("   -> Cannot navigate: data-venue-id attribute missing or empty on clicked element.", clickedWrapper);
                            // Optionally provide feedback to the user if a click fails here
                            // e.g., clickedWrapper.classList.add('click-error-feedback');
                            // setTimeout(() => clickedWrapper.classList.remove('click-error-feedback'), 500);
                        }
                    };

                    // 3. Attach/Re-attach Listeners
                    // Remove any previous 'onclick' handlers just in case
                    venueWrapper.onclick = null;
                    chooseWrapper.onclick = null;

                    // Remove previous 'click' listeners added by addEventListener
                    // It's safer to remove before adding, especially if displayVenue might be called rapidly
                    // Note: This assumes handleCardClick is effectively redefined here each time.
                    venueWrapper.removeEventListener('click', handleCardClick);
                    chooseWrapper.removeEventListener('click', handleCardClick);

                    // Add the event listener to the wrapper divs
                    venueWrapper.addEventListener('click', handleCardClick);
                    chooseWrapper.addEventListener('click', handleCardClick);
                    console.log(`   -> Click listeners attached for index ${index}`);

                } // --- End displayVenue ---


                // --- Swipe Event Handlers ---
                function handleSwipeStart(e) {
                    // Prevent swipe if clicking on interactive elements within the card
                    // or the map itself
                    if (e.target.closest("button, input, a, .dots, .leaflet-container")) {
                        console.log("Swipe prevented on interactive element.");
                        return;
                    }
                    isDragging = true;
                    startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
                    currentX = startX;
                    diffX = 0;
                    cardWidth = venueCard.offsetWidth; // Get width at drag start
                    // Add class for visual feedback during swipe (optional)
                    venueWrapper.classList.add("is-swiping");
                    chooseWrapper.classList.add("is-swiping");
                    // Prevent default touch actions like scrolling while swiping horizontally
                    // Only if the event supports preventDefault and it's a touch event
                     if (e.cancelable && e.type.includes("touch")) e.preventDefault();
                }

                function handleSwipeMove(e) {
                    if (!isDragging) return;
                    currentX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
                    diffX = currentX - startX;
                    // Apply translation to both swiping cards
                    const transformValue = `translateX(${diffX}px)`;
                    venueWrapper.style.transform = transformValue;
                    chooseWrapper.style.transform = transformValue;
                    // Prevent scrolling during horizontal swipe
                     if (e.cancelable && e.type.includes("touch")) e.preventDefault();
                }

                function handleSwipeEnd(e) {
                    if (!isDragging) return;
                    isDragging = false;
                    // Remove swiping class
                    venueWrapper.classList.remove("is-swiping");
                    chooseWrapper.classList.remove("is-swiping");

                    const threshold = cardWidth / 4; // Swipe threshold (e.g., 25% of card width)
                    let newIndex = currentVenueIndex;

                    // Determine if swipe was significant enough to change index
                    if (diffX < -threshold && currentVenueIndex < fetchedVenueData.length - 1) {
                        newIndex++; // Swipe left, go to next
                        console.log("Swipe Left detected.");
                    } else if (diffX > threshold && currentVenueIndex > 0) {
                        newIndex--; // Swipe right, go to previous
                        console.log("Swipe Right detected.");
                    } else {
                         console.log("Swipe below threshold or at boundary.");
                    }

                    // Snap back animation (using CSS transitions)
                    venueWrapper.style.transition = "transform 0.3s ease-out";
                    chooseWrapper.style.transition = "transform 0.3s ease-out";
                    venueWrapper.style.transform = `translateX(0px)`; // Snap back to original position
                    chooseWrapper.style.transform = `translateX(0px)`;

                    // Remove transition after snap back animation completes
                    // Use 'transitionend' event for reliability if needed, but setTimeout is simpler here
                    setTimeout(() => {
                        venueWrapper.style.transition = "";
                        chooseWrapper.style.transition = "";
                    }, 300); // Match CSS transition duration

                    // If index changed, update the displayed venue
                    if (newIndex !== currentVenueIndex) {
                        currentVenueIndex = newIndex;
                        displayVenue(currentVenueIndex); // Update content, map, dots, and click listeners
                    }

                    diffX = 0; // Reset difference
                }

                // --- Attach Swipe Event Listeners ---
                // Attach start listeners to the cards themselves
                venueCard.addEventListener("mousedown", handleSwipeStart);
                venueCard.addEventListener("touchstart", handleSwipeStart, { passive: false }); // Need passive:false to call preventDefault
                chooseVenueCard.addEventListener("mousedown", handleSwipeStart);
                chooseVenueCard.addEventListener("touchstart", handleSwipeStart, { passive: false });

                // Attach move/end listeners to the document to catch drags even if the cursor leaves the card
                document.addEventListener("mousemove", handleSwipeMove);
                document.addEventListener("touchmove", handleSwipeMove, { passive: false }); // Need passive:false to call preventDefault
                document.addEventListener("mouseup", handleSwipeEnd);
                document.addEventListener("touchend", handleSwipeEnd);
                document.addEventListener("mouseleave", handleSwipeEnd); // Handle mouse leaving the window mid-drag

                // --- Initial Swiper Setup ---
                generateDots(); // Create the dots
                displayVenue(currentVenueIndex); // Display the first venue initially

                // --- Resize Handler ---
                window.addEventListener("resize", () => {
                    console.log("Window resized.");
                    if (venueCard) cardWidth = venueCard.offsetWidth; // Update card width
                    updateDots(currentVenueIndex); // Recalculate dot positions/scrolling
                    // Invalidate map size on resize as well
                    if (venueMapInstance) {
                        setTimeout(() => { if (venueMapInstance) venueMapInstance.invalidateSize(); }, 150);
                    }
                });

           } else {
                console.error("Swiper setup failed: Crucial inner elements (.card-content-wrapper or .dots-inner) are missing in the swiper cards.");
                // Hide or disable swiper section?
           }
      } else {
           console.warn("Swiper setup skipped: No venue data was fetched or the data array is empty.");
            // Display a message indicating no venues are available
            venueCard.innerHTML = '<p class="info-message">No venues available.</p>';
            chooseVenueCard.style.display = 'none'; // Hide the second card
      }
  } else {
       console.warn("Initialization Warning: Swiper base card elements (#venue-details-card or #choose-venue-card) not found. Swiper non-functional.");
  }


  // =========================================================================
  // == INTERACTIVE CHECKLIST LOGIC
  // =========================================================================
  console.log("Initializing Checklist...");
  const checklistKey = "interactiveChecklistState"; // Key for localStorage
  // !!! VERIFY THIS SELECTOR matches your HTML structure for the checklist !!!
  const checklistItems = document.querySelectorAll('.interactive-checklist input[type="checkbox"]');

  if (checklistItems.length > 0) {
      console.log(`Found ${checklistItems.length} checklist items.`);
    // Function to save the current state of checkboxes to localStorage
    function saveChecklistState() {
      const state = {};
      checklistItems.forEach((item) => {
        // Use item.id as the key, ensure IDs are unique and stable
        if (item.id) {
            state[item.id] = item.checked;
        } else {
            console.warn("Checklist item missing ID, cannot save state:", item);
        }
      });
      try {
          localStorage.setItem(checklistKey, JSON.stringify(state));
          console.log("Checklist state saved.");
      } catch (e) {
          console.error("Error saving checklist state to localStorage:", e);
      }
    }

    // Function to load and apply the saved state from localStorage
    function loadChecklistState() {
      const savedState = localStorage.getItem(checklistKey);
      if (savedState) {
        console.log("Loading checklist state from storage.");
        try {
          const state = JSON.parse(savedState);
          checklistItems.forEach((item) => {
            if (item.id && state[item.id] !== undefined) {
              item.checked = state[item.id];
            }
          });
        } catch (e) {
          console.error("Error parsing checklist state from localStorage", e);
          // If parsing fails, remove the invalid data
          localStorage.removeItem(checklistKey);
        }
      } else {
          console.log("No saved checklist state found.");
      }
    }

    // Add event listeners to save state on change, and load initial state
    checklistItems.forEach((item) => {
      item.addEventListener("change", saveChecklistState);
    });
    loadChecklistState(); // Load the state when the DOM is ready

  } else {
    console.warn("Initialization Warning: No checklist items found with selector '.interactive-checklist input[type=\"checkbox\"]'. Checklist non-functional.");
  }


  // =========================================================================
  // == PLAN SWITCHER BUTTONS (Dynamically Created)
  // =========================================================================
  console.log("Initializing Plan Switcher Buttons...");
  if (fetchedPlanData.length > 0) {
       console.log(`Creating ${fetchedPlanData.length} plan switcher buttons.`);
    const planSwitcherContainer = document.createElement("div");
    planSwitcherContainer.className = "plan-switcher-container"; // Add a class for styling
    // Example inline styles (better to use CSS)
    planSwitcherContainer.style.textAlign = "center";
    planSwitcherContainer.style.padding = "20px 0";

    fetchedPlanData.forEach((plan) => {
      const button = document.createElement("button");
      button.textContent = `Activate ${plan.name || `Plan (ID: ${plan.id})`}`;
      // Use consistent button styling if possible (e.g., from Bootstrap or your CSS framework)
      button.className = "btn btn-secondary btn-switch-plan"; // Example classes
      button.style.margin = "0 8px"; // Add some spacing between buttons
      button.setAttribute("data-plan-id", plan.id); // Store plan ID if needed later
      button.onclick = () => applyPlan(plan); // Call applyPlan when this button is clicked
      planSwitcherContainer.appendChild(button);
    });

    // --- Decide where to insert the plan switcher ---
    // Option 1: Insert before a specific section (e.g., features)
    const featuresSection = document.querySelector(".features"); // !!! ADAPT: Use a selector for where you want buttons
    if (featuresSection && featuresSection.parentNode) {
      console.log("Inserting plan switcher before features section.");
      featuresSection.parentNode.insertBefore(planSwitcherContainer, featuresSection);
    } else {
      // Option 2: Fallback - append to the body or another known container
      console.warn("Target section for plan switcher not found, appending to body as fallback.");
      document.body.appendChild(planSwitcherContainer);
    }
  } else {
    console.log("No plan data fetched, skipping plan switcher button creation.");
  }

  // =========================================================================
  // == Final Log
  // =========================================================================
  console.log("Frontend Player Initialization Complete.");

}); // --- END DOMContentLoaded ---
