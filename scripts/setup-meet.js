import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import http from 'http';
import url from 'url';
import { execSync } from 'child_process';
import open from 'open';
import { createBrandedQR } from './generate-qr.js';

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments'
];

async function getAuth() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ Error: credentials.json not found.');
    process.exit(1);
  }

  const content = fs.readFileSync(CREDENTIALS_PATH);
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  // CRITICAL FIX: Find a redirect URI with an explicit port, otherwise default to 3000
  let redirectUri = redirect_uris.find(u => u.includes('localhost:') || u.includes('127.0.0.1:'));
  
  if (!redirectUri) {
    // If no port found, check if a bare localhost is present
    const bareLocalhost = redirect_uris.find(u => u.includes('localhost') || u.includes('127.0.0.1'));
    if (bareLocalhost) {
      console.warn('⚠️ Warning: Your credentials.json only has a bare localhost redirect. Adding port 3000 for automation.');
      redirectUri = 'http://localhost:3000';
    } else {
      console.error('❌ Error: No localhost redirect URI found in credentials.json');
      process.exit(1);
    }
  }

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  if (fs.existsSync(TOKEN_PATH)) {
    const token = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  }

  return await getNewToken(oAuth2Client, redirectUri);
}

function getNewToken(oAuth2Client, redirectUri) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
    });

    const parsedUrl = new url.URL(redirectUri);
    const port = parsedUrl.port || 3000;
    
    const server = http.createServer(async (req, res) => {
      try {
        const requestUrl = new url.URL(req.url, redirectUri);
        if (requestUrl.searchParams.has('code')) {
          const code = requestUrl.searchParams.get('code');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication Successful!</h1><p>You can close this window now.</p>');
          server.close();
          
          const { tokens } = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(tokens);
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
          console.log('✅ Token stored to', TOKEN_PATH);
          resolve(oAuth2Client);
        }
      } catch (e) {
        res.writeHead(500);
        res.end('Error parsing code');
        reject(e);
      }
    }).listen(port, async () => {
      console.log(`🚀 Local server listening on port ${port}...`);
      console.log('🚀 Authorize this app by visiting this url:\n', authUrl);
      try { await open(authUrl); } catch (e) {
         console.log('Could not open browser automatically. Please open the link above manually.');
      }
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

    // Generate branded QR code
    const qrText = deployment.entryPoints[0].webApp.url;
    const qrPath = path.join(process.cwd(), 'meet-qr.png');
    await createBrandedQR(qrText, qrPath);

    console.log('🔒 SECURITY: This app can ONLY see files it created.');
  } catch (error) {
    console.error('❌ Error during setup:', error.message || error);
  }
}

run();
