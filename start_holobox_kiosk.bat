@echo off
title Holobox Virtual Mirror - Kiosk Launcher
echo ============================================================
echo   STARTING HOLOBOX VIRTUAL MIRROR KIOSK (GPU + WEB SERVER)
echo ============================================================
echo.

start "Chrome Kiosk" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --no-first-run http://localhost:3000
node scripts\serve_kiosk.cjs
pause
