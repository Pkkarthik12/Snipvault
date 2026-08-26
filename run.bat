@echo off
REM SnipVault - quick start for Windows
echo Installing requirements...
python -m pip install -r requirements.txt
echo.
echo Starting SnipVault at http://127.0.0.1:5732
python app.py
pause
