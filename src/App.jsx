import React, { useState, useEffect, useCallback } from 'react';
import KioskFrame from './components/KioskFrame';
import WelcomeScreen from './components/WelcomeScreen';
import CategorySelection from './components/CategorySelection';
import AvatarCarousel from './components/AvatarCarousel';
import CameraCaptureScreen from './components/CameraCaptureScreen';
import AIGenerationScreen from './components/AIGenerationScreen';
import PhotoPreview from './components/PhotoPreview';
import ThankYouScreen from './components/ThankYouScreen';
import './styles/kiosk.css';
import './styles/index.css';

export default function App() {
  // Screen state: 'welcome' | 'gender' | 'profession' | 'capture' | 'generating' | 'preview' | 'thankyou'
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [selectedGender, setSelectedGender] = useState('female');
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [rawCapturedPhoto, setRawCapturedPhoto] = useState(null);
  const [transformedPhoto, setTransformedPhoto] = useState(null);
  const [downloadId, setDownloadId] = useState(null);
  const [mobileDownloadUrl, setMobileDownloadUrl] = useState(null);

  // Flow Handlers
  const handleStartExperience = () => {
    // Request browser fullscreen seamlessly on first user gesture if supported in kiosk setup
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      // Ignore fullscreen denial in embedded/automated browsers
    }
    setCurrentScreen('gender');
  };

  const handleSelectGender = (gender) => {
    setSelectedGender(gender);
    setCurrentScreen('profession');
  };

  const handleSelectProfession = (avatar) => {
    setSelectedAvatar(avatar);
    setCurrentScreen('capture');
  };

  const handlePhotoCaptured = (photoDataUrl) => {
    setRawCapturedPhoto(photoDataUrl);
    setCurrentScreen('generating');
  };

  const handleGenerationComplete = (finalPhotoUrl, dlId, mobUrl = null) => {
    setTransformedPhoto(finalPhotoUrl);
    setDownloadId(dlId);
    setMobileDownloadUrl(mobUrl);
    setCurrentScreen('preview');
  };

  const handleRetake = () => {
    setTransformedPhoto(null);
    setDownloadId(null);
    setMobileDownloadUrl(null);
    setCurrentScreen('capture');
  };

  const handleChangeProfession = () => {
    setTransformedPhoto(null);
    setDownloadId(null);
    setMobileDownloadUrl(null);
    setCurrentScreen('profession');
  };

  const handleFinishToThankYou = () => {
    setCurrentScreen('thankyou');
  };

  const handleResetToWelcome = useCallback(() => {
    setRawCapturedPhoto(null);
    setTransformedPhoto(null);
    setDownloadId(null);
    setMobileDownloadUrl(null);
    setSelectedAvatar(null);
    setSelectedGender('female');
    setCurrentScreen('welcome');
  }, []);

  // Kiosk idle safety: return to Welcome & clear session data if a user walks away mid-flow (90s idle)
  useEffect(() => {
    if (currentScreen === 'welcome' || currentScreen === 'generating') return;

    let idleTimer = setTimeout(handleResetToWelcome, 90000);
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(handleResetToWelcome, 90000);
    };

    window.addEventListener('pointerdown', resetIdle, { passive: true });
    window.addEventListener('keydown', resetIdle);
    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener('pointerdown', resetIdle);
      window.removeEventListener('keydown', resetIdle);
    };
  }, [currentScreen, handleResetToWelcome]);

  return (
    <KioskFrame currentScreen={currentScreen} onResetToWelcome={handleResetToWelcome}>
      {/* Screen 1 – Welcome Screen */}
      {currentScreen === 'welcome' && (
        <WelcomeScreen onStart={handleStartExperience} />
      )}

      {/* Screen 2 – Gender Selection */}
      {currentScreen === 'gender' && (
        <CategorySelection onSelectCategory={handleSelectGender} />
      )}

      {/* Screen 3 – Profession Selection (5 professions + custom) */}
      {currentScreen === 'profession' && (
        <AvatarCarousel
          gender={selectedGender}
          onSelectAvatar={handleSelectProfession}
        />
      )}

      {/* Screen 4 – Camera Capture (Clean video feed + body framing silhouette guide) */}
      {currentScreen === 'capture' && (
        <CameraCaptureScreen
          selectedAvatar={selectedAvatar}
          gender={selectedGender}
          onPhotoCaptured={handlePhotoCaptured}
          onBack={() => setCurrentScreen('profession')}
        />
      )}

      {/* Screen 5 – AI Image Generation (Live progress & biometric pipeline) */}
      {currentScreen === 'generating' && (
        <AIGenerationScreen
          photoDataUrl={rawCapturedPhoto}
          selectedAvatar={selectedAvatar}
          gender={selectedGender}
          onGenerationComplete={handleGenerationComplete}
          onRetake={handleRetake}
        />
      )}

      {/* Screen 6 – Generated Image Preview & Centered QR Download */}
      {currentScreen === 'preview' && (
        <PhotoPreview
          photoDataUrl={transformedPhoto || rawCapturedPhoto}
          selectedAvatar={selectedAvatar}
          downloadId={downloadId}
          mobileDownloadUrl={mobileDownloadUrl}
          onRestart={handleResetToWelcome}
          onFinish={handleFinishToThankYou}
        />
      )}

      {/* Screen 7 – Thank You Screen */}
      {currentScreen === 'thankyou' && (
        <ThankYouScreen onFinish={handleResetToWelcome} />
      )}
    </KioskFrame>
  );
}
