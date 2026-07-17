import pytest
from playwright.sync_api import Page, expect
import os

def test_controller_manual_adjustments(page: Page):
    controller_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../docs/controller.html"))
    page.goto(f"file:///{controller_path}")

    # Set local storage mocks to avoid unconfigured warnings
    page.evaluate("localStorage.clear();")
    page.reload()

    # Verify initial state
    expect(page.locator("#event-val")).to_have_text("1")
    expect(page.locator("#heat-val")).to_have_text("1")

    # Increment Event
    page.click("#event-inc")
    expect(page.locator("#event-val")).to_have_text("2")
    # Reset heat to 1 on event increment
    expect(page.locator("#heat-val")).to_have_text("1")

    # Decrement Event
    page.click("#event-dec")
    expect(page.locator("#event-val")).to_have_text("1")

    # Increment Heat
    page.click("#heat-inc")
    expect(page.locator("#heat-val")).to_have_text("2")

    # Decrement Heat
    page.click("#heat-dec")
    expect(page.locator("#heat-val")).to_have_text("1")

def test_controller_csv_sequence_stepping(page: Page):
    controller_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../docs/controller.html"))
    page.goto(f"file:///{controller_path}")

    # Inject mock CSV parsing directly into the controller's runtime state to simulate loading events.csv
    mock_csv = (
        "1,GIRLS 8&U 100 MEDLEY RELAY,2,1,A\n"
        "2,BOYS 8&U 100 MEDLEY RELAY,1,1,A\n"
        "3,GIRLS 9-10 100 MEDLEY RELAY,3,1,A\n"
    )
    
    # We trigger the app's internal parser by calling the same handler
    page.evaluate(f"window.localStorage.clear();")
    page.reload()
    
    # Use standard file upload testing or evaluate the set/render directly
    # Since we want to test E2E UI flow, we can trigger the parseAndSetEvents logic by injecting the file
    # Or, we can just trigger file upload using Playwright's file chooser:
    csv_file_path = os.path.join(os.path.dirname(__file__), "mock_events.csv")
    with open(csv_file_path, "w") as f:
        f.write(mock_csv)
        
    try:
        with page.expect_file_chooser() as fc_info:
            page.click("#file-uploader-container label")
        file_chooser = fc_info.value
        file_chooser.set_files(csv_file_path)

        # Wait for the program flow list to render
        expect(page.locator("#events-count-badge")).to_have_text("3 Events")
        expect(page.locator("#active-event-title")).to_have_text("Event 1: GIRLS 8&U 100 MEDLEY RELAY")
        expect(page.locator("#active-event-heats")).to_have_text("Active Heat 1 of 2 Heats")

        # 1. Step Next Heat (Event 1, Heat 1 -> Event 1, Heat 2)
        page.click("#heat-inc")
        expect(page.locator("#event-val")).to_have_text("1")
        expect(page.locator("#heat-val")).to_have_text("2")
        expect(page.locator("#active-event-heats")).to_have_text("Active Heat 2 of 2 Heats")

        # 2. Step Next Heat (Event 1, Heat 2 -> Event 2, Heat 1 - Event 1 has 2 heats max)
        page.click("#heat-inc")
        expect(page.locator("#event-val")).to_have_text("2")
        expect(page.locator("#heat-val")).to_have_text("1")
        expect(page.locator("#active-event-title")).to_have_text("Event 2: BOYS 8&U 100 MEDLEY RELAY")

        # 3. Step Next Heat (Event 2, Heat 1 -> Event 3, Heat 1 - Event 2 has 1 heat max)
        page.click("#heat-inc")
        expect(page.locator("#event-val")).to_have_text("3")
        expect(page.locator("#heat-val")).to_have_text("1")
        expect(page.locator("#active-event-title")).to_have_text("Event 3: GIRLS 9-10 100 MEDLEY RELAY")

        # 4. Step Prev Heat (Event 3, Heat 1 -> Event 2, Heat 1)
        page.click("#heat-dec")
        expect(page.locator("#event-val")).to_have_text("2")
        expect(page.locator("#heat-val")).to_have_text("1")

        # 5. Step Prev Heat (Event 2, Heat 1 -> Event 1, Heat 2)
        page.click("#heat-dec")
        expect(page.locator("#event-val")).to_have_text("1")
        expect(page.locator("#heat-val")).to_have_text("2")

        # 6. Step Next Event directly (Event 1 -> Event 2)
        page.click("#event-inc")
        expect(page.locator("#event-val")).to_have_text("2")
        expect(page.locator("#heat-val")).to_have_text("1")

        # 7. Click list item directly to jump (Click Event 3)
        page.click(".event-list-item[data-event-num='3']")
        expect(page.locator("#event-val")).to_have_text("3")
        expect(page.locator("#heat-val")).to_have_text("1")
        
    finally:
        if os.path.exists(csv_file_path):
            os.remove(csv_file_path)

