// This function runs when it receives an HTTP POST request
function doPost(e) {
  // Start a log to trace the execution
  Logger.log("--- New Request Received ---");

  try {
    // Log the raw data received from the AHK script
    const postData = e.postData.contents;
    Logger.log("Received data: " + postData);

    // Parse the JSON data
    const data = JSON.parse(postData);
    const eventText = data.event;
    const heatText = data.heat;
    Logger.log("Parsed Event: " + eventText + ", Parsed Heat: " + heatText);

    // Get the active spreadsheet and the first sheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    
    // --- NEW: Get the current date and time ---
    const timestamp = new Date();

    // Set the values in the specific cells
    sheet.getRange("A2").setValue(eventText);
    sheet.getRange("B2").setValue(heatText);
    // --- NEW: Set the timestamp in cell C2 ---
    sheet.getRange("C2").setValue(timestamp);
    
    Logger.log("Successfully updated cells A2, B2, and C2.");

    // Return a success message
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "message": "Sheet updated successfully."
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Log the error if something went wrong
    Logger.log("Error occurred: " + error.toString());

    // Return an error message
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}