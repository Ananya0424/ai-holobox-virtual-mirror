import React, { useRef, useEffect } from 'react';
import { ChevronsRight } from 'lucide-react';
import { playAudio } from '../utils/audio';

export default function WelcomeScreen({ onStart }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play();
        }
      });
    }
  }, []);

  const handleStart = () => {
    playAudio.click();
    playAudio.whoosh();
    onStart();
  };

  return (
    <div className="welcome-fullscreen-root">
      {/* 1. Edge-to-Edge Looping Video Background */}
      <video
        ref={videoRef}
        className="welcome-full-video"
        src="/intro-video.mp4"
        poster="/intro-video.gif"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* 2. Soft Blue & Purple Holographic Ambient Sheen */}
      <div className="welcome-holographic-sheen" />

      {/* 3. Subtle Holographic Scanline */}
      <div className="welcome-scanline" />

      {/* 4. Complete Edge-to-Edge Interactive UI Layer */}
      <div className="welcome-interactive-layer">
        {/* Top Branding Section (Positioned Higher Up, Single Line Heading) */}
        <div className="welcome-top-branding">
          <div
            className="popout-sub-luxury"
            style={{
              background: 'rgba(255, 255, 255, 0.92)',
              border: '1.5px solid rgba(56, 189, 248, 0.5)',
              boxShadow: '0 4px 16px rgba(14, 165, 233, 0.25)',
              padding: '6px 18px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '1px',
              color: '#0284c7',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '12px'
            }}
          >
            <span>✦</span>
            <span>NEXT-GEN AI HOLOBOX</span>
            <span>✦</span>
          </div>
          <h1 className="welcome-main-heading popout-heading-luxury" style={{ letterSpacing: '-0.4px', textTransform: 'none', fontSize: '32px' }}>
            Interactive Virtual Mirror
          </h1>
          <p className="welcome-sub-tagline popout-sub-luxury" style={{ fontSize: '13px' }}>
            Step into the holographic future — Reimagine your identity in 3D
          </p>
        </div>

        {/* Mid Screen Action: Compact START EXPERIENCE Button */}
        <div className="welcome-mid-action-zone">
          {/* Subtle Glowing Pulse Rings */}
          <div className="mid-pulse-halo ring-1" />
          <div className="mid-pulse-halo ring-2" />

          <button
            className="holo-btn-start-hero"
            onClick={handleStart}
            aria-label="Start Virtual Mirror Experience"
          >
            <span>START EXPERIENCE</span>
            <ChevronsRight size={20} className="btn-chevron-glow" />
          </button>
        </div>

        {/* Balanced bottom spacing */}
        <div style={{ height: '24px' }} />
      </div>
    </div>
  );
}
