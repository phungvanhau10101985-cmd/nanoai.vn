@echo off
cd /d "%~dp0"

REM Node.js (npm) — neu chua co trong PATH he thong
if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" (
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
)

REM Next.js dev mac dinh 3000. Neu ban dat PORT trong .env.local khac — sua DEV_PORT cho trung.
REM 188-com-vn local: backend 8001 + frontend 3001 — KHONG bi script nay kill (xem scripts/restart-server-stop-dev.ps1).
set "DEV_PORT=3000"
if exist ".env.local" (
    for /f "usebackq tokens=1,2 delims==" %%A in (`findstr /i /r "^PORT=" ".env.local" 2^>nul`) do (
        set "DEV_PORT=%%B"
    )
)

echo ========================================
echo   RESET - Thu-do-online (khong anh huong 188-com-vn)
echo ========================================
echo.

echo [1/7] Giai phong dev Thu-do ^(PORT=%DEV_PORT% only — 188 giu 8001/3001^)...
REM Do not pass -ProjectRoot "%~dp0" — trailing \ before " breaks PowerShell quoting.
REM Script defaults ProjectRoot to parent of scripts\ (this repo root).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\restart-server-stop-dev.ps1" -DevPort %DEV_PORT%
echo       Da dung process Thu-do tren port %DEV_PORT% + ngrok forward %DEV_PORT%
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

echo [7/7] Khoi dong ngrok (^http %DEV_PORT%^ — chi tunnel Thu-do^)...
where ngrok >nul 2>&1
if errorlevel 1 (
    echo       [CANH BAO] Khong tim thay ngrok trong PATH — bo qua. Dev local: http://localhost:%DEV_PORT%
) else (
    start "NGROK Thu-do %DEV_PORT%" cmd /k "cd /d "%~dp0" && ngrok http %DEV_PORT%"
    echo       ngrok Thu-do dang khoi dong (188 ngrok 3001 khong bi dong)...
)
echo.
echo ========================================
echo   Xong. Thu-do: Next.js, Worker, ngrok :%DEV_PORT%
echo   188-com-vn (8001/3001) — khong bi anh huong boi script nay.
echo ========================================
pause
