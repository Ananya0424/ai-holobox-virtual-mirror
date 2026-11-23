const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PYTHON_PATH = 'C:\\Users\\dell\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';

console.log('============================================================');
console.log('  STARTING HOLOBOX LIVE KIOSK SERVICES (PORT 5055 & 3000)');
console.log('============================================================');

// 1. Start Python AI Worker
console.log('[1/2] Starting Python AI Worker on http://127.0.0.1:5055 ...');
const workerProc = spawn(PYTHON_PATH, ['-u', 'scripts/ai_worker.py'], {
  stdio: 'inherit'
});

workerProc.on('exit', (code) => {
  console.log(`[Worker] Exited with code ${code}`);
});

// 2. Start Vite Preview Server
console.log('[2/2] Starting Vite Preview Server on http://0.0.0.0:3000 ...');
const viteProc = spawn('npx.cmd', ['vite', 'preview', '--host', '0.0.0.0', '--port', '3000'], {
  shell: true,
  stdio: 'inherit'
});

viteProc.on('exit', (code) => {
  console.log(`[Vite] Exited with code ${code}`);
});

function shutdown() {
  console.log('\n[Shutting down Holobox services...]');
  try { workerProc.kill(); } catch {}
  try { viteProc.kill(); } catch {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
