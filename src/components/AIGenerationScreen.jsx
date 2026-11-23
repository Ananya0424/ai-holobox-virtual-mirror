import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  UserCheck,
  Wand2,
  Layers,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Camera,
  Flame
} from 'lucide-react';
import AmbientBackground from './AmbientBackground';

export default function AIGenerationScreen({
  photoDataUrl,
  selectedAvatar,
  selectedTheme,
  selectedMode,
  gender,
  onGenerationComplete,
  onRetake
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(8);
  const [liveStatusLabel, setLiveStatusLabel] = useState('Extracting facial identity & analyzing portrait...');
  const [errorMessage, setErrorMessage] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const isTheme = selectedMode === 'theme' || Boolean(selectedTheme);
  const title = isTheme
    ? selectedTheme?.name || 'Theme Dimension'
    : selectedAvatar?.name || 'Professional Persona';

  const steps = isTheme
    ? [
        { label: 'Preserving Facial Identity & Real Outfit...', icon: UserCheck },
        { label: `Integrating 3D ${selectedTheme?.name || 'Theme'} Characters...`, icon: Layers },
        { label: 'Harmonizing Volumetric Lighting & Floor Shadows...', icon: Sparkles },
        { label: 'Finalizing 1080x1920 Pure White Holobox Scene...', icon: ShieldCheck }
      ]
    : [
        { label: 'Preserving Facial Identity & Skin Tone...', icon: UserCheck },
        { label: `Fitting ${selectedAvatar?.name || 'Custom'} Attire in 3D...`, icon: Wand2 },
        { label: 'Synthesizing Studio Lighting & Photorealistic Textures...', icon: Sparkles },
        { label: 'Finalizing 1080x1920 Pure White Studio Portrait...', icon: ShieldCheck }
      ];

  const ActiveIcon = steps[Math.min(currentStepIndex, steps.length - 1)]?.icon || Wand2;

  useEffect(() => {
    let isCancelled = false;
    let pollTimer = null;

    setErrorMessage(null);
    setProgressPercent(8);
    setCurrentStepIndex(0);
    setLiveStatusLabel('Initializing local AI synthesis matrix...');

    const safeParseJson = async (res) => {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(res.ok ? 'Unexpected response format' : `Server error (${res.status})`);
      }
    };

    let consecutiveErrors = 0;

    const runTransformation = async () => {
      try {
        const professionKey = selectedAvatar?.profession || selectedAvatar?.name || 'doctor';
        const payloadBody = JSON.stringify({
          photoDataUrl,
          mode: isTheme ? 'theme' : 'avatar',
          theme: selectedTheme?.id || 'mickey',
          profession: professionKey,
          gender: gender || 'female',
          customPrompt: selectedAvatar?.isCustom ? selectedAvatar.customPrompt : null,
          async: true
        });

        let res = null;
        let lastSubmitErr = null;
        for (let attempt = 1; attempt <= 4; attempt++) {
          if (isCancelled) return;
          try {
            res = await fetch('/api/transform-photo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payloadBody
            });
            if (res.ok || res.status < 500) break;
            lastSubmitErr = new Error(`Server busy (${res.status})`);
          } catch (netErr) {
            lastSubmitErr = netErr;
          }
          if (attempt < 4) {
            setLiveStatusLabel(`Connecting to AI GPU worker (attempt ${attempt + 1}/4)...`);
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
        if (!res) {
          throw lastSubmitErr || new Error('Could not reach AI Kiosk server');
        }

        const initData = await safeParseJson(res);
        if (isCancelled) return;

        if (!res.ok || !initData.jobId) {
          throw new Error(initData.error || initData.details || 'Failed to start AI transformation');
        }

        const jobId = initData.jobId;
        const pollStatus = async () => {
          if (isCancelled) return;
          try {
            const stRes = await fetch(`/api/transform-status/${encodeURIComponent(jobId)}`);
            const stData = await safeParseJson(stRes);
            if (isCancelled) return;

            consecutiveErrors = 0;

            if (stData.transient) {
              pollTimer = setTimeout(pollStatus, 1000);
              return;
            }

            const pct = typeof stData.progress === 'number' ? stData.progress : 15;
            setProgressPercent(pct);
            if (stData.stepLabel) {
              setLiveStatusLabel(stData.stepLabel);
            }

            if (pct < 25) setCurrentStepIndex(0);
            else if (pct < 65) setCurrentStepIndex(1);
            else if (pct < 90) setCurrentStepIndex(2);
            else setCurrentStepIndex(3);

            if (stData.status === 'done' && stData.photoUrl) {
              setProgressPercent(100);
              setCurrentStepIndex(steps.length - 1);
              setLiveStatusLabel('Transformation Complete! Teleporting to Holobox...');
              setTimeout(() => {
                if (!isCancelled) {
                  onGenerationComplete(stData.photoUrl, stData.downloadId, stData.mobileDownloadUrl);
                }
              }, 500);
              return;
            }

            if (stData.status === 'error') {
              setErrorMessage(stData.error || 'Transformation process encountered an error');
              return;
            }

            pollTimer = setTimeout(pollStatus, 650);
          } catch (pollErr) {
            if (isCancelled) return;
            consecutiveErrors += 1;
            console.warn(`[AIGeneration] Polling glitch (${consecutiveErrors}/20):`, pollErr);
            if (consecutiveErrors < 20) {
              pollTimer = setTimeout(pollStatus, 1500);
            } else {
              setErrorMessage(pollErr.message || 'Error checking transformation status');
            }
          }
        };

        pollTimer = setTimeout(pollStatus, 400);
      } catch (err) {
        if (!isCancelled) {
          console.error('[AIGeneration] Submission error:', err);
          setErrorMessage(err.message || 'Failed to submit portrait for AI generation');
        }
      }
    };

    runTransformation();

    return () => {
      isCancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [photoDataUrl, selectedAvatar, selectedTheme, isTheme, gender, retryCount]);

  return (
    <div
      className="clean-screen-container ai-generation-luxury"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px 20px 24px',
        background: 'radial-gradient(circle at 50% 20%, #ffffff 0%, #f0f9ff 60%, #e0f2fe 100%)',
        overflow: 'hidden'
      }}
    >
      {/* 3D Holographic Orbit Rings & Volumetric Atmosphere */}
      <AmbientBackground />

      {/* ══════════════════════════════════════════════════════════════════
          ROW 1: TOP HUD STATUS BAR (Zero Overlap Guarantee)
         ══════════════════════════════════════════════════════════════════ */}
      <nav
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 30,
          position: 'relative'
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1.5px solid #38bdf8',
            backdropFilter: 'blur(10px)',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.8px',
            color: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 14px rgba(14, 165, 233, 0.15)'
          }}
        >
          <Cpu size={14} color="#0284c7" />
          <span>QUANTUM HOLOBOX AI</span>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 800,
            color: '#0f172a',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span style={{ color: '#0284c7' }}>{Math.round(progressPercent)}%</span>
          <span style={{ color: '#94a3b8', fontSize: '10.5px' }}>SYNTHESIS</span>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════
          ROW 2: CENTER 3D HOLOGRAPHIC SYNTHESIZER CAPSULE CARD
         ══════════════════════════════════════════════════════════════════ */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 25,
          position: 'relative',
          padding: '10px 0'
        }}
      >
        <div
          className="popout-card-3d"
          style={{
            width: '100%',
            maxWidth: '480px',
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(20px)',
            border: '2px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '28px',
            padding: '28px 24px 24px',
            boxShadow: '0 20px 50px rgba(14, 165, 233, 0.16), 0 0 35px rgba(168, 85, 247, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Top Sheen Accent Line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '10%',
              right: '10%',
              height: '3px',
              background: 'linear-gradient(90deg, transparent, #38bdf8 30%, #8b5cf6 70%, transparent)',
              borderRadius: '9999px'
            }}
          />

          {/* 1. 3D Biometric Holographic Gyro Ring Core */}
          <div
            style={{
              position: 'relative',
              width: '110px',
              height: '110px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '18px'
            }}
          >
            {/* Outer Spinning Dashed Orbit Ring */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2px dashed #38bdf8',
                animation: 'spinOrbit 8s linear infinite'
              }}
            />

            {/* Inner Counter-spinning Ring */}
            <div
              style={{
                position: 'absolute',
                inset: '8px',
                borderRadius: '50%',
                border: '1.5px solid rgba(168, 85, 247, 0.4)',
                borderTopColor: '#a855f7',
                animation: 'spinOrbit 5s linear infinite reverse'
              }}
            />

            {/* Pulsating Radar Wave */}
            <div
              style={{
                position: 'absolute',
                inset: '16px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(14, 165, 233, 0.25) 0%, transparent 70%)',
                animation: 'pulseCore 2s ease-in-out infinite'
              }}
            />

            {/* Core Icon Bubble */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 60%, #4338ca 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(2, 132, 199, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.4)',
                zIndex: 2,
                transition: 'all 0.3s ease'
              }}
            >
              <ActiveIcon size={30} color="#ffffff" strokeWidth={2.4} />
            </div>
          </div>

          {/* 2. Pop-Out Kinetic Headline & Dimension Badge */}
          <h1
            className="popout-heading-luxury"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '-0.4px',
              lineHeight: 1.2,
              margin: '0 0 6px',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #0f172a 0%, #0284c7 45%, #7c3aed 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 8px rgba(14, 165, 233, 0.15))'
            }}
          >
            AI Studio Transformation
          </h1>

          <div
            className="popout-sub-luxury"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              color: '#0284c7',
              padding: '4px 14px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.2px',
              marginBottom: '18px',
              textAlign: 'center'
            }}
          >
            <span>{isTheme ? 'Teleporting into' : 'Synthesizing'}</span>
            <strong style={{ color: '#0369a1' }}>{title}</strong>
          </div>

          {/* 3. Glowing Neon Laser Progress Bar */}
          <div style={{ width: '100%', marginBottom: '20px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#64748b',
                marginBottom: '6px'
              }}
            >
              <span>NEURAL PIPELINE</span>
              <span style={{ color: '#0284c7', fontWeight: 800 }}>
                STEP {currentStepIndex + 1} OF {steps.length}
              </span>
            </div>

            {/* Progress Track */}
            <div
              style={{
                width: '100%',
                height: '10px',
                borderRadius: '9999px',
                background: '#e2e8f0',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)'
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(8, progressPercent))}%`,
                  borderRadius: '9999px',
                  background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 45%, #a855f7 85%, #ec4899 100%)',
                  boxShadow: '0 0 16px rgba(56, 189, 248, 0.65)',
                  transition: 'width 0.4s ease-out',
                  position: 'relative'
                }}
              >
                {/* Leading Edge Sparkle Beam */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: '18px',
                    background: 'linear-gradient(90deg, transparent, #ffffff)',
                    borderRadius: '9999px',
                    filter: 'drop-shadow(0 0 6px #ffffff)'
                  }}
                />
              </div>
            </div>
          </div>

          {/* 4. 4-Step Biometric Synthesis Matrix */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginBottom: '18px'
            }}
          >
            {steps.map((st, idx) => {
              const StepIcon = st.icon;
              const isDone = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <div
                  key={st.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '16px',
                    background: isDone
                      ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
                      : isCurrent
                      ? 'linear-gradient(135deg, #f0f9ff, #e0f2fe)'
                      : 'rgba(248, 250, 252, 0.7)',
                    border: isDone
                      ? '1.5px solid #86efac'
                      : isCurrent
                      ? '1.5px solid #38bdf8'
                      : '1.5px solid #e2e8f0',
                    boxShadow: isCurrent
                      ? '0 6px 18px rgba(14, 165, 233, 0.18)'
                      : isDone
                      ? '0 2px 8px rgba(34, 197, 94, 0.08)'
                      : 'none',
                    transition: 'all 0.3s ease',
                    transform: isCurrent ? 'scale(1.02)' : 'scale(1)'
                  }}
                >
                  {/* Step Bubble */}
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isDone
                        ? '#22c55e'
                        : isCurrent
                        ? '#0284c7'
                        : '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: isCurrent
                        ? '0 0 12px rgba(14, 165, 233, 0.5)'
                        : 'none'
                    }}
                  >
                    {isDone ? (
                      <CheckCircle2 size={18} color="#ffffff" strokeWidth={2.6} />
                    ) : (
                      <StepIcon
                        size={16}
                        color={isCurrent ? '#ffffff' : '#64748b'}
                        strokeWidth={2.4}
                      />
                    )}
                  </div>

                  {/* Step Label */}
                  <span
                    style={{
                      fontSize: '12.5px',
                      fontWeight: isCurrent ? 700 : isDone ? 600 : 500,
                      color: isDone
                        ? '#15803d'
                        : isCurrent
                        ? '#0f172a'
                        : '#64748b',
                      flex: 1,
                      lineHeight: 1.3
                    }}
                  >
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 5. Live Quantum Status Ticker */}
          {!errorMessage && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                border: '1px solid #cbd5e1',
                borderRadius: '14px',
                padding: '9px 16px',
                color: '#0284c7',
                fontSize: '12px',
                fontWeight: 700,
                textAlign: 'center',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
              }}
            >
              <Sparkles size={15} color="#0284c7" className="animate-spin-slow" />
              <span style={{ color: '#0f172a' }}>{liveStatusLabel}</span>
            </div>
          )}

          {/* 6. Error Notification Box (If Any) */}
          {errorMessage && (
            <div
              style={{
                width: '100%',
                background: '#fef2f2',
                border: '1.5px solid #fca5a5',
                borderRadius: '16px',
                padding: '16px',
                textAlign: 'center',
                marginTop: '10px'
              }}
            >
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#dc2626' }}>
                Transformation Glitch Encountered
              </h4>
              <p style={{ margin: '6px 0 14px', fontSize: '12px', color: '#b91c1c', lineHeight: 1.4 }}>
                {errorMessage}
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  onClick={() => setRetryCount((c) => c + 1)}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '8px 18px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={14} color="#ffffff" />
                  <span>Retry AI</span>
                </button>
                <button
                  onClick={onRetake}
                  style={{
                    background: '#ffffff',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '9999px',
                    padding: '8px 18px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Camera size={14} color="#475569" />
                  <span>Back to Camera</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ══════════════════════════════════════════════════════════════════
          ROW 3: FOOTER BRANDING PILL
         ══════════════════════════════════════════════════════════════════ */}
      <footer
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 30,
          position: 'relative'
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.85)',
            border: '1px solid #e2e8f0',
            backdropFilter: 'blur(8px)',
            borderRadius: '9999px',
            padding: '6px 18px',
            fontSize: '11px',
            fontWeight: 700,
            color: '#64748b',
            letterSpacing: '0.6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
          }}
        >
          <span style={{ color: '#0284c7' }}>●</span>
          <span>1080x1920 HOLOBOX PHOTOREALISTIC TELEPORTATION</span>
        </div>
      </footer>
    </div>
  );
}
