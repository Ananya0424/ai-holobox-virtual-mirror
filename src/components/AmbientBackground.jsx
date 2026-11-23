import React from 'react';

export default function AmbientBackground() {
  return (
    <div className="ambient-background-interactive" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {/* 1. Volumetric Glowing Ambient Orbs with Spring Drift */}
      <div
        style={{
          position: 'absolute',
          top: '-8%',
          left: '-8%',
          width: '520px',
          height: '520px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.28) 0%, rgba(14, 165, 233, 0.08) 50%, transparent 75%)',
          animation: 'floatOrbA 16s ease-in-out infinite',
          filter: 'blur(35px)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '35%',
          right: '-12%',
          width: '480px',
          height: '480px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.24) 0%, rgba(139, 92, 246, 0.06) 50%, transparent 75%)',
          animation: 'floatOrbB 18s ease-in-out infinite',
          filter: 'blur(35px)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          left: '25%',
          width: '450px',
          height: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244, 63, 94, 0.16) 0%, rgba(245, 158, 11, 0.05) 50%, transparent 75%)',
          animation: 'floatOrbA 20s ease-in-out infinite reverse',
          filter: 'blur(40px)'
        }}
      />

      {/* 2. Floating 3D Perspective Gyro-Orbit Rings */}
      <div
        style={{
          position: 'absolute',
          top: '60px',
          left: '-40px',
          width: '240px',
          height: '240px',
          borderRadius: '50%',
          border: '1.5px dashed rgba(56, 189, 248, 0.45)',
          animation: 'spinRing 32s linear infinite',
          boxShadow: '0 0 20px rgba(56, 189, 248, 0.15)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '80px',
          right: '-50px',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          border: '1.5px solid rgba(168, 85, 247, 0.35)',
          animation: 'spinRing 42s linear infinite reverse',
          boxShadow: '0 0 25px rgba(168, 85, 247, 0.15)'
        }}
      />

      {/* 3. Futuristic Floating Cyber-Crosshairs & 3D Diamond Glyphs */}
      <div
        style={{
          position: 'absolute',
          top: '18%',
          right: '8%',
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#38bdf8',
          fontWeight: 700,
          opacity: 0.55,
          animation: 'sparklePulse 4s ease-in-out infinite'
        }}
      >
        ✦
      </div>
      <div
        style={{
          position: 'absolute',
          top: '68%',
          left: '7%',
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#818cf8',
          fontWeight: 700,
          opacity: 0.6,
          animation: 'sparklePulse 5s ease-in-out infinite 1.5s'
        }}
      >
        ✧
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: '22%',
          right: '12%',
          fontSize: '18px',
          color: '#f43f5e',
          opacity: 0.45,
          animation: 'sparklePulse 4.5s ease-in-out infinite 0.7s'
        }}
      >
        ✦
      </div>

      {/* 4. Bottom 3D Ground Cyber Horizon Grid (Subtle) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '140px',
          background: 'linear-gradient(to top, rgba(241, 245, 249, 0.6) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)'
        }}
      />
    </div>
  );
}
