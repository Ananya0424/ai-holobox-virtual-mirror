import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, Sparkles, Check, Compass, Eye, Shield } from 'lucide-react';
import { playAudio } from '../utils/audio';

export default function ThemeSelectionScreen({
  selectedGender,
  onSelectTheme,
  onBack
}) {
  const isFemale = selectedGender === 'female';

  const themes = [
    {
      id: 'mickey',
      name: 'Mickey / Cat & Mouse',
      tag: 'CLASSIC 3D TOON WORLD',
      icon: '🐱',
      tagline: 'Giant playful grey cat & mischievous cartoon mouse',
      image: isFemale ? '/Images/Women Micky.webp' : '/Images/Men Micky.webp',
      accentColor: '#8b5cf6',
      gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      glowColor: 'rgba(139, 92, 246, 0.38)',
      badgeBg: '#faf5ff',
      badgeText: '#7c3aed',
      badgeBorder: 'rgba(139, 92, 246, 0.25)'
    },
    {
      id: 'dragon',
      name: 'Dragon Kingdom',
      tag: 'EPIC HIGH FANTASY',
      icon: '🐉',
      tagline: 'Majestic flying & perched fantasy golden dragons',
      image: isFemale ? '/Images/Female Dragon.webp' : '/Images/Men Dragon.webp',
      accentColor: '#0ea5e9',
      gradient: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
      glowColor: 'rgba(14, 165, 233, 0.38)',
      badgeBg: '#f0f9ff',
      badgeText: '#0284c7',
      badgeBorder: 'rgba(14, 165, 233, 0.25)'
    },
    {
      id: 'cartoon',
      name: 'Cartoon Friends',
      tag: '3D ANIMATED COMEDY',
      icon: '🦊',
      tagline: 'Playful panda, clever fox & cheerful 3D critters',
      image: isFemale ? '/Images/Women Cartoon.webp' : '/Images/Men Cartoon.webp',
      accentColor: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b, #b45309)',
      glowColor: 'rgba(245, 158, 11, 0.38)',
      badgeBg: '#fffbeb',
      badgeText: '#d97706',
      badgeBorder: 'rgba(245, 158, 11, 0.25)'
    },
    {
      id: 'horror',
      name: 'Horror Ghost',
      tag: 'GOTHIC SUPERNATURAL',
      icon: '👻',
      tagline: 'Creepy ghosts, skull reaper & haunted vintage dolls',
      image: isFemale ? '/Images/Women horror.webp' : '/Images/Men horror.webp',
      accentColor: '#ef4444',
      gradient: 'linear-gradient(135deg, #ef4444, #991b1b)',
      glowColor: 'rgba(239, 68, 68, 0.38)',
      badgeBg: '#fef2f2',
      badgeText: '#dc2626',
      badgeBorder: 'rgba(239, 68, 68, 0.25)'
    }
  ];

  // Default active view is Mickey / Cat & Mouse (index 0)
  const [activeIndex, setActiveIndex] = useState(0);

  // Touch and mouse drag swipe tracking
  const touchStartXRef = useRef(null);
  const isDraggingRef = useRef(false);

  const prevIndex = (activeIndex - 1 + themes.length) % themes.length;
  const nextIndex = (activeIndex + 1) % themes.length;

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    playAudio.click();
    setActiveIndex(prevIndex);
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    playAudio.click();
    setActiveIndex(nextIndex);
  };

  const handleSelectCurrent = () => {
    const selected = themes[activeIndex];
    playAudio.click();
    playAudio.whoosh();
    onSelectTheme(selected);
  };

  // Touch handlers
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    if (deltaX > 45) {
      handlePrev();
    } else if (deltaX < -45) {
      handleNext();
    }
    touchStartXRef.current = null;
  };

  // Mouse drag handlers
  const handleMouseDown = (e) => {
    touchStartXRef.current = e.clientX;
    isDraggingRef.current = true;
  };

  const handleMouseUp = (e) => {
    if (!isDraggingRef.current || touchStartXRef.current === null) return;
    const deltaX = e.clientX - touchStartXRef.current;
    if (deltaX > 45) {
      handlePrev();
    } else if (deltaX < -45) {
      handleNext();
    }
    isDraggingRef.current = false;
    touchStartXRef.current = null;
  };

  const currentTheme = themes[activeIndex];
  const leftTheme = themes[prevIndex];
  const rightTheme = themes[nextIndex];

  return (
    <div
      className="clean-screen-container avatar-selection-luxury"
      style={{
        background: '#ffffff',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Dynamic Ambient Background Light Aura matching current theme */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '20%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${currentTheme.glowColor} 0%, rgba(255,255,255,0) 70%)`,
          pointerEvents: 'none',
          transition: 'background 0.5s ease',
          zIndex: 1
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '5%',
          right: '-10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${currentTheme.glowColor} 0%, rgba(255,255,255,0) 70%)`,
          opacity: 0.6,
          pointerEvents: 'none',
          transition: 'background 0.5s ease',
          zIndex: 1
        }}
      />

      {/* Floating Holographic Ambient Particles */}
      <div className="holographic-decorations-ambient" aria-hidden="true" style={{ zIndex: 2 }}>
        <div className="holo-orbit-ring ring-top-left" />
        <div className="holo-orbit-ring ring-bottom-right" />
        <span className="holo-sparkle sp-1">✦</span>
        <span className="holo-sparkle sp-2">✧</span>
        <span className="holo-sparkle sp-3">✦</span>
        <span className="holo-sparkle sp-4">✧</span>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          ROW 1: DEDICATED TOP NAVIGATION BAR (Zero Overlap Guarantee)
         ════════════════════════════════════════════════════════════════════ */}
      <nav
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 22px 10px',
          zIndex: 30,
          position: 'relative'
        }}
      >
        {/* Back Button — Far Left */}
        {onBack ? (
          <button
            onClick={() => {
              playAudio.click();
              onBack();
            }}
            aria-label="Back to Experience Choice"
            style={{
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              color: '#0f172a',
              padding: '8px 16px',
              borderRadius: '9999px',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#0284c7';
              e.currentTarget.style.transform = 'translateX(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            <ArrowLeft size={17} color="#0284c7" strokeWidth={2.4} />
            <span>Back</span>
          </button>
        ) : (
          <div style={{ width: '80px' }} />
        )}

        {/* Center Pill: Holographic Tag */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.85)',
            border: '1px solid #e2e8f0',
            backdropFilter: 'blur(10px)',
            padding: '5px 14px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.8px',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <Sparkles size={12} color={currentTheme.accentColor} />
          <span>HOLOBOX 3D REALMS</span>
        </div>

        {/* Right Counter: Step Badge */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 800,
            color: '#0f172a',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <span style={{ color: currentTheme.accentColor }}>0{activeIndex + 1}</span> / 0{themes.length}
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════════════
          ROW 2: CREATIVE SCREEN TITLE & SUBTITLE (Completely Separate Row)
         ════════════════════════════════════════════════════════════════════ */}
      <header
        style={{
          textAlign: 'center',
          padding: '2px 20px 8px',
          zIndex: 25,
          position: 'relative'
        }}
      >
        <h1
          className="popout-heading-luxury"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '28px',
            fontWeight: 800,
            letterSpacing: '-0.4px',
            lineHeight: 1.2,
            margin: 0,
            background: 'linear-gradient(135deg, #0f172a 0%, #0284c7 45%, #7c3aed 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 8px rgba(14, 165, 233, 0.12))'
          }}
        >
          Choose Your Theme
        </h1>
        <p
          className="popout-sub-luxury"
          style={{
            margin: '4px 0 0',
            color: '#64748b',
            fontSize: '12.5px',
            fontWeight: 500,
            letterSpacing: '0.2px'
          }}
        >
          Step inside a living world — physically stand with realistic 3D characters
        </p>
      </header>

      {/* ════════════════════════════════════════════════════════════════════
          ROW 3: 3D PORTAL HERO STAGE (Curved Glassmorphism Portal Card)
         ════════════════════════════════════════════════════════════════════ */}
      <div
        className="avatar-carousel-hero-stage"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '0 10px',
          zIndex: 20
        }}
      >
        {/* Left Navigation Chevron Button */}
        <button
          className="luxury-carousel-nav-btn left-nav"
          onClick={handlePrev}
          aria-label="Previous Theme"
          style={{
            position: 'absolute',
            left: '12px',
            zIndex: 35,
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.92)',
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)'
          }}
        >
          <ChevronLeft size={26} color="#0284c7" strokeWidth={2.4} />
        </button>

        {/* Left Theme Preview (Angled 3D Side Slot) */}
        <div
          className="avatar-side-slot left-slot"
          onClick={handlePrev}
          role="button"
          tabIndex={0}
          aria-label={`Previous: ${leftTheme.name}`}
          style={{
            opacity: 0.45,
            transform: 'scale(0.78) perspective(600px) rotateY(12deg)',
            cursor: 'pointer',
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div
            style={{
              width: '180px',
              height: '320px',
              borderRadius: '22px',
              overflow: 'hidden',
              boxShadow: '0 12px 30px rgba(0,0,0,0.14)',
              border: '2px solid rgba(255,255,255,0.7)',
              background: '#ffffff'
            }}
          >
            <img
              src={leftTheme.image}
              alt={leftTheme.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(0.8px)'
              }}
            />
          </div>
        </div>

        {/* Center Main Active 3D Portal Hero Card */}
        <div
          className="avatar-center-hero-slot"
          onClick={handleSelectCurrent}
          role="button"
          tabIndex={0}
          aria-label={`Select ${currentTheme.name}`}
          style={{
            width: '100%',
            maxWidth: '410px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            zIndex: 25
          }}
        >
          {/* Main Curved Portal Card */}
          <div
            style={{
              width: '100%',
              height: '560px',
              maxHeight: '66vh',
              borderRadius: '28px',
              position: 'relative',
              overflow: 'hidden',
              background: '#ffffff',
              border: '2.5px solid rgba(255, 255, 255, 0.95)',
              boxShadow: `0 24px 60px rgba(15, 23, 42, 0.14), 0 0 50px ${currentTheme.glowColor}`,
              transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Top Corner HUD Badges Inside Card */}
            <div
              style={{
                position: 'absolute',
                top: '14px',
                left: '14px',
                right: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 10,
                pointerEvents: 'none'
              }}
            >
              {/* Category Pill */}
              <div
                style={{
                  background: currentTheme.badgeBg,
                  border: `1px solid ${currentTheme.badgeBorder}`,
                  color: currentTheme.badgeText,
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  fontWeight: 800,
                  fontSize: '11px',
                  letterSpacing: '0.6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                }}
              >
                <span>{currentTheme.icon}</span>
                <span>{currentTheme.tag}</span>
              </div>

              {/* 3D Depth Live Indicator */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#ffffff',
                  padding: '5px 11px',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  fontSize: '10px',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              >
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#22c55e',
                    boxShadow: '0 0 8px #22c55e'
                  }}
                />
                <span>3D DEPTH</span>
              </div>
            </div>

            {/* Theme Reference Image (Full Fit Inside Portal) */}
            <div
              style={{
                flex: 1,
                width: '100%',
                position: 'relative',
                overflow: 'hidden',
                background: '#ffffff'
              }}
            >
              <img
                src={currentTheme.image}
                alt={currentTheme.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  objectPosition: 'center 40%',
                  transition: 'transform 0.4s ease'
                }}
              />
            </div>

            {/* Bottom Frosted Glass Info Plate with Creative CTA */}
            <div
              style={{
                position: 'relative',
                background: 'rgba(255, 255, 255, 0.94)',
                borderTop: '1px solid rgba(226, 232, 240, 0.8)',
                backdropFilter: 'blur(16px)',
                padding: '14px 18px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 10
              }}
            >
              {/* Theme Name + Icon */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '20px',
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '-0.3px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{currentTheme.name}</span>
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: currentTheme.accentColor,
                    background: currentTheme.badgeBg,
                    padding: '3px 8px',
                    borderRadius: '6px'
                  }}
                >
                  READY
                </span>
              </div>

              {/* Tagline */}
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: '#64748b',
                  lineHeight: 1.35,
                  fontWeight: 500
                }}
              >
                {currentTheme.tagline}
              </p>

              {/* Big Vibrant Enter Realm CTA Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectCurrent();
                }}
                style={{
                  marginTop: '4px',
                  background: currentTheme.gradient,
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '14px',
                  fontWeight: 800,
                  fontSize: '14px',
                  letterSpacing: '0.4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: `0 8px 24px ${currentTheme.glowColor}`,
                  transition: 'all 0.2s ease'
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
              >
                <Sparkles size={16} />
                <span>ENTER {currentTheme.name.toUpperCase()}</span>
                <span style={{ fontSize: '15px' }}>➔</span>
              </button>
            </div>
          </div>

          {/* Holographic Concentric Floor Pedestal under Portal */}
          <div
            style={{
              position: 'relative',
              width: '260px',
              height: '30px',
              marginTop: '-12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5
            }}
          >
            <div
              style={{
                width: '100%',
                height: '18px',
                borderRadius: '50%',
                background: `radial-gradient(ellipse at center, ${currentTheme.glowColor} 0%, rgba(255,255,255,0) 70%)`,
                boxShadow: `0 0 20px ${currentTheme.glowColor}`
              }}
            />
          </div>
        </div>

        {/* Right Theme Preview (Angled 3D Side Slot) */}
        <div
          className="avatar-side-slot right-slot"
          onClick={handleNext}
          role="button"
          tabIndex={0}
          aria-label={`Next: ${rightTheme.name}`}
          style={{
            opacity: 0.45,
            transform: 'scale(0.78) perspective(600px) rotateY(-12deg)',
            cursor: 'pointer',
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div
            style={{
              width: '180px',
              height: '320px',
              borderRadius: '22px',
              overflow: 'hidden',
              boxShadow: '0 12px 30px rgba(0,0,0,0.14)',
              border: '2px solid rgba(255,255,255,0.7)',
              background: '#ffffff'
            }}
          >
            <img
              src={rightTheme.image}
              alt={rightTheme.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(0.8px)'
              }}
            />
          </div>
        </div>

        {/* Right Navigation Chevron Button */}
        <button
          className="luxury-carousel-nav-btn right-nav"
          onClick={handleNext}
          aria-label="Next Theme"
          style={{
            position: 'absolute',
            right: '12px',
            zIndex: 35,
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.92)',
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)'
          }}
        >
          <ChevronRight size={26} color="#0284c7" strokeWidth={2.4} />
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          ROW 4: INTERACTIVE PAGINATION PILL DOTS
         ════════════════════════════════════════════════════════════════════ */}
      <footer
        style={{
          padding: '12px 20px 22px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          zIndex: 25,
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {themes.map((th, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={th.id}
                onClick={() => {
                  playAudio.click();
                  setActiveIndex(idx);
                }}
                aria-label={`Jump to ${th.name}`}
                style={{
                  width: isActive ? '36px' : '10px',
                  height: '10px',
                  borderRadius: '9999px',
                  background: isActive ? currentTheme.gradient : '#e2e8f0',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: isActive ? `0 2px 10px ${currentTheme.glowColor}` : 'none'
                }}
              />
            );
          })}
        </div>

        <p
          style={{
            margin: 0,
            fontSize: '11px',
            fontWeight: 600,
            color: '#94a3b8',
            letterSpacing: '0.3px'
          }}
        >
          Swipe or tap cards to explore worlds
        </p>
      </footer>
    </div>
  );
}
