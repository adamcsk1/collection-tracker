<!-- headroom:rtk-instructions -->
# RTK (Rust Token Killer) - Token-Optimized Commands

When running shell commands, **always prefix with `rtk`**. This reduces context
usage by 60-90% with zero behavior change. If rtk has no filter for a command,
it passes through unchanged � so it is always safe to use.

## Key Commands
```bash
# Git (59-80% savings)
rtk git status          rtk git diff            rtk git log

# Files & Search (60-75% savings)
rtk ls <path>           rtk read <file>         rtk grep <pattern>
rtk find <pattern>      rtk diff <file>

# Test (90-99% savings) � shows failures only
rtk pytest tests/       rtk cargo test          rtk test <cmd>

# Build & Lint (80-90% savings) � shows errors only
rtk tsc                 rtk lint                rtk cargo build
rtk prettier --check    rtk mypy                rtk ruff check

# Analysis (70-90% savings)
rtk err <cmd>           rtk log <file>          rtk json <file>
rtk summary <cmd>       rtk deps                rtk env

# GitHub (26-87% savings)
rtk gh pr view <n>      rtk gh run list         rtk gh issue list

# Infrastructure (85% savings)
rtk docker ps           rtk kubectl get         rtk docker logs <c>

# Package managers (70-90% savings)
rtk pip list            rtk pnpm install        rtk npm run <script>
```

## Rules
- In command chains, prefix each segment: `rtk git add . && rtk git commit -m "msg"`
- For debugging, use raw command without rtk prefix
- `rtk proxy <cmd>` runs command without filtering but tracks usage
<!-- /headroom:rtk-instructions -->

# Collection Tracker

A self-hosted media catalog application for managing personal movie and series collections. Built as an Nx monorepo with Angular frontends and an Express backend using flat-file persistence (no database).

## Apps

| App                   | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `apps/client`         | Main collection management UI                                  |
| `apps/health`         | Server health status dashboard                                 |
| `apps/login`          | Authentication UI (sign-in / sign-up)                          |
| `apps/server`         | Express REST API                                               |
| `apps/dev-proxy`      | Local dev gateway — serves everything through `localhost:4200` |
| `apps/collection-e2e` | Cypress E2E tests                                              |

## Shared Libraries

| Library           | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| `libs/components` | Standalone Angular UI components                 |
| `libs/services`   | Angular services and signal stores               |
| `libs/shared`     | Models, constants, styles, animations, utilities |
| `libs/public`     | Static assets and PWA metadata                   |

## TypeScript Path Aliases

```
@client/*     → apps/client/src/app/*
@health/*     → apps/health/src/app/*
@login/*      → apps/login/src/app/*
@server/*     → apps/server/src/*
@components/* → libs/components/src/lib/*
@services/*   → libs/services/src/lib/*
@shared/*     → libs/shared/src/lib/*
@public/*     → libs/public/src/lib/*
```

## Commands

```bash
npm start               # Start all services (dev)
npm run build           # Production build

npm run lint            # ESLint check (includes CSS via @eslint/css)
npm run lint:fix        # ESLint fix
npm run typecheck       # TypeScript check
npm run format:check    # Prettier check

npm run test            # Unit tests (Vitest)
npm run test:affected   # Test only affected projects
npm run cypress:chrome  # Cypress E2E tests
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

- `.github/copilot-instructions.md` — Apps table, Path Aliases, Dev URLs
- `README.md` — Workspace section, Quick Start URLs
- `docs/README.md` — Documentation index
- The relevant page in `docs/` (create one if the app or library has none yet)

When adding, removing, or changing any server API endpoint or its request/response shape, also update `apps/server/public/server-api.yaml` to reflect the change.

## Testing

Tests use **Vitest** and live next to the source file (`foo.ts` → `foo.spec.ts`).

**When you change a source file, always update its spec file** — adjust mocks for new imports, update assertions for changed behaviour, add cases for new code paths. Run `npm run test` before committing; all tests must pass.

**When tests fail, diagnose the root cause first.** If the failure exposes a bug in the production code, fix the production code. Only update the test when production code is correct and the test is genuinely out of date — never patch a test to hide a real defect.

Patterns by type:

- **Utilities** — plain `describe`/`it`, import directly, assert outputs
- **Angular components** — `TestBed.configureTestingModule`, `provideStore(...)` for signal stores, `vi.useFakeTimers()` where timers are involved
- **Server APIs** — use shared test helpers from `apps/server/test/mocks/` (`buildApp`, `mockResponse`), `vi.mock(...)` for the store

Always follow the existing test style in the file being tested.

## E2E Tests (Cypress)

E2E tests live in `apps/collection-e2e/src/` and run against the Docker test container on port `2999`. See the `testing` agent skill file for the full set of Cypress rules and conventions.

## Commit Conventions

Format: `type(scope): short imperative summary` — imperative mood, lowercase after colon, no trailing period, ≤72 chars. Body explains *why*.

**Types**: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`

**Scopes**: `client`, `server`, `login`, `health`, `e2e`, `components`, `services`, `shared`, `public`, `dev-proxy`; cross-cutting: `tsconfig`, `build`, `claude`, `git`, `vscode`, `hooks`, `i18n`

## Code Conventions

- **Angular**: standalone components and directives with explicit `selector` — no NgModules. App components use the `ct-` prefix (e.g. `selector: 'ct-header'`), lib components use the `libc-` prefix (e.g. `selector: 'libc-toast'`). Use the selector as the tag in templates (`<ct-header>`, `<libc-toast>`, etc.).
- **State**: signal stores (`ngx-simple-signal-store`) over traditional services
- **Formatting**: Prettier — 120 char line width, single quotes
- **Linting**: ESLint flat config + Stylelint
- **Git hooks**: Husky runs lint/format checks on commit
- **Parameter names**: always descriptive — never single-letter or abbreviated names (e.g. `fileName` not `f`); exceptions: `a`/`b` in sort comparators, and `arg`/`args`/`argv` for CLI argument handling are acceptable

## Architecture Constraints

- **No database** — persistence is flat-file only; do not introduce a database dependency
- **No NgModules** — all Angular code uses standalone components and directives with explicit selectors
- **Monorepo boundaries** — respect Nx project boundaries; shared code belongs in `libs/`

## TypeScript Error Policy

- **Never suppress errors** — do not use `ignoreDeprecations`, `@ts-ignore`, `@ts-expect-error`, or path-alias hacks to silence TypeScript errors. Fix the root cause.
- **`baseUrl` is removed** — `tsconfig.json` no longer uses `baseUrl`. All `paths` values use explicit `./` prefixes. All imports must use a declared `@alias/*` path or a relative path. For cross-project imports (importing from a different app or lib), use a declared `@alias/*` path — do not navigate the filesystem with `../../`. Within the same project (same app or lib), relative paths of any depth (`../`, `../../`, `../../../`) are acceptable.
- **Server spec imports** — imports in `apps/server/src/apis/*.spec.ts` use relative paths `../../test/mocks/build-app-mock` and `../../test/mocks/response-mock`.
