/**
 * Modular Fantasy Character Registry for Local 3D Avatar Virtual Mirror (/#3d-avatar-mirror)
 *
 * Defines ONLY the six original fantasy characters.
 * Each character points to its expected rigged humanoid VRM model in `public/avatars/`
 * and its separate hand-attached 3D weapon/prop GLB in `public/avatars/props/`.
 *
 * Adding or replacing any character's `.vrm` or `.glb` file automatically activates
 * full-body 17-bone MediaPipe retargeting and hand-bone weapon attachment with zero code changes.
 */

export const FANTASY_AVATARS = [
  {
    id: 'aether_knight',
    name: 'AETHER KNIGHT',
    shortLabel: 'Aether Knight',
    element: 'Aether Energy',
    armor: 'White, silver & gold fantasy armour',
    weapon: 'Glowing blue energy sword',
    effects: 'Blue energy aura & sparks',
    accentColor: '#38bdf8',
    accentGlow: 'rgba(56, 189, 248, 0.35)',
    rimLightHex: 0x38bdf8,
    thumbnail: '/avatars/thumbnails/aether_knight.svg',
    modelPath: '/avatars/aether_knight.vrm',
    prop: {
      name: 'Aether Energy Sword',
      path: '/avatars/props/aether_sword.glb',
      targetBone: 'rightHand',
      handLabel: 'Right Hand',
      position: [0.02, -0.02, 0.04],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  },
  {
    id: 'phoenix_mage',
    name: 'PHOENIX MAGE',
    shortLabel: 'Phoenix Mage',
    element: 'Phoenix Fire',
    armor: 'Black, orange & gold fantasy robes/armour',
    weapon: 'Flaming magical staff',
    effects: 'Phoenix flames & rising embers',
    accentColor: '#f97316',
    accentGlow: 'rgba(249, 115, 22, 0.35)',
    rimLightHex: 0xf97316,
    thumbnail: '/avatars/thumbnails/phoenix_mage.svg',
    modelPath: '/avatars/phoenix_mage.vrm',
    prop: {
      name: 'Flaming Phoenix Staff',
      path: '/avatars/props/phoenix_staff.glb',
      targetBone: 'rightHand',
      handLabel: 'Right Hand',
      position: [0.02, -0.04, 0.03],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  },
  {
    id: 'forest_warden',
    name: 'FOREST WARDEN',
    shortLabel: 'Forest Warden',
    element: 'Verdant Nature',
    armor: 'Emerald green organic fantasy armour',
    weapon: 'Magical bow & glowing arrow',
    effects: 'Floating leaves & nature energy',
    accentColor: '#10b981',
    accentGlow: 'rgba(16, 185, 129, 0.35)',
    rimLightHex: 0x10b981,
    thumbnail: '/avatars/thumbnails/forest_warden.svg',
    modelPath: '/avatars/forest_warden.vrm',
    prop: {
      name: 'Verdant Bow & Glowing Arrow',
      path: '/avatars/props/forest_bow.glb',
      targetBone: 'leftHand',
      handLabel: 'Left Hand',
      position: [-0.02, -0.02, 0.04],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  },
  {
    id: 'solar_empress',
    name: 'SOLAR EMPRESS',
    shortLabel: 'Solar Empress',
    element: 'Celestial Sun',
    armor: 'Elegant golden celestial armour',
    weapon: 'Magical golden sun staff',
    effects: 'Floating sun halo & golden radiance',
    accentColor: '#facc15',
    accentGlow: 'rgba(250, 204, 21, 0.35)',
    rimLightHex: 0xfacc15,
    thumbnail: '/avatars/thumbnails/solar_empress.svg',
    modelPath: '/avatars/solar_empress.vrm',
    prop: {
      name: 'Golden Sun Staff',
      path: '/avatars/props/solar_staff.glb',
      targetBone: 'rightHand',
      handLabel: 'Right Hand',
      position: [0.02, -0.04, 0.03],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  },
  {
    id: 'frost_titan',
    name: 'FROST TITAN',
    shortLabel: 'Frost Titan',
    element: 'Glacial Frost',
    armor: 'Navy blue & silver ice armour',
    weapon: 'Large magical ice axe',
    effects: 'Frost mist & floating ice shards',
    accentColor: '#60a5fa',
    accentGlow: 'rgba(96, 165, 250, 0.35)',
    rimLightHex: 0x60a5fa,
    thumbnail: '/avatars/thumbnails/frost_titan.svg',
    modelPath: '/avatars/frost_titan.vrm',
    prop: {
      name: 'Glacial Ice Axe',
      path: '/avatars/props/frost_axe.glb',
      targetBone: 'rightHand',
      handLabel: 'Right Hand',
      position: [0.03, -0.03, 0.04],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  },
  {
    id: 'dragon_lord',
    name: 'DRAGON LORD',
    shortLabel: 'Dragon Lord',
    element: 'Dragon Fire',
    armor: 'Black & gold dragon-themed armour',
    weapon: 'Dragon-shaped gauntlet',
    effects: 'Fire & dragon energy aura',
    accentColor: '#ef4444',
    accentGlow: 'rgba(239, 68, 68, 0.35)',
    rimLightHex: 0xf97316,
    thumbnail: '/avatars/thumbnails/dragon_lord.svg',
    modelPath: '/avatars/dragon_lord.vrm',
    prop: {
      name: 'Dragon-Shaped Gauntlet',
      path: '/avatars/props/dragon_gauntlet.glb',
      targetBone: 'rightHand',
      handLabel: 'Right Hand',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  }
];
