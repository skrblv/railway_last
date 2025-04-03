// frontend/venue-detail.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selections ---
    // Select elements *after* the DOM is loaded
    const venueNameHeader = document.getElementById('venue-name-header');
    const venueDetailContainer = document.getElementById('venue-detail-content');
    const themeSwitcherPlaceholder = document.getElementById('plan-switcher-placeholder'); // Select it here!
    const audioPlayer = document.getElementById('audio-player');
    const stickyPlayPauseBtn = document.getElementById('sticky-play-pause-btn');
    const stickyPlayPauseIcon = document.getElementById('sticky-play-pause-icon');
    const stickyAlbumArt = document.getElementById('sticky-album-art');
    const stickyTrackTitle = document.getElementById('sticky-track-title');
    const stickyArtistName = document.getElementById('sticky-artist-name');
    const playerElement = document.querySelector('.sticky-music-player');

    // --- Constants & Config ---
    const API_BASE_URL = '/api';
    const ROUTING_STORAGE_KEY = 'venueRouteWaypoints_v2';
    const PLACEHOLDER_ALBUM_ART = '/static/assets/placeholder-album.png'; // Use static path
    const PLACEHOLDER_BUILDING_IMG = '/static/assets/placeholder-building.jpg'; // Use static path
    const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 0 24 24" width="28px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M8 5v14l11-7L8 5z"/></svg>`;
    const pauseIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 0 24 24" width="28px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    const THEME_POSITIVE_CLASS = 'theme-plan-a-sad';
    const THEME_SAD_CLASS = 'theme-plan-b-green';

    // --- State Variables ---
    let map = null;
    let routingControl = null;
    let lastClickedLatLng = null;
    let tempClickMarker = null;
    let noMapMessageElement = null;
    let currentVenueData = null;
    let currentThemeType = 'positive';
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
            // Hide placeholder while loading (it's selected inside DOMContentLoaded now)
            if (themeSwitcherPlaceholder) themeSwitcherPlaceholder.style.display = 'none';
            if (playerElement) playerElement.style.display = 'none';
        } else {
            if (loadingDiv) loadingDiv.remove();
            contentElements.forEach(el => {
                if (!el.classList?.contains('map-controls-embedded') &&
                    el.id !== 'venue-map-embedded' &&
                    !el.classList?.contains('no-map-message')) {
                    el.style.display = ''; // Restore default display
                }
            });
            // Visibility handled later
        }
    }

    function displayError(message) {
        console.error("Displaying Error:", message);
        // Clear container and show error
        venueDetailContainer.innerHTML = `<div class="error-message">Ошибка: ${message}</div>`;
        if (playerElement) playerElement.style.display = 'none';
        // Hide placeholder on error (it's selected inside DOMContentLoaded now)
        if (themeSwitcherPlaceholder) themeSwitcherPlaceholder.style.display = 'none';
        venueNameHeader.textContent = "Ошибка";
        setLoading(false); // Stop loading indicator
    }

    function updateStickyPlayPauseIcon() {
        if (!audioPlayer || !stickyPlayPauseIcon || !stickyPlayPauseBtn) return;
        const isPlaying = audioPlayer.src && !audioPlayer.paused && audioPlayer.readyState > 0;
        stickyPlayPauseIcon.innerHTML = isPlaying ? pauseIconSvg : playIconSvg;
        stickyPlayPauseBtn.setAttribute("aria-label", isPlaying ? "Пауза" : "Играть");
    }

    function setPlayerDefaultState(message = "Трек не выбран") {
        console.log("Setting player to default state:", message);
        if (stickyTrackTitle) stickyTrackTitle.textContent = message;
        if (stickyArtistName) stickyArtistName.textContent = "";
        if (stickyAlbumArt) {
            stickyAlbumArt.src = PLACEHOLDER_ALBUM_ART; // Use correct static path
             stickyAlbumArt.onerror = () => { // Add simple error handling for placeholder too
                console.warn("Placeholder album art failed to load:", PLACEHOLDER_ALBUM_ART);
                stickyAlbumArt.alt = "Placeholder image missing";
                stickyAlbumArt.onerror = null;
             }
        }
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.src = '';
        }
        updateStickyPlayPauseIcon();
        // Keep player visible unless explicitly hidden due to error
        if (playerElement && playerElement.style.display !== 'none') {
            playerElement.style.display = 'flex';
        }
    }

    // ============================================================
    // == Core Logic: Fetching, Applying Themes, Audio ===========
    // ============================================================

    async function fetchVenueDetails(id) {
        const venueIdClean = String(id).replace('>', ''); // Clean ID just in case
        const apiUrl = `${API_BASE_URL}/venues/${venueIdClean}/`;
        console.log("Fetching venue details from:", apiUrl);
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                if (response.status === 404) throw new Error(`Место с ID ${venueIdClean} не найдено.`);
                else throw new Error(`HTTP ошибка при загрузке места! Статус: ${response.status}`);
            }
            currentVenueData = await response.json();
            console.log("Venue data received:", currentVenueData);
            displayVenueDetails(currentVenueData); // Display content
        } catch (error) {
            console.error("Fetch Venue Details Error:", error);
            currentVenueData = null; // Ensure data is null on error
            displayError(error.message || "Не удалось загрузить детали места.");
            throw error; // Re-throw so initialization logic knows about the failure
        }
    }

    function applyThemeAndAudio(themeType) {
        if (!currentVenueData) {
            console.warn("applyThemeAndAudio: No current venue data available.");
            setPlayerDefaultState("Данные места не загружены");
            return;
        }
        if (themeType !== 'positive' && themeType !== 'sad') {
            console.warn("applyThemeAndAudio: Invalid themeType provided:", themeType);
            return;
        }

        currentThemeType = themeType;
        console.log(`== Applying Theme & Audio: ${currentThemeType} ==`);
        const body = document.body;

        const usePositive = currentThemeType === 'positive';
        const songUrl = usePositive ? currentVenueData.positive_song_url : currentVenueData.sad_song_url;
        const albumArtUrl = usePositive ? currentVenueData.positive_album_art_url : currentVenueData.sad_album_art_url;
        const trackTitle = usePositive ? currentVenueData.positive_track_title : currentVenueData.sad_track_title;
        const artistName = usePositive ? currentVenueData.positive_artist_name : currentVenueData.sad_artist_name;

        // Apply visual theme class
        console.log("Current body classes before theme update:", body.className);
        body.classList.remove(THEME_POSITIVE_CLASS, THEME_SAD_CLASS);
        const themeClass = usePositive ? THEME_POSITIVE_CLASS : THEME_SAD_CLASS;
        console.log(`--> Applying visual theme class: '${themeClass}'`);
        body.classList.add(themeClass);
        console.log("Body classes after theme update:", body.className);

        // Ensure player is visible if it wasn't hidden by an error
        if (playerElement && playerElement.style.display === 'none') {
             console.log("Making player visible again.");
             playerElement.style.display = 'flex';
        }

        if (!audioPlayer) { console.warn("applyThemeAndAudio: Player audio element missing."); return; }


        wasPlayingBeforeApply = audioPlayer.src && !audioPlayer.paused && audioPlayer.currentTime > 0;
        console.log("Audio state before apply:", { wasPlayingBeforeApply, currentSrc: audioPlayer.currentSrc });

        // --- Audio Setup ---
        // Detach previous listeners specific to a source load
        audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad);
        audioPlayer.removeEventListener("error", handleAudioError);
        // Attach new listeners for the potential new source
        audioPlayer.addEventListener("loadedmetadata", handleMetadataLoad, { once: true });
        audioPlayer.addEventListener("error", handleAudioError, { once: true });

        const newSongUrl = songUrl;
        const currentSongUrl = audioPlayer.src;

        // Update player UI elements first
         if (stickyAlbumArt) {
            stickyAlbumArt.src = albumArtUrl || PLACEHOLDER_ALBUM_ART;
            stickyAlbumArt.alt = trackTitle || "Album Art";
            stickyAlbumArt.onerror = () => {
                if (stickyAlbumArt.src !== PLACEHOLDER_ALBUM_ART) {
                    console.warn("Player album art failed, using placeholder:", albumArtUrl);
                    stickyAlbumArt.src = PLACEHOLDER_ALBUM_ART;
                } else {
                     console.warn("Placeholder album art also failed:", PLACEHOLDER_ALBUM_ART);
                     stickyAlbumArt.alt = "Placeholder image missing";
                }
                stickyAlbumArt.onerror = null;
            };
        }
        if (stickyTrackTitle) stickyTrackTitle.textContent = trackTitle || (newSongUrl ? "Загрузка..." : "Трек недоступен");
        if (stickyArtistName) stickyArtistName.textContent = artistName || (newSongUrl ? "" : "Неизвестный исполнитель");


        // Set audio source if needed
        if (newSongUrl && newSongUrl !== currentSongUrl) {
            console.log(`Setting new audio source (${currentThemeType}): ${newSongUrl}`);
            audioPlayer.src = newSongUrl;
            audioPlayer.load(); // Important: tell the browser to load the new source
        } else if (!newSongUrl) {
            console.warn(`Selected theme "${currentThemeType}" has no song_url. Stopping audio.`);
            audioPlayer.pause();
            audioPlayer.src = ""; // Clear the source
            wasPlayingBeforeApply = false;
            setPlayerDefaultState(`Трек для "${currentThemeType}" темы недоступен`);
        } else {
            // Source is the same, check if we need to resume playback
            console.log(`Audio source unchanged or already set to (${currentThemeType}): ${currentSongUrl || 'empty'}`);
            if (wasPlayingBeforeApply && audioPlayer.paused) {
                 console.log("Source unchanged, attempting to resume playback.");
                 const playPromise = audioPlayer.play();
                 if (playPromise?.catch) {
                     playPromise.catch(e => console.error("Resume playback failed:", e));
                 }
            } else {
                 updateStickyPlayPauseIcon(); // Update icon based on current state
            }
        }

        if (!newSongUrl) {
             updateStickyPlayPauseIcon(); // Ensure icon is correct if no track
        }
    }

    const handleMetadataLoad = () => {
        console.log(`Metadata loaded for ${audioPlayer.src?.split('/').pop() || 'unknown track'}. Duration: ${formatTime(audioPlayer.duration)}. ReadyState: ${audioPlayer.readyState}`);
        // Update UI with potentially loaded track/artist info if it was "Loading..."
        if (currentVenueData) {
             const usePositive = currentThemeType === 'positive';
             const trackTitle = usePositive ? currentVenueData.positive_track_title : currentVenueData.sad_track_title;
             const artistName = usePositive ? currentVenueData.positive_artist_name : currentVenueData.sad_artist_name;
              if (stickyTrackTitle && stickyTrackTitle.textContent === "Загрузка...") stickyTrackTitle.textContent = trackTitle || "Название неизвестно";
              if (stickyArtistName && !stickyArtistName.textContent) stickyArtistName.textContent = artistName || "Исполнитель неизвестен";
        }

        if (wasPlayingBeforeApply && audioPlayer.src && audioPlayer.readyState >= 2) { // readyState >= 2 (HAVE_METADATA) is usually enough
            console.log("Attempting to resume playback after metadata load...");
            const playPromise = audioPlayer.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                        console.log("Playback resumed successfully via promise.");
                        updateStickyPlayPauseIcon();
                    })
                    .catch(e => {
                        console.error("Resume playback failed:", e);
                        updateStickyPlayPauseIcon(); // Update icon to reflect paused state
                    });
            } else {
                // Fallback for browsers that don't return a promise (older ones)
                 console.log("Playback resumed (sync or no promise).");
                 updateStickyPlayPauseIcon();
            }
        } else {
            console.log("Not resuming playback. State:", { wasPlayingBeforeApply, hasSrc: !!audioPlayer.src, readyState: audioPlayer.readyState });
            updateStickyPlayPauseIcon(); // Ensure icon is correct
        }
        wasPlayingBeforeApply = false; // Reset the flag
    };

    const handleAudioError = (e) => {
        console.error("Audio Player Error:", e.target.error?.message || 'Unknown audio error', 'on source:', audioPlayer.src);
        setPlayerDefaultState(`Ошибка загрузки трека (${currentThemeType})`);
        wasPlayingBeforeApply = false; // Reset flag on error too
    };

    function toggleStickyPlayPause() {
        if (!audioPlayer) { console.warn("Toggle Play/Pause aborted: Audio player element not found."); return; }
        console.log("Toggle play/pause. Current state -> Paused:", audioPlayer.paused, "| Src:", !!audioPlayer.src, "| ReadyState:", audioPlayer.readyState);

        if (!audioPlayer.src && currentVenueData) {
            // If no source, trigger the current theme load again, setting the intent to play
            console.log("No audio source set. Applying current theme again with intent to play...");
            wasPlayingBeforeApply = true; // Set flag to indicate intention to play
            applyThemeAndAudio(currentThemeType); // This will load the source and try to play if flag is true
            return;
        } else if (!audioPlayer.src) {
            console.warn("Cannot play: No audio source and no venue data.");
            // Maybe show a user message here?
            setPlayerDefaultState("Данные места не загружены");
            return;
        }

        // If source exists, toggle play/pause
        if (audioPlayer.paused) {
            console.log("Attempting to play audio...");
            const playPromise = audioPlayer.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Audio play failed:", error);
                    // Optionally provide user feedback here
                    updateStickyPlayPauseIcon(); // Ensure icon reflects failure (shows play)
                });
            }
            // 'play' event listener will update the icon on success
        } else {
            console.log("Attempting to pause audio...");
            audioPlayer.pause();
            // 'pause' event listener will update the icon
        }
    }

    function setupAudioListeners() {
        // Setup listeners that should *always* be attached, regardless of source changes
        if (!audioPlayer || isAudioSetup) return;
        console.log("Setting up persistent audio event listeners.");
        audioPlayer.addEventListener('play', updateStickyPlayPauseIcon);
        audioPlayer.addEventListener('pause', updateStickyPlayPauseIcon);
        audioPlayer.addEventListener('ended', handleAudioEnded); // Loop track on end

        if (stickyPlayPauseBtn) {
            stickyPlayPauseBtn.removeEventListener('click', toggleStickyPlayPause); // Prevent duplicates
            stickyPlayPauseBtn.addEventListener('click', toggleStickyPlayPause);
        } else {
            console.warn("Sticky play/pause button not found during listener setup.");
        }
        isAudioSetup = true;
    }

    const handleAudioEnded = () => {
        console.log('Audio track ended - Restarting (Looping)');
        audioPlayer.currentTime = 0;
        // Short delay might help some browsers
        setTimeout(() => {
            const playPromise = audioPlayer.play();
            if (playPromise?.catch) {
                playPromise.catch(e => console.error("Loop playback failed:", e));
            }
        }, 50); // Reduced delay
    };

    // ============================================================
    // == Venue Detail Display & Map Logic ========================
    // ============================================================

    function displayVenueDetails(venue) {
        if (!venue) { displayError("Получены неверные данные о месте."); return; }
        // Clear previous content, except loading div which is handled by setLoading
        venueDetailContainer.innerHTML = ''; // Clear everything
        venueNameHeader.textContent = venue.name || 'Детали места';

        // --- Venue Images ---
        const imagesDiv = document.createElement('div');
        imagesDiv.className = 'venue-images';
        const imgSrc1 = venue.detail_image_url1 || venue.image_url || PLACEHOLDER_BUILDING_IMG;
        const imgSrc2 = venue.detail_image_url2;
        imagesDiv.innerHTML = `<img id="venue-photo" src="${imgSrc1}" alt="Фото ${venue.name || ''}">`;
        if (imgSrc2) {
            imagesDiv.innerHTML += `<img id="venue-photo-2" src="${imgSrc2}" alt="Фото ${venue.name || ''} (доп.)">`;
        }
        venueDetailContainer.appendChild(imagesDiv);
        // Add error handling for dynamically added images
        imagesDiv.querySelectorAll('img').forEach(img => {
            img.onerror = () => {
                if (img.src !== PLACEHOLDER_BUILDING_IMG) {
                    console.warn(`Image failed to load, using placeholder: ${img.src}`);
                    img.src = PLACEHOLDER_BUILDING_IMG;
                } else {
                     console.warn(`Placeholder building image also failed: ${PLACEHOLDER_BUILDING_IMG}`);
                     img.alt = "Placeholder image missing";
                }
                img.onerror = null; // Prevent infinite loops
            };
        });

        // --- Venue Info ---
        const infoDiv = document.createElement('div');
        infoDiv.className = 'venue-info';
        infoDiv.innerHTML = `<h2 id="venue-type">${venue.rating_text || 'Информация'}</h2>`;
        let starsHTML = '<div id="venue-rating" class="rating-stars">';
        const rating = Math.round(venue.rating_stars || 0);
        starsHTML += (rating > 0 && rating <= 5) ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '☆☆☆☆☆';
        starsHTML += '</div>';
        infoDiv.innerHTML += starsHTML;
        infoDiv.innerHTML += `<p id="venue-description">${venue.detail_description || venue.date_text || 'Описание недоступно.'}</p>`;
        // Create the message element but keep it hidden initially
        infoDiv.innerHTML += `<p class="no-map-message" style="display: none;">Информация о карте для этого места недоступна.</p>`;
        venueDetailContainer.appendChild(infoDiv);
        // Get a reference to the message element for later use
        noMapMessageElement = infoDiv.querySelector('.no-map-message');

        // --- Map Section ---
        const mapWrapper = document.createElement('div');
        mapWrapper.id = 'map-section-wrapper';
        // Create containers but keep them hidden initially
        mapWrapper.innerHTML = `
            <div class="map-controls-embedded" style="display: none;">
                <button id="set-start-button" disabled>Задать начало (A)</button>
                <p class="map-instructions">Нажмите на карту, чтобы выбрать начальную точку</p>
            </div>
            <div id="venue-map-embedded" style="display: none;"></div>`;
        venueDetailContainer.appendChild(mapWrapper);

        const mapControlsContainer = mapWrapper.querySelector('.map-controls-embedded');
        const mapContainer = mapWrapper.querySelector('#venue-map-embedded');

        // --- Map Initialization Logic ---
        const lat = venue.latitude;
        const lng = venue.longitude;
        if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
            console.log(`Coordinates found: [${lat}, ${lng}]. Initializing map.`);
            // Show map elements ONLY if coords are valid
            if (mapContainer) mapContainer.style.display = 'block';
            if (mapControlsContainer) mapControlsContainer.style.display = 'block';
            if (noMapMessageElement) noMapMessageElement.style.display = 'none'; // Hide no-map message

            if (!map) { // If map doesn't exist, create it
                setupRoutingMap(mapContainer, lat, lng, venue.name);
            } else { // If map exists, just update the destination
                updateMapDestination(lat, lng, venue.name);
            }
            // Invalidate size after a short delay to ensure container is rendered
             setTimeout(() => {
                 if (map) {
                     try {
                        map.invalidateSize();
                        console.log("Map size invalidated.");
                     } catch(e) {
                         console.error("Error invalidating map size:", e);
                     }
                 }
             }, 150);
        } else {
            console.warn("Venue coordinates missing or invalid. Map elements hidden.");
            // Ensure map elements are hidden and message is shown
            if (mapContainer) mapContainer.style.display = 'none';
            if (mapControlsContainer) mapControlsContainer.style.display = 'none';
            if (noMapMessageElement) noMapMessageElement.style.display = 'block'; // Show no-map message
            // If map instance existed previously, remove it
            if (map) {
                map.remove();
                map = null;
                routingControl = null;
            }
        }
    }


    function setupRoutingMap(mapElement, venueLat, venueLng, venueName) {
        if (!mapElement || mapElement.offsetParent === null) {
             console.error("Map container element not found or not visible for setup!");
             if (noMapMessageElement) noMapMessageElement.style.display = 'block';
             const mapControlsContainer = document.querySelector('.map-controls-embedded');
             if (mapControlsContainer) mapControlsContainer.style.display = 'none';
             return;
         }
        if (map) { // Remove existing map if any
             console.log("Removing existing map instance before setup.");
             try { map.remove(); } catch (e) { console.warn("Error removing previous map:", e); }
             map = null;
             routingControl = null;
        }
        try {
            console.log("Initializing Leaflet map in container:", mapElement.id);
            map = L.map(mapElement, { zoomControl: false, attributionControl: false }).setView([venueLat, venueLng], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19
            }).addTo(map);
            L.control.zoom({ position: 'bottomright' }).addTo(map);

            let waypointsLatLng = loadWaypointsFromStorage();
            const venueLatLng = L.latLng(venueLat, venueLng);
            let initialWaypoints = [];

            // Determine initial waypoints (Start point from storage, End point is the venue)
            const startPoint = (waypointsLatLng && waypointsLatLng[0]) ? waypointsLatLng[0] : null;
            // Ensure start point isn't the same as end point
            if (startPoint && startPoint.equals(venueLatLng, 1e-6)) {
                 console.warn("Stored start point is same as venue destination, clearing start.");
                 initialWaypoints = [null, venueLatLng];
            } else {
                 initialWaypoints = [startPoint, venueLatLng];
            }
            saveWaypointsToStorageFromLatLng(initialWaypoints); // Save potentially updated initial state

            // Create waypoints for the control
            const waypointsForControl = initialWaypoints.map((latLng, index) =>
                L.Routing.waypoint(latLng, index === 0 ? "Начало (A)" : (venueName || "Конец (B)"))
            );
            console.log("Initializing routing control with waypoints:", waypointsForControl.map(wp => wp?.latLng));

            routingControl = L.Routing.control({
                waypoints: waypointsForControl,
                routeWhileDragging: true,
                show: true,
                addWaypoints: false, // Don't allow adding more waypoints via UI
                language: 'ru',
                createMarker: (i, wp, nWps) => createCustomMarker(i, wp, nWps, venueName),
                router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
                geocoder: L.Control.Geocoder.nominatim({ geocodingQueryParams: { "accept-language": "ru,en" } }),
                lineOptions: { styles: [{ opacity: 0.85, weight: 7 }] }, // Rely on CSS for color
                showAlternatives: true,
                alternativeLineOptions: { styles: [{ opacity: 0.6, weight: 5, dashArray: '5, 10' }] } // Rely on CSS for color
            }).addTo(map);

            // --- Event Listeners ---
            routingControl.on('waypointschanged', (e) => {
                console.log("Waypoints changed via routing control.");
                saveWaypointsToStorage(e.waypoints);
                const startButton = venueDetailContainer.querySelector('#set-start-button');
                // Disable button only if the *first* waypoint is explicitly null/cleared
                if (startButton && e.waypoints && e.waypoints[0] && !e.waypoints[0].latLng) {
                     startButton.disabled = true;
                     console.log("Start button disabled (waypoint 0 cleared).")
                }
                // If start exists, button should be enabled *unless* click logic is active
                 else if (startButton && !lastClickedLatLng) { // Don't enable if user just clicked map
                     startButton.disabled = !e.waypoints[0]?.latLng;
                 }
            });
            routingControl.on('routesfound', (e) => {
                 if (e.waypoints?.length) {
                    saveWaypointsToStorage(e.waypoints); // Save final positions after route found
                 }
            });
            map.on('click', handleMapClick);

            // Setup Set Start Button
            const setStartButton = mapElement.closest('#map-section-wrapper')?.querySelector('#set-start-button');
            if (setStartButton) {
                setStartButton.disabled = !initialWaypoints[0]; // Disable if no initial start point
                setStartButton.removeEventListener('click', handleSetStartClick); // Prevent duplicates
                setStartButton.addEventListener('click', handleSetStartClick);
                console.log("Set Start button listener attached. Initial disabled state:", setStartButton.disabled);
            } else {
                console.error("Set Start button not found after map setup!");
            }

            // Invalidate map size after a short delay
            setTimeout(() => {
                 if (map) {
                     try {
                        map.invalidateSize();
                         console.log("Map size invalidated after setup.");
                     } catch (e) {
                        console.error("Error invalidating map size post-setup:", e);
                     }
                 }
            }, 250);

        } catch (mapError) {
            console.error("Error initializing Leaflet map:", mapError);
            if (mapElement) mapElement.innerHTML = `<p class='error-message'>Ошибка загрузки карты: ${mapError.message}</p>`;
            // Hide controls and show message if map fails
            const mapControlsContainer = mapElement?.closest('#map-section-wrapper')?.querySelector('.map-controls-embedded');
             if (mapControlsContainer) mapControlsContainer.style.display = 'none';
             if (noMapMessageElement) noMapMessageElement.style.display = 'block';
        }
    }

    function updateMapDestination(venueLat, venueLng, venueName) {
        if (!routingControl || !map) {
            console.warn("Cannot update map destination: Map or control not initialized.");
             // Attempt to re-initialize if container exists and coords are valid
             const mapContainer = document.getElementById('venue-map-embedded');
             if (mapContainer && mapContainer.style.display === 'block' && venueLat != null && venueLng != null) {
                 console.log("Attempting to re-initialize map on updateMapDestination call.");
                 setupRoutingMap(mapContainer, venueLat, venueLng, venueName);
             } else {
                  if (noMapMessageElement) noMapMessageElement.style.display = 'block';
             }
            return;
        }

        console.log(`Updating map destination to: ${venueName} [${venueLat}, ${venueLng}]`);
        const newVenueLatLng = L.latLng(venueLat, venueLng);
        let currentWaypoints = routingControl.getWaypoints();

        // Ensure we always have at least two waypoint slots
        while (currentWaypoints.length < 2) {
            currentWaypoints.push(L.Routing.waypoint(null, "")); // Add empty slots if needed
        }

        const startWaypoint = currentWaypoints[0];

        // Check if the new destination is the same as the current start point
        if (startWaypoint?.latLng?.equals(newVenueLatLng, 1e-6)) {
            console.warn("New destination is the same as the start point. Clearing start point.");
            currentWaypoints = [
                L.Routing.waypoint(null, "Начало (A)"), // Clear start
                L.Routing.waypoint(newVenueLatLng, venueName || "Конец (B)")
            ];
             const btn = venueDetailContainer.querySelector('#set-start-button');
             if(btn) btn.disabled = true; // Disable button as start is now null
        } else {
            // Update the last waypoint (destination)
            currentWaypoints[currentWaypoints.length - 1] = L.Routing.waypoint(newVenueLatLng, venueName || "Конец (B)");
        }

        routingControl.setWaypoints(currentWaypoints);
        saveWaypointsToStorage(currentWaypoints); // Save the updated waypoints

        // Fly to bounds or destination and show popup
        setTimeout(() => {
            if (!map) return; // Check if map still exists
            try {
                const bounds = routingControl.getBounds();
                if (bounds?.isValid()) {
                    map.flyToBounds(bounds, { padding: [40, 40], duration: 0.6, maxZoom: 16 });
                     console.log("Flying to route bounds.");
                } else {
                     console.log("Flying to destination point (no valid bounds).");
                    map.flyTo(newVenueLatLng, Math.max(map.getZoom() || 0, 14), { duration: 0.6 });
                }

                // Attempt to open popup on the destination marker
                const plan = routingControl.getPlan(); // Get the Plan instance
                 if (plan) {
                    const planWaypoints = plan.getWaypoints(); // Get waypoints *from the Plan*
                     if (planWaypoints?.length > 0) {
                        const destIndex = planWaypoints.length - 1;
                        const destWaypoint = planWaypoints[destIndex];
                         // Access marker via the internal plan structure (less stable, but often necessary)
                         const markers = plan._markers; // Access internal markers array
                         if (markers && markers[destIndex]) {
                            const destMarker = markers[destIndex];
                             if (destMarker.bindPopup) { // Check if marker exists and has bindPopup
                                 destMarker.bindPopup(`<b>${venueName || 'Конец (B)'}</b>`).openPopup();
                                 console.log("Opened popup on destination marker.");
                                 setTimeout(()=> destMarker.closePopup(), 2500);
                             } else {
                                 console.warn("Destination marker not found or invalid in plan._markers.");
                             }
                         } else {
                             console.warn("Could not find destination marker in plan._markers array.");
                         }
                    }
                 } else {
                     console.warn("Could not get routing plan to open popup.");
                 }

            } catch (error) {
                console.warn("Error flying to bounds or opening popup:", error);
                 try { // Fallback flyTo
                    map.flyTo(newVenueLatLng, 14, { duration: 0.6 });
                 } catch (flyError){ console.error("Fallback map.flyTo failed:", flyError); }
            }
        }, 400); // Delay to allow routing engine to process
    }


    function handleMapClick(e) {
        if (!map) return;
        lastClickedLatLng = e.latlng;
        console.log("Map clicked at:", lastClickedLatLng);

        const markerOptions = { icon: createPulsatingIcon(), zIndexOffset: 1000, interactive: false };

        // Remove previous temp marker if exists
        if (tempClickMarker && map.hasLayer(tempClickMarker)) {
            map.removeLayer(tempClickMarker);
        }
        // Add new temp marker
        tempClickMarker = L.marker(lastClickedLatLng, markerOptions).addTo(map);
        if (tempClickMarker.bringToFront) tempClickMarker.bringToFront(); // Ensure it's on top

        // Enable the 'Set Start' button
        const setStartButton = venueDetailContainer.querySelector('#set-start-button');
        if (setStartButton) {
            setStartButton.disabled = false;
            setStartButton.classList.remove('confirmed'); // Remove confirmation style if present
            console.log("Set Start button enabled.");
        }
    }

    function handleSetStartClick() {
        if (!lastClickedLatLng || !routingControl || !map) {
            console.warn("Cannot set start: Missing state (latLng, control, or map).");
            const btn = venueDetailContainer.querySelector('#set-start-button');
            if (btn) btn.disabled = true; // Disable button if state is invalid
            return;
        }

        console.log("Setting start point to:", lastClickedLatLng);
        const startWaypoint = L.Routing.waypoint(lastClickedLatLng, "Начало (A)");
        let currentWaypoints = routingControl.getWaypoints();

        // Ensure we have a destination waypoint slot
        if (!currentWaypoints || currentWaypoints.length < 2) {
            const destLL = currentWaypoints?.[1]?.latLng || currentWaypoints?.[0]?.latLng || map.getCenter();
            const destName = currentVenueData?.name || "Конец (B)";
            currentWaypoints = [startWaypoint, L.Routing.waypoint(destLL, destName)];
            console.log("Created new waypoint array as original was too short.");
        } else {
            // Update the first waypoint
            currentWaypoints[0] = startWaypoint;
        }

        routingControl.setWaypoints(currentWaypoints); // Update the control
        saveWaypointsToStorage(currentWaypoints); // Save to storage

        // Clean up temporary marker and state
        if (tempClickMarker && map.hasLayer(tempClickMarker)) {
            map.removeLayer(tempClickMarker);
            tempClickMarker = null;
        }
        lastClickedLatLng = null; // Reset clicked latLng

        // Update button state
        const setStartButton = venueDetailContainer.querySelector('#set-start-button');
        if (setStartButton) {
            setStartButton.disabled = true; // Disable immediately after setting
            setStartButton.classList.add('confirmed');
            console.log("Set Start button disabled and confirmed.");
            // Remove confirmation style after animation
            setTimeout(() => setStartButton?.classList.remove('confirmed'), 550);
        }

        // Fly to new route bounds
        setTimeout(() => {
             if (!map) return;
            try {
                const bounds = routingControl.getBounds();
                if (bounds?.isValid()) {
                    map.flyToBounds(bounds, { padding: [40, 40], duration: 0.6, maxZoom: 16 });
                     console.log("Flying to new route bounds after setting start.");
                } else if (startWaypoint.latLng) {
                    map.flyTo(startWaypoint.latLng, Math.max(map.getZoom() || 0, 14), { duration: 0.6 });
                     console.log("Flying to start point (no valid bounds).");
                }
            } catch (error) {
                console.error("Error flying to bounds/point after setting start:", error);
            }
        }, 300); // Delay slightly for routing engine
    }

    function createCustomMarker(index, waypoint, numberOfWaypoints, venueName) {
        if (!waypoint?.latLng) return null; // Cannot create marker without latLng

        const isStart = index === 0;
        const isEnd = index === numberOfWaypoints - 1;
        let markerColor = 'blue'; // Default for intermediate points
        if (isStart) markerColor = 'green';
        if (isEnd) markerColor = 'red';

        const iconUrl = `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`;
        const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

        const customIcon = L.icon({
            iconUrl: iconUrl,
            shadowUrl: shadowUrl,
            iconSize: [25, 41], // Size of the icon
            iconAnchor: [12, 41], // Point of the icon which will correspond to marker's location
            popupAnchor: [1, -34], // Point from which the popup should open relative to the iconAnchor
            shadowSize: [41, 41] // Size of the shadow
        });

        const marker = L.marker(waypoint.latLng, {
            draggable: true, // Allow dragging
            icon: customIcon
        });

        // Determine label for popup
        let label = `Точка ${index + 1}`; // Default label
        if (isStart) {
            label = waypoint.name || 'Начало (A)';
        } else if (isEnd) {
            label = venueName || waypoint.name || 'Конец (B)'; // Use venue name for end if available
        }
        marker.bindPopup(`<b>${label}</b>`);

        // Update waypoints on drag end
        marker.on('dragend', () => {
            if (routingControl) {
                const currentWaypoints = routingControl.getWaypoints();
                if (currentWaypoints[index]) {
                    console.log(`Marker ${index} dragged to ${marker.getLatLng()}`);
                    currentWaypoints[index].latLng = marker.getLatLng();
                    routingControl.setWaypoints(currentWaypoints); // This triggers 'waypointschanged'
                }
            }
        });

        return marker;
    }

    function createPulsatingIcon() {
        // Creates the CSS class for the pulsating effect
        return L.divIcon({
            html: '',
            className: 'pulsating-marker', // Defined in CSS
            iconSize: [16, 16],
            iconAnchor: [8, 8] // Center the anchor
        });
    }

    // ============================================================
    // == Local Storage ===========================================
    // ============================================================
    function saveWaypointsToStorage(waypoints) {
        if (!waypoints || !Array.isArray(waypoints)) return;
        // Extract only LatLng objects
        const latLngs = waypoints.map(wp => wp?.latLng);
        saveWaypointsToStorageFromLatLng(latLngs);
    }

    function saveWaypointsToStorageFromLatLng(latLngs) {
        if (!latLngs || !Array.isArray(latLngs)) return;
        // Convert LatLngs to simple objects for JSON serialization
        const dataToStore = latLngs.map(ll =>
            (ll ? { lat: parseFloat(ll.lat.toFixed(6)), lng: parseFloat(ll.lng.toFixed(6)) } : null)
        );
        // Don't save if only contains nulls or is empty
        if (dataToStore.length === 0 || dataToStore.every(wp => wp === null)) {
            localStorage.removeItem(ROUTING_STORAGE_KEY);
            console.log("Waypoints cleared from storage.");
            return;
        }
        try {
            localStorage.setItem(ROUTING_STORAGE_KEY, JSON.stringify(dataToStore));
            console.log("Waypoints saved:", dataToStore);
        } catch (error) {
            console.error("Error saving waypoints to localStorage:", error);
        }
    }

    function loadWaypointsFromStorage() {
        const storedData = localStorage.getItem(ROUTING_STORAGE_KEY);
        if (!storedData) {
            console.log("No waypoints found in storage.");
            return null;
        }
        try {
            const parsedData = JSON.parse(storedData);
            // Validate basic structure
            if (!Array.isArray(parsedData)) {
                throw new Error("Stored waypoint data is not an array.");
            }
            // Convert simple objects back to Leaflet LatLng objects
            const latLngs = parsedData.map(data =>
                (data && typeof data.lat === 'number' && typeof data.lng === 'number' ? L.latLng(data.lat, data.lng) : null)
            );
            console.log("Waypoints loaded from storage:", latLngs);
            return latLngs;
        } catch (error) {
            console.error("Error parsing waypoints from localStorage:", error);
            localStorage.removeItem(ROUTING_STORAGE_KEY); // Clear invalid data
            return null;
        }
    }


    // ============================================================
    // == Theme Switcher Button Creation ==========================
    // ============================================================
    function createThemeSwitcherButtons() {
        // Ensure the placeholder element was found during DOMContentLoaded
        if (!themeSwitcherPlaceholder) {
            console.error("Cannot create theme buttons: Placeholder element not found in DOM!");
            return;
        }

        themeSwitcherPlaceholder.innerHTML = ''; // Clear previous buttons/message

        if (currentVenueData) {
            // Only create buttons if venue data is loaded
            console.log("Creating theme switcher buttons...");
            themeSwitcherPlaceholder.style.display = 'block'; // Make the container visible

            const positiveButton = document.createElement("button");
            positiveButton.textContent = `Светлая тема`;
            positiveButton.className = "btn-switch-plan"; // Use class from CSS
            positiveButton.onclick = () => {
                console.log("Positive theme button clicked.");
                applyThemeAndAudio('positive');
            };
            themeSwitcherPlaceholder.appendChild(positiveButton);

            const sadButton = document.createElement("button");
            sadButton.textContent = `Темная тема`;
            sadButton.className = "btn-switch-plan"; // Use class from CSS
            sadButton.onclick = () => {
                console.log("Sad theme button clicked.");
                applyThemeAndAudio('sad');
            };
            themeSwitcherPlaceholder.appendChild(sadButton);

        } else {
            // Display a message if data couldn't be loaded
            console.log("Cannot create theme buttons: No venue data.");
            themeSwitcherPlaceholder.textContent = "Кнопки тем недоступны (ошибка загрузки данных).";
            themeSwitcherPlaceholder.style.display = 'block'; // Show the message
        }
    }


    // ============================================================
    // == Initialization ==========================================
    // ============================================================
    async function initializePage() {
        console.log("Initializing venue detail page...");

        // Get Venue ID from data attribute (already cleaned in previous steps if needed)
        const venueId = document.body.dataset.venueId;
        console.log("[Init] Using Venue ID:", venueId);

        // Basic check for presence of ID
        if (!venueId && venueId !== 0 && venueId !== '0') {
             // This case should ideally be handled by the server sending a 404 or error page
             // But as a fallback, display an error.
             console.error("Critical Error: Venue ID is missing or invalid in body data attribute.");
             displayError("Не удалось определить ID места для загрузки.");
             // Check if the placeholder element itself exists for debugging
              if (!themeSwitcherPlaceholder) {
                   console.error("Theme switcher placeholder element is also missing from the HTML!");
               } else {
                   createThemeSwitcherButtons(); // Show "unavailable" message if placeholder exists
               }
             return; // Stop initialization
        }


        setLoading(true);
        setPlayerDefaultState("Загрузка..."); // Initial player state

        try {
            // Setup persistent audio listeners ONCE
            setupAudioListeners();

            // Fetch venue data using the ID
            await fetchVenueDetails(venueId);

            // --- Actions AFTER successful fetch ---
            console.log("Venue data fetch successful.");

            // Create theme buttons now that we have data (or know we failed)
            createThemeSwitcherButtons();

            // Apply the initial theme (e.g., 'positive') if data loaded
            if (currentVenueData && audioPlayer) {
                console.log("Applying initial 'positive' theme.");
                wasPlayingBeforeApply = false; // Don't autoplay initially
                applyThemeAndAudio('positive');
            } else {
                 console.warn("Skipping initial theme application (likely no data or player element).");
                 // If fetch failed, createThemeSwitcherButtons shows the error message
                 // If player missing, logs already occurred.
                 if (!currentVenueData) {
                    if (playerElement) playerElement.style.display = 'none'; // Hide player if no data
                 }
            }

        } catch (error) {
            // Error handling is mostly done within fetchVenueDetails calling displayError
            console.error("Initialization failed:", error.message || error);
            // Ensure buttons show error message even if fetch fails after placeholder exists
            createThemeSwitcherButtons();
            if (playerElement) playerElement.style.display = 'none'; // Hide player on error
        } finally {
            // Ensure loading indicator is removed regardless of success/failure
            setLoading(false);
            console.log("Page initialization finished.");
        }
    }

    // --- Start the initialization process ---
    initializePage();

}); // --- END DOMContentLoaded ---
