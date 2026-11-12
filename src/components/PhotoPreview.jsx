import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { RotateCcw, Sparkles, Clock, Smartphone, Download, X } from 'lucide-react';
import { playAudio } from '../utils/audio';
import FloatingStudioDecorations from './FloatingStudioDecorations';

export default function PhotoPreview({
  photoDataUrl,
  selectedAvatar,
  downloadId,
  mobileDownloadUrl,
  onRestart,
  onFinish
}) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  // Generate mobile download QR code using LAN/Public-reachable URL
  useEffect(() => {
    let isMounted = true;
    const downloadTargetUrl = mobileDownloadUrl || `${window.location.origin}${photoDataUrl}`;

    QRCode.toDataURL(downloadTargetUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }).then((url) => {
      if (isMounted) setQrCodeDataUrl(url);
    }).catch(err => console.error('QR generation error:', err));

    return () => { isMounted = false; };
  }, [photoDataUrl, mobileDownloadUrl]);

  // 30-Second Auto-Transition Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) {
      onFinish();
    }
  }, [timeLeft, onFinish]);

  return (
    <div className="white-studio-preview-screen holobox-fullscreen-preview">
      {/* Peripheral Animated Holographic Background Elements Behind Subject */}
      <FloatingStudioDecorations
        profession={selectedAvatar?.decorations || selectedAvatar?.profession || 'pilot'}
      />

      {/* Full-Screen Immersive Transformed Portrait (No card, box, frame, or split panels) */}
      <img
        src={photoDataUrl}
        alt="Transformed Professional Studio"
        className="studio-final-photo holobox-fullscreen-photo"
      />

      {/* Minimal Top Header — Only "AI HOLOBOX TRANSFORMATION" */}
      <header className="studio-preview-header holobox-minimal-header">
        <div className="studio-brand-pill">
          <Sparkles size={15} color="#0284c7" />
          <span>AI HOLOBOX TRANSFORMATION</span>
        </div>
      </header>

      {/* Small Floating Download Button — Middle-Right Edge Overlay */}
      {!showQrScanner && (
        <button
          type="button"
          className="studio-side-download-btn holobox-floating-download-btn"
          onClick={() => {
            playAudio.click();
            setShowQrScanner(true);
          }}
        >
          <Download size={18} />
          <span>Download</span>
        </button>
      )}

      {/* Centered QR Scanner Overlay + Restart Directly Below Scanner */}
      {showQrScanner && (
        <div className="holobox-qr-overlay">
          <div className="studio-qr-center-card">
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
              <span>Scan to Download</span>
            </div>

            <div className="studio-qr-frame studio-qr-frame-center">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="QR Code to Download Portrait" className="studio-qr-img" />
              ) : (
                <div className="qr-skeleton-loader" />
              )}
            </div>

            <p className="qr-scan-instruction">
              Scan with your phone camera to save your portrait.
            </p>

            <div className="studio-timer-pill">
              <Clock size={14} color="#64748b" />
              <span>Auto-reset in {timeLeft}s</span>
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
              <span>Restart</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
