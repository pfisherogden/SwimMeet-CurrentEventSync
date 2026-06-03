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
    
    // Parse Event Number (e.g., "Event: 8  MIXED..." -> "8")
    let eventNum = data.event;
    const eventMatch = data.event.match(/Event:\s*(\d+)/i);
    if (eventMatch) eventNum = eventMatch[1];
    
    // Parse Heat Number (e.g., "Heat: 1" -> "1")
    let heatNum = data.heat;
    const heatMatch = data.heat.match(/Heat:\s*(\d+)/i);
    if (heatMatch) heatNum = heatMatch[1];

    sheet.getRange("A2").setValue(eventNum);
    sheet.getRange("B2").setValue(heatNum);
    
    const now = new Date();
    const timestampRange = sheet.getRange("C2");
    
    // Explicitly format for the spreadsheet's locale (likely Pacific)
    // or just set the value and ensure the sheet itself is set to Pacific.
    timestampRange.setValue(now);
    timestampRange.setNumberFormat("M/d/yyyy H:mm:ss");
    
    // 💡 FORCE TIMEZONE: Ensure the spreadsheet itself is set to Pacific Time
    ss.setSpreadsheetTimeZone("America/Los_Angeles");
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "message": "Updated successfully.",
      "received": { event: eventNum, heat: heatNum, time: now.toISOString() }
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
