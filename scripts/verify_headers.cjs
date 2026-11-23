const puppeteer = require('puppeteer-core');
const path = require('path');
const os = require('os');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\dell\\.gemini\\antigravity\\brain\\e182d9c9-1b53-418f-9fb6-2f89d88b013c';

async function testScreens() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pup_chrome_3d_'));
  
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: tempDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      `--user-data-dir=${tempDir}`
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960 });

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 15000 });

  // 1. Welcome Screen
  const welcomeShot = path.join(ARTIFACT_DIR, 'shot_1_welcome_3d.png');
  await page.screenshot({ path: welcomeShot });
  console.log('Saved welcome screenshot');

  // Welcome -> Gender (Click START button)
  await page.evaluate(() => {
    const btn = document.querySelector('.welcome-start-button-clean') || document.querySelector('button');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  // 2. Gender Screen
  const genderShot = path.join(ARTIFACT_DIR, 'shot_2_gender_3d.png');
  await page.screenshot({ path: genderShot });
  console.log('Saved gender screenshot');

  // Select Female
  await page.evaluate(() => {
    const fCard = document.querySelector('.female-card-interactive') || document.querySelector('.female-avatar-item');
    if (fCard) fCard.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // 3. Experience Choice
  const expShot = path.join(ARTIFACT_DIR, 'shot_3_experience_3d.png');
  await page.screenshot({ path: expShot });
  console.log('Saved experience screenshot');

  // Experience Choice -> Choose Theme
  await page.evaluate(() => {
    const themeCard = document.querySelector('.theme-choice-card');
    if (themeCard) themeCard.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  // 4. Theme Selection Screen
  const themeShot = path.join(ARTIFACT_DIR, 'shot_4_theme_3d.png');
  await page.screenshot({ path: themeShot });
  console.log('Saved theme screenshot');

  // Click ENTER THEME CTA button to advance to Camera
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const enterBtn = btns.find(b => b.textContent && b.textContent.includes('ENTER'));
    if (enterBtn) enterBtn.click();
    else {
      const hero = document.querySelector('.avatar-center-hero-slot');
      if (hero) hero.click();
    }
  });
  await new Promise(r => setTimeout(r, 1500));

  // 5. Camera Screen
  const camShot = path.join(ARTIFACT_DIR, 'shot_5_camera_3d.png');
  await page.screenshot({ path: camShot });
  console.log('Saved camera screenshot');

  // Click "Sample Photo" to test instant Holobox transformation and see PhotoPreview!
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sampleBtn = btns.find(b => b.textContent && b.textContent.includes('Sample Photo'));
    if (sampleBtn) sampleBtn.click();
  });
  console.log('Clicked Sample Photo, waiting for AI transformation & 3D chamber preview...');

  // Wait for AI generation screen to complete and transition to PhotoPreview
  await page.waitForSelector('.holobox-3d-chamber-container, .studio-final-photo', { timeout: 35000 }).catch(e => {
    console.log('Timeout waiting for PhotoPreview, taking current screenshot...');
  });
  await new Promise(r => setTimeout(r, 2000));

  // 6. PhotoPreview in 3D Holobox Chamber!
  const previewShot = path.join(ARTIFACT_DIR, 'shot_6_holobox_chamber_result.png');
  await page.screenshot({ path: previewShot });
  console.log('Saved 3D Holobox Chamber result screenshot!');

  await browser.close();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  console.log('Full end-to-end verification complete!');
}

testScreens().catch(e => {
  console.error(e);
  process.exit(1);
});
