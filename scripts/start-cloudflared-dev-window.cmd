@echo off
REM Cua so tunnel cho restart-server. Giu mo. Khong dung vao cong 188 (8001/3001).
title Cloudflare Tunnel Thu-do
set "DEV_PORT=%~1"
set "METRICS_PORT=%~2"
if "%DEV_PORT%"=="" set "DEV_PORT=3000"
if "%METRICS_PORT%"=="" set "METRICS_PORT=20241"
set "EXE=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
if not exist "%EXE%" set "EXE=%ProgramFiles%\cloudflared\cloudflared.exe"
if not exist "%EXE%" (
    echo [LOI] Khong tim thay cloudflared.exe
    echo Cai: winget install --id Cloudflare.cloudflared -e
    pause
    exit /b 1
)
set "CF_LOG=C:\Windows\Temp\thu-do-cloudflared-dev.log"
echo Tunnel Thu-do -^> http://127.0.0.1:%DEV_PORT%
echo Metrics: http://127.0.0.1:%METRICS_PORT%/metrics
echo.
"%EXE%" tunnel --url http://127.0.0.1:%DEV_PORT% --metrics 127.0.0.1:%METRICS_PORT% --logfile "%CF_LOG%"
echo.
echo Tunnel da dung. Xem log: %CF_LOG%
pause
