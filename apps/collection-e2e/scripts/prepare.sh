#!/usr/bin/env bash

DATA_DIR="${PWD}/apps/collection-e2e/env"
DATABASE_DIR="${DATA_DIR}/database"

${PWD}/apps/collection-e2e/scripts/stop.sh collection-tracker-cypress
${PWD}/apps/collection-e2e/scripts/build.sh collection-tracker-cypress

# Seed the SQLite database with the cypress test user before the container starts.
# We run the script inside a temporary container so the native better-sqlite3
# module matches the Linux runtime (avoids "invalid ELF header" on WSL/Windows).
# The host data folder is mounted as /data; the server node_modules provide
# better-sqlite3 and dotenv.
# Clean up inside the container as root to avoid permission issues on WSL/Windows mounts.
docker run --rm \
  --entrypoint "" \
  --user root \
  -v "${DATA_DIR}:/data" \
  -v "${PWD}/apps/collection-e2e/scripts/seed-e2e-db.js:/seed.js:ro" \
  -v "${PWD}/apps/server/src/migrations:/app/server/migrations:ro" \
  collection-tracker-cypress \
  bash -c "rm -rf /data/database && mkdir -p /data/database && DATA_DIR=/data NODE_PATH=/app/server/node_modules node /seed.js"

${PWD}/apps/collection-e2e/scripts/start.sh "${DATA_DIR}" collection-tracker-cypress "2999"
