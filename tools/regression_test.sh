#!/usr/bin/env bash
# Regression test: run backend unit tests and optionally smoke test against a running server.
# Usage:
#   ./tools/regression_test.sh              # unit tests only
#   ./tools/regression_test.sh --smoke      # unit tests + smoke test (requires backend running + audio file)
#   ./tools/regression_test.sh --smoke path/to/short.m4a  # smoke test with specific file

set -e
cd "$(dirname "$0")/.."

echo "=== Backend unit tests (pytest) ==="
python -m pytest tests/ -v --tb=short
echo ""

if [[ "$1" == "--smoke" ]]; then
    HOST="${BACKEND_URL:-http://127.0.0.1:8001}"
    FILE="${2:-}"
    if [[ -z "$FILE" ]]; then
        echo "Smoke test skipped: no audio file given. Start backend, then run:"
        echo "  ./tools/regression_test.sh --smoke path/to/short.m4a"
        echo "Or set BACKEND_URL if the server is not on 127.0.0.1:8001"
        exit 0
    fi
    if [[ ! -f "$FILE" ]]; then
        echo "Error: file not found: $FILE"
        exit 2
    fi
    echo "=== Smoke test (upload + wait for artifact) ==="
    echo "Backend: $HOST  File: $FILE"
    python tools/smoke_test_upload.py "$FILE" --host "$HOST" --timeout 120
    echo "Smoke test passed."
fi

echo ""
echo "Regression test completed."
