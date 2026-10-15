from playwright.sync_api import sync_playwright

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 1000, "height": 1400}
        )
        page = context.new_page()
        page.goto("file:///home/jules/verification/preview.html")
        page.wait_for_timeout(1000)

        page.screenshot(path="/home/jules/verification/screenshots/observed_step_preview.png", full_page=True)
        page.wait_for_timeout(1000)

        context.close()
        browser.close()

if __name__ == "__main__":
    run_verification()
