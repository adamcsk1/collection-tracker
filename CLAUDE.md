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
@server-mocks/*      → apps/server/test/mocks/*
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

## E2E Tests (Cypress)

E2E tests live in `apps/collection-e2e/src/` and run against the Docker test container on port `2999`.

### Structure

```
apps/collection-e2e/src/
├── e2e/                     # Spec files — one per page/feature
│   ├── auth.cy.ts
│   ├── collection.cy.ts
│   ├── health.cy.ts
│   ├── about.cy.ts
│   ├── statistics.cy.ts
│   └── tag-configs.cy.ts
├── fixtures/                # Mock data factories for proxy responses
│   ├── collection-item.ts   # buildCollectionItem / buildCollectionItems
│   └── omdb.ts              # buildOmdbSearchResult / buildOmdbItem
├── page-objects/            # Page Object files — one per page
│   ├── sign-in.po.ts
│   ├── sign-up.po.ts
│   ├── collection.po.ts
│   ├── health.po.ts
│   ├── about.po.ts
│   ├── statistics.po.ts
│   └── tag-configs.po.ts
├── support/
│   ├── commands.ts          # Custom Cypress commands
│   ├── commands.d.ts        # TypeScript types for custom commands
│   └── e2e.ts               # Global support entry — imports commands
└── test-setup.ts            # Pre-test bootstrap hook
```

### Rules

- **Element selection** — always use `data-test-id` attributes; never target CSS classes or element types directly. Use `cy.getByTestId('...')` (the custom command wraps `cy.get('[data-test-id="..."]')`).
- **Inputs inside `libc-input`/`libc-select`** — the `data-test-id` is on the host element; use `.find('input')` or `.find('select')` inside the PO method to reach the actual control.
- **Page Objects** — every page/dialog gets a PO file in `page-objects/`. PO files export a plain object of arrow functions — no classes, no state. Test files import from the PO; they never call `cy.get()` directly.
- **Mocking — proxy only** — only `/api/v1/proxy/*` calls (OMDB, Claude AI) are mocked with `cy.intercept`. All other `/api/v1/` endpoints hit the real Docker test server. Never mock sign-in, sign-up, get-all, settings, parser config, tag config, or other real API endpoints.
- **autoLogin** — `cy.autoLogin()` creates a fresh unique user via sign-up (real API), reads the generated secret from the page, then signs in. Each test gets an isolated user with an empty collection. No credentials need to be passed.
- **Seeding test data** — after `cy.autoLogin()`, add pre-existing collection items via `cy.request('POST', '/api/v1/create', { name, content })`. The browser session cookie is shared, so requests are authenticated automatically. Then call `CollectionPage.visit()` to reload with the seeded items.
- **Fixtures** — use factory functions from `fixtures/` to build proxy mock payloads and collection item content strings. The `random-words` package (`generate(...)`) is available for generating random titles in bulk tests.
- **Routes use hash routing** — all Angular apps use `#/route` format. Visit pages with `cy.visit('/login/#/sign-in')`, `cy.visit('/client/#/collection')`, etc.
- **Adding new pages** — when a new page is added to any app, add `data-test-id` attributes to its interactive and landmark elements, create a PO file, and add coverage in the relevant spec file.
- **Adding `data-test-id`** — place the attribute on the host element of `libc-input`, `libc-select`, `libc-autocomplete`, buttons, and semantic container elements (lists, dialogs, banners). Do not add them to purely decorative or repeated structural divs.
- **Dynamic `data-test-id` in `@for` loops** — use `[attr.data-test-id]="'prefix-' + item.key"` to give each repeated element a unique, stable test ID. PO methods accept the key as a parameter (e.g., `getWeightInput(tag: string)`). This pattern is used in `tag-configs.html` where every control is namespaced by tag name.
- **`libc-checkbox` access** — the `data-test-id` is on the `<libc-checkbox>` host; reach the underlying control with `.find('input[type="checkbox"]')`. Use `.check()` / `.uncheck()` rather than `.click()`.
- **Seeding tag configs** — use `cy.request('POST', '/api/v1/tag/change-config', [...TagConfigModel])` to pre-configure tag settings before visiting a page. The GET endpoint is `/api/v1/tag/config`. **Do not seed tag configs via API before visiting the tag-configs page** — the component's constructor effect may run before `preloadUserTagConfigs` resolves, immediately re-POSTing an empty list that overwrites the seeded values. Instead, set config state via the UI after the page has loaded.
- **Internal tags are excluded from tag-configs** — `#movie`, `#series`, and `#watched` are filtered out of the tag-configs page. When writing tag-config tests, seed items that carry a custom tag (e.g., `#action`, `#scifi`) in addition to the type tag. Do **not** use the `buildCollectionItem` default alone; add extra tags on the same line as `#movie`, space-separated (e.g., replace `#movie\n` with `#movie #action\n`). The tags parser regex `/\*\*Tags\*\*\s*(?<tags>.*)/` captures only one line — tags on a separate line are silently ignored.
- **Confirming `window.confirm` dialogs** — stub the native confirm dialog with `cy.on('window:confirm', () => true)` before triggering the action. This is required for any feature that calls `ConfirmService` (e.g., delete, reset tag configs).

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

## TypeScript Error Policy

- **Never suppress errors** — do not use `ignoreDeprecations`, `@ts-ignore`, `@ts-expect-error`, or path-alias hacks to silence TypeScript errors. Fix the root cause.
- **`baseUrl` is removed** — `tsconfig.json` no longer uses `baseUrl`. All `paths` values use explicit `./` prefixes. All imports must use a declared `@alias/*` path or a single-level relative path (`./foo` or `../foo`). Deeper relative paths (`../../`) are not allowed — add a path alias instead.
- **Server spec imports** — imports in `apps/server/src/apis/*.spec.ts` use `@mocks/build-app-mock` and `@mocks/response-mock`.
