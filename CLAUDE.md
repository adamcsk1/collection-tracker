# Collection Tracker

A self-hosted media catalog application for managing personal movie and series collections. Built as an Nx monorepo with Angular frontends and an Express backend using flat-file persistence (no database).

## Apps

| App | Purpose |
|-----|---------|
| `apps/client` | Main collection management UI |
| `apps/health` | Server health status dashboard |
| `apps/login` | Authentication UI (sign-in / sign-up) |
| `apps/server` | Express REST API |
| `apps/dev-proxy` | Local dev gateway — serves everything through `localhost:4200` |
| `apps/collection-e2e` | Cypress E2E tests |

## Shared Libraries

| Library | Purpose |
|---------|---------|
| `libs/components` | Standalone Angular UI components |
| `libs/services` | Angular services and signal stores |
| `libs/shared` | Models, constants, styles, animations, utilities |
| `libs/public` | Static assets and PWA metadata |

## TypeScript Path Aliases

```
@client/*   → apps/client/src/app/*
@health/*   → apps/health/src/app/*
@login/*    → apps/login/src/app/*
@server/*   → apps/server/src/*
@components/* → libs/components/src/lib/*
@services/* → libs/services/src/lib/*
@shared/*   → libs/shared/src/lib/*
@public/*   → libs/public/src/lib/*
```

## Commands

```bash
npm start               # Start all services (dev)
npm run build           # Production build

npm run lint            # ESLint check
npm run lint:fix        # ESLint fix
npm run stylelint       # CSS lint
npm run stylelint:fix   # CSS lint fix
npm run typecheck       # TypeScript check
npm run format:check    # Prettier check

npm run test            # Unit tests (Vitest)
npm run test:affected   # Test only affected projects
npm run e2e             # Cypress E2E tests
```

## Dev URLs

- Gateway: `http://localhost:4200/`
- Client: `http://localhost:4200/client/`
- Health: `http://localhost:4200/health/`
- Login: `http://localhost:4200/login/`
- API: `http://localhost:4200/api/v1/`

## Working in This Codebase

Always read the relevant source files before making changes. Do not suggest or apply modifications based on assumptions — understand the existing code first.

When adding or removing apps, libraries, routes, Nx targets, or runtime requirements, keep all of the following in sync:

- `CLAUDE.md` — Apps table, Path Aliases, Dev URLs
- `README.md` — Workspace section, Quick Start URLs
- `docs/README.md` — Documentation index
- The relevant page in `docs/` (create one if the app or library has none yet)

## Testing

Tests use **Vitest** and live next to the source file (`foo.ts` → `foo.spec.ts`).

Patterns by type:

- **Utilities** — plain `describe`/`it`, import directly, assert outputs
- **Angular components** — `TestBed.configureTestingModule`, `provideStore(...)` for signal stores, `vi.useFakeTimers()` where timers are involved
- **Server APIs** — use shared test helpers from `apps/server/test/mocks/` (`buildApp`, `mockResponse`), `vi.mock(...)` for the store

Always follow the existing test style in the file being tested.

## Code Conventions

- **Angular**: standalone components only, no NgModules
- **State**: signal stores (`ngx-simple-signal-store`) over traditional services
- **Formatting**: Prettier — 120 char line width, single quotes
- **Linting**: ESLint flat config + Stylelint
- **Git hooks**: Husky runs lint/format checks on commit
- **Parameter names**: always descriptive — never single-letter or abbreviated names (e.g. `fileName` not `f`); exception: `a`/`b` in sort comparators is acceptable convention

## Architecture Constraints

- **No database** — persistence is flat-file only; do not introduce a database dependency
- **No NgModules** — all Angular code uses standalone components
- **Monorepo boundaries** — respect Nx project boundaries; shared code belongs in `libs/`
