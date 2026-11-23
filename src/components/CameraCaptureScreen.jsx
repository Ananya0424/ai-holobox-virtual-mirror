import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, AlertCircle, RefreshCw, ArrowLeft, CheckCircle2, UserCheck, AlertTriangle, Sparkles, Laptop, Image as ImageIcon } from 'lucide-react';
import { playAudio } from '../utils/audio';

export default function CameraCaptureScreen({
  selectedAvatar,
  selectedTheme,
  gender,
  onPhotoCaptured,
  onBack
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const poseEstimatorRef = useRef(null);
  const animFrameRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [countdown, setCountdown] = useState(20);
  const [isFlashing, setIsFlashing] = useState(false);
  const [cameraResolution, setCameraResolution] = useState(null);
  const [laptopMode, setLaptopMode] = useState(true); // Default true for effortless laptop testing

  // Full-body tracking state: 'aligned' | 'too_close' | 'searching'
  const [bodyAlignment, setBodyAlignment] = useState('aligned');
  const [alignmentMessage, setAlignmentMessage] = useState(
    selectedAvatar
      ? '✓ Stand 3–5 ft away for sharpest face match — full-body uniform generates automatically!'
      : '✓ Biometric Scanner Active: Ready to snap or auto-snap in 20s'
  );

  const experienceTitle = selectedTheme?.name || selectedAvatar?.name || 'Portrait Experience';

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  // Snapshot function (Instant, full 1080x1920 portrait canvas)
  const performInstantSnap = useCallback(() => {
    clearCountdownTimer();
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

      // Capture the FULL uncropped webcam field-of-view (never slice off shoulders, arms, or body on 16:9 cameras!)
      const vW = video.videoWidth;
      const vH = video.videoHeight;
      const canvas = document.createElement('canvas');
      canvas.width = vW;
      canvas.height = vH;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, vW, vH);

      ctx.save();
      // Mirror horizontally to match the live video display
      ctx.translate(vW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, vW, vH);
      ctx.restore();

      const capturedDataUrl = canvas.toDataURL('image/jpeg', 0.96);
      onPhotoCaptured(capturedDataUrl);
    } catch (err) {
      console.error('[CameraCapture] Snapshot error:', err);
      setCameraError('Failed to capture frame from webcam. Please retry.');
    }
  }, [clearCountdownTimer, onPhotoCaptured]);

  // Initialize camera stream
  const startCamera = useCallback(async () => {
    setCameraReady(false);
    setCameraError(null);
    clearCountdownTimer();
    setCountdown(20);
    setBodyAlignment('searching');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API unavailable. Please open on http://localhost:3000 or over HTTPS.');
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      let stream;
      try {
        // Request highest native camera resolution (1920x1080 Full HD) so the user's face has maximum pixel clarity
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 }
          },
          audio: false
        });
      } catch (constraintErr) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play().then(() => {
            setCameraReady(true);
            setCameraResolution({ width: video.videoWidth, height: video.videoHeight });
          }).catch((err) => {
            console.error('[CameraCapture] Play error:', err);
            setCameraError('Failed to play webcam stream.');
          });
        };
      }
    } catch (err) {
      console.error('[CameraCapture] getUserMedia error:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied. Please allow camera access in browser settings.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setCameraError('No webcam detected. Please connect a camera and tap Retry.');
      } else {
        setCameraError('Camera access required. Please grant permission and tap Retry.');
      }
    }
  }, [clearCountdownTimer]);

  useEffect(() => {
    startCamera();

    return () => {
      clearCountdownTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [startCamera, clearCountdownTimer]);

  // 20-SECOND COUNTDOWN TIMER (Always active once camera is ready)
  useEffect(() => {
    if (!cameraReady || cameraError) return;

    clearCountdownTimer();
    let currentSeconds = 20;
    setCountdown(currentSeconds);

    countdownTimerRef.current = setInterval(() => {
      currentSeconds -= 1;
      setCountdown(currentSeconds);

      // Play audio ticks in final 5 seconds
      if (currentSeconds <= 5 && currentSeconds > 0) {
        playAudio.click();
      }

      if (currentSeconds <= 0) {
        clearCountdownTimer();
        performInstantSnap();
      }
    }, 1000);

    return () => {
      clearCountdownTimer();
    };
  }, [cameraReady, cameraError, clearCountdownTimer, performInstantSnap]);

  // Lenient, Robust Real-Time Full-Body Pose Detection
  useEffect(() => {
    if (!cameraReady || !videoRef.current) return;

    let isSubscribed = true;
    let poseInstance = null;

    const setupPose = async () => {
      if (window.Pose) {
        try {
          poseInstance = new window.Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
          });
          poseInstance.setOptions({
            modelComplexity: 0,
            smoothLandmarks: true,
            minDetectionConfidence: 0.35,
            minTrackingConfidence: 0.35
          });

          poseInstance.onResults((results) => {
            if (!isSubscribed) return;
            const lms = results.poseLandmarks;
            if (!lms || lms.length < 25) {
              setBodyAlignment('searching');
              setAlignmentMessage('Step into the Holobox frame — 20s auto-timer running');
              return;
            }

            const nose = lms[0];
            const leftShoulder = lms[11];
            const rightShoulder = lms[12];
            const leftHip = lms[23];
            const rightHip = lms[24];
            const leftKnee = lms[25];
            const rightKnee = lms[26];
            const leftAnkle = lms[27];
            const rightAnkle = lms[28];

            if (laptopMode) {
              setBodyAlignment('aligned');
              setAlignmentMessage(
                selectedAvatar
                  ? 'Stand 3–5 ft away (waist-up is sharpest) — full-body uniform generates automatically!'
                  : 'Ready to capture! 20s auto-timer running or tap SNAP on right'
              );
              return;
            }

            const hasHead = nose && (nose.visibility === undefined || nose.visibility > 0.35);
            const shoulderWidth = Math.abs((rightShoulder?.x || 0) - (leftShoulder?.x || 0));

            // If user's shoulders or face occupy more than 50% of frame width, they are too close
            if (shoulderWidth > 0.48 || (nose && nose.y > 0.40)) {
              setBodyAlignment('too_close');
              setAlignmentMessage('Step back 2–3 paces so your full body (head to shoes) is visible');
              return;
            }

            // If hips/knees/ankles are detected further down, user is in full-body posture
            const lowerBodyVisible = (leftHip && rightHip) || (leftKnee || rightKnee) || (leftAnkle || rightAnkle);
            if (hasHead && lowerBodyVisible) {
              setBodyAlignment('aligned');
              setAlignmentMessage('Full body aligned! Hold steady...');
            } else {
              setBodyAlignment('searching');
              setAlignmentMessage('Step back until your entire standing silhouette fits inside');
            }
          });

          poseEstimatorRef.current = poseInstance;

          const detectLoop = async () => {
            if (!isSubscribed) return;
            const video = videoRef.current;
            if (video && video.readyState >= 2 && !video.paused && !video.ended) {
              try {
                await poseInstance.send({ image: video });
              } catch {}
            }
            animFrameRef.current = requestAnimationFrame(detectLoop);
          };
          detectLoop();
        } catch (err) {
          console.warn('[CameraCapture] MediaPipe Pose notice:', err);
          setBodyAlignment('aligned');
          setAlignmentMessage('Full body ready — auto-capturing in 20s');
        }
      } else {
        setBodyAlignment('aligned');
        setAlignmentMessage('Full body ready — auto-capturing in 20s');
      }
    };

    setupPose();

    return () => {
      isSubscribed = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (poseInstance?.close) {
        try { poseInstance.close(); } catch {}
      }
    };
  }, [cameraReady, laptopMode, selectedAvatar]);

  return (
    <div className="clean-screen-container camera-screen-clean" style={{ background: '#ffffff', minHeight: '100%', padding: '0', display: 'flex', flexDirection: 'column' }}>
      {/* ════════════════════════════════════════════════════════════════════
          ROW 1: TOP NAVIGATION BAR (Zero Overlap Guarantee)
         ════════════════════════════════════════════════════════════════════ */}
      <nav
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px 8px',
          background: '#ffffff',
          zIndex: 30,
          position: 'relative'
        }}
      >
        <button
          className="kiosk-nav-back-btn"
          onClick={() => {
            playAudio.click();
            clearCountdownTimer();
            onBack();
          }}
          aria-label="Back"
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
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
            transition: 'all 0.2s ease'
          }}
        >
          <ArrowLeft size={17} color="#0284c7" strokeWidth={2.4} />
          <span>Back</span>
        </button>

        {/* Center Pill: Holographic Tag */}
        <div
          style={{
            background: 'rgba(240, 249, 255, 0.9)',
            border: '1px solid #bae6fd',
            padding: '5px 14px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.8px',
            color: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(14, 165, 233, 0.08)'
          }}
        >
          <Sparkles size={12} color="#0284c7" />
          <span>HOLOBOX BIOMETRIC SNAP</span>
        </div>

        {/* Right Status Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: countdown <= 5 ? '#fef2f2' : '#f0f9ff',
            border: countdown <= 5 ? '1.5px solid #ef4444' : '1.5px solid #38bdf8',
            color: countdown <= 5 ? '#dc2626' : '#0284c7',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontWeight: 800,
            fontSize: '13px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <Camera size={15} />
          <span>{countdown}s</span>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════════════
          ROW 2: DEDICATED TITLE & SUBTITLE BLOCK (No Overlap)
         ════════════════════════════════════════════════════════════════════ */}
      <header
        style={{
          textAlign: 'center',
          padding: '2px 20px 10px',
          background: '#ffffff',
          borderBottom: '1px solid #f1f5f9',
          zIndex: 25,
          position: 'relative'
        }}
      >
        <h1
          className="popout-heading-luxury"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '24px',
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
          Full-Body Standing Capture
        </h1>
        <p
          className="popout-sub-luxury"
          style={{
            margin: '3px 0 0',
            color: '#64748b',
            fontSize: '12.5px',
            fontWeight: 500
          }}
        >
          Transforming into: <strong style={{ color: '#0284c7' }}>{experienceTitle}</strong>
        </p>
      </header>

      {/* 2. Main Viewport Stage */}
      <div className="camera-stage-frame" style={{ position: 'relative', flex: 1, overflow: 'hidden', background: '#000000' }}>
        {/* Raw Live Webcam Feed (Mirrored) */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="camera-video-feed"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)'
          }}
        />

        {/* FULL-BODY STANDING BIOMETRIC FRAMING GUIDE */}
        <div className="camera-framing-guide-overlay" style={{ pointerEvents: 'none', position: 'absolute', inset: 0 }}>
          <svg className="framing-silhouette-svg" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            {/* 1. Head Oval at Top */}
            <ellipse
              cx="50"
              cy="16"
              rx="8"
              ry="10"
              fill="none"
              stroke={bodyAlignment === 'aligned' ? '#22c55e' : bodyAlignment === 'too_close' ? '#f59e0b' : '#38bdf8'}
              strokeWidth="0.8"
              strokeDasharray="4 3"
            />

            {/* 2. Full-Body Standing Silhouette Contour */}
            <path
              d="M 42 24 C 36 26, 26 31, 20 40 L 22 55 L 30 54 L 33 44 L 37 45 L 38 72 L 40 91 L 49 91 L 49 60 L 51 60 L 51 91 L 60 91 L 62 72 L 63 45 L 67 44 L 70 54 L 78 55 L 80 40 C 74 31, 64 26, 58 24 Z"
              fill="none"
              stroke={bodyAlignment === 'aligned' ? 'rgba(34, 197, 94, 0.75)' : bodyAlignment === 'too_close' ? 'rgba(245, 158, 11, 0.75)' : 'rgba(56, 189, 248, 0.75)'}
              strokeWidth="0.75"
              strokeDasharray="4 3"
            />

            {/* 3. Ground Shoe Plane Level */}
            <line
              x1="20"
              y1="92"
              x2="80"
              y2="92"
              stroke={bodyAlignment === 'aligned' ? '#22c55e' : '#38bdf8'}
              strokeWidth="0.9"
              strokeDasharray="2 2"
            />
          </svg>

          {/* Active Holographic Biometric Scanner Beam */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, transparent, #38bdf8 25%, #ffffff 50%, #818cf8 75%, transparent)',
              boxShadow: '0 0 18px #38bdf8, 0 0 8px #ffffff',
              animation: 'laserScan 2.5s ease-in-out infinite',
              pointerEvents: 'none',
              zIndex: 15
            }}
          />

          {/* REAL-TIME STATUS PILL */}
          <div
            className="camera-alignment-pill"
            style={{
              position: 'absolute',
              top: '18px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: bodyAlignment === 'aligned'
                ? 'rgba(22, 101, 52, 0.94)'
                : bodyAlignment === 'too_close'
                ? 'rgba(180, 83, 9, 0.94)'
                : 'rgba(15, 23, 42, 0.88)',
              border: bodyAlignment === 'aligned'
                ? '1.5px solid #4ade80'
                : bodyAlignment === 'too_close'
                ? '1.5px solid #fde047'
                : '1.5px solid rgba(56, 189, 248, 0.5)',
              color: '#ffffff',
              padding: '8px 18px',
              borderRadius: '9999px',
              fontSize: '12.5px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
              whiteSpace: 'nowrap',
              zIndex: 30
            }}
          >
            {bodyAlignment === 'aligned' && <CheckCircle2 size={16} color="#4ade80" />}
            {bodyAlignment === 'too_close' && <AlertTriangle size={16} color="#fde047" />}
            {bodyAlignment === 'searching' && <UserCheck size={16} color="#38bdf8" />}
            <span>{alignmentMessage}</span>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            RIGHT-SIDE CENTER CAPTURE TRIGGER BUTTON (Zero bottom buttons)
           ════════════════════════════════════════════════════════════════════ */}
        {!cameraError && (
          <div
            style={{
              position: 'absolute',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 45,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {/* Outer Spinning Dashed Orbit Accent Ring */}
            <div
              style={{
                position: 'relative',
                width: '94px',
                height: '94px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: countdown <= 5 ? '2.5px dashed #ef4444' : '2.5px dashed #38bdf8',
                  animation: 'spinOrbit 8s linear infinite',
                  pointerEvents: 'none'
                }}
              />

              {/* Main Shutter Trigger Button */}
              <button
                type="button"
                onClick={() => {
                  playAudio.click();
                  performInstantSnap();
                }}
                aria-label="Capture Photo"
                style={{
                  width: '82px',
                  height: '82px',
                  borderRadius: '50%',
                  background: countdown <= 5
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    : 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
                  border: '3.5px solid #ffffff',
                  color: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  cursor: 'pointer',
                  boxShadow: countdown <= 5
                    ? '0 0 30px rgba(239, 68, 68, 0.75), 0 8px 24px rgba(0,0,0,0.35)'
                    : '0 0 30px rgba(14, 165, 233, 0.65), 0 8px 24px rgba(0,0,0,0.35)',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: 'scale(1)'
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                onTouchStart={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
                onTouchEnd={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <Camera size={26} strokeWidth={2.5} />
                <span style={{ fontSize: '10.5px', fontWeight: 900, letterSpacing: '0.6px', lineHeight: 1 }}>
                  SNAP
                </span>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 800,
                    background: 'rgba(255, 255, 255, 0.25)',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    marginTop: '1px'
                  }}
                >
                  {countdown}s
                </span>
              </button>
            </div>

            {/* Tap Label Below */}
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 800,
                color: countdown <= 5 ? '#ef4444' : '#0284c7',
                background: 'rgba(255, 255, 255, 0.95)',
                padding: '3px 10px',
                borderRadius: '9999px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                letterSpacing: '0.4px',
                whiteSpace: 'nowrap'
              }}
            >
              TAP TO SNAP
            </span>
          </div>
        )}

        {/* Camera Flash Animation */}
        {isFlashing && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#ffffff',
              zIndex: 100,
              animation: 'flash-fade 0.45s ease-out forwards'
            }}
          />
        )}

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
