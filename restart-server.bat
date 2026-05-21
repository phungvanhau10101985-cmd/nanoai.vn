@echo off
cd /d "%~dp0"

REM Node.js (npm) — neu chua co trong PATH he thong
if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" (
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
)

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

echo [2/7] Xoa cache Next.js (.next-dev + .next)...
for %%D in (.next-dev .next) do (
    if exist "%%D" (
        attrib -r -s -h "%%D\*" /s /d >nul 2>&1
        rmdir /s /q "%%D" 2>nul
        if exist "%%D" (
            echo       [CANH BAO] Khong xoa het %%D — dong Cursor/antivirus hoac chay lai bat voi quyen Admin.
        ) else (
            echo       %%D da xoa
        )
    ) else (
        echo       %%D khong ton tai
    )
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
set "NODE_BIN=%LOCALAPPDATA%\Programs\nodejs"
if not exist "%NODE_BIN%\npm.cmd" (
    echo       [LOI] Khong tim thay npm. Cai Node.js hoac them %%LOCALAPPDATA%%\Programs\nodejs vao PATH.
    pause
    exit /b 1
)
start "Next.js Dev Server" cmd /k "cd /d "%~dp0" && set "PATH=%NODE_BIN%;%PATH%" && set NODE_OPTIONS=--max-old-space-size=4096 && set WATCHPACK_POLLING=true && npm run dev"
echo       Next.js dang khoi dong...
timeout /t 3 /nobreak >nul
start "Worksheet Worker" cmd /k "cd /d "%~dp0" && set "PATH=%NODE_BIN%;%PATH%" && npm run worker"
echo       Worker dang khoi dong...
timeout /t 5 /nobreak >nul
echo.

echo [7/7] Khoi dong ngrok (^http %DEV_PORT%^)...
where ngrok >nul 2>&1
if errorlevel 1 (
    echo       [CANH BAO] Khong tim thay ngrok trong PATH — bo qua. Dev local: http://localhost:%DEV_PORT%
) else (
    start "ngrok" cmd /k "cd /d "%~dp0" && ngrok http %DEV_PORT%"
    echo       ngrok dang khoi dong...
)
echo.
echo ========================================
echo   Xong. Next.js, Worker, ngrok dang chay.
echo ========================================
pause
