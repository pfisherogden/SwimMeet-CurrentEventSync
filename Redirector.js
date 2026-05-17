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
  
  if (!team || !secret) {
    return HtmlService.createHtmlOutput("<h2>Secure Swim Redirector is ACTIVE</h2><p>This URL is used for permanent team links. Parameters are required for redirection.</p>")
      .setTitle("Redirector Active");
  }
  
  try {
    // 🔒 RESTRICTED: Uses the active spreadsheet (Master Sheet) only.
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    // Header row: [Team ID, Shared Secret, Active Sheet ID, Meet Name]
    for (let i = 1; i < data.length; i++) {
      const rowTeam = data[i][0];
      const rowSecret = data[i][1];
      const rowSheetId = data[i][2];
      const rowMeetName = data[i][3];
      
      if (rowTeam === team && String(rowSecret) === String(secret)) {
        // Construct the target URL (GitHub Pages app)
        // This URL is automatically updated during CLI setup
        const GITHUB_PAGES_URL = "https://yourusername.github.io/SwimMeet-CurrentEventSync/";
        const redirectUrl = GITHUB_PAGES_URL + "?sheetId=" + rowSheetId + "&meetName=" + encodeURIComponent(rowMeetName);
        
        const html = '<!DOCTYPE html><html><head><base target="_top"><script>' +
                     'window.top.location.href = "' + redirectUrl + '";' +
                     '</script></head><body>' +
                     'Redirecting to <b>' + rowMeetName + '</b>...' +
                     '</body></html>';
                     
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
