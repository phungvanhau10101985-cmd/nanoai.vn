@echo off
cd /d "%~dp0"

REM Next.js dev mac dinh 3000. Neu ban dat PORT trong .env.local khac — sua DEV_PORT cho trung nhau voi dong lenh npm run dev.
set "DEV_PORT=3000"
REM Dashboard ngrok (mac dinh 4040). Chi giai phong khi ngrok LISTEN tai cong nay.
set "NGROK_UI_PORT=4040"

echo ========================================
echo   RESET - Dừng hết, xoa cache, khoi dong lai
echo ========================================
echo.

echo [1/7] Giai phong cong du an ^(Next.js PORT=%DEV_PORT%, ngrok UI=%NGROK_UI_PORT%^)...
REM Khong tat het node/ngrok/tsx — chi kill process LISTEN tai cac cong tren, va dong cua so dev neu con mo.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ports=@(%DEV_PORT%,%NGROK_UI_PORT%);foreach($po in $ports){Get-NetTCPConnection -LocalPort $po -ErrorAction SilentlyContinue|Where-Object{$_.State -eq 'Listen'}|Select-Object -ExpandProperty OwningProcess -Unique|ForEach-Object{Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue}}"
taskkill /F /FI "WINDOWTITLE eq Next.js Dev Server*" 2>nul
taskkill /F /FI "WINDOWTITLE eq Worksheet Worker*" 2>nul
taskkill /F /FI "WINDOWTITLE eq ngrok*" 2>nul
REM Worksheet Worker (tsx) thuong khong mo cong listening — dong bang tieu de cua so neu script da start truoc do.
echo       Da dung tien trinh LISTEN tai cong du an va cua so dev/worker/ngrok
timeout /t 2 /nobreak >nul
echo.

echo [2/7] Xoa .next cache...
if exist ".next" (
    rmdir /s /q ".next"
    echo       .next da xoa
) else (
    echo       .next khong ton tai
)
echo.

echo [3/7] Xoa node_modules\.cache...
if exist "node_modules\.cache" (
    rmdir /s /q "node_modules\.cache"
    echo       Cache da xoa
) else (
    echo       Khong co cache
)
echo.

echo [4/7] Xoa .turbo cache (neu co)...
if exist ".turbo" (
    rmdir /s /q ".turbo"
    echo       .turbo da xoa
) else (
    echo       Khong co .turbo
)
echo.

echo [5/7] Chay migration DB (them/sua bang)...
call npm run db:migrate:push
if errorlevel 1 (
    echo       [CANH BAO] Migration co loi. Van tiep tuc khoi dong server.
) else (
    echo       Migration hoan tat.
)
echo.

echo [6/7] Chay lai npm run dev + Worksheet Worker...
start "Next.js Dev Server" cmd /k "cd /d "%~dp0" && set NODE_OPTIONS=--max-old-space-size=4096 && npm run dev"
echo       Next.js dang khoi dong...
timeout /t 3 /nobreak >nul
start "Worksheet Worker" cmd /k "cd /d "%~dp0" && npm run worker"
echo       Worker dang khoi dong...
timeout /t 5 /nobreak >nul
echo.

echo [7/7] Khoi dong ngrok (^http %DEV_PORT%^)...
start "ngrok" cmd /k "cd /d "%~dp0" && ngrok http %DEV_PORT%"
echo.
echo ========================================
echo   Xong. Next.js, Worker, ngrok dang chay.
echo ========================================
pause
