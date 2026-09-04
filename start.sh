#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ ! -f "$ROOT/.env" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
fi

if [ ! -d "$ROOT/server/node_modules" ]; then
  npm install --prefix server
fi

if [ ! -d "$ROOT/client/node_modules" ]; then
  npm install --prefix client
fi

npm run start --prefix server &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

npm run start --prefix client
