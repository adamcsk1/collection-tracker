#!/usr/bin/env bash
set -euo pipefail

APP_USER=app
APP_GROUP=app
APP_UID=${APP_UID:-$(id -u "$APP_USER")}
APP_GID=${APP_GID:-$(id -g "$APP_GROUP")}
APP_RUNTIME_USER=${APP_UID}:${APP_GID}
DATA_DIR=${DATA_DIR:-/data}

mkdir -p "$DATA_DIR"
chown -R "$APP_RUNTIME_USER" "$DATA_DIR" || true
chmod 700 "$DATA_DIR" || true
chmod -R u=rwX,go= "$DATA_DIR" || true

exec gosu "$APP_RUNTIME_USER" /app/start.sh
