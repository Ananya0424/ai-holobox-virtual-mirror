import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { RotateCcw, Sparkles, Clock, Smartphone, X, QrCode, Plus, CheckCircle2 } from 'lucide-react';
import { playAudio } from '../utils/audio';
import FloatingStudioDecorations from './FloatingStudioDecorations';

export default function PhotoPreview({
  photoDataUrl,
  selectedAvatar,
  selectedTheme,
  selectedMode,
  downloadId,
  mobileDownloadUrl,
  onRestart,
  onChangeSelection,
  onFinish
}) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isTimeUp, setIsTimeUp] = useState(false);

  const downloadTargetUrl = mobileDownloadUrl || `${window.location.origin}${photoDataUrl}`;
  const isPublicHttpsUrl = downloadTargetUrl.startsWith('https://');

  // Generate high-contrast, instant-scan mobile download QR code (public HTTPS ImgBB or LAN fallback)
  useEffect(() => {
    let isMounted = true;

    QRCode.toDataURL(downloadTargetUrl, {
      width: 260,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }).then((url) => {
      if (isMounted) setQrCodeDataUrl(url);
    }).catch(err => console.error('QR generation error:', err));

    return () => { isMounted = false; };
  }, [downloadTargetUrl]);

  // 30-Second Countdown (pauses when isTimeUp triggers)
  useEffect(() => {
    if (isTimeUp) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsTimeUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimeUp]);

  // Extend scan timer by +30 seconds
  const handleExtendScanTime = () => {
    playAudio.click();
    setTimeLeft(30);
    setIsTimeUp(false);
    setShowQrScanner(true);
  };

  return (
    <div className="white-studio-preview-screen holobox-fullscreen-preview holobox-3d-chamber-container">
      {/* 1. Overhead Ceiling Studio Downlight Cone */}
      <div className="holobox-top-spotlight" />

      {/* 2. Dual Lateral Neon LED Chamber Edge Pillars */}
      <div className="holobox-side-pillar-left" />
      <div className="holobox-side-pillar-right" />

      {/* 3. Volumetric Contact Floor Shadow Under Feet */}
      <div className="pedestal-contact-drop-shadow" />

      {/* 4. 3D Volumetric Floor Laser Pedestal Platform Under Feet */}
      <div className="holobox-floor-pedestal-3d">
        <div className="pedestal-outer-laser-ring" />
        <div className="pedestal-inner-laser-ring" />
        <div className="pedestal-center-core-glow" />
      </div>

      {/* 5. Peripheral Animated Holographic Background Elements */}
      {!selectedTheme && (
        <FloatingStudioDecorations
          profession={selectedAvatar?.decorations || selectedAvatar?.profession || 'pilot'}
        />
      )}

      {/* 6. Full-Body Transformed Subject inside the Chamber with Drop Shadow */}
      <img
        src={photoDataUrl}
        alt="Transformed Hologram"
        className="studio-final-photo holobox-fullscreen-photo"
        style={{
          zIndex: 4,
          filter: 'drop-shadow(0 14px 28px rgba(15, 23, 42, 0.22)) contrast(1.02)'
        }}
      />

      {/* 7. Holographic Laser Entrance Scan Line */}
      <div className="holobox-laser-scanline" />

      {/* 8. Front Glass Reflective Sheen Across Holobox Door */}
      <div className="holobox-glass-front-sheen" />

      {/* 9. Top HUD Bar with Kinetic Pop-Out Title */}
      <header
        className="studio-preview-header holobox-minimal-header popout-heading-luxury"
        style={{
          zIndex: 30,
          padding: '14px 18px',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0
        }}
      >
        <div
          className="studio-brand-pill"
          style={{
            background: 'rgba(255, 255, 255, 0.94)',
            border: '1.5px solid #38bdf8',
            boxShadow: '0 4px 20px rgba(14, 165, 233, 0.25)',
            backdropFilter: 'blur(10px)',
            padding: '6px 14px',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 800,
            fontSize: '11.5px',
            letterSpacing: '0.6px',
            color: '#0f172a'
          }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }} />
          <span>3D HOLOBOX TELEPORTATION</span>
        </div>

        {/* Top-Right Quick Countdown & Extend Badge */}
        {!isTimeUp && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(10px)',
              padding: '6px 12px',
              borderRadius: '9999px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
              border: '1.5px solid #e2e8f0'
            }}
          >
            <Clock size={13} color="#0284c7" />
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>{timeLeft}s</span>
            <button
              type="button"
              className="studio-extend-time-btn"
              title="Add 30 seconds to scan"
              onClick={handleExtendScanTime}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '3px 8px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <Plus size={11} /> 30s
            </button>
          </div>
        )}
      </header>

      {/* Floating Action Buttons — Middle-Right Edge Overlay */}
      {!showQrScanner && !isTimeUp && (
        <div
          style={{
            position: 'absolute',
            right: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 22
          }}
        >
          {/* Mobile QR Code Button */}
          <button
            type="button"
            className="studio-side-download-btn holobox-floating-download-btn"
            style={{
              width: '84px',
              height: '84px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.95) 0%, rgba(236, 72, 153, 0.95) 100%)'
            }}
            onClick={() => {
              playAudio.click();
              setTimeLeft((prev) => Math.max(prev, 60));
              setIsTimeUp(false);
              setShowQrScanner(true);
            }}
            title="Scan QR Code with Phone"
          >
            <QrCode size={22} />
            <span style={{ fontSize: '10.5px' }}>Scan QR</span>
          </button>
        </div>
      )}

      {/* Centered QR Scanner Modal */}
      {showQrScanner && !isTimeUp && (
        <div className="holobox-qr-overlay">
          <div className="studio-qr-center-card" style={{ width: '310px' }}>
            <button
              type="button"
              className="studio-qr-close-btn"
              aria-label="Back to photo"
              onClick={() => {
                playAudio.click();
                setShowQrScanner(false);
              }}
            >
              <X size={16} />
            </button>

            <div className="qr-badge-header">
              <Smartphone size={20} color="#0284c7" />
              <span>Save to Phone</span>
            </div>

            <div className="studio-qr-frame studio-qr-frame-center">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="QR Code to Download Portrait" className="studio-qr-img" />
              ) : (
                <div className="qr-skeleton-loader" />
              )}
            </div>

            <p className="qr-scan-instruction" style={{ margin: '6px 0 2px' }}>
              Scan with your phone camera to open & download your photo.
            </p>

            {isPublicHttpsUrl ? (
              <div
                style={{
                  fontSize: '11px',
                  color: '#065f46',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  margin: '4px 0 14px',
                  lineHeight: 1.35,
                  fontWeight: 600
                }}
              >
                ✓ Works on any phone (Wi-Fi or 4G/5G) — Scan QR &amp; tap Download!
              </div>
            ) : (
              <div
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  background: '#f1f5f9',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  margin: '4px 0 14px',
                  lineHeight: 1.3
                }}
              >
                📶 Offline LAN mode: Connect phone to the same Wi-Fi as this kiosk.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
              <div className="studio-timer-pill">
                <Clock size={14} color="#64748b" />
                <span>Reset in {timeLeft}s</span>
              </div>
              <button
                type="button"
                className="studio-extend-time-btn"
                onClick={() => {
                  playAudio.click();
                  setTimeLeft((prev) => prev + 30);
                }}
              >
                <Plus size={11} /> +30s More
              </button>
            </div>

            <button
              type="button"
              className="studio-restart-center-btn"
              onClick={() => {
                playAudio.click();
                onRestart();
              }}
            >
              <RotateCcw size={18} />
              <span>Start New Session</span>
            </button>
          </div>
        </div>
      )}

      {/* Time's Up Timeout Dialogue: Prevents abrupt exit & offers Scan Again or New Session */}
      {isTimeUp && (
        <div className="holobox-qr-overlay">
          <div className="studio-qr-center-card session-timeout-card" style={{ width: '310px' }}>
            <div className="qr-badge-header">
              <Clock size={22} color="#0284c7" />
              <span>Time's Up!</span>
            </div>

            <p className="qr-scan-instruction" style={{ fontSize: '13px', color: '#334155', margin: '4px 0' }}>
              Did you finish scanning your photo, or do you need more time?
            </p>

            {/* Option 1: Need More Time / Scan Again (+30s) */}
            <button
              type="button"
              className="studio-restart-center-btn"
              style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)' }}
              onClick={handleExtendScanTime}
            >
              <QrCode size={18} />
              <span>Scan Again (+30s More)</span>
            </button>

            {/* Option 2: Start New Session */}
            <button
              type="button"
              className="studio-restart-center-btn"
              style={{ background: '#f8fafc', color: '#1e293b', border: '1px solid #cbd5e1', boxShadow: 'none' }}
              onClick={() => {
                playAudio.click();
                onRestart();
              }}
            >
              <RotateCcw size={18} />
              <span>Start New Session</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
