# Scoreboard Event & Heat Controller Guide

The **Scoreboard Event & Heat Controller** provides a premium, responsive visual interface to manually update the current event and heat of a swim meet, syncing the state directly with your Google Sheets backend. 

Use this app when:
1. The swim meet is not using Colorado Timing Systems Dolphin timers (meaning the automatic `DolphinScoreboardSync.ahk` scraper cannot be used).
2. You want manual control over the active event/heat scoreboard pacing from a phone, tablet, or secondary Windows computer at the pool.

---

## 🌐 Web Mode

The controller is hosted statically as a web application via GitHub Pages.

### How to Access
Open the following URL in any browser (works on iPhones, iPads, Android devices, and laptops):
👉 `https://pfisherogden.github.io/SwimMeet-CurrentEventSync/controller.html`

### Steps to Use:
1.  **Configure URL**: Tap the gear icon (⚙️) to open the configuration modal. Paste your Google Sheets Web App URL (the `Receiver URL` printed during `just setup`) and click **Save Config**.
2.  **Load Meet Schedule (Optional)**:
    *   Generate the `events.csv` file from Meet Manager.
    *   Click **📁 Load CSV** at the top right of the screen.
    *   Select your `events.csv`. The list on the right will populate with the meet's event list, descriptions, and heat counts.
3.  **Manage Scoreboard**:
    *   **Manual**: Tap the `+` or `-` buttons to set any event or heat number.
    *   **Sequenced**: Click **Next Heat** or **Prev Heat** to step through the meet.
    *   **Jump to Event**: Click any event in the right-hand panel list to jump directly to it.

---

## 💻 Desktop Mode (Windows & macOS)

The desktop application packages the controller as a native, lightweight executable (`.msi` for Windows, `.dmg`/`.app` for macOS).

### Benefits:
- **Zero-click CSV Loading**: Automatically reads `events.csv` on launch if placed in the same folder as the app.
- **Offline Configuration**: Automatically reads `config.json` next to the app to set the Google Sheets Web App URL.
- **No CORS Constraints**: Bypasses browser security locks using a native Rust HTTP sync client.

### Steps to Use:
1.  Download the latest installer from the **[Releases](https://github.com/pfisherogden/SwimMeet-CurrentEventSync/releases)** page.
2.  Place your `events.csv` (meet schedule) and `config.json` (configured with `G_WEB_APP_URL`) in the same directory as the executable.
3.  Launch the application. It will load the schedule and connect to your Google Sheet automatically.

---

## ⚡ Scoreboard Sequence Rules

When a meet schedule (`events.csv`) is active:
*   **Auto-Advance (Next Heat)**: Tapping **Next Heat** increments the active heat. If the heat number exceeds the total heats defined for that event, it automatically advances the active event by one and resets the heat count back to `1`.
*   **Auto-Rewind (Prev Heat)**: Tapping **Prev Heat** decrements the active heat. If the heat number drops below `1`, it backtracks to the previous event in the schedule and sets the active heat to that event's maximum heat count.
*   **Event Skipping**: Tapping **Next Event** or **Prev Event** jumps the controller to the start (Heat 1) of the adjacent event.

---

## 🟢 Sync Status Indicator

*   **Grey/Yellow (Not Synced)**: The Web App URL is not yet configured or is unverified.
*   **Flashing Gold (Syncing...)**: Pushing the active event/heat number to the Google Sheet.
*   **Neon Green (Synced)**: The Google Sheet was successfully updated (updated in under 200ms).
*   **Neon Red (Sync Fail)**: An error occurred (e.g., loss of internet connection, or invalid Web App URL).
