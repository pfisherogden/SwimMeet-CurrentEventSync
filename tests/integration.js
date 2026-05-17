import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// This test uses the user's custom credentials to verify the end-to-end flow.
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

async function getAuth() {
  if (!fs.existsSync(CREDENTIALS_PATH) || !fs.existsSync(TOKEN_PATH)) {
    console.error('❌ Integration test requires credentials.json and token.json (run setup first).');
    process.exit(1);
  }
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

async function runE2ETest() {
  console.log("🚀 Starting Full E2E Integration Test...");
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    console.log("Step 1: Creating Spreadsheet...");
    const ss = await sheets.spreadsheets.create({
      resource: { properties: { title: "E2E Test Meet " + new Date().toISOString() } }
    });
    const spreadsheetId = ss.data.spreadsheetId;
    console.log("✅ Created Spreadsheet:", spreadsheetId);

    console.log("Step 2: Initializing Headers...");
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1:C1',
      valueInputOption: 'RAW',
      resource: { values: [['Current Event', 'Current Heat', 'Last Updated']] }
    });
    console.log("✅ Headers initialized.");

    console.log("Step 3: Simulating Data Update...");
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A2:C2',
      valueInputOption: 'RAW',
      resource: { values: [['Event 101', 'Heat 1', new Date().toLocaleTimeString()]] }
    });
    console.log("✅ Data updated.");

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

    console.log("Step 5: Cleaning up (Trashing test sheet)...");
    const drive = google.drive({ version: 'v3', auth });
    await drive.files.update({ fileId: spreadsheetId, resource: { trashed: true } });
    console.log("✅ Cleanup complete.");

    console.log("\n🎉 ALL E2E TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ E2E Test FAILED:", err.message);
    process.exit(1);
  }
}

runE2ETest();
