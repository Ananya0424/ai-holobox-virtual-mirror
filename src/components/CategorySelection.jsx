import React from 'react';
import { Sparkles } from 'lucide-react';
import { playAudio } from '../utils/audio';
import AmbientBackground from './AmbientBackground';

export default function CategorySelection({ onSelectCategory }) {
  const handleSelect = (category) => {
    playAudio.click();
    playAudio.whoosh();
    onSelectCategory(category);
  };

  return (
    <div className="clean-screen-container category-selection-clean">
      {/* Background Holographic Atmosphere */}
      <AmbientBackground />

      {/* Decorative Floating Geometric Circles & Sparkles */}
      <div className="category-bg-decorations" aria-hidden="true">
        <div className="floating-geo-ring ring-top-left" />
        <div className="floating-geo-ring ring-bottom-right" />
        <div className="floating-crosshair crosshair-1">+</div>
        <div className="floating-crosshair crosshair-2">+</div>
        <div className="floating-diamond diamond-1" />
        <div className="floating-diamond diamond-2" />
      </div>

      {/* 1. Premium Heading & Subtitle */}
      <div className="category-header-zone">
        <div className="category-header-sparkle-pill">
          <Sparkles size={13} color="#0ea5e9" />
          <span>PORTRAIT SELECTION</span>
        </div>
        <h1 className="category-title-main">
          YOUR TRANSFORMATION BEGINS HERE
        </h1>
        <p className="category-subtitle-text">
          Choose your identity and explore a new dimension of yourself.
        </p>
      </div>

      {/* 2. Vertically Stacked Male & Female Head-and-Shoulders Portraits */}
      <div className="gender-cards-column">
        {/* Male Avatar Selection (Top) */}
        <div
          className="gender-avatar-item male-card-interactive"
          onClick={() => handleSelect('male')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleSelect('male')}
          aria-label="Male Avatars"
        >
          <div className="gender-portrait-wrapper">
            {/* Animated Delicate Dotted Orbit Ring */}
            <div className="gender-dotted-orbit male-orbit" />
            
            {/* Circular Portrait Frame with White Inner Border & Ice-Blue Glow */}
            <div className="gender-circle-frame male-glow">
              <img
                src="/Images/Male image.png"
                alt="Male Avatars Portrait"
                className="gender-circle-img"
              />
              <div className="gender-circle-inner-ring" />
            </div>
          </div>

          {/* Premium Selection Label */}
          <div className="gender-label-pill male-label">
            <span className="label-accent-dot" />
            <span className="label-text">MALE</span>
          </div>
        </div>

        {/* Subtle Animated Connecting Light Trail Between Selections */}
        <div className="gender-connecting-trail" aria-hidden="true">
          <div className="connecting-trail-line" />
          <div className="connecting-trail-pulse" />
        </div>

        {/* Female Avatar Selection (Bottom) */}
        <div
          className="gender-avatar-item female-card-interactive"
          onClick={() => handleSelect('female')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleSelect('female')}
          aria-label="Female Avatars"
        >
          <div className="gender-portrait-wrapper">
            {/* Animated Delicate Dotted Orbit Ring */}
            <div className="gender-dotted-orbit female-orbit" />
            
            {/* Circular Portrait Frame with White Inner Border & Lavender-Pink Glow */}
            <div className="gender-circle-frame female-glow">
              <img
                src="/Images/Female image.png"
                alt="Female Avatars Portrait"
                className="gender-circle-img"
              />
              <div className="gender-circle-inner-ring" />
            </div>
          </div>

          {/* Premium Selection Label */}
          <div className="gender-label-pill female-label">
            <span className="label-accent-dot" />
            <span className="label-text">FEMALE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
