#!/usr/bin/env bash
set -euo pipefail

# This script runs as root to fix ownership/permissions of mounted volumes,
# then drops privileges to the configured runtime UID/GID.

# Defaults
APP_USER=app
APP_GROUP=app
APP_UID=${APP_UID:-$(id -u "$APP_USER")}
APP_GID=${APP_GID:-$(id -g "$APP_GROUP")}
APP_RUNTIME_USER=${APP_UID}:${APP_GID}
DATA_DIR=${DATA_DIR:-/data}

# Ensure the data dir exists
mkdir -p "$DATA_DIR"

# If running with a bind mount from a Linux host, match the host UID/GID so
# files remain accessible outside the container.
chown -R "$APP_RUNTIME_USER" "$DATA_DIR" || true
chmod 700 "$DATA_DIR" || true
chmod -R u=rwX,go= "$DATA_DIR" || true

# Also ensure Nginx writable directories are owned by the runtime user.
for p in \
  /var/cache/nginx \
  /var/cache/nginx/client_temp \
  /var/cache/nginx/proxy_temp \
  /var/cache/nginx/fastcgi_temp \
  /var/cache/nginx/uwsgi_temp \
  /var/cache/nginx/scgi_temp \
  /var/run/nginx \
  /var/log/nginx \
  /usr/share/nginx/html \
  /var/lib/nginx \
  /var/lib/nginx/tmp \
  /var/lib/nginx/logs \
  /etc/nginx \
  /etc/nginx/conf.d
 do
  mkdir -p "$p"
  chown -R "$APP_RUNTIME_USER" "$p" || true
 done

# Drop privileges and run the app's startup script
exec gosu "$APP_RUNTIME_USER" /app/start.sh
