#!/usr/bin/env bash
set -euo pipefail

# This script runs as root to fix ownership/permissions of mounted volumes
# then drops privileges to 'app' user and executes the main start script.

# Defaults
APP_USER=app
APP_GROUP=app
DATA_DIR=${DATA_DIR:-/data}

# Ensure the data dir exists
mkdir -p "$DATA_DIR"

# If running with a mounted volume from host, permissions may be wrong.
# Fix ownership to the app user so the Node server can write.
chown -R ${APP_USER}:${APP_GROUP} "$DATA_DIR" || true
chmod 700 "$DATA_DIR" || true
chmod -R u=rwX,go= "$DATA_DIR" || true

# Also ensure Nginx writable directories are owned by app
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
  chown -R ${APP_USER}:${APP_GROUP} "$p" || true
 done

# Drop privileges and run the app's startup script
exec gosu ${APP_USER}:${APP_GROUP} /app/start.sh
