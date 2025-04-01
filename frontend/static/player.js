// frontend/player.js

// =========================================================================
// == Global Variables & Configuration
// =========================================================================

// --- Data Storage ---
let fetchedVenueData = []; // Will be filled by API
let fetchedPlanData = []; // Will be filled by API
let currentVenueIndex = 0; // Track the currently displayed venue
let currentPlan = null; // Track the currently active plan

// --- Constants ---
const DOT_WIDTH = 8; // px
const DOT_MARGIN = 4; // px
const MAP_ZOOM_LEVEL = 15; // Default zoom level for the venue map
const API_BASE_URL = "http://127.0.0.1:8000/api"; // Your backend API URL

// --- Leaflet Map Variables ---
let venueMapInstance = null; // Holds the Leaflet map instance
let venueMarker = null; // Holds the Leaflet marker instance

// =========================================================================
// == API Fetching Functions
// =========================================================================

// Function to fetch Venues
async function fetchVenues() {
  try {
    const response = await fetch(`${API_BASE_URL}/venues/`);
    if (!response.ok) {
      // Throw an error that includes the status code for better debugging
      throw new Error(
        `HTTP error! status: ${response.status} ${response.statusText}`
      );
    }
    // Check content type before parsing JSON (optional but good practice)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      fetchedVenueData = await response.json();
      console.log("Fetched Venues:", fetchedVenueData);
    } else {
      const textResponse = await response.text();
      throw new Error(
        `Expected JSON, but received ${contentType}. Response: ${textResponse}`
      );
    }
  } catch (error) {
    console.error("Could not fetch venues:", error);
    fetchedVenueData = []; // Ensure it's an empty array on error
    // Optionally display a user-friendly error message on the page here
  }
}

