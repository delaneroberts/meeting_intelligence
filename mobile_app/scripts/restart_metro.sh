#!/usr/bin/env zsh
# restart_metro.sh
# Safely kill duplicate Expo/Metro/ngrok processes for this project and start Metro in the foreground.
# Usage:
#   ./scripts/restart_metro.sh [mode] [--tunnel|--lan|--host]
# mode: dev-client (default) or expo
# examples:
#   ./scripts/restart_metro.sh dev-client --tunnel
#   ./scripts/restart_metro.sh expo --lan

set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="/tmp/expo.log"
MODE="dev-client"
EXPO_FLAGS=("--tunnel")

# parse args
if [[ ${1-} != "" ]]; then
  MODE="$1"
  shift
fi
if [[ $# -gt 0 ]]; then
  EXPO_FLAGS=($@)
fi

echo "Project root: $PROJECT_ROOT"

# find candidate processes whose command line or cwd contains the project path
# We search ps for commands mentioning the project root to avoid killing unrelated node processes.
candidates=($(ps aux | grep "$PROJECT_ROOT" | egrep -i 'expo|ngrok|metro|react-native' | egrep -v 'grep' | awk '{print $2}' | sort -u))

if [[ ${#candidates[@]} -eq 0 ]]; then
  echo "No running Expo/Metro/ngrok processes found for this project."
else
  echo "Found the following candidate processes to stop:"
  for pid in "${candidates[@]}"; do
    ps -p $pid -o pid,etime,user,command --no-headers || true
  done

  echo
  echo "Killing candidates with SIGTERM..."
  for pid in "${candidates[@]}"; do
    kill "$pid" 2>/dev/null || true
  done

  sleep 1

  # if any still running, escalate
  still=()
  for pid in "${candidates[@]}"; do
    if ps -p $pid > /dev/null 2>&1; then
      still+=($pid)
    fi
  done
  if [[ ${#still[@]} -gt 0 ]]; then
    echo "Some processes didn't exit, sending SIGKILL: ${still[@]}"
    for pid in "${still[@]}"; do
      kill -9 "$pid" 2>/dev/null || true
    done
  fi
fi

# final check for anything listening on 8081 and kill if it's within this project (best-effort)
listener_pids=($(lsof -i tcp:8081 -sTCP:LISTEN -Fp 2>/dev/null | sed 's/p//g' || true))
for lp in "${listener_pids[@]}"; do
  if [[ -n "$(ps -p $lp -o command= | grep "$PROJECT_ROOT" || true)" ]]; then
    echo "Killing listener pid $lp on 8081 (belongs to project)"
    kill "$lp" 2>/dev/null || true
  fi
done

# start Metro in the foreground so you can see the ASCII QR in your terminal
echo
echo "Starting Metro ($MODE) with flags: ${EXPO_FLAGS[*]}"
cd "$PROJECT_ROOT"
# clear old log
rm -f "$LOG_FILE" || true

if [[ "$MODE" == "dev-client" ]]; then
  exec npx expo start --dev-client "${EXPO_FLAGS[@]}"
else
  exec npx expo start "${EXPO_FLAGS[@]}"
fi
