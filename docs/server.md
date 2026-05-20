# Server Application

Source: [`apps/server`](../apps/server)

`apps/server` is the Express backend for Collection Tracker. It exposes the `/api/v1` HTTP API, manages authentication, and persists user content and configuration in SQLite.

## Responsibilities

- sign-up, sign-in, logout, and access-token lifecycle management
- CRUD for per-user collection items stored in SQLite
- tag configuration and user-settings persistence
- SQLite database initialization and schema migrations
- OMDb API proxying — forwards search and item lookups to OMDb using the server-side `OMDB_API_KEY` environment variable
- AI search proxying — forwards IMDB-ID-based queries to Ollama using `ollama.config.json` in the active data folder
- runtime safeguards such as Helmet, no-cache, CORS validation, request limits, and cookie parsing

## Runtime Model

- Default data folder: `.data`
- CLI flags: `--dataFolder=<path>` and `--debug=true|false`
- Startup expects `.env` in the active data folder and loads it before registering APIs; `OMDB_API_KEY` must be set for the server to start; AI search reads `ollama.config.json` from the active data folder and merges configured options over `DEFAULT_OLLAMA_OPTIONS` of `{ "temperature": 0, "top_k": 10, "num_thread": 4 }`; Ollama availability is checked by the AI query API rather than during server startup
- `RATE_LIMIT` — default maximum number of requests per 15-minute window per IP. Defaults to `100` when not set. Collection entry workflow routes use their own higher per-route limit so adding several items in a row does not exhaust a small global bucket. Set a big enough number to avoid rate limiting (used by the E2E test container)
- `LOG_LEVEL` — controls console log verbosity. Defaults to `info` when not set. Set to `DEBUG` to echo all log levels (info, warning, error, debug) to the console, equivalent to `--debug=true`
- `nx run server:preserve` creates `.data/.env` and `.data/ollama.config.json` from [`apps/server/scripts`](../apps/server/scripts) for local development
- Production deployments should run behind an HTTPS reverse proxy; see [Docker deployment](./docker.md)

## Data Layout

- `database/collection-tracker.sqlite`
- `ollama.config.json` — Ollama host, model, optional root-level `keep_alive`, generate options, optional `batchSize`, and optional `parallelRequests` for AI search
- `logs/`
- `cache/` — image proxy cache files and metadata

Collection items, users, tokens, settings, tags, and genres are stored in SQLite tables managed by migrations in [`apps/server/src/migrations`](../apps/server/src/migrations).

## Important Paths

- [Entrypoint](../apps/server/src/bootstrap.ts)
- [Server startup](../apps/server/src/core/main.ts)
- [API registration](../apps/server/src/apis/index.ts)
- [Development environment bootstrap](../apps/server/scripts/create-dev-env.js)

## Nx Targets

```powershell
npx nx serve server
npx nx build server --configuration=production
npx nx test server
npx nx lint server
npx nx run server:typecheck
npx nx run server:typecheck-spec
npx nx run server:format-check
npx nx run server:preserve
```

## Related Documentation

- [Server API reference](../apps/server/public/server-api.yaml) — also served interactively at `/api/docs` when the server is running
- [Docker deployment](./docker.md)
