#!/usr/bin/env bash

IMAGE=${1:-collection-tracker}
NETWORK_NAME="${IMAGE}-net"

stop_image() {
  local image_name=$1
  local containers
  containers=$(docker ps -q --filter ancestor="${image_name}")
  if [ -n "$containers" ]; then
    docker stop $containers
  else
    echo "No running containers for image: ${image_name}"
  fi
}

stop_image "${IMAGE}"
stop_image "${IMAGE}-metadata"
docker network rm "${NETWORK_NAME}" >/dev/null 2>&1 || true
