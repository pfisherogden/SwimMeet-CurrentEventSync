# Manual Setup Guide (Legacy)

If you prefer to set up your Google Sheet and Apps Script manually without using the automation CLI, follow these steps.

## Part 1: Create and Share the Spreadsheet

1. **Create a New Sheet:** Go to [sheets.new](https://sheets.new).
2. **Name Your Sheet:** e.g., "Live Swim Meet Event Board".
3. **Add Headers:** In cell **A1**, type `Current Event`. In cell **B1**, type `Current Heat`. In cell **C1**, type `Last Updated`.
4. **Share the Sheet:**
   - Click **Share**.
   - Change General access to **"Anyone with the link"**.
   - Ensure permission is set to **"Viewer"**.

## Part 2: Create the Google Apps Script

1. **Open Apps Script:** In your sheet, go to `Extensions > Apps Script`.
2. **Name the Project:** e.g., "Scoreboard Updater".
3. **Paste the Code:** Replace the placeholder code with the contents of `DataReceiver.js` from this repository.
4. **Save the Script.**

## Part 3: Deploy as a Web App

1. **Deploy:** Click **Deploy > New deployment**.
2. **Select Type:** Click the gear and choose **Web app**.
3. **Configure:**
   - Execute as: **Me**.
   - Who has access: **Anyone**.
4. **Authorize:** Follow the prompts to grant the script access to your spreadsheet.
5. **Copy URL:** Copy the **Web app URL**. This is what you paste into your `config.json` or hardcode in the AHK script.
