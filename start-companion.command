#!/bin/bash
# Double-clickable starter for the IdleOn Companion (macOS).
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install it with: brew install node"; read -r -p "Press enter to close…"; exit 1
fi
echo "Starting IdleOn Companion — leave this window open (Ctrl+C to stop)."
( sleep 1.5 && open "http://localhost:8317" ) &
exec node companion.mjs
