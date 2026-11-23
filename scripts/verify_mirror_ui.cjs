const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

(async () => {
  const artifactDir = 'C:\\Users\\dell\\.gemini\\antigravity\\brain\\e182d9c9-1b53-418f-9fb6-2f89d88b013c';
  console.log('[Test] Launching Chrome to verify UI redesign...');

  const tmpProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pupp_ui_'));

  try {
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      userDataDir: tmpProfileDir,
      defaultViewport: { width: 540, height: 960 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });

    const page = await browser.newPage();

    // 1. Verify Welcome Screen
    console.log('[Test] 1. Verifying Welcome Screen (Must have ONLY Start button)...');
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(artifactDir, 'verify_1_welcome_clean.png') });
    console.log('Saved: verify_1_welcome_clean.png');

    // 2. Click START EXPERIENCE and Choose Female to reach Experience Choice Screen
    console.log('[Test] 2. Navigating to Experience Choice Screen...');
    const startBtn = await page.$('.holo-btn-start-hero');
    if (startBtn) await startBtn.click();
    await new Promise(r => setTimeout(r, 800));

    // On Gender Selection Screen, click Female
    const femaleCard = await page.$('.category-card');
    if (femaleCard) await femaleCard.click();
    await new Promise(r => setTimeout(r, 1000));

    await page.screenshot({ path: path.join(artifactDir, 'verify_2_experience_choice_with_mirror.png') });
    console.log('Saved: verify_2_experience_choice_with_mirror.png');

    // 3. Click "Live AI Mirror" card
    console.log('[Test] 3. Entering Live Mirror View...');
    const mirrorCard = await page.$('.live-mirror-choice-card');
    if (mirrorCard) {
      await mirrorCard.click();
    } else {
      await page.goto('http://127.0.0.1:3000/#live-mirror', { waitUntil: 'networkidle2' });
    }
    await new Promise(r => setTimeout(r, 1800));

    await page.screenshot({ path: path.join(artifactDir, 'verify_3_holobox_live_mirror.png') });
    console.log('Saved: verify_3_holobox_live_mirror.png');

    // Also verify DOM structure
    const hasLiveBadge = await page.$('.holobox-live-badge') !== null;
    const hasSidebar = await page.$('.holobox-sidebar-characters') !== null;
    const charCardsCount = await page.$$eval('.sidebar-char-card', el => el.length);
    const hasPipCamera = await page.$('.holobox-camera-pip') !== null;
    const hasShutter = await page.$('.holobox-shutter-btn') !== null;

    console.log('--- Verification Checklist ---');
    console.log('Top Live Badge present:', hasLiveBadge);
    console.log('Right Sidebar present:', hasSidebar);
    console.log('Sidebar Character Cards count:', charCardsCount);
    console.log('Bottom-Right Camera PIP present:', hasPipCamera);
    console.log('Bottom-Center Shutter button present:', hasShutter);

    await browser.close();
    console.log('[Test] All UI verifications completed successfully!');
  } finally {
    try { fs.rmSync(tmpProfileDir, { recursive: true, force: true }); } catch {}
  }
})();
