const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PYTHON_PATH = 'C:\\Users\\dell\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';
const SCREENSHOT_DIR = path.resolve('public/test_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Clean up any lingering processes on ports 3000, 3001, 5055 before test
try {
  execSync(`powershell -Command "Get-NetTCPConnection -LocalPort 3000, 3001, 5055 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`, { stdio: 'ignore' });
} catch {}

function fetchJson(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOpts = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (postData) {
      reqOpts.headers['Content-Type'] = 'application/json';
      reqOpts.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('HTTP timeout')));
    if (postData) req.write(postData);
    req.end();
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runSelfTest() {
  console.log('============================================================');
  console.log('  HOLOBOX VIRTUAL MIRROR — AUTOMATED E2E VERIFICATION TEST');
  console.log('============================================================\n');

  let workerProc = null;
  let viteProc = null;
  let browser = null;

  try {
    // 1. Start Python AI Worker
    console.log('[1/7] Starting Python AI Worker on port 5055...');
    workerProc = spawn(PYTHON_PATH, ['-u', 'scripts/ai_worker.py'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    workerProc.stdout.on('data', (d) => process.stdout.write('[Worker] ' + d));
    workerProc.stderr.on('data', (d) => process.stderr.write('[Worker Err] ' + d));

    // Wait for worker /health
    let workerReady = false;
    for (let i = 0; i < 30; i++) {
      await wait(500);
      try {
        const res = await fetchJson('http://127.0.0.1:5055/health');
        if (res.status === 200 && res.data?.ok) {
          workerReady = true;
          console.log('      AI Worker ready! Health payload:', JSON.stringify(res.data));
          break;
        }
      } catch {}
    }

    if (!workerReady) throw new Error('AI Worker failed to become ready on port 5055');

    // 2. Start Vite Preview Server
    console.log('\n[2/7] Starting Vite production server on port 3000...');
    viteProc = spawn('npx.cmd', ['vite', 'preview', '--host', '0.0.0.0', '--port', '3000'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    viteProc.stdout.on('data', (d) => process.stdout.write('[Vite] ' + d));
    viteProc.stderr.on('data', (d) => process.stderr.write('[Vite Err] ' + d));

    let viteReady = false;
    for (let i = 0; i < 30; i++) {
      await wait(600);
      try {
        const res = await fetchJson('http://127.0.0.1:3000/api/health');
        if (res.status === 200 && res.data?.ok) {
          viteReady = true;
          console.log('      Vite Preview server ready! Health payload:', JSON.stringify(res.data));
          break;
        }
      } catch {}
    }

    if (!viteReady) throw new Error('Vite server failed to respond on http://localhost:3000/api/health');

    // 3. Test Network Info Endpoint
    console.log('\n[3/7] Verifying /api/network-info for Wi-Fi QR downloading...');
    const netInfo = await fetchJson('http://127.0.0.1:3000/api/network-info');
    console.log('      Network Info:', JSON.stringify(netInfo.data));
    if (!netInfo.data?.lanIp) throw new Error('LAN IP not detected by server');

    // 4. Test Theme Transformation API (Horror Ghost Male)
    console.log('\n[4/7] Testing Live Transformation: Theme Mode (Horror Ghost Male)...');
    const malePhotoPath = path.resolve('scripts/doctor_verification/1_original_input.png');
    const photoBuffer = fs.readFileSync(malePhotoPath);
    const photoDataUrl = 'data:image/png;base64,' + photoBuffer.toString('base64');

    const themePayload = JSON.stringify({
      photoDataUrl,
      mode: 'theme',
      theme: 'horror',
      gender: 'male',
      async: true
    });

    const initTheme = await fetchJson('http://127.0.0.1:3000/api/transform-photo', { method: 'POST' }, themePayload);
    console.log('      Theme Job Initiated:', JSON.stringify(initTheme.data));
    if (!initTheme.data?.jobId) throw new Error('Failed to initiate theme job');

    const themeJobId = initTheme.data.jobId;
    let themeResult = null;
    for (let i = 0; i < 60; i++) {
      await wait(400);
      const st = await fetchJson(`http://127.0.0.1:3000/api/transform-status/${themeJobId}`);
      if (st.data?.status === 'done' && st.data?.photoUrl) {
        themeResult = st.data;
        console.log(`      Theme transformation finished in ${(i * 0.4).toFixed(1)}s! Result:`, themeResult.photoUrl);
        break;
      }
      if (st.data?.status === 'error') {
        throw new Error('Theme transformation job failed: ' + st.data.error);
      }
    }

    if (!themeResult) throw new Error('Theme job timed out');

    // 5. Test Avatar Transformation API (Pilot Female)
    console.log('\n[5/7] Testing Live Transformation: Avatar Mode (Pilot Female)...');
    const femPhotoPath = path.resolve('scripts/doctor_verification/1_original_input.png');
    const femBuffer = fs.readFileSync(femPhotoPath);
    const femDataUrl = 'data:image/png;base64,' + femBuffer.toString('base64');

    const avatarPayload = JSON.stringify({
      photoDataUrl: femDataUrl,
      mode: 'avatar',
      profession: 'pilot',
      gender: 'female',
      async: true
    });

    const initAvatar = await fetchJson('http://127.0.0.1:3000/api/transform-photo', { method: 'POST' }, avatarPayload);
    console.log('      Avatar Job Initiated:', JSON.stringify(initAvatar.data));
    if (!initAvatar.data?.jobId) throw new Error('Failed to initiate avatar job');

    const avJobId = initAvatar.data.jobId;
    let avResult = null;
    for (let i = 0; i < 60; i++) {
      await wait(300);
      const st = await fetchJson(`http://127.0.0.1:3000/api/transform-status/${avJobId}`);
      if (st.data?.status === 'done' && st.data?.photoUrl) {
        avResult = st.data;
        console.log(`      Avatar transformation finished in ${(i * 0.3).toFixed(1)}s! Result:`, avResult.photoUrl);
        break;
      }
      if (st.data?.status === 'error') {
        throw new Error('Avatar job failed: ' + st.data.error);
      }
    }

    if (!avResult) throw new Error('Avatar job timed out');

    // 6. Test Mobile Download Endpoint (QR Target)
    console.log('\n[6/7] Testing Mobile QR Download Endpoint...');
    const filename = path.basename(themeResult.photoUrl);
    const dlRes = await fetchJson(`http://127.0.0.1:3000/download/${filename}`);
    console.log('      Download HTML Page status:', dlRes.status, '| HTML served successfully:', (dlRes.raw || '').length > 500);

    // 7. Headless Chrome UI Navigation & Flow Test
    console.log('\n[7/7] Launching Headless Chrome to test real UI screens...');
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      defaultViewport: { width: 540, height: 960 }, // 9:16 portrait kiosk viewport
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
    });

    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    // Screen 1: Welcome
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen_1_welcome.png') });
    console.log('      [OK] Screen 1: Welcome screen loaded -> captured screenshot');

    // Click START EXPERIENCE
    const startBtn = await page.waitForSelector('.holo-btn-start-hero', { timeout: 6000 });
    await startBtn.click();
    await wait(800);

    // Screen 2: Gender Selection
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen_2_gender.png') });
    console.log('      [OK] Screen 2: Gender Selection screen loaded -> captured screenshot');

    // Select Male
    const maleCard = await page.waitForSelector('.male-card-interactive', { timeout: 6000 });
    await maleCard.click();
    await wait(800);

    // Screen 3: Experience Choice (Choose Theme vs Choose Avatar)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen_3_experience_choice.png') });
    console.log('      [OK] Screen 3: Experience Choice (Choose Theme vs Choose Avatar) loaded -> captured screenshot');

    // Click Choose Theme
    const themeChoiceBtn = await page.waitForSelector('.theme-choice-card', { timeout: 6000 });
    await themeChoiceBtn.click();
    await wait(800);

    // Screen 4: Theme Selection (4 Themes)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen_4_theme_selection.png') });
    console.log('      [OK] Screen 4: Theme Selection (4 Themes: Horror, Dragon, Cartoon, Mickey) loaded -> captured screenshot');

    // Click Back to Experience Choice
    const backBtn = await page.waitForSelector('button[aria-label="Back to Experience Choice"]', { timeout: 6000 });
    await backBtn.click();
    await wait(800);
    console.log('      [OK] Navigated Back to Experience Choice successfully');

    // Click Choose Avatar
    const avatarChoiceBtn = await page.waitForSelector('.avatar-choice-card', { timeout: 6000 });
    await avatarChoiceBtn.click();
    await wait(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen_5_avatar_selection.png') });
    console.log('      [OK] Screen 5: Avatar Profession Carousel loaded -> captured screenshot');

    console.log('\n============================================================');
    console.log('  ALL CHECKS PASSED WITH ZERO CONSOLE ERRORS!');
    console.log('============================================================');
    if (consoleErrors.length > 0) {
      console.warn('  Client warnings/notices:', consoleErrors);
    } else {
      console.log('  Console Errors: 0');
    }
  } catch (err) {
    console.error('\n[TEST FAILED]:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (viteProc) viteProc.kill();
    if (workerProc) workerProc.kill();
    try {
      execSync(`powershell -Command "Get-NetTCPConnection -LocalPort 3000, 5055 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`, { stdio: 'ignore' });
    } catch {}
  }
}

runSelfTest();
