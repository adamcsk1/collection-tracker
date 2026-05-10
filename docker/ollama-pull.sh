#!/usr/bin/env sh
set -e

MODEL="${OLLAMA_MODEL:-qwen2.5:3b}"

echo "Pulling Ollama model: $MODEL ..."

i=1
while [ "$i" -le 30 ]; do
  if ollama pull "$MODEL" >/dev/null 2>&1; then
    echo "Pull complete: $MODEL"
    exit 0
  fi
  echo "Waiting for Ollama to be ready... ($i/30)"
  sleep 2
  i=$((i + 1))
done

echo "Failed to pull model after 30 attempts."
exit 1