// Function to fetch Plans
async function fetchPlans() {
  try {
    const response = await fetch(`${API_BASE_URL}/plans/`);
    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status} ${response.statusText}`
      );
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      fetchedPlanData = await response.json();
      console.log("Fetched Plans:", fetchedPlanData);
      // Set a default plan initially if plans were fetched
      if (fetchedPlanData.length > 0) {
        // Try to find 'Plan A', otherwise default to the first plan
        currentPlan =
          fetchedPlanData.find((p) => p.name === "Plan A") ||
          fetchedPlanData[0];
        applyPlan(currentPlan); // Apply the initial plan's theme and music
      }
    } else {
      const textResponse = await response.text();
      throw new Error(
        `Expected JSON, but received ${contentType}. Response: ${textResponse}`
      );
    }
  } catch (error) {
    console.error("Could not fetch plans:", error);
    fetchedPlanData = [];
  }
}

// =========================================================================
// == Plan Application Function
// =========================================================================

// Function to apply a Plan's theme and music
function applyPlan(plan) {
  if (!plan) {
    console.warn("applyPlan called with null or undefined plan.");
    return;
  }
  console.log("Applying Plan:", plan.name);
  currentPlan = plan; // Update the global current plan

  const body = document.body;
  const musicPlayer = document.querySelector(".music-player");
  const audioPlayer = document.getElementById("audio-player");
  const albumArt = musicPlayer?.querySelector(".album-art"); // Use optional chaining
  const trackTitleEl = musicPlayer?.querySelector("#track-title");
  const artistNameEl = musicPlayer?.querySelector("#artist-name");

  // --- 1. Apply Theme Class ---
  body.classList.remove("theme-positive", "theme-sad"); // Remove old themes first
  if (plan.theme === "positive") {
    body.classList.add("theme-positive");
    // Revert styles explicitly if needed, or rely on CSS defaults
    // Example: body.style.backgroundColor = 'var(--primary-color)';
  } else if (plan.theme === "sad") {
    body.classList.add("theme-sad");
    // Styles for .theme-sad should be defined in style.css
    // Example: body.style.backgroundColor = '#4a4a52';
  }

  // --- 2. Update Music Player ---
  if (!musicPlayer || !audioPlayer) {
    console.warn("Music player elements not found, cannot update music.");
    return; // Exit if essential player parts are missing
  }

  let wasPlaying = !audioPlayer.paused; // Check state *before* changing src

  // Update audio source only if a valid URL is provided
  if (plan.song_url && audioPlayer.src !== plan.song_url) {
    // Avoid reloading same song
    audioPlayer.src = plan.song_url;
    audioPlayer.load(); // Important: load the new source
  } else if (!plan.song_url) {
    console.warn(`Plan "${plan.name}" has no song_url.`);
    // Optionally, pause the player or set a default silent track
    audioPlayer.pause();
    audioPlayer.src = ""; // Clear source
    wasPlaying = false; // Ensure it doesn't try to play nothing
  }

  // Update metadata
  if (albumArt) {
    albumArt.src = plan.album_art_url || "./assets/hq720 (1).jpg"; // Use default if missing
    albumArt.alt = plan.track_title || "Album Art";
  }
  if (trackTitleEl) {
    trackTitleEl.textContent = plan.track_title || "Unknown Track";
  }
  if (artistNameEl) {
    artistNameEl.textContent = plan.artist_name || "Unknown Artist";
  }

  // Reset player progress UI
  const progress = document.getElementById("progress");
  const currentTimeEl = document.getElementById("current-time");
  const totalTimeEl = document.getElementById("total-time");
  if (progress) progress.style.width = "0%";
  if (currentTimeEl) currentTimeEl.textContent = "0:00";
  if (totalTimeEl) totalTimeEl.textContent = "0:00"; // Reset total time initially

  // Update total time once metadata loads for the *new* track
  // Remove previous listeners before adding a new one to prevent duplicates
  const updateTotalTime = () => {
    if (totalTimeEl && audioPlayer.duration && !isNaN(audioPlayer.duration)) {
      totalTimeEl.textContent = formatTime(audioPlayer.duration);
    } else if (totalTimeEl) {
      totalTimeEl.textContent = "0:00";
    }
    // Attempt to resume playing *after* metadata is loaded
    if (wasPlaying && plan.song_url) {
      // Only play if there's a song and it was playing before
      audioPlayer
        .play()
        .catch((e) => console.error("Audio play failed after plan change:", e));
    } else {
      // Ensure icon is reset if paused or no song
      const playPauseIcon = document.getElementById("play-pause-icon");
      const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M8 5v14l11-7z"/></svg>`;
      if (playPauseIcon) playPauseIcon.innerHTML = playIconSvg;
    }
  };
  audioPlayer.removeEventListener("loadedmetadata", updateTotalTime); // Remove old listener
  audioPlayer.addEventListener("loadedmetadata", updateTotalTime, {
    once: true,
  }); // Add new one-time listener

  // Handle potential errors loading the new source
  const handleAudioError = (e) => {
    console.error("Audio Player Error loading new track:", e);
    if (totalTimeEl) totalTimeEl.textContent = "Error";
    // Reset UI elements on error
    if (progress) progress.style.width = "0%";
    if (currentTimeEl) currentTimeEl.textContent = "0:00";
  };
  audioPlayer.removeEventListener("error", handleAudioError); // Remove old listener
  audioPlayer.addEventListener("error", handleAudioError, { once: true }); // Add new one-time listener

  // --- 3. Update Notes/Other UI (Optional) ---
  // Example: Display plan notes in a dedicated element
  // const notesDiv = document.getElementById('plan-notes'); // Assuming you add <div id="plan-notes"></div> in HTML
  // if (notesDiv) {
  //    notesDiv.textContent = plan.notes || ''; // Display notes or empty string
  // }
}

// =========================================================================
// == Helper Functions
// =========================================================================

// Format time in seconds to M:SS format
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
}

// Format number with leading zero if needed
function padZero(num) {
  return num < 10 ? "0" + num : num;
}

