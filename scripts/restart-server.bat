@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ========================================
echo   NanoAI - Restart Dev Server (Local)
echo ========================================
echo.

echo [1/4] Dang dong process tren port 3000...
npx kill-port 3000 >nul 2>&1

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
echo   Server: http://localhost:3000
echo   Che do: Dev (auto-bypass login)
echo.
echo ========================================
echo.

npm run dev
