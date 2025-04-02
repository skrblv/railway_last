// frontend/venue-detail.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selections ---
    // Получаем ссылки на основные элементы DOM для манипуляций
    const venueNameHeader = document.getElementById('venue-name-header'); // Заголовок с именем места
    const venueDetailContainer = document.getElementById('venue-detail-content'); // Основной контейнер для деталей
    const planSwitcherPlaceholder = document.getElementById('plan-switcher-placeholder'); // Место для кнопок переключения планов
    const audioPlayer = document.getElementById('audio-player'); // HTML5 аудио элемент
    const stickyPlayPauseBtn = document.getElementById('sticky-play-pause-btn'); // Кнопка Play/Pause в плеере
    const stickyPlayPauseIcon = document.getElementById('sticky-play-pause-icon'); // Иконка внутри кнопки Play/Pause
    const stickyAlbumArt = document.getElementById('sticky-album-art'); // Обложка альбома в плеере
    const stickyTrackTitle = document.getElementById('sticky-track-title'); // Название трека в плеере
    const stickyArtistName = document.getElementById('sticky-artist-name'); // Имя исполнителя в плеере
    const playerElement = document.querySelector('.sticky-music-player'); // Весь блок плеера

    // --- Constants & Config ---
    // Константы для URL API, ключей хранения, путей к ресурсам и имен CSS классов
    const API_BASE_URL = 'http://127.0.0.1:8000/api'; // Базовый URL вашего бэкенда (замените, если нужно)
    const ROUTING_STORAGE_KEY = 'venueRouteWaypoints_v2'; // Ключ для сохранения маршрута в Local Storage
    // !!! ПРОВЕРЬТЕ ПУТИ К ФАЙЛАМ ОТНОСИТЕЛЬНО HTML !!!
    const VENUE_SIGN_IMAGE_URL = 'assets/heart.png'; // Путь к изображению "вывески" места
    const PLACEHOLDER_ALBUM_ART = 'assets/placeholder-album.png'; // Запасная обложка альбома
    const PLACEHOLDER_BUILDING_IMG = 'img/placeholder-building.jpg'; // Запасное изображение здания
    // SVG иконки для кнопки Play/Pause
    const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 0 24 24" width="28px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M8 5v14l11-7L8 5z"/></svg>`;
    const pauseIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 0 24 24" width="28px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    // Имена CSS классов для тем (должны совпадать с CSS)
    const THEME_A_CLASS = 'theme-plan-a-sad'; // Класс для темы Плана A
    const THEME_B_CLASS = 'theme-plan-b-green'; // Класс для темы Плана B

    // --- State Variables ---
    // Переменные для хранения состояния карты, маршрутизации, планов и аудио
    let map = null; // Экземпляр карты Leaflet
    let routingControl = null; // Экземпляр контроллера маршрутизации
    let lastClickedLatLng = null; // Координаты последнего клика по карте
    let tempClickMarker = null; // Временный маркер для клика по карте
    let noMapMessageElement = null; // Ссылка на элемент с сообщением "Карта недоступна"
    let fetchedPlanData = []; // Массив загруженных планов
    let currentPlan = null; // Текущий активный план
    let isAudioSetup = false; // Флаг, указывающий, настроены ли базовые слушатели аудио
    let wasPlayingBeforeApply = false; // Флаг, играл ли трек до смены плана/источника

    // ============================================================
    // == Helper & UI Functions ===================================
    // ============================================================

    /**
     * Форматирует секунды в строку MM:SS.
     * @param {number} seconds - Количество секунд.
     * @returns {string} Время в формате MM:SS.
     */
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) seconds = 0;
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
    }

    /**
     * Добавляет ведущий ноль к числу (в данный момент не используется).
     * @param {number} num - Число.
     * @returns {string|number} Число с ведущим нулем, если нужно.
     */
    function padZero(num) {
        return num < 10 ? "0" + num : num;
    }

    /**
     * Показывает или скрывает индикатор загрузки в основном контейнере.
     * @param {boolean} isLoading - true, чтобы показать загрузку, false - скрыть.
     */
    function setLoading(isLoading) {
        let loadingDiv = venueDetailContainer.querySelector('.loading');
        const contentElements = venueDetailContainer.querySelectorAll(':scope > *:not(.loading)'); // Все дочерние элементы, кроме самого лоадера

        if (isLoading) {
            // Скрываем основной контент
            contentElements.forEach(el => el.style.display = 'none');
            // Создаем или показываем лоадер
            if (!loadingDiv) {
                loadingDiv = document.createElement('div');
                loadingDiv.className = 'loading';
                loadingDiv.textContent = 'Загрузка деталей места...';
                venueDetailContainer.prepend(loadingDiv); // Добавляем в начало контейнера
            }
            loadingDiv.style.display = 'flex'; // Используем flex для возможного центрирования через CSS
        } else {
            // Удаляем лоадер
            if (loadingDiv) loadingDiv.remove();
            // Показываем основной контент (кроме карты и контролов, их видимость управляется отдельно)
            contentElements.forEach(el => {
                if (!el.classList?.contains('map-controls-embedded') &&
                    el.id !== 'venue-map-embedded' &&
                    !el.classList?.contains('no-map-message')) {
                    el.style.display = ''; // Восстанавливаем display (block, inline, etc.)
                }
            });
        }
    }

    /**
     * Отображает сообщение об ошибке в основном контейнере.
     * @param {string} message - Текст ошибки.
     */
    function displayError(message) {
        console.error("Displaying Error:", message);
        venueDetailContainer.innerHTML = `<div class="error-message">Ошибка: ${message}</div>`;
        if (playerElement) playerElement.style.display = 'none'; // Скрываем плеер
        if (planSwitcherPlaceholder) planSwitcherPlaceholder.style.display = 'none'; // Скрываем переключатель планов
        if (message.toLowerCase().includes("id") || message.toLowerCase().includes("not found")) {
             venueNameHeader.textContent = "Ошибка загрузки"; // Меняем заголовок
        }
        setLoading(false); // Убираем индикатор загрузки
    }

    /**
     * Обновляет иконку и aria-label кнопки Play/Pause в плеере.
     */
    function updateStickyPlayPauseIcon() {
        if (!audioPlayer || !stickyPlayPauseIcon || !stickyPlayPauseBtn) return;
        const isPlaying = audioPlayer.src && !audioPlayer.paused && audioPlayer.readyState > 0; // Играет, если есть источник, не на паузе и готов к воспроизведению
        stickyPlayPauseIcon.innerHTML = isPlaying ? pauseIconSvg : playIconSvg;
        stickyPlayPauseBtn.setAttribute("aria-label", isPlaying ? "Пауза" : "Играть");
    }

    /**
     * Сбрасывает плеер в состояние по умолчанию (без трека).
     * @param {string} [message="Трек не выбран"] - Сообщение для отображения.
     */
    function setPlayerDefaultState(message = "Трек не выбран") {
        console.log("Setting player to default state:", message);
        // Скрываем плеер только если вообще не было загружено планов
        if(playerElement) playerElement.style.display = fetchedPlanData.length > 0 ? '' : 'none';

        if(stickyTrackTitle) stickyTrackTitle.textContent = fetchedPlanData.length > 0 ? message : "Планов нет";
        if(stickyArtistName) stickyArtistName.textContent = fetchedPlanData.length > 0 ? "" : "";
        if(stickyAlbumArt) stickyAlbumArt.src = PLACEHOLDER_ALBUM_ART;
        if(audioPlayer) {
            audioPlayer.pause();
            audioPlayer.src = '';
        }
        updateStickyPlayPauseIcon(); // Показываем иконку Play
    }


    // ============================================================
    // == Core Logic: Fetching, Applying Plans, Audio ============
    // ============================================================

    /**
     * Загружает список доступных планов с бэкенда.
     */
    async function fetchPlans() {
        try {
            const response = await fetch(`${API_BASE_URL}/plans/`);
            if (!response.ok) {
                throw new Error(`HTTP ошибка при загрузке планов! Статус: ${response.status}`);
            }
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error(`Ожидался JSON, получен ${contentType}`);
            }
            fetchedPlanData = await response.json();
            console.log("Fetched Plans:", fetchedPlanData);
            // Устанавливаем план по умолчанию: сначала ищем 'A', потом берем первый, иначе null
            // Сравнение идет с 'a' в нижнем регистре
            currentPlan = fetchedPlanData.find(p => p.name?.trim().toLowerCase() === 'a') || fetchedPlanData[0] || null;
            console.log("Default plan set to:", currentPlan?.name || 'None');
        } catch (error) {
            console.error("Fetch Plans Error:", error);
            fetchedPlanData = []; // Сбрасываем данные при ошибке
            currentPlan = null;
            if (planSwitcherPlaceholder) planSwitcherPlaceholder.textContent = "Ошибка загрузки планов.";
            // Не прерываем выполнение, страница может работать и без планов
        }
    }

    /**
     * Загружает детали конкретного места по ID.
     * @param {string|number} id - ID места.
     */
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
            displayVenueDetails(venueData); // Отображаем данные
        } catch (error) {
            console.error("Fetch Venue Details Error:", error);
            displayError(error.message || "Не удалось загрузить детали места.");
            throw error; // Передаем ошибку выше для обработки в initializePage
        }
    }

    /**
     * Применяет выбранный план: меняет тему и обновляет аудио.
     * @param {object} plan - Объект плана с данными (name, song_url, etc.).
     */
    function applyPlan(plan) {
        if (!plan || typeof plan !== 'object') {
            console.warn("applyPlan: Invalid plan provided.");
            return;
        }

        const planNameLower = plan.name ? plan.name.trim().toLowerCase() : ''; // Имя плана в нижнем регистре
        console.log(`== Applying Plan: ${plan.name || 'Unnamed Plan'} (ID: ${plan.id}, NameLower: '${planNameLower}') ==`);
        currentPlan = plan; // Обновляем текущий активный план
        const body = document.body;

        // --- Переключение темы ---
        console.log("Current body classes before update:", body.className);
        // 1. Сначала удаляем ВСЕ известные классы тем
        body.classList.remove(THEME_A_CLASS, THEME_B_CLASS);

        // 2. Добавляем класс для текущего плана (сравнение с 'a' и 'b')
        if (planNameLower === 'a') { // Проверяем на 'a' (соответствует Plan A)
            console.log(`--> Applying theme class: '${THEME_A_CLASS}' (triggered by 'a')`);
            body.classList.add(THEME_A_CLASS);
        } else if (planNameLower === 'b') { // Проверяем на 'b' (соответствует Plan B)
            console.log(`--> Applying theme class: '${THEME_B_CLASS}' (triggered by 'b')`);
            body.classList.add(THEME_B_CLASS);
        } else {
            // Если имя плана не 'a' и не 'b', применяются стили по умолчанию (без доп. класса)
            console.log(`--> Applying default styles (no specific theme class for plan '${planNameLower || 'unnamed'}').`);
        }
        console.log("Body classes after update:", body.className);
        // --- Конец переключения темы ---


        // --- Обработка аудио ---
        if (!audioPlayer || !playerElement) {
             console.warn("applyPlan: Player elements missing, cannot handle audio.");
             return;
        }
        playerElement.style.display = ''; // Убеждаемся, что плеер виден

        // Запоминаем, играл ли трек ДО смены источника
        wasPlayingBeforeApply = audioPlayer.src && !audioPlayer.paused && audioPlayer.currentTime > 0;
        console.log("Audio state before apply:", { wasPlayingBeforeApply, currentSrc: audioPlayer.currentSrc });

        const newSongUrl = plan.song_url;
        const currentSongUrl = audioPlayer.currentSrc; // Используем currentSrc для надежного сравнения

        // Переназначаем слушатели 'loadedmetadata' и 'error' КАЖДЫЙ раз при смене источника (или попытке)
        // Это важно, так как они одноразовые ({ once: true })
        audioPlayer.removeEventListener("loadedmetadata", handleMetadataLoad);
        audioPlayer.removeEventListener("error", handleAudioError);
        audioPlayer.addEventListener("loadedmetadata", handleMetadataLoad, { once: true });
        audioPlayer.addEventListener("error", handleAudioError, { once: true });

        // Если новый URL есть и он отличается от текущего
        if (newSongUrl && newSongUrl !== currentSongUrl) {
            console.log(`Setting new audio source: ${newSongUrl}`);
            audioPlayer.src = newSongUrl; // Устанавливаем новый источник
            audioPlayer.load(); // ВАЖНО: Вызываем load() для начала загрузки нового трека
        }
        // Если у нового плана нет URL песни
        else if (!newSongUrl) {
            console.warn(`Plan "${plan.name || plan.id}" has no song_url. Stopping audio.`);
            audioPlayer.pause();
            audioPlayer.src = ""; // Очищаем источник
            wasPlayingBeforeApply = false; // Сбрасываем флаг, чтобы не пытаться воспроизвести
        }
        // Если URL тот же или его и не было
        else {
             console.log(`Audio source unchanged or already set to: ${currentSongUrl || 'empty'}`);
             // Если источник не изменился, но музыка была на паузе, обновим иконку
             if (!wasPlayingBeforeApply) {
                 updateStickyPlayPauseIcon();
             }
             // Если ИГРАЛА и ИСТОЧНИК НЕ МЕНЯЛСЯ, но она вдруг стала на паузу (маловероятно, но возможно)
             if (wasPlayingBeforeApply && audioPlayer.paused) {
                 console.log("Source unchanged, attempting to resume playback for already paused audio.");
                 const playPromise = audioPlayer.play();
                 if (playPromise?.catch) {
                    playPromise.catch(e => {
                        console.error("Resume playback failed:", e);
                        updateStickyPlayPauseIcon();
                    });
                 }
             }
        }

        // Обновляем метаданные в плеере (обложка, название, исполнитель) ВСЕГДА
        if(stickyAlbumArt) stickyAlbumArt.src = plan.album_art_url || PLACEHOLDER_ALBUM_ART;
        if(stickyAlbumArt) stickyAlbumArt.alt = plan.track_title || "Album Art";
        if(stickyTrackTitle) stickyTrackTitle.textContent = plan.track_title || "Трек недоступен";
        if(stickyArtistName) stickyArtistName.textContent = plan.artist_name || "Неизвестный исполнитель";

        // Если у плана нет URL, сразу обновляем иконку на Play
        if (!newSongUrl) {
             updateStickyPlayPauseIcon();
        }
        // Возобновление воспроизведения после загрузки нового источника обрабатывается в handleMetadataLoad
    }

    /**
     * Обработчик события 'loadedmetadata' для аудио. Вызывается, когда метаданные трека загружены.
     */
    const handleMetadataLoad = () => {
        console.log(`Metadata loaded for ${audioPlayer.src?.split('/').pop() || 'unknown track'}. Duration: ${formatTime(audioPlayer.duration)}. ReadyState: ${audioPlayer.readyState}`);

        // Если мы хотели воспроизвести этот трек (флаг wasPlayingBeforeApply) и он готов
        if (wasPlayingBeforeApply && currentPlan?.song_url && audioPlayer.readyState >= 2) { // HAVE_CURRENT_DATA или выше
            console.log("Attempting to resume playback after metadata load...");
            const playPromise = audioPlayer.play(); // Пытаемся запустить
            if (playPromise?.then) { // Используем промис, если он есть
                playPromise.then(() => {
                    console.log("Playback resumed successfully via promise.");
                    updateStickyPlayPauseIcon(); // Обновляем иконку на Pause
                })
                .catch(e => { // Ошибка (например, автовоспроизведение заблокировано)
                    console.error("Resume playback failed:", e);
                    updateStickyPlayPauseIcon(); // Обновляем иконку (вероятно, останется Play)
                });
            } else { // Старые браузеры без промиса
                console.log("Playback resumed (sync or no promise).");
                updateStickyPlayPauseIcon();
            }
        } else {
             console.log("Not resuming playback (was paused before, no song URL, or audio not ready).");
             updateStickyPlayPauseIcon(); // Убеждаемся, что иконка соответствует текущему состоянию (скорее всего, пауза)
        }
        // Сбрасываем флаг после попытки воспроизведения
        wasPlayingBeforeApply = false;
    };

    /**
     * Обработчик события 'error' для аудио.
     */
    const handleAudioError = (e) => {
        console.error("Audio Player Error:", e.target.error?.message || 'Unknown audio error', 'on source:', audioPlayer.src);
        setPlayerDefaultState("Ошибка загрузки трека"); // Показываем ошибку в плеере
        wasPlayingBeforeApply = false; // Сбрасываем флаг
    };

    /**
     * Переключает состояние Play/Pause для плеера.
     */
    function toggleStickyPlayPause() {
        if (!audioPlayer) {
            console.warn("Toggle Play/Pause aborted: Audio player element not found.");
            return;
        }
        console.log("Toggle play/pause. Current state -> Paused:", audioPlayer.paused, "| Src:", !!audioPlayer.src, "| ReadyState:", audioPlayer.readyState);

        // Случай 1: Нет источника, но есть текущий план с песней -> применить план
        if (!audioPlayer.src && currentPlan?.song_url) {
            console.log("No audio source set. Applying current plan first with intent to play...");
            wasPlayingBeforeApply = true; // Ставим флаг, чтобы воспроизвести после загрузки
            applyPlan(currentPlan); // Запускаем процесс установки src и загрузки
            return; // Выходим, остальное сделает applyPlan и handleMetadataLoad
        }
        // Случай 2: Нет источника и нет подходящего плана -> ничего не делаем
        else if (!audioPlayer.src) {
            console.warn("Cannot play: No audio source set and no current plan with audio.");
            setPlayerDefaultState("Трек не выбран");
            return;
        }
        // Случай 3: Источник есть -> переключаем Play/Pause
        if (audioPlayer.paused) {
             console.log("Attempting to play audio...");
             const playPromise = audioPlayer.play();
             if (playPromise !== undefined) { // Проверяем, возвращает ли play() промис
                 playPromise.then(() => {
                     console.log("Playback started via promise.");
                     updateStickyPlayPauseIcon();
                 }).catch(error => {
                     console.error("Audio play failed:", error);
                     updateStickyPlayPauseIcon(); // Обновляем иконку (останется Play)
                 });
             } else { // Для старых браузеров
                 console.log("Playback started (sync or no promise).");
                 updateStickyPlayPauseIcon();
             }
        } else {
            console.log("Attempting to pause audio...");
            audioPlayer.pause();
            updateStickyPlayPauseIcon(); // Пауза синхронна, сразу обновляем иконку
        }
    }

    /**
     * Настраивает постоянные слушатели событий для аудио плеера. Вызывается один раз.
     */
    function setupAudioListeners() {
         if (!audioPlayer || isAudioSetup) return; // Предотвращаем повторную настройку
         console.log("Setting up persistent audio event listeners.");

         // Слушатели, которые должны быть активны всегда
         audioPlayer.addEventListener('play', updateStickyPlayPauseIcon); // Обновлять иконку при старте
         audioPlayer.addEventListener('pause', updateStickyPlayPauseIcon); // Обновлять иконку при паузе
         audioPlayer.addEventListener('ended', handleAudioEnded); // Зацикливать трек

         // Слушатели 'loadedmetadata' и 'error' назначаются динамически в applyPlan

         // Назначаем обработчик на кнопку Play/Pause
         if(stickyPlayPauseBtn) {
            stickyPlayPauseBtn.removeEventListener('click', toggleStickyPlayPause); // Удаляем старый, если есть
            stickyPlayPauseBtn.addEventListener('click', toggleStickyPlayPause);
         } else {
            console.warn("Sticky play/pause button not found for listener setup.");
         }

         isAudioSetup = true; // Помечаем, что настройка завершена
    }

    /**
     * Обработчик события 'ended' для аудио (зацикливание трека).
     */
    const handleAudioEnded = () => {
         console.log('Audio track ended - Restarting (Looping)');
         audioPlayer.currentTime = 0; // Возвращаем время в начало
         // Небольшая задержка перед повторным запуском для стабильности
         setTimeout(() => {
            const playPromise = audioPlayer.play();
            if (playPromise?.catch) { // Обрабатываем возможную ошибку автовоспроизведения
                playPromise.catch(e => console.error("Loop playback failed:", e));
            }
         }, 100);
    };


    // ============================================================
    // == Venue Detail Display & Map Logic ========================
    // ============================================================

    /**
     * Отображает детали места в HTML.
     * @param {object} venue - Объект с данными места.
     */
    function displayVenueDetails(venue) {
        if (!venue) {
            displayError("Получены неверные данные о месте.");
            return;
        }
        venueDetailContainer.innerHTML = ''; // Очищаем контейнер
        venueNameHeader.textContent = venue.name || 'Детали места';

        // --- Изображения ---
        const imagesDiv = document.createElement('div');
        imagesDiv.className = 'venue-images';
        const signImgSrc = VENUE_SIGN_IMAGE_URL; // Используем константу для вывески
        const photoImgSrc = venue.image_url || PLACEHOLDER_BUILDING_IMG; // Фото или плейсхолдер здания
        imagesDiv.innerHTML = `
            <img id="venue-sign-image" src="${signImgSrc}" alt="Вывеска ${venue.name || ''}">
            <img id="venue-photo" src="${photoImgSrc}" alt="Фото ${venue.name || ''}">
        `;
        venueDetailContainer.appendChild(imagesDiv);

        // Обработчики ошибок для изображений
        const venuePhotoImg = imagesDiv.querySelector('#venue-photo');
        if (venuePhotoImg) {
            venuePhotoImg.onerror = () => { // Если фото не загрузилось
                if (venuePhotoImg) venuePhotoImg.src = PLACEHOLDER_BUILDING_IMG;
                console.warn("Venue photo failed to load, using placeholder.");
            };
        }
        const venueSignImg = imagesDiv.querySelector('#venue-sign-image');
         if (venueSignImg) {
            if (!VENUE_SIGN_IMAGE_URL) { // Если путь к вывеске не задан
                venueSignImg.style.display = 'none';
            } else {
                 venueSignImg.onerror = () => { // Если вывеска не загрузилась
                    if (venueSignImg) venueSignImg.style.display = 'none';
                    console.warn("Venue sign image failed to load.");
                };
            }
        }

        // --- Информационная секция ---
        const infoDiv = document.createElement('div');
        infoDiv.className = 'venue-info';
        infoDiv.innerHTML = `<h2 id="venue-type">${venue.rating_text || 'Информация'}</h2>`; // Тип/заголовок
        let starsHTML = '<div id="venue-rating" class="rating-stars">'; // Звезды рейтинга
        const rating = Math.round(venue.rating_stars || 0);
        starsHTML += (rating > 0 && rating <= 5) ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '☆☆☆☆☆';
        starsHTML += '</div>';
        infoDiv.innerHTML += starsHTML;
        infoDiv.innerHTML += `<p id="venue-description">${venue.date_text || 'Описание недоступно.'}</p>`; // Описание/даты
        infoDiv.innerHTML += `<p class="no-map-message" style="display: none;">Информация о карте для этого места недоступна.</p>`; // Сообщение об отсутствии карты
        venueDetailContainer.appendChild(infoDiv);
        noMapMessageElement = infoDiv.querySelector('.no-map-message'); // Сохраняем ссылку

        // --- Секция карты ---
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

        // --- Инициализация карты (если есть координаты) ---
        const lat = venue.latitude;
        const lng = venue.longitude;
        if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) { // Проверяем валидность координат
            console.log(`Coordinates found: [${lat}, ${lng}]. Initializing map.`);
            if (mapContainer) mapContainer.style.display = 'block'; // Показываем контейнер карты
            if (mapControlsContainer) mapControlsContainer.style.display = 'block'; // Показываем контролы
            if (noMapMessageElement) noMapMessageElement.style.display = 'none'; // Скрываем сообщение об отсутствии карты

            if (!map) setupRoutingMap(mapContainer, lat, lng, venue.name); // Первый запуск - создаем карту
            else updateMapDestination(lat, lng, venue.name); // Карта есть - обновляем конечную точку

            setTimeout(() => map?.invalidateSize(), 150); // Пересчитываем размер карты после возможного показа
        } else { // Координат нет или они невалидны
            console.warn("Venue coordinates are missing or invalid. Map cannot be displayed.");
            if (mapContainer) mapContainer.style.display = 'none';
            if (mapControlsContainer) mapControlsContainer.style.display = 'none';
            if (noMapMessageElement) noMapMessageElement.style.display = 'block'; // Показываем сообщение об отсутствии карты
        }
    }

    /**
     * Инициализирует карту Leaflet и контроллер маршрутизации.
     * @param {HTMLElement} mapElement - DOM элемент для карты.
     * @param {number} venueLat - Широта места.
     * @param {number} venueLng - Долгота места.
     * @param {string} venueName - Название места.
     */
    function setupRoutingMap(mapElement, venueLat, venueLng, venueName) {
        if (!mapElement) { console.error("Map container element not found!"); return; }
        if (map) { map.remove(); map = null; routingControl = null; } // Удаляем старую карту, если есть

        try {
            console.log("Initializing Leaflet map...");
            map = L.map(mapElement, { zoomControl: false }).setView([venueLat, venueLng], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);
            L.control.zoom({ position: 'bottomright' }).addTo(map);

            // --- Настройка маршрутизации ---
            let waypointsLatLng = loadWaypointsFromStorage(); // Загружаем сохраненные точки [start, end]
            const venueLatLng = L.latLng(venueLat, venueLng); // Конечная точка (текущее место)
            let initialWaypoints; // Точки для инициализации контроллера

            // Логика определения начальных точек:
            // 1. Если нет сохраненных, или их меньше 2, или конечная точка невалидна: [сохраненный старт (или null), текущее место]
            // 2. Если есть сохраненный маршрут: [сохраненный старт, текущее место] (обновляем конечную точку)
            if (!waypointsLatLng || waypointsLatLng.length < 2 || !waypointsLatLng[1]) {
                console.log("Setting initial waypoints: [Saved Start or Null, Venue]");
                initialWaypoints = [ waypointsLatLng?.[0] || null, venueLatLng ];
            } else {
                console.log("Updating saved route destination to current venue.");
                waypointsLatLng[1] = venueLatLng; // Обновляем конечную точку
                if (waypointsLatLng[0]?.equals(venueLatLng, 1e-6)) { // Если старт совпадает с новым концом
                    console.warn("Saved start point is same as destination, clearing start.");
                    waypointsLatLng[0] = null; // Сбрасываем старт
                }
                initialWaypoints = waypointsLatLng;
            }

            // Конвертируем LatLng в формат L.Routing.waypoint
            const waypointsForControl = initialWaypoints.map(latLng =>
                latLng ? L.Routing.waypoint(latLng) : L.Routing.waypoint(null)
            );
            // Сохраняем (возможно измененные) точки перед созданием контроллера
            saveWaypointsToStorageFromLatLng(initialWaypoints);

            console.log("Initializing routing control with waypoints:", waypointsForControl.map(wp=>wp.latLng));
            routingControl = L.Routing.control({
                waypoints: waypointsForControl,
                routeWhileDragging: true, // Пересчет при перетаскивании маркеров
                show: true, // Показывать панель с инструкциями
                addWaypoints: false, // Запретить добавление промежуточных точек
                language: 'ru',
                createMarker: (i, wp, nWps) => createCustomMarker(i, wp, nWps, venueName), // Кастомные маркеры
                router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }), // Роутер OSRM
                geocoder: L.Control.Geocoder.nominatim({ geocodingQueryParams: { "accept-language": "ru,en" } }), // Поиск адресов
                lineOptions: { styles: [{ color: '#b8a4d4', opacity: 0.85, weight: 7 }] }, // Стиль линии маршрута
                showAlternatives: true, // Показывать альтернативные маршруты
                alternativeLineOptions: { styles: [{color: 'gray', opacity: 0.6, weight: 5, dashArray: '5, 10'}] } // Стиль альтернативных
            }).addTo(map);

            // --- Слушатели событий маршрутизации ---
            routingControl.on('waypointschanged', (e) => { // При изменении точек (перетаскивание, удаление)
                console.log("Waypoints changed, saving to storage.");
                saveWaypointsToStorage(e.waypoints);
                 const startButton = venueDetailContainer.querySelector('#set-start-button');
                 if (startButton && (!e.waypoints || !e.waypoints[0] || !e.waypoints[0].latLng)) {
                     startButton.disabled = true; // Деактивировать кнопку, если старт удален
                 }
            });
            routingControl.on('routesfound', (e) => { // При нахождении маршрута
                if (e.waypoints?.length) {
                     console.log("Route found, ensuring waypoints are saved.");
                     saveWaypointsToStorage(e.waypoints); // Сохраняем точки (могут обновиться из геокодера)
                 }
            });
             map.on('click', handleMapClick); // Клики по карте для установки старта

            // --- Настройка кнопки "Задать начало" ---
            const setStartButton = mapElement.closest('#map-section-wrapper')?.querySelector('#set-start-button');
            if (setStartButton) {
                setStartButton.disabled = !initialWaypoints[0]; // Активна, только если старт уже загружен
                 setStartButton.removeEventListener('click', handleSetStartClick);
                setStartButton.addEventListener('click', handleSetStartClick);
            } else { console.error("Set Start button not found after map setup!"); }

            setTimeout(() => map?.invalidateSize(), 250); // Финальный пересчет размера

        } catch (mapError) {
            console.error("Error initializing Leaflet map or routing:", mapError);
            mapElement.innerHTML = `<p class='error-message'>Ошибка загрузки карты: ${mapError.message}</p>`;
             const mapControlsContainer = mapElement.closest('#map-section-wrapper')?.querySelector('.map-controls-embedded');
             if (mapControlsContainer) mapControlsContainer.style.display = 'none';
             if (noMapMessageElement) noMapMessageElement.style.display = 'block';
        }
    }

    /**
     * Обновляет конечную точку маршрута на карте.
     * @param {number} venueLat - Новая широта конечной точки.
     * @param {number} venueLng - Новая долгота конечной точки.
     * @param {string} venueName - Новое имя конечной точки.
     */
    function updateMapDestination(venueLat, venueLng, venueName) {
        if (!routingControl || !map) {
            console.warn("Cannot update destination: Map or routing control not initialized.");
            return;
        }
        console.log(`Updating map destination to: ${venueName} [${venueLat}, ${venueLng}]`);

        const newVenueLatLng = L.latLng(venueLat, venueLng);
        let currentWaypoints = routingControl.getWaypoints(); // Получаем текущие точки [start, end]

        while (currentWaypoints.length < 2) currentWaypoints.push(L.Routing.waypoint(null, "")); // Должно быть минимум 2 точки

        const startWaypoint = currentWaypoints[0] || L.Routing.waypoint(null, "Начало (A)");

        // Если текущий старт совпадает с новым концом -> сбрасываем старт
        if (startWaypoint.latLng?.equals(newVenueLatLng, 1e-6)) {
            console.warn("Start point is the same as the new destination. Clearing start point.");
            currentWaypoints = [
                L.Routing.waypoint(null, "Начало (A)"),
                L.Routing.waypoint(newVenueLatLng, venueName || "Конец (B)")
            ];
        } else {
            // Иначе просто обновляем последнюю (конечную) точку
            currentWaypoints[currentWaypoints.length - 1] = L.Routing.waypoint(newVenueLatLng, venueName || "Конец (B)");
        }

        console.log("Setting new waypoints:", currentWaypoints.map(wp=>wp.latLng));
        routingControl.setWaypoints(currentWaypoints); // Устанавливаем обновленные точки
        saveWaypointsToStorage(currentWaypoints); // Сохраняем

        // Обновляем попап маркера и центрируем карту
        setTimeout(() => {
            try {
                 const planWaypoints = routingControl.getPlan()?.getWaypoints(); // Получаем точки из *плана* маршрута
                 if (planWaypoints && planWaypoints.length > 0) {
                     const destinationMarker = planWaypoints[planWaypoints.length - 1]?.marker; // Находим маркер конечной точки
                     if (destinationMarker) {
                         destinationMarker.bindPopup(`<b>${venueName || 'Конец (B)'}</b>`).openPopup(); // Обновляем и открываем попап
                         setTimeout(()=> destinationMarker.closePopup(), 2500); // Закрываем через 2.5 сек
                     }
                 }
                const bounds = routingControl.getBounds(); // Получаем границы маршрута
                if (bounds?.isValid()) { // Если есть валидные границы
                    console.log("Flying to route bounds.");
                    map.flyToBounds(bounds, { padding: [40, 40], duration: 0.6, maxZoom: 16 }); // Плавно летим к границам
                } else { // Если только одна точка (конечная)
                    console.log("Flying to destination point.");
                    map.flyTo(newVenueLatLng, Math.max(map.getZoom() || 0, 14), { duration: 0.6 }); // Летим к ней
                }
            } catch (error) {
                console.warn("Error updating marker popup or flying to bounds:", error);
                map.flyTo(newVenueLatLng, 14, { duration: 0.6 }); // Запасной вариант - просто летим к точке
            }
        }, 400); // Небольшая задержка для расчета маршрута
    }

    /**
     * Обработчик клика по карте для установки начальной точки маршрута.
     * @param {L.LeafletMouseEvent} e - Событие клика.
     */
    function handleMapClick(e) {
        if (!map) return;
        lastClickedLatLng = e.latlng; // Сохраняем координаты клика
        console.log("Map clicked at:", lastClickedLatLng);

        const markerOptions = { icon: createPulsatingIcon(), zIndexOffset: 1000, interactive: false };

        // Создаем или перемещаем временный маркер
        if (!tempClickMarker) tempClickMarker = L.marker(lastClickedLatLng, markerOptions).addTo(map);
        else tempClickMarker.setLatLng(lastClickedLatLng);

        if (tempClickMarker.bringToFront) tempClickMarker.bringToFront(); // Поверх других слоев

        // Активируем кнопку "Задать начало"
        const setStartButton = venueDetailContainer.querySelector('#set-start-button');
        if (setStartButton) {
            setStartButton.disabled = false;
            setStartButton.classList.remove('confirmed');
            console.log("Set Start button enabled.");
        }
    }

    /**
     * Обработчик клика по кнопке "Задать начало (A)".
     */
    function handleSetStartClick() {
        if (!lastClickedLatLng || !routingControl || !map) {
            console.warn("Cannot set start: Clicked location, routing control, or map missing.");
            return;
        }
        console.log("Setting start point to:", lastClickedLatLng);

        const startWaypoint = L.Routing.waypoint(lastClickedLatLng, "Начало (A)"); // Новая начальная точка
        let currentWaypoints = routingControl.getWaypoints();

        // Обновляем маршрут
        if (currentWaypoints.length < 2) { // Если точек меньше 2 (например, только конечная)
             console.log("Less than 2 waypoints exist, setting [New Start, Destination].");
            const destinationWaypoint = currentWaypoints[1] || currentWaypoints[0] || L.Routing.waypoint(map.getCenter(), "Конец (B)");
            routingControl.setWaypoints([startWaypoint, destinationWaypoint]);
        } else { // Если уже есть старт и конец
            console.log("Updating existing start waypoint.");
            currentWaypoints[0] = startWaypoint; // Заменяем первую (начальную) точку
            routingControl.setWaypoints(currentWaypoints);
        }
        saveWaypointsToStorage(routingControl.getWaypoints()); // Сохраняем

        // Убираем временный маркер
        if (tempClickMarker) { map.removeLayer(tempClickMarker); tempClickMarker = null; }
        lastClickedLatLng = null; // Сбрасываем координаты клика

        // Обновляем состояние кнопки
        const setStartButton = venueDetailContainer.querySelector('#set-start-button');
        if (setStartButton) {
            setStartButton.disabled = true; // Деактивируем
            setStartButton.classList.add('confirmed'); // Добавляем класс для анимации
             console.log("Set Start button disabled and confirmed.");
            setTimeout(() => setStartButton.classList.remove('confirmed'), 550); // Убираем класс через 0.55 сек
        }

        // Плавно центрируем карту на новом маршруте
        setTimeout(() => {
            try {
                const bounds = routingControl.getBounds();
                if (bounds?.isValid()) {
                     console.log("Flying to route bounds after setting start.");
                    map.flyToBounds(bounds, { padding: [40, 40], duration: 0.6, maxZoom: 16 });
                } else if (startWaypoint.latLng) { // Если границы невалидны, летим к старту
                     console.log("Flying to start point after setting start (invalid bounds).");
                     map.flyTo(startWaypoint.latLng, Math.max(map.getZoom() || 0, 14), { duration: 0.6 });
                 }
            } catch (error) { console.error("Error flying to bounds after setting start:", error); }
        }, 300); // Задержка для расчета
    }

    /**
     * Создает кастомные маркеры (зеленый для старта, красный для конца) для маршрута.
     * @param {number} index - Индекс точки (0 для старта).
     * @param {L.Routing.Waypoint} waypoint - Объект точки маршрута.
     * @param {number} numberOfWaypoints - Общее количество точек.
     * @param {string} venueName - Имя конечного места (для попапа).
     * @returns {L.Marker|null} Маркер Leaflet или null, если точка не задана.
     */
    function createCustomMarker(index, waypoint, numberOfWaypoints, venueName) {
        if (!waypoint?.latLng) return null; // Не создаем маркер, если нет координат

        const isStart = index === 0;
        const isEnd = index === numberOfWaypoints - 1;
        let markerColor = isStart ? 'green' : (isEnd ? 'red' : 'blue'); // Определяем цвет

        const iconUrl = `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`;
        const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';
        const customIcon = L.icon({ iconUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });

        const marker = L.marker(waypoint.latLng, { draggable: true, icon: customIcon });

        // Определяем текст для попапа
        let label = `Точка ${index + 1}`;
        if (isStart) label = waypoint.name || 'Начало (A)';
        else if (isEnd) label = venueName || waypoint.name || 'Конец (B)';
        else label = waypoint.name || `Промежуточная точка ${index + 1}`;

        marker.bindPopup(`<b>${label}</b>`); // Привязываем попап

        // Обработчик перетаскивания маркера
        marker.on('dragend', () => {
             if (routingControl) {
                const currentWaypoints = routingControl.getWaypoints();
                if (currentWaypoints[index]) {
                     console.log(`Marker ${index} dragged to:`, marker.getLatLng());
                    currentWaypoints[index].latLng = marker.getLatLng(); // Обновляем координаты
                    routingControl.setWaypoints(currentWaypoints); // Пересчитываем маршрут
                }
             }
        });
        return marker;
    }

    /**
     * Создает иконку pulsating-marker (используется для временного маркера клика).
     * @returns {L.DivIcon} Иконка Leaflet DivIcon.
     */
    function createPulsatingIcon() {
        return L.divIcon({ html: '', className: 'pulsating-marker', iconSize: [16, 16], iconAnchor: [8, 8] });
    }

    // ============================================================
    // == Local Storage ===========================================
    // ============================================================

    /**
     * Сохраняет массив точек маршрута (L.Routing.Waypoint) в Local Storage.
     * @param {L.Routing.Waypoint[]} waypoints - Массив точек.
     */
    function saveWaypointsToStorage(waypoints) {
        if (!waypoints || !Array.isArray(waypoints)) { console.warn("Invalid waypoints data for saving."); return; }
        const latLngs = waypoints.map(wp => wp?.latLng); // Извлекаем LatLng
        saveWaypointsToStorageFromLatLng(latLngs);
    }

    /**
     * Сохраняет массив координат (L.LatLng) в Local Storage.
     * @param {(L.LatLng|null)[]} latLngs - Массив координат или null.
     */
    function saveWaypointsToStorageFromLatLng(latLngs) {
        if (!latLngs || !Array.isArray(latLngs)) { console.warn("Invalid LatLng array for saving."); return; }
        // Конвертируем в простой формат {lat, lng} с округлением
        const dataToStore = latLngs.map(ll =>
            (ll ? { lat: parseFloat(ll.lat.toFixed(6)), lng: parseFloat(ll.lng.toFixed(6)) } : null)
        );
        // Не сохраняем, если нет валидных точек
        if (dataToStore.length === 0 || dataToStore.every(wp => wp === null)) {
            console.log("No valid waypoints to save, removing item from storage.");
            localStorage.removeItem(ROUTING_STORAGE_KEY);
            return;
        }
        try {
            localStorage.setItem(ROUTING_STORAGE_KEY, JSON.stringify(dataToStore));
            console.log("Waypoints saved to local storage:", dataToStore);
        } catch (error) { console.error("Error saving waypoints to local storage:", error); }
    }

    /**
     * Загружает точки маршрута из Local Storage.
     * @returns {(L.LatLng|null)[]|null} Массив координат или null, если нет данных или ошибка.
     */
    function loadWaypointsFromStorage() {
        const storedData = localStorage.getItem(ROUTING_STORAGE_KEY);
        if (!storedData) { console.log("No waypoints found in local storage."); return null; }
        try {
            const parsedData = JSON.parse(storedData);
            if (!Array.isArray(parsedData)) { // Проверка формата
                console.warn("Invalid data format in local storage, removing item.");
                localStorage.removeItem(ROUTING_STORAGE_KEY); return null;
            }
            // Конвертируем обратно в L.LatLng
            const latLngs = parsedData.map(data =>
                (data && typeof data.lat === 'number' && typeof data.lng === 'number' ? L.latLng(data.lat, data.lng) : null)
            );
            console.log("Waypoints loaded from local storage:", latLngs);
            return latLngs;
        } catch (error) {
            console.error("Error parsing waypoints from local storage:", error);
            localStorage.removeItem(ROUTING_STORAGE_KEY); // Удаляем испорченные данные
            return null;
        }
    }

    // ============================================================
    // == Plan Switcher Button Creation ===========================
    // ============================================================

    /**
     * Создает кнопки для переключения планов на основе загруженных данных.
     */
    function createPlanSwitcherButtons() {
        if (!planSwitcherPlaceholder) { console.warn("Plan switcher placeholder element not found."); return; }
        planSwitcherPlaceholder.innerHTML = ''; // Очищаем

        if (fetchedPlanData && fetchedPlanData.length > 0) {
            console.log(`Creating ${fetchedPlanData.length} plan switcher button(s).`);
            fetchedPlanData.forEach((plan) => { // Для каждого плана создаем кнопку
                const button = document.createElement("button");
                button.textContent = plan.name ? `Активировать ${plan.name}` : `Активировать План ${plan.id || '?'}`;
                button.className = "btn-switch-plan";
                button.setAttribute("data-plan-id", plan.id);
                button.onclick = () => { // При клике вызываем applyPlan с этим планом
                    console.log(`Plan button clicked: ${plan.name || plan.id}`);
                    applyPlan(plan);
                };
                planSwitcherPlaceholder.appendChild(button);
            });
            planSwitcherPlaceholder.style.display = ''; // Показываем контейнер с кнопками
        } else { // Если планов нет
            console.log("No plans available to create buttons.");
            planSwitcherPlaceholder.textContent = "Альтернативные планы недоступны.";
            planSwitcherPlaceholder.style.display = 'block'; // Показываем сообщение
            if (playerElement) playerElement.style.display = 'none'; // Скрываем плеер
            setPlayerDefaultState("Планов нет"); // Обновляем текст плеера
        }
    }

    // ============================================================
    // == Initialization ==========================================
    // ============================================================

    /**
     * Главная функция инициализации страницы.
     */
    async function initializePage() {
        console.log("Initializing venue detail page...");
        const urlParams = new URLSearchParams(window.location.search);
        const venueId = urlParams.get('id'); // Получаем ID из URL

        if (!venueId) { // Если ID нет
            console.error("Venue ID missing from URL query parameters.");
            displayError("ID места не указан в URL."); // Показываем ошибку
            return; // Прекращаем инициализацию
        }
        console.log("Venue ID found:", venueId);

        setLoading(true); // Показываем лоадер

        try {
            setupAudioListeners(); // Настраиваем базовые слушатели аудио один раз

            // Параллельно загружаем детали места и список планов
            await Promise.all([
                fetchVenueDetails(venueId),
                fetchPlans()
            ]);

            console.log("Initial data fetching complete.");

            createPlanSwitcherButtons(); // Создаем кнопки планов

            // Применяем начальный/дефолтный план (обычно Plan A)
            if (currentPlan && audioPlayer) {
                console.log("Applying initial/default plan:", currentPlan.name || currentPlan.id);
                wasPlayingBeforeApply = false; // Не воспроизводим автоматически при первой загрузке
                applyPlan(currentPlan);
            } else if (!currentPlan && fetchedPlanData.length > 0) { // Планы есть, но дефолтный не найден
                 console.warn("Plans were fetched, but no default plan (Plan A or first) was found. No initial plan applied.");
                 setPlayerDefaultState(); // Сбрасываем плеер
            }
            else { // Планов нет или нет плеера
                console.warn("No initial plan to apply (either no plans fetched or player missing).");
                 if (audioPlayer) {
                     setPlayerDefaultState("Планов нет"); // Обновляем плеер, если он есть
                 }
            }
        } catch (error) { // Ловим ошибки из fetchVenueDetails или fetchPlans
            console.error("Initialization Error during data fetch:", error);
            // Сообщение об ошибке уже должно быть показано внутри displayError
        } finally {
            setLoading(false); // Всегда убираем лоадер в конце
            console.log("Page initialization process finished.");
        }
    }

    // --- Запуск инициализации ---
    initializePage();

}); // --- END DOMContentLoaded ---
