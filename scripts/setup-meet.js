import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import http from 'http';
import url from 'url';
import { execSync } from 'child_process';
import open from 'open';
import crypto from 'crypto';
import { createBrandedQR } from './generate-qr.js';
import 'dotenv/config';

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const ENV_PATH = path.join(process.cwd(), '.env');
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
  if (!redirectUri) redirectUri = 'http://localhost:3000';
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

async function createSpreadsheet(auth, name, headers = null) {
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.create({ resource: { properties: { title: name } } });
  const spreadsheetId = res.data.spreadsheetId;
  if (headers) {
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: 'Sheet1!A1', valueInputOption: 'RAW',
      resource: { values: [headers] }
    });
  }
  return spreadsheetId;
}

async function deployScript(auth, title, parentId, code, filename, manifest, existingScriptId = null) {
  const script = google.script({ version: 'v1', auth });
  let scriptId = existingScriptId;
  if (!scriptId) {
    const createRes = await script.projects.create({ resource: { title, parentId } });
    scriptId = createRes.data.scriptId;
  }
  await script.projects.updateContent({
    scriptId,
    resource: { files: [
      { name: filename, type: 'SERVER_JS', source: code },
      { name: 'appsscript', type: 'JSON', source: manifest }
    ] }
  });
  const versionRes = await script.projects.versions.create({ scriptId, resource: { description: 'Auto' } });
  const deployRes = await script.projects.deployments.create({
    scriptId, resource: { versionNumber: versionRes.data.versionNumber, manifestFileName: 'appsscript' }
  });
  return { scriptId, url: deployRes.data.entryPoints[0].webApp.url };
}

async function handleRedirector(auth, masterSheetId) {
  let scriptId = process.env.REDIRECTOR_SCRIPT_ID;
  console.log('🔄 Syncing Secure Redirector code...');
  let redirectorCode = fs.readFileSync(path.join(process.cwd(), 'Redirector.js'), 'utf8');
  const pagesUrl = process.env.GITHUB_PAGES_URL || 'https://pfisherogden.github.io/SwimMeet-CurrentEventSync/';
  redirectorCode = redirectorCode.replace('https://yourusername.github.io/SwimMeet-CurrentEventSync/', pagesUrl);
  const manifest = JSON.stringify({
    timeZone: 'America/Los_Angeles', runtimeVersion: 'V8',
    webapp: { access: 'ANYONE', executeAs: 'USER_DEPLOYING' },
    oauthScopes: ['https://www.googleapis.com/auth/spreadsheets.currentonly']
  }, null, 2);
  const { scriptId: newScriptId, url: newUrl } = await deployScript(auth, 'Secure Swim Redirector', masterSheetId, redirectorCode, 'Redirector', manifest, scriptId);
  if (!scriptId) {
    fs.appendFileSync(ENV_PATH, `\nREDIRECTOR_SCRIPT_ID=${newScriptId}\nREDIRECTOR_WEB_APP_URL=${newUrl}\n`);
  }
  return newUrl;
}

async function handleMasterSheet(auth, teamId, meetName, meetSheetId) {
  const sheets = google.sheets({ version: 'v4', auth });
  let masterId = process.env.MASTER_SHEET_ID;
  let secret = process.env.SHARED_SECRET;
  const meetSheetUrl = `https://docs.google.com/spreadsheets/d/${meetSheetId}/edit`;

  // UPDATED HEADERS: Added clickable Spreadsheet URL for admin ease
  const headers = ['Team ID', 'Shared Secret', 'Active Sheet ID', 'Meet Name', 'Spreadsheet URL'];

  if (!masterId) {
    console.log('✨ Creating a new Master Redirector Sheet...');
    masterId = await createSpreadsheet(auth, 'Swim Meet Master Redirector', headers);
    fs.appendFileSync(ENV_PATH, `\nMASTER_SHEET_ID=${masterId}\n`);
  }

  if (!secret) {
    secret = crypto.randomBytes(8).toString('hex');
    fs.appendFileSync(ENV_PATH, `SHARED_SECRET=${secret}\n`);
  }

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: masterId, range: 'Sheet1!A:E' });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === teamId);

  const rowData = [teamId, secret, meetSheetId, meetName, meetSheetUrl];

  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: masterId, range: 'Sheet1!A:E', valueInputOption: 'RAW',
      resource: { values: [rowData] }
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId: masterId, range: `Sheet1!A${rowIndex + 1}:E${rowIndex + 1}`, valueInputOption: 'RAW',
      resource: { values: [rowData] }
    });
  }
  return { masterId, secret };
}

async function run() {
  const meetName = process.argv[2] || 'New Swim Meet';
  const teamId = process.argv[3] || process.env.TEAM_ID || 'default-team';
  try {
    const auth = await getAuth();
    console.log('🚀 Starting Automation for team:', teamId);
    const meetSheetId = await createSpreadsheet(auth, meetName, ['Current Event', 'Current Heat', 'Last Updated']);
    const receiverCode = fs.readFileSync(path.join(process.cwd(), 'DataReceiver.js'), 'utf8');
    const receiverManifest = JSON.stringify({
      timeZone: 'America/Los_Angeles', runtimeVersion: 'V8',
      webapp: { access: 'ANYONE', executeAs: 'USER_DEPLOYING' },
      oauthScopes: ['https://www.googleapis.com/auth/spreadsheets.currentonly']
    }, null, 2);
    const { url: receiverUrl } = await deployScript(auth, 'Receiver: ' + meetSheetId, meetSheetId, receiverCode, 'DataReceiver', receiverManifest);
    const { masterId, secret } = await handleMasterSheet(auth, teamId, meetName, meetSheetId);
    const redirectorUrl = await handleRedirector(auth, masterId);
    const permanentUrl = `${redirectorUrl}?team=${teamId}&secret=${secret}`;

    console.log('\n================================================');
    console.log('✅ SETUP COMPLETE');
    console.log('================================================');
    console.log('\n🔑 ADMIN - ACTION REQUIRED:');
    console.log('1. AUTHORIZE RECEIVER (New Link!):\n   👉', receiverUrl);
    console.log('2. AUTHORIZE REDIRECTOR (New Link!):\n   👉', redirectorUrl);
    console.log('3. UPDATE WINDOWS CLIENT:\n   URL:', receiverUrl);
    console.log('\n📊 DATA MANAGEMENT:');
    console.log('• Meet Spreadsheet: https://docs.google.com/spreadsheets/d/' + meetSheetId + '/edit');
    console.log('• Master Redirector: https://docs.google.com/spreadsheets/d/' + masterId + '/edit');
    console.log('\n🏊 PARENT ACCESS (PUBLIC):\n• QR Code: meet-qr.png\n• URL:', permanentUrl);
    console.log('================================================\n');

    const logEntry = `[${new Date().toISOString()}] Meet: ${meetName}\n  Spreadsheet: https://docs.google.com/spreadsheets/d/${meetSheetId}/edit\n  Receiver: ${receiverUrl}\n  Permanent: ${permanentUrl}\n----------------------\n`;
    fs.appendFileSync(path.join(process.cwd(), 'meets.log'), logEntry);
    await createBrandedQR(permanentUrl, path.join(process.cwd(), 'meet-qr.png'));
  } catch (error) { console.error('❌ Error:', error.message || error); }
}
run();
