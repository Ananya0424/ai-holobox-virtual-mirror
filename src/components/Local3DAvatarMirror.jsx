import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Activity,
  Maximize2,
  ShieldCheck,
  Cpu,
  AlertTriangle,
  Eye,
  EyeOff,
  Box,
  Sparkles,
  UserCheck,
  Swords,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  FileWarning
} from 'lucide-react';
import { MediaPipePoseTracker, POSE_CONNECTIONS } from '../modules/tracking/MediaPipePoseTracker';
import { AvatarLoader } from '../modules/avatar/AvatarLoader';
import { SceneManager } from '../modules/avatar/SceneManager';
import { PoseRetargeter } from '../modules/avatar/PoseRetargeter';
import { FANTASY_AVATARS } from '../utils/fantasyAvatars';
import { playAudio } from '../utils/audio';
import '../styles/avatarMirror.css';

export default function Local3DAvatarMirror({ onBack }) {
  const [initStage, setInitStage] = useState('Initializing 3D fantasy avatar mirror...');
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitchingCharacter, setIsSwitchingCharacter] = useState(false);
  const [switchStageText, setSwitchStageText] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [delegate, setDelegate] = useState('GPU');

  // Independent Performance Metrics
  const [trackingFps, setTrackingFps] = useState(0);
  const [renderFps, setRenderFps] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [showPip, setShowPip] = useState(true);
  const [showRoster, setShowRoster] = useState(true);

  // Six-Character Selection & Real Asset Status State
  const [selectedCharacterId, setSelectedCharacterId] = useState(FANTASY_AVATARS[0].id);
  const [assetStatusMap, setAssetStatusMap] = useState(() => {
    const initial = {};
    for (const c of FANTASY_AVATARS) {
      initial[c.id] = { checked: false, modelAvailable: false, propAvailable: false };
    }
    return initial;
  });

  // Active Character Load Status: 'checking' | 'loaded' | 'missing_vrm' | 'error'
  const [characterLoadState, setCharacterLoadState] = useState('checking');
  const [characterLoadError, setCharacterLoadError] = useState(null);

  // Stage C Retargeting Telemetry State
  const [retargetTelemetry, setRetargetTelemetry] = useState({
    activeBones: 0,
    totalBonesTracked: 0,
    status: 'Awaiting Rigged VRM Model',
    isTracking: false
  });

  // Active Rig & Prop Attachment Telemetry
  const [avatarInfo, setAvatarInfo] = useState({
    name: FANTASY_AVATARS[0].name,
    modelFile: FANTASY_AVATARS[0].modelPath.replace('/avatars/', ''),
    height: 1.65,
    skeletonValidated: false,
    bonesCount: 0,
    metaVersion: '1.0',
    propAttached: false,
    propBone: FANTASY_AVATARS[0].prop.targetBone,
    propStatus: 'Awaiting .glb prop'
  });

  const sceneContainerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const sceneManagerRef = useRef(null);
  const avatarLoaderRef = useRef(null);
  const currentVRMRef = useRef(null);
  const currentPropRef = useRef(null);
  const retargeterRef = useRef(new PoseRetargeter());
  const loadTokenRef = useRef(0);

  const cameraStreamRef = useRef(null);
  const trackerRef = useRef(null);
  const trackingLoopIdRef = useRef(null);
  const isMountedRef = useRef(true);

  // FPS calculation references
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());

  const selectedCharacter =
    FANTASY_AVATARS.find((c) => c.id === selectedCharacterId) || FANTASY_AVATARS[0];

  // Probe actual rigged .vrm and .glb prop availability for all 6 fantasy characters
  const probeAllCharacterAssets = useCallback(async (loaderInstance) => {
    const loader = loaderInstance || avatarLoaderRef.current;
    if (!loader) return {};

    const entries = await Promise.all(
      FANTASY_AVATARS.map(async (char) => {
        const [modelAvailable, propAvailable] = await Promise.all([
          loader.checkAssetAvailable(char.modelPath),
          loader.checkAssetAvailable(char.prop.path)
        ]);
        return [char.id, { checked: true, modelAvailable, propAvailable }];
      })
    );

    const statusObj = Object.fromEntries(entries);
    if (isMountedRef.current) {
      setAssetStatusMap(statusObj);
    }
    return statusObj;
  }, []);

  // Modularly load a selected fantasy character VRM + attach its separate 3D weapon prop to hand bone
  const loadSelectedCharacter = useCallback(async (character, knownStatus = null) => {
    const loader = avatarLoaderRef.current;
    const sceneManager = sceneManagerRef.current;
    if (!loader || !sceneManager || !character) return;

    const myToken = ++loadTokenRef.current;
    setCharacterLoadError(null);
    setSwitchStageText(`Inspecting ${character.name} 3D assets...`);
    setIsSwitchingCharacter(true);

    // 1. Cleanly detach & dispose any previously active prop and VRM
    if (currentPropRef.current) {
      loader.detachAndDisposeProp(currentPropRef.current);
      currentPropRef.current = null;
    }
    if (currentVRMRef.current) {
      sceneManager.clearAvatar();
      loader.disposeVRM(currentVRMRef.current);
      currentVRMRef.current = null;
    }
    retargeterRef.current.bindVRM(null);
    if (isMountedRef.current) {
      setRetargetTelemetry({
        activeBones: 0,
        totalBonesTracked: 0,
        status: 'Unbound — Checking VRM',
        isTracking: false
      });
    }

    // Apply character-specific holographic rim & studio floor ring tint
    sceneManager.setCharacterAccent(character.rimLightHex);

    // 2. Check actual .vrm and .glb availability (never substitute Seed-san or fake models!)
    const [modelAvailable, propAvailable] = knownStatus
      ? [knownStatus.modelAvailable, knownStatus.propAvailable]
      : await Promise.all([
          loader.checkAssetAvailable(character.modelPath),
          loader.checkAssetAvailable(character.prop.path)
        ]);

    if (!isMountedRef.current || myToken !== loadTokenRef.current) return;

    setAssetStatusMap((prev) => ({
      ...prev,
      [character.id]: { checked: true, modelAvailable, propAvailable }
    }));

    const modelFileName = character.modelPath.split('/').pop();

    if (!modelAvailable) {
      setCharacterLoadState('missing_vrm');
      setAvatarInfo({
        name: character.name,
        modelFile: modelFileName,
        height: 0,
        skeletonValidated: false,
        bonesCount: 0,
        metaVersion: '—',
        propAttached: false,
        propBone: character.prop.targetBone,
        propStatus: propAvailable ? 'GLB Ready (Needs VRM)' : 'GLB Missing'
      });
      setRetargetTelemetry({
        activeBones: 0,
        totalBonesTracked: 0,
        status: `Awaiting ${modelFileName}`,
        isTracking: false
      });
      setIsSwitchingCharacter(false);
      setSwitchStageText('');
      return;
    }

    // 3. Load real rigged VRM model
    try {
      setSwitchStageText(`Loading rigged VRM (${modelFileName})...`);
      const {
        vrm,
        name,
        height,
        skeletonValidated,
        foundBones,
        metaVersion
      } = await loader.loadVRM(character.modelPath, (statusText) => {
        if (isMountedRef.current && myToken === loadTokenRef.current) {
          setSwitchStageText(`${character.name}: ${statusText}`);
        }
      });

      if (!isMountedRef.current || myToken !== loadTokenRef.current) {
        loader.disposeVRM(vrm);
        return;
      }

      currentVRMRef.current = vrm;
      sceneManager.setAvatar(vrm, height);

      // 4. Bind VRM humanoid skeleton to existing 17-bone MediaPipe PoseRetargeter
      retargeterRef.current.bindVRM(vrm);
      setRetargetTelemetry(retargeterRef.current.getTelemetry());

      // 5. Load & attach separate 3D weapon/prop GLB to the appropriate VRM hand bone
      let propAttached = false;
      let propStatus = 'Prop GLB Missing';

      if (propAvailable) {
        try {
          setSwitchStageText(`Attaching ${character.prop.name} to ${character.prop.targetBone}...`);
          const propScene = await loader.loadPropGLB(character.prop.path);

          if (!isMountedRef.current || myToken !== loadTokenRef.current) {
            loader.detachAndDisposeProp(propScene);
            return;
          }

          const attachResult = loader.attachPropToHandBone(vrm, propScene, character.prop);
          if (attachResult.attached) {
            currentPropRef.current = propScene;
            propAttached = true;
            propStatus = `Attached (${attachResult.boneName})`;
          } else {
            loader.detachAndDisposeProp(propScene);
            propStatus = attachResult.reason || 'Hand bone unavailable';
          }
        } catch (propErr) {
          console.warn(`[Local3DAvatarMirror] Prop load warning for ${character.name}:`, propErr);
          propStatus = 'Prop Load Error';
        }
      }

      setAvatarInfo({
        name: name || character.name,
        modelFile: modelFileName,
        height: height || 1.65,
        skeletonValidated,
        bonesCount: foundBones.length,
        metaVersion,
        propAttached,
        propBone: character.prop.targetBone,
        propStatus
      });
      setCharacterLoadState('loaded');
    } catch (err) {
      console.error(`[Local3DAvatarMirror] Error loading ${character.modelPath}:`, err);
      if (isMountedRef.current && myToken === loadTokenRef.current) {
        setCharacterLoadState('error');
        setCharacterLoadError(err.message || `Failed to load ${character.modelPath}`);
      }
    } finally {
      if (isMountedRef.current && myToken === loadTokenRef.current) {
        setIsSwitchingCharacter(false);
        setSwitchStageText('');
      }
    }
  }, []);

  // 1. Start Local Webcam (720p 30FPS)
  const startCamera = async () => {
    try {
      setInitStage('Opening camera (720p @ 30FPS)...');
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().then(resolve).catch(resolve);
          };
        });
      }

      return stream;
    } catch (err) {
      console.error('[Local3DAvatarMirror] Camera error:', err);
      throw new Error(`Webcam access failed: ${err.message}. Please check camera permissions.`);
    }
  };

  // 2. Pose Tracking & Real-Time Retargeting Loop (Preserved 17-bone pipeline)
  const trackingLoop = useCallback(() => {
    if (!isMountedRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const tracker = trackerRef.current;
    const retargeter = retargeterRef.current;

    if (video && canvas && tracker && video.readyState >= 2) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
      }

      const now = performance.now();
      const result = tracker.detectForVideo(video, now);

      // Measure Tracking FPS
      frameCountRef.current++;
      const elapsed = now - lastFpsTimeRef.current;
      if (elapsed >= 500) {
        setTrackingFps(Math.round((frameCountRef.current * 1000) / elapsed));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (result && result.landmarks && result.landmarks.length > 0) {
        const landmarks = result.landmarks[0];
        const width = canvas.width;
        const height = canvas.height;

        let sumConfidence = 0;
        let countScored = 0;

        for (let i = 0; i < landmarks.length; i++) {
          const pt = landmarks[i];
          if (pt && pt.visibility !== undefined) {
            sumConfidence += pt.visibility;
            countScored++;
          }
        }

        const avgConf = countScored > 0 ? Math.round((sumConfidence / countScored) * 100) : 0;
        setConfidence(avgConf);

        // Drive bound VRM humanoid bones when a real rigged VRM is loaded
        if (currentVRMRef.current) {
          retargeter.update(landmarks, 0.016);
          setRetargetTelemetry(retargeter.getTelemetry());
        }

        // Draw Skeleton Connections in PiP
        ctx.lineWidth = 3.0;
        ctx.lineCap = 'round';

        for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
          const p1 = landmarks[startIdx];
          const p2 = landmarks[endIdx];

          if (!p1 || !p2) continue;
          const vis1 = p1.visibility !== undefined ? p1.visibility : 1;
          const vis2 = p2.visibility !== undefined ? p2.visibility : 1;
          if (vis1 < 0.3 || vis2 < 0.3) continue;

          const isLeft = startIdx % 2 !== 0 && endIdx % 2 !== 0 && startIdx >= 11;
          const isRight = startIdx % 2 === 0 && endIdx % 2 === 0 && startIdx >= 11;

          ctx.strokeStyle = isLeft
            ? 'rgba(52, 211, 153, 0.9)'
            : isRight
              ? 'rgba(251, 191, 36, 0.9)'
              : 'rgba(56, 189, 248, 0.9)';
          ctx.beginPath();
          ctx.moveTo(p1.x * width, p1.y * height);
          ctx.lineTo(p2.x * width, p2.y * height);
          ctx.stroke();
        }

        // Draw Landmark Nodes in PiP
        for (let i = 0; i < landmarks.length; i++) {
          const pt = landmarks[i];
          const vis = pt.visibility !== undefined ? pt.visibility : 1;
          if (vis < 0.3) continue;

          ctx.fillStyle =
            i % 2 !== 0 && i >= 11 ? '#10b981' : i % 2 === 0 && i >= 11 ? '#f59e0b' : '#06b6d4';
          ctx.beginPath();
          ctx.arc(pt.x * width, pt.y * height, 4, 0, 2 * Math.PI);
          ctx.fill();
        }
      } else {
        setConfidence(0);
        if (currentVRMRef.current) {
          retargeter.update(null, 0.016);
          setRetargetTelemetry(retargeter.getTelemetry());
        }
      }
    }

    trackingLoopIdRef.current = requestAnimationFrame(trackingLoop);
  }, []);

  // 3. Initialize Three.js Scene, Probe Six Fantasy VRM Assets & Start MediaPipe
  useEffect(() => {
    isMountedRef.current = true;

    async function init() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        // A. Initialize Three.js WebGL 3D Scene
        setInitStage('Setting up Three.js 3D studio viewport...');
        const sceneManager = new SceneManager(sceneContainerRef.current);
        sceneManagerRef.current = sceneManager;

        // B. Start Three.js Animation Loop & measure Rendering FPS
        sceneManager.startAnimationLoop((fps) => {
          if (isMountedRef.current) setRenderFps(fps);
        });

        // C. Initialize Modular AvatarLoader & Audit All 6 Fantasy VRM + Prop Assets
        setInitStage('Scanning public/avatars/ for rigged fantasy VRM models...');
        const avatarLoader = new AvatarLoader();
        avatarLoaderRef.current = avatarLoader;

        const probedMap = await probeAllCharacterAssets(avatarLoader);
        if (!isMountedRef.current) return;

        // Pick the first character with an actual rigged VRM if available, else Aether Knight placeholder
        const firstReady =
          FANTASY_AVATARS.find((c) => probedMap[c.id]?.modelAvailable) || FANTASY_AVATARS[0];
        setSelectedCharacterId(firstReady.id);
        await loadSelectedCharacter(firstReady, probedMap[firstReady.id]);

        if (!isMountedRef.current) return;

        // D. Start Camera & MediaPipe Pose Tracking (Preserved Local Pipeline)
        setInitStage('Starting local camera & MediaPipe tracker...');
        await startCamera();

        const tracker = new MediaPipePoseTracker();
        const { delegate: chosenDelegate } = await tracker.initialize((status) => {
          if (isMountedRef.current) setInitStage(status);
        });

        if (!isMountedRef.current) {
          tracker.close();
          return;
        }

        trackerRef.current = tracker;
        setDelegate(chosenDelegate);
        setIsLoading(false);

        // E. Start Tracking Loop
        trackingLoopIdRef.current = requestAnimationFrame(trackingLoop);
      } catch (err) {
        console.error('[Local3DAvatarMirror] Setup error:', err);
        if (isMountedRef.current) {
          setErrorMessage(err.message || 'Failed to initialize 3D avatar mirror');
          setIsLoading(false);
        }
      }
    }

    init();

    // 4. Strict Resource Cleanup on Unmount
    return () => {
      isMountedRef.current = false;
      loadTokenRef.current++;

      if (trackingLoopIdRef.current) {
        cancelAnimationFrame(trackingLoopIdRef.current);
        trackingLoopIdRef.current = null;
      }

      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }

      if (trackerRef.current) {
        trackerRef.current.close();
        trackerRef.current = null;
      }

      if (avatarLoaderRef.current && currentPropRef.current) {
        avatarLoaderRef.current.detachAndDisposeProp(currentPropRef.current);
        currentPropRef.current = null;
      }

      if (avatarLoaderRef.current && currentVRMRef.current) {
        avatarLoaderRef.current.disposeVRM(currentVRMRef.current);
        currentVRMRef.current = null;
      }

      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
        sceneManagerRef.current = null;
      }
    };
  }, [trackingLoop, probeAllCharacterAssets, loadSelectedCharacter]);

  const handleSelectCharacter = (character) => {
    playAudio.click();
    setSelectedCharacterId(character.id);
    loadSelectedCharacter(character);
  };

  const handleRescanAssets = async () => {
    playAudio.click();
    const probed = await probeAllCharacterAssets();
    await loadSelectedCharacter(selectedCharacter, probed[selectedCharacter.id]);
  };

  const handleToggleFullscreen = () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {}
  };

  const selectedStatus = assetStatusMap[selectedCharacter.id] || {
    checked: false,
    modelAvailable: false,
    propAvailable: false
  };

  return (
    <div className="avatar-mirror-root">
      {/* 1. Header Bar */}
      <div className="avatar-mirror-header">
        <button
          className="avatar-btn-back"
          onClick={() => {
            playAudio.click();
            onBack();
          }}
          aria-label="Back to Main Kiosk"
        >
          <ArrowLeft size={18} />
          <span>Exit Mirror</span>
        </button>

        <div className="avatar-header-center">
          <div className="avatar-badge-row">
            <div className="avatar-tech-badge">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>LOCAL THREE.JS + MEDIAPIPE (0 CLOUD)</span>
            </div>
            <div className="avatar-delegate-badge">
              <Cpu size={11} className="mr-1" />
              <span>{delegate} DELEGATE</span>
            </div>
          </div>
          <span className="avatar-header-title">
            3D Fantasy Avatar Mirror — {selectedCharacter.name}
          </span>
        </div>

        <div className="avatar-header-actions">
          <button
            className="avatar-btn-icon"
            onClick={handleRescanAssets}
            title="Rescan public/avatars/ for VRM & GLB files"
          >
            <RefreshCw size={16} />
          </button>
          <button
            className={`avatar-btn-icon ${showPip ? 'active' : ''}`}
            onClick={() => setShowPip((prev) => !prev)}
            title={showPip ? 'Hide Camera PiP' : 'Show Camera PiP'}
          >
            {showPip ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          <button
            className="avatar-btn-icon"
            onClick={handleToggleFullscreen}
            title="Toggle Fullscreen"
          >
            <Maximize2 size={18} />
          </button>
        </div>
      </div>

      {/* 2. Main 3D Viewport */}
      <div className="avatar-mirror-viewport">
        {/* Three.js WebGL Canvas Mount Container */}
        <div ref={sceneContainerRef} className="avatar-3d-scene-container" />

        {/* Picture-in-Picture (PiP) Webcam + Skeleton Tracker */}
        <div className={`avatar-pip-wrapper ${showPip ? '' : 'collapsed'}`}>
          <div className="avatar-pip-header">
            <span>TRACKING INPUT</span>
            <span>{trackingFps} FPS</span>
          </div>
          <div className="avatar-pip-video-area">
            <video
              ref={videoRef}
              className="avatar-camera-video"
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="avatar-skeleton-canvas"
            />
          </div>
        </div>

        {/* Hologram Frame Corners */}
        <div className="avatar-hologram-corners">
          <div className="avatar-corner tl" style={{ borderColor: selectedCharacter.accentColor }} />
          <div className="avatar-corner tr" style={{ borderColor: selectedCharacter.accentColor }} />
          <div className="avatar-corner bl" style={{ borderColor: selectedCharacter.accentColor }} />
          <div className="avatar-corner br" style={{ borderColor: selectedCharacter.accentColor }} />
        </div>

        {/* Honest Asset Placeholder Stage (Shown ONLY when the character's rigged .vrm is missing) */}
        {!isLoading && !isSwitchingCharacter && characterLoadState === 'missing_vrm' && (
          <div
            className="fantasy-placeholder-stage"
            style={{ '--char-accent': selectedCharacter.accentColor, '--char-glow': selectedCharacter.accentGlow }}
          >
            <div className="fantasy-placeholder-card">
              <div className="fantasy-placeholder-badge">
                <FileWarning size={13} />
                <span>2D CONCEPT REFERENCE — RIGGED 3D .VRM ASSET REQUIRED</span>
              </div>

              <div className="fantasy-placeholder-body">
                <div className="fantasy-placeholder-thumb-wrap">
                  <img
                    src={selectedCharacter.thumbnail}
                    alt={`${selectedCharacter.name} reference preview`}
                    className="fantasy-placeholder-thumb"
                  />
                  <span className="fantasy-thumb-tag">STATIC 2D PREVIEW</span>
                </div>

                <div className="fantasy-placeholder-details">
                  <div className="fantasy-char-element">{selectedCharacter.element}</div>
                  <h2 className="fantasy-char-title">{selectedCharacter.name}</h2>

                  <ul className="fantasy-spec-list">
                    <li><strong>Armour:</strong> {selectedCharacter.armor}</li>
                    <li><strong>Weapon ({selectedCharacter.prop.handLabel}):</strong> {selectedCharacter.weapon}</li>
                    <li><strong>Effects:</strong> {selectedCharacter.effects}</li>
                  </ul>

                  <div className="fantasy-asset-checklist">
                    <div className={`fantasy-asset-row ${selectedStatus.modelAvailable ? 'ready' : 'missing'}`}>
                      <span className="asset-status-tag">
                        {selectedStatus.modelAvailable ? 'READY' : 'MISSING VRM'}
                      </span>
                      <code>public{selectedCharacter.modelPath}</code>
                    </div>
                    <div className={`fantasy-asset-row ${selectedStatus.propAvailable ? 'ready' : 'missing'}`}>
                      <span className="asset-status-tag">
                        {selectedStatus.propAvailable ? 'READY' : 'MISSING PROP'}
                      </span>
                      <code>public{selectedCharacter.prop.path}</code>
                    </div>
                  </div>

                  <p className="fantasy-placeholder-note">
                    MediaPipe 33-landmark pose tracking is active. Place a compatible rigged VRM humanoid at{' '}
                    <code>public{selectedCharacter.modelPath}</code> and click <strong>Rescan</strong> to animate
                    all 17 bones and hand-attached weapon in real time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Character Switch Loading Pill */}
        {!isLoading && isSwitchingCharacter && (
          <div className="avatar-switch-pill">
            <div className="avatar-switch-spinner" />
            <span>{switchStageText || `Loading ${selectedCharacter.name}...`}</span>
          </div>
        )}

        {/* Character Load Error Notice */}
        {!isLoading && characterLoadState === 'error' && characterLoadError && (
          <div className="avatar-error-banner">
            <AlertTriangle size={22} className="text-red-400 shrink-0" />
            <div>
              <strong>Could Not Load {selectedCharacter.name} VRM</strong>
              <p>{characterLoadError}</p>
            </div>
          </div>
        )}

        {/* Initial Setup Loading Overlay */}
        {isLoading && (
          <div className="avatar-loading-overlay">
            <div className="avatar-loading-spinner" />
            <span className="avatar-loading-text">{initStage}</span>
          </div>
        )}

        {/* Camera / Tracker Error Banner */}
        {errorMessage && (
          <div className="avatar-error-banner">
            <AlertTriangle size={24} className="text-red-400 shrink-0" />
            <div>
              <strong>3D Mirror Setup Notice</strong>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Developer Telemetry HUD (Preserved) */}
        <div className="avatar-telemetry-hud">
          <div className="avatar-hud-pill">
            <Box size={13} className="text-emerald-400" />
            <span className="avatar-hud-text">
              RENDER: <strong>{renderFps} FPS</strong> (WebGL 2.0)
            </span>
          </div>

          <div className="avatar-hud-pill">
            <Activity size={13} className="text-cyan-400" />
            <span className="avatar-hud-text">
              TRACKING: <strong>{trackingFps} FPS</strong> (MediaPipe)
            </span>
          </div>

          <div className="avatar-hud-pill">
            <span className={`avatar-status-dot ${confidence > 50 ? 'active' : 'idle'}`} />
            <span className="avatar-hud-text">
              CONFIDENCE: <strong>{confidence}%</strong> ({confidence > 50 ? '33 LANDMARKS' : 'SEARCHING'})
            </span>
          </div>

          <div className="avatar-hud-pill">
            <UserCheck size={13} className="text-indigo-400" />
            <span className="avatar-hud-text">
              RETARGET: <strong>{retargetTelemetry.activeBones}/17 BONES</strong>
            </span>
          </div>
        </div>

        {/* 3. Six-Character Fantasy Selection Dock & Rig Status */}
        <div className={`fantasy-roster-dock ${showRoster ? 'expanded' : 'collapsed'}`}>
          <div className="fantasy-dock-topbar">
            <div className="fantasy-dock-title-group">
              <Sparkles size={14} style={{ color: selectedCharacter.accentColor }} />
              <span className="fantasy-dock-title">
                FANTASY AVATARS (6) — {selectedCharacter.name}
              </span>
              <span className={`fantasy-live-badge ${characterLoadState === 'loaded' ? 'live' : 'pending'}`}>
                {characterLoadState === 'loaded'
                  ? `3D RIG ACTIVE (${avatarInfo.bonesCount}/15 BONES)`
                  : 'AWAITING RIGGED VRM'}
              </span>
            </div>

            <div className="fantasy-dock-right">
              <span className="fantasy-prop-chip">
                <Swords size={12} />
                <span>
                  {selectedCharacter.prop.handLabel}: {avatarInfo.propStatus}
                </span>
              </span>
              <button
                type="button"
                className="fantasy-toggle-btn"
                onClick={() => setShowRoster((prev) => !prev)}
              >
                {showRoster ? (
                  <>
                    <span>Hide Roster</span>
                    <ChevronDown size={14} />
                  </>
                ) : (
                  <>
                    <span>Choose Avatar</span>
                    <ChevronUp size={14} />
                  </>
                )}
              </button>
            </div>
          </div>

          {showRoster && (
            <div className="fantasy-character-grid" role="listbox" aria-label="Fantasy 3D Avatars">
              {FANTASY_AVATARS.map((character) => {
                const isSelected = character.id === selectedCharacter.id;
                const status = assetStatusMap[character.id] || {
                  checked: false,
                  modelAvailable: false,
                  propAvailable: false
                };

                return (
                  <button
                    key={character.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`fantasy-char-btn ${isSelected ? 'selected' : ''}`}
                    style={{
                      '--char-accent': character.accentColor,
                      '--char-glow': character.accentGlow
                    }}
                    onClick={() => handleSelectCharacter(character)}
                  >
                    <div className="fantasy-char-thumb-box">
                      <img
                        src={character.thumbnail}
                        alt={character.name}
                        className="fantasy-char-thumb"
                      />
                    </div>

                    <div className="fantasy-char-meta">
                      <span className="fantasy-card-name">{character.name}</span>
                      <span className="fantasy-card-weapon">{character.weapon}</span>
                      <span
                        className={`fantasy-card-status ${
                          status.modelAvailable ? 'ready' : 'pending'
                        }`}
                      >
                        {status.modelAvailable ? (
                          <>
                            <CheckCircle2 size={9} /> 3D READY
                          </>
                        ) : (
                          'NEEDS VRM'
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
