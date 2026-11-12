# Holobox Virtual Mirror — Hardware Integration & Deployment Guide

## 1. System & Hardware Requirements
- **OS:** Windows 10 / 11 (64-bit)
- **GPU:** NVIDIA GeForce RTX 3050 6GB Laptop GPU or higher (CUDA 12.1, ~2.4 GB peak VRAM used)
- **RAM / Storage:** 16 GB RAM recommended; ~4 GB free disk for cached FP16 Stable Diffusion weights + offline U2-Net ONNX
- **Display:** Portrait 9:16 touch display (`1080×1920` or `2160×3840`) set to **Portrait** orientation in Windows Display Settings (`touch-action: manipulation`, no scrollbars)
- **Camera:** USB HD/Full-HD webcam (`1080×1920` portrait preferred, or `1280×720` landscape fallback)
- **Python Environment:** Python 3.11 (`C:\Users\dell\AppData\Local\Programs\Python\Python311\python.exe`) with `torch==2.5.1+cu121`, `diffusers==0.31.0`, `transformers==4.45.2`, `onnxruntime`, `scipy`, `Pillow`, `numpy`
- **Power Setting (Critical):** Keep the kiosk laptop/PC **plugged into AC power** in Balanced/Performance mode. Battery power caps the GPU to ~20W TDP, slowing generation from ~11s to ~25–30s.

---

## 2. Camera Setup & Calibration Instructions
1. **Physical Mounting:** Mount the webcam centered at chest/eye height (~1.4m–1.55m above floor) behind/on the Holobox frame.
2. **Standing Floor Marker:** Place a floor footprint marker **1.8m–2.5m** in front of the Holobox camera so a standing person fits completely from **head to shoes** inside the dashed full-body guide on Screen 4 (`CameraCaptureScreen`).
3. **Lighting & Backdrop:** Use bright, even front/overhead lighting facing the guest and avoid busy patterns or harsh backlighting directly behind the guest's shoulders for cleanest U2-Net studio isolation.
4. **Permissions & Recovery:** Always open the kiosk UI on `http://localhost:3000` (Chromium allows camera access without HTTPS on `localhost`). Grant webcam permission once; if the USB camera is bumped/unplugged, `CameraCaptureScreen` stops any active countdown, prompts reconnection, and automatically recovers when plugged back in.

---

## 3. Exact Production Startup Instructions

### One-Command Production Kiosk Launch (Recommended)
```powershell
npm run build
npm run kiosk:launch
```
What [`scripts/start_holobox_kiosk.ps1`](file:///c:/Users/dell/Downloads/Web%20Projects/AI-powered%20Interactive%20Virtual%20Mirror/scripts/start_holobox_kiosk.ps1) does automatically:
1. Verifies offline U2-Net model and `dist/` build.
2. Starts the persistent Python GPU worker (`127.0.0.1:5055`) and waits until `/health` reports `modelsLoaded: true` (shows exact stderr logs and exits cleanly if the GPU worker fails).
3. Starts the production Vite preview server (`0.0.0.0:3000`) and verifies `/api/health`.
4. Launches Google Chrome in locked fullscreen `--kiosk` mode (`--disable-pinch --overscroll-history-navigation=0`).
5. Safely shuts down Chrome, Vite preview, and the Python GPU worker when closed or on `Ctrl+C`.

*(Headless / server-only startup without opening Chrome: `powershell -ExecutionPolicy Bypass -File scripts/start_holobox_kiosk.ps1 -NoBrowser`)*

---

## 4. Network & QR Download Configuration

### Mode 1 — Same-Wi-Fi / Venue Hotspot (LAN HTTP)
- Phones connected to the **same Wi-Fi** as the Holobox PC receive QR links formatted automatically as:
  `http://<LAN_IP>:3000/download/transform_<id>.jpg`
- **Windows Firewall Rule (Run PowerShell as Administrator once):**
  ```powershell
  New-NetFirewallRule -DisplayName "Holobox Kiosk Port 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
  ```
- Confirm Windows Wi-Fi network profile is set to **Private** (not Public).

### Mode 2 — Public HTTPS Access (Phones on 4G/5G Mobile Data)
Guests on cellular data cannot reach a private `192.168.x.x` IP. Expose port `3000` through an HTTPS tunnel and pass `PUBLIC_URL`:
1. Start Cloudflare Quick Tunnel (or ngrok / domain reverse proxy):
   ```powershell
   cloudflared tunnel --url http://localhost:3000
   ```
2. Launch the kiosk with the generated HTTPS URL:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/start_holobox_kiosk.ps1 -PublicUrl "https://your-tunnel-url.trycloudflare.com"
   ```
   *(Or set `PUBLIC_URL=https://...` in environment before running `npm run start:kiosk`.)*

---

## 5. Session Privacy & Kiosk Reliability
- Every completed session (`Finish` or 30s Preview countdown → 3s Thank You) clears user photo/avatar/gender state and returns to Screen 1 (`Welcome`).
- Any abandoned mid-session screen resets automatically after **90 seconds** of inactivity.
- Right-click context menu, image dragging, pull-to-refresh, and `Backspace`/`Alt+Arrow` browser back navigation are disabled.
- Old captured files in `public/captured/` older than **2 hours** are automatically purged on new requests.

---

## 6. Physical Holobox Venue Checklist (Before Going Live)
- [ ] Laptop/PC connected to **AC power** and portrait **9:16 touchscreen** (`1080×1920`).
- [ ] Run `npm run kiosk:launch` and confirm GPU Worker Ready on `cuda`.
- [ ] Stand on floor marker (~2m back) and verify head, hands, and shoes align inside the Screen 4 full-body silhouette.
- [ ] Capture a test session, verify live GPU progress (`22%..88%`), white studio result, and floating profession badges.
- [ ] Scan the generated QR code with a **real smartphone** (test both Venue Wi-Fi and Mobile Data if using `PUBLIC_URL`) and confirm the JPG opens and saves.
- [ ] Verify 3s Thank You auto-reset returns cleanly to Welcome with zero previous-user photo visible.
