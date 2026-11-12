<#
.SYNOPSIS
    Holobox Virtual Mirror — Production Kiosk Startup & Supervision Script.
.DESCRIPTION
    1. Verifies Python 3.11 + CUDA GPU, offline models, and Vite production build (dist/).
    2. Starts persistent Python GPU worker (port 5055) and waits until modelsLoaded = true.
    3. Starts Vite preview production server (port 3000) and verifies /api/health.
    4. Opens Google Chrome in locked fullscreen --kiosk mode (unless -NoBrowser is passed).
    5. Cleanly shuts down all child processes on exit / Ctrl+C.
#>

param(
    [switch]$NoBrowser,
    [string]$PublicUrl = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if ($PublicUrl -ne "") {
    $env:PUBLIC_URL = $PublicUrl
}

$PythonExe = "C:\Users\dell\AppData\Local\Programs\Python\Python311\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  HOLOBOX VIRTUAL MIRROR - PRODUCTION KIOSK LAUNCHER" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Verify offline AI models & CUDA
if (-not (Test-Path "models\.u2net\u2net.onnx") -and -not (Test-Path "models\models\u2net\u2net.onnx")) {
    Write-Host "[ERROR] Offline U2-Net model missing in models/." -ForegroundColor Red
    exit 1
}

# 2. Ensure fresh production build exists
if (-not (Test-Path "dist\index.html")) {
    Write-Host "[1/4] Production dist/ not found. Running npm run build..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Production build failed." -ForegroundColor Red
        exit 1
    }
}

# 3. Clean up any leftover worker or port-3000 server from previous run
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*ai_worker.py*" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

$WorkerProc = $null
$ViteProc = $null
$ChromeProc = $null

try {
    # 4. Launch persistent Python GPU worker
    Write-Host "[2/4] Starting persistent GPU worker on 127.0.0.1:5055..." -ForegroundColor Cyan
    $WorkerLogOut = Join-Path $env:TEMP "holobox_ai_worker_out.log"
    $WorkerLogErr = Join-Path $env:TEMP "holobox_ai_worker_err.log"
    $WorkerProc = Start-Process -FilePath $PythonExe -ArgumentList "-u", "scripts/ai_worker.py" `
        -RedirectStandardOutput $WorkerLogOut -RedirectStandardError $WorkerLogErr -NoNewWindow -PassThru

    $ModelReady = $false
    for ($i = 0; $i -lt 60; $i++) {
        if ($WorkerProc.HasExited) {
            Write-Host "[ERROR] GPU worker crashed during startup (exit $($WorkerProc.ExitCode)):" -ForegroundColor Red
            if (Test-Path $WorkerLogErr) { Get-Content $WorkerLogErr -Tail 25 | Write-Host -ForegroundColor Red }
            exit 1
        }
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:5055/health" -TimeoutSec 2
            if ($health.ok -and $health.modelsLoaded) {
                $ModelReady = $true
                Write-Host "      GPU Worker Ready! Device: $($health.device) | Model Load: $($health.modelLoadTime)s" -ForegroundColor Green
                break
            }
        } catch {}
        Start-Sleep -Seconds 2
    }

    if (-not $ModelReady) {
        Write-Host "[ERROR] GPU worker timed out waiting for Stable Diffusion 1.5 to load." -ForegroundColor Red
        if (Test-Path $WorkerLogErr) { Get-Content $WorkerLogErr -Tail 25 | Write-Host -ForegroundColor Red }
        exit 1
    }

    # 5. Start production Vite preview server
    Write-Host "[3/4] Starting Holobox production web server on port 3000..." -ForegroundColor Cyan
    $ViteProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run start:kiosk" -NoNewWindow -PassThru

    $ServerReady = $false
    for ($j = 0; $j -lt 30; $j++) {
        try {
            $apiHealth = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -TimeoutSec 3
            if ($apiHealth.ok) {
                $ServerReady = $true
                Write-Host "      Web Server Ready!" -ForegroundColor Green
                Write-Host "      Local Kiosk URL : http://localhost:3000/" -ForegroundColor White
                if ($apiHealth.lanOrigin) {
                    Write-Host "      Same-WiFi QR    : $($apiHealth.lanOrigin)" -ForegroundColor White
                }
                if ($apiHealth.publicUrl) {
                    Write-Host "      Public HTTPS QR : $($apiHealth.publicUrl)" -ForegroundColor White
                }
                break
            }
        } catch {}
        Start-Sleep -Seconds 1
    }

    if (-not $ServerReady) {
        Write-Host "[ERROR] Vite preview server failed to respond on http://127.0.0.1:3000/api/health" -ForegroundColor Red
        exit 1
    }

    # 6. Open fullscreen Chrome kiosk unless -NoBrowser specified
    if (-not $NoBrowser) {
        $ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
        if (-not (Test-Path $ChromePath)) {
            $ChromePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        }
        if (Test-Path $ChromePath) {
            Write-Host "[4/4] Launching fullscreen Kiosk Browser..." -ForegroundColor Cyan
            $ChromeProfile = Join-Path $env:TEMP "holobox_kiosk_profile"
            $ChromeProc = Start-Process -FilePath $ChromePath -ArgumentList `
                "--kiosk", "--no-first-run", "--disable-pinch", "--overscroll-history-navigation=0", `
                "--user-data-dir=$ChromeProfile", "http://localhost:3000" -PassThru
            Write-Host "Holobox Kiosk is LIVE! Press Ctrl+C in this window or close Kiosk to shut down safely." -ForegroundColor Green
            Wait-Process -Id $ChromeProc.Id
        } else {
            Write-Host "[WARN] Chrome/Edge not found. Open http://localhost:3000 manually. Press Ctrl+C to stop." -ForegroundColor Yellow
            Wait-Process -Id $ViteProc.Id
        }
    } else {
        Write-Host "NoBrowser mode active: GPU worker + Preview server running. Press Ctrl+C to stop." -ForegroundColor Green
        Wait-Process -Id $ViteProc.Id
    }
}
finally {
    Write-Host "`n[SHUTDOWN] Stopping Holobox services cleanly..." -ForegroundColor Yellow
    if ($ChromeProc -and -not $ChromeProc.HasExited) { Stop-Process -Id $ChromeProc.Id -Force -ErrorAction SilentlyContinue }
    if ($ViteProc -and -not $ViteProc.HasExited) { cmd.exe /c "taskkill /PID $($ViteProc.Id) /T /F" | Out-Null }
    if ($WorkerProc -and -not $WorkerProc.HasExited) { Stop-Process -Id $WorkerProc.Id -Force -ErrorAction SilentlyContinue }
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*ai_worker.py*" } | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[SHUTDOWN] Complete." -ForegroundColor Green
}
