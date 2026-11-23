const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

(async () => {
  const artDir = 'C:\\Users\\dell\\.gemini\\antigravity\\brain\\e182d9c9-1b53-418f-9fb6-2f89d88b013c';
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'pupp_exp_'));

  try {
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      userDataDir: tmpProfile,
      defaultViewport: { width: 540, height: 960 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // 1. Check Female Experience Choice
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
    const startBtn = await page.$('.holo-btn-start-hero');
    if (startBtn) await startBtn.click();
    await new Promise(r => setTimeout(r, 800));

    // Click Female
    const femaleCard = await page.$('.category-card');
    if (femaleCard) await femaleCard.click();
    await new Promise(r => setTimeout(r, 1200));

    await page.screenshot({ path: path.join(artDir, 'verify_female_mirror_card.png') });
    console.log('Saved: verify_female_mirror_card.png');

    // 2. Go Back and Check Male Experience Choice
    const backBtn = await page.$('button[aria-label="Back to Gender Selection"]');
    if (backBtn) await backBtn.click();
    await new Promise(r => setTimeout(r, 800));

    // Click Male (2nd card)
    const cards = await page.$$('.category-card');
    if (cards.length > 1) await cards[1].click();
    await new Promise(r => setTimeout(r, 1200));

    await page.screenshot({ path: path.join(artDir, 'verify_male_mirror_card.png') });
    console.log('Saved: verify_male_mirror_card.png');

    await browser.close();
  } finally {
    try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch {}
  }
})();
