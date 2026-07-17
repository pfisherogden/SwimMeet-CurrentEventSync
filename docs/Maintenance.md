# Project Maintenance & Testing Guide

This document explains how to maintain the Swim Meet Event Sync system and verify its functionality using the built-in test suite.

## 🛠 Prerequisites

Ensure you have the following installed on your machine:
1. **Node.js** (v20+)
2. **uv** (Python/Project manager)
3. **just** (Command runner)
4. **Google Cloud CLI** (Authenticated via `gcloud auth application-default login`)

## 🧪 Running Integration Tests

The integration test suite verifies the end-to-end flow: creating a spreadsheet, initializing headers, simulating an AHK data post, and verifying data visibility on the **Event Board**. It also tests the lookup logic for the Secure Redirector.

### 1. Setup Authentication
Follow the [Authentication Setup Guide](./AuthSetup.md) to ensure your `credentials.json` and `token.json` are present in the project root.

### 2. Run the Tests
Execute the following command to run both the Google Sheets integration script and the Playwright controller interface E2E UI test suites:
```bash
just test
```

Or, to execute only the local controller browser UI E2E tests:
```bash
just test-e2e
```

### 3. What the tests do:
- **Sheets Integration**: Creates a temporary spreadsheet and Master Sheet in Google Drive, deploys the apps script, validates restricted scopes (`drive.file`), pings the receiver, and trashes resources on cleanup.
- **Controller UI E2E**: Launches the controller interface in a headless browser, verifies manual Event/Heat increments and decrements, parses a CP1252 CSV schedule, and checks sequence advancing and rewinding behaviors.

## 🧪 Manual Web App Verification
When manually verification/testing the deployed **Receiver Web App** via HTTP POST, you must handle Google Apps Script's redirect behavior properly. 

Google redirects all `POST` requests using a `302 Found` status to a dynamic URL under `script.googleusercontent.com`. If the client does not follow this redirect while preserving the `POST` method and body payload, Google will return a `Page Not Found` or `Sorry, unable to open the file at this time` HTML error page.

### Correct Manual Test Commands:
*   **Via curl**:
    ```bash
    curl -L --post301 --post302 --post303 -X POST -H "Content-Type: application/json" \
      -d '{"event":"Event: 10","heat":"Heat: 2"}' \
      "YOUR_RECEIVER_URL"
    ```
*   **Via Node.js**:
    ```javascript
    import fetch from 'node-fetch';
    const res = await fetch('YOUR_RECEIVER_URL', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'Event: 10', heat: 'Heat: 2' }),
      redirect: 'follow'
    });
    console.log(res.status, await res.text());
    ```


## 🚀 Automation Workflow

### Creating a New Meet
To set up a new meet environment (spreadsheet + deployed web app):
```bash
just setup "Meet Name 2026"
```
The script will output the **Spreadsheet ID** and the **Web App URL**.

## 📦 Distribution & Releases

All broadcaster client formats (AHK executable, macOS DMG installer, and Windows MSI installer) are automatically compiled, tested, and published to GitHub Releases by our CI/CD pipeline whenever a new version tag `v*` is pushed.

### Local Development & Compilation (Tauri Desktop App)
You can run, compile, or build the Scoreboard Controller locally using the project's standardized `just` targets:
*   **Run Developer Desktop Mode**: Launches the Tauri client with live hot-reloading from your static files:
    ```bash
    just dev-desktop
    ```
*   **Build Production Installer Packages**: Generates optimized local installation binaries (`.dmg` or `.msi` depending on your host OS) under `src-tauri/target/release/bundle/`:
    ```bash
    just build-desktop
    ```

### To Create a New Version Release:
1. Commit and push all changes to the `main` branch.
2. Tag the release and push it to GitHub:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions will automatically run the E2E test suite, package all client distributions, and create a new public release entry.

## 🔒 Security Reminders
- Never commit `credentials.json`, `token.json`, or `config.json`.
- The `.gitignore` is configured to protect these files, but always verify before pushing.
- If you suspect a token is compromised, delete `token.json` and revoke access in your Google Account security settings.

## 📈 Scalability & Rate Limits

The Event Board fetches data directly from Google Sheets every 10 seconds. Because it uses a personal Google account, it is subject to a **300 requests per minute** project-wide limit.

### Capacity Calculation:
- **Polling Interval:** 10 seconds (6 requests per minute per user).
- **Hard Limit:** 300 requests / 6 requests-per-user = **50 concurrent users**.
- **With Backoff:** If the limit is hit, the app throttles to 60 seconds (1 request per minute). At this lower frequency, the system can support up to **300 concurrent users**, though data will refresh much more slowly.

### Stability Features:
- **Exponential Backoff:** If Google returns a 429 error, the app automatically slows down (20s, 40s, 60s) until the error clears.
- **Stale Data Warning:** If data hasn't refreshed for >2 minutes, the timestamp turns red and shows "(Stale)".
- **Visibility Optimization:** Polling pauses automatically when the browser tab is hidden to save API quota.
