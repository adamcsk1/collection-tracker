# Server Application

Source: [`apps/server`](../apps/server)

`apps/server` is the Express backend for Collection Tracker. It exposes the `/api/v1` HTTP API, manages authentication, and persists user content and configuration in flat files.

## Responsibilities

- sign-up, sign-in, logout, and access-token lifecycle management
- CRUD for per-user Markdown entries stored on disk
- parser configuration, tag configuration, and user-settings persistence
- flat-file database initialization and synchronization
- runtime safeguards such as Helmet, no-cache, CORS validation, request limits, and cookie parsing

## Runtime Model

- Default data folder: `.data`
- CLI flags: `--dataFolder=<path>` and `--debug=true|false`
- Startup expects `.env` in the active data folder and loads it before registering APIs
- `nx run server:preserve` creates `.data/.env` from [`apps/server/scripts/.env.dev`](../apps/server/scripts/.env.dev) for local development
- Production deployments should run behind an HTTPS reverse proxy; see [Docker deployment](./docker.md)

## Data Layout

- `database/users.json`
- `database/parser-configs.json`
- `database/tag-configs.json`
- `database/user-settings.json`
- `store/<userHash>/`
- `logs/`

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

- [Server API reference](./server-api.md)
- [Docker deployment](./docker.md)