def test_controller_config_modal(page: Page):
    controller_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../docs/controller.html"))
    page.goto(f"file:///{controller_path}")

    # Modal should be hidden initially
    expect(page.locator("#config-modal")).to_be_hidden()

    # Open modal
    page.click("#header-config-btn")
    expect(page.locator("#config-modal")).to_be_visible()

    # Fill URL
    page.fill("#web-app-url-input", "https://script.google.com/macros/s/TEST_URL/exec")
    page.click("#save-config-btn")

    # Modal should close
    expect(page.locator("#config-modal")).to_be_hidden()

    # Verify settings persisted in localStorage
    saved_url = page.evaluate("localStorage.getItem('G_WEB_APP_URL')")
    assert saved_url == "https://script.google.com/macros/s/TEST_URL/exec"

def test_tauri_internals_without_global_tauri_fallback(page: Page):
    errors = []
    page.on("pageerror", lambda err: errors.append(err))

    # Mock network requests to Google Apps Script to isolate test execution
    page.route("https://script.google.com/**", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"status":"success"}'
    ))

    # Simulate Tauri environment detection trigger, but __TAURI__ undefined
    page.add_init_script("""
        window.__TAURI_INTERNALS__ = {};
        window.__TAURI__ = undefined;
    """)
    controller_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../docs/controller.html"))
    page.goto(f"file:///{controller_path}")

    # Set mock URL to trigger sync path on save
    page.click("#header-config-btn")
    page.fill("#web-app-url-input", "https://script.google.com/macros/s/TEST_URL/exec")
    page.click("#save-config-btn")

    # Wait for async operation to run
    page.wait_for_timeout(500)

    # The sync status should not fail with the TypeError about undefined 'core'
    expect(page.locator("#sync-status-text")).not_to_contain_text("Cannot read properties")
    assert not errors, f"Uncaught page errors occurred: {errors}"

def test_toast_dismissal_on_click(page: Page):
    controller_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../docs/controller.html"))
    page.goto(f"file:///{controller_path}")

    # Set mock CSV input content to trigger toast
    mock_csv = "1,GIRLS 8&U 100 MEDLEY RELAY,2,1,A\n"
    csv_file_path = os.path.join(os.path.dirname(__file__), "mock_toast_events.csv")
    with open(csv_file_path, "w") as f:
        f.write(mock_csv)

    try:
        with page.expect_file_chooser() as fc_info:
            page.click("#file-uploader-container label")
        file_chooser = fc_info.value
        file_chooser.set_files(csv_file_path)

        # Confirm toast is visible
        toast_selector = "#toast-container div"
        expect(page.locator(toast_selector)).to_be_visible()

        # Click on the toast element to dismiss it
        page.click(toast_selector)

        # Confirm toast is immediately removed from DOM
        expect(page.locator(toast_selector)).to_have_count(0)

    finally:
        if os.path.exists(csv_file_path):
            os.remove(csv_file_path)
