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

The Windows AutoHotkey executable (`.exe`) is automatically compiled and published using GitHub Actions.

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
