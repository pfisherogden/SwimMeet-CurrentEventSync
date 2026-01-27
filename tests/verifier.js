(function () {
    console.log("Verifier: Initializing...");

    // Create UI Overlay
    const controls = document.createElement('div');
    controls.style.position = 'fixed';
    controls.style.bottom = '20px';
    controls.style.left = '20px';
    controls.style.width = '300px';
    controls.style.padding = '20px';
    controls.style.backgroundColor = '#f0f0f0';
    controls.style.border = '1px solid #ccc';
    controls.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
    controls.style.zIndex = '9999';
    controls.style.fontFamily = 'sans-serif';
    controls.style.display = 'flex';
    controls.style.flexDirection = 'column';
    controls.style.gap = '10px';

    controls.innerHTML = `
        <h3 style="margin: 0 0 10px 0;">UX Verifier</h3>
        <button id="btn-test1" style="padding: 8px; cursor: pointer;">Test 1: Dark Mode</button>
        <button id="btn-test2" style="padding: 8px; cursor: pointer;">Test 2: Heartbeat/Flash</button>
        <button id="btn-runall" style="padding: 8px; cursor: pointer;">Run All & Reset</button>
        <div id="test-status" style="margin-top: 10px; font-weight: bold;">Ready</div>
        <div id="test-log" style="font-size: 0.8rem; max-height: 100px; overflow-y: auto;"></div>
        <button id="btn-close" style="margin-top: 10px; padding: 5px; font-size: 0.8rem;">Close</button>
    `;

    document.body.appendChild(controls);

    // Elements
    const statusEl = document.getElementById('test-status');
    const logEl = document.getElementById('test-log');

    // Utils
    function log(msg) {
        const div = document.createElement('div');
        div.textContent = msg;
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
    }

    function setStatus(msg, type) {
        statusEl.textContent = msg;
        statusEl.style.color = type === 'pass' ? 'green' : (type === 'fail' ? 'red' : 'black');
    }

    async function wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // Tests
    async function runDarkModeTest() {
        setStatus("Running Dark Mode Test...", "normal");
        const app = window.swimApp;
        if (!app) {
            setStatus("Error: app not exposed (test=true?)", "fail");
            return;
        }

        const wasDark = document.body.classList.contains('dark-mode');

        // Toggle
        app.toggleTheme();
        await wait(500);

        const isDark = document.body.classList.contains('dark-mode');

        if (isDark !== !wasDark) {
            setStatus("FAIL: Theme did not toggle", "fail");
        } else {
            setStatus("PASS: Dark Mode Toggled", "pass");
        }
    }

    async function runHeartbeatTest() {
        setStatus("Running Heartbeat Test...", "normal");
        const app = window.swimApp;

        // Trigger update
        app.updateDisplay("Event 100", "Heat 5", "Now");

        // Check flash
        // Note: app.element.event is the value div, parent is the card
        const eventCard = app.element.event.parentElement;

        if (eventCard.classList.contains('flash-update')) {
            setStatus("PASS: Flash animation triggered", "pass");
        } else {
            // It might be too fast or sync?
            // The logic in app.js adds class, then forces reflow.
            // We can check if it has the class.
            setStatus("FAIL: No flash class found", "fail");
        }
        await wait(1000);
    }

    async function runFullDemo() {
        const app = window.swimApp;
        app.updateDisplay("--", "--", "");
        await wait(500);

        await runDarkModeTest();
        await wait(1000);
        await runDarkModeTest(); // Toggle back
        await wait(1000);
        await runHeartbeatTest();
    }

    // Bindings
    document.getElementById('btn-test1').addEventListener('click', runDarkModeTest);
    document.getElementById('btn-test2').addEventListener('click', runHeartbeatTest);
    document.getElementById('btn-runall').addEventListener('click', runFullDemo);
    document.getElementById('btn-close').addEventListener('click', () => {
        controls.style.display = 'none';
        // Cleanup URL?
    });

})();
