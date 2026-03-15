# Server Application

Source: [`apps/server`](../apps/server)

`apps/server` is the Express backend for Collection Tracker. It exposes the `/api/v1` HTTP API, manages authentication, and persists user content and configuration in flat files.

## Responsibilities

- sign-up, sign-in, logout, and access-token lifecycle management
- CRUD for per-user Markdown entries stored on disk
- parser configuration, including user-defined collection filename patterns
- tag configuration and user-settings persistence
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

Parser config records store the Markdown template, parsing regexps, and the user-specific `filenamePattern` used when creating new collection items.

## Why Markdown Files

This app stores collection items as Markdown files on disk instead of in a traditional database.

Originally, this information was managed in Obsidian. That worked for simple note-taking, but it became less convenient as the number of files grew and the vault loaded more slowly. This app keeps the same Markdown-based storage model while adding a dedicated UI and server layer that are better suited for collection management.

Keeping the data in `.md` files also preserves portability. The files can still be moved back into an Obsidian- or Joplin-based workflow if needed, instead of locking the data into a database-specific format.

The current functionality does not require strong database features such as joins, migrations, or complex transactional logic, so flat-file storage remains a simpler and more practical fit.

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
