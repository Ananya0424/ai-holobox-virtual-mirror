import React from 'react';

export default function AmbientBackground() {
  return (
    <>
      {/* Moving Blurred Ambient Light Orbs */}
      <div className="ambient-light-orb orb-top-left" aria-hidden="true" />
      <div className="ambient-light-orb orb-mid-right" aria-hidden="true" />
      <div className="ambient-light-orb orb-bottom-center" aria-hidden="true" />

      {/* Small Dynamic Holographic Particles & Orbit Rings (Flanking Edges Only) */}
      <div className="holographic-decorations-ambient" aria-hidden="true">
        {/* Slowly Rotating Thin Orbit Rings */}
        <div className="holo-orbit-ring ring-top-left" />
        <div className="holo-orbit-ring ring-bottom-right" />

        {/* Floating Delicate Sparkles */}
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
    </>
  );
}
