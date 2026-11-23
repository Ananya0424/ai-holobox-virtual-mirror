const puppeteer = require('puppeteer-core');
const path = require('path');
const os = require('os');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pup_gen_screen_'));
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: tempDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 15000 });

  // 1. Welcome -> START
  const startBtn = await page.waitForSelector('button');
  await startBtn.click();
  await new Promise(r => setTimeout(r, 600));

  // 2. Gender -> female
  await page.waitForSelector('.female-card-interactive');
  await page.click('.female-card-interactive');
  await new Promise(r => setTimeout(r, 600));

  // 3. Experience Choice -> Choose Avatar
  await page.waitForSelector('.avatar-choice-card');
  await page.click('.avatar-choice-card');
  await new Promise(r => setTimeout(r, 800));

  // 4. In AvatarCarousel, click center avatar to select Doctor
  await page.waitForSelector('.avatar-center-hero-slot');
  await page.click('.avatar-center-hero-slot');
  await new Promise(r => setTimeout(r, 800));

  // 5. In CameraCaptureScreen, click "Sample Photo" to test instant capture
  console.log('Clicking Sample Photo button in Camera Screen...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sampleBtn = btns.find(b => b.textContent.includes('Sample') || b.textContent.includes('sample'));
    if (sampleBtn) sampleBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // 6. Now on AIGenerationScreen! Wait 1.2s to capture the live animated synthesis
  await new Promise(r => setTimeout(r, 1200));

  const shotPath = 'C:/Users/dell/.gemini/antigravity/brain/e182d9c9-1b53-418f-9fb6-2f89d88b013c/shot_ai_generation_luxury.png';
  await page.screenshot({ path: shotPath });
  console.log('Screenshot saved to:', shotPath);

  await browser.close();
})();
