import React, { useState, useEffect, useCallback } from 'react';
import KioskFrame from './components/KioskFrame';
import WelcomeScreen from './components/WelcomeScreen';
import CategorySelection from './components/CategorySelection';
import ExperienceChoiceScreen from './components/ExperienceChoiceScreen';
import ThemeSelectionScreen from './components/ThemeSelectionScreen';
import AvatarCarousel from './components/AvatarCarousel';
import CameraCaptureScreen from './components/CameraCaptureScreen';
import AIGenerationScreen from './components/AIGenerationScreen';
import PhotoPreview from './components/PhotoPreview';
import ThankYouScreen from './components/ThankYouScreen';
import LiveDecartMirror from './components/LiveDecartMirror';
import Local3DAvatarMirror from './components/Local3DAvatarMirror';
import './styles/kiosk.css';
import './styles/index.css';

export default function App() {
  // Screen state:
  // 'welcome' | 'gender' | 'experience_choice' | 'theme_selection' | 'profession' | 'capture' | 'generating' | 'preview' | 'thankyou'
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [selectedGender, setSelectedGender] = useState('female');
  const [selectedMode, setSelectedMode] = useState('avatar'); // 'theme' | 'avatar'
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [rawCapturedPhoto, setRawCapturedPhoto] = useState(null);
  const [transformedPhoto, setTransformedPhoto] = useState(null);
  const [downloadId, setDownloadId] = useState(null);
  const [mobileDownloadUrl, setMobileDownloadUrl] = useState(null);

  // Flow Handlers
  const handleStartExperience = () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}
    setCurrentScreen('gender');
  };

  // 1. Gender Selection -> Immediately show Experience Choice (Choose Theme vs Choose Avatar)
  const handleSelectGender = (gender) => {
    setSelectedGender(gender);
    setCurrentScreen('experience_choice');
  };

  // 2. Experience Choice: Theme, Avatar, or Live Mirror
  const handleSelectChoice = (choice) => {
    setSelectedMode(choice);
    if (choice === 'theme') {
      setCurrentScreen('theme_selection');
    } else if (choice === 'live_mirror') {
      window.location.hash = '#live-mirror';
      setCurrentScreen('live_mirror');
    } else {
      setCurrentScreen('profession');
    }
  };

  // 3a. Theme Selection
  const handleSelectTheme = (theme) => {
    setSelectedTheme(theme);
    setSelectedAvatar(null);
    setSelectedMode('theme');
    setCurrentScreen('capture');
  };

  // 3b. Avatar Profession Selection
  const handleSelectProfession = (avatar) => {
    setSelectedAvatar(avatar);
    setSelectedTheme(null);
    setSelectedMode('avatar');
    setCurrentScreen('capture');
  };

  // 4. Photo Captured
  const handlePhotoCaptured = (photoDataUrl) => {
    setRawCapturedPhoto(photoDataUrl);
    setCurrentScreen('generating');
  };

  // 5. Generation Complete
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

  const handleChangeSelection = () => {
    setTransformedPhoto(null);
    setDownloadId(null);
    setMobileDownloadUrl(null);
    if (selectedMode === 'theme') {
      setCurrentScreen('theme_selection');
    } else {
      setCurrentScreen('profession');
    }
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
    setSelectedTheme(null);
    setSelectedMode('avatar');
    setSelectedGender('female');
    setCurrentScreen('welcome');
  }, []);

  // Listen for #live-mirror and #3d-avatar-mirror direct routes / hash navigation
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#live-mirror') {
        setCurrentScreen('live_mirror');
      } else if (window.location.hash === '#3d-avatar-mirror') {
        setCurrentScreen('3d_avatar_mirror');
      } else if ((currentScreen === 'live_mirror' || currentScreen === '3d_avatar_mirror') && !window.location.hash) {
        setCurrentScreen('welcome');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [currentScreen]);

  const handleExitLiveMirror = () => {
    if (window.location.hash === '#live-mirror') {
      try {
        window.history.pushState(null, '', window.location.pathname);
      } catch {}
    }
    setCurrentScreen('experience_choice');
  };

  const handleExitAvatarMirror = () => {
    if (window.location.hash === '#3d-avatar-mirror') {
      try {
        window.history.pushState(null, '', window.location.pathname);
      } catch {}
    }
    setCurrentScreen('experience_choice');
  };

  // Kiosk idle safety: return to Welcome after 90s idle (inactive during mirrors & generation)
  useEffect(() => {
    if (
      currentScreen === 'welcome' ||
      currentScreen === 'generating' ||
      currentScreen === 'live_mirror' ||
      currentScreen === '3d_avatar_mirror'
    ) return;

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
      {/* Real-Time AI Mirror Screen (Constrained in 9:16 Holobox portrait frame) */}
      {currentScreen === 'live_mirror' && (
        <LiveDecartMirror onBack={handleExitLiveMirror} />
      )}

      {/* Local 3D Avatar Mirror Screen (Constrained in 9:16 Holobox portrait frame) */}
      {currentScreen === '3d_avatar_mirror' && (
        <Local3DAvatarMirror onBack={handleExitAvatarMirror} />
      )}

      {/* Screen 1 – Welcome Screen */}
      {currentScreen === 'welcome' && (
        <WelcomeScreen onStart={handleStartExperience} />
      )}

      {/* Screen 2 – Gender Selection */}
      {currentScreen === 'gender' && (
        <CategorySelection onSelectCategory={handleSelectGender} />
      )}

      {/* Screen 2.5 – Experience Choice: Choose Theme vs Choose Avatar */}
      {currentScreen === 'experience_choice' && (
        <ExperienceChoiceScreen
          selectedGender={selectedGender}
          onSelectChoice={handleSelectChoice}
          onBack={() => setCurrentScreen('gender')}
        />
      )}

      {/* Screen 3a – Theme Selection (Horror Ghost, Dragon Kingdom, Cartoon Friends, Mickey) */}
      {currentScreen === 'theme_selection' && (
        <ThemeSelectionScreen
          selectedGender={selectedGender}
          onSelectTheme={handleSelectTheme}
          onBack={() => setCurrentScreen('experience_choice')}
        />
      )}

      {/* Screen 3b – Profession Avatar Selection (5 professions + custom) */}
      {currentScreen === 'profession' && (
        <AvatarCarousel
          gender={selectedGender}
          onSelectAvatar={handleSelectProfession}
          onBack={() => setCurrentScreen('experience_choice')}
        />
      )}

      {/* Screen 4 – Camera Capture (Full-body biometric pose check & hands-free auto capture) */}
      {currentScreen === 'capture' && (
        <CameraCaptureScreen
          selectedAvatar={selectedAvatar}
          selectedTheme={selectedTheme}
          gender={selectedGender}
          onPhotoCaptured={handlePhotoCaptured}
          onBack={() => {
            if (selectedMode === 'theme') {
              setCurrentScreen('theme_selection');
            } else {
              setCurrentScreen('profession');
            }
          }}
        />
      )}

      {/* Screen 5 – AI Image Generation (Live progress & biometric pipeline) */}
      {currentScreen === 'generating' && (
        <AIGenerationScreen
          photoDataUrl={rawCapturedPhoto}
          selectedAvatar={selectedAvatar}
          selectedTheme={selectedTheme}
          selectedMode={selectedMode}
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
          selectedTheme={selectedTheme}
          selectedMode={selectedMode}
          downloadId={downloadId}
          mobileDownloadUrl={mobileDownloadUrl}
          onRestart={handleResetToWelcome}
          onChangeSelection={handleChangeSelection}
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
