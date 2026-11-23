import React, { useState, useEffect } from 'react';
import { Mic, MicOff, X, Loader2 } from 'lucide-react';
import { parseCustomPrompt, validateCustomPromptClient } from '../utils/avatarData';
import { interpretPromptWithGemini } from '../utils/geminiAI';
import { playAudio } from '../utils/audio';

export default function CustomLookPrompt({ gender, isOpen, onClose, onApplyCustomLook }) {
  const [promptText, setPromptText] = useState('');
  const [validationError, setValidationError] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recognitionInstance, setRecognitionInstance] = useState(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        playAudio.click();
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setPromptText(transcript);
        setIsListening(false);
        playAudio.click();
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setRecognitionInstance(recognition);
    }
  }, []);

  if (!isOpen) return null;

  const toggleListening = () => {
    if (!speechSupported || !recognitionInstance) {
      setValidationError('Voice input is not supported in this browser. Please type your outfit prompt.');
      return;
    }

    if (isListening) {
      recognitionInstance.stop();
      setIsListening(false);
    } else {
      try {
        recognitionInstance.start();
      } catch (e) {
        setIsListening(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isAnalyzing) return;

    const check = validateCustomPromptClient(promptText);
    if (!check.valid) {
      setValidationError(check.reason);
      return;
    }

    setValidationError(null);
    playAudio.click();
    setIsAnalyzing(true);

    try {
      // Interpret user's prompt locally first for decoration theme, optionally enriched by Gemini
      const localMatch = parseCustomPrompt(check.cleaned, gender);
      let geminiMatch = await interpretPromptWithGemini(check.cleaned, gender);
      const result = geminiMatch
        ? {
            ...localMatch,
            decorations: geminiMatch.decorations || localMatch.decorations,
            customTitle: geminiMatch.customTitle || localMatch.customTitle
          }
        : localMatch;

      playAudio.whoosh();
      setIsAnalyzing(false);
      onApplyCustomLook({ ...result, rawPrompt: check.cleaned });
    } catch (err) {
      const fallback = parseCustomPrompt(check.cleaned, gender);
      setIsAnalyzing(false);
      onApplyCustomLook({ ...fallback, rawPrompt: check.cleaned });
    }
  };

  return (
    <div className="custom-modal-overlay" onClick={onClose}>
      <div className="custom-modal-luxury-box" onClick={(e) => e.stopPropagation()}>
        {/* 1. Elegant Premium Heading */}
        <div className="custom-luxury-header">
          <div>
            <h2 className="custom-luxury-title">Custom Look</h2>
            <p className="custom-luxury-subtitle">Envision any outfit or style</p>
          </div>
          <button
            className="custom-luxury-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2.2} />
          </button>
        </div>

        {/* 2. Beautifully Designed Text Input with Integrated Microphone */}
        <form onSubmit={handleSubmit} className="custom-luxury-input-wrapper">
          <input
            type="text"
            className="custom-luxury-input"
            placeholder="Describe the look you want..."
            value={promptText}
            onChange={(e) => {
              setPromptText(e.target.value);
              if (validationError) setValidationError(null);
            }}
            disabled={isAnalyzing}
            autoFocus
          />

          <button
            type="button"
            className={`custom-luxury-mic-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            title={isListening ? 'Listening...' : 'Voice Input'}
            disabled={isAnalyzing}
          >
            {isListening ? (
              <MicOff size={20} color="#ef4444" />
            ) : (
              <Mic size={20} color="#0284c7" />
            )}
          </button>
        </form>

        {validationError && (
          <p style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: 500, marginTop: '-4px', marginBottom: '10px', textAlign: 'center' }}>
            {validationError}
          </p>
        )}

        {/* 3. Quick-Tap Idea Chips (Instant 1-tap touch selection for Holobox) */}
        <div className="custom-quick-chips-container">
          <span className="custom-quick-chips-label">Popular Ideas (Tap to fill):</span>
          <div className="custom-quick-chips-grid">
            {[
              { label: '👑 Royal Traditional', prompt: gender === 'female' ? 'royal Indian traditional red silk lehenga with delicate gold embroidery and jewelry' : 'royal Indian regal velvet sherwani with gold embroidery' },
              { label: '👨‍🍳 Master Chef', prompt: 'master chef in tailored black double-breasted cotton chef jacket with apron' },
              { label: '🏎️ F1 Racer', prompt: 'Formula 1 racing driver in tailored red team racing firesuit with athletic sneakers' },
              { label: '🧥 Luxury Trench', prompt: 'chic autumn beige trench coat over tailored white shirt and slim trousers' },
              { label: '🎸 Rock Musician', prompt: 'rock musician in authentic black leather biker jacket and fitted jeans' },
              { label: '🥋 Martial Artist', prompt: 'traditional martial arts master in clean woven white cotton gi with black belt' },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                className="custom-quick-chip-btn"
                onClick={() => {
                  playAudio.click();
                  setPromptText(chip.prompt);
                  if (validationError) setValidationError(null);
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Refined Submit Button */}
        <button
          type="button"
          className="custom-luxury-submit-btn"
          onClick={handleSubmit}
          disabled={!promptText.trim() || isAnalyzing}
        >
          {isAnalyzing ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 size={18} className="animate-spin" />
              Creating Look...
            </span>
          ) : (
            'Submit'
          )}
        </button>
      </div>
    </div>
  );
}
