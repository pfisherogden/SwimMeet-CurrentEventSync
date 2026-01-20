# 

# Overview

For local swim meets, parents and swimmers need to know what the current event and heat are so that they can plan ahead and get to their events on time. While many pools have a scoreboard that shows the current event and heat, this may not be viewable from locations like a shade tent or even the parking lot. This software solves this problem by monitoring the Dolphin CTS 5.0 software and syncing the current event and heat to a shared Google Spreadsheet. Parents and swimmers can access this spreadsheet from their phones to see what the current event and heat are.

# Implementation

An AutoHotKey v2 script runs a recurring task to extract the current event and heat data from the Dolphin CTS 5.0 UI. This UI has text boxes with “Event:” and “Heat:” prefixes. The script scans all UI elements to find the two that have the event and heat data, and then caches the element ID to directly retrieve this data in the future. On each successful data extraction, if the event or heat has changed, then the current event and heat will be published (using HTTP POST via WinHttpRequest.5.1) to the shared spreadsheet. A Last Updated time stamp is added to the sheets data so that users can tell how recent the data is.

App progress and any errors are communicated via short lived ToolTips. A previous version wrote to a log file when debugging info was needed, but that was removed for the production version.

# Configuration

Settings to configure for proper operation:

* Script  
  * G\_WEB\_APP\_URL \= the link to post the data to the shared spreadsheet  
  * Polling interval \= 500 ms  
* Spreadsheet  
  * See below for instructions on setting up the spreadsheet to be able to receive data from the locally running script that retrieves the current event/heat information from the Dolphin Scoreboard program.

# Step-by-Step Guide to Set Up Your Google Sheet

This guide will help you create a publicly viewable Google Sheet and a simple web app script to allow your AutoHotkey script to update it.

## Part 1: Create and Share the Spreadsheet

1. **Create a New Sheet:** Go to [sheets.new](https://sheets.new) in your browser to create a blank spreadsheet.  
2. **Name Your Sheet:** Give it a clear name, like "Live Swim Meet Scoreboard".  
3. **Add Headers:** In cell **A1**, type `Current Event`. In cell **B1**, type `Current Heat`. In cell **C1**, type `Last Updated`. This is where the data labels will go. The script will update cells A2 and B2 and C2.  
4. **Share the Sheet:**  
   * Click the **Share** button in the top-right corner.  
   * Under "General access", change "Restricted" to **"Anyone with the link"**.  
   * Ensure the permission is set to **"Viewer"**. You don't want the public to be able to edit it.  
   * Click **Copy link** and save this link to share with parents and swimmers. Click **Done**.

## Part 2: Create the Google Apps Script

1. **Open Apps Script:** In your new spreadsheet, go to the menu and click `Extensions` \> `Apps Script`. A new tab will open with a script editor.  
2. **Name the Script Project:** Click on "Untitled project" at the top and rename it to something like "Scoreboard Updater".

**Paste the Code:** Delete all the placeholder code in the editor (`function myFunction() { ... }`) and paste code from this repo.  
**Save the Script:** Click the floppy disk icon (Save project) in the toolbar.

## Part 3: Deploy the Script as a Web App

1. **Deploy:** At the top-right of the Apps Script editor, click the blue **Deploy** button and select **New deployment**.  
2. **Configure Deployment:**  
   * Click the gear icon next to "Select type" and choose **Web app**.  
   * In the "Description" field, you can type "Scoreboard receiver".  
   * For "Execute as", leave it as **Me (your.email@gmail.com)**.  
   * For "Who has access", you **MUST** select **Anyone**. This is critical for the AHK script to be able to reach it.  
3. **Authorize and Deploy:**  
   * Click **Deploy**.  
   * Google will ask you to authorize the script. Click **Authorize access**.  
   * Choose your Google account. You may see a "Google hasn't verified this app" warning. This is normal. Click **Advanced**, and then click **Go to \[Your Script Name\] (unsafe)**.  
   * On the next screen, review the permissions (it will ask to manage your spreadsheets) and click **Allow**.  
4. **Copy the Web App URL:**  
   * After deploying, a box will appear with a **Web app URL**. This is the final, most important piece.  
   * Click the **Copy** button. This is the URL you will paste into the AutoHotkey script.

Your Google Sheet is now ready to receive data\!

# Verification Script

A Python script is provided to verify the end-to-end functionality of the Google Sheets integration. This script simulates the publishing of event data and then verifies that the data appears on the public spreadsheet.

## Setup

1.  Navigate to the `tests/` directory.
2.  Create or edit the `test_settings.json` file (this file is ignored by git to protect your URLs).
3.  Add your Web App URL and Spreadsheet URL:

    ```json
    {
      "G_WEB_APP_URL": "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",
      "G_SHEET_URL": "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit"
    }
    ```

## Running the Test

The script is managed using `uv` to handle dependencies (`requests`).

Run the following command from the root of the repository:

```powershell
uv run tests/verify_endpoint.py
```

## How it Works

1.  The script posts simulated data ("Test Event X", "Heat X") to the `G_WEB_APP_URL`.
2.  It measures the time taken for the POST request.
3.  It waits for a dynamic period (based on the POST latency) to allow the data to propagate.
4.  It fetches the "Export to CSV" version of your Google Sheet (`G_SHEET_URL`).
5.  It verifies that Row 2 of the spreadsheet matches the data that was just posted.

