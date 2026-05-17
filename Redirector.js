/**
 * Secure Redirector for SwimMeet-CurrentEventSync
 * 
 * This script handles permanent QR code links by mapping team IDs and secrets
 * to the currently active meet's spreadsheet ID.
 * 
 * Usage: https://script.google.com/.../exec?team=TEAM_ID&secret=SECRET
 */

function doGet(e) {
  const team = e.parameter.team;
  const secret = e.parameter.secret;
  
  // 1. BASE URL: Show status message for browser visits/authorization
  if (!team || !secret) {
    return HtmlService.createHtmlOutput("<h2>Secure Swim Redirector is ACTIVE</h2><p>This URL is used for permanent team links. Parameters are required for redirection.</p>")
      .setTitle("Redirector Active");
  }
  
  try {
    // 🔒 RESTRICTED: Uses the active spreadsheet (Master Sheet) only.
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    // Header row: [Team ID, Shared Secret, Active Sheet ID, Meet Name, Spreadsheet URL]
    for (let i = 1; i < data.length; i++) {
      const rowTeam = data[i][0];
      const rowSecret = data[i][1];
      const rowSheetId = data[i][2];
      const rowMeetName = data[i][3];
      
      if (rowTeam === team && String(rowSecret) === String(secret)) {
        // Construct the target URL (GitHub Pages app)
        const GITHUB_PAGES_URL = "https://yourusername.github.io/SwimMeet-CurrentEventSync/";
        const redirectUrl = GITHUB_PAGES_URL + "?sheetId=" + rowSheetId + "&meetName=" + encodeURIComponent(rowMeetName) + "&team=" + team + "&secret=" + secret;
        
        // 🚀 2025 COMPLIANT REDIRECT:
        // Modern browsers block automatic redirects in frames unless there is "User Activation" (a click).
        // To be 100% reliable on all mobile devices/browsers, we provide a "Click to Enter" button.
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <base target="_top">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: -apple-system, system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f0f4f8; }
                .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 80%; }
                .btn { display: inline-block; background-color: #007bff; color: white; padding: 1rem 2rem; border-radius: 0.5rem; text-decoration: none; font-weight: bold; margin-top: 1.5rem; font-size: 1.2rem; }
                .meet-name { color: #555; font-size: 1.1rem; margin-top: 0.5rem; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2>Ready for the Meet?</h2>
                <div class="meet-name">${rowMeetName}</div>
                <a href="${redirectUrl}" class="btn" target="_top">Open Scoreboard</a>
                <p style="font-size: 0.8rem; color: #888; margin-top: 1.5rem;">Redirecting automatically if possible...</p>
              </div>
              <script>
                // Attempt automatic breakout (works in some browsers/versions)
                try {
                  window.top.location.href = "${redirectUrl}";
                } catch (e) {
                  console.log("Auto-redirect blocked by browser. User click required.");
                }
              </script>
            </body>
          </html>
        `;
                     
        return HtmlService.createHtmlOutput(html)
          .setTitle("Redirecting to " + rowMeetName)
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      }
    }
  } catch (err) {
    return HtmlService.createHtmlOutput("<b>Error:</b> " + err.toString());
  }
  
  return HtmlService.createHtmlOutput("<b>Error:</b> Invalid team ID or secret.");
}
