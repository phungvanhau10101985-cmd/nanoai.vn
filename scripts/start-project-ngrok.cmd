@echo off
setlocal
REM Open the stable Thu-do tunnel. 188 ngrok (3001) is a different window and is not started here.
set "DEV_PORT=%~1"
if "%DEV_PORT%"=="" set "DEV_PORT=3000"
set "NGROK_URL=https://amia-canelike-exhibitively.ngrok-free.dev"

set "NGROK_EXE="
where ngrok >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%I in ('where ngrok') do (
    set "NGROK_EXE=%%I"
    goto :have
  )
)
set "WINGET_NGROK=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"
if exist "%WINGET_NGROK%" set "NGROK_EXE=%WINGET_NGROK%"

:have
if not defined NGROK_EXE (
  echo [restart-server] Khong tim thay ngrok.exe. Cai bang: winget install Ngrok.Ngrok
  exit /b 1
)

start "NGROK Thu-do %DEV_PORT%" cmd /k ""%NGROK_EXE%" http %DEV_PORT% --url %NGROK_URL%"
exit /b 0
