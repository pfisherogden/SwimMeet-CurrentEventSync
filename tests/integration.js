import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

async function getAccessToken() {
  try {
    return execSync('gcloud auth application-default print-access-token').toString().trim();
  } catch (e) {
    console.error('Failed to get access token from gcloud.');
    process.exit(1);
  }
}

async function runE2ETest() {
  console.log("🚀 Starting Full E2E Integration Test...");
  const token = await getAccessToken();
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // 1. Create a Spreadsheet
    console.log("Step 1: Creating Spreadsheet...");
    const ss = await sheets.spreadsheets.create({
      resource: { properties: { title: "E2E Test Meet " + new Date().toISOString() } }
    });
    const spreadsheetId = ss.data.spreadsheetId;
    console.log("✅ Created Spreadsheet:", spreadsheetId);

    // 2. Initialize Headers
    console.log("Step 2: Initializing Headers...");
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1:C1',
      valueInputOption: 'RAW',
      resource: { values: [['Current Event', 'Current Heat', 'Last Updated']] }
    });
    console.log("✅ Headers initialized.");

    // 3. Simulate Data Update (AHK POST)
    console.log("Step 3: Simulating Data Update...");
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A2:C2',
      valueInputOption: 'RAW',
      resource: { values: [['Event 101', 'Heat 1', new Date().toLocaleTimeString()]] }
    });
    console.log("✅ Data updated.");

    // 4. Verify Data
    console.log("Step 4: Verifying Data...");
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A2:B2'
    });
    if (res.data.values[0][0] === 'Event 101') {
      console.log("✅ Data verification SUCCESS.");
    } else {
      throw new Error("Data verification FAILED.");
    }

    // 5. Cleanup
    console.log("Step 5: Cleaning up (Trashing test sheet)...");
    const drive = google.drive({ version: 'v3', auth });
    await drive.files.update({ fileId: spreadsheetId, resource: { trashed: true } });
    console.log("✅ Cleanup complete.");

    console.log("\n🎉 ALL E2E TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ E2E Test FAILED:", err.message);
    if (err.message.includes("insufficient authentication scopes")) {
      console.log("\nTIP: Run 'gcloud auth application-default login --scopes=\"https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive\"'");
    }
    process.exit(1);
  }
}

runE2ETest();
