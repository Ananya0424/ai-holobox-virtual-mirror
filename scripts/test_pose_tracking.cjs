const puppeteer = require('puppeteer-core');

(async () => {
  console.log('========================================================');
  console.log('  TESTING LOCAL MEDIAPIPE POSE TRACKER (STAGE A)');
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

  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (!text.includes('Download the React DevTools') && !text.includes('vite:')) {
      console.log('[Browser Console]', text);
    }
  });

  page.on('pageerror', err => {
    console.error('[Browser PageError]', err.message);
  });

  console.log('[Puppeteer] Navigating to http://localhost:3000/#3d-avatar-mirror ...');
  await page.goto('http://localhost:3000/#3d-avatar-mirror', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Monitor for 8 seconds
  console.log('[Puppeteer] Monitoring Stage A Pose Tracking for 8 seconds...');
  let latestMetrics = null;

  for (let s = 1; s <= 8; s++) {
    await new Promise(r => setTimeout(r, 1000));
    const metrics = await page.evaluate(() => {
      const headerTitle = document.querySelector('.avatar-header-title')?.innerText || 'none';
      const techBadge = document.querySelector('.avatar-tech-badge')?.innerText || 'none';
      const delegateBadge = document.querySelector('.avatar-delegate-badge')?.innerText || 'none';
      const hudPills = Array.from(document.querySelectorAll('.avatar-hud-pill')).map(p => p.innerText.trim());
      const jointChips = Array.from(document.querySelectorAll('.diag-joint-chip')).map(c => {
        const name = c.querySelector('.joint-name')?.innerText;
        const status = c.querySelector('.joint-status')?.innerText;
        return `${name}: ${status}`;
      });
      const canvas = document.querySelector('.avatar-skeleton-canvas');
      const video = document.querySelector('.avatar-camera-video');
      const isVideoPlaying = video && !video.paused && video.readyState >= 2;
      const canvasDims = canvas ? `${canvas.width}x${canvas.height}` : 'none';
      const hasError = document.querySelector('.avatar-error-banner')?.innerText || null;

      return {
        headerTitle,
        techBadge,
        delegateBadge,
        hudPills,
        jointChips,
        isVideoPlaying,
        canvasDims,
        hasError
      };
    });

    console.log(`[T+${s}s] VideoPlaying: ${metrics.isVideoPlaying} | Canvas: ${metrics.canvasDims} | HUD: [${metrics.hudPills.join(' | ')}]`);
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
