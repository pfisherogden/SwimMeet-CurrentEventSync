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
    // Poll faster in offline mode for demo purposes, or keep same? Keep same for now.
    const POLL_INTERVAL = 10000;
    let pollIntervalId;
    let qrcodeObj = null;

    // Initialization
    // If offline, we don't need a sheet ID to start
    if (!sheetId && !isOffline) {
        // Show demo data so the screen isn't empty behind the modal
        updateDisplay("--", "--", "Setup Required");
        showConfig();
    } else {
        startPolling();
    }

    // Initialize QR Code (initially with current URL)
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

    // Handle Visibility Change for Wakelock Re-acquisition
    // Handle Visibility Change for Wakelock Re-acquisition and Polling Optimization
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            // Resume polling immediately
            console.log('Tab visible: Resuming polling');
            startPolling();

            // Re-acquire Wake Lock if it was active
            if (wakeLockSentinel !== null) {
                await requestWakeLock();
            }
        } else {
            // Pause polling to save resources
            console.log('Tab hidden: Pausing polling');
            clearInterval(pollIntervalId);

            // Visual indication (though user won't see it until they come back potentially, 
            // but helpful if they have side-by-side windows)
            // Visual indication (though user won't see it until they come back potentially, 
            // but helpful if they have side-by-side windows)
            // Keep the last known state or show partial dimmed? 
            // Let's just dim it.
            statusIndicator.style.opacity = "0.5";
            statusIndicator.title = "Paused (Inactive)";
        }
    });

    // --- Core Logic ---

    function startPolling() {
        if (!sheetId && !isOffline) return;

        // Don't show "Live" in status indicator, show name in center
        // Don't show "Live" in status indicator, show name in center
        statusIndicator.className = "status-indicator status-connecting";
        statusIndicator.title = isOffline ? "Offline Mode" : "Connecting...";

        if (isOffline) {
            statusIndicator.classList.remove('status-connecting');
            statusIndicator.classList.add('status-connected'); // Consider offline as connected/ready
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

            // Note: cache-busting parameter added to prevent browser caching
            // Using the "gviz" URL which often returns JSON, but we can also use the export=csv format.
            // Let's use the export format as it's cleaner for raw text parsing.
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
        // Simple CSV parser assuming standard format (headers row 1, data row 2)
        // A2 is Event, B2 is Heat, C2 is Last Updated

        const lines = csvText.split('\n');
        if (lines.length < 2) return;

        // Get the second row (index 1)
        // Handle potential quotes in CSV if Sheet adds them, but for simple numbers it's usually fine to split by comma
        // A robust regex split is better but let's try simple comma first for generated numbers.
        const header = lines[0].split(',');
        const dataRow = lines[1];

        // Regex to handle CSV correctly (ignoring commas inside quotes)
        // Fixed regex to allow spaces in unquoted fields: removed \s from exclusion class
        const matches = dataRow.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        // Fallback for simple splitting if regex fails or data is simple
        const columns = matches.length > 0 ? matches.map(s => s.replace(/^"|"$/g, '')) : dataRow.split(',');

        if (columns.length >= 2) {
            let eventVal = columns[0].trim();
            let heatVal = columns[1].trim();
            const timeVal = columns[2] ? columns[2].trim() : '';

            // Extract last sequence of digits if present (e.g., "Event 99" -> "99")
            const eventMatch = eventVal.match(/(\d+)$/);
            if (eventMatch) eventVal = eventMatch[1];

            const heatMatch = heatVal.match(/(\d+)$/);
            if (heatMatch) heatVal = heatMatch[1];

            updateDisplay(eventVal, heatVal, timeVal);
        }
    }

    function updateDisplay(event, heat, time) {
        // Only trigger animation/update if changed can be nice, but simple replacement works.
        const eventChanged = event !== lastEvent;
        const heatChanged = heat !== lastHeat;

        eventDisplay.textContent = event;
        heatDisplay.textContent = heat;

        // Flash animation
        const flashCallback = (el) => {
            el.classList.remove('flash-update');
            void el.offsetWidth; // trigger reflow
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
            // Try to make time friendly? Or just raw string.
            // Raw string is usually full date time. Let's just show time part if possible.
            // "2024-01-20T10:00:00.000Z" -> extract time
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

        // Simple toggle for inputs based on checkbox
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

    function hideConfig() {
        configModal.classList.add('hidden');
    }

    configBtn.addEventListener('click', showConfig);
    closeModalBtn.addEventListener('click', hideConfig);

    // Theme Toggle
    themeBtn.addEventListener('click', toggleTheme);

    function toggleTheme() {
        // manual toggle disables auto mode
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
            // Example: Start 8am, End 5pm (Daytime mode inverted? Or just range)
            // If range is within same day
            shouldBeDark = hour >= autoThemeStart && hour < autoThemeEnd;
        } else {
            // Example: Start 17 (5pm), End 7 (7am) (Overnight)
            shouldBeDark = hour >= autoThemeStart || hour < autoThemeEnd;
        }

        if (isDarkMode !== shouldBeDark) {
            isDarkMode = shouldBeDark;
            document.body.classList.toggle('dark-mode', isDarkMode);
            localStorage.setItem('swimMeetDarkMode', isDarkMode);
        }
    }

    // Expose for testing
    if (isTestMode) {
        window.swimApp = {
            updateDisplay: (e, h, t) => updateDisplay(e, h, t),
            toggleTheme: toggleTheme,
            element: {
                event: eventDisplay,
                heat: heatDisplay
            }
        };
    }

    // Fullscreen Toggle
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

        // Save Wakelock setting
        const newWakelockState = wakelockCheckbox.checked;
        if (newWakelockState !== isWakelockEnabled) {
            isWakelockEnabled = newWakelockState;
            localStorage.setItem('swimMeetWakelock', isWakelockEnabled);
            if (isWakelockEnabled) requestWakeLock();
            else releaseWakeLock();
        }

        // Save Auto Theme setting
        const newAutoThemeState = autoThemeCheckbox.checked;
        if (newAutoThemeState !== isAutoThemeEnabled) {
            isAutoThemeEnabled = newAutoThemeState;
            localStorage.setItem('swimMeetAutoTheme', isAutoThemeEnabled);
        }

        // Save Custom Times
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
            // Extract ID if they pasted a full URL
            // patterns: /d/([a-zA-Z0-9-_]+)/
            const match = inputVal.match(/\/d\/([a-zA-Z0-9-_]+)/);
            const idToSave = match ? match[1] : inputVal;

            sheetId = idToSave;
            localStorage.setItem('swimMeetSheetId', idToSave);

            // Update URL to include it for sharing (without reloading page if possible, or reload)
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

        // Clear previous
        qrContainer.innerHTML = "";

        // Calculate appropriate size.
        // We want it large enough to scan but fitting in the card.
        // Since the card is flex, we might need to be careful.
        // Let's pick a reasonable fixed size for the canvas, and let CSS scale it down.
        // 256 is good quality.

        const currentUrl = window.location.href;

        try {
            // Using global QRCode from script
            qrcodeObj = new QRCode(qrContainer, {
                text: currentUrl,
                width: 256,
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            // Note: QRCode.js might throw if container invalid, handled by try-catch
        } catch (e) {
            console.error("QR Code Error:", e);
        }
    }
    async function requestWakeLock() {
        if (!isWakelockEnabled) return;
        try {
            if ('wakeLock' in navigator) {
                wakeLockSentinel = await navigator.wakeLock.request('screen');
                console.log('Wake Lock active');
                wakeLockSentinel.addEventListener('release', () => {
                    console.log('Wake Lock released');
                });
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
