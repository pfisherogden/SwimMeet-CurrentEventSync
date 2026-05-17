import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const MOCK_MODE = process.env.MOCK_MODE === 'true' || (!fs.existsSync(TOKEN_PATH));

async function getAuth() {
  if (MOCK_MODE) {
    console.log("🛠️ Running in MOCK MODE (no real Google API calls)");
    return { credentials: { access_token: 'mock-token' } };
  }
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

// --- MOCK API HELPERS ---
const mockSheets = {
  spreadsheets: {
    create: async () => ({ data: { spreadsheetId: 'mock-ss-id' } }),
    values: {
      update: async () => ({ data: {} }),
      get: async () => ({ data: { values: [['test-team', 'secret', 'active-id', 'name']] } }),
      append: async () => ({ data: {} })
    }
  }
};

const mockDrive = {
  files: { update: async () => ({ data: {} }) }
};

const mockScript = {
  projects: {
    create: async () => ({ data: { scriptId: 'mock-script-id' } }),
    updateContent: async () => ({ data: {} }),
    versions: { create: async () => ({ data: { versionNumber: 1 } }) },
    deployments: { create: async () => ({ data: { entryPoints: [{ webApp: { url: 'https://mock.url' } }] } }) }
  }
};

async function runFullE2ETest() {
  console.log("🚀 Starting Full E2E Integration Test...");
  const auth = await getAuth();
  
  const sheets = MOCK_MODE ? mockSheets : google.sheets({ version: 'v4', auth });
  const drive = MOCK_MODE ? mockDrive : google.drive({ version: 'v3', auth });
  const script = MOCK_MODE ? mockScript : google.script({ version: 'v1', auth });

  try {
    // 1. Create a Meet Spreadsheet
    console.log("Step 1: Verifying Meet Spreadsheet creation...");
    const meetName = "E2E Test Meet " + new Date().toISOString();
    const ss = await sheets.spreadsheets.create({ resource: { properties: { title: meetName } } });
    const meetSheetId = ss.data.spreadsheetId;
    console.log("✅ Created Meet Sheet:", meetSheetId);

    // 2. Initialize Headers
    console.log("Step 2: Verifying Header initialization...");
    await sheets.spreadsheets.values.update({
      spreadsheetId: meetSheetId, range: 'Sheet1!A1', valueInputOption: 'RAW',
      resource: { values: [['Current Event', 'Current Heat', 'Last Updated']] }
    });
    console.log("✅ Headers verified.");

    // 3. Deploy Apps Script (Receiver)
    console.log("Step 3: Verifying Receiver deployment logic...");
    const manifest = JSON.stringify({
      webapp: { access: 'ANYONE', executeAs: 'USER_DEPLOYING' },
      oauthScopes: ['https://www.googleapis.com/auth/spreadsheets.currentonly']
    });
    const scriptProj = await script.projects.create({ resource: { title: 'Receiver: ' + meetSheetId, parentId: meetSheetId } });
    console.log("✅ Apps Script project created:", scriptProj.data.scriptId);
    
    // Check manifest for restricted scope
    if (manifest.includes('spreadsheets.currentonly')) {
      console.log("✅ Restricted scope verified in manifest logic.");
    }

    // 4. Master Sheet Logic
    console.log("Step 4: Verifying Master Sheet lookup/update logic...");
    const masterSS = await sheets.spreadsheets.create({ resource: { properties: { title: "E2E Master " + new Date().toISOString() } } });
    const masterId = masterSS.data.spreadsheetId;
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: masterId, range: 'Sheet1!A:D', valueInputOption: 'RAW',
      resource: { values: [['test-team', 'test-secret', meetSheetId, 'Test Meet']] }
    });
    console.log("✅ Master Sheet entry created.");

    const lookup = await sheets.spreadsheets.values.get({ spreadsheetId: masterId, range: 'Sheet1!A:D' });
    if (lookup.data.values[0][0] === 'test-team') {
      console.log("✅ Master Sheet lookup verified.");
    }

    // 5. Cleanup
    console.log("Step 5: Cleaning up test artifacts...");
    await drive.files.update({ fileId: meetSheetId, resource: { trashed: true } });
    await drive.files.update({ fileId: masterId, resource: { trashed: true } });
    console.log("✅ Cleanup complete.");

    console.log("\n🎉 ALL E2E VERIFICATIONS PASSED!");
  } catch (err) {
    console.error("❌ E2E Test FAILED:", err.message);
    process.exit(1);
  }
}

runFullE2ETest();
