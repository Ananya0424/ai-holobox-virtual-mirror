import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2, ShieldCheck, UserCheck, Wand2 } from 'lucide-react';

export default function AIGenerationScreen({
  photoDataUrl,
  selectedAvatar,
  gender,
  onGenerationComplete,
  onRetake
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(5);
  const [liveStatusLabel, setLiveStatusLabel] = useState('Submitting portrait to local AI studio...');
  const [errorMessage, setErrorMessage] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const steps = [
    { label: 'Preserving Facial Identity & Skin Tone...', icon: UserCheck },
    { label: `Generating ${selectedAvatar?.name || 'Professional'} Uniform with AI Inpainting...`, icon: Wand2 },
    { label: 'Synthesizing Studio Lighting & Photorealistic Folds...', icon: Sparkles },
    { label: 'Finalizing White Studio Portrait & Floating Accents...', icon: ShieldCheck }
  ];

  useEffect(() => {
    let isCancelled = false;
    let pollTimer = null;

    setErrorMessage(null);
    setProgressPercent(5);
    setCurrentStepIndex(0);
    setLiveStatusLabel('Initializing AI studio pipeline...');

    const runTransformation = async () => {
      try {
        const professionKey = selectedAvatar?.profession || selectedAvatar?.name || 'pilot';
        const res = await fetch('/api/transform-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photoDataUrl,
            profession: professionKey,
            gender: gender || 'female',
            customPrompt: selectedAvatar?.isCustom ? selectedAvatar.customPrompt : null,
            async: true
          })
        });

        const initData = await res.json();
        if (isCancelled) return;

        if (!res.ok || !initData.jobId) {
          throw new Error(initData.error || initData.details || 'Failed to start AI transformation');
        }

        const jobId = initData.jobId;
        const pollStatus = async () => {
          if (isCancelled) return;
          try {
            const stRes = await fetch(`/api/transform-status/${encodeURIComponent(jobId)}`);
            const stData = await stRes.json();
            if (isCancelled) return;

            const pct = typeof stData.progress === 'number' ? stData.progress : 10;
            setProgressPercent(pct);
            if (stData.stepLabel) {
              setLiveStatusLabel(stData.stepLabel);
            }

            if (pct < 22) setCurrentStepIndex(0);
            else if (pct < 85) setCurrentStepIndex(1);
            else if (pct < 98) setCurrentStepIndex(2);
            else setCurrentStepIndex(3);

            if (stData.status === 'done' && stData.photoUrl) {
              setProgressPercent(100);
              setCurrentStepIndex(steps.length - 1);
              setTimeout(() => {
                if (!isCancelled) {
                  onGenerationComplete(stData.photoUrl, stData.downloadId, stData.mobileDownloadUrl);
                }
              }, 450);
              return;
            }

            if (stData.status === 'error') {
              setErrorMessage(stData.error || 'AI inpainting generation failed on local GPU');
              return;
            }

            pollTimer = setTimeout(pollStatus, 450);
          } catch (pollErr) {
            if (!isCancelled) {
              setErrorMessage('Lost connection while checking AI progress: ' + pollErr.message);
            }
          }
        };

        pollTimer = setTimeout(pollStatus, 450);
      } catch (err) {
        console.error('[AIGenerationScreen] Transform start failed:', err);
        if (!isCancelled) {
          setErrorMessage(err.message || 'Failed to connect to AI transformation server');
        }
      }
    };

    runTransformation();

    return () => {
      isCancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [photoDataUrl, selectedAvatar, gender, onGenerationComplete, retryCount]);

  const CurrentIcon = steps[currentStepIndex].icon;

  return (
    <div className="ai-generation-screen-container">
      <div className="ai-generation-card">
        {/* Glowing holographic orb */}
        <div className="ai-orb-wrapper">
          <div className="ai-orb-ring-outer" />
          <div className="ai-orb-ring-inner" />
          <div className="ai-orb-center">
            <CurrentIcon size={46} color="#0284c7" className="ai-orb-icon-pulse" />
          </div>
        </div>

        {/* Title */}
        <h2 className="ai-generation-title">AI Studio Transformation</h2>
        <p className="ai-generation-subtitle">
          Applying <strong style={{ color: '#0284c7' }}>{selectedAvatar?.name || 'Professional'}</strong> attire while preserving your genuine identity
        </p>

        {errorMessage ? (
          <div style={{ marginTop: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '12px', padding: '1rem', color: '#991b1b' }}>
            <p style={{ fontWeight: 700, color: '#dc2626', marginBottom: '0.5rem' }}>Transformation Error</p>
            <p style={{ fontSize: '0.85rem', marginBottom: '1rem', wordBreak: 'break-word' }}>{errorMessage}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setRetryCount((c) => c + 1)}
                style={{
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  padding: '0.6rem 1.1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Retry AI
              </button>
              <button
                onClick={() => onRetake && onRetake()}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  padding: '0.6rem 1.1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Back to Camera
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Progress Bar */}
            <div className="ai-progress-track">
              <div className="ai-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="ai-progress-percent">{progressPercent}% — {liveStatusLabel}</div>

            {/* Step List Tracker */}
            <div className="ai-steps-list">
              {steps.map((step, idx) => {
                const isDone = idx < currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                return (
                  <div
                    key={step.label}
                    className={`ai-step-row ${isDone ? 'done' : ''} ${isCurrent ? 'active' : ''}`}
                  >
                    <div className="ai-step-indicator">
                      {isDone ? (
                        <CheckCircle2 size={18} color="#16a34a" />
                      ) : (
                        <div className={`ai-step-dot ${isCurrent ? 'pulse' : ''}`} />
                      )}
                    </div>
                    <span className="ai-step-text">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
