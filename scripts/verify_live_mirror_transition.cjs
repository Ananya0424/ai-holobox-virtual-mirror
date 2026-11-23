const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

(async () => {
  const artDir = 'C:\\Users\\dell\\.gemini\\antigravity\\brain\\e182d9c9-1b53-418f-9fb6-2f89d88b013c';
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'pupp_mirror_'));

  try {
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      userDataDir: tmpProfile,
      defaultViewport: { width: 540, height: 960 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream'
      ]
    });

    const page = await browser.newPage();
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('LiveDecartMirror') || text.includes('Decart')) {
        console.log('BROWSER:', text);
      }
    });
    page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message));

    await page.goto('http://127.0.0.1:3000/#live-mirror', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 4500));

    const initialMetrics = await page.evaluate(() => {
      const localVid = document.querySelector('.holobox-stream-video.local-cam');
      const remoteVid = document.querySelector('.holobox-stream-video.remote-stream');
      const freeze = document.querySelector('.holobox-freeze-canvas');
      return {
        localOpacity: localVid ? getComputedStyle(localVid).opacity : null,
        localZ: localVid ? getComputedStyle(localVid).zIndex : null,
        remoteOpacity: remoteVid ? getComputedStyle(remoteVid).opacity : null,
        remoteZ: remoteVid ? getComputedStyle(remoteVid).zIndex : null,
        freezeZ: freeze ? getComputedStyle(freeze).zIndex : null,
        pill: document.querySelector('.holobox-pill-stop')?.innerText
      };
    });
    console.log('INITIAL METRICS:', JSON.stringify(initialMetrics));

    await page.screenshot({ path: path.join(artDir, 'verify_mirror_initial.png') });

    // Click 2nd character card (NASA Astronaut)
    const cards = await page.$$('.sidebar-char-card');
    console.log('Sidebar character cards found:', cards.length);
    if (cards.length > 1) {
      await cards[1].click();
      await new Promise((r) => setTimeout(r, 350));

      const midSwitchMetrics = await page.evaluate(() => {
        const freeze = document.querySelector('.holobox-freeze-canvas');
        const scanline = document.querySelector('.holobox-morph-scanline');
        const badge = document.querySelector('.morph-sub-badge');
        const localVid = document.querySelector('.holobox-stream-video.local-cam');
        return {
          freezeVisible: freeze?.classList.contains('visible'),
          hasScanline: Boolean(scanline),
          badgeText: badge?.innerText || null,
          localOpacityDuringSwitch: localVid ? getComputedStyle(localVid).opacity : null
        };
      });
      console.log('MID-SWITCH METRICS:', JSON.stringify(midSwitchMetrics));
      await page.screenshot({ path: path.join(artDir, 'verify_mirror_mid_switch.png') });

      // Wait for transition to complete
      await new Promise((r) => setTimeout(r, 2500));
      const postSwitchMetrics = await page.evaluate(() => {
        const freeze = document.querySelector('.holobox-freeze-canvas');
        const scanline = document.querySelector('.holobox-morph-scanline');
        return {
          freezeVisibleAfter: freeze?.classList.contains('visible'),
          hasScanlineAfter: Boolean(scanline)
        };
      });
      console.log('POST-SWITCH METRICS:', JSON.stringify(postSwitchMetrics));
    }

    await browser.close();
  } finally {
    try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch {}
  }
})().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
