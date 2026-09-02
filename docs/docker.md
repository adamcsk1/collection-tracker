# Docker Deployment

The Docker image serves the built Angular applications with Nginx and runs the built Node server in the same container.

## GHCR Image

Main branch builds publish a prebuilt runtime image to GitHub Container Registry after the Android, Cypress, format,
i18n, lint, test, and typecheck workflows all pass for the same commit.

Published tags:

- `ghcr.io/adamcsk1/collection-tracker:latest` for the latest successful main branch image
- `ghcr.io/adamcsk1/collection-tracker:sha-<commit-sha>` for a commit-pinned image
- `ghcr.io/adamcsk1/collection-tracker:vX.Y.Z` when that commit has a matching `vX.Y.Z` git tag

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
- `/data` is the writable volume for `.env`, `ollama.config.json`, `background.config.json`, the SQLite database, logs, and image cache files.

When `/data/.env` does not exist, the container creates it with independent cryptographically random `JWT_SECRET`, `COOKIE_SECRET`, and `SALT` values and mode `0600`. The file is reused unchanged on later starts. An existing file missing `JWT_SECRET`, `COOKIE_SECRET`, or `SALT` causes startup to fail rather than silently rotating credentials.

Keep an existing `SALT` value unchanged because it participates in persisted account and share hashes. A deployment created by an older Docker fallback without a salt should add `SALT=` explicitly to preserve those hashes, then add new random `JWT_SECRET` and `COOKIE_SECRET` values.

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

> `OMDB_API_KEY` in `/data/.env` enables the OMDb external metadata provider. Optional `OMDB_API_URL` overrides its endpoint; when omitted or empty, it defaults to `https://www.omdbapi.com/`. OMDb requests time out after 10 seconds. Open Library book metadata needs no API key; optional `OPENLIBRARY_API_URL` overrides its default `https://openlibrary.org/` endpoint. MusicBrainz album metadata needs no API key; optional `MUSICBRAINZ_API_URL` overrides `https://musicbrainz.org/ws/2/` and optional `COVERARTARCHIVE_API_URL` overrides `https://coverartarchive.org/`. Without an OMDb key, movie and series metadata operations remain unavailable while book and music search continue to work.

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
  "batchSize": 16,
  "parallelRequests": 2,
  "semanticCandidateLimit": 120,
  "options": {
    "temperature": 0,
    "top_k": 20,
    "num_thread": 16,
    "num_ctx": 16384
  }
}
```

`embeddingModel` is used for semantic candidate retrieval before the language model filters results. `semanticCandidateLimit` controls how many ranked candidates are sent to the language model.
Add root-level `keep_alive` to pass an Ollama keep-alive value with generate and embed requests. When omitted, the API does not send `keep_alive`.

Configured `options` are merged over the server `DEFAULT_OLLAMA_OPTIONS` of `{ "temperature": 0, "top_k": 20, "num_thread": 16, "num_ctx": 16384 }`, so omitted option fields keep their deterministic defaults.

The Docker default uses `host.docker.internal` so the container can reach Ollama running on the Docker host. Docker Compose maps that name to the host gateway for Linux hosts.

`/data/background.config.json` is created with default IMDb IDs when missing. Edit `imdbIds`, `isbnIds`, and `mbids` to change the animated poster background; the server may write a `posters` map of resolved source URLs and does not replace the ID arrays. Without `OMDB_API_KEY`, IMDb posters are skipped; book and album covers still resolve.

## Environment Variables

| Variable              | Default                  | Description                                                                                                      |
| --------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `BASE_PATH`           | _(empty)_                | URL subpath prefix (e.g. `/collection-tracker`). When set, all apps and the API are served under this path.      |
| `HEALTH_CHECK_URL`    | `http://127.0.0.1:3001/` | URL the server uses to verify nginx frontend status. Override when `BASE_PATH` changes the reachable root path.  |
| `HEALTH_RATE_LIMIT`   | `60`                     | Public health and authenticated health-diagnostics requests allowed per client IP per minute.                    |
| `IMAGE_RATE_LIMIT`    | `240`                    | Image proxy and public background-image list requests allowed per client IP per minute.                          |
| `TRUSTED_PROXY_CIDRS` | _(empty)_                | Comma-separated outer reverse-proxy IPs/CIDRs allowed to supply the original client address.                     |
| `APP_PORT`            | `3001`                   | Host port mapped to the container's nginx listener.                                                              |
| `APP_UID`             | `1000`                   | Runtime user ID used for writable files. Set to `$(id -u)` on Linux hosts so `./.data` remains user-accessible.  |
| `APP_GID`             | `1000`                   | Runtime group ID used for writable files. Set to `$(id -g)` on Linux hosts so `./.data` remains user-accessible. |

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
      HEALTH_RATE_LIMIT: ${HEALTH_RATE_LIMIT:-60}
      IMAGE_RATE_LIMIT: ${IMAGE_RATE_LIMIT:-240}
      TRUSTED_PROXY_CIDRS: ${TRUSTED_PROXY_CIDRS:-}
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

Pin a deployment to an immutable commit image by replacing `latest` with `sha-<commit-sha>`, or to a release with `vX.Y.Z`.

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

The bundled nginx proxy ignores incoming forwarded-IP headers by default, and Fastify trusts only its loopback nginx. When an outer reverse proxy is the only route to the container, set `TRUSTED_PROXY_CIDRS` to the proxy addresses as seen by the container. Nginx will then resolve the original client from `X-Forwarded-For`, while headers from any other sender remain untrusted.

For example, use `TRUSTED_PROXY_CIDRS=172.18.0.0/16` when the outer proxy is attached to a dedicated Docker network with that subnet. For a host-level proxy, use the host gateway address or CIDR visible from the container. Trust the narrowest range possible, and keep port `3001` private so clients cannot connect through an address in the trusted range.

This is the recommended deployment model for secure cookie handling, TLS certificates, and standard production traffic management.

## Operational Notes

- The runtime image is based on `node:26.0.0-slim`.
- The image proxy permits four concurrent uncached fetches and queues up to 32 more for 10 seconds. Queue saturation or wait timeout returns `503 Service Unavailable` with `Retry-After` guidance; only actual per-IP rate limiting returns `429 Too Many Requests`. It applies one 30-second deadline across DNS resolution and all redirects, rejects empty images, and limits each image to 10 MiB. It evicts least-recently-accessed entries to keep the cache within 512 MiB including estimated metadata/filesystem overhead and 10,000 entries. These limits are fixed; only the per-IP request rate is configurable.
- [`docker/entrypoint.sh`](../docker/entrypoint.sh) prepares the mounted `/data` volume and then drops privileges to the configured non-root `APP_UID`/`APP_GID`.
- Run `npm run test:docker-lifecycle` from a Bash environment with Docker available to verify first start, generated secrets, authentication, restart, and data persistence. `DOCKER_LIFECYCLE_IMAGE=<local-image>` reuses an existing image.
- Release packaging details are covered in [Release packaging](./release.md).
