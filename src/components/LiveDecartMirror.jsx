import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  ArrowLeft,
  Video,
  VideoOff,
  RefreshCw,
  Zap,
  ShieldAlert,
  Camera,
  Maximize2,
  Clock,
  Award,
  ChevronLeft,
  X
} from 'lucide-react';
import { DECART_CHARACTERS, DECART_CONFIG } from '../utils/decartCharacters';
import { playAudio } from '../utils/audio';
import '../styles/decartMirror.css';

export default function LiveDecartMirror({ onBack }) {
  // 1. Selected Character (Default to Sci-Fi Space Suit matching reference Holobox UI)
  const defaultChar = DECART_CHARACTERS[0];
  const [selectedCharacter, setSelectedCharacter] = useState(defaultChar);
  const [isTransforming, setIsTransforming] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('initializing'); // 'initializing' | 'connecting' | 'connected' | 'camera_only' | 'stopped' | 'error'
  const [statusMessage, setStatusMessage] = useState('Initializing Holobox mirror...');
  const [missingApiKey, setMissingApiKey] = useState(false);
  const [fps, setFps] = useState(30);
  const [activeModel, setActiveModel] = useState(DECART_CONFIG.defaultModel);
  const [flashActive, setFlashActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  // Session duration / safety countdown (115s active session with stop button, matching 120s server token limit)
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(115);
  const [hasRemoteFrame, setHasRemoteFrame] = useState(false);
  const [showFreezeFrame, setShowFreezeFrame] = useState(false);
  const [morphTargetChar, setMorphTargetChar] = useState(null);

  const localVideoRef = useRef(null);
  const pipVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const freezeCanvasRef = useRef(null);
  const probeCanvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const decartSessionRef = useRef(null);
  const decartClientRef = useRef(null);
  const isMountedRef = useRef(true);
  const initializedRef = useRef(false);
  const countdownTimerRef = useRef(null);
  const transitionTimerRef = useRef(null);
  const initialFramePollRef = useRef(null);
  const switchFramePollRef = useRef(null);
  const selectedCharacterRef = useRef(defaultChar);
  const sessionStatusRef = useRef('initializing');
  const referenceBlobCacheRef = useRef(new Map());

  // Load and downscale a character's 2D reference image to a lightweight JPEG Blob (cached in memory)
  // for fast, reliable VTON conditioning via Decart `initialState.image` and `session.set({ image, prompt, enhance: false })`.
  const loadReferenceImageBlob = useCallback(async (imageUrl) => {
    if (!imageUrl) return null;
    if (referenceBlobCacheRef.current.has(imageUrl)) {
      return referenceBlobCacheRef.current.get(imageUrl);
    }

    try {
      const res = await fetch(imageUrl);
      if (!res.ok) return null;
      const rawBlob = await res.blob();

      // Normalize to <= 768px JPEG so WebRTC control-channel base64 transfer is fast and crisp
      const imgBitmap = await createImageBitmap(rawBlob);
      const maxDim = 768;
      const scale = Math.min(1, maxDim / Math.max(imgBitmap.width, imgBitmap.height));
      const targetW = Math.max(64, Math.round(imgBitmap.width * scale));
      const targetH = Math.max(64, Math.round(imgBitmap.height * scale));

      const offscreen = document.createElement('canvas');
      offscreen.width = targetW;
      offscreen.height = targetH;
      const ctx = offscreen.getContext('2d');
      ctx.drawImage(imgBitmap, 0, 0, targetW, targetH);
      imgBitmap.close();

      const optimizedBlob = await new Promise((resolve) =>
        offscreen.toBlob((b) => resolve(b || rawBlob), 'image/jpeg', 0.9)
      );

      referenceBlobCacheRef.current.set(imageUrl, optimizedBlob);
      return optimizedBlob;
    } catch (err) {
      console.warn(`[LiveDecartMirror] Reference image load notice (${imageUrl}):`, err.message);
      return null;
    }
  }, []);

  // Atomically push both reference image + prompt (with enhance: false) to an active Decart session
  const applyCharacterToSession = useCallback(async (session, character) => {
    if (!session || !character) return;
    const refBlob = await loadReferenceImageBlob(character.referenceImage || character.thumbnail);

    if (refBlob && typeof session.set === 'function') {
      try {
        await session.set({
          image: refBlob,
          prompt: character.prompt,
          enhance: false
        });
        console.log(`[LiveDecartMirror] Applied VTON image + prompt: ${character.fullName || character.name} (enhance=false)`);
        return;
      } catch (setErr) {
        console.warn('[LiveDecartMirror] session.set(image+prompt) notice, falling back to setPrompt:', setErr.message);
      }
    } else if (refBlob && typeof session.setImage === 'function') {
      try {
        await session.setImage(refBlob, { prompt: character.prompt, enhance: false });
        console.log(`[LiveDecartMirror] Applied setImage + prompt: ${character.fullName || character.name} (enhance=false)`);
        return;
      } catch (imgErr) {
        console.warn('[LiveDecartMirror] session.setImage notice, falling back to setPrompt:', imgErr.message);
      }
    }

    if (typeof session.setPrompt === 'function') {
      await session.setPrompt(character.prompt, { enhance: false });
      console.log(`[LiveDecartMirror] Applied prompt-only: ${character.fullName || character.name} (enhance=false)`);
    }
  }, [loadReferenceImageBlob]);

  useEffect(() => {
    selectedCharacterRef.current = selectedCharacter;
  }, [selectedCharacter]);

  useEffect(() => {
    sessionStatusRef.current = sessionStatus;
  }, [sessionStatus]);

  // Detect if a <video> element is currently showing pure black or no decoded frame
  const isVideoFrameBlack = useCallback((video) => {
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      return true;
    }
    try {
      if (!probeCanvasRef.current) {
        const c = document.createElement('canvas');
        c.width = 16;
        c.height = 16;
        probeCanvasRef.current = c;
      }
      const probe = probeCanvasRef.current;
      const ctx = probe.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, 16, 16);
      const data = ctx.getImageData(0, 0, 16, 16).data;
      let totalLuma = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      return (totalLuma / 256) < 8;
    } catch {
      return false;
    }
  }, []);

  // Capture a clean non-black frame onto the freeze canvas to guarantee ZERO black flashes
  const captureFreezeFrame = useCallback(() => {
    const freezeCanvas = freezeCanvasRef.current;
    if (!freezeCanvas) return false;

    const remoteVideo = remoteVideoRef.current;
    const localVideo = localVideoRef.current;
    const sourceVideo = (remoteVideo && !isVideoFrameBlack(remoteVideo))
      ? remoteVideo
      : (localVideo && localVideo.readyState >= 2 && localVideo.videoWidth > 0)
        ? localVideo
        : null;

    if (!sourceVideo) return false;

    try {
      freezeCanvas.width = sourceVideo.videoWidth || 720;
      freezeCanvas.height = sourceVideo.videoHeight || 1280;
      const ctx = freezeCanvas.getContext('2d');
      ctx.drawImage(sourceVideo, 0, 0, freezeCanvas.width, freezeCanvas.height);
      return true;
    } catch {
      return false;
    }
  }, [isVideoFrameBlack]);

  // 1. Initialize Camera at 720p 9:16 suitable resolution
  const startCamera = useCallback(async () => {
    try {
      setStatusMessage('Requesting camera access...');
      const constraints = {
        video: {
          width: { ideal: DECART_CONFIG.idealWidth },
          height: { ideal: DECART_CONFIG.idealHeight },
          frameRate: { ideal: DECART_CONFIG.idealFps }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      if (pipVideoRef.current) {
        pipVideoRef.current.srcObject = stream;
        pipVideoRef.current.play().catch(() => {});
      }

      return stream;
    } catch (err) {
      console.error('[LiveDecartMirror] Camera error:', err);
      setSessionStatus('error');
      setStatusMessage(`Camera access denied: ${err.message}`);
      return null;
    }
  }, []);

  // 2. Fetch Short-Lived Ephemeral Token from Backend
  const fetchClientToken = async () => {
    try {
      const res = await fetch(DECART_CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        if (data.needsKey || res.status === 401) {
          setMissingApiKey(true);
          return null;
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      return data.apiKey;
    } catch (err) {
      console.warn('[LiveDecartMirror] Token fetch notice:', err.message);
      return null;
    }
  };

  // 3. Connect Decart Real-Time WebRTC Session (VTON-first with graceful fallback)
  const connectDecartSession = useCallback(async (stream, character) => {
    if (!stream) return;

    setHasRemoteFrame(false);
    setSessionStatus('connecting');
    setStatusMessage('Connecting to Decart Real-Time AI...');

    const token = await fetchClientToken();

    if (!token) {
      setSessionStatus('camera_only');
      setStatusMessage('Camera Mirror Active');
      return;
    }

    try {
      const { createDecartClient, listModels } = await import('@decartai/sdk');

      const client = createDecartClient({ apiKey: token });
      decartClientRef.current = client;

      const availableModels = listModels();
      // Prioritize Virtual Try-On model (lucy-vton-3.6) for authentic face & glasses preservation,
      // with automatic graceful fallback to lucy-2.6 / lucy-latest / lucy-2.5.
      const preferredOrder = ['lucy-vton-3.6', 'lucy-2.6', 'lucy-latest', 'lucy-2.5'];
      const candidateModels = preferredOrder
        .map((name) => availableModels.find((m) => m.name === name && m.kind === 'realtime'))
        .filter(Boolean);

      if (candidateModels.length === 0) {
        const anyRealtime = availableModels.find((m) => m.kind === 'realtime');
        if (anyRealtime) candidateModels.push(anyRealtime);
      }

      if (candidateModels.length === 0) {
        throw new Error('No compatible Decart realtime model found');
      }

      // Preload initial character's VTON reference image before connecting
      const initialRefBlob = await loadReferenceImageBlob(character.referenceImage || character.thumbnail);

      let session = null;
      let lastError = null;

      for (const modelDef of candidateModels) {
        if (!isMountedRef.current) return;
        try {
          console.log(`[LiveDecartMirror] Connecting with model: ${modelDef.name} (refImage=${Boolean(initialRefBlob)})`);
          setActiveModel(modelDef.name);

          session = await client.realtime.connect(stream, {
            model: modelDef,
            mirror: false,
            onRemoteStream: (remoteStream) => {
              if (!isMountedRef.current) return;
              console.log(`[LiveDecartMirror] Transformed WebRTC stream received (${modelDef.name})`);

              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
                remoteVideoRef.current.play().catch(() => {});
              }

              setSessionStatus('connected');
              setStatusMessage('Live Real-Time Transformation Active');

              // Poll until the first non-black frame arrives so we NEVER flash black on connect
              if (initialFramePollRef.current) clearInterval(initialFramePollRef.current);
              const pollStart = Date.now();
              initialFramePollRef.current = setInterval(() => {
                if (!isMountedRef.current) {
                  clearInterval(initialFramePollRef.current);
                  return;
                }
                const videoEl = remoteVideoRef.current;
                if ((videoEl && !isVideoFrameBlack(videoEl)) || Date.now() - pollStart > 3500) {
                  clearInterval(initialFramePollRef.current);
                  initialFramePollRef.current = null;
                  setHasRemoteFrame(true);
                }
              }, 120);

              // Countdown session timer
              if (!countdownTimerRef.current) {
                countdownTimerRef.current = setInterval(() => {
                  setSessionSecondsLeft((prev) => {
                    if (prev <= 1) {
                      clearInterval(countdownTimerRef.current);
                      countdownTimerRef.current = null;
                      handleStopSession();
                      return 0;
                    }
                    return prev - 1;
                  });
                }, 1000);
              }
            },
            onConnectionChange: (state) => {
              console.log('[LiveDecartMirror] Connection state:', state);
              if (state === 'disconnected') {
                setHasRemoteFrame(false);
                setShowFreezeFrame(false);
                setIsTransforming(false);
                setSessionStatus('camera_only');
                setStatusMessage('Session disconnected');
              }
            },
            initialState: {
              prompt: {
                text: character.prompt,
                enhance: false
              },
              ...(initialRefBlob ? { image: initialRefBlob } : {})
            }
          });

          // Connected successfully with this model
          break;
        } catch (modelErr) {
          lastError = modelErr;
          console.warn(`[LiveDecartMirror] Model ${modelDef.name} failed, trying fallback:`, modelErr.message);
        }
      }

      if (!session) {
        throw lastError || new Error('All realtime models failed to connect');
      }

      session.on('stats', (stats) => {
        if (stats?.inboundFps) {
          setFps(Math.round(stats.inboundFps));
        }
      });

      decartSessionRef.current = session;

      // Warm-cache the remaining 5 fantasy character reference images in background for instant switching
      DECART_CHARACTERS.forEach((c) => {
        if (c.id !== character.id) {
          loadReferenceImageBlob(c.referenceImage || c.thumbnail).catch(() => {});
        }
      });

      // If user clicked a different character while connecting, apply it immediately
      if (selectedCharacterRef.current && selectedCharacterRef.current.id !== character.id) {
        try {
          await applyCharacterToSession(session, selectedCharacterRef.current);
        } catch (e) {
          console.warn('[LiveDecartMirror] Queued character switch notice:', e.message);
        }
      }
    } catch (err) {
      console.error('[LiveDecartMirror] Decart connection error:', err);
      setHasRemoteFrame(false);
      setSessionStatus('camera_only');
      setStatusMessage('Showing local camera mirror.');
    }
  }, [isVideoFrameBlack, loadReferenceImageBlob, applyCharacterToSession]);

  // 4. Initial Mount: Start camera & connect
  useEffect(() => {
    isMountedRef.current = true;
    if (initializedRef.current) return;
    initializedRef.current = true;

    async function init() {
      const stream = await startCamera();
      if (stream && isMountedRef.current) {
        await connectDecartSession(stream, selectedCharacter);
      }
    }

    init();

    return () => {
      isMountedRef.current = false;
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      if (initialFramePollRef.current) {
        clearInterval(initialFramePollRef.current);
        initialFramePollRef.current = null;
      }
      if (switchFramePollRef.current) {
        clearInterval(switchFramePollRef.current);
        switchFramePollRef.current = null;
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      if (decartSessionRef.current) {
        try { decartSessionRef.current.disconnect(); } catch {}
        decartSessionRef.current = null;
      }
    };
  }, [startCamera, connectDecartSession]);

  // 5. Seamless Zero-Black-Screen Character Switch (Sidebar item click)
  const handleSelectCharacter = async (char) => {
    if (selectedCharacter.id === char.id) return;
    playAudio.click();

    // Clear any in-flight character-switch timers
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (switchFramePollRef.current) {
      clearInterval(switchFramePollRef.current);
      switchFramePollRef.current = null;
    }

    // Snapshot last clean non-black frame onto freeze canvas BEFORE sending new prompt
    if (captureFreezeFrame()) {
      setShowFreezeFrame(true);
    }

    setSelectedCharacter(char);
    setMorphTargetChar(char);
    setIsTransforming(true);

    if (decartSessionRef.current && sessionStatusRef.current === 'connected') {
      try {
        await applyCharacterToSession(decartSessionRef.current, char);
      } catch (err) {
        console.warn('[LiveDecartMirror] Failed to switch character on live session:', err);
      }
    }

    // Hold freeze frame through Decart's 1.2s-2.0s latent switch window,
    // then verify the live remote stream is actively outputting non-black frames before fading out
    const switchStartedAt = Date.now();
    const MIN_HOLD_MS = 1300;
    const MAX_HOLD_MS = 2800;

    switchFramePollRef.current = setInterval(() => {
      if (!isMountedRef.current) {
        clearInterval(switchFramePollRef.current);
        return;
      }
      const elapsed = Date.now() - switchStartedAt;
      if (elapsed < MIN_HOLD_MS) return;

      const remoteReady = sessionStatusRef.current !== 'connected' || !isVideoFrameBlack(remoteVideoRef.current);
      if (remoteReady || elapsed >= MAX_HOLD_MS) {
        clearInterval(switchFramePollRef.current);
        switchFramePollRef.current = null;
        setShowFreezeFrame(false);
        setIsTransforming(false);
        setMorphTargetChar(null);
      }
    }, 150);
  };

  // 6. Stop Session (Preserve credits)
  const handleStopSession = () => {
    playAudio.click();
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (initialFramePollRef.current) {
      clearInterval(initialFramePollRef.current);
      initialFramePollRef.current = null;
    }
    if (switchFramePollRef.current) {
      clearInterval(switchFramePollRef.current);
      switchFramePollRef.current = null;
    }
    if (decartSessionRef.current) {
      try { decartSessionRef.current.disconnect(); } catch {}
      decartSessionRef.current = null;
    }
    setHasRemoteFrame(false);
    setShowFreezeFrame(false);
    setIsTransforming(false);
    setSessionStatus('stopped');
    setStatusMessage('Live stream paused');
  };

  // 7. Restart Session
  const handleRestartSession = async () => {
    playAudio.click();
    if (cameraStreamRef.current) {
      setSessionSecondsLeft(115);
      await connectDecartSession(cameraStreamRef.current, selectedCharacter);
    } else {
      const stream = await startCamera();
      if (stream) {
        setSessionSecondsLeft(115);
        await connectDecartSession(stream, selectedCharacter);
      }
    }
  };

  // 8. Snapshot Photo Capture via Shutter Button
  const handleShutterClick = () => {
    playAudio.shutter();
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 300);

    // Capture current frame from remote or local video
    const video = (sessionStatus === 'connected' && remoteVideoRef.current)
      ? remoteVideoRef.current
      : localVideoRef.current;

    if (video) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        setCapturedPhoto(dataUrl);
      } catch (e) {
        console.warn('[LiveDecartMirror] Capture warning:', e);
      }
    }
  };

  return (
    <div className="holobox-mirror-container">
      {/* Flash overlay for shutter snapshot */}
      {flashActive && <div className="decart-camera-flash" />}

      {/* ======================================================== */}
      {/* 1. TOP STATUS & NAVIGATION BAR                           */}
      {/* ======================================================== */}
      <div className="holobox-top-bar">
        {/* Top-Left: Live indicator badge */}
        <div className="holobox-live-badge">
          <span className="holobox-live-dot" />
          <span className="holobox-live-text">Live</span>
        </div>

        {/* Top-Right: Real-Time | Stop Pill & Exit Button */}
        <div className="holobox-top-controls">
          {sessionStatus === 'connected' ? (
            <button
              className="holobox-pill-stop"
              onClick={handleStopSession}
              title="Pause AI Transformation"
            >
              <span className="pill-status-text">Real-Time</span>
              <span className="pill-divider">|</span>
              <span className="pill-action-text">Stop</span>
            </button>
          ) : sessionStatus === 'stopped' ? (
            <button
              className="holobox-pill-stop resume"
              onClick={handleRestartSession}
              title="Resume AI Transformation"
            >
              <RefreshCw size={13} className="inline mr-1" />
              <span>Resume Live</span>
            </button>
          ) : (
            <div className="holobox-pill-stop camera-mode">
              <span>{sessionStatus === 'connecting' ? 'Connecting...' : 'Camera Mirror'}</span>
            </div>
          )}

          <button
            className="holobox-btn-exit"
            onClick={() => {
              playAudio.click();
              onBack();
            }}
            title="Exit to Portal"
            aria-label="Exit Mirror"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. MAIN VIEWPORT (TRANSFORMED AI CHARACTER STREAM)       */}
      {/* ======================================================== */}
      <div className="holobox-main-viewport">
        {/* Layer 1: Real Local Camera Feed ALWAYS alive underneath (guarantees ZERO black screen) */}
        <video
          ref={localVideoRef}
          className="holobox-stream-video local-cam"
          autoPlay
          playsInline
          muted
        />

        {/* Layer 2: Remote AI Transformed Stream (fades in only after non-black frame decodes) */}
        <video
          ref={remoteVideoRef}
          className={`holobox-stream-video remote-stream ${sessionStatus === 'connected' && hasRemoteFrame ? 'active' : 'buffering'}`}
          autoPlay
          playsInline
          muted
        />

        {/* Layer 3: Seamless Freeze-Frame Canvas bridging Decart's character-switch window */}
        <canvas
          ref={freezeCanvasRef}
          className={`holobox-freeze-canvas ${showFreezeFrame ? 'visible' : 'hidden'}`}
        />

        {/* Layer 4: Connecting / Status Overlay */}
        {sessionStatus === 'connecting' && (
          <div className="holobox-connecting-hud">
            <div className="holobox-spinner" />
            <span className="holobox-connecting-text">Entering Real-Time Hologram...</span>
          </div>
        )}

        {/* Layer 5: Holographic Morphing Scanline & Pulse when character changes */}
        {isTransforming && (
          <div className="holobox-morph-overlay">
            <div className="holobox-morph-scanline" />
            <div className="morph-pulse-text">
              <span>✦ Morphing into {morphTargetChar?.fullName || selectedCharacter.fullName || selectedCharacter.name} ✦</span>
            </div>
            <div className="morph-sub-badge">Preserving Your Authentic Face & Eyes</div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. RIGHT-SIDE VERTICAL SCROLLABLE CHARACTER SIDEBAR     */}
      {/* ======================================================== */}
      <aside className="holobox-sidebar-characters" aria-label="Character Selection">
        <div className="sidebar-scroll-track">
          {DECART_CHARACTERS.map((char) => {
            const isSelected = selectedCharacter.id === char.id;
            return (
              <div
                key={char.id}
                className={`sidebar-char-card ${isSelected ? 'active-live' : ''}`}
                onClick={() => handleSelectCharacter(char)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleSelectCharacter(char)}
              >
                {/* Number & LIVE Badge Header */}
                <div className="char-card-header">
                  <span className="char-number">{char.num}</span>
                  {isSelected && (
                    <span className="char-live-badge">
                      <span className="char-live-dot" />
                      LIVE
                    </span>
                  )}
                </div>

                {/* Character Thumbnail / Visual */}
                <div className="char-thumb-wrap">
                  <img
                    src={char.thumbnail}
                    alt={char.name}
                    className="char-thumb-img"
                    onError={(e) => {
                      // Fallback if image fails
                      e.target.style.display = 'none';
                    }}
                  />
                </div>

                {/* Character Titles */}
                <div className="char-title-wrap">
                  <span className="char-title-main">{char.name}</span>
                  <span className="char-title-sub">{char.subtitle}</span>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 4. BOTTOM-RIGHT FLOATING CARD: REAL CAMERA PIP           */}
      {/* ======================================================== */}
      <div className="holobox-camera-pip" title="Real Camera Feed">
        <div className="pip-header-badge">
          <span className="pip-dot" />
          <span>CAMERA</span>
        </div>
        <div className="pip-video-container">
          <video
            ref={pipVideoRef}
            className="pip-video-element"
            autoPlay
            playsInline
            muted
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. BOTTOM-CENTER CIRCULAR SHUTTER BUTTON                 */}
      {/* ======================================================== */}
      <div className="holobox-shutter-container">
        <button
          className="holobox-shutter-btn"
          onClick={handleShutterClick}
          aria-label="Capture Snapshot Photo"
          title="Take Snapshot"
        >
          <div className="shutter-inner-ring">
            <div className="shutter-center-circle" />
          </div>
        </button>
      </div>

      {/* Captured Snapshot Modal Overlay */}
      {capturedPhoto && (
        <div className="holobox-snapshot-modal">
          <div className="snapshot-card">
            <div className="snapshot-header">
              <span className="snapshot-title">Holographic Snapshot</span>
              <button
                className="snapshot-close-btn"
                onClick={() => setCapturedPhoto(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="snapshot-img-wrap">
              <img src={capturedPhoto} alt="Captured Mirror Snapshot" />
            </div>
            <div className="snapshot-actions">
              <a
                href={capturedPhoto}
                download={`holobox_mirror_${selectedCharacter.id}_${Date.now()}.jpg`}
                className="snapshot-download-btn"
                onClick={() => playAudio.click()}
              >
                Download Snapshot
              </a>
              <button
                className="snapshot-retake-btn"
                onClick={() => setCapturedPhoto(null)}
              >
                Continue Mirror
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
