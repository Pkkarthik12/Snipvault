#!/usr/bin/env bash
# SnipVault - quick start for macOS / Linux
set -e
echo "Installing requirements..."
python3 -m pip install -r requirements.txt
echo
echo "Starting SnipVault at http://127.0.0.1:5732"
python3 app.py
