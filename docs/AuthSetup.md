# Google API Authentication Setup (Restricted)

To use the automation script securely, you must create your own Google Cloud project. This app is configured with **Maximum Privacy Scopes**, meaning it can ONLY see files it creates.

## 1. Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named "Swim Meet Tools".

## 2. Enable APIs
Enable these 3 APIs:
1. [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
2. [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
3. [Google Apps Script API](https://console.cloud.google.com/apis/library/script.googleapis.com)

## 3. Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Choose **External**.
3. **Scopes:** Add `https://www.googleapis.com/auth/drive.file` and `https://www.googleapis.com/auth/script.projects`. 
   *Note: Do NOT add the broad 'spreadsheets' or 'drive' scopes.*
4. **Test Users:** Add your own Gmail address.

## 4. Create Credentials
1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Select **Desktop app**.
4. Download the JSON, rename it to `credentials.json`, and put it in the project root.

## 5. First Run
Run `just setup "Meet Name"`. 
The permission request will now specifically say: **"See, edit, create, and delete only the specific Google Drive files you use with this app."**
