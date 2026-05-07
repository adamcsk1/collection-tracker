#!/usr/bin/env bash
set -euo pipefail

# Ensure required folders exist
mkdir -p /data

# Start Node server in background
# Pass data folder and allow overriding HOST/PORT via env
cd /app/server

# Determine entry file from generated package.json or fallbacks
ENTRY=""
if [ -f "package.json" ]; then
  ENTRY=$(node -e "try{console.log(require('./package.json').main||'')}catch(e){console.error('')}") || true
fi

# Fallback candidates (cover Nx esbuild with bundle=false)
if [ -z "$ENTRY" ] || [ ! -f "$ENTRY" ]; then
  for CAND in \
    "bootstrap.js" \
    "main.js" \
    "index.js" \
    "apps/server/src/bootstrap.js" \
    "apps/server/src/main.js"; do
    if [ -f "$CAND" ]; then ENTRY="$CAND"; break; fi
  done
fi

if [ -z "$ENTRY" ] || [ ! -f "$ENTRY" ]; then
  echo "Cannot find server entry file. Checked package.json 'main' and common candidates. Contents of /app/server:" && ls -laR
  exit 1
fi

# Ensure .env exists in data folder; create a minimal one if missing
if [ ! -f "/data/.env" ]; then
  echo "INFO: /data/.env not found. Creating a minimal default one."
  cat > /data/.env <<'EOF'
# Minimal defaults; override by mounting your own /data/.env
HOST=0.0.0.0
PORT=3000
CORS_ORIGIN=*
OMDB_API_KEY=
OLLAMA_MODEL=qwen2.5:3b
EOF
  chmod 600 /data/.env
fi

# Run node server
NODE_ENV=${NODE_ENV:-production} \
HOST=${HOST:-0.0.0.0} \
PORT=${PORT:-3000} \
node "${ENTRY}" --dataFolder=/data &
NODE_PID=$!

echo "Node server started with PID ${NODE_PID} on ${HOST}:${PORT}"

# Start nginx in foreground
nginx -g 'daemon off;'
