const puppeteer = require('puppeteer-core');

(async () => {
  console.log('========================================================');
  console.log('  TESTING STAGE B: REAL VRM LOADING & THREE.JS RENDERING');
  console.log('========================================================');

  console.log('[Puppeteer] Launching Chrome with MediaStream test flags...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('Download the React DevTools') && !text.includes('vite:')) {
      console.log('[Browser Console]', text);
    }
  });

  page.on('pageerror', err => {
    console.error('[Browser PageError]', err.message);
  });

  console.log('[Puppeteer] Navigating to http://localhost:3000/#3d-avatar-mirror ...');
  await page.goto('http://localhost:3000/#3d-avatar-mirror', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Monitor for 10 seconds to allow Three.js scene setup + VRM loading + MediaPipe start
  console.log('[Puppeteer] Monitoring 3D Avatar Scene for 10 seconds...');
  let latestMetrics = null;

  for (let s = 1; s <= 10; s++) {
    await new Promise(r => setTimeout(r, 1000));
    const metrics = await page.evaluate(() => {
      const headerTitle = document.querySelector('.avatar-header-title')?.innerText || 'none';
      const techBadge = document.querySelector('.avatar-tech-badge')?.innerText || 'none';
      const hudPills = Array.from(document.querySelectorAll('.avatar-hud-pill')).map(p => p.innerText.trim());
      const statusTitle = document.querySelector('.status-title')?.innerText || 'none';
      const metricChips = Array.from(document.querySelectorAll('.status-metric-chip')).map(c => {
        const l = c.querySelector('.metric-label')?.innerText;
        const v = c.querySelector('.metric-val')?.innerText;
        return `${l}: ${v}`;
      });

      const threeCanvas = document.querySelector('.avatar-3d-scene-container canvas');
      const hasThreeCanvas = Boolean(threeCanvas);
      const canvasWidth = threeCanvas ? threeCanvas.width : 0;
      const canvasHeight = threeCanvas ? threeCanvas.height : 0;

      const hasError = document.querySelector('.avatar-error-banner')?.innerText || null;
      const isLoading = Boolean(document.querySelector('.avatar-loading-overlay'));

      return {
        headerTitle,
        techBadge,
        statusTitle,
        hudPills,
        metricChips,
        hasThreeCanvas,
        canvasWidth,
        canvasHeight,
        isLoading,
        hasError
      };
    });

    console.log(`[T+${s}s] Loading: ${metrics.isLoading} | ThreeCanvas: ${metrics.hasThreeCanvas} (${metrics.canvasWidth}x${metrics.canvasHeight}) | HUD: [${metrics.hudPills.join(' | ')}]`);
    latestMetrics = metrics;

    if (metrics.hasError) {
      console.error('[Puppeteer] Error detected on page:', metrics.hasError);
      break;
    }
  }

  console.log('\n[Puppeteer] Final Diagnostics State:');
  console.log(JSON.stringify(latestMetrics, null, 2));

  // Test Exit Mirror to verify cleanup
  console.log('\n[Puppeteer] Testing "Exit Mirror" back navigation & cleanup...');
  await page.click('.avatar-btn-back');
  await new Promise(r => setTimeout(r, 1000));

  const currentUrl = page.url();
  console.log('[Puppeteer] URL after Exit:', currentUrl);

  const onWelcomeScreen = await page.evaluate(() => {
    return Boolean(document.querySelector('.welcome-main-heading') || document.querySelector('.welcome-fullscreen-root'));
  });
  console.log('[Puppeteer] Successfully returned to Welcome screen:', onWelcomeScreen);

  await browser.close();
  console.log('[Puppeteer] Chrome closed cleanly.');
})();
