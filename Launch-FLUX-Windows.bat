@echo off
title FLUX Content Command - Windows Launcher
cls

echo ========================================================
echo   FLUX Content Command - Windows Desktop Launcher
echo ========================================================
echo.

:: Move to script's directory
cd /d "%~dp0"

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not detected on your Windows system.
    echo Please download and install Node.js (LTS version) from:
    echo https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detected:
node -v
echo.

:: Check dependencies
if not exist "node_modules\" (
    echo [*] Installing dependencies for first-time setup...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install encountered an error.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully.
    echo.
)

:: Check Ollama
echo [*] Checking local Ollama daemon on http://127.0.0.1:11434...
curl -s http://127.0.0.1:11434/api/tags >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Ollama is active! Local AI Reports ready.
) else (
    echo [INFO] Ollama is not currently running.
    echo        Run 'Start-Ollama-Windows.bat' if you want local AI reports.
)

echo.
echo [*] Starting FLUX server on http://localhost:3000...
echo [*] Opening in your default browser...
start http://localhost:3000

call npm run dev
pause
