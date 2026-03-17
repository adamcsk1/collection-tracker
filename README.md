# Collection Tracker

Collection Tracker is an Nx monorepo for a self-hosted movie and series catalog. The workspace combines Angular applications for authentication and collection management, an Express API, shared libraries, Cypress coverage, and delivery assets for Docker and Android.

## Project Goal

Collection Tracker started as an experimental project for trying new ideas quickly while solving a practical need: keeping a family movie and series collection organized in one place. The goal is to provide a self-hosted tracker for physical and digital media that stays simple to run, flexible to extend, and easy to adapt to different collection workflows.

The project is open to contributions, feedback, and suggestions that improve usability, maintainability, and long-term value for people who want a practical way to manage their collections.

## Technology

- Angular with Nx
- Express for the API
- Vitest for unit tests and Cypress for end-to-end coverage
- Flat-file persistence in a configurable data directory
- Android WebView wrapper for mobile distribution

## Workspace

- `apps/client`: main application for collection management, statistics, parser configuration, tag configuration, and user settings
- `apps/login`: authentication-only application for sign-up and sign-in
- `apps/server`: API, authentication, and flat-file persistence
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
- Android studio

## Quick Start

```powershell
npm install
npm start
```

`npm start` bootstraps `.data/.env` when needed and starts the local development stack:

- gateway: `http://localhost:4200/`
- login: `http://localhost:4200/login/`
- client: `http://localhost:4200/client/`
- API: `http://localhost:4200/api/v1/`

Common workspace commands:

```powershell
npm run build
npm run test
npm run e2e
npm run lint
npm run stylelint
npm run typecheck
npm run typecheck:spec
npm run format:check
```

## Environment

The server reads runtime configuration from `.data/.env` by default. `npm start` runs `server:preserve`, which creates that file from [apps/server/scripts/.env.dev](./apps/server/scripts/.env.dev) when it is missing.

Minimal runtime example:

```dotenv
JWT_SECRET="your_jwt_secret"
COOKIE_SECRET="your_cookie_secret"
SALT="your_salt"
USER_LIMIT=1
DISABLE_REGISTRATION=0
OMDB_API_KEY="your_omdb_api_key"
```

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
CLAUDE_API_KEY="your_claude_api_key"
CLAUDE_MODEL="claude-haiku-4-5-20251001"
CORS_ORIGIN="*"
CACHE_MAX=200
```

See the server documentation for the full runtime model and data layout.

## Documentation

- [Documentation index](./docs/README.md)
- [Server API documentation](./docs/server-api.md)

## Release

`npm run release:create` builds the applications and creates `release/release-<version>/` with the build output and Docker assets required for packaging.

## License

MIT. See [LICENSE](./LICENSE).
