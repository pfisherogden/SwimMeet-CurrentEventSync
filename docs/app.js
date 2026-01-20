document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const eventDisplay = document.getElementById('event-display');
    const heatDisplay = document.getElementById('heat-display');
    const lastUpdatedDisplay = document.getElementById('last-updated');
    const statusIndicator = document.getElementById('connection-status');
    const configBtn = document.getElementById('config-btn');
    const configModal = document.getElementById('config-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const saveBtn = document.getElementById('save-btn');
    const sheetIdInput = document.getElementById('sheet-id-input');

    // State
    // Check URL params first, then localStorage
    const urlParams = new URLSearchParams(window.location.search);
    let sheetId = urlParams.get('sheetId') || localStorage.getItem('swimMeetSheetId');
    const meetName = urlParams.get('meetName'); // No fallback here, handled in display

    // Polling Interval (ms)
    const POLL_INTERVAL = 10000;
    let pollIntervalId;
    let qrcodeObj = null;

    // Initialization
    if (!sheetId) {
        // Show demo data so the screen isn't empty behind the modal
        updateDisplay("--", "--", "Setup Required");
        showConfig();
    } else {
        startPolling();
    }

    // Initialize QR Code (initially with current URL)
    updateQRCode();

    // --- Core Logic ---

    function startPolling() {
        if (!sheetId) return;

        if (!sheetId) return;

        // Don't show "Live" in status indicator, show name in center
        statusIndicator.textContent = "Connecting...";
        statusIndicator.style.color = "black";

        // Set header title
        const meetNameDisplay = document.getElementById('meet-name-display');
        meetNameDisplay.textContent = meetName || "Live";

        // Initial Fetch
        fetchData();

        // Interval
        clearInterval(pollIntervalId);
        pollIntervalId = setInterval(fetchData, POLL_INTERVAL);
    }

    async function fetchData() {
        try {
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

            statusIndicator.textContent = ""; // Clear status when live (title shows "Live")
            statusIndicator.style.opacity = "1";

        } catch (error) {
            console.error("Fetch error:", error);
            statusIndicator.textContent = "OFFLINE";
            statusIndicator.style.opacity = "0.5";
            // Optional: flash error color
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
        const matches = dataRow.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        // Fallback for simple splitting if regex fails or data is simple
        const columns = matches.length > 0 ? matches.map(s => s.replace(/^"|"$/g, '')) : dataRow.split(',');

        if (columns.length >= 2) {
            const eventVal = columns[0].trim();
            const heatVal = columns[1].trim();
            const timeVal = columns[2] ? columns[2].trim() : '';

            updateDisplay(eventVal, heatVal, timeVal);
        }
    }

    function updateDisplay(event, heat, time) {
        // Only trigger animation/update if changed can be nice, but simple replacement works.
        eventDisplay.textContent = event;
        heatDisplay.textContent = heat;

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
    }

    function hideConfig() {
        configModal.classList.add('hidden');
    }

    configBtn.addEventListener('click', showConfig);
    closeModalBtn.addEventListener('click', hideConfig);

    saveBtn.addEventListener('click', () => {
        const inputVal = sheetIdInput.value.trim();
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
});
