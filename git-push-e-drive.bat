@echo off
REM Chay file nay: chuot phai -> Run as administrator
REM Dong Cursor truoc khi chay (tranh khoa .git\objects\pack).
cd /d "%~dp0"

set "GIT=C:\Program Files\Git\cmd\git.exe"
if not exist "%GIT%" (
    echo [LOI] Khong tim thay Git. Cai Git for Windows truoc.
    pause
    exit /b 1
)

set GIT_OPTIONAL_LOCKS=0

echo [0/6] Giai phong khoa .git (tat git.exe dang chay)...
taskkill /F /IM git.exe 2>nul
taskkill /F /IM git-remote-https.exe 2>nul
taskkill /F /IM git-credential-manager.exe 2>nul
timeout /t 2 /nobreak >nul

echo [1/6] Sua quyen thu muc .git (repo copy tu o G:/ user cu)...
takeown /f ".git" /r /d y >nul 2>&1
icacls ".git" /grant "%USERNAME%:(OI)(CI)F" /t >nul 2>&1
if errorlevel 1 (
    echo       [CANH BAO] Khong sua duoc quyen .git — can chay bat nay voi quyen Administrator.
)

echo [2/6] safe.directory + tat gc tu dong (tranh repack khoa pack tren Windows)...
"%GIT%" config --global --add safe.directory E:/python-code/Thu-do-online
"%GIT%" config gc.auto 0

echo [3/6] git add...
"%GIT%" add -A -- . ":(exclude)nul" ":(exclude)cd"
if errorlevel 1 (
    echo [LOI] git add that bai. Dong Cursor, chay lai CMD **Run as administrator**.
    pause
    exit /b 1
)

echo [4/6] git commit...
set "COMMIT_MSG=chore: update all current changes"
"%GIT%" diff --cached --quiet
if errorlevel 1 (
    "%GIT%" -c gc.auto=0 commit -m "%COMMIT_MSG%"
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
        echo Da dong bo voi origin/main. Khong can commit/push.
        pause
        exit /b 0
    )
    echo       Chua stage — thu add lai...
    "%GIT%" add -A -- . ":(exclude)nul" ":(exclude)cd"
    "%GIT%" -c gc.auto=0 commit -m "%COMMIT_MSG%"
    if errorlevel 1 (
        echo [LOI] git commit that bai.
        pause
        exit /b 1
    )
)

echo [5/6] git push origin main...
"%GIT%" push origin main
if errorlevel 1 (
    echo [LOI] git push that bai — kiem tra mang / token GitHub.
    pause
    exit /b 1
)

echo [6/6] Kiem tra...
"%GIT%" status -sb

echo.
echo Xong. main da dong bo voi origin/main.
pause
