#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-4173}"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
URL="http://localhost:${PORT}"

cd "$ROOT_DIR"

echo "Iniciando Catan en ${URL} ..."
python3 -m http.server "$PORT" >/tmp/catan_server.log 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

sleep 1

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open "$URL" >/dev/null 2>&1 || true
fi

echo "Juego abierto (o listo para abrir) en: ${URL}"
echo "Para cerrar, vuelve aquí y pulsa Ctrl+C"

wait "$SERVER_PID"
