@echo off
REM ============================================================
REM  dev-clear-start.bat — DEV LOCAL **188.com.vn** (dat file nay trong repo 188).
REM  Dat ca .bat va .ps1 vao ROOT repo LOCAL cua ban (188 — khong nhung vao Thu-do-online).
REM
REM  Lan dau tien trong repo LOCAL: tao file rong `.dev-clear-start-marker-188` tai cung thu muc voi .bat day.
REM
REM  - Chi giai phong LISTEN tren BACKEND_PORT + FRONTEND_PORT (mac dinh 8001 + 3001; set bien moi truong de doi).
REM  - Mac dinh canh bao khi BACKEND_PORT/FRONTEND_PORT trung 3000 hoac 4040 (Thu-do-online local). Co the them:
REM       set THU_DO_BLOCK_PORTS=<portThuDo1>,<portThuDo2>
REM  - Chi tat ngrok khi dong lenh CLI forward trung FrontendPort (khong kill ngrok Thu-do tai 3000).
REM  - Khoi dong backend uvicorn + Next + ngrok (tuy chon)
REM
REM  Cach dung:
REM    dev-clear-start.bat
REM    dev-clear-start.bat -KillAllNode
REM    dev-clear-start.bat -NoNgrok
REM    dev-clear-start.bat -OnlyClean
REM    dev-clear-start.bat -AllowOverlapWithThuDoPorts  (tat canh bao khi gan 3000/4040 — rat can than)
REM    dev-clear-start.bat -Bypass188MarkerCheck       (ngoai le; de mac dinh trong repo 188 chi can file marker)
REM ============================================================

chcp 65001 >nul
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-clear-start.ps1" %*

set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" (
    echo.
    echo [!] Script ket thuc voi loi %EC%.
    pause
)

exit /b %EC%
