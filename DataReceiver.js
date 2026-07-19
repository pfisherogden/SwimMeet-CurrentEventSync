// DataReceiver.js - SwimMeet-CurrentEventSync

const SHEET_NAME = "Sheet1"; // Default sheet name created by setup-meet
const CACHE_KEY = "scoreboard_state";
const CACHE_TTL_SEC = 1800; // 30 minutes cache

/**
 * Helper to get the target sheet and initialize if empty.
 */
function getScoreboardSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Spreadsheet context not found.");
  const sheets = ss.getSheets();
  return sheets[0]; // Always use the first sheet
}

/**
 * Reads state directly from the sheet and caches it.
 */
function readSheetAndCache(sheet) {
  const values = sheet.getRange("A2:C2").getValues()[0];
  const state = {
    event: Number(values[0]) || 1,
    heat: Number(values[1]) || 1,
    timestamp: Number(values[2]) || new Date().getTime()
  };
  
  const cache = CacheService.getScriptCache();
  cache.put(CACHE_KEY, JSON.stringify(state), CACHE_TTL_SEC);
  return state;
}

/**
 * GET Handler: Polled by controllers. Minimizes read latency via CacheService.
 */
function doGet(e) {
  const cache = CacheService.getScriptCache();
  const cachedVal = cache.get(CACHE_KEY);
  
  let state;
  if (cachedVal) {
    try {
      state = JSON.parse(cachedVal);
    } catch (err) {
      const sheet = getScoreboardSheet();
      state = readSheetAndCache(sheet);
    }
  } else {
    const sheet = getScoreboardSheet();
    state = readSheetAndCache(sheet);
  }
  
  return ContentService.createTextOutput(JSON.stringify(state))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST Handler: Handles updates with script locks and optimistic locking checks.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Acquire script lock for up to 5 seconds to prevent race conditions during updates
    if (!lock.tryLock(5000)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Lock timeout: Another controller is currently writing."
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (!e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Missing request body"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Parse the payload (sent as simple text/plain to bypass CORS preflights)
    const requestData = JSON.parse(e.postData.contents);
    
    let newEvent = requestData.event;
    let newHeat = requestData.heat;
    
    // Check if event is a string (e.g. from AHK "Event: 5") and extract numbers
    if (typeof newEvent === "string") {
      const match = newEvent.match(/Event:\s*(\d+)/i);
      newEvent = match ? Number(match[1]) : Number(newEvent);
    } else {
      newEvent = Number(newEvent);
    }
    
    if (typeof newHeat === "string") {
      const match = newHeat.match(/Heat:\s*(\d+)/i);
      newHeat = match ? Number(match[1]) : Number(newHeat);
    } else {
      newHeat = Number(newHeat);
    }
    
    const clientTimestamp = Number(requestData.timestamp) || new Date().getTime();
    const expectedTimestamp = Number(requestData.expectedTimestamp) || 0;
    
    if (isNaN(newEvent) || isNaN(newHeat)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Event and Heat must be valid numbers"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = getScoreboardSheet();
    
    // Concurrency Check: Read cache first for speed, falling back to Sheet
    const cache = CacheService.getScriptCache();
    let currentState;
    const cachedVal = cache.get(CACHE_KEY);
    if (cachedVal) {
      try {
        currentState = JSON.parse(cachedVal);
      } catch (err) {
        currentState = readSheetAndCache(sheet);
      }
    } else {
      currentState = readSheetAndCache(sheet);
    }
    
    // Optimistic Concurrency check: reject if another controller wrote a newer state
    if (expectedTimestamp > 0 && currentState.timestamp > expectedTimestamp) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        code: 409,
        currentState: currentState
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Write new values to spreadsheet
    sheet.getRange("A2:C2").setValues([[newEvent, newHeat, clientTimestamp]]);
    
    // Set active sheet time zone
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.setSpreadsheetTimeZone("America/Los_Angeles");
    
    // Update Cache immediately
    const updatedState = {
      event: newEvent,
      heat: newHeat,
      timestamp: clientTimestamp
    };
    cache.put(CACHE_KEY, JSON.stringify(updatedState), CACHE_TTL_SEC);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      state: updatedState
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * onEdit Trigger: Catches manual spreadsheet changes and synchronizes the cache.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const range = e.range;
  const sheet = range.getSheet();
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const firstSheet = ss.getSheets()[0];
  
  if (sheet.getName() === firstSheet.getName()) {
    const row = range.getRow();
    const col = range.getColumn();
    
    // If cell A2 (Event) or B2 (Heat) is updated, sync cache
    if (row === 2 && (col === 1 || col === 2)) {
      readSheetAndCache(sheet);
    }
  }
}
