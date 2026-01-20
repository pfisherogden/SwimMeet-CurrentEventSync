#Requires AutoHotkey v2.0
#SingleInstance Force

; ======================================================================================================================
; Dolphin Scoreboard Extractor (Google Sheets Integration)
;
; This script automatically extracts Event/Heat data from Dolphin50.exe and sends it to a Google Sheet.
; It uses an efficient polling method with control ID caching and improved error reporting.
; ======================================================================================================================

; --- PASTE YOUR LATEST GOOGLE WEB APP URL HERE ---
; Make sure this is the URL from your most recent deployment.
G_WEB_APP_URL := "PASTE_YOUR_URL_HERE"

; --- Set the target window using its executable name ---
AppName := "ahk_exe Dolphin50.exe"

; --- Start a recurring timer to check for updates every 500 milliseconds ---
SetTimer(ExtractScoreboardInfo, 500)

; --- Main function to find and extract the data ---
ExtractScoreboardInfo() {
    ; --- Static variables to cache control IDs and previous text values ---
    static eventControlID := ""
    static heatControlID := ""
    static lastEventText := ""
    static lastHeatText := ""
    
    if not WinActive(AppName) {
        return
    }

    ; --- Initialize variables to store the current text. This prevents warnings. ---
    local currentEventText := ""
    local currentHeatText := ""

    ; --- Get text using cached control IDs if available ---
    if (eventControlID != "" and heatControlID != "") {
        try {
            currentEventText := ControlGetText(eventControlID, AppName)
            currentHeatText := ControlGetText(heatControlID, AppName)
        } catch {
            eventControlID := ""
            heatControlID := ""
        }
    }

    ; --- If cache failed or was empty, perform the full scan ---
    if (eventControlID = "" or heatControlID = "") {
        ControlList := WinGetControls(AppName)
        for control in ControlList {
            try {
                tempText := ControlGetText(control, AppName)
            } catch {
                continue
            }

            if InStr(tempText, "Event:") {
                currentEventText := tempText
                eventControlID := control
            } else if InStr(tempText, "Heat:") {
                currentHeatText := tempText
                heatControlID := control
            }
            
            if (eventControlID != "" and heatControlID != "") {
                break
            }
        }
    }

    currentEventText := Trim(currentEventText)
    currentHeatText := Trim(currentHeatText)

    ; --- Check if the text has actually changed since the last check ---
    if (currentEventText != lastEventText or currentHeatText != lastHeatText) {
        if (currentEventText != "" and currentHeatText != "") {
            ; --- ACTION 1: Send the update to Google Sheets ---
            PublishToGoogleSheet(currentEventText, currentHeatText)

            ; --- Update the "last known" values for the next check ---
            lastEventText := currentEventText
            lastHeatText := currentHeatText
        }
    }
}

; --- Function to send data to the Google Sheet Web App ---
PublishToGoogleSheet(event, heat) {
    global G_WEB_APP_URL
    if (G_WEB_APP_URL = "PASTE_YOUR_URL_HERE") {
        MsgBox("Error: Google Web App URL is not set in the script.", "Configuration Error", "IconX")
        return
    }

    local escapedEvent := StrReplace(event, '"', '\"')
    local escapedHeat := StrReplace(heat, '"', '\"')
    local payload := '{"event":"' . escapedEvent . '","heat":"' . escapedHeat . '"}'

    try {
        ; --- CORRECTED: Use the standard ComObject method for web requests in AHKv2 ---
        whr := ComObject("WinHttp.WinHttpRequest.5.1")
        whr.Open("POST", G_WEB_APP_URL, true) ; true for asynchronous
        whr.SetRequestHeader("Content-Type", "application/json")
        whr.Send(payload)
        
        whr.WaitForResponse()

        if (whr.Status = 200) {
            ToolTip("Update Sent Successfully:`n" . event . "`n" . heat, , , 1)
            SetTimer () => ToolTip(), -3000
        } else {
            ; --- If not successful, show a detailed error tooltip ---
            local errorText := "Google Sheets Update FAILED!`n"
            errorText .= "Status: " . whr.Status . " " . whr.StatusText . "`n"
            errorText .= "Response: " . whr.ResponseText
            ToolTip(errorText, , , 2) ; Show tooltip for longer
            SetTimer () => ToolTip(), -8000
        }
    } catch Any as e {
        ToolTip("Failed to send web request! Error: " . e.Message, , , 1)
        SetTimer () => ToolTip(), -5000
    }
}