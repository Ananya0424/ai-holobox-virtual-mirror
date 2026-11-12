import React from 'react';

/**
 * FloatingStudioDecorations Component
 * Renders continuous, GPU-friendly animated holographic SVG elements strictly behind the subject
 * in peripheral outer margins—zero cards, zero boxes, never obscuring face or body.
 */
export default function FloatingStudioDecorations({ profession = 'pilot' }) {
  const profKey = (profession || 'pilot').toLowerCase();

  const getHolograms = () => {
    if (profKey.includes('doctor') || profKey.includes('medic')) {
      return [
        {
          id: 'holo-med-cross',
          pos: { top: '12%', left: '4%' },
          anim: 'float-slow-1',
          svg: (
            <svg width="82" height="82" viewBox="0 0 82 82" fill="none" className="holo-svg-cyan">
              <circle cx="41" cy="41" r="35" stroke="rgba(14,165,233,0.34)" strokeWidth="1.2" strokeDasharray="5 4" className="holo-spin-slow" />
              <circle cx="41" cy="41" r="25" stroke="rgba(56,189,248,0.28)" strokeWidth="1.1" strokeDasharray="3 4" className="holo-spin-reverse" />
              <path d="M36 22h10v14h14v10H46v14H36V46H22V36h14V22z" fill="rgba(14,165,233,0.16)" stroke="rgba(2,132,199,0.62)" strokeWidth="1.6" className="holo-pulse-glow" />
            </svg>
          )
        },
        {
          id: 'holo-ecg',
          pos: { top: '17%', right: '4%' },
          anim: 'float-slow-2',
          svg: (
            <svg width="96" height="58" viewBox="0 0 96 58" fill="none" className="holo-svg-cyan">
              <path
                d="M4 30h16l6-17 10 34 11-28 8 15h16l5-9 6 5h10"
                stroke="rgba(56,189,248,0.24)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 30h16l6-17 10 34 11-28 8 15h16l5-9 6 5h10"
                stroke="rgba(14,165,233,0.75)"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="holo-ecg-wave"
              />
              <circle cx="88" cy="30" r="3.2" fill="rgba(14,165,233,0.75)" className="holo-pulse-glow" />
            </svg>
          )
        },
        {
          id: 'holo-dna',
          pos: { top: '46%', left: '3%' },
          anim: 'float-slow-3',
          svg: (
            <svg width="64" height="108" viewBox="0 0 64 108" fill="none" className="holo-svg-cyan">
              <g className="holo-dna-rotate">
                <path d="M18 8 C46 25, 46 43, 18 60 C46 77, 46 92, 18 100" stroke="rgba(2,132,199,0.58)" strokeWidth="2" strokeLinecap="round" />
                <path d="M46 8 C18 25, 18 43, 46 60 C18 77, 18 92, 46 100" stroke="rgba(56,189,248,0.52)" strokeWidth="2" strokeLinecap="round" />
                <line x1="21" y1="20" x2="43" y2="20" stroke="rgba(14,165,233,0.42)" strokeWidth="1.5" />
                <line x1="21" y1="35" x2="43" y2="35" stroke="rgba(14,165,233,0.42)" strokeWidth="1.5" />
                <line x1="21" y1="50" x2="43" y2="50" stroke="rgba(14,165,233,0.42)" strokeWidth="1.5" />
                <line x1="21" y1="68" x2="43" y2="68" stroke="rgba(14,165,233,0.42)" strokeWidth="1.5" />
                <line x1="21" y1="84" x2="43" y2="84" stroke="rgba(14,165,233,0.42)" strokeWidth="1.5" />
                <circle cx="18" cy="8" r="2.6" fill="rgba(14,165,233,0.65)" />
                <circle cx="46" cy="100" r="2.6" fill="rgba(56,189,248,0.65)" />
              </g>
            </svg>
          )
        },
        {
          id: 'holo-med-plus-float',
          pos: { top: '34%', right: '5%' },
          anim: 'float-slow-1',
          svg: (
            <svg width="62" height="72" viewBox="0 0 62 72" fill="none" className="holo-svg-cyan">
              <g className="holo-particle-a">
                <path d="M22 10v14M15 17h14" stroke="rgba(14,165,233,0.65)" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx="48" cy="22" r="3" fill="rgba(56,189,248,0.6)" />
              </g>
              <g className="holo-particle-b">
                <path d="M44 44v12M38 50h12" stroke="rgba(2,132,199,0.52)" strokeWidth="2.1" strokeLinecap="round" />
                <circle cx="16" cy="54" r="2.5" fill="rgba(14,165,233,0.55)" />
              </g>
            </svg>
          )
        },
        {
          id: 'holo-sci-rings',
          pos: { bottom: '17%', right: '4%' },
          anim: 'float-slow-2',
          svg: (
            <svg width="78" height="78" viewBox="0 0 78 78" fill="none" className="holo-svg-cyan">
              <circle cx="39" cy="39" r="30" stroke="rgba(14,165,233,0.34)" strokeWidth="1.3" strokeDasharray="6 4" className="holo-spin-slow" />
              <circle cx="39" cy="39" r="20" stroke="rgba(56,189,248,0.48)" strokeWidth="1.4" strokeDasharray="3 3" className="holo-spin-reverse" />
              <circle cx="39" cy="39" r="9" fill="rgba(14,165,233,0.14)" stroke="rgba(2,132,199,0.55)" strokeWidth="1.3" className="holo-pulse-glow" />
              <circle cx="39" cy="9" r="3.2" fill="rgba(2,132,199,0.72)" className="holo-spin-slow" />
            </svg>
          )
        },
        {
          id: 'holo-pulse-ring',
          pos: { bottom: '12%', left: '5%' },
          anim: 'float-slow-1',
          svg: (
            <svg width="68" height="68" viewBox="0 0 68 68" fill="none" className="holo-svg-cyan">
              <circle cx="34" cy="34" r="26" stroke="rgba(14,165,233,0.34)" strokeWidth="1.2" className="holo-pulse-glow" />
              <circle cx="34" cy="34" r="15" stroke="rgba(56,189,248,0.48)" strokeWidth="1.5" strokeDasharray="4 3" className="holo-spin-reverse" />
              <path d="M34 25v18M25 34h18" stroke="rgba(2,132,199,0.68)" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          )
        },
        {
          id: 'holo-med-particles-left',
          pos: { top: '28%', left: '6%' },
          anim: 'float-slow-2',
          svg: (
            <svg width="56" height="64" viewBox="0 0 56 64" fill="none" className="holo-svg-cyan">
              <circle cx="14" cy="18" r="3" fill="rgba(14,165,233,0.55)" className="holo-particle-a" />
              <circle cx="38" cy="12" r="2.2" fill="rgba(56,189,248,0.65)" className="holo-particle-b" />
              <circle cx="28" cy="46" r="3.5" fill="rgba(2,132,199,0.45)" className="holo-particle-a" />
              <path d="M44 36v8M40 40h8" stroke="rgba(14,165,233,0.58)" strokeWidth="1.8" strokeLinecap="round" className="holo-particle-b" />
            </svg>
          )
        }
      ];
    }

    if (profKey.includes('astronaut') || profKey.includes('space')) {
      return [
        {
          id: 'holo-planet',
          pos: { top: '13%', left: '4%' },
          anim: 'float-slow-1',
          svg: (
            <svg width="90" height="74" viewBox="0 0 90 74" fill="none" className="holo-svg-indigo">
              <circle cx="45" cy="37" r="18" fill="rgba(99,102,241,0.16)" stroke="rgba(79,70,229,0.6)" strokeWidth="1.5" />
              <ellipse cx="45" cy="37" rx="39" ry="11" transform="rotate(-22 45 37)" stroke="rgba(129,140,248,0.65)" strokeWidth="1.6" />
              <ellipse cx="45" cy="37" rx="32" ry="8" transform="rotate(-22 45 37)" stroke="rgba(56,189,248,0.4)" strokeWidth="1.1" strokeDasharray="4 3" />
            </svg>
          )
        },
        {
          id: 'holo-stars-right',
          pos: { top: '18%', right: '4%' },
          anim: 'float-slow-2',
          svg: (
            <svg width="82" height="82" viewBox="0 0 82 82" fill="none" className="holo-svg-indigo">
              <path d="M36 10L39.5 28.5L58 32L39.5 35.5L36 54L32.5 35.5L14 32L32.5 28.5Z" fill="rgba(99,102,241,0.2)" stroke="rgba(79,70,229,0.6)" strokeWidth="1.3" className="holo-twinkle" />
              <path d="M64 12L65.5 18.5L72 20L65.5 21.5L64 28L62.5 21.5L56 20L62.5 18.5Z" fill="rgba(56,189,248,0.45)" className="holo-twinkle" />
              <circle cx="18" cy="60" r="2.8" fill="rgba(99,102,241,0.6)" className="holo-particle-a" />
              <circle cx="62" cy="64" r="2.2" fill="rgba(14,165,233,0.65)" className="holo-particle-b" />
            </svg>
          )
        },
        {
          id: 'holo-orbit-left',
          pos: { top: '50%', left: '4%' },
          anim: 'float-slow-3',
          svg: (
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="holo-svg-indigo">
              <circle cx="40" cy="40" r="30" stroke="rgba(99,102,241,0.34)" strokeWidth="1.3" strokeDasharray="5 4" className="holo-spin-slow" />
              <circle cx="40" cy="40" r="18" stroke="rgba(14,165,233,0.46)" strokeWidth="1.3" className="holo-spin-reverse" />
              <circle cx="40" cy="40" r="5" fill="rgba(79,70,229,0.5)" className="holo-pulse-glow" />
              <circle cx="66" cy="24" r="3.6" fill="rgba(56,189,248,0.72)" className="holo-spin-slow" />
            </svg>
          )
        },
        {
          id: 'holo-constellation',
          pos: { bottom: '16%', right: '5%' },
          anim: 'float-slow-1',
          svg: (
            <svg width="84" height="72" viewBox="0 0 84 72" fill="none" className="holo-svg-indigo">
              <circle cx="14" cy="48" r="3" fill="rgba(79,70,229,0.6)" className="holo-twinkle" />
              <circle cx="34" cy="24" r="3.5" fill="rgba(14,165,233,0.7)" className="holo-twinkle" />
              <circle cx="56" cy="34" r="2.8" fill="rgba(79,70,229,0.6)" className="holo-twinkle" />
              <circle cx="70" cy="14" r="3.5" fill="rgba(99,102,241,0.7)" className="holo-twinkle" />
              <path d="M14 48L34 24L56 34L70 14" stroke="rgba(99,102,241,0.42)" strokeWidth="1.4" strokeDasharray="3 3" />
            </svg>
          )
        },
        {
          id: 'holo-mini-moon',
          pos: { bottom: '12%', left: '6%' },
          anim: 'float-slow-2',
          svg: (
            <svg width="62" height="62" viewBox="0 0 62 62" fill="none" className="holo-svg-indigo">
              <circle cx="31" cy="31" r="19" stroke="rgba(99,102,241,0.46)" strokeWidth="1.4" className="holo-pulse-glow" />
              <circle cx="25" cy="26" r="4" stroke="rgba(99,102,241,0.35)" strokeWidth="1.1" />
              <circle cx="37" cy="37" r="2.5" stroke="rgba(99,102,241,0.35)" strokeWidth="1.1" />
            </svg>
          )
        }
      ];
    }

    if (profKey.includes('police')) {
      return [
        {
          id: 'holo-shield',
          pos: { top: '15%', left: '5%' },
          anim: 'float-slow-1',
          svg: (
            <svg width="72" height="78" viewBox="0 0 72 78" fill="none" className="holo-svg-cyan">
              <path d="M36 8L12 18v18c0 15.5 10.2 28.8 24 33 13.8-4.2 24-17.5 24-33V18L36 8z" fill="rgba(37,99,235,0.12)" stroke="rgba(30,64,175,0.58)" strokeWidth="1.6" />
              <polygon points="36,24 39.5,32 48,33 41.8,39 43.4,47.5 36,43.2 28.6,47.5 30.2,39 24,33 32.5,32" fill="rgba(234,179,8,0.24)" stroke="rgba(202,138,4,0.68)" strokeWidth="1.3" className="holo-pulse-glow" />
            </svg>
          )
        },
        {
          id: 'holo-police-radar',
          pos: { top: '20%', right: '5%' },
          anim: 'float-slow-2',
          svg: (
            <svg width="76" height="76" viewBox="0 0 76 76" fill="none" className="holo-svg-cyan">
              <circle cx="38" cy="38" r="29" stroke="rgba(37,99,235,0.32)" strokeWidth="1.2" strokeDasharray="4 4" className="holo-spin-slow" />
              <circle cx="38" cy="38" r="19" stroke="rgba(14,165,233,0.44)" strokeWidth="1.2" strokeDasharray="3 3" className="holo-spin-reverse" />
              <circle cx="38" cy="38" r="7" fill="rgba(37,99,235,0.26)" stroke="rgba(37,99,235,0.6)" strokeWidth="1.3" className="holo-pulse-glow" />
            </svg>
          )
        },
        {
          id: 'holo-chevron',
          pos: { top: '52%', left: '5%' },
          anim: 'float-slow-3',
          svg: (
            <svg width="66" height="66" viewBox="0 0 66 66" fill="none" className="holo-svg-cyan">
              <path d="M16 26L33 14L50 26" stroke="rgba(37,99,235,0.58)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="holo-pulse-glow" />
              <path d="M16 38L33 26L50 38" stroke="rgba(14,165,233,0.52)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 50L33 38L50 50" stroke="rgba(56,189,248,0.44)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        },
        {
          id: 'holo-star-badge',
          pos: { bottom: '15%', right: '5%' },
          anim: 'float-slow-1',
          svg: (
            <svg width="68" height="68" viewBox="0 0 68 68" fill="none" className="holo-svg-cyan">
              <circle cx="34" cy="34" r="24" stroke="rgba(202,138,4,0.44)" strokeWidth="1.3" strokeDasharray="4 4" className="holo-spin-slow" />
              <polygon points="34,15 38.5,27 51,27.5 41,35.5 44.5,48 34,40.5 23.5,48 27,35.5 17,27.5 29.5,27" fill="rgba(234,179,8,0.2)" stroke="rgba(202,138,4,0.64)" strokeWidth="1.3" className="holo-twinkle" />
            </svg>
          )
        }
      ];
    }

    if (profKey.includes('pilot') || profKey.includes('avia')) {
      return [
        {
          id: 'holo-wings',
          pos: { top: '15%', left: '4%' },
          anim: 'float-slow-1',
          svg: (
            <svg width="88" height="54" viewBox="0 0 88 54" fill="none" className="holo-svg-cyan">
              <path d="M4 18h26l8 10h12l8-10h26l-8 10H64l-6 7H30l-6-7H12L4 18z" fill="rgba(14,165,233,0.16)" stroke="rgba(2,132,199,0.58)" strokeWidth="1.5" />
              <circle cx="44" cy="24" r="6" fill="rgba(234,179,8,0.24)" stroke="rgba(202,138,4,0.68)" strokeWidth="1.4" className="holo-pulse-glow" />
            </svg>
          )
        },
        {
          id: 'holo-compass',
          pos: { top: '19%', right: '5%' },
          anim: 'float-slow-2',
          svg: (
            <svg width="76" height="76" viewBox="0 0 76 76" fill="none" className="holo-svg-cyan">
              <circle cx="38" cy="38" r="28" stroke="rgba(14,165,233,0.4)" strokeWidth="1.3" strokeDasharray="3 4" className="holo-spin-slow" />
              <circle cx="38" cy="38" r="19" stroke="rgba(2,132,199,0.3)" strokeWidth="1.1" className="holo-spin-reverse" />
              <polygon points="38,14 43,38 38,62 33,38" fill="rgba(14,165,233,0.18)" stroke="rgba(2,132,199,0.6)" strokeWidth="1.2" />
            </svg>
          )
        },
        {
          id: 'holo-jet',
          pos: { top: '53%', left: '5%' },
          anim: 'float-slow-3',
          svg: (
            <svg width="70" height="70" viewBox="0 0 70 70" fill="none" className="holo-svg-cyan">
              <path d="M35 10L41 28L58 38V44L41 38V51L47 56V60L35 57L23 60V56L29 51V38L12 44V38L29 28L35 10Z" fill="rgba(14,165,233,0.16)" stroke="rgba(2,132,199,0.58)" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          )
        },
        {
          id: 'holo-horizon',
          pos: { bottom: '15%', right: '5%' },
          anim: 'float-slow-1',
          svg: (
            <svg width="78" height="60" viewBox="0 0 78 60" fill="none" className="holo-svg-cyan">
              <path d="M8 30h18l6-7h14l6 7h18" stroke="rgba(2,132,199,0.58)" strokeWidth="1.8" strokeLinecap="round" className="holo-pulse-glow" />
              <path d="M18 18h42M24 42h30" stroke="rgba(56,189,248,0.42)" strokeWidth="1.3" strokeDasharray="4 4" strokeLinecap="round" />
            </svg>
          )
        }
      ];
    }

    if (profKey.includes('bus') || profKey.includes('exec')) {
      return [
        {
          id: 'holo-chart',
          pos: { top: '16%', left: '5%' },
          anim: 'float-slow-1',
          svg: (
            <svg width="74" height="68" viewBox="0 0 74 68" fill="none" className="holo-svg-cyan">
              <rect x="14" y="38" width="10" height="20" rx="2" fill="rgba(14,165,233,0.16)" stroke="rgba(2,132,199,0.48)" strokeWidth="1.4" />
              <rect x="32" y="26" width="10" height="32" rx="2" fill="rgba(14,165,233,0.20)" stroke="rgba(2,132,199,0.54)" strokeWidth="1.4" />
              <rect x="50" y="14" width="10" height="44" rx="2" fill="rgba(99,102,241,0.18)" stroke="rgba(79,70,229,0.56)" strokeWidth="1.4" />
              <path d="M12 24L32 14L58 6" stroke="rgba(16,185,129,0.62)" strokeWidth="1.8" strokeLinecap="round" className="holo-ecg-wave" />
            </svg>
          )
        },
        {
          id: 'holo-diamond-grid',
          pos: { top: '20%', right: '5%' },
          anim: 'float-slow-2',
          svg: (
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="holo-svg-cyan">
              <polygon points="36,8 62,36 36,64 10,36" stroke="rgba(14,165,233,0.44)" strokeWidth="1.4" fill="rgba(14,165,233,0.08)" className="holo-spin-slow" />
              <polygon points="36,18 52,36 36,54 20,36" stroke="rgba(99,102,241,0.48)" strokeWidth="1.2" strokeDasharray="3 3" className="holo-spin-reverse" />
            </svg>
          )
        },
        {
          id: 'holo-rings-left',
          pos: { top: '54%', left: '5%' },
          anim: 'float-slow-3',
          svg: (
            <svg width="68" height="68" viewBox="0 0 68 68" fill="none" className="holo-svg-cyan">
              <circle cx="34" cy="34" r="24" stroke="rgba(14,165,233,0.36)" strokeWidth="1.3" strokeDasharray="5 4" className="holo-spin-slow" />
              <circle cx="34" cy="34" r="14" stroke="rgba(99,102,241,0.48)" strokeWidth="1.3" className="holo-pulse-glow" />
            </svg>
          )
        },
        {
          id: 'holo-prism-right',
          pos: { bottom: '15%', right: '5%' },
          anim: 'float-slow-1',
          svg: (
            <svg width="68" height="68" viewBox="0 0 68 68" fill="none" className="holo-svg-cyan">
              <polygon points="34,10 56,48 12,48" fill="rgba(14,165,233,0.1)" stroke="rgba(2,132,199,0.54)" strokeWidth="1.5" />
              <polygon points="34,22 46,44 22,44" stroke="rgba(99,102,241,0.48)" strokeWidth="1.1" className="holo-pulse-glow" />
            </svg>
          )
        }
      ];
    }

    // Custom / Universal holographic prism & sparkle aura
    return [
      {
        id: 'holo-custom-sparkle',
        pos: { top: '16%', left: '5%' },
        anim: 'float-slow-1',
        svg: (
          <svg width="74" height="74" viewBox="0 0 74 74" fill="none" className="holo-svg-indigo">
            <path d="M37 10L42 32L64 37L42 42L37 64L32 42L10 37L32 32Z" fill="rgba(139,92,246,0.16)" stroke="rgba(124,58,237,0.58)" strokeWidth="1.5" className="holo-twinkle" />
            <circle cx="37" cy="37" r="26" stroke="rgba(14,165,233,0.34)" strokeWidth="1.2" strokeDasharray="4 4" className="holo-spin-slow" />
          </svg>
        )
      },
      {
        id: 'holo-custom-rings',
        pos: { top: '20%', right: '5%' },
        anim: 'float-slow-2',
        svg: (
          <svg width="74" height="74" viewBox="0 0 74 74" fill="none" className="holo-svg-cyan">
            <circle cx="37" cy="37" r="26" stroke="rgba(14,165,233,0.42)" strokeWidth="1.4" strokeDasharray="5 4" className="holo-spin-slow" />
            <circle cx="37" cy="37" r="15" stroke="rgba(168,85,247,0.5)" strokeWidth="1.4" className="holo-spin-reverse" />
          </svg>
        )
      },
      {
        id: 'holo-custom-prism',
        pos: { top: '54%', left: '5%' },
        anim: 'float-slow-3',
        svg: (
          <svg width="68" height="68" viewBox="0 0 68 68" fill="none" className="holo-svg-indigo">
            <polygon points="34,8 58,34 34,60 10,34" fill="rgba(14,165,233,0.12)" stroke="rgba(2,132,199,0.52)" strokeWidth="1.5" className="holo-pulse-glow" />
          </svg>
        )
      },
      {
        id: 'holo-custom-stars',
        pos: { bottom: '15%', right: '5%' },
        anim: 'float-slow-1',
        svg: (
          <svg width="68" height="68" viewBox="0 0 68 68" fill="none" className="holo-svg-cyan">
            <path d="M28 14L31 27L44 30L31 33L28 46L25 33L12 30L25 27Z" fill="rgba(14,165,233,0.22)" stroke="rgba(2,132,199,0.55)" strokeWidth="1.2" className="holo-twinkle" />
            <circle cx="52" cy="48" r="4" stroke="rgba(139,92,246,0.58)" strokeWidth="1.4" className="holo-particle-a" />
          </svg>
        )
      }
    ];
  };

  const holograms = getHolograms();

  return (
    <div className="floating-studio-decorations-container" aria-hidden="true">
      {holograms.map((item) => (
        <div
          key={item.id}
          className={`floating-decoration-item holo-float-item ${item.anim}`}
          style={{ position: 'absolute', ...item.pos }}
        >
          {item.svg}
        </div>
      ))}
    </div>
  );
}
