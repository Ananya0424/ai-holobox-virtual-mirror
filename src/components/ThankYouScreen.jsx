import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { playAudio } from '../utils/audio';
import AmbientBackground from './AmbientBackground';

export default function ThankYouScreen({ onFinish }) {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    playAudio.scanComplete();

    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      onFinish();
    }
  }, [countdown, onFinish]);

  return (
    <div className="flow-screen-container thankyou-screen-flow">
      {/* Dynamic Ambient Background Light Orbs & Floating Holographic Sparkles */}
      <AmbientBackground />

      <div className="thankyou-card-box">
        {/* Animated Holographic Rings around Icon */}
        <div className="thankyou-sparkle-halo">
          <div className="thankyou-sparkle-pulse-ring" />
          <Sparkles size={46} color="#0284c7" />
        </div>

        <h2 className="thankyou-title-large">
          Thank You<br />for Trying<br />Holobox!
        </h2>

        <p className="thankyou-subtitle-text">
          Your interactive holographic experience is complete.
        </p>

        <div className="thankyou-return-badge">
          <span>Returning to Welcome Screen ({countdown}s)...</span>
        </div>
      </div>
    </div>
  );
}
