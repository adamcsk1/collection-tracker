# Collection Tracker

Collection Tracker is a TypeScript workspace for a self-hosted movie, series, and book catalog. Nx core is used for task orchestration, affected project selection, caching, and explicit project metadata; Angular, Cypress, Vitest, ESLint, and server builds run through their direct CLIs.

## Project Goal

Collection Tracker started as an experimental project for trying new ideas quickly while solving a practical need: keeping a family media collection organized in one place. The goal is to provide a self-hosted tracker for physical and digital media that stays simple to run, flexible to extend, and easy to adapt to different collection workflows.

The project is open to contributions, feedback, and suggestions that improve usability, maintainability, and long-term value for people who want a practical way to manage their collections.

## Technology

- Angular CLI applications with Nx task orchestration
- Fastify for the API
- Vitest for unit tests and Cypress for end-to-end coverage
- SQLite persistence in a configurable data directory
- Android WebView wrapper for mobile distribution

## Workspace

- `apps/client`: main application for collection management, statistics, tag management, and user settings
- `apps/health`: server health status dashboard — memory, CPU, disk, load, and frontend status
- `apps/login`: authentication-only application for sign-up and sign-in
- `apps/server`: API, authentication, and SQLite persistence
- `apps/metadata-provider`: OMDb, Open Library, MusicBrainz, and replacement metadata adapters
- `apps/dev-proxy`: single-origin development gateway on `http://localhost:4200`
- `apps/collection-e2e`: Cypress smoke-test project
- `libs/components`: shared standalone Angular UI components
- `libs/services`: shared Angular services and signal stores
- `libs/shared`: models, constants, styles, animations, and utilities
- `libs/node`: Node-only shared runtime used by the server and metadata-provider
- `libs/public`: shared static assets and PWA metadata
- `android`: native Android WebView wrapper for deployed Collection Tracker instances

## Requirements

- Node.js `>= 26.0.0`
- npm
- Docker, only for container builds
- Android Studio, only for Android wrapper work

## Quick Start

```powershell
npm install
npm start
```

`npm start` bootstraps `.data/.env` when needed and starts the local development stack. Local development shares `.data/.env` between the server and metadata-provider. Docker Compose keeps app secrets in `.data/.env` and provider secrets such as `OMDB_API_KEY` in `.metadata/.env`.

- gateway: `http://localhost:4200/`
- login: `http://localhost:4200/login/`
- client: `http://localhost:4200/client/`
- health: `http://localhost:4200/health/`
- API: `http://localhost:4200/api/v1/`

Common workspace commands:

```powershell
npm run build
npm run test
npm run test:docker-lifecycle
npm run cypress:chrome
npm run lint:check
npm run lint
npm run typecheck
npm run typecheck:spec
npm run format:check
```

Release packaging details are covered in [Release packaging](./docs/release.md).

## Docker Deployment

Prebuilt images are published to GitHub Container Registry as `ghcr.io/adamcsk1/collection-tracker:latest` after the main
branch passes the Android, Cypress, format, i18n, lint, test, and typecheck workflows.

Use a deployment compose file like this:

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

On Linux hosts, start it with your user and group IDs so `./.data` remains writable by your user:

```bash
APP_UID=$(id -u) APP_GID=$(id -g) docker compose up -d
```

The checked-in [`docker-compose.yml`](./docker-compose.yml) remains a local-build compose file for source checkouts.
See [Docker deployment](./docs/docker.md) for GHCR tags, runtime variables, Ollama setup, and reverse proxy guidance.

## Environment

The server reads runtime configuration from `.data/.env` by default, including `METADATA_SERVICE_URL`. Local `npm start` also starts `apps/metadata-provider` on `http://127.0.0.1:3002` and shares that same `.data/.env` for `OMDB_API_KEY`. Docker Compose keeps provider secrets in `./.metadata/.env`; copy a non-empty `OMDB_API_KEY` there because the app `.data/.env` value is unused in containers. AI search reads Ollama settings from `.data/ollama.config.json`. Animated backgrounds read IMDb IDs, ISBNs, and MusicBrainz release MBIDs from `.data/background.config.json`. `npm start` runs `apps/server/scripts/create-dev-env.js`, which creates those files from [apps/server/scripts](./apps/server/scripts) when they are missing.

`JWT_SECRET` and `COOKIE_SECRET` must be non-empty, and `SALT` must be explicitly configured. Keep `SALT` unchanged after users or data have been created because it participates in persisted hashes. Docker generates and persists all three values when it creates `/data/.env` on first start; it never replaces an existing file.

Docker deployments also support these container-level variables:

