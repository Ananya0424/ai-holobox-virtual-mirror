#!/usr/bin/env bash
# ==============================================================================
# Holobox Interactive Virtual Mirror - 1-Click Vast.ai / RunPod Deployment Script
# ==============================================================================
set -e

echo "============================================================"
echo "  HOLOBOX VIRTUAL MIRROR - VAST.AI 1-CLICK DEPLOYMENT"
echo "============================================================"

# Step 1: Check NVIDIA GPU
echo "[1/6] Verifying GPU..."
if command -v nvidia-smi &> /dev/null; then
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
else
    echo "WARNING: nvidia-smi not detected. Proceeding, but GPU acceleration is strongly recommended."
fi

# Step 2: System dependencies
echo "[2/6] Installing Linux system libraries..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get install -y -qq \
    curl wget git ffmpeg libgl1-mesa-glx libglib2.0-0 \
    build-essential > /dev/null 2>&1

# Step 3: Install Node.js 20 LTS if missing
if ! command -v node &> /dev/null; then
    echo "[3/6] Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null 2>&1
fi
echo "Node.js version: $(node -v) | NPM: $(npm -v)"

# Step 4: Python AI dependencies
echo "[4/6] Installing Python AI dependencies..."
pip install --upgrade pip -q
pip install -r requirements.txt -q

# Step 5: Build frontend
echo "[5/6] Installing frontend packages and building production assets..."
npm install --silent
npm run build

# Step 6: Install Cloudflare Tunnel (Linux)
if [ ! -f "./cloudflared" ]; then
    echo "[6/6] Downloading Cloudflare Tunnel for Linux..."
    curl -sL -o cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
    chmod +x cloudflared
fi

# Step 7: Launch persistent servers
echo "============================================================"
echo "  STARTING AI WORKER + KIOSK SERVER + PUBLIC TUNNEL"
echo "============================================================"

# Kill any previous instances if re-running
pkill -f "scripts/ai_worker.py" 2>/dev/null || true
pkill -f "start:kiosk" 2>/dev/null || true
pkill -f "cloudflared" 2>/dev/null || true

# Start Python GPU worker on port 5055
echo "-> Starting AI worker on 127.0.0.1:5055..."
python3 scripts/ai_worker.py > ai_worker.log 2>&1 &
WORKER_PID=$!

# Wait for worker health check
for i in {1..30}; do
    if curl -s http://127.0.0.1:5055/health | grep -q "ok"; then
        echo "   GPU AI Worker ready! (PID: $WORKER_PID)"
        break
    fi
    sleep 1
done

# Start Vite Kiosk web server on port 3000
echo "-> Starting Holobox Web Kiosk on port 3000..."
npm run start:kiosk > web_server.log 2>&1 &
WEB_PID=$!

sleep 3

# Start Cloudflare Tunnel
echo "-> Starting Cloudflare Tunnel..."
./cloudflared tunnel --url http://localhost:3000 > tunnel.log 2>&1 &
TUNNEL_PID=$!

# Extract and print public URL
echo ""
echo "Waiting for public HTTPS tunnel link..."
for i in {1..20}; do
    TUNNEL_URL=$(grep -o 'https://[-a-zA-Z0-9.]*\.trycloudflare\.com' tunnel.log 2>/dev/null | tail -n 1 || true)
    if [ -n "$TUNNEL_URL" ]; then
        echo "============================================================"
        echo "  HOLOBOX LIVE ONLINE LINK READY!"
        echo "  PUBLIC URL : $TUNNEL_URL"
        echo "============================================================"
        echo "Open this URL on your Holobox kiosk screen or any device!"
        break
    fi
    sleep 1
done

# Keep running in foreground so Vast.ai container stays active
wait $WEB_PID
