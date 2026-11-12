// Avatar metadata, profession configuration, image mapping, and NLP prompt parser

export const AVATARS_BY_GENDER = {
  male: [
    {
      id: 'pilot',
      name: 'Pilot',
      profession: 'pilot',
      subtitle: 'Commercial Airline Captain',
      description: 'Navy captain blazer, 4 gold ranking stripes, winged badge, aviator headset & cap.',
      accentColor: '#0ea5e9',
      secondaryColor: '#f59e0b',
      image: '/Images/Male Pilot.png',
      badge: 'COMMANDER',
      decorations: 'aviation'
    },
    {
      id: 'doctor',
      name: 'Doctor',
      profession: 'doctor',
      subtitle: 'Chief Medical Specialist',
      description: 'Sterile physician white lab coat, teal surgical scrubs, stethoscope & telemetry badge.',
      accentColor: '#10b981',
      secondaryColor: '#06b6d4',
      image: '/Images/Male Doctor.png',
      badge: 'MED-SURG',
      decorations: 'medical'
    },
    {
      id: 'astronaut',
      name: 'Astronaut',
      profession: 'astronaut',
      subtitle: 'Deep Space Mission Specialist',
      description: 'Pressurized orbital EVA spacesuit, reflective gold visor helmet, oxygen thruster backpack.',
      accentColor: '#8b5cf6',
      secondaryColor: '#38bdf8',
      image: '/Images/Male Astronout.png',
      badge: 'NASA-EVA',
      decorations: 'space'
    },
    {
      id: 'police',
      name: 'Police Officer',
      profession: 'police',
      subtitle: 'Metropolitan Tactical Patrol',
      description: 'Midnight blue tactical duty vest, silver star shield, duty utility belt & radio harness.',
      accentColor: '#2563eb',
      secondaryColor: '#f43f5e',
      image: '/Images/Male police.png',
      badge: 'TACTICAL',
      decorations: 'police'
    },
    {
      id: 'business',
      name: 'Business Professional',
      profession: 'business',
      subtitle: 'Global Enterprise Executive',
      description: 'Bespoke charcoal tailored executive blazer, French cuff dress shirt, silk tie & platinum watch.',
      accentColor: '#6366f1',
      secondaryColor: '#94a3b8',
      image: '/Images/Male Employee.png',
      badge: 'EXECUTIVE',
      decorations: 'business'
    },
    {
      id: 'custom',
      isCustom: true,
      name: '? Custom Look',
      profession: 'custom',
      subtitle: 'AI Natural Language Persona',
      description: 'Voice or text-prompt custom persona generator. Describe any profession or outfit.',
      accentColor: '#ec4899',
      secondaryColor: '#a855f7',
      image: null,
      badge: 'AI CUSTOM',
      decorations: 'custom'
    }
  ],
  female: [
    {
      id: 'pilot',
      name: 'Pilot',
      profession: 'pilot',
      subtitle: 'Aero Transport Captain',
      description: 'Sharply tailored aviator uniform with gold sleeve rings, aviator frame glasses & peaked cap.',
      accentColor: '#0ea5e9',
      secondaryColor: '#f59e0b',
      image: '/Images/Female pilot.png',
      badge: 'FLIGHT DECK',
      decorations: 'aviation'
    },
    {
      id: 'doctor',
      name: 'Doctor',
      profession: 'doctor',
      subtitle: 'Senior Consultant Physician',
      description: 'Tailored medical lab coat, cyan clinical scrubs, 3D stethoscope & digital medical HUD.',
      accentColor: '#10b981',
      secondaryColor: '#06b6d4',
      image: '/Images/female doctor.png',
      badge: 'CLINICAL MD',
      decorations: 'medical'
    },
    {
      id: 'astronaut',
      name: 'Astronaut',
      profession: 'astronaut',
      subtitle: 'Planetary Exploration Commander',
      description: 'Ultra-light composite spacesuit, high-definition visor helmet, lunar navigation module.',
      accentColor: '#8b5cf6',
      secondaryColor: '#38bdf8',
      image: '/Images/Female Astronout.png',
      badge: 'COSMO-X',
      decorations: 'space'
    },
    {
      id: 'police',
      name: 'Police Officer',
      profession: 'police',
      subtitle: 'Metropolitan Tactical Patrol',
      description: 'Midnight blue tactical duty vest, silver star shield, duty utility belt & radio harness.',
      accentColor: '#2563eb',
      secondaryColor: '#f43f5e',
      image: '/Images/Female police.png',
      badge: 'TACTICAL',
      decorations: 'police'
    },
    {
      id: 'business',
      name: 'Business Professional',
      profession: 'business',
      subtitle: 'Chief Executive Officer',
      description: 'Power blazer tailored suit, high-collar silk blouse, fine jewelry accents & luxury timepiece.',
      accentColor: '#6366f1',
      secondaryColor: '#94a3b8',
      image: '/Images/female employee.png',
      badge: 'MANAGING DIR',
      decorations: 'business'
    },
    {
      id: 'custom',
      isCustom: true,
      name: '? Custom Look',
      profession: 'custom',
      subtitle: 'AI Natural Language Persona',
      description: 'Voice or text-prompt custom persona generator. Describe any profession or outfit.',
      accentColor: '#ec4899',
      secondaryColor: '#a855f7',
      image: null,
      badge: 'AI CUSTOM',
      decorations: 'custom'
    }
  ]
};

