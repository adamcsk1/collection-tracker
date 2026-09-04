# Docker Deployment

Docker Compose runs two images: the app image serves the built Angular applications with Nginx and the Node server, and a private metadata-provider image owns OMDb, Open Library, MusicBrainz, and replacement adapters.

## GHCR Image

Main branch builds publish a prebuilt runtime image to GitHub Container Registry after the Android, Cypress, format,
i18n, lint, test, and typecheck workflows all pass for the same commit.

Published tags:

- `ghcr.io/adamcsk1/collection-tracker:latest` and `ghcr.io/adamcsk1/collection-tracker-metadata-provider:latest` for the latest successful main branch images
- `ghcr.io/adamcsk1/collection-tracker:sha-<commit-sha>` and `ghcr.io/adamcsk1/collection-tracker-metadata-provider:sha-<commit-sha>` for commit-pinned images
- `ghcr.io/adamcsk1/collection-tracker:vX.Y.Z` and `ghcr.io/adamcsk1/collection-tracker-metadata-provider:vX.Y.Z` when that commit has a matching `vX.Y.Z` git tag

For public packages, Docker can pull the image anonymously. For private packages, log in first:

```bash
docker login ghcr.io
```

Pull the app and metadata-provider images and run them with Compose. The app image no longer includes built-in metadata adapters.

## Runtime Layout

- Nginx listens on port `3001`.
- The login application is served from `/login/`.
- The client application is served from `/client/`.
- The health application is served from `/health/`.
- `/api/` is proxied to the Node server on `127.0.0.1:3000`.
- `/data` on the app container is the writable volume for `.env`, `ollama.config.json`, `background.config.json`, the SQLite database, logs, and image cache files.
- `/data` on the metadata-provider container (`./.metadata` on the host) holds provider-only `.env` values such as `OMDB_API_KEY` and optional `external-metadata.config.json`. That port is not published. Existing app `./.data/.env` values for `OMDB_API_KEY` are unused; copy a non-empty key into `./.metadata/.env` and restart both containers.

When `/data/.env` does not exist, the container creates it with independent cryptographically random `JWT_SECRET`, `COOKIE_SECRET`, and `SALT` values and mode `0600`. The file is reused unchanged on later starts. An existing file missing `JWT_SECRET`, `COOKIE_SECRET`, or `SALT` causes startup to fail rather than silently rotating credentials.

Keep an existing `SALT` value unchanged because it participates in persisted account and share hashes. A deployment created by an older Docker fallback without a salt should add `SALT=` explicitly to preserve those hashes, then add new random `JWT_SECRET` and `COOKIE_SECRET` values.

## Build Prerequisites

The image expects existing build artifacts:

- `dist/apps/client/browser`
- `dist/apps/health/browser`
- `dist/apps/login/browser`
- `dist/apps/server`
- `dist/apps/metadata-provider`

## Build And Run

```bash
npm run build
docker compose up -d --build
```

> `OMDB_API_KEY` in the metadata-provider `/data/.env` enables the built-in OMDb adapter. Optional `OMDB_API_URL` overrides its endpoint; when omitted or empty, it defaults to `https://www.omdbapi.com/`. Open Library and MusicBrainz need no API key. Without an OMDb key, movie and series metadata operations remain unavailable unless the `omdb` slot is replaced; book and music search continue to work.

Optional metadata-provider `/data/external-metadata.config.json` can replace any built-in adapter with a service implementing the [normalized provider contract](./external-metadata-provider-contract.md). Custom header values are read from variables in that same provider `.env`. Restart the metadata-provider container after changing provider configuration.

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
| `METADATA_SERVICE_URL` | `http://metadata-provider:3002` | App-container URL for the private metadata provider. Not published. |

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
- Mount `./.data` on the host to `/data` in the app container
- Mount `./.metadata` on the host to `/data` in the metadata-provider container
- Keep the metadata provider on a private Compose network without publishing its port
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
  metadata-provider:
    image: ghcr.io/adamcsk1/collection-tracker-metadata-provider:latest
    restart: unless-stopped
    environment:
      APP_UID: ${APP_UID:-1000}
      APP_GID: ${APP_GID:-1000}
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    volumes:
      - ./.metadata:/data
    networks:
      - metadata
    healthcheck:
      test:
        [
          'CMD',
          'node',
          '-e',
          "fetch('http://127.0.0.1:3002/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))",
        ]
      interval: 5s
      timeout: 3s
      retries: 12
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
      METADATA_SERVICE_URL: http://metadata-provider:3002
    volumes:
      - ./.data:/data
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    networks:
      - default
      - metadata
    depends_on:
      metadata-provider:
        condition: service_healthy
networks:
  metadata:
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
- Run `npm run test:docker-lifecycle` from a Bash environment with Docker available to verify first start, generated secrets, authentication, restart, and data persistence. `DOCKER_LIFECYCLE_IMAGE` and `DOCKER_LIFECYCLE_METADATA_IMAGE` reuse existing local images.
- Release packaging details are covered in [Release packaging](./release.md).
