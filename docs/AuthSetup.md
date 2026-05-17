# Google API Authentication Setup

To use the automation script, you must create your own Google Cloud project and OAuth2 credentials. This avoids security blocks caused by using generic or shared client IDs.

## 1. Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown and select **New Project**.
3. Name it "Swim Meet Tools" and click **Create**.

## 2. Enable APIs
Enable the following APIs for your project:
1. [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
2. [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
3. [Google Apps Script API](https://console.cloud.google.com/apis/library/script.googleapis.com)

## 3. Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Choose **External** (unless you have a Google Workspace org).
3. Fill in the required app info (App name, support email, developer email).
4. **Scopes:** Add `.../auth/spreadsheets`, `.../auth/drive.file`, and `.../auth/script.projects`.
5. **Test Users:** IMPORTANT! Add your own Gmail address as a test user.

## 4. Create Credentials
1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Select **Desktop app** as the application type.
4. Name it "Swim CLI".
5. Click **Create**, then click the **Download JSON** icon for the client you just created.
6. Rename the downloaded file to `credentials.json` and place it in the root of the `SwimMeet-CurrentEventSync` folder.

## 5. First Run
Run `just setup "Meet Name"`. 
- The script will provide a link. 
- Open it, log in with your test user account, and click "Allow".
- If you see "Google hasn't verified this app", click **Advanced > Go to Swim CLI (unsafe)**.
- Copy the resulting code back into the terminal.
- A `token.json` will be saved locally so you don't have to do this again.
