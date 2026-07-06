@echo off
setlocal enabledelayedexpansion

rem Always run from the folder this file lives in
cd /d "%~dp0"

set "PORT=3000"
set "URL=http://localhost:%PORT%"

echo Checking if ChatLab is already running on port %PORT%...
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if %errorlevel%==0 (
    echo ChatLab is already running - skipping server start.
    goto :openbrowser
)

echo Starting ChatLab server...
start "ChatLab Server" /min ".venv\Scripts\python.exe" app.py

echo Waiting for the server to become ready...
set /a tries=0

:waitloop
set /a tries+=1
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if %errorlevel%==0 goto :openbrowser
if %tries% geq 15 (
    echo.
    echo ChatLab did not start within 15 seconds.
    echo Check the "ChatLab Server" window for error messages.
    echo.
    pause
    exit /b 1
)
goto :waitloop

:openbrowser
echo Opening ChatLab in your browser...
start "" "%URL%"

echo Done. You can close this window.
ping -n 4 127.0.0.1 >nul
endlocal
