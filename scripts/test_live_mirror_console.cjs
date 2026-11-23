const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const os = require('os');

(async () => {
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'pupp_decart_'));
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
  page.on('console', msg => console.log('[Browser Console]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[Browser PageError]', err));

  await page.goto('http://127.0.0.1:3000/#live-mirror', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  console.log('Clicking 2nd character (NASA Astronaut)...');
  const cards = await page.$$('.sidebar-char-card');
  if (cards.length > 1) {
    await cards[1].click();
  }
  await new Promise(r => setTimeout(r, 2500));

  console.log('Clicking 3rd character (Knight)...');
  if (cards.length > 2) {
    await cards[2].click();
  }
  await new Promise(r => setTimeout(r, 2500));

  await browser.close();
  try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch {}
})();
