@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
title SnipVault

echo ========================================================
echo   SnipVault - Local Snippet ^& Clipboard Vault
echo ========================================================
echo.

:: Fast check: only run pip if flask is not yet installed
python -c "import flask" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo First run detected. Installing requirements...
    python -m pip install -r requirements.txt --quiet --disable-pip-version-check
    if %ERRORLEVEL% NEQ 0 (
        echo Warning: Pip installation had warnings. Attempting to start anyway...
    )
)

echo Starting SnipVault...
echo Opening: http://localhost:5732 (or http://127.0.0.1:5732)
echo.
python app.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo 'python' command failed. Trying with 'py'...
    py app.py
)
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Could not start SnipVault.
    echo Please make sure Python 3.8+ is installed on your machine.
)
pause
