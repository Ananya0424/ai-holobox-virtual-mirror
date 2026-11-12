import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AVATARS_BY_GENDER } from '../utils/avatarData';
import { playAudio } from '../utils/audio';
import CustomLookPrompt from './CustomLookPrompt';

export default function AvatarCarousel({ gender, onSelectAvatar }) {
  // Exactly 6 selectable items: 5 profession looks + 6th item Question Mark (?)
  const avatars = AVATARS_BY_GENDER[gender] || AVATARS_BY_GENDER.male;

  // Default starting active view is Doctor (index 1: Center Doctor, Left Pilot, Right Astronaut)
  const [activeIndex, setActiveIndex] = useState(1);
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  useEffect(() => {
    setActiveIndex(1);
  }, [gender]);

  // Touch and mouse drag swipe tracking
  const touchStartXRef = useRef(null);
  const isDraggingRef = useRef(false);

  const prevIndex = (activeIndex - 1 + avatars.length) % avatars.length;
  const nextIndex = (activeIndex + 1) % avatars.length;

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

  // Direct Tap Interaction:
  // Tapping an avatar immediately enters Live Mirror.
  // Tapping the question mark opens the Custom Look screen.
  const handleSelectCurrent = () => {
    const selected = avatars[activeIndex];
    playAudio.click();

    if (selected.isCustom) {
      setIsPromptOpen(true);
    } else {
      playAudio.whoosh();
      onSelectAvatar(selected);
    }
  };

  const handleApplyCustomLook = (customResult) => {
    setIsPromptOpen(false);
    const customAvatar = {
      id: 'custom',
      profession: customResult.targetProfession || 'doctor',
      name: customResult.customTitle || 'Custom Look',
      description: customResult.customDescription || 'Bespoke Persona',
      customPrompt: customResult.rawPrompt || customResult.customDescription || null,
      decorations: customResult.decorations || 'custom',
      accentColor: customResult.primaryColor || '#0ea5e9',
      image: null,
      isCustom: true
    };
    onSelectAvatar(customAvatar);
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

  const currentAvatar = avatars[activeIndex];
  const leftAvatar = avatars[prevIndex];
  const rightAvatar = avatars[nextIndex];

  return (
    <div
      className="clean-screen-container avatar-selection-luxury"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Dynamic Ambient Background Light Orbs */}
      <div className="ambient-light-orb orb-top-left" />
      <div className="ambient-light-orb orb-mid-right" />
      <div className="ambient-light-orb orb-bottom-center" />

      {/* Small Dynamic Holographic Particles & Orbit Rings (Flanking edges only) */}
      <div className="holographic-decorations-ambient" aria-hidden="true">
        {/* Top-Left Rotating Thin Orbit Ring */}
        <div className="holo-orbit-ring ring-top-left" />
        {/* Bottom-Right Rotating Thin Orbit Ring */}
        <div className="holo-orbit-ring ring-bottom-right" />

        {/* Floating Delicate Sparkles & Diamond Glyphs */}
        <span className="holo-sparkle sp-1">✦</span>
        <span className="holo-sparkle sp-2">✧</span>
        <span className="holo-sparkle sp-3">✦</span>
        <span className="holo-sparkle sp-4">✧</span>
        <span className="holo-sparkle sp-5">✦</span>

        {/* Subtle Floating Glass Particles */}
        <div className="holo-glass-particle gp-1" />
        <div className="holo-glass-particle gp-2" />
        <div className="holo-glass-particle gp-3" />
        <div className="holo-glass-particle gp-4" />
      </div>

      {/* 1. Premium Heading & Subtitle */}
      <div className="luxury-screen-header">
        <h1 className="luxury-screen-title">A New You, Reimagined</h1>
        <p className="luxury-screen-subtitle">Your imagination. Your identity. Your transformation.</p>
      </div>

      {/* 2. Main Avatar Carousel Stage (Shows ONLY Avatar Images, No Profession Names) */}
      <div className="avatar-carousel-hero-stage">
        {/* Left Navigation Arrow */}
        <button
          className="luxury-carousel-nav-btn left-nav"
          onClick={handlePrev}
          aria-label="Previous Avatar"
        >
          <ChevronLeft size={28} color="#0284c7" strokeWidth={2.4} />
        </button>

        {/* Left Avatar Preview (Pure Visual Preview) */}
        <div
          className="avatar-side-slot left-slot"
          onClick={handlePrev}
          role="button"
          tabIndex={0}
          aria-label="Previous look"
        >
          {leftAvatar.isCustom ? (
            <div className="side-question-card">
              <div className="side-question-circle">
                <span className="side-question-glyph">?</span>
              </div>
            </div>
          ) : (
            <img
              src={leftAvatar.image}
              alt=""
              className="side-avatar-full-img"
            />
          )}
        </div>

        {/* Center Main Active Avatar Slot (Dominant 65-70% height, direct tap to enter) */}
        <div
          className="avatar-center-hero-slot"
          onClick={handleSelectCurrent}
          role="button"
          tabIndex={0}
          aria-label="Tap to select this look"
        >
          {/* Refined Ambient Luminescent Aura */}
          <div className="hero-hologram-aura" />

          {/* Sixth Option: Question Mark (?) with "CUSTOMIZE YOUR LOOK" directly underneath */}
          {currentAvatar.isCustom ? (
            <div className="hero-question-card">
              <div className="hero-question-circle-frame">
                <span className="hero-question-glyph">?</span>
              </div>
              <span className="hero-question-label">CUSTOMIZE YOUR LOOK</span>
            </div>
          ) : (
            /* First Five Options: Pure Character Image (No Profession Names) */
            <div className="hero-avatar-image-container">
              <img
                src={currentAvatar.image}
                alt=""
                className="hero-avatar-full-img"
              />
            </div>
          )}

          {/* Concentric Holographic Pedestal & Soft Light Reflection at Feet */}
          <div className="hero-pedestal-rings">
            <div className="pedestal-floor-reflection" />
            <div className="pedestal-disc-outer" />
            <div className="pedestal-disc-inner" />
          </div>
        </div>

        {/* Right Avatar Preview (Pure Visual Preview) */}
        <div
          className="avatar-side-slot right-slot"
          onClick={handleNext}
          role="button"
          tabIndex={0}
          aria-label="Next look"
        >
          {rightAvatar.isCustom ? (
            <div className="side-question-card">
              <div className="side-question-circle">
                <span className="side-question-glyph">?</span>
              </div>
            </div>
          ) : (
            <img
              src={rightAvatar.image}
              alt=""
              className="side-avatar-full-img"
            />
          )}
        </div>

        {/* Right Navigation Arrow */}
        <button
          className="luxury-carousel-nav-btn right-nav"
          onClick={handleNext}
          aria-label="Next Avatar"
        >
          <ChevronRight size={28} color="#0284c7" strokeWidth={2.4} />
        </button>
      </div>

      {/* Minimal Custom Look Modal (Opened ONLY when the 6th Question Mark card is tapped) */}
      <CustomLookPrompt
        gender={gender}
        isOpen={isPromptOpen}
        onClose={() => setIsPromptOpen(false)}
        onApplyCustomLook={handleApplyCustomLook}
      />
    </div>
  );
}
