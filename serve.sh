#!/bin/bash
# Helper script to launch local web server for SatuJuz

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PORT=8080

echo "Memulai server lokal SatuJuz (Al-Qur'an Juz 30)..."

if [ -f "/Applications/Antigravity.app/Contents/MacOS/Antigravity" ]; then
  ELECTRON_RUN_AS_NODE=1 "/Applications/Antigravity.app/Contents/MacOS/Antigravity" "$DIR/server.js"
elif [ -f "/Applications/Visual Studio Code.app/Contents/MacOS/Electron" ]; then
  ELECTRON_RUN_AS_NODE=1 "/Applications/Visual Studio Code.app/Contents/MacOS/Electron" "$DIR/server.js"
elif command -v node >/dev/null 2>&1; then
  node "$DIR/server.js"
elif command -v python3 >/dev/null 2>&1; then
  echo "Menjalankan via Python http.server di port $PORT..."
  cd "$DIR" && python3 -m http.server $PORT
else
  echo "Membuka langsung di browser default..."
  open "$DIR/index.html"
fi
