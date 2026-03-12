# Server (apps/server)

A lightweight Express-based API server that powers Collection Tracker. It provides authentication, user management, and CRUD endpoints for per-user markdown entries stored on disk.

## What it does

- Versioned REST API under `/api/v1`
- Token model: user token (for sign-in and rotation) + JWT access token for API (no passwords)
  - Cookie flow (recommended): access token is set as a signed, HttpOnly cookie named `token` with a 15-day expiry. On each cookie-authenticated request the server rotates the token (sliding) and sets a fresh cookie.
  - Header flow: the API also accepts `Authorization: Bearer <token>`; tokens created explicitly for header use are tracked with `expiresAt: null` and are not rotated automatically.
- Token management: create/list/delete access tokens
- Token rotation: rotate user token and issue a fresh access token (invalidates all previous access tokens)
- Account deletion: remove user's store, cache entries, and user record
- Per-user storage in `.data/store/<userHash>` with markdown files
- Per-user parser configuration (Markdown template + regexps) stored in flat-file DB
- Per-user tag configuration (colors/weights/flags) stored in flat-file DB
- Rate limiting, CORS, Helmet, JSON body parsing
- Flat-file DB for users in `.data/database/users.json`
- Simple in-memory read cache

## Tech stack

- Node.js + Express
- TypeScript, built with Nx + esbuild
- helmet, cors, express-rate-limit, body-parser, dotenv

## Layout

- `src/bootstrap.ts` – entrypoint
- `src/core/main.ts` – Express app configuration and startup
- `src/core` – crypto, JWT guard, logger, argv, constants
- `src/apis` – API endpoint registrations
- `src/tools/initializer.ts` – creates required data folders/files
- `scripts/create-dev-env.js` – quick dev env bootstrapper

## Configuration (.env in data folder)

- `HOST` – bind interface (e.g. 127.0.0.1)
- `PORT` – port (e.g. 3000)
- `JWT_SECRET` – JWT signing secret
- `SALT` – salt used for hashing usernames and tokens
- `COOKIE_SECRET` – secret for signing authentication cookies (enables signed cookie auth)
- `CORS_ORIGIN` – allowed origin or `*`
- `DISABLE_REGISTRATION` – `1` to block sign-ups
- `USER_LIMIT` – optional numeric limit on users
- `CACHE_MAX` – maximum number of file entries held in the in-memory LRU cache (default `5000`)

Data subfolders under the selected `dataFolder`:

- `database/` – contains `users.json`, `parser-configs.json`, and `tag-configs.json`
- `store/` – per-user content directories
- `logs/` – daily log files

## CLI flags

- `--dataFolder=<path>` (default `.data`)
- `--debug=true|false` (default `false`)

## Develop & run (Nx)

- Build: `nx run server:build`
- Serve: `nx run server:serve`
- Lint: `nx run server:lint`
- Format: `nx run server:format`
- Prepare dev env: `nx run server:preserve` (creates `.data/` and seeds `.env` from `apps/server/scripts/.env.dev`)

The server reads `.env` from the selected `dataFolder`. Example:

```
nx run server:serve -- --dataFolder=.data --debug=true
```

## Security & limits

- Rate limit: 100 req / 15 min per IP (skips successful requests)
- Helmet enabled; `trust proxy` set to 1
- CORS restricted by `CORS_ORIGIN`
- Request bodies up to 50mb
- Auth cookie: `token` cookie is `HttpOnly`, `Secure`, `SameSite=Strict`, signed, and expires in 15 days. Set `COOKIE_SECRET`.

## Data model

- Users: JSON map keyed by username hash →
  `{ userTokenHash: string; accessTokens: Array<{ tokenHash: string; createdAt: string; userAgent: string; expiresAt: string | null }> }`
- Content: markdown files under each user's store directory; file names are ISO-like timestamps

## API

See `API.md` in this folder for endpoints and payloads.
