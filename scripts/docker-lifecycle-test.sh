#!/usr/bin/env bash
set -euo pipefail

IMAGE=${DOCKER_LIFECYCLE_IMAGE:-}
METADATA_IMAGE=${DOCKER_LIFECYCLE_METADATA_IMAGE:-}
BUILT_IMAGE=false
CONTAINER_NAME="collection-tracker-lifecycle-${$}"
METADATA_CONTAINER_NAME="collection-tracker-lifecycle-metadata-${$}"
NETWORK_NAME="collection-tracker-lifecycle-${$}"
VOLUME_NAME="collection-tracker-lifecycle-${$}"
METADATA_VOLUME_NAME="collection-tracker-lifecycle-metadata-${$}"
TEMP_DIR=''

cleanup() {
  status=$?
  trap - EXIT INT TERM

  if [ "$status" -ne 0 ]; then
    echo "Docker lifecycle test failed. Container logs:" >&2
    docker logs "$CONTAINER_NAME" >&2 || true
    docker logs "$METADATA_CONTAINER_NAME" >&2 || true
  fi

  docker rm --force "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm --force "$METADATA_CONTAINER_NAME" >/dev/null 2>&1 || true
  docker network rm "$NETWORK_NAME" >/dev/null 2>&1 || true
  docker volume rm --force "$VOLUME_NAME" >/dev/null 2>&1 || true
  docker volume rm --force "$METADATA_VOLUME_NAME" >/dev/null 2>&1 || true
  if [ -n "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR" || true
  fi
  if [ "$BUILT_IMAGE" = true ]; then
    docker image rm "$IMAGE" >/dev/null 2>&1 || true
    docker image rm "$METADATA_IMAGE" >/dev/null 2>&1 || true
  fi

  exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! docker info >/dev/null 2>&1; then
  echo 'Docker daemon is unavailable.' >&2
  exit 1
fi

if [ -z "$IMAGE" ]; then
  IMAGE="collection-tracker:lifecycle-${$}"
  METADATA_IMAGE="collection-tracker-metadata-provider:lifecycle-${$}"
  BUILT_IMAGE=true

  if docker buildx version >/dev/null 2>&1; then
    docker buildx build --load --tag "$IMAGE" .
    docker buildx build --load -f Dockerfile.metadata-provider --tag "$METADATA_IMAGE" .
  else
    DOCKER_BUILDKIT=${DOCKER_BUILDKIT:-1} docker build --tag "$IMAGE" .
    DOCKER_BUILDKIT=${DOCKER_BUILDKIT:-1} docker build -f Dockerfile.metadata-provider --tag "$METADATA_IMAGE" .
  fi
else
  if [ -z "$METADATA_IMAGE" ]; then
    METADATA_IMAGE="${IMAGE}-metadata"
  fi
  if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "Docker lifecycle image does not exist locally: $IMAGE" >&2
    exit 1
  fi
  if ! docker image inspect "$METADATA_IMAGE" >/dev/null 2>&1; then
    echo "Docker lifecycle metadata image does not exist locally: $METADATA_IMAGE" >&2
    exit 1
  fi
fi

TEMP_DIR=$(mktemp -d)
docker network create "$NETWORK_NAME" >/dev/null
docker volume create "$VOLUME_NAME" >/dev/null
docker volume create "$METADATA_VOLUME_NAME" >/dev/null

start_container() {
  docker run \
    --detach \
    --name "$METADATA_CONTAINER_NAME" \
    --network "$NETWORK_NAME" \
    --network-alias metadata-provider \
    --env "APP_UID=$(id -u)" \
    --env "APP_GID=$(id -g)" \
    --volume "$METADATA_VOLUME_NAME:/data" \
    "$METADATA_IMAGE" >/dev/null

  docker run \
    --detach \
    --name "$CONTAINER_NAME" \
    --network "$NETWORK_NAME" \
    --publish '127.0.0.1::3001' \
    --add-host=host.docker.internal:host-gateway \
    --env "APP_UID=$(id -u)" \
    --env "APP_GID=$(id -g)" \
    --env METADATA_SERVICE_URL=http://metadata-provider:3002 \
    --volume "$VOLUME_NAME:/data" \
    "$IMAGE" >/dev/null

  PORT_MAPPING=$(docker port "$CONTAINER_NAME" 3001/tcp)
  PORT=${PORT_MAPPING##*:}
  BASE_URL="http://127.0.0.1:${PORT}"

  ready=false
  deadline=$(($(date +%s) + 90))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if curl --fail --silent --show-error --max-time 5 "$BASE_URL/" >/dev/null && \
      curl --fail --silent --show-error --max-time 5 "$BASE_URL/api/v1/health" >/dev/null; then
      ready=true
      break
    fi
    if [ "$(docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME")" != true ]; then
      break
    fi
    sleep 2
  done

  if [ "$ready" != true ]; then
    echo "Container did not become ready at $BASE_URL within 90 seconds." >&2
    return 1
  fi
}

start_container

docker exec "$CONTAINER_NAME" grep -Eq '^JWT_SECRET=[[:xdigit:]]{64}$' /data/.env
docker exec "$CONTAINER_NAME" grep -Eq '^COOKIE_SECRET=[[:xdigit:]]{64}$' /data/.env
docker exec "$CONTAINER_NAME" grep -Eq '^SALT=[[:xdigit:]]{64}$' /data/.env
test "$(docker exec "$CONTAINER_NAME" grep -E '^(JWT_SECRET|COOKIE_SECRET|SALT)=' /data/.env | cut -d= -f2 | sort -u | wc -l)" -eq 3
test "$(docker exec "$CONTAINER_NAME" stat -c '%a' /data/.env)" = 600
docker exec "$CONTAINER_NAME" node -e "const config = JSON.parse(require('node:fs').readFileSync('/data/ollama.config.json', 'utf8')); if (config.host !== 'http://host.docker.internal:11434' || !config.model || !config.embeddingModel) process.exit(1);"
docker exec "$CONTAINER_NAME" test -s /data/database/collection-tracker.sqlite

USERNAME="docker-lifecycle-${$}"
SIGN_UP_PAYLOAD=$(USERNAME="$USERNAME" node -e \
  "process.stdout.write(JSON.stringify({ username: process.env.USERNAME }))")
SIGN_UP_RESPONSE=$(curl --fail-with-body --silent --show-error \
  --header 'Content-Type: application/json' \
  --data "$SIGN_UP_PAYLOAD" \
  "$BASE_URL/api/v1/auth/sign-up")
TOKEN=$(printf '%s' "$SIGN_UP_RESPONSE" | node -e \
  "let body = ''; process.stdin.on('data', chunk => body += chunk).on('end', () => { const token = JSON.parse(body).data?.token; if (typeof token !== 'string' || !token) process.exit(1); process.stdout.write(token); });")
SIGN_IN_PAYLOAD=$(USERNAME="$USERNAME" TOKEN="$TOKEN" node -e \
  "process.stdout.write(JSON.stringify({ username: process.env.USERNAME, token: process.env.TOKEN }))")

test "$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --header 'Content-Type: application/json' \
  --data "$SIGN_IN_PAYLOAD" \
  "$BASE_URL/api/v1/auth/sign-in")" = 204

docker exec "$CONTAINER_NAME" cat /data/.env > "$TEMP_DIR/.env.initial"
docker stop --time 20 "$CONTAINER_NAME" "$METADATA_CONTAINER_NAME" >/dev/null
docker rm "$CONTAINER_NAME" "$METADATA_CONTAINER_NAME" >/dev/null

start_container

docker exec "$CONTAINER_NAME" cat /data/.env | cmp "$TEMP_DIR/.env.initial" -
docker exec "$CONTAINER_NAME" test -s /data/database/collection-tracker.sqlite
test "$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --header 'Content-Type: application/json' \
  --data "$SIGN_IN_PAYLOAD" \
  "$BASE_URL/api/v1/auth/sign-in")" = 204

docker stop --time 20 "$CONTAINER_NAME" "$METADATA_CONTAINER_NAME" >/dev/null
docker rm "$CONTAINER_NAME" "$METADATA_CONTAINER_NAME" >/dev/null

echo 'Docker lifecycle integration test passed.'
