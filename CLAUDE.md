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
│   ├── tag-configs.cy.ts
│   └── settings.cy.ts
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
│   ├── tag-configs.po.ts
│   └── settings.po.ts
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
- **autoLogin** — `cy.autoLogin()` signs in as the shared pre-created `cypress` user via the login UI, wipes leftover collection items, then visits `/client/#/collection`. `CT.AppMode` is set to `'full'` in localStorage before sign-in. The Cypress test container disables rate limiting via `RATE_LIMIT=0` in `apps/collection-e2e/env/.env`.
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
- **Settings page** — the settings form saves only `fetchBatchSize`, `theme`, `animatedBackground`, and `language` to the API (`POST /api/v1/user/settings`). Fields like `appMode`, `sensitiveDataStorage`, `clearLocalStorageAfterLogout`, and `settingsLock` are client-only and are not sent to the server. Use `cy.intercept('POST', '/api/v1/user/settings').as('saveSettings')` to assert save behaviour.
- **Settings — conditional sections** — the AppMode, SettingsLock, SensitiveDataStorage, AccountActions, and AccessTokens sections are hidden when `settingsLock` is enabled (stored in localStorage; false for fresh users). The Images refresh and GlobalWatchStatus sections only appear when the AppMode form control is set to `'full'` — changing the select immediately shows them without needing to save first.
- **Settings — mark all watched/unwatched** — both actions require a `window.confirm` stub and iterate over all collection items, calling `PUT /api/v1/change/:name` for each one. `ChangeWatchedStatusService` reads from `mainCollectionState.state.collection()` (the in-memory store), **not** the API directly. Seed items via API and then call `CollectionPage.visit()` to reload the collection page and populate the store before navigating to settings — otherwise the service sees an empty collection and makes no requests.
- **Settings — token dialog** — both "Create New User Token" (`PUT /api/v1/user/change-token`) and "Create Access Token" (`POST /api/v1/user/access-token`) require a `window.confirm` stub and open a dialog (`data-test-id="token-dialog-value"`, `data-test-id="token-dialog-copy"`) showing the generated token.
- **Settings — revoke access token** — the revoke button uses a dynamic `data-test-id` of `settings-revoke-token-{tokenHash}`. Use `SettingsPage.getRevokeTokenButton(tokenHash)` from the PO. Also requires a `window.confirm` stub. The create access token API (`POST /api/v1/user/access-token`) returns `{ accessToken: string }` (the raw token), NOT the tokenHash. To get the hash, call `cy.request('GET', '/api/v1/user/access-tokens')` after creation and read `response.body[0].tokenHash`.
- **Settings — delete user** — requires a `window.confirm` stub, calls `DELETE /api/v1/user` (returns 204), then redirects to `/login/` after a 2-second delay.
- **Settings — destructive account tests** — "Create New User Token" rotates the shared `cypress` user's secret, permanently breaking all subsequent `cy.autoLogin()` calls in the same run (and all future runs). "Delete User" deletes the shared user entirely. The destructive `account actions` describe must use `cy.autoLoginWithNewUser()` — never `cy.autoLogin()`. Failure to isolate will cascade as 401 sign-in failures across all specs that run after `settings.cy.ts`. Non-destructive account-actions tests (e.g., visibility checks) and `access tokens` tests (creating/revoking tokens is harmless) use `cy.autoLogin()`.
- **Settings — background HTTP errors** — `TokenValidationService` calls `preloadUserSettings()` on every page load; if session state is stale, Angular throws an uncaught `HttpErrorResponse`. Since settings tests assert DOM/UI state rather than HTTP error handling, suppress these via a top-level `beforeEach(() => { cy.on('uncaught:exception', () => false); })` in the spec file.
- **AppMode** — stored client-side as `CT.AppMode` in localStorage. Three values: `'basic'` (read-only: no add/edit/delete), `'limited'` (create only), `'full'` (all CRUD). To set a specific mode in a test, call `cy.window().then(win => win.localStorage.setItem('CT.AppMode', mode))` after `cy.autoLogin()`, then use `CollectionPage.visit()` (which includes `cy.reload()`) to force the Angular app to re-read the new value. **Do not use bare `cy.visit('/client/#/collection')` after `autoLogin` — this is a same-URL visit that may not trigger a full reload.** The `autoLogin` command always resets appMode to `'full'`.
- **AppMode UI effects** — `'basic'`: the `add-new` float button does not exist, and the item dialog has no edit/delete/mark-watched buttons. `'limited'`: `add-new` is visible, but item dialog still has no edit/delete/mark-watched (update permission is false). `'full'`: all buttons present.
- **Settings lock** — stored as `CT.SettingLock = 'true'` in localStorage. When enabled, the Settings, Tags, and Parser nav links are hidden (`nav-settings`, `nav-tags`). The SettingsLock checkbox is only visible in the settings form when `appMode !== 'full'`. To enable lock in a test, set both `CT.SettingLock = 'true'` and `CT.AppMode = 'basic'` (or `'limited'`) in localStorage and then use `CollectionPage.visit()` (includes `cy.reload()`) to force the Angular app to re-read the values.
- **Settings unlock** — when settingsLock is on, clicking `data-test-id="about-version"` on the About page 10 times within ~1 second unlocks settings (`CT.SettingLock` is set to `'false'`, nav links reappear). The unlock mechanism is only wired up if `settingsLock` is `true` when the About component initialises. Clicking fewer than 10 times does not unlock.
- **Settings — scrollable page / collapsible sections** — the settings page lives inside `.main-body` (overflow: auto, max-height viewport-relative). Always add `.scrollIntoView()` in PO methods before interacting with elements that may be below the fold. The `<libc-details>` sections persist their open/closed state in localStorage under keys `CT.Details{translated-summary}`: `CT.DetailsBasics`, `CT.DetailsUser`, `CT.DetailsAccess tokens`, `CT.DetailsImages`, `CT.DetailsGlobal watch status`. For fresh users all sections start closed — a closed section renders its content with no height, so Cypress interaction fails with "covered by another element". Call `openSettingsSections()` (sets all five keys to `'true'`) before `SettingsPage.visit()` in any test that needs to interact with section contents. Note: the Images and GlobalWatchStatus sections are only rendered when `form.appMode === 'full'`.
- **Logout** — the logout link (`data-test-id="nav-logout"`) is in the header menu. Clicking it sends `DELETE /api/v1/logout` (returns 204) and then redirects to `/login/`. The menu must be opened first with `data-test-id="nav-menu-button"`. Logout tests live in `auth.cy.ts`.
- **Sync** — the sync link (`data-test-id="nav-sync"`) is in the header menu. Clicking it reloads the collection by calling `GET /api/v1/get-all*`. Use `cy.intercept('GET', '/api/v1/get-all*').as('getAll')` to assert it fires. Sync tests live in `collection.cy.ts`.
- **Parser page** — route `/client/#/parser`, guarded by `settingsLockedGuard` (hidden when settingsLock is on alongside Settings and Tags). The nav link has `data-test-id="nav-parser"`. The form has `data-test-id` attributes on all fields (`parser-md-template`, `parser-filename-pattern`, `parser-imdb-id`, `parser-genre`, `parser-genre-token`, `parser-image`, `parser-imdb-rate`, `parser-tags`, `parser-tag-token`, `parser-title`, `parser-year`, `parser-content`) and buttons (`parser-save`, `parser-preview`, `parser-refresh-start`). All fields use `libc-input` or `libc-textarea` — reach the actual control with `.find('input')` or `.find('textarea')` inside PO methods.
- **Parser — saving config** — Save calls `POST /api/v1/parser/change-config` and returns 200 with the updated config. The form is valid by default (pre-filled with system defaults on page load). Use `cy.intercept('POST', '/api/v1/parser/change-config').as('saveConfig')` to assert save behaviour.
- **Parser — preview** — Preview button calls `onGeneratePreview()` which opens a `window.alert()` (not a `window.confirm()`). Assert with `cy.on('window:alert', stub)` and verify the stub was called.
- **Parser — refresh templates** — Refresh Start button calls `onRefreshTemplates()` which calls `ConfirmService.ifConfirmed()`, triggering a native `window.confirm`. Stub with `cy.on('window:confirm', () => true)` to confirm; returning `false` cancels without error.
- **Parser — user isolation** — parser config is per-user and stored server-side. Parser tests must use `cy.autoLoginWithNewUser()` to avoid polluting or depending on the shared `cypress` user's config. Do not use `cy.autoLogin()` in parser tests.
- **Parser — `cy.type()` with template syntax** — strings containing `{{...}}` (e.g., `{{Year}}`, `{{Title}}`) must use `{ parseSpecialCharSequences: false }` in the `cy.type()` options, otherwise Cypress interprets `{` as a special character sequence and throws an error.
- **`scrollIntoView()` inside overflow containers** — for `libc-input` elements inside `libc-details` or `.main-body`, always call `.find('input').scrollIntoView()` (scroll the inner `input`, not the host) so the actual control scrolls into the viewport. Scrolling only the host element may leave the inner control clipped by the overflow container.

## Commit Conventions

Format: `type(scope): short imperative summary`

**Types**: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`

**Scopes** — app/lib names: `client`, `server`, `login`, `health`, `e2e`, `components`, `services`, `shared`, `public`, `dev-proxy`; cross-cutting: `tsconfig`, `build`, `claude`, `git`, `vscode`, `hooks`, `i18n`

**Rules**: imperative mood, lowercase after colon, no trailing period, ≤72 chars on subject line. Body explains *why*, not *what*.

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
