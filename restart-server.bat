@echo off
cd /d "%~dp0"
echo ========================================
echo   RESET - Dừng hết, xoa cache, khoi dong lai
echo ========================================
echo.

echo [1/5] Dung tat ca Node.js va ngrok...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
timeout /t 2 /nobreak >nul
taskkill /F /IM node.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
echo       Da dung
timeout /t 2 /nobreak >nul
echo.

echo [2/5] Xoa .next cache...
if exist ".next" (
    rmdir /s /q ".next"
    echo       .next da xoa
) else (
    echo       .next khong ton tai
)
echo.

echo [3/5] Xoa node_modules\.cache (neu co)...
if exist "node_modules\.cache" (
    rmdir /s /q "node_modules\.cache"
    echo       Cache da xoa
) else (
    echo       Khong co cache
)
echo.

echo [4/5] Khoi dong Next.js server (4GB heap)...
start "Next.js Dev Server" cmd /k "cd /d "%~dp0" && set NODE_OPTIONS=--max-old-space-size=4096 && npm run dev"
echo       Server dang khoi dong...
timeout /t 6 /nobreak >nul
echo.

echo [5/5] Khoi dong ngrok (port 3000)...
start "ngrok" cmd /k "cd /d "%~dp0" && ngrok http 3000"
echo.
echo ========================================
echo   Xong. Server va ngrok dang chay.
echo ========================================
pause
