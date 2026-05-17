# Skill: Swim Meet Automation & Cloud Sync

This skill provides expert guidance for managing and extending the SwimMeet-CurrentEventSync project infrastructure.

## 🎯 Purpose
To maintain a Zero-Touch automation environment for swim meet infrastructure using Google Cloud APIs.

## 📋 Task: Managing Meets
When asked to create or update a meet:
1.  **Always** use the `just setup` command.
2.  Pass the meet name and team ID: `just setup "Name" "TeamID"`.
3.  Verify the output for "Action Required" links.
4.  Check `meets.log` for local history.

## 🛠 Task: Modifying Cloud Code
When updating `DataReceiver.js` or `Redirector.js`:
1.  Apply changes to the local `.js` files first.
2.  Run `just setup` to trigger the "Self-Healing" sync.
3.  The CLI will automatically push the new code to Google and create a new deployment.
4.  **Verification:** Always run `just test` to confirm the live endpoints are working.

## 🔒 Task: Security Hardening
If adding new API features:
1.  Check the manifest generation logic in `scripts/setup-meet.js`.
2.  Ensure only `.currentonly` or `.file` scopes are used.
3.  Never add broad `drive` or `spreadsheets` scopes.

## 🎨 Task: Branded QR Codes
When generating QR codes:
1.  Ensure `docs/logo.png` is high quality.
2.  The `createBrandedQR` function in `scripts/generate-qr.js` handles the circular masking.
3.  QR codes should always point to the **Permanent Redirector URL** when available.
