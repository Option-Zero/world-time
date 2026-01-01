const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto('http://localhost:8001');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'clock-screenshot.png', fullPage: true });
  await browser.close();
  console.log('Screenshot saved to clock-screenshot.png');
})();
