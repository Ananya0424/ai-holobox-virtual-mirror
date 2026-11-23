/**
 * Real-Time AI Mirror Characters Configuration for Decart Lucy (lucy-vton-3.6 / lucy-2.6)
 * Six Original Fantasy Transformations with Reference-Image VTON Conditioning
 * Strictly engineered to transfer fantasy armour, weapon-in-hand & elemental FX
 * while preserving 100% of the live user's real face, eyeglasses, hair & movements.
 */

export const DECART_CHARACTERS = [
  {
    num: '01',
    id: 'aether-knight',
    name: 'Aether Knight',
    subtitle: 'Energy Blade',
    fullName: 'Aether Knight',
    icon: '⚔️',
    thumbnail: '/characters/fantasy/aether_knight.jpg',
    referenceImage: '/characters/fantasy/aether_knight.jpg',
    accentColor: '#38bdf8',
    gradient: 'linear-gradient(135deg, #0369a1 0%, #38bdf8 50%, #fef08a 100%)',
    badgeText: 'AETHER',
    description: 'White, silver, and gold fantasy plate armour with a glowing blue energy sword and radiant cyan aether sparks.',
    prompt:
      'Transform the person\'s outfit from the neck down into the white, silver, and gold fantasy plate armour from the reference image, with a glowing cyan-blue energy broadsword held naturally in their right hand and subtle blue aether energy sparks around the blade and armour. No helmet. Preserve the person\'s exact real face, eyes, eyeglasses, hair, natural skin tone, and live movements completely unchanged from the input video.'
  },
  {
    num: '02',
    id: 'phoenix-mage',
    name: 'Phoenix Mage',
    subtitle: 'Flaming Staff',
    fullName: 'Phoenix Mage',
    icon: '🔥',
    thumbnail: '/characters/fantasy/phoenix_mage.jpg',
    referenceImage: '/characters/fantasy/phoenix_mage.jpg',
    accentColor: '#f97316',
    gradient: 'linear-gradient(135deg, #7c2d12 0%, #f97316 55%, #fde047 100%)',
    badgeText: 'PHOENIX',
    description: 'Black, orange, and gold fantasy robes and sculpted pauldrons with a flaming magical staff and rising phoenix embers.',
    prompt:
      'Transform the person\'s outfit from the neck down into the obsidian black, burnt-orange, and ornate gold fantasy mage robes and sculpted shoulder armour from the reference image, holding the flaming magical golden staff naturally in their right hand with warm swirling phoenix flames and floating glowing embers. No hood or mask covering the face. Preserve the person\'s exact real face, eyes, eyeglasses, hair, natural skin tone, and live movements completely unchanged from the input video.'
  },
  {
    num: '03',
    id: 'forest-warden',
    name: 'Forest Warden',
    subtitle: 'Emerald Bow',
    fullName: 'Forest Warden',
    icon: '🌿',
    thumbnail: '/characters/fantasy/forest_warden.jpg',
    referenceImage: '/characters/fantasy/forest_warden.jpg',
    accentColor: '#10b981',
    gradient: 'linear-gradient(135deg, #064e3b 0%, #10b981 55%, #a7f3d0 100%)',
    badgeText: 'VERDANT',
    description: 'Emerald green organic leaf-sculpted fantasy armour with a magical bow, glowing arrow, and floating nature leaves.',
    prompt:
      'Transform the person\'s outfit from the neck down into the emerald green organic leaf-sculpted fantasy ranger armour and dark leather trim from the reference image, holding the magical recurve bow with a glowing emerald energy arrow naturally in their hand, surrounded by gently floating luminous green leaves and soft nature magic sparkles. No helmet. Preserve the person\'s exact real face, eyes, eyeglasses, hair, natural skin tone, and live movements completely unchanged from the input video.'
  },
  {
    num: '04',
    id: 'solar-empress',
    name: 'Solar Empress',
    subtitle: 'Celestial Halo',
    fullName: 'Solar Empress',
    icon: '☀️',
    thumbnail: '/characters/fantasy/solar_empress.jpg',
    referenceImage: '/characters/fantasy/solar_empress.jpg',
    accentColor: '#facc15',
    gradient: 'linear-gradient(135deg, #b45309 0%, #facc15 55%, #fef9c3 100%)',
    badgeText: 'SOLAR',
    description: 'Elegant golden celestial armour with a floating radiant sun halo behind the head and a glowing golden sun staff.',
    prompt:
      'Transform the person\'s outfit from the neck down into the elegant golden and ivory celestial fantasy armour from the reference image, with a luminous floating golden sun halo glowing cleanly behind their head and the ornate magical golden sun staff held naturally in their right hand with warm golden light motes. No helmet or face covering. Preserve the person\'s exact real face, eyes, eyeglasses, hair, natural skin tone, and live movements completely unchanged from the input video.'
  },
  {
    num: '05',
    id: 'frost-titan',
    name: 'Frost Titan',
    subtitle: 'Glacial Axe',
    fullName: 'Frost Titan',
    icon: '❄️',
    thumbnail: '/characters/fantasy/frost_titan.jpg',
    referenceImage: '/characters/fantasy/frost_titan.jpg',
    accentColor: '#60a5fa',
    gradient: 'linear-gradient(135deg, #172554 0%, #2563eb 50%, #bae6fd 100%)',
    badgeText: 'FROST',
    description: 'Navy blue and frosted silver ice-forged heavy plate armour with a large crystalline ice battle-axe and floating ice shards.',
    prompt:
      'Transform the person\'s outfit from the neck down into the heavy navy blue and frosted silver ice-forged fantasy plate armour from the reference image, holding the large magical glowing crystalline ice battle-axe naturally in their right hand with drifting cold frost mist and floating translucent ice shards. No helmet. Preserve the person\'s exact real face, eyes, eyeglasses, hair, natural skin tone, and live movements completely unchanged from the input video.'
  },
  {
    num: '06',
    id: 'dragon-lord',
    name: 'Dragon Lord',
    subtitle: 'Dragon Gauntlet',
    fullName: 'Dragon Lord',
    icon: '🐉',
    thumbnail: '/characters/fantasy/dragon_lord.jpg',
    referenceImage: '/characters/fantasy/dragon_lord.jpg',
    accentColor: '#ef4444',
    gradient: 'linear-gradient(135deg, #450a0a 0%, #dc2626 50%, #f59e0b 100%)',
    badgeText: 'DRAGON',
    description: 'Black and gold dragon-scale fantasy armour with a sculpted dragon-shaped gauntlet on one hand and blazing fire aura.',
    prompt:
      'Transform the person\'s outfit from the neck down into the obsidian black and antique gold dragon-scale fantasy armour from the reference image, wearing the sculpted black-and-gold dragon-shaped gauntlet over their right hand and forearm surrounded by glowing fire embers and fierce orange-gold dragon energy aura. No helmet. Preserve the person\'s exact real face, eyes, eyeglasses, hair, natural skin tone, and live movements completely unchanged from the input video.'
  }
];

export const DECART_CONFIG = {
  defaultModel: 'lucy-vton-3.6',
  fallbackModel: 'lucy-2.6',
  restyleModel: 'lucy-restyle-2',
  idealWidth: 1280,
  idealHeight: 720,
  idealFps: 30,
  tokenEndpoint: '/api/decart/token',
  sessionTimeoutSeconds: 300
};
