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

async function deployReceiver(auth, spreadsheetId) {
  const script = google.script({ version: 'v1', auth });
  const receiverCode = fs.readFileSync(path.join(process.cwd(), 'DataReceiver.js'), 'utf8');
  const manifest = JSON.stringify({
    timeZone: 'America/Los_Angeles',
    exceptionLogging: 'STACKDRIVER',
    runtimeVersion: 'V8',
    webapp: { access: 'ANYONE', executeAs: 'USER_DEPLOYING' }
  }, null, 2);

  const createRes = await script.projects.create({ resource: { title: 'Receiver: ' + spreadsheetId, parentId: spreadsheetId } });
  const scriptId = createRes.data.scriptId;
  await script.projects.updateContent({
    scriptId,
    resource: { files: [{ name: 'DataReceiver', type: 'SERVER_JS', source: receiverCode }, { name: 'appsscript', type: 'JSON', source: manifest }] }
  });
  const versionRes = await script.projects.versions.create({ scriptId, resource: { description: 'Auto' } });
  const deployRes = await script.projects.deployments.create({
    scriptId, resource: { versionNumber: versionRes.data.versionNumber, manifestFileName: 'appsscript' }
  });
  return deployRes.data.entryPoints[0].webApp.url;
}

async function handleMasterSheet(auth, teamId, meetName, meetSheetId) {
  const sheets = google.sheets({ version: 'v4', auth });
  let masterId = process.env.MASTER_SHEET_ID;
  let secret = process.env.SHARED_SECRET;

  if (!masterId) {
    console.log('✨ Creating a new Master Redirector Sheet...');
    masterId = await createSpreadsheet(auth, 'Swim Meet Master Redirector', ['Team ID', 'Shared Secret', 'Active Sheet ID', 'Meet Name']);
    fs.appendFileSync(ENV_PATH, `\nMASTER_SHEET_ID=${masterId}\n`);
    console.log('✅ Master Sheet created and saved to .env');
  }

  if (!secret) {
    secret = crypto.randomBytes(8).toString('hex');
    fs.appendFileSync(ENV_PATH, `SHARED_SECRET=${secret}\n`);
    console.log('✅ Generated new shared secret for team:', teamId);
  }

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: masterId, range: 'Sheet1!A:D' });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === teamId);

  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: masterId, range: 'Sheet1!A:D', valueInputOption: 'RAW',
      resource: { values: [[teamId, secret, meetSheetId, meetName]] }
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId: masterId, range: `Sheet1!C${rowIndex + 1}:D${rowIndex + 1}`, valueInputOption: 'RAW',
      resource: { values: [[meetSheetId, meetName]] }
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

    // 1. Create Meet Sheet
    const meetSheetId = await createSpreadsheet(auth, meetName, ['Current Event', 'Current Heat', 'Last Updated']);
    const meetSheetUrl = `https://docs.google.com/spreadsheets/d/${meetSheetId}/edit`;

    // 2. Deploy Receiver (Action Required: Authorize in browser)
    console.log('--- ACTION REQUIRED: Apps Script Deployment ---');
    const receiverUrl = await deployReceiver(auth, meetSheetId);

    // 3. Handle Master Sheet
    const { masterId, secret } = await handleMasterSheet(auth, teamId, meetName, meetSheetId);
    const masterUrl = `https://docs.google.com/spreadsheets/d/${masterId}/edit`;

    // 4. Final URLs
    const redirectorUrl = process.env.REDIRECTOR_WEB_APP_URL || 'https://[DEPLOY_REDIRECTOR_FIRST]';
    const permanentUrl = `${redirectorUrl}?team=${teamId}&secret=${secret}`;

    console.log('\n================================================');
    console.log('✅ SETUP COMPLETE');
    console.log('================================================');
    
    console.log('\n🔑 ADMIN - ACTION REQUIRED:');
    console.log('------------------------------------------------');
    console.log('1. AUTHORIZE RECEIVER: Open this link ONCE in your browser to confirm permissions:');
    console.log('   👉', receiverUrl);
    console.log('\n2. CONFIGURE WINDOWS CLIENT: Paste this into your config.json:');
    console.log('   URL:', receiverUrl);
    
    console.log('\n📊 DATA MANAGEMENT:');
    console.log('------------------------------------------------');
    console.log('• Meet Spreadsheet:', meetSheetUrl);
    console.log('• Master Redirector:', masterUrl);
    
    console.log('\n🏊 PARENT ACCESS (PUBLIC):');
    console.log('------------------------------------------------');
    console.log('• Branded QR Code generated: meet-qr.png');
    console.log('• Permanent URL:', permanentUrl);
    console.log('================================================\n');

    const logEntry = `[${new Date().toISOString()}] Meet: ${meetName} (Team: ${teamId})\n  Spreadsheet: ${meetSheetUrl}\n  Receiver: ${receiverUrl}\n  Permanent URL: ${permanentUrl}\n----------------------\n`;
    fs.appendFileSync(path.join(process.cwd(), 'meets.log'), logEntry);

    await createBrandedQR(permanentUrl, path.join(process.cwd(), 'meet-qr.png'));

  } catch (error) { console.error('❌ Error:', error.message || error); }
}

run();
