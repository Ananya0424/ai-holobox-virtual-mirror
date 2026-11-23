const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'characters');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

function createSvg(bgStart, bgEnd, accent, title, subtitle, iconPath) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
  <defs>
    <linearGradient id="bg_${accent.replace('#','')}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgStart}"/>
      <stop offset="100%" stop-color="${bgEnd}"/>
    </linearGradient>
    <radialGradient id="glow_${accent.replace('#','')}" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="200" height="240" rx="16" fill="url(#bg_${accent.replace('#','')})" />
  <rect x="2" y="2" width="196" height="236" rx="14" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="1.5" />
  <circle cx="100" cy="90" r="60" fill="url(#glow_${accent.replace('#','')})" />
  ${iconPath}
  <rect x="10" y="174" width="180" height="54" rx="10" fill="rgba(15,23,42,0.85)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="100" y="196" fill="#ffffff" font-family="'Space Grotesk', -apple-system, sans-serif" font-weight="800" font-size="12" text-anchor="middle" letter-spacing="0.5">${title}</text>
  <text x="100" y="214" fill="#94a3b8" font-family="-apple-system, sans-serif" font-weight="500" font-size="9.5" text-anchor="middle">${subtitle}</text>
</svg>`;
}

// 1. Sci-Fi Space Suit
const scifiSvg = createSvg(
  '#0f172a', '#1e293b', '#38bdf8', 'Sci-Fi Space Suit', 'Advanced Composite Armor',
  `<circle cx="100" cy="85" r="38" fill="#e2e8f0" stroke="#38bdf8" stroke-width="3"/>
   <ellipse cx="100" cy="85" rx="28" ry="20" fill="#0284c7" opacity="0.9"/>
   <ellipse cx="94" cy="80" rx="18" ry="10" fill="#38bdf8" opacity="0.7"/>
   <path d="M65 135 Q100 118 135 135 L145 170 L55 170 Z" fill="#cbd5e1" stroke="#38bdf8" stroke-width="2"/>
   <rect x="85" y="138" width="30" height="20" rx="4" fill="#0369a1"/>
   <circle cx="100" cy="148" r="4" fill="#38bdf8"/>`
);
fs.writeFileSync(path.join(dir, '01_scifi.svg'), scifiSvg);

// 2. NASA Astronaut
const nasaSvg = createSvg(
  '#0b132b', '#1c2541', '#60a5fa', 'NASA Astronaut', 'In EMU Space Suit',
  `<circle cx="100" cy="85" r="40" fill="#f8fafc" stroke="#94a3b8" stroke-width="3"/>
   <ellipse cx="100" cy="84" rx="30" ry="22" fill="#d97706" opacity="0.9"/>
   <ellipse cx="92" cy="78" rx="20" ry="11" fill="#fbbf24" opacity="0.7"/>
   <path d="M60 135 Q100 118 140 135 L150 170 L50 170 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
   <rect x="80" y="140" width="40" height="20" rx="3" fill="#334155"/>
   <circle cx="90" cy="150" r="3" fill="#ef4444"/><circle cx="100" cy="150" r="3" fill="#3b82f6"/>`
);
fs.writeFileSync(path.join(dir, '02_nasa.svg'), nasaSvg);

// 3. Knight
const knightSvg = createSvg(
  '#18181b', '#27272a', '#fbbf24', 'Knight', 'In Medieval Armor',
  `<path d="M100 45 C75 45 68 70 68 95 C68 115 82 125 100 128 C118 125 132 115 132 95 C132 70 125 45 100 45 Z" fill="#94a3b8" stroke="#fbbf24" stroke-width="2"/>
   <rect x="76" y="82" width="48" height="8" rx="2" fill="#0f172a"/>
   <line x1="100" y1="65" x2="100" y2="118" stroke="#fbbf24" stroke-width="2"/>
   <path d="M60 135 Q100 120 140 135 L150 170 L50 170 Z" fill="#64748b" stroke="#fbbf24" stroke-width="1.5"/>
   <path d="M90 138 L100 152 L110 138 Z" fill="#fbbf24"/>`
);
fs.writeFileSync(path.join(dir, '03_knight.svg'), knightSvg);

// 4. Queen
const queenSvg = createSvg(
  '#3b0764', '#581c87', '#f43f5e', 'Queen', 'In Royal Dress',
  `<path d="M75 60 L85 75 L100 55 L115 75 L125 60 L125 80 L75 80 Z" fill="#fbbf24" stroke="#e11d48" stroke-width="1.5"/>
   <circle cx="100" cy="95" r="25" fill="#fbcfe8"/>
   <ellipse cx="100" cy="85" rx="30" ry="22" fill="#4c1d95" opacity="0.8"/>
   <path d="M60 135 Q100 115 140 135 L155 170 L45 170 Z" fill="#be123c" stroke="#fbbf24" stroke-width="2"/>
   <circle cx="100" cy="140" r="5" fill="#fbbf24"/>`
);
fs.writeFileSync(path.join(dir, '04_queen.svg'), queenSvg);

// 5. Cyberpunk
const cyberSvg = createSvg(
  '#09090b', '#1e1b4b', '#06b6d4', 'Cyberpunk', 'Hacking the Night',
  `<circle cx="100" cy="90" r="30" fill="#f472b6" opacity="0.3"/>
   <rect x="70" y="80" width="60" height="16" rx="4" fill="#06b6d4" stroke="#f43f5e" stroke-width="2"/>
   <line x1="75" y1="88" x2="125" y2="88" stroke="#ffffff" stroke-width="2"/>
   <path d="M60 135 Q100 120 140 135 L150 170 L50 170 Z" fill="#18181b" stroke="#06b6d4" stroke-width="2"/>
   <line x1="75" y1="135" x2="75" y2="170" stroke="#f43f5e" stroke-width="2"/>
   <line x1="125" y1="135" x2="125" y2="170" stroke="#f43f5e" stroke-width="2"/>`
);
fs.writeFileSync(path.join(dir, '05_cyberpunk.svg'), cyberSvg);

// 6. Liquid Chrome
const chromeSvg = createSvg(
  '#1e293b', '#475569', '#cbd5e1', 'Liquid Chrome', 'Mirror Mercury Cyberware',
  `<path d="M100 48 C70 48 65 78 65 105 C65 130 80 145 100 145 C120 145 135 130 135 105 C135 78 130 48 100 48 Z" fill="#cbd5e1" stroke="#ffffff" stroke-width="2"/>
   <path d="M85 65 Q95 80 88 105 Q82 120 95 135" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.9"/>
   <ellipse cx="115" cy="85" rx="6" ry="12" fill="#ffffff" opacity="0.8"/>`
);
fs.writeFileSync(path.join(dir, '06_chrome.svg'), chromeSvg);

// 7. Ocean Guardian
const oceanSvg = createSvg(
  '#083344', '#0e7490', '#06b6d4', 'Ocean Guardian', 'Bioluminescent Lord',
  `<path d="M100 45 C75 45 70 75 70 100 C70 125 85 140 100 140 C115 140 130 125 130 100 C130 75 125 45 100 45 Z" fill="#0e7490" stroke="#22d3ee" stroke-width="2"/>
   <path d="M65 80 Q55 60 45 65 Q55 90 70 95" fill="#06b6d4"/>
   <path d="M135 80 Q145 60 155 65 Q145 90 130 95" fill="#06b6d4"/>
   <circle cx="88" cy="95" r="5" fill="#67e8f9"/>
   <circle cx="112" cy="95" r="5" fill="#67e8f9"/>`
);
fs.writeFileSync(path.join(dir, '07_ocean.svg'), oceanSvg);

// 8. Galaxy Being
const galaxySvg = createSvg(
  '#1e1b4b', '#4c1d95', '#c084fc', 'Galaxy Being', 'Cosmic Nebula Sovereign',
  `<circle cx="100" cy="95" r="45" fill="#581c87" stroke="#c084fc" stroke-width="2"/>
   <path d="M70 95 Q100 75 130 95 Q100 115 70 95" fill="#a855f7" opacity="0.6"/>
   <circle cx="85" cy="85" r="2" fill="#ffffff"/><circle cx="115" cy="80" r="2" fill="#ffffff"/>
   <circle cx="95" cy="110" r="1.5" fill="#ffffff"/><circle cx="110" cy="105" r="2" fill="#ffffff"/>`
);
fs.writeFileSync(path.join(dir, '08_galaxy.svg'), galaxySvg);

// 9. Lava Elemental
const lavaSvg = createSvg(
  '#450a0a', '#7f1d1d', '#f97316', 'Lava Elemental', 'Volcanic Magma Behemoth',
  `<path d="M100 45 C75 45 68 75 68 100 C68 125 82 140 100 140 C118 140 132 125 132 100 C132 75 125 45 100 45 Z" fill="#1c1917" stroke="#ea580c" stroke-width="2"/>
   <path d="M80 75 Q90 90 85 110 Q95 125 100 135" stroke="#f97316" stroke-width="3" fill="none"/>
   <path d="M120 75 Q110 95 115 115" stroke="#f59e0b" stroke-width="2.5" fill="none"/>
   <circle cx="88" cy="90" r="4" fill="#fbbf24"/><circle cx="112" cy="90" r="4" fill="#fbbf24"/>`
);
fs.writeFileSync(path.join(dir, '09_lava.svg'), lavaSvg);

// 10. Crystal Creature
const crystalSvg = createSvg(
  '#042f2e', '#115e59', '#2dd4bf', 'Crystal Creature', 'Prismatic Gemstone Entity',
  `<polygon points="100,45 135,75 130,120 100,145 70,120 65,75" fill="#134e4a" stroke="#2dd4bf" stroke-width="2"/>
   <polygon points="100,45 115,75 100,145 85,75" fill="#2dd4bf" opacity="0.4"/>
   <line x1="65" y1="75" x2="135" y2="75" stroke="#5eead4" stroke-width="1.5"/>
   <line x1="70" y1="120" x2="130" y2="120" stroke="#5eead4" stroke-width="1.5"/>`
);
fs.writeFileSync(path.join(dir, '10_crystal.svg'), crystalSvg);

console.log('Created 10 character preview SVG icons in public/characters/');
