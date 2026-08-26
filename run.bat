@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
title SnipVault
echo ========================================================
echo   SnipVault - Local Snippet ^& Clipboard Vault
echo ========================================================
echo.
echo Checking requirements...
python -m pip install -r requirements.txt --quiet --disable-pip-version-check 2>nul
echo.
echo Starting SnipVault at http://127.0.0.1:5732 ...
python app.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Trying with 'py' command...
    py app.py
)
pause
