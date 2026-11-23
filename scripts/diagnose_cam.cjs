const path = require('path');
const os = require('os');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

(async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pupp_cam_'));
  try {
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      userDataDir: tmpDir,
      args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
    });
    const page = await browser.newPage();
    await page.goto('about:blank');
    const res = await page.evaluate(async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const v = document.createElement('video');
        v.autoplay = true;
        v.muted = true;
        v.playsInline = true;
        document.body.appendChild(v);
        v.srcObject = s;
        await new Promise(r => { v.onloadedmetadata = r; setTimeout(r, 2000); });
        await v.play().catch(e => e.message);
        return { readyState: v.readyState, w: v.videoWidth, h: v.videoHeight, err: null };
      } catch (e) {
        return { err: e.message };
      }
    });
    console.log('Result:', JSON.stringify(res));
    await browser.close();
  } catch (err) {
    console.error('Launch Err:', err);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();
