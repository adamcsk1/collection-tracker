#!/usr/bin/env bash
set -euo pipefail

DATA_FOLDER=${1:-${PWD}/.data}
IMAGE=${2:-collection-tracker}
PORT=${3:-3000}

CONTAINER_ID=$(docker run --rm -p "${PORT}:3001" -v "${DATA_FOLDER}:/data" -d "${IMAGE}")

for attempt in {1..30}; do
  if curl --fail --silent --show-error "http://127.0.0.1:${PORT}/" > /dev/null && \
    curl --fail --silent --show-error "http://127.0.0.1:${PORT}/api/v1/health" > /dev/null; then
    echo "Cypress app is ready on port ${PORT}"
    exit 0
  fi
  sleep 2
done

docker logs "${CONTAINER_ID}"
exit 1
