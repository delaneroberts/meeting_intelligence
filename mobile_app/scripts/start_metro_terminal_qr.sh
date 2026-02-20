#!/usr/bin/env zsh
# Start Expo/Metro in the terminal and show the ASCII QR code (avoid opening DevTools browser)
# Usage: ./scripts/start_metro_terminal_qr.sh

set -euo pipefail

# Move to the mobile_app root (script is in mobile_app/scripts)
cd "$(dirname "$0")/.."

# Prevent some environments from auto-opening a browser (best-effort)
# Note: Expo may still open DevTools in some setups; if it does, ctrl-c and retry with the same command.
export BROWSER=none

# Start Expo/Metro using the local project's CLI via npx so global install isn't required.
# --tunnel is recommended when the phone can't reach your LAN address. If you are on the same Wi‑Fi
# network and can connect to the machine's LAN IP, you can use --lan instead (replace --tunnel with --lan).

npx expo start --tunnel