// =========================================================================
// == DOMContentLoaded Event Listener (Main Execution Block)
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  // Make this async

  console.log("DOM loaded. Fetching data...");
  // --- Fetch data FIRST ---
  await fetchVenues(); // Wait for venues
  await fetchPlans(); // Wait for plans (this also applies initial plan via applyPlan)
  console.log("Data fetching complete.");

  // =========================================================================
  // == MUSIC PLAYER LOGIC (Event Listeners & Core Controls)
  // =========================================================================
  const audioPlayer = document.getElementById("audio-player");
  const playPauseBtn = document.getElementById("play-pause-btn");
  const playPauseIcon = document.getElementById("play-pause-icon");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const progressContainer = document.getElementById("progress-container");
  const progress = document.getElementById("progress");
  const currentTimeEl = document.getElementById("current-time");
  const totalTimeEl = document.getElementById("total-time"); // Already used in applyPlan
  const volumeSlider = document.getElementById("volume-slider");

  if (
    audioPlayer &&
    playPauseBtn &&
    playPauseIcon &&
    prevBtn &&
    nextBtn &&
    progressContainer &&
    progress &&
    currentTimeEl &&
    totalTimeEl &&
    volumeSlider
  ) {
    const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M8 5v14l11-7z"/></svg>`;
    const pauseIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36px" height="36px"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    // Initial icon state might be set by applyPlan, but set default just in case
    playPauseIcon.innerHTML = playIconSvg;
    playPauseBtn.setAttribute("aria-label", "Play");

    function updatePlayPauseIcon() {
      const isPlaying = !audioPlayer.paused; // Check current state
      playPauseIcon.innerHTML = isPlaying ? pauseIconSvg : playIconSvg;
      playPauseBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    }

    function togglePlayPause() {
      if (!audioPlayer.src && currentPlan?.song_url) {
        // If no src, try applying current plan's song
        console.log("No audio source, attempting to load from current plan.");
        applyPlan(currentPlan); // This will load and potentially play
        return; // Exit, applyPlan handles playback attempt
      } else if (!audioPlayer.src) {
        console.warn("Cannot play: No audio source set.");
        return; // Nothing to play
      }

      if (audioPlayer.paused) {
        audioPlayer
          .play()
          .then(updatePlayPauseIcon)
          .catch((e) => console.error("Audio play failed:", e));
      } else {
        audioPlayer.pause();
        updatePlayPauseIcon(); // Update icon immediately on pause
      }
    }

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
        // Reset if duration is invalid (e.g., after src change or error)
        if (progress) progress.style.width = "0%";
        if (currentTimeEl) currentTimeEl.textContent = "0:00";
      }
    }

    function seek(event) {
      if (isNaN(audioPlayer.duration) || audioPlayer.duration <= 0) return;
      const rect = progressContainer.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const width = progressContainer.clientWidth;
      const seekRatio = Math.max(0, Math.min(1, clickX / width));
      audioPlayer.currentTime = seekRatio * audioPlayer.duration;
      updateProgress(); // Update UI immediately after seek
    }

    function changeVolume() {
      audioPlayer.volume = volumeSlider.value / 100;
    }

    function restartSong() {
      if (!audioPlayer.src) return; // Don't restart if no song loaded
      audioPlayer.currentTime = 0;
      if (audioPlayer.paused) {
        // If paused, just reset time, don't auto-play
        updateProgress();
      } else {
        // If playing, ensure it continues playing from start
        audioPlayer
          .play()
          .catch((e) => console.error("Audio play failed on restart:", e));
      }
    }

    // Attach Event Listeners
    playPauseBtn.addEventListener("click", togglePlayPause);
    audioPlayer.addEventListener("timeupdate", updateProgress);
    // loadedmetadata and error listeners are handled within applyPlan now
    audioPlayer.addEventListener("play", updatePlayPauseIcon); // Update icon when play starts
    audioPlayer.addEventListener("pause", updatePlayPauseIcon); // Update icon when pause happens
    audioPlayer.addEventListener("ended", () => {
      // Option 1: Stop at end
      // audioPlayer.currentTime = 0; // Reset time
      // updatePlayPauseIcon();
      // updateProgress();

      // Option 2: Loop (uncomment if desired)
      audioPlayer.currentTime = 0;
      audioPlayer
        .play()
        .catch((e) => console.error("Audio play failed on loop:", e));

      // Option 3: Go to next song (requires playlist logic not implemented here)
    });
    progressContainer.addEventListener("click", seek);
    volumeSlider.addEventListener("input", changeVolume);
    prevBtn.addEventListener("click", restartSong);
    nextBtn.addEventListener("click", restartSong); // Currently restarts, could be next track later

    // Set initial volume
    changeVolume();
  } else {
    console.warn(
      "Music player core elements not found. Player non-functional."
    );
  }

  // =========================================================================
  // == COUNTDOWN TIMER LOGIC (Adapted from original)
  // =========================================================================
  const datePicker = document.getElementById("event-date-picker");
  const setDateBtn = document.getElementById("set-date-btn");
  const daysNumEl = document.getElementById("days-num");
  const hoursNumEl = document.getElementById("hours-num");
  const minutesNumEl = document.getElementById("minutes-num");
  const secondsNumEl = document.getElementById("seconds-num");
  const calDay1El = document.getElementById("cal-day-1");
  const calDay2El = document.getElementById("cal-day-2");
  const calDay3El = document.getElementById("cal-day-3");

  if (
    datePicker &&
    setDateBtn &&
    daysNumEl &&
    hoursNumEl &&
    minutesNumEl &&
    secondsNumEl &&
    calDay1El &&
    calDay2El &&
    calDay3El
  ) {
    const localStorageKey = "targetEventDate";
    let targetDate = null;
    let countdownInterval = null;

    function updateCalendarDisplay(dateObj) {
      if (!dateObj || isNaN(dateObj.getTime())) {
        calDay1El.textContent = "--";
        calDay2El.textContent = "--";
        calDay3El.textContent = "--";
        calDay1El.classList.remove("highlight");
        calDay2El.classList.add("highlight");
        calDay3El.classList.remove("highlight");
        return;
      }
      const targetDay = dateObj.getDate();
      const prevDate = new Date(dateObj);
      prevDate.setDate(targetDay - 1);
      const nextDate = new Date(dateObj);
      nextDate.setDate(targetDay + 1);
      calDay1El.textContent = prevDate.getDate();
      calDay2El.textContent = targetDay;
      calDay3El.textContent = nextDate.getDate();
      calDay1El.classList.remove("highlight");
      calDay2El.classList.add("highlight");
      calDay3El.classList.remove("highlight");
    }

    function updateCountdown() {
      if (!targetDate || isNaN(targetDate.getTime())) {
        daysNumEl.textContent = "--";
        hoursNumEl.textContent = "--";
        minutesNumEl.textContent = "--";
        secondsNumEl.textContent = "--";
        return;
      }
      const now = new Date().getTime();
      const difference = targetDate.getTime() - now;
      if (difference <= 0) {
        daysNumEl.textContent = "00";
        hoursNumEl.textContent = "00";
        minutesNumEl.textContent = "00";
        secondsNumEl.textContent = "00";
        if (countdownInterval) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
        return;
      }
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      daysNumEl.textContent = padZero(days);
      hoursNumEl.textContent = padZero(hours);
      minutesNumEl.textContent = padZero(minutes);
      secondsNumEl.textContent = padZero(seconds);
    }

    function startCountdown() {
      if (countdownInterval) clearInterval(countdownInterval);
      if (
        targetDate &&
        !isNaN(targetDate.getTime()) &&
        targetDate.getTime() > new Date().getTime()
      ) {
        updateCountdown(); // Update immediately
        countdownInterval = setInterval(updateCountdown, 1000);
      } else {
        updateCountdown(); // Update to show 00 or --
      }
    }

    function handleSetDate() {
      const selectedDateString = datePicker.value;
      if (!selectedDateString) {
        alert("Please select a date.");
        return;
      }
      // Basic validation, consider adding more robust date parsing/validation
      const parts = selectedDateString.split("-");
      if (parts.length !== 3) {
        alert("Invalid date format.");
        return;
      }
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        alert("Invalid date components.");
        return;
      }

      const potentialTargetDate = new Date(Date.UTC(year, month, day)); // Use UTC to avoid timezone issues
      if (isNaN(potentialTargetDate.getTime())) {
        alert("Invalid date selected.");
        return;
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0); // Compare with UTC today
      if (potentialTargetDate < today) {
        alert("Please select a future date (or today).");
        return;
      }

      localStorage.setItem(localStorageKey, selectedDateString);
      targetDate = potentialTargetDate;
      updateCalendarDisplay(targetDate);
      startCountdown();
    }

    function loadDateFromStorage() {
      const storedDateString = localStorage.getItem(localStorageKey);
      if (storedDateString) {
        const parts = storedDateString.split("-");
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            const loadedDate = new Date(Date.UTC(year, month, day));
            if (!isNaN(loadedDate.getTime())) {
              targetDate = loadedDate;
              datePicker.value = storedDateString; // Set picker value
              updateCalendarDisplay(targetDate);
              startCountdown();
              return; // Exit if loaded successfully
            }
          }
        }
        // If stored data is invalid, remove it
        localStorage.removeItem(localStorageKey);
      }
      // If no valid data loaded, initialize display
      updateCalendarDisplay(null);
      updateCountdown();
    }

    // Attach Listener and Load Initial State
    setDateBtn.addEventListener("click", handleSetDate);
    loadDateFromStorage();
  } else {
    console.warn("Countdown timer elements not found.");
  }

  // =========================================================================
  // == LEAFLET MAP INITIALIZATION (Using fetched data)
  // =========================================================================
  const venueMapContainer = document.getElementById("venue-map");
  if (venueMapContainer && typeof L !== "undefined") {
    // Check Leaflet exists
    if (fetchedVenueData.length > 0) {
      try {
        const firstVenue = fetchedVenueData[0];
        // Use first venue's coords, fall back to default if missing
        const initialCoords =
          firstVenue?.latitude != null && firstVenue?.longitude != null
            ? [firstVenue.latitude, firstVenue.longitude]
            : [42.8749, 74.6049]; // Default (e.g., Bishkek center)

        venueMapInstance = L.map(venueMapContainer, {
          zoomControl: false,
        }).setView(initialCoords, MAP_ZOOM_LEVEL);
        L.control.zoom({ position: "bottomright" }).addTo(venueMapInstance);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(venueMapInstance);

        venueMarker = L.marker(initialCoords).addTo(venueMapInstance);
        if (firstVenue?.name) {
          venueMarker.bindPopup(`<b>${firstVenue.name}</b>`).openPopup(); // Optionally open popup initially
        }

        // Invalidate size after a short delay to ensure proper rendering
        setTimeout(() => {
          if (venueMapInstance) venueMapInstance.invalidateSize();
        }, 250);
      } catch (error) {
        console.error("Error initializing Leaflet map:", error);
        if (venueMapContainer)
          venueMapContainer.innerHTML = "<p class='map-error'>Map Error</p>";
      }
    } else {
      // Handle case where no venues were fetched
      console.warn("Map initialization skipped: No venue data fetched.");
      if (venueMapContainer)
        venueMapContainer.innerHTML =
          "<p class='map-error'>No venues found</p>";
    }
  } else {
    console.warn("Map container or Leaflet library (L) not found.");
  }

  // =========================================================================
  // == VENUE SWIPER LOGIC (Using fetched data)
  // =========================================================================
  const venueCard = document.getElementById("venue-details-card");
  const chooseVenueCard = document.getElementById("choose-venue-card");
  // The map card doesn't swipe its content, only the other two do
  // const suggestionCard = document.querySelector(".venue-suggestion");

  // Check if main swipeable cards and fetched data exist
  if (venueCard && chooseVenueCard && fetchedVenueData.length > 0) {
    const venueWrapper = venueCard.querySelector(".card-content-wrapper");
    const chooseWrapper = chooseVenueCard.querySelector(
      ".card-content-wrapper"
    );
    const allDotsInnerContainers = document.querySelectorAll(".dots-inner"); // Get dots containers from BOTH cards

    // Check if all necessary inner elements for displaying data exist
    const venueNameEl = venueWrapper?.querySelector(".venue-name");
    const venueDateEl = venueWrapper?.querySelector(".venue-date");
    const ratingEl = chooseWrapper?.querySelector(".rating");
    const ratingTextEl = chooseWrapper?.querySelector(".rating-text");
    const venueIcon1El = chooseWrapper?.querySelector(".venue-icon-1");
    const venueIcon2El = chooseWrapper?.querySelector(".venue-icon-2");

    if (
      venueWrapper &&
      chooseWrapper &&
      allDotsInnerContainers.length >= 2 && // Ensure we have dots for both cards
      venueNameEl &&
      venueDateEl &&
      ratingEl &&
      ratingTextEl &&
      venueIcon1El &&
      venueIcon2El
    ) {
      let isDragging = false,
        startX = 0,
        currentX = 0,
        diffX = 0,
        cardWidth = venueCard.offsetWidth;

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
        allDotsInnerContainers.forEach((dotsInner) => {
          if (!dotsInner) return;
          const dots = dotsInner.querySelectorAll("span");
          const dotsContainer = dotsInner.parentElement; // The element with class 'dots'

          if (
            !dotsContainer ||
            dots.length !== fetchedVenueData.length ||
            dots.length === 0
          )
            return;

          dots.forEach((dot, index) =>
            dot.classList.toggle("active", index === activeIndex)
          );

          // Centering logic for dots
          const dotTotalWidth = DOT_WIDTH + DOT_MARGIN * 2;
          const containerVisibleWidth = dotsContainer.offsetWidth;
          const containerCenter = containerVisibleWidth / 2;
          const activeDotCenterOffset =
            activeIndex * dotTotalWidth + dotTotalWidth / 2;
          let translateX = containerCenter - activeDotCenterOffset;
          const maxTranslate = 0;
          const totalInnerWidth = fetchedVenueData.length * dotTotalWidth;
          const minTranslate = Math.min(
            0,
            containerVisibleWidth - totalInnerWidth
          ); // Ensure minTranslate <= 0

          if (totalInnerWidth > containerVisibleWidth) {
            translateX = Math.min(
              maxTranslate,
              Math.max(minTranslate, translateX)
            );
          } else {
            // Center dots if they all fit
            translateX = (containerVisibleWidth - totalInnerWidth) / 2;
          }
          dotsInner.style.transform = `translateX(${translateX}px)`;
        });
      }

      function updateVenueMap(lat, lng, venueName) {
        if (
          venueMapInstance &&
          venueMarker &&
          typeof lat === "number" &&
          typeof lng === "number"
        ) {
          const newLatLng = [lat, lng];
          venueMapInstance.setView(newLatLng, MAP_ZOOM_LEVEL, {
            animate: true,
            pan: { duration: 0.5 },
          });
          venueMarker.setLatLng(newLatLng);
          if (venueName) {
            venueMarker.setPopupContent(`<b>${venueName}</b>`);
            // venueMarker.openPopup(); // Optionally re-open popup on change
          }
          // Ensure map size is correct, especially if container size changed
          setTimeout(() => {
            if (venueMapInstance) venueMapInstance.invalidateSize();
          }, 150);
        } else {
          console.warn(
            "Map update skipped: Instance, marker, or coords missing/invalid."
          );
        }
      }

      // Replace the existing displayVenue function with this one

// Replace the existing displayVenue function in frontend/player.js

function displayVenue(index) {
    // --- Get DOM Elements ---
    const venueCard = document.getElementById("venue-details-card");
    const chooseVenueCard = document.getElementById("choose-venue-card");
    if (!venueCard || !chooseVenueCard) { console.error("Cannot find venueCard or chooseVenueCard elements."); return; }
    const venueWrapper = venueCard.querySelector(".card-content-wrapper");
    const chooseWrapper = chooseVenueCard.querySelector(".card-content-wrapper");
    if (!venueWrapper || !chooseWrapper) { console.error("Could not find .card-content-wrapper in cards."); return; }

    // --- Get Data ---
    if (index < 0 || index >= fetchedVenueData.length) { console.error(`Invalid venue index: ${index}`); return; }
    const venueDataForThisCard = fetchedVenueData[index]; // Use a distinct name
    console.log(`displayVenue called for index: ${index}, Venue ID: ${venueDataForThisCard?.id}, Name: ${venueDataForThisCard?.name}`);

    // --- Check for ID ---
    if (venueDataForThisCard.id === undefined || venueDataForThisCard.id === null) {
         console.error("Venue data is missing 'id' property:", venueDataForThisCard);
    }

    // --- Update Card Content (Existing logic) ---
    const venueNameEl = venueWrapper.querySelector(".venue-name");
    // ... (rest of element selections: venueDateEl, ratingEl, etc.) ...
    if (venueNameEl) venueNameEl.textContent = venueDataForThisCard.name || "Venue Name";
    // ... (rest of DOM updates using venueDataForThisCard) ...
    if (venueDataForThisCard.image_url) { venueCard.style.backgroundImage = `url('${venueDataForThisCard.image_url}')`; } else { /* ... fallback ... */ }
    // ... (update rating, icons etc.) ...

    // --- Update Map & Dots (Existing logic) ---
    updateVenueMap(venueDataForThisCard.latitude, venueDataForThisCard.longitude, venueDataForThisCard.name);
    updateDots(index);


    // --- CLICK LISTENER LOGIC (Revised Approach) ---

    // Store the ID directly on the element using a data attribute
    const currentVenueId = venueDataForThisCard.id;
    if (currentVenueId !== undefined && currentVenueId !== null) {
        venueWrapper.setAttribute('data-venue-id', currentVenueId);
        chooseWrapper.setAttribute('data-venue-id', currentVenueId);
        console.log(`   -> Set data-venue-id="${currentVenueId}" on wrappers for index ${index}`);
    } else {
        // Remove attribute if ID is missing, just in case
        venueWrapper.removeAttribute('data-venue-id');
        chooseWrapper.removeAttribute('data-venue-id');
        console.warn(`   -> No valid venue ID found for index ${index}, click listener might not work correctly.`);
    }

    // Define ONE handler function outside the loop/displayVenue if possible,
    // OR define it here but make it read the ID from the clicked element.
    const handleCardClick = (event) => {
        // Use event.currentTarget to ensure we get the element the listener was attached to
        const clickedWrapper = event.currentTarget;
        console.log("Card content wrapper clicked!", clickedWrapper);

        // Get the venue ID stored on the element
        const venueId = clickedWrapper.getAttribute('data-venue-id');
        console.log(`   -> Click handler fired. Reading data-venue-id: "${venueId}"`);

        if (venueId) { // Check if the attribute value exists and is not empty
            const venueDetailUrl = `venue-detail.html?id=${venueId}`;
            console.log(`   -> Attempting to open URL: ${venueDetailUrl}`);
            const newWindow = window.open(venueDetailUrl, '_blank');
            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                console.warn("   -> Pop-up blocked?");
                // alert("Please allow pop-ups for this site to view venue details.");
            }
        } else {
            console.warn("   -> Cannot open detail page: data-venue-id attribute missing or empty on clicked element.", clickedWrapper);
        }
    };

    // --- Attach/Re-attach Listeners ---
    // Remove previous listeners using the SAME function reference.
    // For this to work reliably, handleCardClick should ideally be defined *outside* displayVenue,
    // but attaching it here and reading the data attribute is a good compromise.
    // Let's first *try* without explicit removal, relying on overwrite/browser behavior. If issues persist,
    // we might need a more complex listener management system.

    // Clear old .onclick assignments just to be safe from very old code versions.
    venueWrapper.onclick = null;
    chooseWrapper.onclick = null;

    // Add the event listener. It will now read the ID from the data attribute when clicked.
    venueWrapper.addEventListener('click', handleCardClick);
    chooseWrapper.addEventListener('click', handleCardClick);
    console.log(`   -> Click listeners RE-ATTACHED for index ${index}`);

} // --- End displayVenue ---

      // --- Swipe Event Handlers ---
      function handleSwipeStart(e) {
        // Prevent swipe if clicking on interactive elements within the card
        if (e.target.closest("button, input, a, .dots, .leaflet-container"))
          return;
        isDragging = true;
        startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
        currentX = startX;
        diffX = 0;
        cardWidth = venueCard.offsetWidth; // Get width at drag start
        // Add class for visual feedback during swipe (optional)
        venueWrapper.classList.add("is-swiping");
        chooseWrapper.classList.add("is-swiping");
        // Prevent default touch actions like scrolling while swiping horizontally
        if (e.type.includes("touch")) e.preventDefault();
      }

      function handleSwipeMove(e) {
        if (!isDragging) return;
        currentX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
        diffX = currentX - startX;
        // Apply translation to both swiping cards
        const transformValue = `translateX(${diffX}px)`;
        venueWrapper.style.transform = transformValue;
        chooseWrapper.style.transform = transformValue;
        // Prevent default touch actions
        if (e.type.includes("touch")) e.preventDefault();
      }

      function handleSwipeEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        // Remove swiping class
        venueWrapper.classList.remove("is-swiping");
        chooseWrapper.classList.remove("is-swiping");

        const threshold = cardWidth / 4; // Swipe threshold (adjust as needed)
        let newIndex = currentVenueIndex;

        // Determine if swipe was significant enough to change index
        if (
          diffX < -threshold &&
          currentVenueIndex < fetchedVenueData.length - 1
        ) {
          newIndex++; // Swipe left, go to next
        } else if (diffX > threshold && currentVenueIndex > 0) {
          newIndex--; // Swipe right, go to previous
        }

        // Snap back animation (using CSS transitions preferably, but JS fallback ok)
        venueWrapper.style.transition = "transform 0.3s ease-out"; // Add transition for snap
        chooseWrapper.style.transition = "transform 0.3s ease-out";
        venueWrapper.style.transform = `translateX(0px)`;
        chooseWrapper.style.transform = `translateX(0px)`;

        // Remove transition after snap back to allow smooth dragging next time
        setTimeout(() => {
          venueWrapper.style.transition = "";
          chooseWrapper.style.transition = "";
        }, 300);

        // If index changed, update the displayed venue
        if (newIndex !== currentVenueIndex) {
          currentVenueIndex = newIndex;
          displayVenue(currentVenueIndex);
        }

        diffX = 0; // Reset difference
      }

      // Attach swipe event listeners to the cards that should initiate the swipe
      venueCard.addEventListener("mousedown", handleSwipeStart);
      venueCard.addEventListener("touchstart", handleSwipeStart, {
        passive: false,
      }); // passive: false to allow preventDefault
      chooseVenueCard.addEventListener("mousedown", handleSwipeStart);
      chooseVenueCard.addEventListener("touchstart", handleSwipeStart, {
        passive: false,
      });

      // Attach move/end listeners to the document to catch drags outside the card
      document.addEventListener("mousemove", handleSwipeMove);
      document.addEventListener("touchmove", handleSwipeMove, {
        passive: false,
      }); // passive: false to allow preventDefault
      document.addEventListener("mouseup", handleSwipeEnd);
      document.addEventListener("touchend", handleSwipeEnd);
      // Also handle mouse leaving the window during a drag
      document.addEventListener("mouseleave", handleSwipeEnd);

      // --- Initial Swiper Setup ---
      generateDots();
      displayVenue(currentVenueIndex); // Display the first venue initially

      // --- Resize Handler ---
      window.addEventListener("resize", () => {
        if (venueCard) cardWidth = venueCard.offsetWidth; // Update card width on resize
        updateDots(currentVenueIndex); // Recalculate dot positions
        // Invalidate map size on resize as well
        if (venueMapInstance) {
          setTimeout(() => {
            venueMapInstance.invalidateSize();
          }, 150);
        }
      });
    } else {
      console.error(
        "Swiper setup failed: Essential inner elements (wrappers, dots, venue details) or dots containers missing."
      );
    }
  } else {
    // Handle case where cards are missing or no venue data was fetched
    console.warn(
      "Swiper setup skipped: Base card elements or fetched venue data missing."
    );
    // Optionally hide the swiper section or display a message
  }

  // =========================================================================
  // == INTERACTIVE CHECKLIST LOGIC (Copied from original, ensure selector is correct)
  // =========================================================================
  const checklistKey = "interactiveChecklistState"; // Key for localStorage
  // *** IMPORTANT: Verify this selector matches your HTML structure ***
  const checklistItems = document.querySelectorAll(
    '.interactive-checklist input[type="checkbox"]'
  );

  if (checklistItems.length > 0) {
    function saveChecklistState() {
      const state = {};
      checklistItems.forEach((item) => {
        state[item.id] = item.checked;
      });
      localStorage.setItem(checklistKey, JSON.stringify(state));
    }

    function loadChecklistState() {
      const savedState = localStorage.getItem(checklistKey);
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          checklistItems.forEach((item) => {
            if (state[item.id] !== undefined) {
              item.checked = state[item.id];
            }
          });
        } catch (e) {
          console.error("Error parsing checklist state from localStorage", e);
          localStorage.removeItem(checklistKey);
        }
      }
    }

    // Add event listeners and load initial state
    checklistItems.forEach((item) => {
      item.addEventListener("change", saveChecklistState);
    });
    loadChecklistState(); // Load state when DOM is ready
  } else {
    console.warn(
      "Checklist items not found with selector '.interactive-checklist input[type=\"checkbox\"]'"
    );
  }

  // =========================================================================
  // == PLAN SWITCHER BUTTONS (Create dynamically)
  // =========================================================================
  if (fetchedPlanData.length > 0) {
    const planSwitcherContainer = document.createElement("div");
    planSwitcherContainer.className = "plan-switcher-container"; // Add a class for styling
    planSwitcherContainer.style.textAlign = "center";
    planSwitcherContainer.style.padding = "20px 0"; // Add some padding

    fetchedPlanData.forEach((plan) => {
      const button = document.createElement("button");
      button.textContent = `Activate ${plan.name}`; // More descriptive text
      button.className = "btn btn-secondary btn-switch-plan"; // Use existing styles + add specific class
      button.style.margin = "0 8px"; // Add some spacing
      button.setAttribute("data-plan-id", plan.id); // Store plan ID if needed
      button.onclick = () => applyPlan(plan); // Call applyPlan when clicked
      planSwitcherContainer.appendChild(button);
    });

    // Add the container to the page (e.g., after the hero section, before features)
    const featuresSection = document.querySelector(".features");
    if (featuresSection) {
      // Insert before the features section for better placement
      featuresSection.parentNode.insertBefore(
        planSwitcherContainer,
        featuresSection
      );
    } else {
      // Fallback: append to body if features section isn't found
      console.warn(
        "Features section not found, appending plan switcher to body."
      );
      document.body.appendChild(planSwitcherContainer);
    }
  } else {
    console.log(
      "No plan data fetched, skipping plan switcher button creation."
    );
  }

  console.log("Initial setup complete.");
}); // --- END DOMContentLoaded ---
