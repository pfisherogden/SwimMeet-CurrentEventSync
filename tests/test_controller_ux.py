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

def test_outdoor_mode_text_contrast(page: Page):
    controller_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../docs/controller.html"))
    page.goto(f"file:///{controller_path}")

    # Confirm title defaults to light/medium gray color in standard dark mode
    title_element = page.locator("#active-event-panel h2")
    default_color = title_element.evaluate("el => window.getComputedStyle(el).color")
    # In standard dark mode, text-gray-200 is rgb(229, 231, 235)
    assert default_color == "rgb(229, 231, 235)"

    # Enable Outdoor Contrast Mode
    page.click("#outdoor-mode-btn")
    body_class = page.locator("body").evaluate("el => el.className")
    assert "outdoor-mode" in body_class

    # Assert color of event title element has switched to dark high-contrast color
    outdoor_color = title_element.evaluate("el => window.getComputedStyle(el).color")
    assert outdoor_color in ["rgb(17, 24, 39)", "rgb(0, 0, 0)"]

def test_responsive_tabbed_navigation(page: Page):
    controller_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../docs/controller.html"))
    
    # 1. Set a narrow screen size (800px width - e.g., mobile/tablet or split-screen)
    page.set_viewport_size({"width": 800, "height": 600})
    page.goto(f"file:///{controller_path}")

    # Confirm tab list is visible and controller section is active
    expect(page.locator("div[role='tablist']")).to_be_visible()
    expect(page.locator("#section-controller")).to_be_visible()
    expect(page.locator("#section-program")).to_be_hidden()

    # Click Meet Program tab
    page.click("#tab-program")
    expect(page.locator("#section-controller")).to_be_hidden()
    expect(page.locator("#section-program")).to_be_visible()

    # Keyboard hotkey: Alt+1 should switch back to Controller
    page.keyboard.press("Alt+1")
    expect(page.locator("#section-controller")).to_be_visible()
    expect(page.locator("#section-program")).to_be_hidden()

    # Keyboard hotkey: Alt+2 should switch to Meet Program
    page.keyboard.press("Alt+2")
    expect(page.locator("#section-controller")).to_be_hidden()
    expect(page.locator("#section-program")).to_be_visible()

    # 2. Resize to a wide display (1200px width)
    page.set_viewport_size({"width": 1200, "height": 800})
    
    # Tab list should be hidden, and both sections should be displayed side-by-side
    expect(page.locator("div[role='tablist']")).to_be_hidden()
    expect(page.locator("#section-controller")).to_be_visible()
    expect(page.locator("#section-program")).to_be_visible()

def test_mobile_header_fit_and_no_overflow(page: Page):
    controller_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../docs/controller.html"))
    
    # Set to typical narrow mobile viewport (iPhone 16 / iPhone 15 size is approx 393x852)
    page.set_viewport_size({"width": 393, "height": 852})
    page.goto(f"file:///{controller_path}")

    # Verify that settings gear box button exists and is visible on screen
    expect(page.locator("#header-config-btn")).to_be_visible()

    # Query if there is horizontal window overflow (element scrollWidth exceeding clientWidth)
    has_horizontal_overflow = page.evaluate("""() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth ||
               document.body.scrollWidth > window.innerWidth;
    }""")
    assert not has_horizontal_overflow, "Header overflow detected on mobile width! Elements are pushing the gear button off-screen."

def test_event_count_badge_contrast(page: Page):
    controller_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../docs/controller.html"))
    csv_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "temp_events.csv"))

    csv_content = """Event,Description,Heats
1,GIRLS 8&U 100 MEDLEY RELAY,2
2,BOYS 8&U 100 MEDLEY RELAY,1
"""
    try:
        with open(csv_file_path, "w") as f:
            f.write(csv_content)

        page.goto(f"file:///{controller_path}")

        # Upload the CSV
        with page.expect_file_chooser() as fc_info:
            page.click("#file-uploader-container label")
        file_chooser = fc_info.value
        file_chooser.set_files(csv_file_path)

        # Confirm badge is visible
        badge = page.locator("#events-count-badge")
        expect(badge).to_be_visible()

        # 1. Assert Normal Mode contrast (text-gray-200 should be rgb(229, 231, 235))
        normal_text_color = badge.evaluate("el => window.getComputedStyle(el).color")
        assert normal_text_color == "rgb(229, 231, 235)"

        # 2. Toggle Outdoor Contrast Mode
        page.click("#outdoor-mode-btn")
        
        # Assert Outdoor Mode contrast (text color should switch to high contrast dark #111827 / black)
        outdoor_text_color = badge.evaluate("el => window.getComputedStyle(el).color")
        assert outdoor_text_color in ["rgb(17, 24, 39)", "rgb(0, 0, 0)"]

        # Assert Outdoor Mode background color is light gray (rgb(243, 244, 246))
        outdoor_bg_color = badge.evaluate("el => window.getComputedStyle(el).backgroundColor")
        assert outdoor_bg_color == "rgb(243, 244, 246)"

    finally:
        if os.path.exists(csv_file_path):
            os.remove(csv_file_path)
