# Server Application

Source: [`apps/server`](../apps/server)

`apps/server` is the Express backend for Collection Tracker. It exposes the `/api/v1` HTTP API, manages authentication, and persists user content and configuration in SQLite.

## Responsibilities

- sign-up, sign-in, logout, and access-token lifecycle management
- CRUD for per-user collection items stored in SQLite
- tag configuration and user-settings persistence
- SQLite database initialization and schema migrations
- OMDb API proxying — forwards search and item lookups to OMDb using the server-side `OMDB_API_KEY` environment variable
- Claude AI proxying — forwards IMDB-ID-based queries to Claude using the optional `CLAUDE_API_KEY` environment variable; model is configurable via `CLAUDE_MODEL` (defaults to `claude-haiku-4-5-20251001`)
- runtime safeguards such as Helmet, no-cache, CORS validation, request limits, and cookie parsing

## Runtime Model

- Default data folder: `.data`
- CLI flags: `--dataFolder=<path>` and `--debug=true|false`
- Startup expects `.env` in the active data folder and loads it before registering APIs; set `OMDB_API_KEY` there to enable OMDb proxy endpoints; `CLAUDE_API_KEY` is optional — omitting it does not block startup but disables the Claude proxy endpoint
- `RATE_LIMIT` — maximum number of failed requests per 15-minute window per IP. Defaults to `100` when not set. Set a big enough number to avoid rate limiting (used by the E2E test container)
- `LOG_LEVEL` — controls console log verbosity. Defaults to `info` when not set. Set to `DEBUG` to echo all log levels (info, warning, error, debug) to the console, equivalent to `--debug=true`
- `nx run server:preserve` creates `.data/.env` from [`apps/server/scripts/.env.dev`](../apps/server/scripts/.env.dev) for local development
- Production deployments should run behind an HTTPS reverse proxy; see [Docker deployment](./docker.md)

## Data Layout

- `database/collection-tracker.sqlite`
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
