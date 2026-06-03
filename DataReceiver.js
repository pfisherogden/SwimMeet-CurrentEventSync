/**
 * Scoreboard Receiver for SwimMeet-CurrentEventSync
 */

function doGet(e) {
  return ContentService.createTextOutput("Scoreboard Receiver is ACTIVE. Use POST to update data.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const postData = e.postData.contents;
    const data = JSON.parse(postData);
    
    // 🔒 RESTRICTED & ROBUST: Uses the sheet this script is physically attached to.
    // This is the ONLY reliable way to allow unauthenticated POST writes.
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error("Spreadsheet context not found.");

    const sheet = ss.getSheets()[0];
    sheet.getRange("A2").setValue(data.event);
    sheet.getRange("B2").setValue(data.heat);
    sheet.getRange("C2").setValue(new Date());
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "message": "Updated successfully."
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
