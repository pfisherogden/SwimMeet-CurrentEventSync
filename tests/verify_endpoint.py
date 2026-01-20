# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "requests",
# ]
# ///

import json
import time
import json
import time
import requests
import sys
import random
from pathlib import Path

SETTINGS_FILE = "test_settings.json"

def load_settings():
    settings_path = Path(__file__).parent / SETTINGS_FILE
    if not settings_path.exists():
        print(f"Error: {SETTINGS_FILE} not found at {settings_path}")
        sys.exit(1)
    
    try:
        with open(settings_path, "r") as f:
            settings = json.load(f)
            return settings
    except Exception as e:
        print(f"Error reading {SETTINGS_FILE}: {e}")
        sys.exit(1)

def verify_endpoint():
    print("--- Google Spreadsheet Endpoint Verification ---")
    
    settings = load_settings()
    url = settings.get("G_WEB_APP_URL")
    
    if not url or url == "PASTE_YOUR_URL_HERE":
        print(f"Error: Please configure 'G_WEB_APP_URL' in {SETTINGS_FILE}")
        sys.exit(1)

    sheet_url = settings.get("G_SHEET_URL")
    sheet_csv_url = None
    
    if sheet_url and "docs.google.com/spreadsheets" in sheet_url:
        # Simple extraction of Sheet ID assuming standard URL format
        try:
            # Extract ID usually between /d/ and /
            start_marker = "/d/"
            start_index = sheet_url.find(start_marker)
            if start_index != -1:
                end_index = sheet_url.find("/", start_index + len(start_marker))
                if end_index != -1:
                    sheet_id = sheet_url[start_index + len(start_marker):end_index]
                    sheet_csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
        except Exception:
            pass
            
    if not sheet_csv_url:
        print("Warning: 'G_SHEET_URL' not provided or invalid. Skipping sheet content verification.")

    print(f"Target URL: {url}")
    print("Starting 20 iterations...")

    # Set up session for efficiency
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    for i in range(1, 21):
        event_str = f"Test Event {i}"
        heat_str = f"Heat {random.randint(1, 6)}"
        
        payload = {
            "event": event_str,
            "heat": heat_str
        }

        print(f"[{i}/20] Sending: {payload} ... ", end="", flush=True)

        try:
            start_time = time.time()
            response = session.post(url, json=payload, timeout=20)
            post_duration = time.time() - start_time
            elapsed_ms = post_duration * 1000

            if response.status_code == 200:
                print(f"POST OK ({elapsed_ms:.0f}ms)", end="")
                
                if sheet_csv_url:
                    # Dynamic delay: wait longer than the POST took, plus a buffer
                    # User requested verify duration > POST duration.
                    wait_time = post_duration * 1.5 
                    if wait_time < 2.0: wait_time = 2.0 # Minimum reasonable wait
                    
                    print(f" -> Waiting {wait_time:.1f}s to verify... ", end="", flush=True)
                    time.sleep(wait_time)
                    
                    verify_start = time.time()
                    try:
                        csv_resp = session.get(sheet_csv_url, timeout=10)
                        if csv_resp.status_code == 200:
                            # Basic CSV parsing: split by lines, then comma
                            lines = csv_resp.text.strip().splitlines()
                            # Expecting Row 2 (index 1) to have the data. 
                            # Note: Row 1 is usually headers.
                            if len(lines) >= 2:
                                # Simple check: does the line contain our strings?
                                # This avoids complex CSV quoting issues for simple strings
                                row_data = lines[1] 
                                if event_str in row_data and heat_str in row_data:
                                    verify_time = (time.time() - verify_start) * 1000
                                    print(f"VERIFIED in {verify_time:.0f}ms", end="")
                                else:
                                    print(f"MISMATCH (Got: {row_data})", end="")
                            else:
                                print("EMPTY/SHORT CSV", end="")
                        else:
                            print(f"CSV FAIL ({csv_resp.status_code})", end="")
                    except Exception as ve:
                        print(f"Verify Error: {ve}", end="")

                print("") # Newline
            else:
                print(f"FAILED ({response.status_code}) - {response.text}")
        
        except requests.RequestException as e:
            print(f"ERROR: {e}")

        # Increased loop delay to allow system to settle
        time.sleep(1.0)

    print("\nTest completed.")

if __name__ == "__main__":
    verify_endpoint()
