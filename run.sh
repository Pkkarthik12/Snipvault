#!/usr/bin/env bash
# SnipVault - quick start for macOS / Linux
echo "========================================================"
echo "  SnipVault - Local Snippet & Clipboard Vault"
echo "========================================================"
echo ""
echo "Checking requirements..."
python3 -m pip install -r requirements.txt --quiet --disable-pip-version-check 2>/dev/null || true
echo ""
echo "Starting SnipVault at http://127.0.0.1:5732 ..."
python3 app.py
