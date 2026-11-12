# AI-Powered Interactive Holobox Virtual Mirror

A premium, futuristic, portrait-oriented (9:16) AI-powered Interactive Virtual Mirror web application designed for kiosk enclosures, Holobox hardware, and modern browsers.

---

## 🌟 Key Highlights & Features

1. **9:16 Portrait Kiosk Design**
   - Strictly engineered in vertical portrait orientation (9:16).
   - Off-white/bright holographic aesthetic (`#f8fafc`, `#ffffff`) with glowing cyan (`#38bdf8`) and subtle purple (`#8b5cf6`) accents.
   - Fluid glassmorphism, animated holographic reticles, and subtle floating particles.

2. **Welcome Screen with Looping Promotional Video**
   - Autonomous looping background video (`/promo-video.mp4`).
   - Separate, interactive web **START** button with sound synthesis and particle glow.

3. **Manual Gender Category Selection**
   - Large interactive cards for **Male** and **Female** collections.
   - Manual user selection without intrusive automated classification.

4. **Real Full-Body Biometric Scanning**
   - Browser camera access via `navigator.mediaDevices.getUserMedia`.
   - MediaPipe Pose skeleton detection with real-time landmark tracking.
   - Calculates anatomical proportions: estimated height, shoulder width ratio, torso index, arm span, and posture alignment.
   - Animated holographic laser beam and progress gauge with sound cues.

5. **Horizontal Avatar Carousel with 6th Custom Look (?)**
   - Male Collection: Pilot, Doctor, Astronaut, Police Officer, Business Professional.
   - Female Collection: Air Hostess, Doctor, Astronaut, Pilot, Business Professional.
   - **6th Option ("? Custom Look")**: Appears seamlessly alongside the other 5 cards with the identical card size and style.
   - Selecting "?" opens the **AI Custom Look Prompt Modal** featuring:
     - Text input field
     - Microphone button powered by the Web Speech API (`SpeechRecognition`)
     - Smart NLP prompt parser that configures the corresponding 3D avatar wardrobe and color styling.

6. **Live Mirror Experience (Three.js 3D Rigged Humanoid Avatar)**
   - Three.js WebGL 3D humanoid avatar with skeletal bone hierarchy.
   - Real-time skeleton retargeting driven by MediaPipe Pose landmarks (mirrors user's arms, head tilt, torso sway, and posture).
   - Dynamic 3D profession wardrobe equipping (doctor coats, spacesuits, captain uniforms, tactical vests, power suits).
   - User identity preservation via live video face projection and proportional bone scaling, with clear in-app technical documentation on client browser vs cloud neural mesh limits.

7. **Profession-Based Dynamic Holographic 3D Decorations**
   - Left and right flanking 3D elements that float, bob, rotate, and never obstruct the user:
     - **Doctor**: Medical crosses, pulsing ECG heartbeat line, rotating DNA double-helix.
     - **Astronaut**: Revolving Saturn-ringed planet, celestial orbit rings, satellite, twinkling star particles.
     - **Pilot**: Supersonic aircraft silhouettes, heading compass, altitude ladder lines.
     - **Air Hostess**: Holographic wireframe globe, travel waypoint ring, mini plane, luggage silhouette.
     - **Police Officer**: 3D glowing protective shields, tactical blue & amber particle streams.
     - **Business**: Minimalist floating glass prisms, rotating polyhedra, financial stock trend line.
     - **Custom**: Dual-toned cyber polyhedra and energetic particle fountains.

8. **Photo Capture with 5-Second Countdown**
   - Shutter button triggers a 5-second countdown HUD with synthesized audio beeps.
   - Camera flash screen effect and high-resolution canvas capture.

9. **Side-by-Side Photo Preview & Real QR Code Generator**
   - Displays captured photo on the same screen with two main buttons:
     - **Retake**: Returns to the live mirror while preserving the chosen avatar and outfit.
     - **Scan**: Generates a real, scannable QR code on the **SAME SCREEN** without page redirection.
   - Instant file download button for testing.

10. **30-Second Timeout & End Screen**
    - 30-second live expiration timer on the QR code.
    - Transitions to *"Thank You for Experiencing Holobox!"*.
    - Automatically returns to the Welcome Screen and restarts the looping video for the next visitor.

---

## 📁 Project Architecture & File Structure

```
AI-powered Interactive Virtual Mirror/
├── index.html                   # HTML entry point, fonts, & MediaPipe scripts
├── package.json                 # Dependencies (React, Three.js, Lucide, QRCode, Vite)
├── vite.config.js               # Vite bundler configuration (port 3000)
├── public/
│   └── promo-video.mp4          # Generated 9:16 looping futuristic promotional video
├── scripts/
│   └── generate_promo_video.js  # Node.js + FFmpeg video generation utility
└── src/
    ├── main.jsx                 # React root renderer
    ├── App.jsx                  # Main kiosk state machine & screen orchestrator
    ├── components/
    │   ├── KioskFrame.jsx       # 9:16 vertical viewport frame, holographic corners & HUD
    │   ├── WelcomeScreen.jsx    # Looping video background + separate START button
    │   ├── CategorySelection.jsx# Male / Female manual selection cards
    │   ├── CameraScanner.jsx    # Real-time camera scanner & proportion estimator
    │   ├── AvatarCarousel.jsx   # Horizontal carousel (5 avatars + 6th '?' card)
    │   ├── CustomLookPrompt.jsx # Voice/text input modal for custom persona
    │   ├── LiveMirror.jsx       # Full-body 3D live mirror viewport
    │   ├── AvatarRenderer.js    # Three.js 3D rigged humanoid skeleton & wardrobes
    │   ├── DynamicDecorations.js# 3D animated profession decorations (left & right)
    │   ├── PhotoCapture.jsx     # 5-second countdown & flash overlay
    │   ├── PhotoPreview.jsx     # Side-by-side photo preview & real QR code generator
    │   └── ThankYouScreen.jsx   # 30-second timeout thank-you screen
    ├── utils/
    │   ├── audio.js             # Synthesized Web Audio API sound effects (zero files needed)
    │   ├── avatarData.js        # Avatar definitions, badges, & NLP prompt parser
    │   └── poseDetector.js      # MediaPipe Pose tracking & smoothing engine
    └── styles/
        ├── kiosk.css            # 9:16 aspect ratio enclosure & holographic borders
        └── index.css            # Screen-specific styles, glassmorphism, animations
```

---

## 🚀 How to Run the Application

1. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

2. **Start the local development server**:
   ```bash
   npm run dev
   ```

3. **Open in your browser**:
   Navigate to `http://localhost:3000` (or the URL output by Vite).

4. **Production Build**:
   ```bash
   npm run build
   ```
