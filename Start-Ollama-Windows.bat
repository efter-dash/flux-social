@echo off
title Start Ollama with Web Permissions (FLUX)
cls

echo ========================================================
echo   Starting Ollama with Web Permissions (Windows)
echo ========================================================
echo.

where ollama >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Ollama is not installed or not in your PATH.
    echo Please download and install Ollama for Windows from:
    echo https://ollama.com/download/windows
    echo.
    pause
    exit /b 1
)

echo [OK] Ollama detected.
echo Available models:
ollama list
echo.

echo [*] Starting Ollama server with OLLAMA_ORIGINS="*"...
echo Leave this window open in the background while using FLUX.
echo.

set OLLAMA_ORIGINS=*
ollama serve
pause
