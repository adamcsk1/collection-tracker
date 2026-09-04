#!/usr/bin/env bash
set -euo pipefail

DATA_FOLDER=${1:-${PWD}/.data}
IMAGE=${2:-collection-tracker}
PORT=${3:-3000}
NETWORK_NAME="${IMAGE}-net"
METADATA_IMAGE="${IMAGE}-metadata"
METADATA_DATA="${DATA_FOLDER%/}-metadata"

docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1 || docker network create "${NETWORK_NAME}"
mkdir -p "${METADATA_DATA}"
if [ ! -f "${METADATA_DATA}/.env" ]; then
  omdb_api_key=$(grep -E '^OMDB_API_KEY=' "${DATA_FOLDER}/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
  printf 'OMDB_API_KEY=%s\n' "${omdb_api_key}" > "${METADATA_DATA}/.env"
fi

METADATA_ID=$(docker run --rm --network "${NETWORK_NAME}" --network-alias metadata-provider \
  -v "${METADATA_DATA}:/data" -d "${METADATA_IMAGE}")
CONTAINER_ID=$(docker run --rm --network "${NETWORK_NAME}" \
  -e METADATA_SERVICE_URL=http://metadata-provider:3002 \
  -p "${PORT}:3001" -v "${DATA_FOLDER}:/data" -d "${IMAGE}")

for attempt in {1..30}; do
  if curl --fail --silent --show-error "http://127.0.0.1:${PORT}/" > /dev/null && \
    curl --fail --silent --show-error "http://127.0.0.1:${PORT}/api/v1/health" > /dev/null; then
    echo "Cypress app is ready on port ${PORT}"
    exit 0
  fi
  sleep 2
done

docker logs "${METADATA_ID}" || true
docker logs "${CONTAINER_ID}"
exit 1
