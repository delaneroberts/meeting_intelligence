#!/usr/bin/env bash
# Use .venv313 (Python 3.13) for WhisperX support; fall back to .venv if missing
cd "$(dirname "$0")"
if [ -d .venv313 ]; then
  source .venv313/bin/activate
else
  source .venv/bin/activate
fi
python app.py
