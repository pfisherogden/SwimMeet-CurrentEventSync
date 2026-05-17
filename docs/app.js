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
    // Check URL params first, then localStorage
    const urlParams = new URLSearchParams(window.location.search);

    // Inject Verifier/Test Harness if requested
    if (urlParams.get('verifier') === 'true') {
        const script = document.createElement('script');
        script.src = "../tests/verifier.js";
        document.body.appendChild(script);
    }

    const isTestMode = urlParams.get('test') === 'true' || urlParams.get('verifier') === 'true';
    const isOffline = urlParams.get('offline') === 'true' || urlParams.get('demo') === 'true';
    let sheetId = urlParams.get('sheetId') || localStorage.getItem('swimMeetSheetId');
    const meetName = urlParams.get('meetName'); // No fallback here, handled in display

    // REDIRECTOR PARAMS (for sharing the permanent link)
    const teamId = urlParams.get('team');
    const sharedSecret = urlParams.get('secret');
    const redirectorUrl = localStorage.getItem('swimMeetRedirectorUrl'); // Cached from previous redirect if possible

    // UX State
    let isAutoThemeEnabled = localStorage.getItem('swimMeetAutoTheme') !== 'false'; // Default to true
    let autoThemeStart = parseInt(localStorage.getItem('swimMeetAutoThemeStart') || '17', 10);
    let autoThemeEnd = parseInt(localStorage.getItem('swimMeetAutoThemeEnd') || '7', 10);
    let isDarkMode = localStorage.getItem('swimMeetDarkMode') === 'true';
    let isWakelockEnabled = localStorage.getItem('swimMeetWakelock') === 'true';
    let wakeLockSentinel = null;
    let lastEvent = null;
    let lastHeat = null;

    // Polling Interval (ms)
    const POLL_INTERVAL = 10000;
    let pollIntervalId;
    let qrcodeObj = null;

    // Initialization
    if (!sheetId && !isOffline) {
        updateDisplay("--", "--", "Setup Required");
        showConfig();
    } else {
        startPolling();
    }

    // Initialize QR Code (initially with current URL or redirector URL)
    updateQRCode();

    // Initialize Theme
    if (isAutoThemeEnabled) {
        checkAutoTheme();
    } else if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }

    // Initialize Wakelock (if enabled)
    if (isWakelockEnabled) {
        requestWakeLock();
    }

    // Handle Visibility Change for Wakelock Re-acquisition and Polling Optimization
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            console.log('Tab visible: Resuming polling');
            startPolling();
            if (wakeLockSentinel !== null) {
                await requestWakeLock();
            }
        } else {
            console.log('Tab hidden: Pausing polling');
            clearInterval(pollIntervalId);
            statusIndicator.style.opacity = "0.5";
            statusIndicator.title = "Paused (Inactive)";
        }
    });

    // --- Core Logic ---

    function startPolling() {
        if (!sheetId && !isOffline) return;

        statusIndicator.className = "status-indicator status-connecting";
        statusIndicator.title = isOffline ? "Offline Mode" : "Connecting...";

        if (isOffline) {
            statusIndicator.classList.remove('status-connecting');
            statusIndicator.classList.add('status-connected');
        }

        // Set header title
        const meetNameDisplay = document.getElementById('meet-name-display');
        meetNameDisplay.textContent = meetName || (isOffline ? "Offline Demo" : "Live");

        // Initial Fetch
        fetchData();

        pollIntervalId = setInterval(() => {
            fetchData();
            if (isAutoThemeEnabled) checkAutoTheme();
        }, POLL_INTERVAL);
    }

    async function fetchData() {
        try {
            if (isOffline) {
                if (window.MOCK_DATA) {
                    parseCSV(window.MOCK_DATA);
                    statusIndicator.className = "status-indicator status-connected";
                    statusIndicator.title = "Offline Mode";
                    statusIndicator.style.opacity = "1";
                } else {
                    console.error("MOCK_DATA not found in window object");
                }
                return;
            }

            const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&id=${sheetId}&gid=0&cacheBust=${Date.now()}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const text = await response.text();
            parseCSV(text);

            statusIndicator.className = "status-indicator status-connected";
            statusIndicator.title = "Connected";
            statusIndicator.style.opacity = "1";

        } catch (error) {
            console.error("Fetch error:", error);
            statusIndicator.className = "status-indicator status-error";
            statusIndicator.title = "Connection Failed";
            statusIndicator.style.opacity = "1";
        }
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

        // 🔗 SMART SHARING LOGIC
        // If we arrived via a redirector (team + secret present), 
        // we want the shared QR code to be the PERMANENT REDIRECT link,
        // not the temporary sheetId link.
        
        let shareUrl = window.location.href;
        
        // If we have team/secret in URL, we want to reconstruct the Redirector URL
        if (teamId && sharedSecret) {
            // The referrer is likely the redirector!
            // But to be safe, we can try to find where we came from.
            const referrer = document.referrer;
            if (referrer && referrer.includes('script.google.com')) {
                shareUrl = referrer;
                // Store it for future sessions that might lose referrer
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
