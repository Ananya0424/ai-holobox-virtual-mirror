#!/usr/bin/env node
/**
 * Official Decart SDK Bridge for Complete AI Image Generation (lucy-image-2)
 * Usage: node scripts/decart_image_bridge.cjs <templatePath> <refUserPath> <prompt> <outputPath>
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function getDecartKey() {
  if (process.env.DECART_API_KEY) return process.env.DECART_API_KEY.trim();
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    const m = raw.match(/^DECART_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return '';
}

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.webp') return 'image/webp';
  if (ext === '.png') return 'image/png';
  return 'image/jpeg';
}

(async () => {
  const [, , templatePath, refUserPath, prompt, outputPath] = process.argv;
  if (!templatePath || !refUserPath || !prompt || !outputPath) {
    console.error('Usage: node decart_image_bridge.cjs <templatePath> <refUserPath> <prompt> <outputPath>');
    process.exit(2);
  }

  const apiKey = getDecartKey();
  if (!apiKey) {
    console.error('DECART_API_KEY missing');
    process.exit(3);
  }

  const sdkUrl = pathToFileURL(path.resolve(__dirname, '..', 'node_modules', '@decartai', 'sdk', 'dist', 'index.js')).href;
  const sdk = await import(sdkUrl);
  const client = sdk.createDecartClient({ apiKey });
  const modelDef = sdk.listModels().find((m) => m.name === 'lucy-image-2' && m.kind === 'image');
  if (!modelDef) {
    console.error('lucy-image-2 image model not found in SDK');
    process.exit(4);
  }

  const tplBuf = fs.readFileSync(templatePath);
  const payload = {
    model: modelDef,
    data: new Blob([tplBuf], { type: getMime(templatePath) }),
    prompt,
    enhance_prompt: false
  };

  if (refUserPath && refUserPath !== 'NONE' && fs.existsSync(refUserPath)) {
    const refBuf = fs.readFileSync(refUserPath);
    payload.reference_image = new Blob([refBuf], { type: getMime(refUserPath) });
  }

  const outBlob = await client.process(payload);

  const outBuf = Buffer.from(await outBlob.arrayBuffer());
  fs.writeFileSync(outputPath, outBuf);
  console.log(`OK:${outBuf.length}`);
})().catch((err) => {
  console.error('DECART_BRIDGE_ERR:', err.message || String(err));
  process.exit(1);
});
