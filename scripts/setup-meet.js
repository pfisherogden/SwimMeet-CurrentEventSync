import { execSync } from 'child_process';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

async function getAccessToken() {
  try {
    return execSync('gcloud auth application-default print-access-token').toString().trim();
  } catch (e) {
    console.error('Failed to get access token from gcloud. Run "gcloud auth application-default login" first.');
    process.exit(1);
  }
}

async function createSpreadsheet(auth, name) {
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.create({
    resource: { properties: { title: name } }
  });
  return res.data;
}

async function initializeSheet(auth, spreadsheetId) {
  const sheets = google.sheets({ version: 'v4', auth });
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

  // Ensure manifest has webapp config
  const manifestObj = JSON.parse(manifest);
  manifestObj.webapp = {
    access: 'ANYONE',
    executeAs: 'USER_DEPLOYING'
  };
  manifest = JSON.stringify(manifestObj, null, 2);

  console.log('Creating Apps Script project...');
  const createRes = await script.projects.create({
    resource: { title: 'Scoreboard Receiver', parentId: spreadsheetId }
  });
  const scriptId = createRes.data.scriptId;

  console.log('Uploading code...');
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

  console.log('Creating deployment...');
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
  const meetName = process.argv[2] || 'New Swim Meet';
  console.log(`Setting up meet: ${meetName}`);

  const token = await getAccessToken();
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });

  console.log('Creating spreadsheet...');
  const spreadsheet = await createSpreadsheet(auth, meetName);
  const spreadsheetId = spreadsheet.spreadsheetId;
  console.log(`Spreadsheet created: ${spreadsheetId}`);

  console.log('Initializing headers...');
  await initializeSheet(auth, spreadsheetId);

  console.log('Deploying Apps Script...');
  const deployment = await deployScript(auth, spreadsheetId);
  console.log(`Deployment successful!`);
  console.log(`\n--- RESULTS ---`);
  console.log(`Spreadsheet URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
  console.log(`Web App URL: https://script.google.com/macros/s/${deployment.deploymentId}/exec`);
  console.log(`----------------\n`);
}

run().catch(err => {
  console.error('Error during setup:', err.response?.data || err.message || err);
  process.exit(1);
});
