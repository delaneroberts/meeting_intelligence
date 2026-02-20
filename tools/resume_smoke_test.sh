#!/usr/bin/env bash
# Helper to resume debugging: start backend, tail logs, and run the smoke test.
# Usage: ./tools/resume_smoke_test.sh

set -euo pipefail
ROOT_DIR="/Users/delaneroberts/meeting_intelligence"
cd "$ROOT_DIR"

echo "Activating venv if present..."
if [ -f .venv/bin/activate ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

export PYTHONPATH="$ROOT_DIR"

echo "Starting backend (logs -> /tmp/backend.log)"
./start_backend.sh > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

echo "Tailing backend log (press Ctrl-C to stop tailing, script will continue in background)"
tail -n 200 -F /tmp/backend.log &
TAIL_PID=$!

sleep 2

echo "Running smoke test upload (timeout=600s)"
python3 tools/smoke_test_upload.py ./pge1.m4a --host http://127.0.0.1:8001 --timeout 600 || true

echo "Smoke test finished (or timed out/interrupted). Backend PID: $BACKEND_PID  Tail PID: $TAIL_PID"
echo "Backend log saved at /tmp/backend.log — consider copying to ./logs/ before rebooting."
