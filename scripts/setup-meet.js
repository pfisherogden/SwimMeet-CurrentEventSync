import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';

// --- AUTHENTICATION CONFIGURATION ---
// For secure access to Sheets/Drive/Script APIs, you MUST use your own Client ID.
// Follow docs/AuthSetup.md to create these.
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments'
];

async function getAuth() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ Error: credentials.json not found.');
    console.log('Please follow the steps in docs/AuthSetup.md to create your own Google Cloud credentials.');
    process.exit(1);
  }

  const content = fs.readFileSync(CREDENTIALS_PATH);
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (fs.existsSync(TOKEN_PATH)) {
    const token = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  }

  return await getNewToken(oAuth2Client);
}

async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('🚀 Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject(err);
        oAuth2Client.setCredentials(token);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
        console.log('✅ Token stored to', TOKEN_PATH);
        resolve(oAuth2Client);
      });
    });
  });
}

async function createSpreadsheet(auth, name) {
  const sheets = google.sheets({ version: 'v4', auth });
  console.log('Creating spreadsheet...');
  const res = await sheets.spreadsheets.create({
    resource: { properties: { title: name } }
  });
  return res.data;
}

async function initializeSheet(auth, spreadsheetId) {
  const sheets = google.sheets({ version: 'v4', auth });
  console.log('Initializing headers...');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Sheet1!A1:C1',
    valueInputOption: 'RAW',
    resource: { values: [['Current Event', 'Current Heat', 'Last Updated']] }
  });
}

async function deployScript(auth, spreadsheetId) {
  const script = google.script({ version: 'v1', auth });
  const receiverCode = fs.readFileSync(path.join(process.cwd(), 'DataReceiver.js'), 'utf8');
  let manifest = fs.readFileSync(path.join(process.cwd(), 'appsscript.json'), 'utf8');

  const manifestObj = JSON.parse(manifest);
  manifestObj.webapp = { access: 'ANYONE', executeAs: 'USER_DEPLOYING' };
  manifest = JSON.stringify(manifestObj, null, 2);

  console.log('Creating Apps Script project...');
  const createRes = await script.projects.create({
    resource: { title: 'Scoreboard Receiver', parentId: spreadsheetId }
  });
  const scriptId = createRes.data.scriptId;

  await script.projects.updateContent({
    scriptId,
    resource: {
      files: [
        { name: 'DataReceiver', type: 'SERVER_JS', source: receiverCode },
        { name: 'appsscript', type: 'JSON', source: manifest }
      ]
    }
  });

  console.log('Creating version...');
  const versionRes = await script.projects.versions.create({
    scriptId,
    resource: { description: 'Initial Deployment' }
  });

  console.log('Deploying as Web App...');
  const deployRes = await script.projects.deployments.create({
    scriptId,
    resource: {
      versionNumber: versionRes.data.versionNumber,
      description: 'Web App Deployment',
      manifestFileName: 'appsscript'
    }
  });

  return deployRes.data;
}

async function run() {
  const name = process.argv[2] || 'New Swim Meet';
  try {
    const auth = await getAuth();
    const spreadsheet = await createSpreadsheet(auth, name);
    await initializeSheet(auth, spreadsheet.spreadsheetId);
    const deployment = await deployScript(auth, spreadsheet.spreadsheetId);

    console.log('\n--- SETUP COMPLETE ---');
    console.log('Spreadsheet ID:', spreadsheet.spreadsheetId);
    console.log('Web App URL:', deployment.entryPoints[0].webApp.url);
    console.log('----------------------');
  } catch (error) {
    console.error('❌ Error during setup:', error.message || error);
  }
}

run();
