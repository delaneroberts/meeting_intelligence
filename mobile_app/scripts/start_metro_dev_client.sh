#!/usr/bin/env zsh
# Start Metro for a dev-client build. Use this after you've installed a development build (dev client) on your phone.
# Usage: ./scripts/start_metro_dev_client.sh

set -euo pipefail
cd "$(dirname "$0")/.."

# Avoid opening DevTools browser
export BROWSER=none

# Start Metro for dev-client workflow and prefer a tunnel if the phone cannot reach the LAN IP.
npx expo start --dev-client --tunnel
