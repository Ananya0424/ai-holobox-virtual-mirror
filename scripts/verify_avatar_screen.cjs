const puppeteer = require('puppeteer-core');
const path = require('path');
const os = require('os');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pup_avatar_test_'));
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: tempDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 15000 });

  // 1. Welcome -> click START
  const startBtn = await page.waitForSelector('button');
  await startBtn.click();
  await new Promise(r => setTimeout(r, 700));

  // 2. Gender -> click female
  await page.waitForSelector('.female-card-interactive');
  await page.click('.female-card-interactive');
  await new Promise(r => setTimeout(r, 700));

  // 3. Experience Choice -> click Choose Avatar card
  console.log('Clicking avatar card...');
  await page.waitForSelector('.avatar-choice-card');
  await page.click('.avatar-choice-card');
  await new Promise(r => setTimeout(r, 1000));

  const text = await page.evaluate(() => document.body.innerText);
  console.log('Page body snippet:', text.slice(0, 200).replace(/\n/g, ' '));

  const shotPath = 'C:/Users/dell/.gemini/antigravity/brain/e182d9c9-1b53-418f-9fb6-2f89d88b013c/shot_avatar_screen_fixed.png';
  await page.screenshot({ path: shotPath });
  console.log('Screenshot saved to:', shotPath);

  await browser.close();
})();
