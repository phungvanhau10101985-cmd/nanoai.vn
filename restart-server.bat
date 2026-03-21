@echo off
cd /d "%~dp0"
echo ========================================
echo   RESET - Dừng hết, xoa cache, khoi dong lai
echo ========================================
echo.

echo [1/6] Dung tat ca Node.js, tsx, ngrok...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
taskkill /F /IM tsx.exe 2>nul
timeout /t 2 /nobreak >nul
taskkill /F /IM node.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
taskkill /F /IM tsx.exe 2>nul
echo       Da dung
timeout /t 2 /nobreak >nul
echo.

echo [2/6] Xoa .next cache...
if exist ".next" (
    rmdir /s /q ".next"
    echo       .next da xoa
) else (
    echo       .next khong ton tai
)
echo.

echo [3/6] Xoa node_modules\.cache...
if exist "node_modules\.cache" (
    rmdir /s /q "node_modules\.cache"
    echo       Cache da xoa
) else (
    echo       Khong co cache
)
echo.

echo [4/6] Xoa .turbo cache (neu co)...
if exist ".turbo" (
    rmdir /s /q ".turbo"
    echo       .turbo da xoa
) else (
    echo       Khong co .turbo
)
echo.

echo [5/6] Khoi dong Next.js va Worksheet Worker...
start "Next.js Dev Server" cmd /k "cd /d "%~dp0" && set NODE_OPTIONS=--max-old-space-size=4096 && npm run dev"
echo       Next.js dang khoi dong...
timeout /t 3 /nobreak >nul
start "Worksheet Worker" cmd /k "cd /d "%~dp0" && npm run worker"
echo       Worker dang khoi dong...
timeout /t 5 /nobreak >nul
echo.

echo [6/6] Khoi dong ngrok (port 3000)...
start "ngrok" cmd /k "cd /d "%~dp0" && ngrok http 3000"
echo.
echo ========================================
echo   Xong. Next.js, Worker, ngrok dang chay.
echo ========================================
pause
