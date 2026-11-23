import React from 'react';
import { ArrowLeft, Wand2, Users2, Sparkles, ChevronRight, Video, Zap } from 'lucide-react';
import { playAudio } from '../utils/audio';
import AmbientBackground from './AmbientBackground';

export default function ExperienceChoiceScreen({
  selectedGender,
  onSelectChoice,
  onBack
}) {
  const handleChoice = (choice) => {
    playAudio.click();
    playAudio.whoosh();
    onSelectChoice(choice); // 'theme' | 'avatar' | 'live_mirror'
  };

  const isFemale = selectedGender === 'female';
  const themeThumb = isFemale ? '/Images/Women Micky.webp' : '/Images/Men Micky.webp';
  const avatarThumb = isFemale ? '/Images/Female pilot.png' : '/Images/Male Pilot.png';
  const mirrorThumb = isFemale ? '/Images/female_mirror_reflection.png' : '/Images/male_mirror_reflection.png';

  return (
    <div className="clean-screen-container experience-choice-screen" style={{ background: '#ffffff', minHeight: '100%', overflowY: 'auto' }}>
      <AmbientBackground />

      {/* Top Header with Back Button */}
      <nav
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '22px 22px 10px',
          zIndex: 30,
          position: 'relative'
        }}
      >
        <button
          onClick={() => {
            playAudio.click();
            onBack();
          }}
          aria-label="Back to Gender Selection"
          style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            color: '#0f172a',
            padding: '7px 14px',
            borderRadius: '9999px',
            fontWeight: 700,
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <ArrowLeft size={16} color="#0284c7" strokeWidth={2.4} />
          <span>Back</span>
        </button>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.85)',
            border: '1px solid #e2e8f0',
            backdropFilter: 'blur(10px)',
            padding: '4px 12px',
            borderRadius: '9999px',
            fontSize: '10.5px',
            fontWeight: 800,
            letterSpacing: '0.8px',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Sparkles size={11} color="#0284c7" />
          <span>EXPERIENCE PORTAL</span>
        </div>

        <div style={{ width: '60px' }} />
      </nav>

      {/* Screen Title Block */}
      <header
        style={{
          textAlign: 'center',
          padding: '2px 18px 0',
          zIndex: 25,
          position: 'relative'
        }}
      >
        <h1
          className="popout-heading-luxury"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '25px',
            fontWeight: 800,
            letterSpacing: '-0.3px',
            lineHeight: 1.2,
            margin: 0,
            background: 'linear-gradient(135deg, #0f172a 0%, #0284c7 45%, #7c3aed 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 8px rgba(14, 165, 233, 0.12))'
          }}
        >
          Choose Your Dimension
        </h1>
        <p
          className="popout-sub-luxury"
          style={{
            margin: '3px 0 0',
            color: '#64748b',
            fontSize: '12px',
            fontWeight: 500
          }}
        >
          Transform live in real-time or forge ultra-realistic holographic photos
        </p>
      </header>

      {/* Main Choice Cards Container (Vertical Stack for 9:16 Portrait) */}
      <div
        className="experience-choice-content popout-card-3d"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '14px',
          padding: '16px 18px 24px',
          zIndex: 10,
          maxWidth: '520px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        {/* OPTION 1: CHOOSE THEME */}
        <div
          className="experience-card theme-choice-card"
          onClick={() => handleChoice('theme')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleChoice('theme')}
          style={{
            position: 'relative',
            background: 'linear-gradient(145deg, #ffffff, #f0f9ff)',
            border: '2px solid #38bdf8',
            borderRadius: '20px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(14, 165, 233, 0.12)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: '90px',
              height: '115px',
              borderRadius: '14px',
              overflow: 'hidden',
              background: '#ffffff',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img
              src={themeThumb}
              alt="Choose Theme Preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#e0f2fe',
                color: '#0284c7',
                padding: '3px 8px',
                borderRadius: '9999px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.4px',
                width: 'fit-content'
              }}
            >
              <Sparkles size={11} />
              <span>INTERACTIVE WORLDS</span>
            </div>

            <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Choose Theme
            </h3>

            <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0, lineHeight: 1.35 }}>
              Stand together with realistic 3D characters in your own clothes.
            </p>

            <div
              style={{
                marginTop: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#0284c7',
                color: '#ffffff',
                padding: '7px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                width: 'fit-content',
                boxShadow: '0 3px 10px rgba(2, 132, 199, 0.25)'
              }}
            >
              <span>Explore Themes</span>
              <ChevronRight size={14} />
            </div>
          </div>
        </div>

        {/* OPTION 2: CHOOSE AVATAR */}
        <div
          className="experience-card avatar-choice-card"
          onClick={() => handleChoice('avatar')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleChoice('avatar')}
          style={{
            position: 'relative',
            background: 'linear-gradient(145deg, #ffffff, #faf5ff)',
            border: '2px solid #c084fc',
            borderRadius: '20px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(168, 85, 247, 0.1)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: '90px',
              height: '115px',
              borderRadius: '14px',
              overflow: 'hidden',
              background: '#ffffff',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img
              src={avatarThumb}
              alt="Choose Avatar Preview"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#f3e8ff',
                color: '#9333ea',
                padding: '3px 8px',
                borderRadius: '9999px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.4px',
                width: 'fit-content'
              }}
            >
              <Users2 size={11} />
              <span>PROFESSION SUITS</span>
            </div>

            <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Choose Avatar
            </h3>

            <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0, lineHeight: 1.35 }}>
              Try on official uniforms: Pilot, Doctor, Police, Astronaut, Business.
            </p>

            <div
              style={{
                marginTop: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#9333ea',
                color: '#ffffff',
                padding: '7px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                width: 'fit-content',
                boxShadow: '0 3px 10px rgba(147, 51, 234, 0.25)'
              }}
            >
              <span>Explore Avatars</span>
              <ChevronRight size={14} />
            </div>
          </div>
        </div>

        {/* OPTION 3: REAL-TIME AI CHARACTER MIRROR */}
        <div
          className="experience-card live-mirror-choice-card"
          onClick={() => handleChoice('live_mirror')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleChoice('live_mirror')}
          style={{
            position: 'relative',
            background: 'linear-gradient(145deg, #ffffff, #ecfeff)',
            border: '2px solid #06b6d4',
            borderRadius: '20px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(6, 182, 212, 0.12)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            overflow: 'hidden'
          }}
        >
          {/* Preview Image Thumbnail matching Card 1 & 2 */}
          <div
            style={{
              width: '90px',
              height: '115px',
              borderRadius: '14px',
              overflow: 'hidden',
              background: '#ffffff',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            <img
              src={mirrorThumb}
              alt="Live AI Mirror Preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Small red LIVE badge over top corner of thumbnail */}
            <div
              style={{
                position: 'absolute',
                top: '5px',
                left: '5px',
                background: '#ef4444',
                color: '#ffffff',
                padding: '2px 5px',
                borderRadius: '4px',
                fontSize: '8px',
                fontWeight: 900,
                letterSpacing: '0.4px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.35)'
              }}
            >
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ffffff' }} />
              <span>LIVE</span>
            </div>
          </div>

          {/* Details harmonized with Theme and Avatar cards */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#cffafe',
                color: '#0891b2',
                padding: '3px 8px',
                borderRadius: '9999px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.4px',
                width: 'fit-content'
              }}
            >
              <Zap size={11} />
              <span>REAL-TIME 3D MIRROR</span>
            </div>

            <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Live AI Mirror
            </h3>

            <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0, lineHeight: 1.35 }}>
              Step in front of the mirror: Transform live into futuristic heroes & space suits.
            </p>

            <div
              style={{
                marginTop: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                color: '#ffffff',
                padding: '7px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                width: 'fit-content',
                boxShadow: '0 3px 10px rgba(6, 182, 212, 0.28)'
              }}
            >
              <span>Enter Mirror View</span>
              <ChevronRight size={14} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
