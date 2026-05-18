# Project Instructions: SwimMeet-CurrentEventSync

This project automates swim meet event syncing using Google Sheets, Apps Script, and a high-visibility SPA.

## 🏗 Architecture & Patterns

### 1. Zero-Touch Automation
- All infrastructure (Sheets, Scripts, Redirectors) MUST be managed via the `just setup` CLI tool (`scripts/setup-meet.js`).
- Never manualy deploy Apps Script via the web IDE unless troubleshooting; the CLI uses the Google Script API to maintain consistency.

### 2. Security & Least Privilege
- **Restricted Scopes:** Always use `drive.file` and `spreadsheets.currentonly` scopes.
- **Credential Protection:** `credentials.json`, `token.json`, and `.env` are strictly local and MUST be in `.gitignore`.
- **Secret Management:** Use `crypto.randomBytes(8).toString('hex')` for team shared secrets.

### 3. Google Apps Script Integration
- **Container-Bound Scripts:** The Redirector script MUST be bound to the Primary Sheet to use the `currentonly` scope.
- **Permission Roles:** When using the Drive API to share sheets, always use the role `reader` (not `viewer`).
- **Iframe Breakout:** Web Apps serving as redirectors MUST use `window.top.location.href` to update the browser URL correctly.
- **doGet Support:** All Web Apps MUST implement a `doGet` function (even if only to return a status message) to satisfy browser visits during authorization.

### 4. Branded Assets
- Branded QR codes are generated using `scripts/generate-qr.js`.
- Always use `Level H` (High) error correction to allow logo overlays.
- Standard logo is located at `docs/logo.png`.

## 🛠 Workflow & Tooling
- **Package Manager:** Use `uv` for execution (`uv run node ...`).
- **Task Runner:** Use `justfile` for all common operations (`install`, `setup`, `test`).
- **CI/CD:** Windows runners in GitHub Actions automatically compile the AHK script and publish to **GitHub Releases** on tag.

## 🧪 Testing Guidelines
- Use `just test` to run the E2E integration suite.
- Live tests require an active `token.json` and a project with enabled Sheets/Drive/Script APIs.
- Tests MUST clean up after themselves by trashing temporary sheets.

## 📱 Frontend (SPA)
- The scoreboard is located in `docs/` and deployed via GitHub Pages.
- **Mobile First:** All layouts MUST be optimized for high-visibility outdoor use on mobile devices.
- **Dynamic Sharing:** The SPA QR code MUST dynamically reconstruct permanent Redirector links when `team` and `secret` parameters are present.
