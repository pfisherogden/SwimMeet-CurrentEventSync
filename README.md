# SwimMeet-CurrentEventSync

For local swim meets, parents and swimmers need to know what the current event and heat are so that they can plan ahead and get to their events on time. This software monitors the Dolphin CTS 5.0 scoreboard software and syncs the data to a Google Spreadsheet, which is then displayed via a high-visibility mobile **Event Board**.

---

## 🚀 Quick Start (Automated Setup)

We have streamlined the setup process for new teams and meets.

### 1. Initial Setup
1.  **Authentication:** Follow the [Authentication Setup Guide](docs/AuthSetup.md) to create your own Google API credentials.
2.  **Install Dependencies:**
    ```bash
    just install
    ```

### 2. Create a New Meet
To create a new spreadsheet and deploy the receiver script in one command:
```bash
just setup "Summer Championships 2026" "dolphin"
```
The script will output your **Spreadsheet URL**, **Receiver URL**, and **Permanent Team URL**.

### 3. Setup the Broadcaster Client
To sync active events and heats to your Google Sheet:
*   **Automatic Scraper (Dolphin Timing Booth)**: Visit the [Download Hub](https://pfisherogden.github.io/SwimMeet-CurrentEventSync/download.html) to get the `DolphinScoreboardSync-Windows.zip`. Create a `config.json` file in the same folder as the EXE pointing to your `Receiver URL`, and run the EXE while Dolphin is active.
*   **Manual Controller (Web/Desktop)**: Download the desktop app (macOS DMG or Windows MSI) from the [Download Hub](https://pfisherogden.github.io/SwimMeet-CurrentEventSync/download.html) or run it directly in a mobile/tablet browser by launching the [Web Controller](https://pfisherogden.github.io/SwimMeet-CurrentEventSync/controller.html). For home screen installation and local file loading on iOS and Android devices, see the [Mobile PWA Installation Guide](docs/MobileInstallation.md). Read the [Scoreboard Controller Guide](docs/ScoreboardController.md) for detailed pacing logic rules.

---

## 🔗 Permanent QR Codes (Secure Redirector)

If you want a single QR code that lasts the whole season, use the **Secure Redirector**.
1.  Follow the [Redirector Management Guide](docs/RedirectorSetup.md).
2.  The `just setup` tool automatically creates a branded **`meet-qr.png`** pointing to your team's permanent link.

---

## 🛠 Maintenance & Testing

For developers or advanced users who want to run integration tests or modify the system:
- See the [Maintenance & Testing Guide](docs/Maintenance.md).

---

## 📖 Manual Setup (Legacy)

If you prefer to set everything up by hand, see the [Manual Setup Guide](docs/ManualSetup.md).

---

## License
MIT
