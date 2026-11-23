const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getHash(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  } catch (e) {
    return 'N/A';
  }
}

function scanDir(dir, pattern) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      results.push(...scanDir(full, pattern));
    } else if (pattern.test(ent.name)) {
      const stat = fs.statSync(full);
      results.push({
        path: full,
        name: ent.name,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
        hash: getHash(full)
      });
    }
  }
  return results;
}

const root = process.cwd();
const publicImages = scanDir(path.join(root, 'public', 'Images'), /(dragon|cartoon)/i);
const publicThemeAssets = scanDir(path.join(root, 'public', 'theme_assets'), /(dragon|cartoon)/i);
const testOutputs = scanDir(path.join(root, 'test_outputs'), /(dragon|cartoon)/i);
const artifactDir = 'C:\\Users\\dell\\.gemini\\antigravity\\brain\\e182d9c9-1b53-418f-9fb6-2f89d88b013c';
const artifactFiles = scanDir(artifactDir, /(dragon|cartoon)/i);

console.log('=== 1. public/Images/ (Selection Cards & Previews) ===');
console.log(JSON.stringify(publicImages, null, 2));

console.log('\n=== 2. public/theme_assets/ (Layered Compositing Assets) ===');
console.log(JSON.stringify(publicThemeAssets, null, 2));

console.log('\n=== 3. test_outputs/ ===');
console.log(JSON.stringify(testOutputs, null, 2));

console.log('\n=== 4. Artifact Directory ===');
console.log(JSON.stringify(artifactFiles, null, 2));
