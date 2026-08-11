@echo off
chcp 65001 >nul
cd /d "%~dp0.."

set "DEV_PORT=3000"
if exist ".env.local" (
    for /f "usebackq tokens=1,2 delims==" %%A in (`findstr /i /r "^PORT=" ".env.local" 2^>nul`) do (
        set "DEV_PORT=%%B"
    )
)

echo ========================================
echo   NanoAI - Restart Dev Server (Local)
echo   An toan voi 188-com-vn (8001/3001)
echo ========================================
echo.

echo [1/4] Dang dong dev Thu-do tren port %DEV_PORT%...
REM ProjectRoot defaults to parent of this scripts\ folder (repo root).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0restart-server-stop-dev.ps1" -DevPort %DEV_PORT%

echo [2/4] Kiem tra .env.local...
if not exist ".env.local" (
    if exist ".env.local.dev" (
        copy ".env.local.dev" ".env.local" >nul
        echo        Da copy .env.local.dev -^> .env.local
    )
) else (
    echo        .env.local da ton tai
)

echo [3/4] Xoa cache Next.js...
if exist ".next-dev" rmdir /s /q ".next-dev" >nul 2>&1
if exist ".next" rmdir /s /q ".next" >nul 2>&1

echo [4/4] Khoi dong dev server...
echo.
echo   Server: http://localhost:%DEV_PORT%
echo   Che do: Dev (auto-bypass login)
echo.
echo ========================================
echo.

npm run dev
