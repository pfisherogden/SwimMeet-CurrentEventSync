document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const eventDisplay = document.getElementById('event-display');
    const heatDisplay = document.getElementById('heat-display');
    const lastUpdatedDisplay = document.getElementById('last-updated');
    const statusIndicator = document.getElementById('connection-status');
    const configBtn = document.getElementById('config-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const themeBtn = document.getElementById('theme-btn');
    const configModal = document.getElementById('config-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const saveBtn = document.getElementById('save-btn');
    const sheetIdInput = document.getElementById('sheet-id-input');

    const wakelockCheckbox = document.getElementById('wakelock-checkbox');

    const autoThemeCheckbox = document.getElementById('auto-theme-checkbox');
    const autoThemeStartInput = document.getElementById('auto-theme-start');
    const autoThemeEndInput = document.getElementById('auto-theme-end');

    // State
    const urlParams = new URLSearchParams(window.location.search);

    const isTestMode = urlParams.get('test') === 'true' || urlParams.get('verifier') === 'true';
    const isOffline = urlParams.get('offline') === 'true' || urlParams.get('demo') === 'true';
    let sheetId = urlParams.get('sheetId') || localStorage.getItem('swimMeetSheetId');
    const meetName = urlParams.get('meetName'); 

    // REDIRECTOR PARAMS
    const teamId = urlParams.get('team');
    const sharedSecret = urlParams.get('secret');
    const redirectorUrl = localStorage.getItem('swimMeetRedirectorUrl');

    // UX State - Defaulting to TRUE for Auto Theme
    const storedAutoTheme = localStorage.getItem('swimMeetAutoTheme');
    let isAutoThemeEnabled = storedAutoTheme === null ? true : storedAutoTheme === 'true';

    let autoThemeStart = parseInt(localStorage.getItem('swimMeetAutoThemeStart') || '17', 10);
    let autoThemeEnd = parseInt(localStorage.getItem('swimMeetAutoThemeEnd') || '7', 10);
    let isDarkMode = localStorage.getItem('swimMeetDarkMode') === 'true';
    let isWakelockEnabled = localStorage.getItem('swimMeetWakelock') === 'true';

    let wakeLockSentinel = null;
    let lastEvent = null;
    let lastHeat = null;

    // --- RATE LIMIT & BACKOFF STATE ---
    const BASE_POLL_INTERVAL = 10000; // 10 seconds
    let currentPollInterval = BASE_POLL_INTERVAL;
    let backoffMultiplier = 1;
    let pollIntervalId;
    let qrcodeObj = null;
    let lastSuccessfulFetch = Date.now();

    // Initialization
    if (!sheetId && !isOffline) {
        updateDisplay("--", "--", "Setup Required");
        showConfig();
    } else {
        startPolling();
    }

    updateQRCode();

    if (isAutoThemeEnabled) {
        checkAutoTheme();
    } else if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }

    if (isWakelockEnabled) {
        requestWakeLock();
    }

    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            console.log('Tab visible: Resuming polling');
            startPolling();
            if (wakeLockSentinel !== null) {
                await requestWakeLock();
            }
        } else {
            console.log('Tab hidden: Pausing polling');
            stopPolling();
            statusIndicator.style.opacity = "0.5";
            statusIndicator.title = "Paused (Inactive)";
        }
    });

    // --- Core Logic ---

    function startPolling() {
        if (!sheetId && !isOffline) return;
        stopPolling();

        statusIndicator.className = "status-indicator status-connecting";
        statusIndicator.title = isOffline ? "Offline Mode" : "Connecting...";

        if (isOffline) {
            statusIndicator.classList.remove('status-connecting');
            statusIndicator.classList.add('status-connected');
        }

        const meetNameDisplay = document.getElementById('meet-name-display');
        meetNameDisplay.textContent = meetName || (isOffline ? "Offline Demo" : "Live");

        fetchData(); // Initial immediate fetch

        pollIntervalId = setInterval(() => {
            fetchData();
            if (isAutoThemeEnabled) checkAutoTheme();
            
            // Check for stale data (older than 2 minutes)
            const minutesStale = (Date.now() - lastSuccessfulFetch) / 60000;
            if (minutesStale > 2 && !isOffline) {
                statusIndicator.classList.add('status-error');
                statusIndicator.title = "Data is STALE (Connection issues)";
                lastUpdatedDisplay.style.color = "red";
                lastUpdatedDisplay.textContent += " (Stale)";
            }
        }, currentPollInterval);
    }

    function stopPolling() {
        if (pollIntervalId) {
            clearInterval(pollIntervalId);
            pollIntervalId = null;
        }
    }

    async function fetchData() {
        try {
            if (isOffline) {
                if (window.MOCK_DATA) {
                    parseCSV(window.MOCK_DATA);
                    statusIndicator.className = "status-indicator status-connected";
                    statusIndicator.title = "Offline Mode";
                    statusIndicator.style.opacity = "1";
                }
                return;
            }

            const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&id=${sheetId}&gid=0&cacheBust=${Date.now()}`;
            const response = await fetch(url);
            
            if (response.status === 429) {
                handleRateLimit();
                throw new Error("Rate Limited (429)");
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const text = await response.text();
            parseCSV(text);

            // Success! Reset backoff
            if (backoffMultiplier > 1) {
                console.log("Connection restored. Resetting poll interval.");
                backoffMultiplier = 1;
                currentPollInterval = BASE_POLL_INTERVAL;
                startPolling(); // Restart with normal interval
            }

            lastSuccessfulFetch = Date.now();
            lastUpdatedDisplay.style.color = ""; // Reset stale color
            statusIndicator.className = "status-indicator status-connected";
            statusIndicator.title = "Connected";
            statusIndicator.style.opacity = "1";

        } catch (error) {
            console.error("Fetch error:", error);
            statusIndicator.className = "status-indicator status-error";
            statusIndicator.title = `Error: ${error.message}`;
            statusIndicator.style.opacity = "1";
        }
    }

    function handleRateLimit() {
        // Exponential backoff
        backoffMultiplier = Math.min(backoffMultiplier * 2, 6); // Max 60 second interval
        currentPollInterval = BASE_POLL_INTERVAL * backoffMultiplier;
        
        console.warn(`Rate limited by Google. Increasing poll interval to ${currentPollInterval/1000}s`);
        
        statusIndicator.className = "status-indicator status-error";
        statusIndicator.title = "High demand. Slowing down updates...";
        
        stopPolling();
        startPolling(); // Restart with new interval
    }

    function parseCSV(csvText) {
        const lines = csvText.split('\n');
        if (lines.length < 2) return;
        const dataRow = lines[1];
        const matches = dataRow.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const columns = matches.length > 0 ? matches.map(s => s.replace(/^"|"$/g, '')) : dataRow.split(',');

        if (columns.length >= 2) {
            let eventVal = columns[0].trim();
            let heatVal = columns[1].trim();
            const timeVal = columns[2] ? columns[2].trim() : '';

            const eventMatch = eventVal.match(/(\d+)$/);
            if (eventMatch) eventVal = eventMatch[1];
            const heatMatch = heatVal.match(/(\d+)$/);
            if (heatMatch) heatVal = heatMatch[1];

            updateDisplay(eventVal, heatVal, timeVal);
        }
    }

    function updateDisplay(event, heat, time) {
        const eventChanged = event !== lastEvent;
        const heatChanged = heat !== lastHeat;
        eventDisplay.textContent = event;
        heatDisplay.textContent = heat;

        const flashCallback = (el) => {
            el.classList.remove('flash-update');
            void el.offsetWidth;
            el.classList.add('flash-update');
        };

        if (eventChanged) {
            flashCallback(eventDisplay.parentElement);
            lastEvent = event;
        }
        if (heatChanged) {
            flashCallback(heatDisplay.parentElement);
            lastHeat = heat;
        }

        if (time) {
            try {
                const date = new Date(time);
                if (!isNaN(date.getTime())) {
                    lastUpdatedDisplay.textContent = "Last Updated: " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                } else {
                    lastUpdatedDisplay.textContent = "Last Updated: " + time;
                }
            } catch (e) {
                lastUpdatedDisplay.textContent = "Last Updated: " + time;
            }
        }
    }

    // --- UI Interaction ---

    function showConfig() {
        configModal.classList.remove('hidden');
        if (sheetId) sheetIdInput.value = sheetId;
        wakelockCheckbox.checked = isWakelockEnabled;
        autoThemeCheckbox.checked = isAutoThemeEnabled;
        autoThemeStartInput.value = autoThemeStart;
        autoThemeEndInput.value = autoThemeEnd;
        toggleAutoThemeConfig();
    }

    function toggleAutoThemeConfig() {
        const configDiv = document.getElementById('auto-theme-config');
        if (autoThemeCheckbox.checked) {
            configDiv.style.opacity = "1";
            configDiv.style.pointerEvents = "auto";
        } else {
            configDiv.style.opacity = "0.5";
            configDiv.style.pointerEvents = "none";
        }
    }

    autoThemeCheckbox.addEventListener('change', toggleAutoThemeConfig);
    function hideConfig() { configModal.classList.add('hidden'); }
    configBtn.addEventListener('click', showConfig);
    closeModalBtn.addEventListener('click', hideConfig);
    themeBtn.addEventListener('click', toggleTheme);

    function toggleTheme() {
        if (isAutoThemeEnabled) {
            isAutoThemeEnabled = false;
            localStorage.setItem('swimMeetAutoTheme', 'false');
        }
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode', isDarkMode);
        localStorage.setItem('swimMeetDarkMode', isDarkMode);
    }

    function checkAutoTheme() {
        const hour = new Date().getHours();
        let shouldBeDark = false;
        if (autoThemeStart < autoThemeEnd) {
            shouldBeDark = hour >= autoThemeStart && hour < autoThemeEnd;
        } else {
            shouldBeDark = hour >= autoThemeStart || hour < autoThemeEnd;
        }
        if (isDarkMode !== shouldBeDark) {
            isDarkMode = shouldBeDark;
            document.body.classList.toggle('dark-mode', isDarkMode);
            localStorage.setItem('swimMeetDarkMode', isDarkMode);
        }
    }

    if (isTestMode) {
        window.swimApp = {
            updateDisplay: (e, h, t) => updateDisplay(e, h, t),
            toggleTheme: toggleTheme,
            element: { event: eventDisplay, heat: heatDisplay }
        };
    }

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    saveBtn.addEventListener('click', () => {
        const inputVal = sheetIdInput.value.trim();
        const newWakelockState = wakelockCheckbox.checked;
        if (newWakelockState !== isWakelockEnabled) {
            isWakelockEnabled = newWakelockState;
            localStorage.setItem('swimMeetWakelock', isWakelockEnabled);
            if (isWakelockEnabled) requestWakeLock();
            else releaseWakeLock();
        }

        const newAutoThemeState = autoThemeCheckbox.checked;
        if (newAutoThemeState !== isAutoThemeEnabled) {
            isAutoThemeEnabled = newAutoThemeState;
            localStorage.setItem('swimMeetAutoTheme', isAutoThemeEnabled);
        }

        const newStart = parseInt(autoThemeStartInput.value, 10);
        const newEnd = parseInt(autoThemeEndInput.value, 10);
        if (!isNaN(newStart) && !isNaN(newEnd)) {
            autoThemeStart = newStart;
            autoThemeEnd = newEnd;
            localStorage.setItem('swimMeetAutoThemeStart', autoThemeStart);
            localStorage.setItem('swimMeetAutoThemeEnd', autoThemeEnd);
        }

        if (isAutoThemeEnabled) checkAutoTheme();

        if (inputVal) {
            const match = inputVal.match(/\/d\/([a-zA-Z0-9-_]+)/);
            const idToSave = match ? match[1] : inputVal;
            sheetId = idToSave;
            localStorage.setItem('swimMeetSheetId', idToSave);
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('sheetId', idToSave);
            window.history.pushState({}, '', newUrl);
            hideConfig();
            startPolling();
            updateQRCode();
        }
    });

    function updateQRCode() {
        const qrContainer = document.getElementById('qrcode');
        if (!qrContainer) return;
        qrContainer.innerHTML = "";

        let shareUrl = window.location.href;
        if (teamId && sharedSecret) {
            const referrer = document.referrer;
            if (referrer && referrer.includes('script.google.com')) {
                shareUrl = referrer;
                localStorage.setItem('swimMeetRedirectorUrl', referrer);
            } else if (redirectorUrl) {
                shareUrl = redirectorUrl;
            }
        }

        try {
            qrcodeObj = new QRCode(qrContainer, {
                text: shareUrl,
                width: 256,
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        } catch (e) {
            console.error("QR Code Error:", e);
        }
    }

    async function requestWakeLock() {
        if (!isWakelockEnabled) return;
        try {
            if ('wakeLock' in navigator) {
                wakeLockSentinel = await navigator.wakeLock.request('screen');
            }
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
        }
    }

    function releaseWakeLock() {
        if (wakeLockSentinel) {
            wakeLockSentinel.release();
            wakeLockSentinel = null;
        }
    }
});
