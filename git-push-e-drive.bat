@echo off
REM Chay file nay: chuot phai -> Run as administrator
cd /d "%~dp0"

set "GIT=C:\Program Files\Git\cmd\git.exe"
if not exist "%GIT%" (
    echo [LOI] Khong tim thay Git. Cai Git for Windows truoc.
    pause
    exit /b 1
)

echo [1/5] Sua quyen thu muc .git (repo copy tu o G:/ user cu)...
takeown /f ".git" /r /d y >nul 2>&1
icacls ".git" /grant "%USERNAME%:(OI)(CI)F" /t >nul 2>&1
if errorlevel 1 (
    echo       [CANH BAO] Khong sua duoc quyen .git — can chay bat nay voi quyen Administrator.
)

echo [2/5] safe.directory...
"%GIT%" config --global --add safe.directory E:/python-code/Thu-do-online

echo [3/5] git add...
"%GIT%" add -A -- . ":(exclude)nul" ":(exclude)cd"
if errorlevel 1 (
    echo [LOI] git add that bai. Thu chay lai CMD/PowerShell **Run as administrator**.
    pause
    exit /b 1
)

echo [4/5] git commit...
set "COMMIT_MSG=chore: update all current changes"
"%GIT%" diff --cached --quiet
if errorlevel 1 (
    "%GIT%" commit -m "%COMMIT_MSG%"
    if errorlevel 1 (
        echo [LOI] git commit that bai.
        "%GIT%" status -sb
        pause
        exit /b 1
    )
) else (
    "%GIT%" diff --quiet
    if not errorlevel 1 (
        echo       Khong co file thay doi — working tree clean.
        "%GIT%" status -sb
        echo.
        echo Da dong bo voi origin/main truoc do. Khong can commit/push.
        pause
        exit /b 0
    )
    echo       Chua stage — thu add lai...
    "%GIT%" add -A -- . ":(exclude)nul" ":(exclude)cd"
    "%GIT%" commit -m "%COMMIT_MSG%"
    if errorlevel 1 (
        echo [LOI] git commit that bai.
        pause
        exit /b 1
    )
)

echo [5/5] git push origin main...
"%GIT%" push origin main
if errorlevel 1 (
    echo [LOI] git push that bai — kiem tra mang / token GitHub.
    pause
    exit /b 1
)

echo.
echo Xong. main da dong bo voi origin/main.
pause
