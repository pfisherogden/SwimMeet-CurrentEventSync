/**
 * Scoreboard Receiver for SwimMeet-CurrentEventSync
 */

// This function runs when it receives an HTTP GET request (e.g. from a browser)
function doGet(e) {
  return ContentService.createTextOutput("Scoreboard Receiver is ACTIVE. Use POST to update data.")
    .setMimeType(ContentService.MimeType.TEXT);
}

// This function runs when it receives an HTTP POST request
function doPost(e) {
  Logger.log("--- New Request Received ---");

  try {
    const postData = e.postData.contents;
    const data = JSON.parse(postData);
    const eventText = data.event;
    const heatText = data.heat;

    // 🔒 ROBUST ACCESS: Use specific ID or active sheet
    let ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      // Fallback for standalone deployments
      const props = PropertiesService.getScriptProperties();
      const sheetId = props.getProperty('SHEET_ID');
      if (sheetId) {
        ss = SpreadsheetApp.openById(sheetId);
      }
    }

    if (!ss) throw new Error("Could not access spreadsheet.");

    const sheet = ss.getSheets()[0];
    const timestamp = new Date();

    sheet.getRange("A2").setValue(eventText);
    sheet.getRange("B2").setValue(heatText);
    sheet.getRange("C2").setValue(timestamp);
    
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

/**
 * Setup function called by automation CLI
 */
function setup(id) {
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', id);
}
