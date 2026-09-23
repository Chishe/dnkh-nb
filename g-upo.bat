@echo off
setlocal

set "APP_DIR=C:\Users\kmjj\Documents\Dashboard_20250827"
set "ECOSYSTEM_FILE=%APP_DIR%\ecosystem.config.js"
set "PM2_CMD=C:\Users\kmjj\AppData\Roaming\npm\pm2.cmd"

if not exist "%PM2_CMD%" (
    echo [ERROR] PM2 was not found in PATH.
    echo Install it with: npm install -g pm2
    pause
    exit /b 1
)

if not exist "%ECOSYSTEM_FILE%" (
    echo [ERROR] Ecosystem file not found:
    echo %ECOSYSTEM_FILE%
    pause
    exit /b 1
)

cd /d "%APP_DIR%"
call "%PM2_CMD%" describe denso-qc-dashboard >nul 2>&1

if errorlevel 1 (
    echo Starting denso-qc-dashboard...
    call "%PM2_CMD%" start "%ECOSYSTEM_FILE%" --env production
) else (
    echo Restarting denso-qc-dashboard...
    call "%PM2_CMD%" restart "%ECOSYSTEM_FILE%" --env production --update-env
)

if errorlevel 1 (
    echo [ERROR] PM2 could not start the application.
    pause
    exit /b 1
)

call "%PM2_CMD%" save
call "%PM2_CMD%" status

echo.
echo Dashboard is running at http://192.168.2.104:8889
pause
endlocal
