#!/usr/bin/env bash
set -euo pipefail

# Configurable base path for subpath deployments (e.g. /collection-tracker)
BASE_PATH=${BASE_PATH:-}
if [ -n "$BASE_PATH" ]; then
  BASE_PATH="/${BASE_PATH#/}"
  BASE_PATH="${BASE_PATH%/}"
fi
BASE_PATH_REPLACEMENT=$(printf '%s' "$BASE_PATH" | sed 's/[&|]/\\&/g')

# Generate nginx config from template
NGINX_TEMPLATE=/etc/nginx/nginx.conf.template
NGINX_CONF=/etc/nginx/nginx.conf

if [ -f "$NGINX_TEMPLATE" ]; then
  cp "$NGINX_TEMPLATE" "$NGINX_CONF"
  sed -i "s|\${BASE_PATH}|${BASE_PATH_REPLACEMENT}|g" "$NGINX_CONF"

  if [ -n "$BASE_PATH" ]; then
    # Add exact-match redirects for subpath root (e.g. /collection-tracker -> /collection-tracker/login/)
    sed -i "/# SUBPATH_ROOT/a \\    location = ${BASE_PATH} {\n      return 301 ${BASE_PATH}/;\n    }\n\n    location = ${BASE_PATH}/ {\n      return 302 ${BASE_PATH}/login/;\n    }" "$NGINX_CONF"
  fi
  sed -i '/# SUBPATH_ROOT/d' "$NGINX_CONF"
fi

# Patch manifest.json scope and start_url when BASE_PATH is set
if [ -n "$BASE_PATH" ]; then
  for app in client health login; do
    index_file="/usr/share/nginx/html/${app}/index.html"
    if [ -f "$index_file" ]; then
      sed -i "s|<base href=\"/\">|<base href=\"${BASE_PATH}/${app}/\">|g" "$index_file"
      sed -i "s|<base href=\"/\" />|<base href=\"${BASE_PATH}/${app}/\" />|g" "$index_file"
    fi
  done

  for manifest in /usr/share/nginx/html/client/manifest.json /usr/share/nginx/html/health/manifest.json /usr/share/nginx/html/login/manifest.json /usr/share/nginx/html/manifest.json; do
    if [ -f "$manifest" ]; then
      sed -i "s|\"scope\": \"/\"|\"scope\": \"${BASE_PATH}/\"|g" "$manifest"
      sed -i "s|\"start_url\": \"/\"|\"start_url\": \"${BASE_PATH}/\"|g" "$manifest"
    fi
  done
fi

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
EOF
  chmod 600 /data/.env
fi

if [ ! -f "/data/ollama.config.json" ]; then
  echo "INFO: /data/ollama.config.json not found. Creating a default one."
  cat > /data/ollama.config.json <<'EOF'
{
  "host": "http://host.docker.internal:11434",
  "model": "qwen2.5:3b",
  "options": {
    "num_thread": 1
  },
  "batchSize": 10,
  "parallelRequests": 1
}
EOF
  chmod 600 /data/ollama.config.json
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
