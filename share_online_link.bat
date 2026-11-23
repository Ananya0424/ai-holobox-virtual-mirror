@echo off
title Holobox Virtual Mirror - Free Online Deployment
echo ============================================================
echo   HOLOBOX VIRTUAL MIRROR - 100%% FREE PUBLIC CLOUD TUNNEL
echo ============================================================
echo.
echo Connecting your local GPU AI & Web Server to Cloudflare...
echo.
echo [1] Kiosk server address: http://localhost:3000
echo [2] Generating your secure Public HTTPS link (trycloudflare.com)...
echo.
echo ------------------------------------------------------------
echo Neeche diye gaye link (https://...trycloudflare.com) ko 
echo kisi bhi phone ya computer par open karein:
echo ------------------------------------------------------------
echo.
.\cloudflared.exe tunnel --url http://127.0.0.1:3000
pause