| Variable              | Default                  | Description                                                                                  |
| --------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| `BASE_PATH`           | _(empty)_                | URL subpath prefix, such as `/collection-tracker`.                                           |
| `HEALTH_CHECK_URL`    | `http://127.0.0.1:3001/` | URL used by the server health endpoint to check the nginx frontend.                          |
| `HEALTH_RATE_LIMIT`   | `60`                     | Public health and authenticated diagnostics requests allowed per client IP per minute.       |
| `IMAGE_RATE_LIMIT`    | `240`                    | Image proxy and public background-image list requests allowed per client IP per minute.      |
| `TRUSTED_PROXY_CIDRS` | _(empty)_                | Comma-separated outer reverse-proxy IPs/CIDRs allowed to supply the original client address. |
| `APP_PORT`            | `3001`                   | Host port mapped to the container nginx listener.                                            |
| `APP_UID`             | `1000`                   | Runtime user ID for Docker writable files. Use `$(id -u)` on Linux.                          |
| `APP_GID`             | `1000`                   | Runtime group ID for Docker writable files. Use `$(id -g)` on Linux.                         |

Minimal runtime example:

```dotenv
JWT_SECRET="your_jwt_secret"
COOKIE_SECRET="your_cookie_secret"
SALT="your_salt"
USER_LIMIT=1
DISABLE_REGISTRATION=0
OMDB_API_KEY="your_omdb_api_key"
```

`OMDB_API_KEY` is optional for metadata-provider startup. Set it to enable OMDb search, IMDb ID import, image refresh, rating refresh, and season metadata refresh. `OMDB_API_URL` can override the provider endpoint; when it is omitted or empty, the metadata provider uses `https://www.omdbapi.com/`.

Book metadata uses Open Library and requires no API key. `OPENLIBRARY_API_URL` can override its endpoint; when omitted or empty, the metadata provider uses `https://openlibrary.org/`.

Music metadata uses MusicBrainz and Cover Art Archive and requires no API key. `MUSICBRAINZ_API_URL` can override its endpoint; when omitted or empty, the metadata provider uses `https://musicbrainz.org/ws/2/`. `COVERARTARCHIVE_API_URL` can override Cover Art Archive; when omitted or empty, the metadata provider uses `https://coverartarchive.org/`.

Deployments can replace any built-in metadata adapter through the metadata provider `external-metadata.config.json`. Replacements implement the normalized [external metadata provider contract](./docs/external-metadata-provider-contract.md). Omitted provider slots continue using the built-in adapters.

Ollama config example (`.data/ollama.config.json`):

```json
{
  "host": "http://127.0.0.1:11434",
  "model": "qwen2.5:14b",
  "embeddingModel": "mxbai-embed-large",
  "keep_alive": "15m",
  "options": {
    "temperature": 0,
    "top_k": 20,
    "num_thread": 16,
    "num_ctx": 16384
  },
  "batchSize": 16,
  "parallelRequests": 2,
  "semanticCandidateLimit": 120
}
```

AI search first embeds the prompt and collection items with `embeddingModel`, ranks the best semantic candidates, then asks `model` to filter those candidates and return ordered IMDb IDs.
Status intents such as unfinished/completed/favorite are pre-filtered from derived item fields; pure status queries can skip the language model.
`semanticCandidateLimit` controls how many ranked candidates are sent to the language model after embedding retrieval.
`batchSize` controls how many ranked candidates are sent to Ollama per generate request. When omitted, the full candidate set is sent in a single unbatched request.
`parallelRequests` controls how many Ollama batch requests may run at once. When omitted or invalid, it defaults to `1`.
`keep_alive` is passed to Ollama generate and embed requests when present. When omitted, the API does not send `keep_alive`.
Configured `options` are merged over the server `DEFAULT_OLLAMA_OPTIONS` of `{ "temperature": 0, "top_k": 20, "num_thread": 16, "num_ctx": 16384 }`, so omitted option fields keep their deterministic defaults.

Full runtime example:

```dotenv
PORT=3000
HOST="127.0.0.1"
JWT_SECRET="your_jwt_secret"
COOKIE_SECRET="your_cookie_secret"
SALT="your_salt"
USER_LIMIT=2
DISABLE_REGISTRATION=0
OMDB_API_KEY="your_omdb_api_key"
CORS_ORIGIN="*"
CACHE_MAX=200
RATE_LIMIT=120
AUTH_RATE_LIMIT=10
REFRESH_RATE_LIMIT=60
HEALTH_RATE_LIMIT=60
IMAGE_RATE_LIMIT=240
```

`RATE_LIMIT` controls the default per-IP request limit for a 1-minute window. When omitted, it defaults to `120`. High-frequency collection entry routes have their own higher per-route limit so adding multiple items in a row does not quickly exhaust the default bucket.
`AUTH_RATE_LIMIT` controls sign-in and sign-up requests per IP per minute and defaults to `10`. `REFRESH_RATE_LIMIT` separately controls session refresh requests and defaults to `60`, allowing multiple users and tabs behind one address without weakening credential endpoint protection. `HEALTH_RATE_LIMIT` defaults to `60` for both health endpoints, and `IMAGE_RATE_LIMIT` defaults to `240` for the image proxy. The bundled nginx proxy ignores forwarded client-IP headers unless the immediate sender matches `TRUSTED_PROXY_CIDRS`.

See the server documentation for the full runtime model and data layout.

## Documentation

- [Documentation index](./docs/README.md)
- [Server API documentation](./apps/server/public/server-api.yaml)

## Release

See the [release documentation](./docs/release.md) for packaging, version bump, tag, hash, and Android APK details.

## License

MIT. See [LICENSE](./LICENSE).
