# Docker Deployment

The Docker image serves the built Angular applications with Nginx and runs the built Node server in the same container.

## GHCR Image

Main branch builds publish a prebuilt runtime image to GitHub Container Registry after the Android, Cypress, format,
i18n, lint, test, and typecheck workflows all pass for the same commit.

Published tags:

- `ghcr.io/adamcsk1/collection-tracker:latest` for the latest successful main branch image
- `ghcr.io/adamcsk1/collection-tracker:sha-<commit-sha>` for a commit-pinned image

For public packages, Docker can pull the image anonymously. For private packages, log in first:

```bash
docker login ghcr.io
```

Pull and run the latest image directly:

```bash
docker pull ghcr.io/adamcsk1/collection-tracker:latest
docker run --rm \
  -p 3001:3001 \
  --add-host=host.docker.internal:host-gateway \
  -e APP_UID=$(id -u) \
  -e APP_GID=$(id -g) \
  -v ${PWD}/.data:/data \
  ghcr.io/adamcsk1/collection-tracker:latest
```

## Runtime Layout

- Nginx listens on port `3001`.
- The login application is served from `/login/`.
- The client application is served from `/client/`.
- The health application is served from `/health/`.
- `/api/` is proxied to the Node server on `127.0.0.1:3000`.
- `/data` is the writable volume for `.env`, `ollama.config.json`, the SQLite database, logs, and image cache files.

## Build Prerequisites

The image expects existing build artifacts:

- `dist/apps/client/browser`
- `dist/apps/health/browser`
- `dist/apps/login/browser`
- `dist/apps/server`

## Build And Run

```bash
npm run build
docker buildx build --load -t collection-tracker .
docker run --rm -p 3001:3001 -e APP_UID=$(id -u) -e APP_GID=$(id -g) -v ${PWD}/.data:/data collection-tracker
```

> The server requires `OMDB_API_KEY` in `/data/.env`. If you mount an existing `.data` folder with a configured `.env`, the container uses it. Otherwise, the startup script creates a minimal default `/data/.env` with an empty `OMDB_API_KEY=` placeholder; you must set the key before OMDb proxying will work.

AI search uses Ollama. Install Ollama on the host and run:

```bash
ollama pull qwen2.5:14b
ollama pull mxbai-embed-large
```

Docker Compose does not start an Ollama service. AI search reads `/data/ollama.config.json`, which is created with these defaults when missing:

```json
{
  "host": "http://host.docker.internal:11434",
  "model": "qwen2.5:14b",
  "embeddingModel": "mxbai-embed-large",
  "keep_alive": "15m",
  "batchSize": 10,
  "parallelRequests": 1,
  "semanticCandidateLimit": 90,
  "options": {
    "temperature": 0,
    "top_k": 10,
    "num_thread": 10,
    "num_ctx": 8192
  }
}
```

`embeddingModel` is used for semantic candidate retrieval before the language model filters results. `semanticCandidateLimit` controls how many ranked candidates are sent to the language model.
Add root-level `keep_alive` to pass an Ollama keep-alive value with generate and embed requests. When omitted, the API does not send `keep_alive`.

Configured `options` are merged over the server `DEFAULT_OLLAMA_OPTIONS` of `{ "temperature": 0, "top_k": 10, "num_thread": 10, "num_ctx": 8192 }`, so omitted option fields keep their deterministic defaults.

The Docker default uses `host.docker.internal` so the container can reach Ollama running on the Docker host. Docker Compose maps that name to the host gateway for Linux hosts.

## Environment Variables

| Variable           | Default                  | Description                                                                                                      |
| ------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `BASE_PATH`        | _(empty)_                | URL subpath prefix (e.g. `/collection-tracker`). When set, all apps and the API are served under this path.      |
| `HEALTH_CHECK_URL` | `http://127.0.0.1:3001/` | URL the server uses to verify nginx frontend status. Override when `BASE_PATH` changes the reachable root path.  |
| `APP_PORT`         | `3001`                   | Host port mapped to the container's nginx listener.                                                              |
| `APP_UID`          | `1000`                   | Runtime user ID used for writable files. Set to `$(id -u)` on Linux hosts so `./.data` remains user-accessible.  |
| `APP_GID`          | `1000`                   | Runtime group ID used for writable files. Set to `$(id -g)` on Linux hosts so `./.data` remains user-accessible. |

## Docker Compose (Recommended for VPS)

A simple `docker-compose.yml` is included in the repo root for local source checkouts. After building the app
(`npm run build`), start the container with:

```bash
docker compose up -d
```

On Linux hosts, pass your current user and group IDs so the bind-mounted `./.data` folder remains accessible without root:

```bash
APP_UID=$(id -u) APP_GID=$(id -g) docker compose up -d
```

This will:

- Build the image if it doesn't exist (or run `docker compose up -d --build` to force a rebuild)
- Map host port `3001` (override with `APP_PORT` env var, e.g. `APP_PORT=8080 docker compose up -d`)
- Mount `./.data` on the host to `/data` in the container
- Run the app with `APP_UID`/`APP_GID` for writable mounted files
- Configure AI search with `./.data/ollama.config.json`
- Automatically restart the container unless you stop it manually

To stop:

```bash
docker compose down
```

### Compose with GHCR image

For deployment from the prebuilt GHCR image, use a compose file without a `build:` block:

```yaml
services:
  collection-tracker:
    image: ghcr.io/adamcsk1/collection-tracker:latest
    container_name: collection-tracker
    restart: unless-stopped
    ports:
      - '${APP_PORT:-3001}:3001'
    environment:
      BASE_PATH: ${BASE_PATH:-}
      HEALTH_CHECK_URL: ${HEALTH_CHECK_URL:-}
      APP_UID: ${APP_UID:-1000}
      APP_GID: ${APP_GID:-1000}
    volumes:
      - ./.data:/data
    extra_hosts:
      - 'host.docker.internal:host-gateway'
```

Start it on Linux hosts with your current user and group IDs:

```bash
APP_UID=$(id -u) APP_GID=$(id -g) docker compose up -d
```

Pin a deployment to an immutable commit image by replacing `latest` with `sha-<commit-sha>`.

### One-shot VPS deploy example

```bash
# 1. Build locally (or on the VPS if node is installed)
npm run build

# 2. Start with Compose
docker compose up -d

# 3. View logs
docker compose logs -f
```

## Production Recommendation

Do not expose the container directly on the public internet in production. Put it behind an HTTPS reverse proxy such as Nginx, Caddy, or Traefik, terminate TLS at that layer, and forward traffic to the container on its internal HTTP port.

A typical setup is:

- public `https://your-domain.example` on the reverse proxy
- reverse proxy forwards requests to `http://127.0.0.1:3001`
- the container port stays private to the host or internal network

This is the recommended deployment model for secure cookie handling, TLS certificates, and standard production traffic management.

## Operational Notes

- The runtime image is based on `node:26.0.0-slim`.
- [`docker/entrypoint.sh`](../docker/entrypoint.sh) prepares the mounted `/data` volume and then drops privileges to the configured non-root `APP_UID`/`APP_GID`.
- Release packaging details are covered in [Release packaging](./release.md).
