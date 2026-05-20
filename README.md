# Collection Tracker

Collection Tracker is an Nx monorepo for a self-hosted movie and series catalog. The workspace combines Angular applications for authentication and collection management, an Express API, shared libraries, Cypress coverage, and delivery assets for Docker and Android.

## Project Goal

Collection Tracker started as an experimental project for trying new ideas quickly while solving a practical need: keeping a family movie and series collection organized in one place. The goal is to provide a self-hosted tracker for physical and digital media that stays simple to run, flexible to extend, and easy to adapt to different collection workflows.

The project is open to contributions, feedback, and suggestions that improve usability, maintainability, and long-term value for people who want a practical way to manage their collections.

## Technology

- Angular with Nx
- Express for the API
- Vitest for unit tests and Cypress for end-to-end coverage
- SQLite persistence in a configurable data directory
- Android WebView wrapper for mobile distribution

## Workspace

- `apps/client`: main application for collection management, statistics, tag configuration, and user settings
- `apps/health`: server health status dashboard — memory, CPU, disk, load, and frontend status
- `apps/login`: authentication-only application for sign-up and sign-in
- `apps/server`: API, authentication, and SQLite persistence
- `apps/dev-proxy`: single-origin development gateway on `http://localhost:4200`
- `apps/collection-e2e`: Cypress smoke-test project
- `libs/components`: shared standalone Angular UI components
- `libs/services`: shared Angular services and signal stores
- `libs/shared`: models, constants, styles, animations, and utilities
- `libs/public`: shared static assets and PWA metadata
- `android`: native Android WebView wrapper for deployed Collection Tracker instances

## Requirements

- Node.js `>= 24.14.0`
- npm
- Docker, only for container builds
- Android Studio, only for Android wrapper work

## Quick Start

```powershell
npm install
npm start
```

`npm start` bootstraps `.data/.env` when needed and starts the local development stack:

- gateway: `http://localhost:4200/`
- login: `http://localhost:4200/login/`
- client: `http://localhost:4200/client/`
- health: `http://localhost:4200/health/`
- API: `http://localhost:4200/api/v1/`

Common workspace commands:

```powershell
npm run build
npm run test
npm run cypress:chrome
npm run lint:check
npm run lint
npm run typecheck
npm run typecheck:spec
npm run format:check
```

## Environment

The server reads runtime configuration from `.data/.env` by default. AI search reads Ollama settings from `.data/ollama.config.json`. `npm start` runs `server:preserve`, which creates both files from [apps/server/scripts](./apps/server/scripts) when they are missing.

Docker deployments also support these container-level variables:

| Variable           | Default                  | Description                                                         |
| ------------------ | ------------------------ | ------------------------------------------------------------------- |
| `BASE_PATH`        | _(empty)_                | URL subpath prefix, such as `/collection-tracker`.                  |
| `HEALTH_CHECK_URL` | `http://127.0.0.1:3001/` | URL used by the server health endpoint to check the nginx frontend. |
| `APP_PORT`         | `3001`                   | Host port mapped to the container nginx listener.                   |

Minimal runtime example:

```dotenv
JWT_SECRET="your_jwt_secret"
COOKIE_SECRET="your_cookie_secret"
SALT="your_salt"
USER_LIMIT=1
DISABLE_REGISTRATION=0
OMDB_API_KEY="your_omdb_api_key"
```

Ollama config example (`.data/ollama.config.json`):

```json
{
  "host": "http://127.0.0.1:11434",
  "model": "qwen2.5:3b",
  "keep_alive": "10m",
  "options": {
    "temperature": 0,
    "top_k": 10,
    "num_thread": 1
  },
  "batchSize": 10,
  "parallelRequests": 1
}
```

`batchSize` controls how many collection items are sent to Ollama per query. When omitted, the entire collection is sent in a single unbatched request.
`parallelRequests` controls how many Ollama batch requests may run at once. When omitted or invalid, it defaults to `1`.
`keep_alive` is passed to Ollama generate requests when present. When omitted, the API does not send `keep_alive`.
Configured `options` are merged over the server `DEFAULT_OLLAMA_OPTIONS` of `{ "temperature": 0, "top_k": 10, "num_thread": 4 }`, so omitted option fields keep their deterministic defaults.

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
RATE_LIMIT=100
```

`RATE_LIMIT` controls the default per-IP request limit for a 15-minute window. High-frequency collection entry routes have their own higher per-route limit so adding multiple items in a row does not quickly exhaust the default bucket.

See the server documentation for the full runtime model and data layout.

## Documentation

- [Documentation index](./docs/README.md)
- [Server API documentation](./apps/server/public/server-api.yaml)

## Release

`npm run release:create` builds the applications and creates `release/release-<version>/` with the build output and Docker assets required for packaging.

## License

MIT. See [LICENSE](./LICENSE).
