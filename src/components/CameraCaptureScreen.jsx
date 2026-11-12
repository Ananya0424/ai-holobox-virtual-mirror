import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, AlertCircle, RefreshCw, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { playAudio } from '../utils/audio';

export default function CameraCaptureScreen({
  selectedAvatar,
  gender,
  onPhotoCaptured,
  onBack
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [cameraResolution, setCameraResolution] = useState(null);

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
  }, []);

  // Initialize pure, pristine webcam stream (prefers portrait HD, falls back to standard HD)
  const startCamera = useCallback(async () => {
    setCameraReady(false);
    setCameraError(null);
    clearCountdownTimer();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API unavailable here. Open the kiosk on http://localhost:3000 or over HTTPS.');
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      let stream;
      try {
        // Prefer full-body portrait camera resolution when hardware supports it
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1080, min: 640 },
            height: { ideal: 1920, min: 480 }
          },
          audio: false
        });
      } catch (constraintErr) {
        if (constraintErr?.name === 'OverconstrainedError') {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
          });
        } else {
          throw constraintErr;
        }
      }

      streamRef.current = stream;

      // Monitor physical USB disconnection on the active video track
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.warn('[CameraCapture] Physical camera track ended / disconnected');
          clearCountdownTimer();
          setCameraReady(false);
          setCameraError('Camera disconnected. Reconnect USB camera or tap Retry Camera.');
        };
      }

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        const markReadyWhenFramesExist = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            setCameraResolution(`${video.videoWidth}x${video.videoHeight}`);
            setCameraReady(true);
          }
        };
        video.onloadedmetadata = () => {
          video.play().then(markReadyWhenFramesExist).catch((e) => {
            console.warn('[CameraCapture] Autoplay blocked or failed:', e);
            setCameraError('Camera preview could not start. Please tap Retry Camera.');
          });
        };
        if (video.readyState >= 2) {
          markReadyWhenFramesExist();
        }
      }
    } catch (err) {
      console.error('[CameraCapture] Camera access failed:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied. Please allow camera access in browser settings and tap Retry Camera.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setCameraError('No webcam detected. Please connect the Holobox camera and tap Retry Camera.');
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        setCameraError('Camera is currently in use by another application. Close other camera apps and tap Retry Camera.');
      } else {
        setCameraError('Camera access required. Please grant permission and tap Retry Camera.');
      }
    }
  }, [clearCountdownTimer]);

  useEffect(() => {
    startCamera();

    // Auto-recover when a disconnected USB camera is plugged back in
    const handleDeviceChange = async () => {
      try {
        const devices = await navigator.mediaDevices?.enumerateDevices?.();
        const hasVideo = (devices || []).some((d) => d.kind === 'videoinput');
        const activeLive = streamRef.current?.getVideoTracks?.().some((t) => t.readyState === 'live');
        if (hasVideo && !activeLive) {
          console.info('[CameraCapture] Camera device detected again — reconnecting...');
          startCamera();
        }
      } catch {
        // Ignore enumerateDevices failures
      }
    };

    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
      clearCountdownTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera, clearCountdownTimer]);

  // Hands-free 10-second auto-capture countdown as soon as the live camera is ready
  useEffect(() => {
    if (!cameraReady || cameraError) return;

    let count = 10;
    setCountdown(count);
    playAudio.click();

    countdownTimerRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        playAudio.click();
      } else {
        clearCountdownTimer();
        performInstantSnap();
      }
    }, 1000);

    return () => {
      clearCountdownTimer();
    };
  }, [cameraReady, cameraError, clearCountdownTimer]);

  const performInstantSnap = () => {
    try {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        setCameraError('Camera frame not ready yet. Please allow camera access and try again.');
        return;
      }

      playAudio.capture();
      setIsFlashing(true);

      setTimeout(() => {
        setIsFlashing(false);
      }, 450);

      // Preserve natural WYSIWYG framing matching the portrait viewport without stretching
      const targetW = 1080;
      const targetH = 1920;
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);

      const vW = video.videoWidth;
      const vH = video.videoHeight;
      const stageAspect = (video.clientWidth && video.clientHeight)
        ? (video.clientWidth / video.clientHeight)
        : (targetW / targetH);

      // Compute exact source crop matching object-fit: cover in stage
      const vAspect = vW / vH;
      let sx = 0;
      let sy = 0;
      let sW = vW;
      let sH = vH;
      if (vAspect > stageAspect) {
        sW = Math.round(vH * stageAspect);
        sx = Math.round((vW - sW) / 2);
      } else if (vAspect < stageAspect) {
        sH = Math.round(vW / stageAspect);
        sy = Math.round((vH - sH) / 2);
      }

      ctx.save();
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, sW, sH, 0, 0, targetW, targetH);
      ctx.restore();

      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      onPhotoCaptured(photoDataUrl);
    } catch (err) {
      console.error('[CameraCapture] Snapshot error:', err);
      setCameraError('Failed to capture photo from webcam. Please retry.');
    }
  };

  return (
    <div className="camera-capture-screen-container">
      {/* Top Header Bar */}
      <header className="kiosk-step-header">
        <button
          className="kiosk-nav-back-btn"
          onClick={() => {
            playAudio.click();
            onBack();
          }}
          aria-label="Back to Profession Selection"
        >
          <ArrowLeft size={20} color="#0284c7" />
          <span>Back</span>
        </button>

        <div className="kiosk-header-text-block">
          <h2 className="kiosk-main-title">Capture Your Portrait</h2>
          <p className="kiosk-sub-title">
            Transforming into: <strong style={{ color: '#0284c7' }}>{selectedAvatar?.name || 'Professional'}</strong>
          </p>
        </div>

        <div style={{ width: '80px' }} />
      </header>

      {/* Main Viewport Stage */}
      <div className="camera-stage-frame">
        {/* Raw Live Webcam (Mirrored, Pristine) */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="camera-video-feed"
        />

        {/* Full-Body Standing Position Silhouette Guide (head-to-toe inside safe shutter margins) */}
        <div className="camera-framing-guide-overlay" style={{ pointerEvents: 'none' }}>
          <svg className="framing-silhouette-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Soft oval head guide */}
            <ellipse cx="50" cy="17" rx="8.5" ry="7.2" fill="none" stroke="rgba(255, 255, 255, 0.78)" strokeWidth="0.7" strokeDasharray="2.5 2" />
            {/* Full-body standing shoulders, arms, torso & feet guide above shutter button */}
            <path
              d="M34 28 C37 25, 43 24.5, 50 24.5 C57 24.5, 63 25, 66 28 C71 33, 73 46, 70 55 L65 55 L63 44 L61 81 L52 81 L50 56 L48 81 L39 81 L37 44 L35 55 L30 55 C27 46, 29 33, 34 28 Z"
              fill="none"
              stroke="rgba(255, 255, 255, 0.62)"
              strokeWidth="0.65"
              strokeDasharray="2.5 2"
            />
          </svg>

          <div className="camera-alignment-pill">
            <CheckCircle2 size={15} color="#22c55e" />
            <span>
              {cameraResolution
                ? (countdown !== null
                    ? `Stand in front of Holobox — capturing in ${countdown}s`
                    : 'Align inside the guide')
                : 'Connecting Holobox camera...'}
            </span>
          </div>
        </div>

        {/* Clean Translucent 10-Second Auto-Capture Badge (Does NOT block mirror reflection) */}
        {countdown !== null && !cameraError && (
          <div className="camera-auto-countdown-badge" aria-live="polite">
            <div className="auto-countdown-circle">{countdown}</div>
            <span className="auto-countdown-label">Auto Capture</span>
          </div>
        )}

        {/* Camera Flash Animation */}
        {isFlashing && <div className="camera-flash-overlay" />}

        {/* Error Fallback */}
        {cameraError && (
          <div className="camera-error-banner">
            <AlertCircle size={36} color="#ef4444" />
            <p>{cameraError}</p>
            <button className="mirror-retry-btn" onClick={startCamera}>
              <RefreshCw size={16} /> Retry Camera
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
