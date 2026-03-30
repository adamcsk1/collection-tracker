#!/usr/bin/env bash

IMAGE=${1:-collection-tracker}
CONTAINERS=$(docker ps -q --filter ancestor=${IMAGE})

if [ -n "$CONTAINERS" ]; then
  docker stop $CONTAINERS
else
  echo "No running containers for image: $IMAGE"
fi
