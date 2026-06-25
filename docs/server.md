# Server Application

Source: [`apps/server`](../apps/server)

`apps/server` is the Fastify backend for Collection Tracker. It exposes the `/api/v1` HTTP API, serves the OpenAPI docs UI, manages authentication, and persists user content and configuration in SQLite.

## Responsibilities

- sign-up, sign-in, logout, and access-token lifecycle management
- CRUD for per-user collection items stored in SQLite, including structured media type, favorite state, matched-item, existence, random-item, and search-suggestion APIs
- tag management, user-settings, user-share, and collection-list display persistence
- statistics summaries, media refresh, external rating refresh, and manage tracker data updates split across movie tracker rows and series progress
- movie tracker items, series tracker season metadata, watched episodes, and watched-state bulk updates
- SQLite database initialization and schema migrations
- OMDb API proxying — forwards search and item lookups to OMDb using the server-side `OMDB_API_KEY` environment variable
- AI search proxying — embeds collection metadata, retrieves semantic candidates, and forwards filtered IMDB-ID-based queries to Ollama using `ollama.config.json` in the active data folder
- runtime safeguards through Fastify plugins for Helmet, no-cache headers, CORS validation, request limits, form bodies, and signed cookies

## Runtime Model

- Default data folder: `.data`
- CLI flags: `--dataFolder=<path>` and `--debug=true|false`
- Startup expects `.env` in the active data folder and loads it before registering APIs; `OMDB_API_KEY` must be set for the server to start; AI search reads `ollama.config.json` from the active data folder and merges configured options over `DEFAULT_OLLAMA_OPTIONS` of `{ "temperature": 0, "top_k": 10, "num_thread": 10, "num_ctx": 8192 }`; Ollama availability is checked by the AI query API rather than during server startup
- `RATE_LIMIT` — default maximum number of requests per 1-minute window per IP. Defaults to `120` when not set. Collection entry workflow routes use their own higher per-route limit so adding several items in a row does not exhaust a small global bucket. Set a big enough number to avoid rate limiting (used by the E2E test container)
- `LOG_LEVEL` — controls console log verbosity. Defaults to `info` when not set. Set to `DEBUG` to echo all log levels (info, warning, error, debug) to the console, equivalent to `--debug=true`
- `npm start` creates `.data/.env` and `.data/ollama.config.json` from [`apps/server/scripts`](../apps/server/scripts) for local development
- Production deployments should run behind an HTTPS reverse proxy; see [Docker deployment](./docker.md)

## Data Layout

- `database/collection-tracker.sqlite`
- `ollama.config.json` — Ollama host, model, embedding model, optional root-level `keep_alive`, generate options, optional `batchSize`, optional `parallelRequests`, and optional `semanticCandidateLimit` for AI search
- `logs/`
- `cache/` — image proxy cache files and metadata

Collection items, users, tokens, settings, shares, collection-list display preferences, series tracker data, tags, and genres are stored in SQLite tables managed by migrations in [`apps/server/src/migrations`](../apps/server/src/migrations). Collection item media type and favorite state are stored as item fields; legacy export imports can derive those values from older system tags.

## Import And Export

- Current collection data exports use `collection-tracker-export` version 3.
- Version 3 collection items include explicit `contentType` and `favorite` fields.
- The import API still accepts version 2 exports and derives `contentType` and `favorite` from legacy `#movie`, `#series`, and `#favorite` tags when those fields are missing.

## Important Paths

- [Entrypoint](../apps/server/src/bootstrap.ts)
- [Server startup](../apps/server/src/core/main.ts)
- [API registration](../apps/server/src/apis/index.ts)
- [Development environment bootstrap](../apps/server/scripts/create-dev-env.js)

## Build And Checks

```powershell
npm start
npm run build:server
npm run test
npm run lint:check
npm run typecheck
npm run typecheck:spec
npm run format:check
```

## Related Documentation

- [Server API reference](../apps/server/public/server-api.yaml) — also served interactively at `/api/docs` when the server is running
- [Docker deployment](./docker.md)
