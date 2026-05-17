# Secure Redirector Setup Guide

The Secure Redirector allows teams to have a permanent QR code/URL that always points to their *currently active* meet, without needing to regenerate the QR code for every event.

## 1. Create the Master Sheet

1. Create a new Google Sheet.
2. Name it something like "Swim Meet Master Redirector".
3. Set up the following headers in the first row (A1 to D1):
   - `Team ID` (e.g., `dolphin`)
   - `Shared Secret` (e.g., `abc-123`)
   - `Active Sheet ID` (The ID of the spreadsheet created by `setup-meet.js`)
   - `Meet Name` (e.g., `2024 City Finals`)

## 2. Deploy the Redirector Script

1. Go to [script.google.com](https://script.google.com/).
2. Create a new project named "Swim Meet Redirector".
3. Copy the contents of `Redirector.js` into the editor.
4. Replace `yourusername.github.io` in the code with your actual GitHub Pages domain.
5. Run the `setup()` function once after replacing `YOUR_MASTER_SHEET_ID_HERE` with your Master Sheet's ID (or set it manually in Project Settings > Script Properties).
6. Click **Deploy > New Deployment**.
7. Select **Type: Web App**.
8. Set **Execute As: Me**.
9. Set **Who has access: Anyone**.
10. Copy the **Web App URL**.

## 3. Usage

Distribute URLs in this format:
`https://script.google.com/macros/s/.../exec?team=TEAM_ID&secret=SECRET`

When a meet ends and a new one begins:
1. Run `node scripts/setup-meet.js "Next Meet Name"`.
2. Copy the new Spreadsheet ID from the output.
3. Update the `Active Sheet ID` and `Meet Name` columns in your Master Sheet for the corresponding team.

The permanent URL will now automatically redirect users to the new meet's data.
