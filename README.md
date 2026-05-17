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

### 3. Setup the Windows Client (Scoreboard Computer)
1.  Go to the [Releases](https://github.com/pfisherogden/SwimMeet-CurrentEventSync/releases) tab and download the latest `DolphinScoreboardSync.exe`.
2.  Create a `config.json` file in the same folder as the EXE:
    ```json
    {
      "G_WEB_APP_URL": "YOUR_RECEIVER_URL_FROM_STEP_2"
    }
    ```
3.  Run the EXE while the Dolphin software is active.

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
