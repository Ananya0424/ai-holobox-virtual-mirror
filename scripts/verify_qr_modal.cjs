const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

(async () => {
  const artDir = 'C:\\Users\\dell\\.gemini\\antigravity\\brain\\e182d9c9-1b53-418f-9fb6-2f89d88b013c';
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'pupp_qr_'));

  try {
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      userDataDir: tmpProfile,
      defaultViewport: { width: 540, height: 960 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

    console.log('[Test] Navigating directly to preview or testing QR modal...');
    // We can evaluate if 'Download on this Device' exists anywhere in the bundle
    const hasDownloadBtn = await page.evaluate(() => {
      return document.body.innerHTML.includes('Download on this Device');
    });

    console.log('Is "Download on this Device" present anywhere in DOM:', hasDownloadBtn);

    await browser.close();
  } finally {
    try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch {}
  }
})();
