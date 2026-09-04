#!/usr/bin/env bash
set -euo pipefail

mkdir -p /data

if [ ! -f "/data/.env" ]; then
  echo "INFO: /data/.env not found. Creating metadata provider defaults."
  cat > /data/.env <<EOF
# Provider-only secrets. Do not copy app JWT/cookie/salt values here.
OMDB_API_KEY=${OMDB_API_KEY:-}
EOF
  chmod 600 /data/.env
fi

cd /app/metadata-provider

if [ ! -f "package.json" ]; then
  echo "Cannot find /app/metadata-provider/package.json."
  exit 1
fi

ENTRY=$(node -e "const { main } = require('./package.json'); if (!main) process.exit(1); console.log(main)") || {
  echo "Cannot read metadata provider entry from package.json main."
  exit 1
}

if [ ! -f "$ENTRY" ]; then
  echo "Cannot find metadata provider entry file: $ENTRY"
  exit 1
fi

NODE_ENV=${NODE_ENV:-production} \
HOST=${HOST:-0.0.0.0} \
METADATA_PROVIDER_PORT=${METADATA_PROVIDER_PORT:-3002} \
exec node "${ENTRY}" --dataFolder=/data
