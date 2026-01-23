import pytest
from playwright.sync_api import Page, expect
import os

def test_mobile_viewport(page: Page):
    # Set viewport to iPhone 13 (390x844)
    page.set_viewport_size({"width": 390, "height": 844})
    
    docs_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../docs/index.html"))
    page.goto(f"file:///{docs_path}?offline=true")

    # Wait for the content to load and specifically for data to populate
    expect(page.get_by_text("Offline Demo")).to_be_visible()
    
    # Wait for the specific mock data values to appear
    # This ensures the DOM updated
    expect(page.locator("#event-display")).to_have_text("99")
    expect(page.locator("#heat-display")).to_have_text("10")
    
    # Check that key elements are visible in view
    expect(page.locator("#event-display")).to_be_visible()
    
    # Validation: Ensure content fits within the viewport (Mobile fix check)
    heat_box = page.locator(".heat-card")
    heat_box_bbox = heat_box.bounding_box()
    viewport_size = page.viewport_size
    
    # Assert that the bottom of the heat card is within the viewport height
    # We add a small buffer (e.g., footer height) or just strict check
    assert heat_box_bbox['y'] + heat_box_bbox['height'] < viewport_size['height'], \
        f"Heat box bottom ({heat_box_bbox['y'] + heat_box_bbox['height']}) is outside viewport ({viewport_size['height']})"

    # Take a screenshot
    page.screenshot(path="tests/output/iphone13_offline.png")

def test_desktop_viewport(page: Page):
    page.set_viewport_size({"width": 1920, "height": 1080})
    
    docs_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../docs/index.html"))
    page.goto(f"file:///{docs_path}?offline=true")

    expect(page.get_by_text("Offline Demo")).to_be_visible()
    expect(page.locator("#event-display")).to_have_text("99")
    expect(page.locator("#heat-display")).to_have_text("10")
    
    # Validation: Ensure font size is using the larger Desktop scaling (20vh)
    # 20vh of 1080px = 216px. 
    # Mobile would be 15vh = 162px.
    # Let's check it's > 200px to confirm desktop style is applied.
    
    event_val = page.locator("#event-display")
    font_size_str = event_val.evaluate("el => window.getComputedStyle(el).fontSize")
    font_size_px = float(font_size_str.replace("px", ""))
    
    assert font_size_px > 200, f"Desktop font size ({font_size_px}px) seems too small, expected > 200px (20vh)"
    
    page.screenshot(path="tests/output/desktop_offline.png")

def test_tablet_viewport(page: Page):
    # iPad Air (820x1180)
    page.set_viewport_size({"width": 820, "height": 1180})
    
    docs_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../docs/index.html"))
    page.goto(f"file:///{docs_path}?offline=true")

    expect(page.get_by_text("Offline Demo")).to_be_visible()
    expect(page.locator("#event-display")).to_have_text("99")
    expect(page.locator("#heat-display")).to_have_text("10")
    
    page.screenshot(path="tests/output/tablet_offline.png")
