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
TRUSTED_PROXY_CONF=/etc/nginx/trusted-proxies.conf

if [ -f "$NGINX_TEMPLATE" ]; then
  TRUSTED_PROXY_CIDRS=${TRUSTED_PROXY_CIDRS:-} node /app/trusted-proxy-config.mjs > "$TRUSTED_PROXY_CONF"
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

if [ ! -f "package.json" ]; then
  echo "Cannot find /app/server/package.json. Ensure the server build generated package metadata."
  exit 1
fi

ENTRY=$(node -e "const { main } = require('./package.json'); if (!main) process.exit(1); console.log(main)") || {
  echo "Cannot read server entry from /app/server/package.json main."
  exit 1
}

if [ ! -f "$ENTRY" ]; then
  echo "Cannot find server entry file from package.json main: $ENTRY"
  exit 1
fi

# Ensure .env exists in data folder; generate persistent secrets on first start
if [ ! -f "/data/.env" ]; then
  echo "INFO: /data/.env not found. Creating secure defaults."
  JWT_SECRET=$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")
  COOKIE_SECRET=$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")
  SALT=$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")
  cat > /data/.env <<EOF
# Generated defaults; preserve these secrets when changing other settings
HOST=0.0.0.0
PORT=3000
CORS_ORIGIN=*
OMDB_API_KEY=
JWT_SECRET=$JWT_SECRET
COOKIE_SECRET=$COOKIE_SECRET
SALT=$SALT
EOF
  chmod 600 /data/.env
fi

if [ ! -f "/data/ollama.config.json" ]; then
  echo "INFO: /data/ollama.config.json not found. Creating a default one."
  cat > /data/ollama.config.json <<'EOF'
{
  "host": "http://host.docker.internal:11434",
  "model": "qwen2.5:14b",
  "embeddingModel": "mxbai-embed-large",
  "keep_alive": "15m",
  "batchSize": 10,
  "parallelRequests": 1,
  "semanticCandidateLimit": 90,
  "options": {
    "temperature": 0,
    "top_k": 10,
    "num_thread": 10,
    "num_ctx": 8192
  }
}
EOF
  chmod 600 /data/ollama.config.json
fi

if [ ! -f "/data/background.config.json" ]; then
  echo "INFO: /data/background.config.json not found. Creating a default one."
  cat > /data/background.config.json <<'EOF'
{
  "imdbIds": [
    "tt0111161",
    "tt0068646",
    "tt0468569",
    "tt0071562",
    "tt0050083",
    "tt0108052",
    "tt0167260",
    "tt0110912",
    "tt0120737",
    "tt0060196",
    "tt0109830",
    "tt0137523",
    "tt0167261",
    "tt1375666",
    "tt0080684",
    "tt0133093",
    "tt0099685",
    "tt0073486",
    "tt0816692",
    "tt0114369",
    "tt0038650",
    "tt0047478",
    "tt0102926",
    "tt0120815",
    "tt0317248",
    "tt0118799",
    "tt0120689",
    "tt0103064",
    "tt0076759",
    "tt0245429"
  ]
}
EOF
fi

# Run node server
NODE_ENV=${NODE_ENV:-production} \
HOST=${HOST:-0.0.0.0} \
PORT=${PORT:-3000} \
node "${ENTRY}" --dataFolder=/data &
NODE_PID=$!

echo "Node server started with PID ${NODE_PID} on ${HOST}:${PORT}"

# Start nginx and stop the container when either process exits
nginx -g 'daemon off;' &
NGINX_PID=$!

cleanup() {
  status=$?
  trap - EXIT TERM INT
  kill "${NODE_PID}" "${NGINX_PID}" 2>/dev/null || true
  wait "${NODE_PID}" 2>/dev/null || true
  wait "${NGINX_PID}" 2>/dev/null || true
  exit "${status}"
}

trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

wait -n "${NODE_PID}" "${NGINX_PID}"
