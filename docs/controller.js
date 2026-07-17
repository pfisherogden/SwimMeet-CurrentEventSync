// Scoreboard Controller App Logic

(function () {
    // Application State
    let state = {
        event: 1,
        heat: 1,
        eventsList: [], // Array of { num: number, desc: string, heats: number }
        config: {
            G_WEB_APP_URL: '',
            autoSync: true
        },
        isTauri: false,
        syncing: false
    };

    // DOM Elements
    const elements = {
        eventVal: document.getElementById('event-val'),
        heatVal: document.getElementById('heat-val'),
        eventDec: document.getElementById('event-dec'),
        eventInc: document.getElementById('event-inc'),
        heatDec: document.getElementById('heat-dec'),
        heatInc: document.getElementById('heat-inc'),
        activeEventTitle: document.getElementById('active-event-title'),
        activeEventHeats: document.getElementById('active-event-heats'),
        environmentIndicator: document.getElementById('environment-indicator'),
        syncStatusDot: document.getElementById('sync-status-dot'),
        syncStatusText: document.getElementById('sync-status-text'),
        headerConfigBtn: document.getElementById('header-config-btn'),
        configModal: document.getElementById('config-modal'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        webAppUrlInput: document.getElementById('web-app-url-input'),
        autoSyncCheckbox: document.getElementById('auto-sync-checkbox'),
        saveConfigBtn: document.getElementById('save-config-btn'),
        csvFileInput: document.getElementById('csv-file-input'),
        eventsListContainer: document.getElementById('events-list'),
        eventsCountBadge: document.getElementById('events-count-badge'),
        tabController: document.getElementById('tab-controller'),
        tabProgram: document.getElementById('tab-program')
    };

    // Detect Environment
    if (window.__TAURI__ && window.__TAURI__.core) {
        state.isTauri = true;
        elements.environmentIndicator.textContent = "Desktop Mode";
        elements.environmentIndicator.className = "text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-900/40 text-emerald-300 border border-emerald-800/40";
    }

    // Set active tab layout (on mobile/narrow screens)
    function setActiveTab(tabName) {
        state.activeTab = tabName;
        const controllerSec = document.getElementById('section-controller');
        const programSec = document.getElementById('section-program');
        const tabControllerBtn = document.getElementById('tab-controller');
        const tabProgramBtn = document.getElementById('tab-program');
        
        if (!controllerSec || !programSec || !tabControllerBtn || !tabProgramBtn) return;
        
        if (tabName === 'controller') {
            controllerSec.classList.remove('hidden');
            programSec.classList.add('hidden');
            
            tabControllerBtn.setAttribute('aria-selected', 'true');
            tabProgramBtn.setAttribute('aria-selected', 'false');
            
            tabControllerBtn.classList.add('bg-yellow-600', 'text-black', 'font-bold', 'active-tab');
            tabControllerBtn.classList.remove('text-gray-400', 'hover:text-gray-200', 'font-semibold');
            
            tabProgramBtn.classList.add('text-gray-400', 'hover:text-gray-200', 'font-semibold');
            tabProgramBtn.classList.remove('bg-yellow-600', 'text-black', 'font-bold', 'active-tab');
        } else {
            controllerSec.classList.add('hidden');
            programSec.classList.remove('hidden');
            
            tabControllerBtn.setAttribute('aria-selected', 'false');
            tabProgramBtn.setAttribute('aria-selected', 'true');
            
            tabProgramBtn.classList.add('bg-yellow-600', 'text-black', 'font-bold', 'active-tab');
            tabProgramBtn.classList.remove('text-gray-400', 'hover:text-gray-200', 'font-semibold');
            
            tabControllerBtn.classList.add('text-gray-400', 'hover:text-gray-200', 'font-semibold');
            tabControllerBtn.classList.remove('bg-yellow-600', 'text-black', 'font-bold', 'active-tab');
        }
    }

    // Initialize Application
    async function init() {
        setActiveTab('controller');
        setupEventListeners();
        loadLocalSettings();
        
        if (state.isTauri) {
            await initTauriEnvironment();
        }
        
        updateUI();
    }

    // Load settings from localStorage (Web fallback)
    function loadLocalSettings() {
        try {
            const savedUrl = localStorage.getItem('G_WEB_APP_URL');
            const savedAutoSync = localStorage.getItem('autoSync');
            
            if (savedUrl) state.config.G_WEB_APP_URL = savedUrl;
            if (savedAutoSync !== null) state.config.autoSync = savedAutoSync === 'true';
            
            // Also attempt to restore last event/heat state
            const savedEvent = localStorage.getItem('currentEvent');
            const savedHeat = localStorage.getItem('currentHeat');
            if (savedEvent) state.event = parseInt(savedEvent, 10);
            if (savedHeat) state.heat = parseInt(savedHeat, 10);

            // Restore cached event list if present
            const savedEventsList = localStorage.getItem('eventsList');
            if (savedEventsList) {
                state.eventsList = JSON.parse(savedEventsList);
                renderEventsList();
            }

            // Load Outdoor Mode settings
            const savedOutdoor = localStorage.getItem('outdoorMode') === 'true';
            if (savedOutdoor) {
                document.body.classList.add('outdoor-mode');
                const btn = document.getElementById('outdoor-mode-btn');
                if (btn) {
                    btn.textContent = '🌑 Normal Mode';
                    btn.classList.add('bg-white', 'text-black', 'border-black');
                    btn.classList.remove('text-gray-300', 'border-gray-700');
                }
            }
        } catch (e) {
            console.error("Failed to load local storage configurations", e);
        }
    }

    // Initialize Tauri commands
    async function initTauriEnvironment() {
        try {
            const tauri = window.__TAURI__;
            
            // 1. Load config from disk via Tauri backend
            const configJson = await tauri.core.invoke('load_config');
            if (configJson && configJson.G_WEB_APP_URL) {
                state.config.G_WEB_APP_URL = configJson.G_WEB_APP_URL;
                if (configJson.autoSync !== undefined) state.config.autoSync = configJson.autoSync;
            }
            
            // 2. Load events.csv from disk via Tauri backend
            const eventsCsv = await tauri.core.invoke('load_events_csv');
            if (eventsCsv) {
                parseAndSetEvents(eventsCsv);
            }
        } catch (e) {
            console.error("Tauri initialization error", e);
        }
    }

    // Setup DOM Listeners
    function setupEventListeners() {
        // Manual and sequence-aware increment/decrement buttons
        elements.eventDec.addEventListener('click', () => stepEvent(-1));
        elements.eventInc.addEventListener('click', () => stepEvent(1));
        elements.heatDec.addEventListener('click', () => stepHeat(-1));
        elements.heatInc.addEventListener('click', () => stepHeat(1));

        // Configuration Modal
        elements.headerConfigBtn.addEventListener('click', openConfigModal);
        elements.closeModalBtn.addEventListener('click', closeConfigModal);
        elements.saveConfigBtn.addEventListener('click', saveConfiguration);

        const testConfigBtn = document.getElementById('test-config-btn');
        if (testConfigBtn) {
            testConfigBtn.addEventListener('click', testWebAppConnection);
        }

        // CSV File Loading (Web Mode)
        elements.csvFileInput.addEventListener('change', handleWebCsvUpload);

        // Tab Navigation
        if (elements.tabController && elements.tabProgram) {
            elements.tabController.addEventListener('click', () => setActiveTab('controller'));
            elements.tabProgram.addEventListener('click', () => setActiveTab('program'));
        }

        // Keyboard shortcuts (Alt+1 / Alt+2)
        window.addEventListener('keydown', (e) => {
            if (e.altKey && e.key === '1') {
                e.preventDefault();
                setActiveTab('controller');
            } else if (e.altKey && e.key === '2') {
                e.preventDefault();
                setActiveTab('program');
            }
        });

        // Outdoor Mode Toggle
        const outdoorBtn = document.getElementById('outdoor-mode-btn');
        if (outdoorBtn) {
            outdoorBtn.addEventListener('click', toggleOutdoorMode);
        }
    }

    // State Adjustments
    function adjustEvent(delta) {
        let newEvent = state.event + delta;
        if (newEvent < 1) newEvent = 1;
        
        // If we have an active events list, bound it
        if (state.eventsList.length > 0) {
            const maxEventNum = Math.max(...state.eventsList.map(e => e.num));
            if (newEvent > maxEventNum) newEvent = maxEventNum;
        }

        if (newEvent !== state.event) {
            state.event = newEvent;
            // Reset heat to 1 when changing event manually
            state.heat = 1;
            onStateChanged();
        }
    }

    // Adjust Heat manually
    function adjustHeat(delta) {
        let newHeat = state.heat + delta;
        if (newHeat < 1) newHeat = 1;

        // If we have an active events list, check maximum heat for this event
        if (state.eventsList.length > 0) {
            const activeEvent = state.eventsList.find(e => e.num === state.event);
            if (activeEvent && newHeat > activeEvent.heats) {
                newHeat = activeEvent.heats;
            }
        }

        if (newHeat !== state.heat) {
            state.heat = newHeat;
            onStateChanged();
        }
    }

    // Step sequence (auto-advance/rewind event+heat)
    function stepHeat(direction) {
        if (state.eventsList.length === 0) {
            // No CSV loaded, standard basic increment/decrement
            adjustHeat(direction);
            return;
        }

        // Find current event index in list
        const currentIdx = state.eventsList.findIndex(e => e.num === state.event);
        if (currentIdx === -1) {
            adjustHeat(direction);
            return;
        }

        const currentEvent = state.eventsList[currentIdx];
        let newHeat = state.heat + direction;

        if (direction > 0) {
            // Advancing
            if (newHeat > currentEvent.heats) {
                // Move to next event, heat 1
                if (currentIdx + 1 < state.eventsList.length) {
                    state.event = state.eventsList[currentIdx + 1].num;
                    state.heat = 1;
                    onStateChanged();
                }
            } else {
                state.heat = newHeat;
                onStateChanged();
            }
        } else {
            // Rewinding
            if (newHeat < 1) {
                // Move to previous event, max heat
                if (currentIdx - 1 >= 0) {
                    const prevEvent = state.eventsList[currentIdx - 1];
                    state.event = prevEvent.num;
                    state.heat = prevEvent.heats;
                    onStateChanged();
                }
            } else {
                state.heat = newHeat;
                onStateChanged();
            }
        }
    }

    // Step event sequence (jump directly to previous/next event in schedule)
    function stepEvent(direction) {
        if (state.eventsList.length === 0) {
            adjustEvent(direction);
            return;
        }

        const currentIdx = state.eventsList.findIndex(e => e.num === state.event);
        if (currentIdx === -1) {
            adjustEvent(direction);
            return;
        }

        let newIdx = currentIdx + direction;
        if (newIdx >= 0 && newIdx < state.eventsList.length) {
            state.event = state.eventsList[newIdx].num;
            state.heat = 1;
            onStateChanged();
        }
    }

    // Handles what happens when event/heat changes
    function onStateChanged() {
        try {
            localStorage.setItem('currentEvent', state.event);
            localStorage.setItem('currentHeat', state.heat);
        } catch (e) {}

        updateUI();

        if (state.config.autoSync) {
            syncToGoogleSheets();
        }
    }

    // Update UI elements based on state
    function updateUI() {
        elements.eventVal.textContent = state.event;
        elements.heatVal.textContent = state.heat;

        // Update active event info banner
        if (state.eventsList.length > 0) {
            const currentEvent = state.eventsList.find(e => e.num === state.event);
            if (currentEvent) {
                elements.activeEventTitle.textContent = `Event ${currentEvent.num}: ${currentEvent.desc}`;
                elements.activeEventHeats.textContent = `Active Heat ${state.heat} of ${currentEvent.heats} Heats`;
            } else {
                elements.activeEventTitle.textContent = `Event ${state.event} (Not in schedule)`;
                elements.activeEventHeats.textContent = `Active Heat ${state.heat} (Manual override)`;
            }
        } else {
            elements.activeEventTitle.textContent = "No Meet Program Loaded";
            elements.activeEventHeats.textContent = "Manual Event & Heat adjustment mode";
        }

        // Highlight selected event in flow list
        document.querySelectorAll('.event-list-item').forEach(el => {
            const evNum = parseInt(el.getAttribute('data-event-num'), 10);
            if (evNum === state.event) {
                el.classList.add('border-[var(--neon-gold)]', 'bg-[var(--card-dark)]/80');
                el.classList.remove('border-transparent');
                // Scroll item into view smoothly
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                el.classList.remove('border-[var(--neon-gold)]', 'bg-[var(--card-dark)]/80');
                el.classList.add('border-transparent');
            }
        });
    }

    // Parse and set event list from CSV content
    function parseAndSetEvents(csvText) {
        try {
            const lines = csvText.split(/\r?\n/);
            const list = [];
            
            for (let line of lines) {
                line = line.trim();
                if (!line) continue;
                
                // Expected format: num,desc,heats,1,A
                const parts = line.split(',');
                if (parts.length >= 3) {
                    const num = parseInt(parts[0], 10);
                    const desc = parts[1].replace(/"/g, '').trim();
                    const heats = parseInt(parts[2], 10);
                    
                    if (!isNaN(num) && !isNaN(heats)) {
                        list.push({ num, desc, heats });
                    }
                }
            }

            if (list.length > 0) {
                state.eventsList = list;
                try {
                    localStorage.setItem('eventsList', JSON.stringify(list));
                } catch (e) {}
                
                renderEventsList();
                
                // If current event is not in list, jump to the first event in the list
                const eventExists = state.eventsList.some(e => e.num === state.event);
                if (!eventExists) {
                    state.event = state.eventsList[0].num;
                    state.heat = 1;
                }
                
                onStateChanged();
                showToast(`Successfully loaded ${list.length} events!`, "success");
            }
        } catch (e) {
            showToast("Failed to parse events.csv: " + e.message, "error");
        }
    }

    // Render event program list on the right
    function renderEventsList() {
        elements.eventsListContainer.innerHTML = '';
        elements.eventsCountBadge.textContent = `${state.eventsList.length} Events`;
        elements.eventsCountBadge.classList.remove('hidden');

        state.eventsList.forEach(ev => {
            const item = document.createElement('div');
            item.className = 'event-list-item glass-card p-3 border-2 border-transparent transition cursor-pointer flex justify-between items-center gap-3 hover:border-gray-700 select-none';
            item.setAttribute('data-event-num', ev.num);
            item.innerHTML = `
                <div class="truncate pr-2">
                    <div class="text-xs font-bold text-[var(--neon-gold)]">EVENT ${ev.num}</div>
                    <div class="text-xs text-gray-300 font-semibold truncate uppercase mt-0.5">${ev.desc}</div>
                </div>
                <div class="text-right flex-shrink-0">
                    <span class="text-[10px] px-2 py-0.5 bg-gray-900 border border-gray-800 rounded font-bold text-gray-400 uppercase tracking-wider">${ev.heats} Heats</span>
                </div>
            `;
            
            item.addEventListener('click', () => {
                state.event = ev.num;
                state.heat = 1;
                onStateChanged();
            });
            
            elements.eventsListContainer.appendChild(item);
        });
    }

    // Web CSV loading handler
    function handleWebCsvUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
            parseAndSetEvents(evt.target.result);
        };
        reader.readAsText(file, 'cp1252'); // MeetManager CSV uses cp1252 encoding usually
    }

    // Settings Modal controls
    function openConfigModal() {
        elements.webAppUrlInput.value = state.config.G_WEB_APP_URL || '';
        elements.autoSyncCheckbox.checked = state.config.autoSync;
        elements.configModal.classList.remove('hidden');
    }

    // Close Settings Modal
    function closeConfigModal() {
        elements.configModal.classList.add('hidden');
    }

    // Save and validate configurations
    function saveConfiguration() {
        const url = elements.webAppUrlInput.value.trim();
        const auto = elements.autoSyncCheckbox.checked;

        // Validate URL format for Google Apps Script Web App
        if (url && !url.match(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/)) {
            showToast("Invalid URL! Must be a deployed Google Sheets Apps Script Web App URL.", "error");
            return;
        }

        state.config.G_WEB_APP_URL = url;
        state.config.autoSync = auto;

        try {
            localStorage.setItem('G_WEB_APP_URL', url);
            localStorage.setItem('autoSync', auto);
        } catch (e) {}

        // If Tauri, sync configuration to disk
        if (state.isTauri) {
            try {
                window.__TAURI__.core.invoke('save_config', { 
                    config: { G_WEB_APP_URL: url, autoSync: auto } 
                });
            } catch (e) {
                console.error("Failed to save Tauri config", e);
            }
        }

        closeConfigModal();
        updateUI();
        
        // Force immediate sync
        syncToGoogleSheets();
    }

    // Submit sync values to sheets
    async function syncToGoogleSheets() {
        const url = state.config.G_WEB_APP_URL;
        if (!url || url === 'PASTE_YOUR_URL_HERE') {
            elements.syncStatusDot.className = "w-4 h-4 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]";
            elements.syncStatusText.textContent = "URL Unconfigured";
            return;
        }

        state.syncing = true;
        elements.syncStatusDot.className = "w-4 h-4 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)] syncing-pulse";
        elements.syncStatusText.textContent = "Syncing...";

        const eventStr = `Event: ${state.event}`;
        const heatStr = `Heat: ${state.heat}`;
        const payload = JSON.stringify({ event: eventStr, heat: heatStr });

        try {
            if (state.isTauri) {
                // Use Tauri native command to make post request bypasses CORS entirely
                const resText = await window.__TAURI__.core.invoke('publish_status', { 
                    url: url, 
                    payload: payload 
                });
                const res = JSON.parse(resText);
                if (res.status === 'success') {
                    setSyncSuccess();
                } else {
                    setSyncError(res.message || "Failed");
                }
            } else {
                // Standard cross-origin fetch with no-cors.
                // mode: 'no-cors' allows sending POST requests to script.google.com without preflight blocks.
                await fetch(url, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: payload
                });
                
                // Opaque response, assume success if no networking error thrown
                setSyncSuccess();
            }
        } catch (err) {
            setSyncError(err.message || "Network Error");
        } finally {
            state.syncing = false;
        }
    }

    function setSyncSuccess() {
        elements.syncStatusDot.className = "w-4 h-4 rounded-full bg-[var(--neon-green)] shadow-[0_0_8px_rgba(57,255,20,0.5)]";
        elements.syncStatusText.textContent = "Synced";
        flashValueCards('success');
    }

    function setSyncError(message) {
        elements.syncStatusDot.className = "w-4 h-4 rounded-full bg-[var(--neon-red)] shadow-[0_0_8px_rgba(255,51,51,0.5)]";
        elements.syncStatusText.textContent = "Sync Fail: " + message;
        flashValueCards('error');
        showToast("Sync failed: " + message, "error");
    }

    // Toggle Outdoor High-Contrast Mode
    function toggleOutdoorMode() {
        const body = document.body;
        const btn = document.getElementById('outdoor-mode-btn');
        if (!btn) return;
        
        body.classList.toggle('outdoor-mode');
        const isOutdoor = body.classList.contains('outdoor-mode');
        localStorage.setItem('outdoorMode', isOutdoor);
        
        if (isOutdoor) {
            btn.textContent = '🌑 Normal Mode';
            btn.classList.add('bg-white', 'text-black', 'border-black');
            btn.classList.remove('text-gray-300', 'border-gray-700');
        } else {
            btn.textContent = '☀️ Outdoor Mode';
            btn.classList.remove('bg-white', 'text-black', 'border-black');
            btn.classList.add('text-gray-300', 'border-gray-700');
        }
    }

    // Validate and test Apps Script endpoint connection
    async function testWebAppConnection() {
        const url = elements.webAppUrlInput.value.trim();
        if (!url) {
            showToast("Please enter a URL first", "error");
            return;
        }
        
        if (!url.match(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/)) {
            showToast("Invalid URL format!", "error");
            return;
        }
        
        const testBtn = document.getElementById('test-config-btn');
        const originalText = testBtn.textContent;
        testBtn.textContent = "Testing...";
        testBtn.disabled = true;

        try {
            // Send an opaque GET request as validation
            await fetch(url, { method: 'GET', mode: 'no-cors' });
            showToast("Test connection request transmitted successfully!", "success");
        } catch (err) {
            showToast("Connection test failed: " + err.message, "error");
        } finally {
            testBtn.textContent = originalText;
            testBtn.disabled = false;
        }
    }

    // Show non-blocking notifications
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        
        // Accessibility attributes
        toast.tabIndex = 0;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
        toast.setAttribute('aria-label', `${type === 'error' ? 'Error' : 'Notification'}: ${message}. Press Enter or Space to dismiss.`);

        toast.className = `toast-slide-in px-4 py-3 rounded-xl border font-semibold text-sm shadow-2xl flex items-center gap-2 pointer-events-auto cursor-pointer select-none hover:opacity-90 active:scale-95 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition duration-150 ease-in-out ${
            type === 'success' ? 'bg-green-950/90 text-green-300 border-green-800/80' :
            type === 'error' ? 'bg-red-950/90 text-red-300 border-red-800/80' :
            'bg-gray-900/90 text-gray-200 border-gray-800'
        }`;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        
        container.appendChild(toast);
        
        let dismissTimeout = null;

        const dismiss = () => {
            if (dismissTimeout) clearTimeout(dismissTimeout);
            toast.style.pointerEvents = 'none'; // Prevent double interactions
            toast.classList.add('opacity-0', 'scale-95');
            toast.addEventListener('transitionend', () => toast.remove());
        };

        // Auto-dismiss ONLY for success/info; error notifications are persistent
        if (type !== 'error') {
            dismissTimeout = setTimeout(dismiss, 3500);
        }

        // Mouse and touch dismiss
        toast.addEventListener('click', dismiss);

        // Keyboard dismiss (Enter / Space)
        toast.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dismiss();
            }
        });
    }

    // Flash visual feedback on large value display containers
    function flashValueCards(type) {
        const valCards = document.querySelectorAll('#event-val, #heat-val');
        valCards.forEach(card => {
            const container = card.closest('div');
            if (container) {
                if (type === 'success') {
                    container.classList.add('border-green-500', 'shadow-[0_0_15px_rgba(34,197,94,0.4)]');
                    container.classList.remove('border-gray-800');
                    setTimeout(() => {
                        container.classList.remove('border-green-500', 'shadow-[0_0_15px_rgba(34,197,94,0.4)]');
                        container.classList.add('border-gray-800');
                    }, 800);
                } else {
                    container.classList.add('border-red-500', 'shadow-[0_0_15px_rgba(239,68,68,0.4)]');
                    container.classList.remove('border-gray-800');
                    setTimeout(() => {
                        container.classList.remove('border-red-500', 'shadow-[0_0_15px_rgba(239,68,68,0.4)]');
                        container.classList.add('border-gray-800');
                    }, 1200);
                }
            }
        });
    }

    // Run on startup
    window.addEventListener('DOMContentLoaded', init);

})();
