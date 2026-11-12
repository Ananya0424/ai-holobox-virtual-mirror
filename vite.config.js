import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';

const AI_WORKER_HOST = '127.0.0.1';
const AI_WORKER_PORT = 5055;

function getLanIPv4() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        // Prefer standard home/office LAN ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        const priority = net.address.startsWith('192.168.') ? 1 : net.address.startsWith('10.') ? 2 : 3;
        candidates.push({ address: net.address, priority });
      }
    }
  }
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0]?.address || null;
}

function workerRequest(method, urlPath, bodyObj = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = http.request(
      {
        hostname: AI_WORKER_HOST,
        port: AI_WORKER_PORT,
        path: urlPath,
        method,
        headers: bodyStr
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(bodyStr)
            }
          : {}
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(data || '{}') });
          } catch {
            resolve({ statusCode: res.statusCode, data: { raw: data } });
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error('AI Worker request timeout'));
    });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

let workerProc = null;
let workerStarting = null;

async function ensureWorkerRunning() {
  try {
    const health = await workerRequest('GET', '/health');
    if (health.statusCode === 200 && health.data?.ok) {
      return true;
    }
  } catch {
    // Not running yet
  }

  if (workerStarting) return workerStarting;

  workerStarting = new Promise((resolve, reject) => {
    const PYTHON_PATH = fs.existsSync('C:/Users/dell/AppData/Local/Programs/Python/Python311/python.exe')
      ? 'C:/Users/dell/AppData/Local/Programs/Python/Python311/python.exe'
      : 'python';

    console.log('[Vite AI Bridge] Launching persistent Python GPU worker...');
    workerProc = spawn(PYTHON_PATH, ['scripts/ai_worker.py'], {
      env: { ...process.env, HOLOBOX_AI_PORT: String(AI_WORKER_PORT) },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    workerProc.stdout.on('data', (d) => process.stdout.write(d));
    workerProc.stderr.on('data', (d) => process.stderr.write(d));
    workerProc.on('exit', (code) => {
      console.log(`[Vite AI Bridge] Worker exited with code ${code}`);
      workerProc = null;
      workerStarting = null;
    });

    const startAt = Date.now();
    const poll = setInterval(async () => {
      try {
        const res = await workerRequest('GET', '/health');
        if (res.statusCode === 200 && res.data?.ok) {
          clearInterval(poll);
          workerStarting = null;
          resolve(true);
        }
      } catch {
        if (Date.now() - startAt > 90000) {
          clearInterval(poll);
          workerStarting = null;
          reject(new Error('AI Worker failed to become ready within 90s'));
        }
      }
    }, 600);
  });

  return workerStarting;
}

const jobRegistry = new Map();
const recentJobSignatures = new Map();

const UNSAFE_PROMPT_TERMS = new Set([
  'nude', 'naked', 'nsfw', 'lingerie', 'bikini', 'underwear', 'bra', 'panties',
  'topless', 'shirtless', 'explicit', 'porn', 'porno', 'erotic', 'sexual', 'sex',
  'fetish', 'blood', 'gore', 'violent', 'weapon', 'gun', 'rifle', 'knife',
  'kill', 'murder', 'terrorist', 'suicide', 'drugs', 'cocaine'
]);

function validateCustomPromptServer(prompt) {
  if (prompt === null || prompt === undefined || prompt === '') return { valid: true };
  if (typeof prompt !== 'string') return { valid: false, error: 'Invalid custom prompt format' };
  const cleaned = prompt.trim();
  if (cleaned.length < 3) return { valid: false, error: 'Custom prompt must be at least 3 characters' };
  if (cleaned.length > 200) return { valid: false, error: 'Custom prompt must be at most 200 characters' };
  const words = cleaned.toLowerCase().match(/[a-z]+/g) || [];
  if (words.some((w) => UNSAFE_PROMPT_TERMS.has(w))) {
    return { valid: false, error: 'Unsupported or unsafe custom outfit prompt' };
  }
  return { valid: true };
}

function cleanupOldCapturedFiles(capturedDir, maxAgeMs = 2 * 60 * 60 * 1000) {
  try {
    if (!fs.existsSync(capturedDir)) return;
    const now = Date.now();
    for (const file of fs.readdirSync(capturedDir)) {
      const fp = path.join(capturedDir, file);
      const stat = fs.statSync(fp);
      if (stat.isFile() && (now - stat.mtimeMs) > maxAgeMs) {
        fs.unlinkSync(fp);
      }
    }
  } catch {
    // Non-fatal cleanup error
  }
}

function buildMobileUrl(req, photoUrl, filename) {
  const configuredPublic = (process.env.PUBLIC_URL || process.env.VITE_PUBLIC_URL || '').replace(/\/+$/, '');
  if (configuredPublic) {
    return `${configuredPublic}/download/${filename}`;
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostHeader = forwardedHost || req.headers.host || 'localhost:3000';
  const proto = forwardedProto ? String(forwardedProto).split(',')[0].trim() : 'http';
  const portMatch = hostHeader.match(/:(\d+)$/);
  const port = portMatch ? portMatch[1] : '3000';
  const hostname = hostHeader.replace(/:\d+$/, '');
  const isLocalOnly = hostname === 'localhost' || hostname === '127.0.0.1';
  const lanIp = getLanIPv4();

  if (isLocalOnly && lanIp) {
    return `http://${lanIp}:${port}/download/${filename}`;
  }
  return `${proto}://${hostHeader}/download/${filename}`;
}

function attachMiddlewares(middlewares, httpServer) {
  // Start worker proactively on server boot
  ensureWorkerRunning().catch((err) => {
    console.warn('[Vite AI Bridge] Background worker startup notice:', err.message);
  });

  if (httpServer) {
    httpServer.on('close', () => {
      if (workerProc && !workerProc.killed) {
        workerProc.kill();
      }
    });
  }

  // Health & GPU Worker diagnostic endpoint
  middlewares.use('/api/health', async (req, res) => {
    const lanIp = getLanIPv4();
    const hostHeader = req.headers.host || 'localhost:3000';
    const portMatch = hostHeader.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : '3000';
    let workerStatus = { ok: false, modelsLoaded: false };
    try {
      const h = await workerRequest('GET', '/health');
      workerStatus = h.data || workerStatus;
    } catch (err) {
      workerStatus = { ok: false, modelsLoaded: false, error: err.message };
    }
    res.statusCode = workerStatus.ok ? 200 : 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: Boolean(workerStatus.ok),
      worker: workerStatus,
      lanOrigin: lanIp ? `http://${lanIp}:${port}` : null,
      publicUrl: process.env.PUBLIC_URL || process.env.VITE_PUBLIC_URL || null
    }));
  });

  // LAN Network info endpoint for QR mobile debugging
  middlewares.use('/api/network-info', (req, res) => {
    const lanIp = getLanIPv4();
    const hostHeader = req.headers.host || 'localhost:3000';
    const portMatch = hostHeader.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : '3000';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      lanIp,
      port,
      lanOrigin: lanIp ? `http://${lanIp}:${port}` : null
    }));
  });

  // Safe mobile download & view endpoint for captured portraits (no local paths exposed)
  middlewares.use('/download', (req, res, next) => {
    if (req.method !== 'GET') return next();
    const rawUrl = req.url || '';
    const cleanPath = rawUrl.split('?')[0].replace(/^\/+/, '');
    const safeFilename = path.basename(cleanPath);
    if (!safeFilename || !/^[a-zA-Z0-9_.-]+\.(jpg|jpeg|png)$/.test(safeFilename)) {
      res.statusCode = 400;
      res.end('Invalid filename');
      return;
    }

    const filePath = path.resolve('public/captured', safeFilename);
    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.end('Portrait not found');
      return;
    }

    const isInline = rawUrl.includes('inline=1');
    const isDirectDl = rawUrl.includes('dl=1') || rawUrl.includes('raw=1');
    const ext = path.extname(safeFilename).toLowerCase();

    if (isInline || isDirectDl) {
      res.statusCode = 200;
      res.setHeader('Content-Type', ext === '.png' ? 'image/png' : 'image/jpeg');
      res.setHeader('Cache-Control', 'no-store');
      if (isDirectDl) {
        res.setHeader('Content-Disposition', `attachment; filename="holobox_${safeFilename}"`);
      }
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // Mobile-friendly landing page when scanned with a phone camera QR scanner
    const inlineSrc = `/download/${encodeURIComponent(safeFilename)}?inline=1`;
    const dlSrc = `/download/${encodeURIComponent(safeFilename)}?dl=1`;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Holobox Portrait Download</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; display: flex; flex-direction: column; align-items: center; padding: 20px 16px 36px; }
    .badge { background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 999px; letter-spacing: 0.05em; margin-bottom: 14px; }
    .photo { width: 100%; max-width: 360px; border-radius: 18px; background: #fff; box-shadow: 0 14px 36px rgba(15,23,42,0.12); border: 1px solid #e2e8f0; }
    .btn-row { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 360px; margin-top: 18px; }
    .btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 20px; border-radius: 14px; font-size: 16px; font-weight: 700; text-decoration: none; border: none; cursor: pointer; }
    .btn-primary { background: linear-gradient(135deg, #0ea5e9, #6366f1); color: #fff; box-shadow: 0 8px 20px rgba(14,165,233,0.3); }
    .btn-secondary { background: #fff; color: #0f172a; border: 1px solid #cbd5e1; }
    .tip { margin-top: 12px; font-size: 13px; color: #64748b; text-align: center; max-width: 340px; }
  </style>
</head>
<body>
  <div class="badge">AI HOLOBOX TRANSFORMATION</div>
  <img src="${inlineSrc}" alt="Holobox Studio Portrait" class="photo" />
  <div class="btn-row">
    <a href="${dlSrc}" download="holobox_${safeFilename}" class="btn btn-primary">Download Photo</a>
    <button type="button" id="shareBtn" class="btn btn-secondary" style="display:none;">Save / Share to Photos</button>
  </div>
  <p class="tip">If download does not start automatically, tap and hold the photo above and choose <strong>Save Image</strong>.</p>
  <script>
    (function () {
      var btn = document.getElementById('shareBtn');
      if (navigator.canShare && navigator.share) {
        btn.style.display = 'flex';
        btn.addEventListener('click', async function () {
          try {
            var r = await fetch('${inlineSrc}');
            var b = await r.blob();
            var f = new File([b], 'holobox_${safeFilename}', { type: b.type || 'image/jpeg' });
            if (navigator.canShare({ files: [f] })) {
              await navigator.share({ files: [f], title: 'AI Holobox Portrait' });
            }
          } catch (e) {}
        });
      }
    })();
  </script>
</body>
</html>`);
  });

  // Direct serve of /captured/* (ensures newly created files work in both dev & preview)
  middlewares.use('/captured', (req, res, next) => {
    if (req.method !== 'GET') return next();
    const safeFilename = path.basename((req.url || '').split('?')[0]);
    const filePath = path.resolve('public/captured', safeFilename);
    if (!safeFilename || !fs.existsSync(filePath)) return next();

    const ext = path.extname(safeFilename).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', ext === '.png' ? 'image/png' : 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(filePath).pipe(res);
  });

  // Real-time status polling endpoint
  middlewares.use('/api/transform-status', async (req, res) => {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    const jobId = (req.url || '').split('?')[0].replace(/^\/+/, '');
    if (!jobId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'jobId required' }));
      return;
    }

    try {
      const workerRes = await workerRequest('GET', `/status/${encodeURIComponent(jobId)}`);
      const statusData = workerRes.data || {};
      const meta = jobRegistry.get(jobId) || {};

      if (statusData.status === 'done' && meta.photoUrl) {
        statusData.success = true;
        statusData.photoUrl = meta.photoUrl;
        statusData.downloadId = meta.downloadId;
        statusData.mobileDownloadUrl = meta.mobileDownloadUrl;
      }

      res.statusCode = workerRes.statusCode;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(statusData));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'error', error: err.message }));
    }
  });

  // AI Photo-to-Professional Transformation Endpoint
  middlewares.use('/api/transform-photo', async (req, res) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    let bodyStr = '';
    req.on('data', chunk => {
      bodyStr += chunk;
    });

    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyStr || '{}');
        const {
          photoDataUrl,
          profession = 'pilot',
          gender = 'female',
          customPrompt = null,
          async: isAsync = false
        } = body;

        if (!photoDataUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'photoDataUrl is required' }));
          return;
        }

        const promptCheck = validateCustomPromptServer(customPrompt);
        if (!promptCheck.valid) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: promptCheck.error }));
          return;
        }

        // Purge captured files older than 2 hours for kiosk privacy
        const capturedDir = path.resolve('public/captured');
        cleanupOldCapturedFiles(capturedDir);

        // Deduplicate duplicate mount requests (e.g. React 18 StrictMode double-effect)
        const reqSignature = `${profession}|${gender}|${customPrompt || ''}|${photoDataUrl.length}|${photoDataUrl.slice(-96)}`;
        const existingEntry = recentJobSignatures.get(reqSignature);
        if (existingEntry && (Date.now() - existingEntry.ts < 8000)) {
          const existingMeta = jobRegistry.get(existingEntry.jobId);
          if (existingMeta && isAsync) {
            res.statusCode = 202;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              accepted: true,
              deduplicated: true,
              jobId: existingEntry.jobId,
              downloadId: existingMeta.downloadId,
              photoUrl: existingMeta.photoUrl,
              mobileDownloadUrl: existingMeta.mobileDownloadUrl
            }));
            return;
          }
        }

        const id = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        recentJobSignatures.set(reqSignature, { jobId: id, ts: Date.now() });
        if (!fs.existsSync(capturedDir)) {
          fs.mkdirSync(capturedDir, { recursive: true });
        }

        const inputFilename = `input_${id}.png`;
        const outputFilename = `transform_${id}.jpg`;
        const inputPath = path.join(capturedDir, inputFilename);
        const outputPath = path.join(capturedDir, outputFilename);

        // Decode base64 safely
        const base64Data = photoDataUrl.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(inputPath, Buffer.from(base64Data, 'base64'));

        await ensureWorkerRunning();

        const photoUrl = `/captured/${outputFilename}`;
        const mobileDownloadUrl = buildMobileUrl(req, photoUrl, outputFilename);
        jobRegistry.set(id, {
          downloadId: id,
          photoUrl,
          mobileDownloadUrl,
          profession,
          gender
        });

        await workerRequest('POST', '/transform', {
          jobId: id,
          inputPath,
          profession,
          gender,
          outputPath,
          customPrompt
        });

        if (isAsync) {
          res.statusCode = 202;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            accepted: true,
            jobId: id,
            downloadId: id,
            photoUrl,
            mobileDownloadUrl
          }));
          return;
        }

        // Synchronous wait mode for direct API callers
        const waitStart = Date.now();
        while (Date.now() - waitStart < 180000) {
          await new Promise(r => setTimeout(r, 500));
          const st = await workerRequest('GET', `/status/${id}`);
          if (st.data?.status === 'done' && fs.existsSync(outputPath)) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              photoUrl,
              mobileDownloadUrl,
              downloadId: id,
              profession,
              gender,
              telemetry: st.data.result
            }));
            return;
          }
          if (st.data?.status === 'error') {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: 'AI Transformation failed',
              details: st.data.error
            }));
            return;
          }
        }

        res.statusCode = 504;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'AI Transformation timed out' }));
      } catch (err) {
        console.error('[API Error]', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  });

  // Decart Lucy VTON POC Token Endpoint (preserved)
  middlewares.use('/api/realtime-token', async (req, res) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    const apiKey = process.env.DECART_API_KEY;
    if (!apiKey) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'DECART_API_KEY is not set on the server.',
        needsKey: true
      }));
      return;
    }

    try {
      const { createDecartClient } = await import('@decartai/sdk');
      const client = createDecartClient({ apiKey });
      const token = await client.tokens.create({
        expiresIn: 300,
        allowedModels: ['lucy-vton-3.6']
      });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        apiKey: token.apiKey,
        expiresAt: token.expiresAt
      }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: err.message || 'Failed to generate Decart ephemeral client token'
      }));
    }
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ai-transform-endpoint',
      configureServer(server) {
        attachMiddlewares(server.middlewares, server.httpServer);
      },
      configurePreviewServer(server) {
        attachMiddlewares(server.middlewares, server.httpServer);
      }
    }
  ],
  server: {
    port: 3000,
    host: true,
    allowedHosts: true
  },
  preview: {
    port: 3000,
    host: true,
    allowedHosts: true
  }
});