const UNSAFE_WORDS = [
  'nude', 'naked', 'nsfw', 'lingerie', 'bikini', 'underwear', 'bra', 'panties',
  'topless', 'shirtless', 'explicit', 'porn', 'porno', 'erotic', 'sexual', 'sex',
  'fetish', 'blood', 'gore', 'violent', 'weapon', 'gun', 'rifle', 'knife',
  'kill', 'murder', 'terrorist', 'suicide', 'drugs', 'cocaine'
];

export function validateCustomPromptClient(promptText) {
  const cleaned = (promptText || '').trim();
  if (cleaned.length < 3) {
    return { valid: false, reason: 'Please enter at least 3 characters describing the outfit.' };
  }
  if (cleaned.length > 200) {
    return { valid: false, reason: 'Please keep the outfit description under 200 characters.' };
  }
  const words = cleaned.toLowerCase().match(/[a-z]+/g) || [];
  const hasUnsafe = words.some((w) => UNSAFE_WORDS.includes(w));
  if (hasUnsafe) {
    return {
      valid: false,
      reason: 'That prompt is not supported in this public kiosk. Please describe safe professional or creative attire.'
    };
  }
  return { valid: true, cleaned };
}

// NLP Prompt interpreter for custom look
export function parseCustomPrompt(promptText, gender = 'male') {
  const p = promptText.toLowerCase().trim();

  // Keyword rules for matching closest floating studio badge theme (while SD 1.5 uses exact custom prompt!)
  if (p.includes('doctor') || p.includes('medic') || p.includes('hospital') || p.includes('nurse') || p.includes('surgeon') || p.includes('clinic')) {
    return {
      targetProfession: 'custom',
      customTitle: `Custom: ${promptText.trim().slice(0, 26)}`,
      customDescription: `AI Custom Outfit: "${promptText.trim()}"`,
      decorations: 'medical',
      primaryColor: '#10b981',
      accentColor: '#06b6d4'
    };
  }

  if (p.includes('astronaut') || p.includes('space') || p.includes('moon') || p.includes('mars') || p.includes('orbit') || p.includes('galaxy') || p.includes('cosmo')) {
    return {
      targetProfession: 'custom',
      customTitle: `Custom: ${promptText.trim().slice(0, 26)}`,
      customDescription: `AI Custom Outfit: "${promptText.trim()}"`,
      decorations: 'space',
      primaryColor: '#8b5cf6',
      accentColor: '#38bdf8'
    };
  }

  if (p.includes('pilot') || p.includes('fly') || p.includes('cockpit') || p.includes('captain') || p.includes('aviation')) {
    return {
      targetProfession: 'custom',
      customTitle: `Custom: ${promptText.trim().slice(0, 26)}`,
      customDescription: `AI Custom Outfit: "${promptText.trim()}"`,
      decorations: 'aviation',
      primaryColor: '#0ea5e9',
      accentColor: '#f59e0b'
    };
  }

  if (p.includes('police') || p.includes('cop') || p.includes('officer') || p.includes('detective') || p.includes('tactical') || p.includes('patrol')) {
    return {
      targetProfession: 'custom',
      customTitle: `Custom: ${promptText.trim().slice(0, 26)}`,
      customDescription: `AI Custom Outfit: "${promptText.trim()}"`,
      decorations: 'police',
      primaryColor: '#2563eb',
      accentColor: '#f43f5e'
    };
  }

  if (p.includes('business') || p.includes('professional') || p.includes('executive') || p.includes('suit') || p.includes('ceo') || p.includes('manager') || p.includes('corporate') || p.includes('employee')) {
    return {
      targetProfession: 'custom',
      customTitle: `Custom: ${promptText.trim().slice(0, 26)}`,
      customDescription: `AI Custom Outfit: "${promptText.trim()}"`,
      decorations: 'business',
      primaryColor: '#6366f1',
      accentColor: '#94a3b8'
    };
  }

  // Genuine custom theme (do NOT silently fall back to Pilot)
  return {
    targetProfession: 'custom',
    customTitle: `Custom: ${promptText.trim().slice(0, 24)}`,
    customDescription: `AI Custom Outfit: "${promptText.trim()}"`,
    decorations: 'custom',
    primaryColor: '#ec4899',
    accentColor: '#38bdf8'
  };
}
