@echo off
REM Local startup no longer opens ngrok. Phone and PC share Wi-Fi.
set "DEV_PORT=%~1"
if "%DEV_PORT%"=="" set "DEV_PORT=3000"
echo [restart-server] Khong mo ngrok. Dien thoai cung Wi-Fi vao dia chi duoi.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0print-lan-dev-url.ps1" -Port %DEV_PORT%
exit /b 0
