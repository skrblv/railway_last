
// frontend/venue-detail.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selections ---
    const venueNameHeader = document.getElementById('venue-name-header');
    const venueDetailContainer = document.getElementById('venue-detail-content');
    const themeSwitcherPlaceholder = document.getElementById('theme-switcher-placeholder'); // Correct ID
    const audioPlayer = document.getElementById('audio-player');
    const stickyPlayPauseBtn = document.getElementById('sticky-play-pause-btn');
    const stickyPlayPauseIcon = document.getElementById('sticky-play-pause-icon');
    const stickyAlbumArt = document.getElementById('sticky-album-art');
    const stickyTrackTitle = document.getElementById('sticky-track-title');
    const stickyArtistName = document.getElementById('sticky-artist-name');
    const playerElement = document.querySelector('.sticky-music-player');

    // --- Constants & Config ---
    const API_BASE_URL = '/api';
    const ROUTING_STORAGE_KEY = 'venueRouteWaypoints_v2'; // Keep separate storage for detail page routing
    const PLACEHOLDER_ALBUM_ART = 'assets/placeholder-album.png';
    const PLACEHOLDER_BUILDING_IMG = 'img/placeholder-building.jpg';
    const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 0 24 24" width="28px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M8 5v14l11-7L8 5z"/></svg>`;
    const pauseIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 0 24 24" width="28px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    const THEME_POSITIVE_CLASS = 'theme-plan-a-sad'; // Use existing class for light/positive theme
    const THEME_SAD_CLASS = 'theme-plan-b-green';   // Use existing class for dark/sad theme

    // --- State Variables ---
    let map = null;
    let routingControl = null;
    let lastClickedLatLng = null;
    let tempClickMarker = null;
    let noMapMessageElement = null;
    let currentVenueData = null; // Store the full data for the current venue
    let currentThemeType = 'positive'; // Track currently active theme ('positive' or 'sad')
    let isAudioSetup = false;
    let wasPlayingBeforeApply = false; // Track if audio should resume

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
             if (themeSwitcherPlaceholder) themeSwitcherPlaceholder.style.display = 'none'; // Hide buttons
            if (playerElement) playerElement.style.display = 'none'; // Hide player
        } else {
            if (loadingDiv) loadingDiv.remove();
            contentElements.forEach(el => {
                if (!el.classList?.contains('map-controls-embedded') &&
                    el.id !== 'venue-map-embedded' &&
                    !el.classList?.contains('no-map-message')) {
                    el.style.display = ''; // Restore default display
                }
            });
            // Visibility of map/buttons/player handled after data load / theme apply
        }
    }

    function displayError(message) {
        console.error("Displaying Error:", message);
        venueDetailContainer.innerHTML = `<div class="error-message">Ошибка: ${message}</div>`;
        if (playerElement) playerElement.style.display = 'none';
        if (themeSwitcherPlaceholder) themeSwitcherPlaceholder.style.display = 'none';
        venueNameHeader.textContent = "Ошибка";
        setLoading(false); // Make sure loading is stopped
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
        if (stickyAlbumArt) stickyAlbumArt.src = PLACEHOLDER_ALBUM_ART;
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
        const apiUrl = `${API_BASE_URL}/venues/${id}/`;
        console.log("Fetching venue details from:", apiUrl);
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                if (response.status === 404) throw new Error(`Место с ID ${id} не найдено.`);
                else throw new Error(`HTTP ошибка при загрузке места! Статус: ${response.status}`);
            }
            currentVenueData = await response.json();
            console.log("Venue data received:", currentVenueData);
            displayVenueDetails(currentVenueData);
        } catch (error) {
            console.error("Fetch Venue Details Error:", error);
            currentVenueData = null;
            displayError(error.message || "Не удалось загрузить детали места.");
            throw error;
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

        console.log("Current body classes before theme update:", body.className);
        body.classList.remove(THEME_POSITIVE_CLASS, THEME_SAD_CLASS);
        if (currentThemeType === 'positive') {
            console.log(`--> Applying visual theme class: '${THEME_POSITIVE_CLASS}'`);
            body.classList.add(THEME_POSITIVE_CLASS);
        } else {
            console.log(`--> Applying visual theme class: '${THEME_SAD_CLASS}'`);
            body.classList.add(THEME_SAD_CLASS);
        }
        console.log("Body classes after theme update:", body.className);

        if (!audioPlayer || !playerElement) {
            console.warn("applyThemeAndAudio: Player elements missing.");
            return;
        }
        playerElement.style.display = 'flex';

        wasPlayingBeforeApply = audioPlayer.src && !audioPlayer.paused && audioPlayer.currentTime > 0;
        console.log("Audio state before apply:", { wasPlayingBeforeApply, currentSrc: audioPlayer.currentSrc });

        const newSongUrl = songUrl;
        const currentSongUrl = audioPlayer.src;

        audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad);
        audioPlayer.removeEventListener("error", handleAudioError);
        audioPlayer.addEventListener("loadedmetadata", handleMetadataLoad, { once: true });
        audioPlayer.addEventListener("error", handleAudioError, { once: true });

        if (newSongUrl && newSongUrl !== currentSongUrl) {
            console.log(`Setting new audio source (${currentThemeType}): ${newSongUrl}`);
            audioPlayer.src = newSongUrl;
            audioPlayer.load();
        } else if (!newSongUrl) {
            console.warn(`Selected theme "${currentThemeType}" has no song_url. Stopping audio.`);
            audioPlayer.pause();
            audioPlayer.src = "";
            wasPlayingBeforeApply = false;
            setPlayerDefaultState(`Трек для "${currentThemeType}" темы недоступен`);
        } else {
            console.log(`Audio source unchanged or already set to (${currentThemeType}): ${currentSongUrl || 'empty'}`);
            if (!wasPlayingBeforeApply) updateStickyPlayPauseIcon();
            else if (wasPlayingBeforeApply && audioPlayer.paused) {
                 console.log("Source unchanged, attempting to resume playback.");
                 audioPlayer.play().catch(e => console.error("Resume playback failed:", e));
            }
        }

        if (stickyAlbumArt) {
            stickyAlbumArt.src = albumArtUrl || PLACEHOLDER_ALBUM_ART;
            stickyAlbumArt.alt = trackTitle || "Album Art";
            stickyAlbumArt.onerror = () => { if (stickyAlbumArt.src !== PLACEHOLDER_ALBUM_ART) { console.warn("Player album art failed, using placeholder."); stickyAlbumArt.src = PLACEHOLDER_ALBUM_ART; } stickyAlbumArt.onerror = null; };
        }
        if (stickyTrackTitle) stickyTrackTitle.textContent = trackTitle || (newSongUrl ? "Загрузка..." : "Трек недоступен");
        if (stickyArtistName) stickyArtistName.textContent = artistName || (newSongUrl ? "" : "Неизвестный исполнитель");

        if (!newSongUrl) updateStickyPlayPauseIcon();
    }

    const handleMetadataLoad = () => {
        console.log(`Metadata loaded for ${audioPlayer.src?.split('/').pop() || 'unknown track'}. Duration: ${formatTime(audioPlayer.duration)}. ReadyState: ${audioPlayer.readyState}`);
        if (wasPlayingBeforeApply && audioPlayer.src && audioPlayer.readyState >= 2) {
            console.log("Attempting to resume playback after metadata load...");
            const playPromise = audioPlayer.play();
            if (playPromise?.then) {
                playPromise.then(() => { console.log("Playback resumed successfully via promise."); updateStickyPlayPauseIcon(); })
                .catch(e => { console.error("Resume playback failed:", e); updateStickyPlayPauseIcon(); });
            } else { console.log("Playback resumed (sync or no promise)."); updateStickyPlayPauseIcon(); }
        } else {
            console.log("Not resuming playback. State:", { wasPlayingBeforeApply, hasSrc: !!audioPlayer.src, readyState: audioPlayer.readyState });
            updateStickyPlayPauseIcon();
        }
        wasPlayingBeforeApply = false;
    };

    const handleAudioError = (e) => {
        console.error("Audio Player Error:", e.target.error?.message || 'Unknown audio error', 'on source:', audioPlayer.src);
        setPlayerDefaultState(`Ошибка загрузки трека (${currentThemeType})`);
        wasPlayingBeforeApply = false;
    };

    function toggleStickyPlayPause() {
        if (!audioPlayer) { console.warn("Toggle Play/Pause aborted: Audio player element not found."); return; }
        console.log("Toggle play/pause. Current state -> Paused:", audioPlayer.paused, "| Src:", !!audioPlayer.src, "| ReadyState:", audioPlayer.readyState);

        if (!audioPlayer.src && currentVenueData) {
            console.log("No audio source set. Applying current theme again with intent to play...");
            wasPlayingBeforeApply = true;
            applyThemeAndAudio(currentThemeType);
            return;
        } else if (!audioPlayer.src) {
            console.warn("Cannot play: No audio source and no venue data.");
            setPlayerDefaultState("Данные места не загружены");
            return;
        }

        if (audioPlayer.paused) {
             console.log("Attempting to play audio...");
             const playPromise = audioPlayer.play();
             if (playPromise !== undefined) {
                 playPromise.catch(error => { console.error("Audio play failed:", error); updateStickyPlayPauseIcon(); });
             } else { updateStickyPlayPauseIcon(); }
        } else {
            console.log("Attempting to pause audio...");
            audioPlayer.pause();
        }
        // Icon updated by 'play'/'pause' events
    }

    function setupAudioListeners() {
         if (!audioPlayer || isAudioSetup) return;
         console.log("Setting up persistent audio event listeners.");
         audioPlayer.addEventListener('play', updateStickyPlayPauseIcon);
         audioPlayer.addEventListener('pause', updateStickyPlayPauseIcon);
         audioPlayer.addEventListener('ended', handleAudioEnded);
         if(stickyPlayPauseBtn) {
            stickyPlayPauseBtn.removeEventListener('click', toggleStickyPlayPause);
            stickyPlayPauseBtn.addEventListener('click', toggleStickyPlayPause);
         } else { console.warn("Sticky play/pause button not found."); }
         isAudioSetup = true;
    }

    const handleAudioEnded = () => {
         console.log('Audio track ended - Restarting (Looping)');
         audioPlayer.currentTime = 0;
         setTimeout(() => { const playPromise = audioPlayer.play(); if (playPromise?.catch) playPromise.catch(e => console.error("Loop playback failed:", e)); }, 100);
    };

    // ============================================================
    // == Venue Detail Display & Map Logic ========================
    // ============================================================

    function displayVenueDetails(venue) {
        if (!venue) { displayError("Получены неверные данные о месте."); return; }
        venueDetailContainer.innerHTML = '';
        venueNameHeader.textContent = venue.name || 'Детали места';

        const imagesDiv = document.createElement('div');
        imagesDiv.className = 'venue-images';
        const imgSrc1 = venue.detail_image_url1 || venue.image_url || PLACEHOLDER_BUILDING_IMG;
        const imgSrc2 = venue.detail_image_url2;
        imagesDiv.innerHTML = `<img id="venue-photo" src="${imgSrc1}" alt="Фото ${venue.name || ''}">`;
        if (imgSrc2) imagesDiv.innerHTML += `<img id="venue-photo-2" src="${imgSrc2}" alt="Фото ${venue.name || ''} (доп.)">`;
        venueDetailContainer.appendChild(imagesDiv);
        imagesDiv.querySelectorAll('img').forEach(img => {
            img.onerror = () => { if (img.src !== PLACEHOLDER_BUILDING_IMG) { console.warn(`Image failed: ${img.src}`); img.src = PLACEHOLDER_BUILDING_IMG; } img.onerror = null; };
        });

        const infoDiv = document.createElement('div');
        infoDiv.className = 'venue-info';
        infoDiv.innerHTML = `<h2 id="venue-type">${venue.rating_text || 'Информация'}</h2>`;
        let starsHTML = '<div id="venue-rating" class="rating-stars">';
        const rating = Math.round(venue.rating_stars || 0);
        starsHTML += (rating > 0 && rating <= 5) ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '☆☆☆☆☆';
        starsHTML += '</div>';
        infoDiv.innerHTML += starsHTML;
        infoDiv.innerHTML += `<p id="venue-description">${venue.detail_description || venue.date_text || 'Описание недоступно.'}</p>`;
        infoDiv.innerHTML += `<p class="no-map-message" style="display: none;">Информация о карте для этого места недоступна.</p>`;
        venueDetailContainer.appendChild(infoDiv);
        noMapMessageElement = infoDiv.querySelector('.no-map-message');

        const mapWrapper = document.createElement('div');
        mapWrapper.id = 'map-section-wrapper';
        mapWrapper.innerHTML = `
            <div class="map-controls-embedded" style="display: none;">
                <button id="set-start-button" disabled>Задать начало (A)</button>
                <p class="map-instructions">Нажмите на карту, чтобы выбрать начальную точку</p>
            </div>
            <div id="venue-map-embedded" style="display: none;"></div>`;
        venueDetailContainer.appendChild(mapWrapper);
        const mapControlsContainer = mapWrapper.querySelector('.map-controls-embedded');
        const mapContainer = mapWrapper.querySelector('#venue-map-embedded');

        const lat = venue.latitude; const lng = venue.longitude;
        if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
            console.log(`Coordinates found: [${lat}, ${lng}]. Initializing map.`);
            if (mapContainer) mapContainer.style.display = 'block';
            if (mapControlsContainer) mapControlsContainer.style.display = 'block';
            if (noMapMessageElement) noMapMessageElement.style.display = 'none';
            if (!map) setupRoutingMap(mapContainer, lat, lng, venue.name);
            else updateMapDestination(lat, lng, venue.name);
            setTimeout(() => map?.invalidateSize(), 150);
        } else {
            console.warn("Venue coordinates missing/invalid. Map hidden.");
            if (mapContainer) mapContainer.style.display = 'none';
            if (mapControlsContainer) mapControlsContainer.style.display = 'none';
            if (noMapMessageElement) noMapMessageElement.style.display = 'block';
        }
    }

    function setupRoutingMap(mapElement, venueLat, venueLng, venueName) {
        if (!mapElement) { console.error("Map container element not found!"); return; }
        if (map) { map.remove(); map = null; routingControl = null; }
        try {
            console.log("Initializing Leaflet map...");
            map = L.map(mapElement, { zoomControl: false, attributionControl: false }).setView([venueLat, venueLng], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19 }).addTo(map);
            L.control.zoom({ position: 'bottomright' }).addTo(map);

            let waypointsLatLng = loadWaypointsFromStorage();
            const venueLatLng = L.latLng(venueLat, venueLng);
            let initialWaypoints;
            if (!waypointsLatLng || !waypointsLatLng[0]) { initialWaypoints = [null, venueLatLng]; }
            else { initialWaypoints = [waypointsLatLng[0], venueLatLng]; if (initialWaypoints[0]?.equals(venueLatLng, 1e-6)) initialWaypoints[0] = null; }
            saveWaypointsToStorageFromLatLng(initialWaypoints);

            const waypointsForControl = initialWaypoints.map((latLng, index) => L.Routing.waypoint(latLng, index === 0 ? "Начало (A)" : (venueName || "Конец (B)")));
            console.log("Initializing routing control with waypoints:", waypointsForControl.map(wp => wp?.latLng));

            routingControl = L.Routing.control({
                waypoints: waypointsForControl, routeWhileDragging: true, show: true, addWaypoints: false, language: 'ru',
                createMarker: (i, wp, nWps) => createCustomMarker(i, wp, nWps, venueName),
                router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
                geocoder: L.Control.Geocoder.nominatim({ geocodingQueryParams: { "accept-language": "ru,en" } }),
                lineOptions: { styles: [{ /* Default color set by theme CSS */ opacity: 0.85, weight: 7 }] }, // Rely on CSS for color
                showAlternatives: true,
                alternativeLineOptions: { styles: [{ /* Default color set by theme CSS */ opacity: 0.6, weight: 5, dashArray: '5, 10' }] } // Rely on CSS for color
            }).addTo(map);

            routingControl.on('waypointschanged', (e) => { console.log("Waypoints changed."); saveWaypointsToStorage(e.waypoints); const startButton = venueDetailContainer.querySelector('#set-start-button'); if (startButton && e.waypoints && e.waypoints[0] && !e.waypoints[0].latLng) { startButton.disabled = true; } });
            routingControl.on('routesfound', (e) => { if (e.waypoints?.length) saveWaypointsToStorage(e.waypoints); });
            map.on('click', handleMapClick);

            const setStartButton = mapElement.closest('#map-section-wrapper')?.querySelector('#set-start-button');
            if (setStartButton) { setStartButton.disabled = !initialWaypoints[0]; setStartButton.removeEventListener('click', handleSetStartClick); setStartButton.addEventListener('click', handleSetStartClick); }
            else { console.error("Set Start button not found after map setup!"); }

            setTimeout(() => map?.invalidateSize(), 250);
        } catch (mapError) {
            console.error("Error initializing Leaflet map:", mapError);
            if (mapElement) mapElement.innerHTML = `<p class='error-message'>Ошибка загрузки карты: ${mapError.message}</p>`;
            const mapControlsContainer = mapElement?.closest('#map-section-wrapper')?.querySelector('.map-controls-embedded'); if (mapControlsContainer) mapControlsContainer.style.display = 'none'; if (noMapMessageElement) noMapMessageElement.style.display = 'block';
        }
    }

    function updateMapDestination(venueLat, venueLng, venueName) {
        if (!routingControl || !map) { console.warn("Cannot update map destination: Not initialized."); return; }
        console.log(`Updating map destination to: ${venueName} [${venueLat}, ${venueLng}]`);
        const newVenueLatLng = L.latLng(venueLat, venueLng);
        let currentWaypoints = routingControl.getWaypoints();
        while (currentWaypoints.length < 2) currentWaypoints.push(L.Routing.waypoint(null, ""));
        const startWaypoint = currentWaypoints[0];
        if (startWaypoint?.latLng?.equals(newVenueLatLng, 1e-6)) { console.warn("Start point same as destination, clearing start."); currentWaypoints = [L.Routing.waypoint(null, "Начало (A)"), L.Routing.waypoint(newVenueLatLng, venueName || "Конец (B)")]; const btn = venueDetailContainer.querySelector('#set-start-button'); if(btn) btn.disabled = true; }
        else { currentWaypoints[currentWaypoints.length - 1] = L.Routing.waypoint(newVenueLatLng, venueName || "Конец (B)"); }
        routingControl.setWaypoints(currentWaypoints);
        saveWaypointsToStorage(currentWaypoints);
        setTimeout(() => { try { const bounds = routingControl.getBounds(); if (bounds?.isValid()) { map.flyToBounds(bounds, { padding: [40, 40], duration: 0.6, maxZoom: 16 }); } else { map.flyTo(newVenueLatLng, Math.max(map.getZoom() || 0, 14), { duration: 0.6 }); } const planWps = routingControl.getPlan()?.getWaypoints(); if (planWps?.length > 0) { const destMarker = planWps[planWps.length - 1]?.marker; if (destMarker) { destMarker.bindPopup(`<b>${venueName || 'Конец (B)'}</b>`).openPopup(); setTimeout(()=> destMarker.closePopup(), 2500); }} } catch (error) { console.warn("Error flying/popup:", error); map.flyTo(newVenueLatLng, 14, { duration: 0.6 }); } }, 400);
    }

    function handleMapClick(e) {
        if (!map) return; lastClickedLatLng = e.latlng; console.log("Map clicked at:", lastClickedLatLng);
        const markerOptions = { icon: createPulsatingIcon(), zIndexOffset: 1000, interactive: false };
        if (!tempClickMarker) { tempClickMarker = L.marker(lastClickedLatLng, markerOptions).addTo(map); }
        else { tempClickMarker.setLatLng(lastClickedLatLng); }
        if (tempClickMarker.bringToFront) tempClickMarker.bringToFront();
        const setStartButton = venueDetailContainer.querySelector('#set-start-button');
        if (setStartButton) { setStartButton.disabled = false; setStartButton.classList.remove('confirmed'); console.log("Set Start button enabled."); }
    }

    function handleSetStartClick() {
        if (!lastClickedLatLng || !routingControl || !map) { console.warn("Cannot set start: Missing state."); const btn = venueDetailContainer.querySelector('#set-start-button'); if(btn) btn.disabled = true; return; }
        console.log("Setting start point to:", lastClickedLatLng);
        const startWaypoint = L.Routing.waypoint(lastClickedLatLng, "Начало (A)");
        let currentWaypoints = routingControl.getWaypoints();
        if (!currentWaypoints || currentWaypoints.length < 2) { const destLL = currentWaypoints?.[1]?.latLng || currentWaypoints?.[0]?.latLng || map.getCenter(); const destName = currentVenueData?.name || "Конец (B)"; currentWaypoints = [startWaypoint, L.Routing.waypoint(destLL, destName)]; }
        else { currentWaypoints[0] = startWaypoint; }
        routingControl.setWaypoints(currentWaypoints);
        saveWaypointsToStorage(currentWaypoints);
        if (tempClickMarker) { map.removeLayer(tempClickMarker); tempClickMarker = null; } lastClickedLatLng = null;
        const setStartButton = venueDetailContainer.querySelector('#set-start-button');
        if (setStartButton) { setStartButton.disabled = true; setStartButton.classList.add('confirmed'); console.log("Set Start button disabled and confirmed."); setTimeout(() => setStartButton?.classList.remove('confirmed'), 550); }
        setTimeout(() => { try { const bounds = routingControl.getBounds(); if (bounds?.isValid()) { map.flyToBounds(bounds, { padding: [40, 40], duration: 0.6, maxZoom: 16 }); } else if (startWaypoint.latLng) { map.flyTo(startWaypoint.latLng, Math.max(map.getZoom() || 0, 14), { duration: 0.6 }); } } catch (error) { console.error("Error flying:", error); } }, 300);
    }

    function createCustomMarker(index, waypoint, numberOfWaypoints, venueName) {
        if (!waypoint?.latLng) return null;
        const isStart = index === 0; const isEnd = index === numberOfWaypoints - 1;
        let markerColor = isStart ? 'green' : (isEnd ? 'red' : 'blue');
        const iconUrl = `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`;
        const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';
        const customIcon = L.icon({ iconUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
        const marker = L.marker(waypoint.latLng, { draggable: true, icon: customIcon });
        let label = `Точка ${index + 1}`;
        if (isStart) label = waypoint.name || 'Начало (A)';
        else if (isEnd) label = venueName || waypoint.name || 'Конец (B)';
        marker.bindPopup(`<b>${label}</b>`);
        marker.on('dragend', () => { if (routingControl) { const currentWaypoints = routingControl.getWaypoints(); if (currentWaypoints[index]) { console.log(`Marker ${index} dragged`); currentWaypoints[index].latLng = marker.getLatLng(); routingControl.setWaypoints(currentWaypoints); } } });
        return marker;
    }

    function createPulsatingIcon() { return L.divIcon({ html: '', className: 'pulsating-marker', iconSize: [16, 16], iconAnchor: [8, 8] }); }

    // ============================================================
    // == Local Storage ===========================================
    // ============================================================
    function saveWaypointsToStorage(waypoints) { if (!waypoints || !Array.isArray(waypoints)) return; const latLngs = waypoints.map(wp => wp?.latLng); saveWaypointsToStorageFromLatLng(latLngs); }
    function saveWaypointsToStorageFromLatLng(latLngs) { if (!latLngs || !Array.isArray(latLngs)) return; const dataToStore = latLngs.map(ll => (ll ? { lat: parseFloat(ll.lat.toFixed(6)), lng: parseFloat(ll.lng.toFixed(6)) } : null)); if (dataToStore.length === 0 || dataToStore.every(wp => wp === null)) { localStorage.removeItem(ROUTING_STORAGE_KEY); return; } try { localStorage.setItem(ROUTING_STORAGE_KEY, JSON.stringify(dataToStore)); console.log("Waypoints saved:", dataToStore); } catch (error) { console.error("Error saving waypoints:", error); } }
    function loadWaypointsFromStorage() { const storedData = localStorage.getItem(ROUTING_STORAGE_KEY); if (!storedData) return null; try { const parsedData = JSON.parse(storedData); if (!Array.isArray(parsedData)) throw new Error("Stored data not array."); const latLngs = parsedData.map(data => (data && typeof data.lat === 'number' && typeof data.lng === 'number' ? L.latLng(data.lat, data.lng) : null)); console.log("Waypoints loaded:", latLngs); return latLngs; } catch (error) { console.error("Error parsing waypoints:", error); localStorage.removeItem(ROUTING_STORAGE_KEY); return null; } }

    // ============================================================
    // == Theme Switcher Button Creation ==========================
    // ============================================================
    function createThemeSwitcherButtons() {
        if (!themeSwitcherPlaceholder) { console.warn("Theme switcher placeholder missing."); return; }
        themeSwitcherPlaceholder.innerHTML = '';
        if (currentVenueData) {
            console.log(`Creating 2 theme switcher buttons.`);
            themeSwitcherPlaceholder.style.display = '';
            const positiveButton = document.createElement("button");
            positiveButton.textContent = `Светлая тема`;
            positiveButton.className = "btn-switch-plan";
            positiveButton.onclick = () => { console.log(`Theme button: Positive`); applyThemeAndAudio('positive'); };
            themeSwitcherPlaceholder.appendChild(positiveButton);
            const sadButton = document.createElement("button");
            sadButton.textContent = `Темная тема`;
            sadButton.className = "btn-switch-plan";
            sadButton.onclick = () => { console.log(`Theme button: Sad`); applyThemeAndAudio('sad'); };
            themeSwitcherPlaceholder.appendChild(sadButton);
        } else {
            console.log("No venue data for theme buttons.");
            themeSwitcherPlaceholder.textContent = "Кнопки тем недоступны.";
            themeSwitcherPlaceholder.style.display = 'block';
        }
    }

    // ============================================================
    // == Initialization ==========================================
    // ============================================================
        async function initializePage() {
        console.log("Initializing venue detail page...");

        // --- ПОЛУЧАЕМ ID ИЗ АТРИБУТА HTML ---
        const venueId = document.body.dataset.venueId;
        console.log("[Init] Venue ID from data attribute:", venueId);
        // ---------------------------------

        if (!venueId && venueId !== 0) { // Проверяем, есть ли ID
            displayError("ID места не был передан на страницу.");
            return;
        }

        setLoading(true);
        setPlayerDefaultState("Загрузка...");

        try {
            setupAudioListeners();
            // --- ЗАПРАШИВАЕМ ДАННЫЕ ИЗ API, ИСПОЛЬЗУЯ ПОЛУЧЕННЫЙ ID ---
            await fetchVenueDetails(venueId); // fetchVenueDetails остался без изменений
            // -------------------------------------------------
            console.log("Initial venue data fetching complete.");
            createThemeSwitcherButtons();

            if (currentVenueData && audioPlayer) {
                console.log("Applying initial 'positive' theme.");
                wasPlayingBeforeApply = false;
                applyThemeAndAudio('positive');
            } else {
                console.warn("Cannot apply initial theme.");
                if (!currentVenueData) { setPlayerDefaultState("Данные места не загружены"); if (playerElement) playerElement.style.display = 'none'; }
            }
        } catch (error) {
            console.error("Initialization Error:", error);
            if (playerElement) playerElement.style.display = 'none';
        } finally {
            setLoading(false);
            console.log("Page initialization finished.");
        }
    }


    initializePage(); // Start the process

}); // --- END DOMContentLoaded ---
