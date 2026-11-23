const puppeteer = require('puppeteer-core');
const http = require('http');

function getCredits() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:3000/api/decart/credits', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  console.log('========================================================');
  console.log('  STARTING CONTROLLED 10-SECOND DECART MIRROR TEST');
  console.log('========================================================');

  const creditsBefore = await getCredits().catch(() => ({ credits: 'unknown' }));
  console.log('[Credits Check] Account balance BEFORE test:', creditsBefore.credits, 'credits');

  console.log('[Puppeteer Test] Launching Chrome with fake camera stream...');
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
    console.log('[Browser Console]', msg.type(), msg.text());
  });

  page.on('pageerror', err => {
    console.error('[Browser PageError]', err.message);
  });

  console.log('[Puppeteer Test] Navigating to http://localhost:3000/#live-mirror ...');
  await page.goto('http://localhost:3000/#live-mirror', { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('[Puppeteer Test] Page loaded. Title:', await page.title());

  // Monitor for up to 20 seconds to allow connection + full 10-second test + cleanup
  let finalReport = null;
  for (let s = 1; s <= 20; s++) {
    await new Promise(r => setTimeout(r, 1000));
    const state = await page.evaluate(() => {
      const hud = document.querySelector('.decart-telemetry-hud .hud-text')?.innerText || 'none';
      const countdown = document.querySelector('.decart-test-countdown-badge')?.innerText || 'none';
      const reportCard = document.querySelector('.decart-test-report-card');
      const video = document.querySelector('.decart-stream-video');
      const hasStream = video && video.srcObject ? true : false;
      let reportData = null;
      if (reportCard) {
        const items = Array.from(reportCard.querySelectorAll('.report-item'));
        reportData = items.map(it => ({
          label: it.querySelector('.report-label')?.innerText,
          val: it.querySelector('.report-val')?.innerText
        }));
      }
      return { hud, countdown, hasStream, reportData };
    });

    console.log(`[T+${s}s] HUD: ${state.hud} | Countdown: ${state.countdown}`);
    if (state.reportData) {
      console.log('>>> Controlled test completion report detected! <<<');
      finalReport = state.reportData;
      break;
    }
  }

  console.log('\n[Puppeteer Test] Final Extracted Report:');
  console.log(JSON.stringify(finalReport, null, 2));

  await browser.close();
  console.log('[Puppeteer Test] Browser closed.');

  // Wait 2 seconds and check credits consumed
  await new Promise(r => setTimeout(r, 2000));
  const creditsAfter = await getCredits().catch(() => ({ credits: 'unknown' }));
  console.log('[Credits Check] Account balance AFTER test:', creditsAfter.credits, 'credits');
  if (typeof creditsBefore.credits === 'number' && typeof creditsAfter.credits === 'number') {
    const consumed = creditsBefore.credits - creditsAfter.credits;
    console.log(`[Credits Check] EXACT CREDITS CONSUMED: ${consumed} credits`);
  }
})();
