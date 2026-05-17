import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import http from 'http';
import url from 'url';
import { execSync } from 'child_process';
import open from 'open';
import { createBrandedQR } from './generate-qr.js';
import 'dotenv/config';

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
  
  let redirectUri = redirect_uris.find(u => u.includes('localhost:') || u.includes('127.0.0.1:'));
  if (!redirectUri) {
    redirectUri = redirect_uris.find(u => u.includes('localhost') || u.includes('127.0.0.1')) || 'http://localhost:3000';
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
    const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
    const port = new url.URL(redirectUri).port || 3000;
    const server = http.createServer(async (req, res) => {
      try {
        const requestUrl = new url.URL(req.url, redirectUri);
        if (requestUrl.searchParams.has('code')) {
          const code = requestUrl.searchParams.get('code');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication Successful!</h1>');
          server.close();
          const { tokens } = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(tokens);
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
          resolve(oAuth2Client);
        }
      } catch (e) { reject(e); }
    }).listen(port, async () => {
      console.log('🚀 Authorize this app by visiting:', authUrl);
      try { await open(authUrl); } catch (e) {}
    });
  });
}

async function createSpreadsheet(auth, name) {
  const sheets = google.sheets({ version: 'v4', auth });
  console.log('Creating spreadsheet...');
  const res = await sheets.spreadsheets.create({ resource: { properties: { title: name } } });
  return res.data;
}

async function initializeSheet(auth, spreadsheetId) {
  const sheets = google.sheets({ version: 'v4', auth });
  console.log('Initializing headers...');
  await sheets.spreadsheets.values.update({
    spreadsheetId, range: 'Sheet1!A1:C1', valueInputOption: 'RAW',
    resource: { values: [['Current Event', 'Current Heat', 'Last Updated']] }
  });
}

async function deployScript(auth, spreadsheetId) {
  const script = google.script({ version: 'v1', auth });
  const receiverCode = fs.readFileSync(path.join(process.cwd(), 'DataReceiver.js'), 'utf8');
  const manifest = JSON.stringify({
    timeZone: 'America/Los_Angeles',
    exceptionLogging: 'STACKDRIVER',
    runtimeVersion: 'V8',
    webapp: { access: 'ANYONE', executeAs: 'USER_DEPLOYING' }
  }, null, 2);

  console.log('Deploying Apps Script receiver...');
  const createRes = await script.projects.create({ resource: { title: 'Scoreboard Receiver', parentId: spreadsheetId } });
  const scriptId = createRes.data.scriptId;

  await script.projects.updateContent({
    scriptId,
    resource: { files: [{ name: 'DataReceiver', type: 'SERVER_JS', source: receiverCode }, { name: 'appsscript', type: 'JSON', source: manifest }] }
  });

  const versionRes = await script.projects.versions.create({ scriptId, resource: { description: 'Auto-deployed' } });
  const deployRes = await script.projects.deployments.create({
    scriptId, resource: { versionNumber: versionRes.data.versionNumber, description: 'Web App', manifestFileName: 'appsscript' }
  });

  return deployRes.data.entryPoints[0].webApp.url;
}

async function updateMasterSheet(auth, masterId, teamId, secret, newSheetId, meetName) {
  const sheets = google.sheets({ version: 'v4', auth });
  console.log('Updating Master Sheet for team:', teamId);
  
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: masterId, range: 'Sheet1!A:D' });
  const rows = res.data.values || [];
  let rowIndex = rows.findIndex(r => r[0] === teamId && String(r[1]) === String(secret));

  if (rowIndex === -1) {
    console.log('Adding new entry to Master Sheet...');
    await sheets.spreadsheets.values.append({
      spreadsheetId: masterId, range: 'Sheet1!A:D', valueInputOption: 'RAW',
      resource: { values: [[teamId, secret, newSheetId, meetName]] }
    });
  } else {
    console.log(`Updating row ${rowIndex + 1} in Master Sheet...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: masterId, range: `Sheet1!C${rowIndex + 1}:D${rowIndex + 1}`, valueInputOption: 'RAW',
      resource: { values: [[newSheetId, meetName]] }
    });
  }
}

async function run() {
  const name = process.argv[2] || 'New Swim Meet';
  try {
    const auth = await getAuth();
    const spreadsheet = await createSpreadsheet(auth, name);
    await initializeSheet(auth, spreadsheet.spreadsheetId);
    const receiverUrl = await deployScript(auth, spreadsheet.spreadsheetId);

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}/edit`;
    const githubPagesUrl = process.env.GITHUB_PAGES_URL || 'https://pfisherogden.github.io/SwimMeet-CurrentEventSync/';
    
    let scoreboardUrl = `${githubPagesUrl}?sheetId=${spreadsheet.spreadsheetId}&meetName=${encodeURIComponent(name)}`;
    let qrType = "Direct SPA";

    // 🔗 Optional: Update Master Sheet & Secure Redirector
    if (process.env.MASTER_SHEET_ID && process.env.TEAM_ID && process.env.SHARED_SECRET) {
      await updateMasterSheet(auth, process.env.MASTER_SHEET_ID, process.env.TEAM_ID, process.env.SHARED_SECRET, spreadsheet.spreadsheetId, name);
      if (process.env.REDIRECTOR_WEB_APP_URL) {
        scoreboardUrl = `${process.env.REDIRECTOR_WEB_APP_URL}?team=${process.env.TEAM_ID}&secret=${process.env.SHARED_SECRET}`;
        qrType = "Secure Redirector (Permanent)";
      }
    }

    console.log('\n--- SETUP COMPLETE ---');
    console.log('📋 SPREADSHEET (Admin):', spreadsheetUrl);
    console.log('📡 RECEIVER (For AHK):', receiverUrl);
    console.log('🏊 SCOREBOARD (For Parents):', scoreboardUrl);
    console.log('----------------------');

    const logEntry = `[${new Date().toISOString()}] Meet: ${name}\n  Spreadsheet: ${spreadsheetUrl}\n  Receiver: ${receiverUrl}\n  Scoreboard: ${scoreboardUrl}\n----------------------\n`;
    fs.appendFileSync(path.join(process.cwd(), 'meets.log'), logEntry);

    // Generate QR code for the SCOREBOARD (not the receiver)
    await createBrandedQR(scoreboardUrl, path.join(process.cwd(), 'meet-qr.png'));
    console.log(`✅ Branded QR Code (${qrType}) saved to meet-qr.png`);

  } catch (error) { console.error('❌ Error:', error.message || error); }
}

run();
