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
Execute the following command:
```bash
just test
```

### 3. What the test does:
- Creates a temporary spreadsheet in your Google Drive.
- Creates a temporary 5-column **Master Sheet** to test redirector logic.
- Verifies that the app has correct permissions (using the restricted `drive.file` scope).
- Performs a **Live Ping** to ensure the deployed cloud code is reachable.
- Cleans up by trashing all created files after the test completes.

## 🚀 Automation Workflow

### Creating a New Meet
To set up a new meet environment (spreadsheet + deployed web app):
```bash
just setup "Meet Name 2026"
```
The script will output the **Spreadsheet ID** and the **Web App URL**.

## 📦 Distribution & Releases

The Windows AutoHotkey executable (`.exe`) is automatically compiled and published using GitHub Actions on a Windows runner.

### Technical Note: AHK v2 Compilation
This project uses **AutoHotkey v2**. In the CI environment, we use the verified `benmusson/ahk2exe-action@v1` to handle the v2-specific compilation requirements. 

### To Create a New Version:
1. Commit your changes to `main`.
2. Create and push a version tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
3. GitHub will trigger a build and create a new entry in the **Releases** tab with the compiled EXE attached.

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
