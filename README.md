# 🪞 AI-Powered Interactive Virtual Mirror (Holobox)

An AI-powered Interactive Virtual Mirror built for **Holobox hardware, touch kiosks, and exhibition displays**. 

When a user stands in front of the mirror, the camera captures their photo, detects their pose (like raising a hand or waving), and generates a photorealistic portrait of the user wearing different professional uniforms (Doctor, Pilot, Astronaut, etc.) or any custom outfit they want—keeping their **real face, glasses, and exact pose intact** in just **12–15 seconds**!

---

## 🚀 How the Mirror Works (Simple Step-by-Step)

```text
1. User stands in front of the Holobox Mirror.
                │
                ▼
2. Camera starts a 20-second countdown with an on-screen body guide.
                │
                ▼
3. User selects an outfit (or types/speaks a custom look).
                │
                ▼
4. AI detects user's face and live pose (e.g., Hand Up).
                │
                ▼
5. Stable Diffusion generates the uniform around the user's real face in their exact pose.
                │
                ▼
6. System removes room background and adds a soft floor shadow under the shoes.
                │
                ▼
7. User scans the QR code with their mobile phone to download and save their portrait!
```

---

## 🧠 AI Models Used & What They Do

Here is the list of all AI models used in this project, explained in simple words:

| # | Model Name | Simple Explanation | What it Does in this Project |
|---|---|---|---|
| **1** | **Stable Diffusion 1.5** | AI Image Generator | Draws the realistic clothing, fabric textures, and studio lighting (e.g., Doctor white coat, Pilot uniform, Astronaut suit). |
| **2** | **IP-Adapter FaceID-PlusV2** | Face Transfer Tool | Locks the user's **real face, eyes, smile, and glasses** onto the new uniform so the photo looks genuinely like them. |
| **3** | **InsightFace (Buffalo_L)** | Face Scanner | Scans the webcam photo and measures facial features into mathematical data so FaceID knows where the eyes, nose, and lips are. |
| **4** | **ControlNet OpenPose** | Body Skeleton Controller | Makes sure the AI body stands naturally with realistic human proportions (correct arms, shoulders, and legs). |
| **5** | **MediaPipe Pose** | Live Gesture Detector | Detects the user's live physical poses (like **Hand Raised**, waving, or pointing) and makes the AI generate the person in that exact same pose. |
| **6** | **BiRefNet / Rembg** | Background Remover | Cuts out the user cleanly from the room background and places them on a clean white studio canvas. |

---

## 🌐 Cloud APIs Used

* **Google Gemini AI API (`gemini-flash-lite-latest`)**:
  - Used for the **"Customize Your Look"** feature.
  - When a user speaks or types an outfit idea (like *"Royal Wedding Sherwani"* or *"Master Chef"*), Gemini understands the request and creates a creative title and holographic compliment.
* **Web Speech API**:
  - Allows users to speak into the mirror's microphone instead of typing.

---

## ✨ Key Features of the Mirror

### 1. 🙋‍♀️ Dynamic Pose Transfer (Hand Raised / Gestures)
- The user does not have to stand like a statue.
- If the user raises their hand or makes a gesture in front of the camera, the generated AI doctor or pilot will also have their hand raised in that **exact pose**!

### 2. 👟 Grounded Studio Floor Shadow
- Most AI cutouts look like they are floating in mid-air.
- Our system calculates the exact position of the shoes and paints a realistic **soft dark contact shadow** on the floor so the person looks firmly grounded in the studio.

### 3. 🎯 Easy Camera Framing & 20s Timer
- An elegant **Face & Shoulder Guide** appears on the screen so the user knows where to stand.
- A **20-second countdown timer** gives the user plenty of time to get ready and pose.

### 4. 🎨 "Customize Your Look" (Any Outfit in the World)
- Along with the 5 standard professions (Doctor, Pilot, Astronaut, Police, Business), users can choose **"Customize Your Look (?)"** to try **any outfit**:
  - **Voice Input:** Tap the blue mic icon and speak your outfit.
  - **Touch Keyboard:** Tap the box and type on the screen.
  - **Quick Buttons:** Tap one of the ready-made buttons (*Royal Traditional, Master Chef, F1 Racer, Luxury Trench, Rock Musician, Martial Artist*).

### 5. 📱 30-Second Mobile QR Download
- When the photo is ready, a QR code appears on screen.
- A **30-second timer** runs while the user scans it with their phone camera.
- If the user needs more time, they can tap **`+30s More`** to keep the QR code open.
- When time is up, the screen gives two clear options:
  - **`Scan Again (+30s More)`**: Re-opens the QR code if their scan didn't finish.
  - **`Start New Session`**: Resets the mirror for the next person in line.

---

## 💻 Hardware Requirements

To run this AI pipeline fast (12–15 seconds per photo), the following hardware is needed:

* **GPU:** NVIDIA Graphics Card with at least **6 GB VRAM** (e.g. RTX 3050, RTX 3060, or higher).
* **RAM:** 12 GB – 16 GB System RAM.
* **Storage:** 30 GB SSD space (to store the offline 15 GB AI models).
* **Camera:** HD Webcam (1080p).
* **Operating System:** Windows 10/11 or Ubuntu Linux.

> **Why Free Hosting (like Render or Vercel) does not work:**  
> Free websites only give 512 MB memory and zero graphics cards (GPU). Loading 15 GB AI models causes free cloud servers to crash immediately. Running it on the local NVIDIA laptop GPU is the best, fastest, and 100% free solution.

---

## 🚀 How to Start the Mirror

### 1. Run on Local Kiosk (1-Click)
In the project folder, simply double-click:
```bat
start_holobox_kiosk.bat
```
This automatically starts the AI GPU worker and opens the Holobox interface at `http://localhost:3000`.

### 2. Share Live Online for Free (Cloudflare Tunnel)
If you want to open the mirror on a phone or another screen over the internet for free:
1. Double-click `start_holobox_kiosk.bat`.
2. Double-click `share_online_link.bat`.
3. It will give you a public link (like `https://...trycloudflare.com`) that works anywhere in the world!

---

## 📁 Main Files in the Project

* `scripts/ai_worker.py`: Background Python service that keeps AI models loaded in GPU memory for fast generation.
* `scripts/ai_transform.py`: The core AI pipeline (Stable Diffusion + FaceID + OpenPose + Studio Shadow).
* `scripts/face_identity.py`: Code for InsightFace recognition and MediaPipe pose tracking.
* `src/components/CameraCaptureScreen.jsx`: Camera screen with 20s timer and body guide.
* `src/components/PhotoPreview.jsx`: Final photo display with QR code and 30s timer.
* `src/components/CustomLookPrompt.jsx`: Popup modal for typing or speaking custom outfit ideas.
* `start_holobox_kiosk.bat`: 1-click file to launch the mirror.
* `share_online_link.bat`: 1-click file to get a free live public web link.

---

## 👩‍💻 Credits

* **Project:** AI-Powered Interactive Virtual Mirror
* **Developer:** Ananya Sharma
* **Built With:** PyTorch, Diffusers, InsightFace, MediaPipe, React, Vite, Cloudflare
