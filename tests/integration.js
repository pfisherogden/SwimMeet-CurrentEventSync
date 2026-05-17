import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// --- CONFIGURATION ---
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const MOCK_MODE = process.env.MOCK_MODE === 'true' || (!fs.existsSync(TOKEN_PATH));

async function getAuth() {
  if (MOCK_MODE) {
    console.log("🛠️ Running in MOCK MODE");
    return { credentials: { access_token: 'mock-token' } };
  }
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runFullE2ETest() {
  console.log("🚀 Starting LIVE E2E Integration Test...");
  if (MOCK_MODE) {
     console.log("❌ LIVE test skipped in MOCK MODE.");
     return;
  }
  
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });
  const script = google.script({ version: 'v1', auth });

  let meetSheetId, masterSheetId;

  try {
    // 1. Create Meet Sheet
    console.log("Step 1: Creating Meet Spreadsheet...");
    const ss = await sheets.spreadsheets.create({ resource: { properties: { title: "LIVE Test Meet " + new Date().toISOString() } } });
    meetSheetId = ss.data.spreadsheetId;

    // 2. Deploy Receiver
    console.log("Step 2: Deploying Live Receiver...");
    const receiverCode = fs.readFileSync('DataReceiver.js', 'utf8');
    const receiverManifest = JSON.stringify({
      timeZone: 'America/Los_Angeles', runtimeVersion: 'V8',
      webapp: { access: 'ANYONE', executeAs: 'USER_DEPLOYING' },
      oauthScopes: ['https://www.googleapis.com/auth/spreadsheets.currentonly']
    });
    
    const proj = await script.projects.create({ resource: { title: 'Test Receiver', parentId: meetSheetId } });
    await script.projects.updateContent({ scriptId: proj.data.scriptId, resource: { files: [
        { name: 'DataReceiver', type: 'SERVER_JS', source: receiverCode },
        { name: 'appsscript', type: 'JSON', source: receiverManifest }
    ]}});
    const v = await script.projects.versions.create({ scriptId: proj.data.scriptId });
    const dep = await script.projects.deployments.create({ scriptId: proj.data.scriptId, resource: { versionNumber: v.data.versionNumber, manifestFileName: 'appsscript' }});
    const receiverUrl = dep.data.entryPoints[0].webApp.url;
    console.log("✅ Receiver Deployed:", receiverUrl);

    // 3. Deploy Redirector
    console.log("Step 3: Creating Master Sheet & Deploying Redirector...");
    const masterSS = await sheets.spreadsheets.create({ resource: { properties: { title: "LIVE Master " + new Date().toISOString() } } });
    masterSheetId = masterSS.data.spreadsheetId;
    await sheets.spreadsheets.values.update({ spreadsheetId: masterSheetId, range: 'Sheet1!A1', valueInputOption: 'RAW', resource: { values: [['Team ID', 'Shared Secret', 'Active Sheet ID', 'Meet Name']] }});
    await sheets.spreadsheets.values.append({ spreadsheetId: masterSheetId, range: 'Sheet1!A:D', valueInputOption: 'RAW', resource: { values: [['test-team', 'test-secret', meetSheetId, 'Live Test Meet']] }});

    const redirectorCode = fs.readFileSync('Redirector.js', 'utf8').replace('https://yourusername.github.io/SwimMeet-CurrentEventSync/', 'https://example.com/');
    const rproj = await script.projects.create({ resource: { title: 'Test Redirector', parentId: masterSheetId } });
    await script.projects.updateContent({ scriptId: rproj.data.scriptId, resource: { files: [
        { name: 'Redirector', type: 'SERVER_JS', source: redirectorCode },
        { name: 'appsscript', type: 'JSON', source: receiverManifest } // Reuse same manifest
    ]}});
    const rv = await script.projects.versions.create({ scriptId: rproj.data.scriptId });
    const rdep = await script.projects.deployments.create({ scriptId: rproj.data.scriptId, resource: { versionNumber: rv.data.versionNumber, manifestFileName: 'appsscript' }});
    const redirectorUrl = rdep.data.entryPoints[0].webApp.url;
    console.log("✅ Redirector Deployed:", redirectorUrl);

    // 4. Ping Live Receiver
    console.log("Step 4: Pinging Receiver with LIVE data...");
    await delay(2000); // Give Google a second to propagate
    const postBody = JSON.stringify({ event: "LIVE EVENT 1", heat: "LIVE HEAT 2" });
    const postRes = await fetch(receiverUrl, { method: 'POST', body: postBody });
    if (postRes.status !== 200) throw new Error("Receiver POST failed with status: " + postRes.status);
    
    // Verify Spreadsheet updated
    const sheetCheck = await sheets.spreadsheets.values.get({ spreadsheetId: meetSheetId, range: 'Sheet1!A2:B2' });
    if (sheetCheck.data.values[0][0] === "LIVE EVENT 1") {
      console.log("✅ LIVE Receiver update SUCCESS.");
    } else {
      throw new Error("Spreadsheet did not update after POST.");
    }

    // 5. Ping Live Redirector
    console.log("Step 5: Pinging Redirector with LIVE parameters...");
    const redirectRes = await fetch(`${redirectorUrl}?team=test-team&secret=test-secret`);
    const redirectHtml = await redirectRes.text();
    if (redirectHtml.includes("window.location.href") && redirectHtml.includes(meetSheetId)) {
      console.log("✅ LIVE Redirector logic SUCCESS.");
    } else {
      throw new Error("Redirector did not return correct redirect HTML.");
    }

    console.log("\n🎉 ALL LIVE E2E PINGS PASSED! THE ENTIRE CLOUD STACK IS OPERATIONAL.");

  } catch (err) {
    console.error("❌ LIVE Test FAILED:", err.message);
    process.exit(1);
  } finally {
    console.log("Cleaning up live test artifacts...");
    if (meetSheetId) await drive.files.update({ fileId: meetSheetId, resource: { trashed: true } });
    if (masterSheetId) await drive.files.update({ fileId: masterSheetId, resource: { trashed: true } });
  }
}

runFullE2ETest();
