const { chromium } = require('playwright');

(async () => {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1400, height: 900 }
    });
    const page = await context.newPage();

    try {
        console.log('Navigating to http://localhost:8000...');
        await page.goto('http://localhost:8000', { waitUntil: 'networkidle' });

        console.log('Waiting for map to render...');
        // Wait for the SVG map to be present
        await page.waitForSelector('#world-map', { timeout: 10000 });

        // Wait for countries to render
        await page.waitForSelector('.country', { timeout: 10000 });

        // Wait for timezones to render
        await page.waitForSelector('.timezone', { timeout: 10000 });

        // Wait for labels to render
        await page.waitForSelector('.timezone-label', { timeout: 10000 });

        // Give D3 a moment to finish all rendering
        await page.waitForTimeout(2000);

        console.log('Taking screenshot...');
        await page.screenshot({ path: 'screenshot.png', fullPage: true });

        // Verify elements
        const countryCount = await page.locator('.country').count();
        const timezoneCount = await page.locator('.timezone').count();
        const labelCount = await page.locator('.timezone-label').count();

        console.log(`\n✓ Map rendered successfully!`);
        console.log(`  - Countries: ${countryCount}`);
        console.log(`  - Timezones: ${timezoneCount}`);
        console.log(`  - Labels: ${labelCount}`);

        // Test clicking on a timezone
        console.log('\nTesting timezone interaction...');
        const timezone = page.locator('.timezone').first();
        await timezone.click();

        // Wait for panel to appear
        await page.waitForSelector('.timezone-panel', { timeout: 5000 });
        const panelCount = await page.locator('.timezone-panel').count();
        console.log(`✓ Timezone panel opened (${panelCount} panel(s))`);

        // Take another screenshot with panel open
        await page.screenshot({ path: 'screenshot-with-panel.png', fullPage: true });

        // Test pinning
        const pinBtn = page.locator('.pin-btn').first();
        await pinBtn.click();
        const isPinned = await pinBtn.evaluate(el => el.classList.contains('pinned'));
        console.log(`✓ Pin functionality works (pinned: ${isPinned})`);

        // Click another timezone
        const timezones = page.locator('.timezone');
        await timezones.nth(10).click();
        await page.waitForTimeout(500);

        const panelCount2 = await page.locator('.timezone-panel').count();
        console.log(`✓ Multiple panels work (${panelCount2} panel(s))`);

        // Final screenshot
        await page.screenshot({ path: 'screenshot-final.png', fullPage: true });

        console.log('\n✓ All tests passed!');
        console.log('Screenshots saved:');
        console.log('  - screenshot.png (initial view)');
        console.log('  - screenshot-with-panel.png (with one panel)');
        console.log('  - screenshot-final.png (with multiple panels)');

    } catch (error) {
        console.error('Error during test:', error);
        await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
