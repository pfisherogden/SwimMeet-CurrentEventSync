# Secure Redirector Setup & Management

The Secure Redirector provides teams with a **permanent QR code** that always points to their currently active meet. This eliminates the need to print new QR codes for every event.

---

## 🚀 Automated Setup (Recommended)

The `just setup` CLI tool handles almost everything for you.

1.  **First Run:** When you run `just setup "Meet Name" "TeamID"` for the first time, the script will:
    - Create a **Master Redirector Sheet** in your Google Drive.
    - Generate a secure **Shared Secret** for your team.
    - Deploy the **Redirector Web App** to Google Cloud.
    - Save all IDs and URLs to your local `.env` file.
2.  **Authorization:** You will see a link in the terminal labeled **"AUTHORIZE REDIRECTOR"**. Click it once to grant permissions.
3.  **Branding:** A `meet-qr.png` is generated automatically, encoding your permanent team link.

---

## 📊 Managing the Master Sheet

Your Master Sheet is the "Control Panel" for your season. You can find its URL in the `just setup` output or in your `meets.log`.

### Column Reference:
- **Team ID:** The identifier you use in the CLI (e.g., `dolphin`).
- **Shared Secret:** A private code that prevents unauthorized access.
- **Active Sheet ID:** The ID of the spreadsheet for today's meet.
- **Meet Name:** The title displayed to parents on the bridge page.
- **Spreadsheet URL:** A clickable link to the active meet for admin use.

**To switch meets:** Simply run `just setup` again with the new meet name. The script will automatically update the **Active Sheet ID** and **Meet Name** in this sheet. Your printed QR codes will instantly point to the new data!

---

## 🔒 Security & Privacy

- **Restricted Access:** The Redirector script uses the `spreadsheets.currentonly` scope. it can ONLY see the Master Sheet it is attached to.
- **Secret Protection:** The `SHARED_SECRET` is required in the URL to trigger a redirect. Keep this secret shared only via the QR code.
- **Privacy:** Parents and swimmers access the **Event Board** via a clean breakout redirect, ensuring they never see your private Google Drive environment.

---

## 🛠 Manual Deployment (Fallback)

If you need to deploy the Redirector manually:
1. Create a Google Sheet with the 5 headers listed above.
2. Open `Extensions > Apps Script`.
3. Paste the contents of `Redirector.js` into the editor.
4. Replace `yourusername.github.io` with your GitHub Pages domain.
5. Deploy as **Web App** (Execute as: Me, Access: Anyone).
6. Copy the URL and add it to your `.env` as `REDIRECTOR_WEB_APP_URL`.
