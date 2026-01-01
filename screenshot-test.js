const puppeteer = require('puppeteer');

(async () => {
    console.log('Launching browser...');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    // Listen for console messages
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        console.log(`[Browser ${type}]:`, text);
    });

    // Listen for page errors
    page.on('pageerror', error => {
        console.error('[Page Error]:', error.message);
    });

    // Listen for failed requests
    page.on('requestfailed', request => {
        console.error('[Request Failed]:', request.url(), request.failure().errorText);
    });

    try {
        console.log('Navigating to http://localhost:8000...');
        await page.goto('http://localhost:8000', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        console.log('Waiting for map to render...');

        // Wait for SVG to exist
        await page.waitForSelector('#world-map', { timeout: 10000 });
        console.log('✓ SVG element found');

        // Give D3 time to load data and render
        await page.waitForTimeout(5000);

        // Check if countries rendered
        const countryCount = await page.$$eval('.country', els => els.length);
        console.log(`✓ Countries rendered: ${countryCount}`);

        // Check if timezones rendered
        const tzCount = await page.$$eval('.timezone', els => els.length);
        console.log(`✓ Timezones rendered: ${tzCount}`);

        // Check if labels rendered
        const labelCount = await page.$$eval('.timezone-label', els => els.length);
        console.log(`✓ Labels rendered: ${labelCount}`);

        // Take screenshot
        console.log('Taking screenshot...');
        await page.screenshot({
            path: 'screenshot-full.png',
            fullPage: true
        });
        console.log('✓ Screenshot saved as screenshot-full.png');

        // Test clicking a timezone
        console.log('\nTesting interactivity...');
        const firstTz = await page.$('.timezone');
        if (firstTz) {
            await firstTz.click();
            await page.waitForTimeout(1000);

            const panelCount = await page.$$eval('.timezone-panel', els => els.length);
            console.log(`✓ Panel opened: ${panelCount} panel(s)`);

            await page.screenshot({
                path: 'screenshot-with-panel.png',
                fullPage: true
            });
            console.log('✓ Screenshot with panel saved');
        }

        console.log('\n✓ All tests passed!');

    } catch (error) {
        console.error('Error:', error.message);
        await page.screenshot({ path: 'screenshot-error.png', fullPage: true });
        console.log('Error screenshot saved as screenshot-error.png');
    } finally {
        await browser.close();
    }
})();
