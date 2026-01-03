#!/usr/bin/env bash
set -euo pipefail

# Prefer BuildKit/buildx to avoid legacy builder deprecation warnings
export DOCKER_BUILDKIT=${DOCKER_BUILDKIT:-1}

if docker buildx version >/dev/null 2>&1; then
	docker buildx build --load -t collection-tracker .
else
	echo "docker buildx not found; falling back to docker build with BuildKit=${DOCKER_BUILDKIT}." >&2
	docker build -t collection-tracker .
fi
