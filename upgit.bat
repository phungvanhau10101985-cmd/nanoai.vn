@echo off
cd /d "%~dp0"

REM Node.js (neu can npm trong PATH)
if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" (
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
)

git add -A -- . ":(exclude)nul" ":(exclude)cd"
if errorlevel 1 (
    echo [LOI] git add that bai.
    pause
    exit /b 1
)

git diff --cached --quiet
if not errorlevel 1 (
    echo Khong co thay doi de commit.
    pause
    exit /b 0
)

git commit -m "chore: update all current changes"
if errorlevel 1 (
    echo [LOI] git commit that bai.
    pause
    exit /b 1
)

git push -u origin main
if errorlevel 1 (
    echo [LOI] git push that bai.
    pause
    exit /b 1
)

echo.
echo Xong: da push len origin main.
pause
