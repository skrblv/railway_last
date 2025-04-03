// frontend/venue-detail.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selections ---
    const venueNameHeader = document.getElementById('venue-name-header');
    const venueDetailContainer = document.getElementById('venue-detail-content');
    const planSwitcherPlaceholder = document.getElementById('plan-switcher-placeholder');
    const audioPlayer = document.getElementById('audio-player');
    const stickyPlayPauseBtn = document.getElementById('sticky-play-pause-btn');
    const stickyPlayPauseIcon = document.getElementById('sticky-play-pause-icon');
    const stickyAlbumArt = document.getElementById('sticky-album-art');
    const stickyTrackTitle = document.getElementById('sticky-track-title');
    const stickyArtistName = document.getElementById('sticky-artist-name');
    const playerElement = document.querySelector('.sticky-music-player');

    // --- Constants & Config ---
    const API_BASE_URL = '/api'; // Kept deployment path
    const ROUTING_STORAGE_KEY = 'venueRouteWaypoints_v2';
    // !!! VERIFY THESE PATHS FOR YOUR DEPLOYMENT !!!
    const VENUE_SIGN_IMAGE_URL = 'assets/heart.png'; // Using the one from your code
    const PLACEHOLDER_ALBUM_ART = 'assets/placeholder-album.png'; // Using the one from your code
    const PLACEHOLDER_BUILDING_IMG = 'img/placeholder-building.jpg'; // Using the one from your code
    const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 0 24 24" width="28px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M8 5v14l11-7L8 5z"/></svg>`;
    const pauseIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 0 24 24" width="28px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    const THEME_A_CLASS = 'theme-plan-a-sad';
    const THEME_B_CLASS = 'theme-plan-b-green';

    // --- State Variables ---
    let map = null;
    let routingControl = null;
    let lastClickedLatLng = null;
    let tempClickMarker = null;
    let noMapMessageElement = null;
    let fetchedPlanData = [];
    let currentPlan = null; // Holds the *originally selected* plan (A or B or other)
    let effectiveAudioData = null; // *** NEW: Holds the data *used* for audio (might be swapped for A/B) ***
    let isAudioSetup = false;
    let wasPlayingBeforeApply = false;

    // ============================================================
    // == Helper & UI Functions ===================================
    // ============================================================

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) seconds = 0;
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
    }

    function padZero(num) { // Currently unused
        return num < 10 ? "0" + num : num;
    }

    function setLoading(isLoading) {
        let loadingDiv = venueDetailContainer.querySelector('.loading');
        const contentElements = venueDetailContainer.querySelectorAll(':scope > *:not(.loading)');

        if (isLoading) {
            contentElements.forEach(el => el.style.display = 'none');
            if (!loadingDiv) {
                loadingDiv = document.createElement('div');
                loadingDiv.className = 'loading';
                loadingDiv.textContent = 'Загрузка деталей места...';
                venueDetailContainer.prepend(loadingDiv);
            }
            loadingDiv.style.display = 'flex';
        } else {
            if (loadingDiv) loadingDiv.remove();
            contentElements.forEach(el => {
                if (!el.classList?.contains('map-controls-embedded') &&
                    el.id !== 'venue-map-embedded' &&
                    !el.classList?.contains('no-map-message')) {
                    el.style.display = '';
                }
            });
             // Map visibility handled in displayVenueDetails
        }
    }

    function displayError(message) {
        console.error("Displaying Error:", message);
        venueDetailContainer.innerHTML = `<div class="error-message">Ошибка: ${message}</div>`;
        if (playerElement) playerElement.style.display = 'none';
        if (planSwitcherPlaceholder) planSwitcherPlaceholder.style.display = 'none';
        if (message.toLowerCase().includes("id") || message.toLowerCase().includes("not found")) {
             venueNameHeader.textContent = "Ошибка загрузки";
        }
        setLoading(false);
    }

    function updateStickyPlayPauseIcon() {
        if (!audioPlayer || !stickyPlayPauseIcon || !stickyPlayPauseBtn) return;
        const isPlaying = audioPlayer.src && !audioPlayer.paused && audioPlayer.readyState > 0;
        stickyPlayPauseIcon.innerHTML = isPlaying ? pauseIconSvg : playIconSvg;
        stickyPlayPauseBtn.setAttribute("aria-label", isPlaying ? "Пауза" : "Играть");
    }

    function setPlayerDefaultState(message = "Трек не выбран") {
        console.log("Setting player to default state:", message);
        if(playerElement) playerElement.style.display = fetchedPlanData.length > 0 ? '' : 'none';
        if(stickyTrackTitle) stickyTrackTitle.textContent = fetchedPlanData.length > 0 ? message : "Планов нет";
        if(stickyArtistName) stickyArtistName.textContent = fetchedPlanData.length > 0 ? "" : "";
        if(stickyAlbumArt) stickyAlbumArt.src = PLACEHOLDER_ALBUM_ART;
        if(audioPlayer) {
            audioPlayer.pause();
            audioPlayer.src = '';
            effectiveAudioData = null; // *** UPDATED: Reset effective data ***
        }
        updateStickyPlayPauseIcon();
    }


    // ============================================================
    // == Core Logic: Fetching, Applying Plans, Audio ============
    // ============================================================

    async function fetchPlans() {
        try {
            const response = await fetch(`${API_BASE_URL}/plans/`);
            if (!response.ok) throw new Error(`HTTP ошибка при загрузке планов! Статус: ${response.status}`);
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) throw new Error(`Ожидался JSON, получен ${contentType}`);

            fetchedPlanData = await response.json();
            console.log("Fetched Plans:", fetchedPlanData);
            currentPlan = fetchedPlanData.find(p => p.name?.trim().toLowerCase() === 'a') || fetchedPlanData[0] || null;
            console.log("Default plan identified as:", currentPlan?.name || 'None');

        } catch (error) {
            console.error("Fetch Plans Error:", error);
            fetchedPlanData = [];
            currentPlan = null;
            if (planSwitcherPlaceholder) planSwitcherPlaceholder.textContent = "Ошибка загрузки планов.";
        }
    }

    async function fetchVenueDetails(id) {
        const apiUrl = `${API_BASE_URL}/venues/${id}/`;
        console.log("Fetching venue details from:", apiUrl);
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                if (response.status === 404) throw new Error(`Место с ID ${id} не найдено.`);
                else throw new Error(`HTTP ошибка при загрузке места! Статус: ${response.status}`);
            }
            const venueData = await response.json();
            console.log("Venue data received:", venueData);
            displayVenueDetails(venueData);
        } catch (error) {
            console.error("Fetch Venue Details Error:", error);
            displayError(error.message || "Не удалось загрузить детали места.");
            throw error;
        }
    }

    /**
     * *** UPDATED applyPlan function with audio swap logic ***
     * Applies the selected plan: sets the theme based on the original plan (A/B),
     * but uses audio data from the *other* plan if A or B is selected and both exist.
     * @param {object} plan - The plan object triggered by the button click.
     */
    function applyPlan(plan) {
        if (!plan || typeof plan !== 'object') {
            console.warn("applyPlan: Invalid plan provided.");
            return;
        }

        const originalPlanNameLower = plan.name ? plan.name.trim().toLowerCase() : '';
        console.log(`== Applying Plan: ${plan.name || 'Unnamed Plan'} (ID: ${plan.id}, OriginalNameLower: '${originalPlanNameLower}') ==`);
        currentPlan = plan; // Store the *originally triggered* plan
        const body = document.body;

        let planA = fetchedPlanData.find(p => p.name?.trim().toLowerCase() === 'a');
        let planB = fetchedPlanData.find(p => p.name?.trim().toLowerCase() === 'b');

        // Determine which data to use for audio based on the SWAP logic
        // effectiveAudioData is now a global variable, update it here
        effectiveAudioData = { ...plan }; // Start with a copy of the original plan's data

        if (planA && planB) { // Swap logic only if both A and B exist
            console.log("Found both Plan A and Plan B. Checking for audio swap.");
            if (originalPlanNameLower === 'a') {
                console.log("--> Applying Plan A's theme: Using Plan B's audio data.");
                // Use B's audio data but keep original plan's theme/other non-audio info if needed
                effectiveAudioData = { ...planB, id: plan.id, name: plan.name, theme: plan.theme }; // Example: keeping original id/name/theme
            } else if (originalPlanNameLower === 'b') {
                console.log("--> Applying Plan B's theme: Using Plan A's audio data.");
                // Use A's audio data but keep original plan's theme/other non-audio info if needed
                effectiveAudioData = { ...planA, id: plan.id, name: plan.name, theme: plan.theme }; // Example: keeping original id/name/theme
            } else {
                console.log(`--> Applying Plan ${plan.name}: Not A or B, using original audio data.`);
                 // effectiveAudioData already holds the original plan data
            }
        } else {
             console.log("Did not find both Plan A and Plan B. Using original audio data for plan:", plan.name);
             // effectiveAudioData already holds the original plan data
        }
         console.log("Effective audio data determined:", {
             title: effectiveAudioData.track_title,
             artist: effectiveAudioData.artist_name,
             song_url: effectiveAudioData.song_url ? '...' + effectiveAudioData.song_url.slice(-20) : 'None'
        });

        // --- Apply Theme (based on ORIGINAL plan 'a' or 'b') ---
        console.log("Current body classes before theme update:", body.className);
        body.classList.remove(THEME_A_CLASS, THEME_B_CLASS);

        if (originalPlanNameLower === 'a') {
            console.log(`--> Applying theme class: '${THEME_A_CLASS}' (for original Plan A)`);
            body.classList.add(THEME_A_CLASS);
        } else if (originalPlanNameLower === 'b') {
            console.log(`--> Applying theme class: '${THEME_B_CLASS}' (for original Plan B)`);
            body.classList.add(THEME_B_CLASS);
        } else {
            console.log(`--> Applying default styles (no specific theme class for original plan '${originalPlanNameLower || 'unnamed'}').`);
        }
        console.log("Body classes after theme update:", body.className);

        // --- Handle Audio (using 'effectiveAudioData') ---
        if (!audioPlayer || !playerElement) {
             console.warn("applyPlan: Player elements missing, cannot handle audio.");
             return;
        }
        playerElement.style.display = '';

        wasPlayingBeforeApply = audioPlayer.src && !audioPlayer.paused && audioPlayer.currentTime > 0;
        console.log("Audio state before apply:", { wasPlayingBeforeApply, currentSrc: audioPlayer.currentSrc });

        const newSongUrl = effectiveAudioData.song_url; // Use URL from effective data
        const currentSongUrl = audioPlayer.currentSrc;

        audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad);
        audioPlayer.removeEventListener("error", handleAudioError);
        audioPlayer.addEventListener("loadedmetadata", handleMetadataLoad, { once: true });
        audioPlayer.addEventListener("error", handleAudioError, { once: true });

        if (newSongUrl && newSongUrl !== currentSongUrl) {
            console.log(`Setting new audio source (from effective data): ${newSongUrl}`);
            audioPlayer.src = newSongUrl;
            audioPlayer.load();
        } else if (!newSongUrl) {
            console.warn(`Effective plan for "${plan.name || plan.id}" has no song_url. Stopping audio.`);
            audioPlayer.pause();
            audioPlayer.src = "";
            wasPlayingBeforeApply = false;
            effectiveAudioData = null; // Reset effective data as no song is loaded
        } else {
             console.log(`Audio source unchanged or already set to (from effective data): ${currentSongUrl || 'empty'}`);
             if (!wasPlayingBeforeApply) updateStickyPlayPauseIcon();
             if (wasPlayingBeforeApply && audioPlayer.paused) {
                 console.log("Source unchanged, attempting to resume playback for already paused audio.");
                 const playPromise = audioPlayer.play();
                 if (playPromise?.catch) playPromise.catch(e => console.error("Resume playback failed:", e));
             }
        }

        // Update player metadata using 'effectiveAudioData'
        if(stickyAlbumArt) stickyAlbumArt.src = effectiveAudioData?.album_art_url || PLACEHOLDER_ALBUM_ART;
        if(stickyAlbumArt) stickyAlbumArt.alt = effectiveAudioData?.track_title || "Album Art";
        if(stickyTrackTitle) stickyTrackTitle.textContent = effectiveAudioData?.track_title || "Трек недоступен";
        if(stickyArtistName) stickyArtistName.textContent = effectiveAudioData?.artist_name || "Неизвестный исполнитель";

        if (!newSongUrl) updateStickyPlayPauseIcon();
        // Playback resume handled in handleMetadataLoad
    }

    /**
     * *** UPDATED handleMetadataLoad using effectiveAudioData ***
     */
    const handleMetadataLoad = () => {
        console.log(`Metadata loaded for ${audioPlayer.src?.split('/').pop() || 'unknown track'}. Duration: ${formatTime(audioPlayer.duration)}. ReadyState: ${audioPlayer.readyState}`);

        // Check against effectiveAudioData for the song URL
        if (wasPlayingBeforeApply && effectiveAudioData?.song_url && audioPlayer.readyState >= 2) {
            console.log("Attempting to resume playback after metadata load...");
            const playPromise = audioPlayer.play();
            if (playPromise?.then) {
                playPromise.then(() => {
                    console.log("Playback resumed successfully via promise.");
                    updateStickyPlayPauseIcon();
                })
                .catch(e => {
                    console.error("Resume playback failed:", e);
                    updateStickyPlayPauseIcon();
                });
            } else {
                console.log("Playback resumed (sync or no promise).");
                updateStickyPlayPauseIcon();
            }
        } else {
             console.log("Not resuming playback (was paused before, no effective song URL, or audio not ready). State:", { wasPlayingBeforeApply, hasEffectiveSongUrl: !!effectiveAudioData?.song_url, readyState: audioPlayer.readyState });
             updateStickyPlayPauseIcon();
        }
        wasPlayingBeforeApply = false;
    };

    const handleAudioError = (e) => {
        console.error("Audio Player Error:", e.target.error?.message || 'Unknown audio error', 'on source:', audioPlayer.src);
        setPlayerDefaultState("Ошибка загрузки трека");
        wasPlayingBeforeApply = false;
    };

    /**
     * *** UPDATED toggleStickyPlayPause considering audio swap ***
     */
    function toggleStickyPlayPause() {
        if (!audioPlayer) {
            console.warn("Toggle Play/Pause aborted: Audio player element not found.");
            return;
        }
        console.log("Toggle play/pause. Current state -> Paused:", audioPlayer.paused, "| Src:", !!audioPlayer.src, "| ReadyState:", audioPlayer.readyState);

        // Determine if there's a song *available* to play based on the *currentPlan* and swap logic
        let availableSongUrl = null;
        if (currentPlan) {
             const planA = fetchedPlanData.find(p => p.name?.trim().toLowerCase() === 'a');
             const planB = fetchedPlanData.find(p => p.name?.trim().toLowerCase() === 'b');
             const originalPlanNameLower = currentPlan.name?.trim().toLowerCase();

             if (planA && planB) { // Check swap logic first
                 if (originalPlanNameLower === 'a') availableSongUrl = planB.song_url;
                 else if (originalPlanNameLower === 'b') availableSongUrl = planA.song_url;
                 else availableSongUrl = currentPlan.song_url; // Fallback to original if not A or B
             } else { // If A or B missing, use original
                 availableSongUrl = currentPlan.song_url;
             }
        }

        // Case 1: No current src, but a song is available for the current plan (after potential swap)
        if (!audioPlayer.src && availableSongUrl) {
            console.log("No audio source set. Applying current plan first with intent to play (using potentially swapped audio)...");
            wasPlayingBeforeApply = true;
            applyPlan(currentPlan); // applyPlan handles setting the correct (swapped) src
            return;
        }
        // Case 2: No current src and no song available for current plan
        else if (!audioPlayer.src) {
            console.warn("Cannot play: No audio source set and no current plan with audio.");
            setPlayerDefaultState("Трек не выбран");
            return;
        }
        // Case 3: Source exists, toggle play/pause
        if (audioPlayer.paused) {
             console.log("Attempting to play audio...");
             const playPromise = audioPlayer.play();
             if (playPromise !== undefined) {
                 playPromise.then(() => {
                     console.log("Playback started via promise.");
                     updateStickyPlayPauseIcon();
                 }).catch(error => {
                     console.error("Audio play failed:", error);
                     updateStickyPlayPauseIcon();
                 });
             } else {
                 console.log("Playback started (sync or no promise).");
                 updateStickyPlayPauseIcon();
             }
        } else {
            console.log("Attempting to pause audio...");
            audioPlayer.pause();
            updateStickyPlayPauseIcon();
        }
    }

    function setupAudioListeners() {
         if (!audioPlayer || isAudioSetup) return;
         console.log("Setting up persistent audio event listeners.");

         audioPlayer.addEventListener('play', updateStickyPlayPauseIcon);
         audioPlayer.addEventListener('pause', updateStickyPlayPauseIcon);
         audioPlayer.addEventListener('ended', handleAudioEnded); // Loop track

         // loadedmetadata and error handled dynamically in applyPlan

         if(stickyPlayPauseBtn) {
            stickyPlayPauseBtn.removeEventListener('click', toggleStickyPlayPause);
            stickyPlayPauseBtn.addEventListener('click', toggleStickyPlayPause);
         } else {
            console.warn("Sticky play/pause button not found for listener setup.");
         }

         isAudioSetup = true;
    }

    const handleAudioEnded = () => {
         console.log('Audio track ended - Restarting (Looping)');
         audioPlayer.currentTime = 0;
         setTimeout(() => { // Small delay for stability
            const playPromise = audioPlayer.play();
            if (playPromise?.catch) playPromise.catch(e => console.error("Loop playback failed:", e));
         }, 100);
    };


    // ============================================================
    // == Venue Detail Display & Map Logic ========================
    // ============================================================

    // DisplayVenueDetails remains largely the same, only removed sign image handling
    // based on previous CSS changes suggesting it might not be needed.
    function displayVenueDetails(venue) {
        if (!venue) {
            displayError("Получены неверные данные о месте.");
            return;
        }
        venueDetailContainer.innerHTML = '';
        venueNameHeader.textContent = venue.name || 'Детали места';

        // --- Images ---
        const imagesDiv = document.createElement('div');
        imagesDiv.className = 'venue-images';
        const photoImgSrc = venue.image_url || PLACEHOLDER_BUILDING_IMG;
        // Removed venue-sign-image from here based on CSS removal/hiding
        imagesDiv.innerHTML = `<img id="venue-photo" src="${photoImgSrc}" alt="Фото ${venue.name || ''}">`;
        venueDetailContainer.appendChild(imagesDiv);

        const venuePhotoImg = imagesDiv.querySelector('#venue-photo');
        if (venuePhotoImg) {
            venuePhotoImg.onerror = () => {
                if (venuePhotoImg) venuePhotoImg.src = PLACEHOLDER_BUILDING_IMG;
                console.warn("Venue photo failed to load, using placeholder.");
            };
        }

        // --- Info Section ---
        const infoDiv = document.createElement('div');
        infoDiv.className = 'venue-info';
        infoDiv.innerHTML = `<h2 id="venue-type">${venue.rating_text || 'Информация'}</h2>`;
        let starsHTML = '<div id="venue-rating" class="rating-stars">';
        const rating = Math.round(venue.rating_stars || 0);
        starsHTML += (rating > 0 && rating <= 5) ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '☆☆☆☆☆';
        starsHTML += '</div>';
        infoDiv.innerHTML += starsHTML;
        infoDiv.innerHTML += `<p id="venue-description">${venue.date_text || 'Описание недоступно.'}</p>`;
        infoDiv.innerHTML += `<p class="no-map-message" style="display: none;">Информация о карте для этого места недоступна.</p>`;
        venueDetailContainer.appendChild(infoDiv);
        noMapMessageElement = infoDiv.querySelector('.no-map-message');

        // --- Map Section ---
        const mapWrapper = document.createElement('div');
        mapWrapper.id = 'map-section-wrapper';
        mapWrapper.innerHTML = `
            <div class="map-controls-embedded" style="display: none;">
                <button id="set-start-button" disabled>Задать начало (A)</button>
                <p class="map-instructions">Нажмите на карту, чтобы выбрать начальную точку</p>
            </div>
            <div id="venue-map-embedded" style="display: none;"></div>
        `;
        venueDetailContainer.appendChild(mapWrapper);
        const mapControlsContainer = mapWrapper.querySelector('.map-controls-embedded');
        const mapContainer = mapWrapper.querySelector('#venue-map-embedded');

        // --- Initialize Map (if coordinates exist) ---
        const lat = venue.latitude;
        const lng = venue.longitude;
        if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
            console.log(`Coordinates found: [${lat}, ${lng}]. Initializing map.`);
            if (mapContainer) mapContainer.style.display = 'block';
            if (mapControlsContainer) mapControlsContainer.style.display = 'block';
            if (noMapMessageElement) noMapMessageElement.style.display = 'none';

            if (!map) setupRoutingMap(mapContainer, lat, lng, venue.name);
            else updateMapDestination(lat, lng, venue.name);

            setTimeout(() => map?.invalidateSize(), 150);
        } else {
            console.warn("Venue coordinates are missing or invalid. Map cannot be displayed.");
            if (mapContainer) mapContainer.style.display = 'none';
            if (mapControlsContainer) mapControlsContainer.style.display = 'none';
            if (noMapMessageElement) noMapMessageElement.style.display = 'block';
        }
    }

    /**
     * *** UPDATED setupRoutingMap to remove attribution control ***
     */
    function setupRoutingMap(mapElement, venueLat, venueLng, venueName) {
        if (!mapElement) { console.error("Map container element not found!"); return; }
        if (map) { map.remove(); map = null; routingControl = null; }

        try {
            console.log("Initializing Leaflet map...");
            // *** CHANGE HERE: Added attributionControl: false ***
            map = L.map(mapElement, {
                zoomControl: false,
                attributionControl: false // Disable the default attribution control
            }).setView([venueLat, venueLng], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                 attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', // Keep for reference/compliance
                 maxZoom: 19
            }).addTo(map);

            L.control.zoom({ position: 'bottomright' }).addTo(map);

            // --- Routing Setup (remains the same) ---
            let waypointsLatLng = loadWaypointsFromStorage();
            const venueLatLng = L.latLng(venueLat, venueLng);
            let initialWaypoints;

            if (!waypointsLatLng || waypointsLatLng.length < 2 || !waypointsLatLng[1]) {
                initialWaypoints = [ waypointsLatLng?.[0] || null, venueLatLng ];
            } else {
                waypointsLatLng[1] = venueLatLng;
                if (waypointsLatLng[0]?.equals(venueLatLng, 1e-6)) waypointsLatLng[0] = null;
                initialWaypoints = waypointsLatLng;
            }

            const waypointsForControl = initialWaypoints.map(latLng =>
                latLng ? L.Routing.waypoint(latLng) : L.Routing.waypoint(null)
            );
            saveWaypointsToStorageFromLatLng(initialWaypoints);

            console.log("Initializing routing control with waypoints:", waypointsForControl.map(wp=>wp?.latLng));
            routingControl = L.Routing.control({
                waypoints: waypointsForControl,
                routeWhileDragging: true,
                show: true,
                addWaypoints: false,
                language: 'ru',
                createMarker: (i, wp, nWps) => createCustomMarker(i, wp, nWps, venueName),
                router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
                geocoder: L.Control.Geocoder.nominatim({ geocodingQueryParams: { "accept-language": "ru,en" } }),
                lineOptions: { styles: [{ color: '#b8a4d4', opacity: 0.85, weight: 7 }] },
                showAlternatives: true,
                alternativeLineOptions: { styles: [{color: 'gray', opacity: 0.6, weight: 5, dashArray: '5, 10'}] }
            }).addTo(map);

            // --- Routing Event Listeners ---
            routingControl.on('waypointschanged', (e) => {
                console.log("Waypoints changed, saving to storage.");
                saveWaypointsToStorage(e.waypoints);
                 const startButton = venueDetailContainer.querySelector('#set-start-button');
                 if (startButton && (!e.waypoints || !e.waypoints[0] || !e.waypoints[0].latLng)) {
                     startButton.disabled = true;
                 }
            });
            routingControl.on('routesfound', (e) => {
                if (e.waypoints?.length) {
                     console.log("Route found, ensuring waypoints are saved.");
                     saveWaypointsToStorage(e.waypoints);
                 }
            });
             map.on('click', handleMapClick);

            // --- Set Start Button Setup ---
            const setStartButton = mapElement.closest('#map-section-wrapper')?.querySelector('#set-start-button');
            if (setStartButton) {
                setStartButton.disabled = !initialWaypoints[0];
                 setStartButton.removeEventListener('click', handleSetStartClick);
                setStartButton.addEventListener('click', handleSetStartClick);
            } else { console.error("Set Start button not found after map setup!"); }

            setTimeout(() => map?.invalidateSize(), 250);

        } catch (mapError) {
            console.error("Error initializing Leaflet map or routing:", mapError);
            if(mapElement) mapElement.innerHTML = `<p class='error-message'>Ошибка загрузки карты: ${mapError.message}</p>`;
             const mapControlsContainer = mapElement?.closest('#map-section-wrapper')?.querySelector('.map-controls-embedded');
             if (mapControlsContainer) mapControlsContainer.style.display = 'none';
             if (noMapMessageElement) noMapMessageElement.style.display = 'block';
        }
    }

    // updateMapDestination remains the same
    function updateMapDestination(venueLat, venueLng, venueName) {
        if (!routingControl || !map) {
            console.warn("Cannot update destination: Map or routing control not initialized.");
            return;
        }
        console.log(`Updating map destination to: ${venueName} [${venueLat}, ${venueLng}]`);

        const newVenueLatLng = L.latLng(venueLat, venueLng);
        let currentWaypoints = routingControl.getWaypoints();

        while (currentWaypoints.length < 2) currentWaypoints.push(L.Routing.waypoint(null, ""));

        const startWaypoint = currentWaypoints[0] || L.Routing.waypoint(null, "Начало (A)");

        if (startWaypoint.latLng?.equals(newVenueLatLng, 1e-6)) {
            console.warn("Start point is the same as the new destination. Clearing start point.");
            currentWaypoints = [
                L.Routing.waypoint(null, "Начало (A)"),
                L.Routing.waypoint(newVenueLatLng, venueName || "Конец (B)")
            ];
        } else {
            currentWaypoints[currentWaypoints.length - 1] = L.Routing.waypoint(newVenueLatLng, venueName || "Конец (B)");
        }

        console.log("Setting new waypoints:", currentWaypoints.map(wp=>wp?.latLng));
        routingControl.setWaypoints(currentWaypoints);
        saveWaypointsToStorage(currentWaypoints);

        setTimeout(() => {
            try {
                 const planWaypoints = routingControl.getPlan()?.getWaypoints();
                 if (planWaypoints && planWaypoints.length > 0) {
                     const destinationMarker = planWaypoints[planWaypoints.length - 1]?.marker;
                     if (destinationMarker) {
                         destinationMarker.bindPopup(`<b>${venueName || 'Конец (B)'}</b>`).openPopup();
                         setTimeout(()=> destinationMarker.closePopup(), 2500);
                     }
                 }
                const bounds = routingControl.getBounds();
                if (bounds?.isValid()) {
                    console.log("Flying to route bounds.");
                    map.flyToBounds(bounds, { padding: [40, 40], duration: 0.6, maxZoom: 16 });
                } else {
                    console.log("Flying to destination point.");
                    map.flyTo(newVenueLatLng, Math.max(map.getZoom() || 0, 14), { duration: 0.6 });
                }
            } catch (error) {
                console.warn("Error updating marker popup or flying to bounds:", error);
                map.flyTo(newVenueLatLng, 14, { duration: 0.6 });
            }
        }, 400);
    }

    // handleMapClick remains the same
    function handleMapClick(e) {
        if (!map) return;
        lastClickedLatLng = e.latlng;
        console.log("Map clicked at:", lastClickedLatLng);
        const markerOptions = { icon: createPulsatingIcon(), zIndexOffset: 1000, interactive: false };
        if (!tempClickMarker) tempClickMarker = L.marker(lastClickedLatLng, markerOptions).addTo(map);
        else tempClickMarker.setLatLng(lastClickedLatLng);
        if (tempClickMarker.bringToFront) tempClickMarker.bringToFront();
        const setStartButton = venueDetailContainer.querySelector('#set-start-button');
        if (setStartButton) {
            setStartButton.disabled = false;
            setStartButton.classList.remove('confirmed');
            console.log("Set Start button enabled.");
        }
    }

    // handleSetStartClick remains the same
    function handleSetStartClick() {
        if (!lastClickedLatLng || !routingControl || !map) {
            console.warn("Cannot set start: Clicked location, routing control, or map missing.");
            return;
        }
        console.log("Setting start point to:", lastClickedLatLng);
        const startWaypoint = L.Routing.waypoint(lastClickedLatLng, "Начало (A)");
        let currentWaypoints = routingControl.getWaypoints();
        if (currentWaypoints.length < 2) {
            const destinationWaypoint = currentWaypoints[1] || currentWaypoints[0] || L.Routing.waypoint(map.getCenter(), "Конец (B)");
            routingControl.setWaypoints([startWaypoint, destinationWaypoint]);
        } else {
            currentWaypoints[0] = startWaypoint;
            routingControl.setWaypoints(currentWaypoints);
        }
        saveWaypointsToStorage(routingControl.getWaypoints());
        if (tempClickMarker) { map.removeLayer(tempClickMarker); tempClickMarker = null; }
        lastClickedLatLng = null;
        const setStartButton = venueDetailContainer.querySelector('#set-start-button');
        if (setStartButton) {
            setStartButton.disabled = true;
            setStartButton.classList.add('confirmed');
            console.log("Set Start button disabled and confirmed.");
            setTimeout(() => setStartButton.classList.remove('confirmed'), 550);
        }
        setTimeout(() => {
            try {
                const bounds = routingControl.getBounds();
                if (bounds?.isValid()) {
                    map.flyToBounds(bounds, { padding: [40, 40], duration: 0.6, maxZoom: 16 });
                } else if (startWaypoint.latLng) {
                    map.flyTo(startWaypoint.latLng, Math.max(map.getZoom() || 0, 14), { duration: 0.6 });
                }
            } catch (error) { console.error("Error flying to bounds after setting start:", error); }
        }, 300);
    }

    // createCustomMarker remains the same
    function createCustomMarker(index, waypoint, numberOfWaypoints, venueName) {
        if (!waypoint?.latLng) return null;
        const isStart = index === 0;
        const isEnd = index === numberOfWaypoints - 1;
        let markerColor = isStart ? 'green' : (isEnd ? 'red' : 'blue');
        const iconUrl = `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`;
        const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';
        const customIcon = L.icon({ iconUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
        const marker = L.marker(waypoint.latLng, { draggable: true, icon: customIcon });
        let label = `Точка ${index + 1}`;
        if (isStart) label = waypoint.name || 'Начало (A)';
        else if (isEnd) label = venueName || waypoint.name || 'Конец (B)';
        else label = waypoint.name || `Промежуточная точка ${index + 1}`;
        marker.bindPopup(`<b>${label}</b>`);
        marker.on('dragend', () => {
             if (routingControl) {
                const currentWaypoints = routingControl.getWaypoints();
                if (currentWaypoints[index]) {
                    currentWaypoints[index].latLng = marker.getLatLng();
                    routingControl.setWaypoints(currentWaypoints);
                }
             }
        });
        return marker;
    }

    // createPulsatingIcon remains the same
    function createPulsatingIcon() {
        return L.divIcon({ html: '', className: 'pulsating-marker', iconSize: [16, 16], iconAnchor: [8, 8] });
    }

    // ============================================================
    // == Local Storage ===========================================
    // ============================================================

    // saveWaypointsToStorage remains the same
    function saveWaypointsToStorage(waypoints) {
        if (!waypoints || !Array.isArray(waypoints)) { console.warn("Invalid waypoints data for saving."); return; }
        const latLngs = waypoints.map(wp => wp?.latLng);
        saveWaypointsToStorageFromLatLng(latLngs);
    }
    // saveWaypointsToStorageFromLatLng remains the same
    function saveWaypointsToStorageFromLatLng(latLngs) {
        if (!latLngs || !Array.isArray(latLngs)) { console.warn("Invalid LatLng array for saving."); return; }
        const dataToStore = latLngs.map(ll =>
            (ll ? { lat: parseFloat(ll.lat.toFixed(6)), lng: parseFloat(ll.lng.toFixed(6)) } : null)
        );
        if (dataToStore.length === 0 || dataToStore.every(wp => wp === null)) {
            localStorage.removeItem(ROUTING_STORAGE_KEY); return;
        }
        try {
            localStorage.setItem(ROUTING_STORAGE_KEY, JSON.stringify(dataToStore));
            console.log("Waypoints saved to local storage:", dataToStore);
        } catch (error) { console.error("Error saving waypoints to local storage:", error); }
    }
    // loadWaypointsFromStorage remains the same
    function loadWaypointsFromStorage() {
        const storedData = localStorage.getItem(ROUTING_STORAGE_KEY);
        if (!storedData) { return null; }
        try {
            const parsedData = JSON.parse(storedData);
            if (!Array.isArray(parsedData)) { localStorage.removeItem(ROUTING_STORAGE_KEY); return null; }
            const latLngs = parsedData.map(data =>
                (data && typeof data.lat === 'number' && typeof data.lng === 'number' ? L.latLng(data.lat, data.lng) : null)
            );
            console.log("Waypoints loaded from local storage:", latLngs);
            return latLngs;
        } catch (error) {
            console.error("Error parsing waypoints from local storage:", error);
            localStorage.removeItem(ROUTING_STORAGE_KEY); return null;
        }
    }

    // ============================================================
    // == Plan Switcher Button Creation ===========================
    // ============================================================

    // createPlanSwitcherButtons remains the same
    function createPlanSwitcherButtons() {
        if (!planSwitcherPlaceholder) { console.warn("Plan switcher placeholder element not found."); return; }
        planSwitcherPlaceholder.innerHTML = '';

        if (fetchedPlanData && fetchedPlanData.length > 0) {
            console.log(`Creating ${fetchedPlanData.length} plan switcher button(s).`);
            fetchedPlanData.forEach((plan) => {
                const button = document.createElement("button");
                button.textContent = plan.name ? `Активировать ${plan.name}` : `Активировать План ${plan.id || '?'}`;
                button.className = "btn-switch-plan";
                button.setAttribute("data-plan-id", plan.id);
                button.onclick = () => {
                    console.log(`Plan button clicked: ${plan.name || plan.id}`);
                    applyPlan(plan); // Calls the updated applyPlan with swap logic
                };
                planSwitcherPlaceholder.appendChild(button);
            });
            planSwitcherPlaceholder.style.display = '';
        } else {
            console.log("No plans available to create buttons.");
            planSwitcherPlaceholder.textContent = "Альтернативные планы недоступны.";
            planSwitcherPlaceholder.style.display = 'block';
            if (playerElement) playerElement.style.display = 'none';
            setPlayerDefaultState("Планов нет");
        }
    }

    // ============================================================
    // == Initialization ==========================================
    // ============================================================

    /**
     * *** UPDATED initializePage to use path for ID extraction ***
     */
    async function initializePage() {
        console.log("Initializing venue detail page...");

        // Kept your deployment method for getting ID from path
        const pathname = window.location.pathname;
        const venueId = pathname.split('/').filter(Boolean).pop(); // Extract ID from path

        if (!venueId) {
            console.error("Venue ID missing from URL path.");
            displayError("ID места не указан в URL.");
            return;
        }
        console.log("Venue ID found:", venueId);

        setLoading(true);

        try {
            setupAudioListeners();

            // Fetch venue and plans in parallel
            await Promise.all([
                fetchVenueDetails(venueId),
                fetchPlans()
            ]);

            console.log("Initial data fetching complete.");

            createPlanSwitcherButtons();

            // Apply the initial/default plan (usually Plan A, considering audio swap)
            if (currentPlan && audioPlayer) {
                console.log("Applying initial/default plan:", currentPlan.name || currentPlan.id);
                wasPlayingBeforeApply = false; // No autoplay on load
                applyPlan(currentPlan); // applyPlan handles the swap logic internally
            } else if (!currentPlan && fetchedPlanData.length > 0) {
                 console.warn("Plans were fetched, but no default plan (Plan A or first) was found. No initial plan applied.");
                 setPlayerDefaultState();
            } else {
                console.warn("No initial plan to apply (either no plans fetched or player missing).");
                 if (audioPlayer) setPlayerDefaultState("Планов нет");
            }
        } catch (error) {
            console.error("Initialization Error during data fetch:", error);
            // Error should have been displayed already
        } finally {
            setLoading(false);
            console.log("Page initialization process finished.");
        }
    }

    // --- Start Initialization ---
    initializePage();

}); // --- END DOMContentLoaded ---
