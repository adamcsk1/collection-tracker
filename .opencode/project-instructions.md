# Collection Tracker Project Instructions

Collection Tracker is a self-hosted media catalog application for managing personal movie, series, and book collections. It is built as a TypeScript workspace with Angular frontends, a Fastify backend using SQLite persistence, and a native Android WebView wrapper. Nx core is used for task orchestration, affected project selection, caching, and explicit project metadata; Angular, Cypress, Vitest, ESLint, and server builds run through direct CLI commands.

AI search is powered by Ollama. Local development and Docker Compose read Ollama settings from `ollama.config.json` in the active data folder. Docker Compose does not run Ollama. The default config uses host `http://127.0.0.1:11434`, model `qwen2.5:14b`, embedding model `mxbai-embed-large`, `batchSize: 16`, `parallelRequests: 2`, and `semanticCandidateLimit: 120`. Configured generate `options` are merged over `DEFAULT_OLLAMA_OPTIONS` of `{ "temperature": 0, "top_k": 20, "num_thread": 16, "num_ctx": 16384 }`. Optional root-level `keep_alive` is passed to Ollama generate and embed requests only when present in the config file. Status intents (unfinished/completed/favorite) use derived item fields and may skip the language model for pure status queries. Unfinished/completed pre-filters apply only on tracking; favorite applies on all lists. Pure status short-circuits do not require Ollama to be up.

OMDb metadata requests use `DEFAULT_OMDB_API_URL` (`https://www.omdbapi.com/`) and time out after 10 seconds. The active data-folder `.env` can override the endpoint with `OMDB_API_URL`; missing and empty values use the constant default.

Book metadata requests use Open Library without an API key. `OPENLIBRARY_API_URL` can override `DEFAULT_OPENLIBRARY_API_URL` (`https://openlibrary.org/`). Book items use normalized ISBN-13 external identities, `content_type = 'book'`, and `list_type = 'books'`.

Server startup requires non-empty `JWT_SECRET` and `COOKIE_SECRET` values and an explicitly configured `SALT`. Docker creates persistent random values when `/data/.env` is missing and never replaces an existing file. `SALT` participates in persisted hashes and must not be changed after data is created; an explicit empty value is supported only to preserve legacy deployments that previously ran without a configured salt.

Rate limiting defaults to `120` requests per IP per minute globally, `10` for sign-in and sign-up through `AUTH_RATE_LIMIT`, `60` for session refresh through `REFRESH_RATE_LIMIT`, `60` for public and authenticated health through `HEALTH_RATE_LIMIT`, and `240` for image proxy and public background-image list requests through `IMAGE_RATE_LIMIT`. A refresh `429` preserves browser login state so a later request can retry. Reverse-proxy deployments must configure `TRUSTED_PROXY_CIDRS` so unrelated clients do not share one rate-limit identity.

The API base remains `/api/v1`, but the old endpoint paths were replaced without compatibility aliases. Canonical endpoint families are `/auth`, `/users/me`, `/collection-items`, `/external-metadata`, `/images`, and `/ai`; public `/health` returns aggregate status and authenticated `/users/me/health` returns diagnostics. Public `GET /images/background` returns cached poster source URLs from data-folder `background.config.json` (IMDb IDs, create-if-missing). After startup the server resolves those IDs through the IMDb metadata provider when a key is configured and caches missing posters. Unauthenticated `/images/proxy` serves only that allowlist from cache. All JSON success responses use `{ data }`. Cursor pages use `{ data: [], page: { limit, hasMore, nextCursor } }`; successful `204` responses and binary responses are not enveloped. All JSON errors use RFC 9457 `application/problem+json` responses.

Collection pages use signed cursor pagination with a maximum limit of `100` and no exact total. Normal collection queries use SQLite keyset pagination ordered by `createdAt` or `alphabet` plus item `id`. Cursor tokens are HMAC-signed and bound to the viewer, filters, ordering, and matched identities. Matched AI results preserve in-memory rank order and store the last visible rank and item ID as the signed keyset boundary because rank is not a database sort key.

## Docker Deployment Environment Variables

| Variable              | Default                  | Description                                                                                                        |
| --------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `BASE_PATH`           | _(empty)_                | URL subpath prefix (e.g. `/collection-tracker`). When set, all apps and the API are served under this path.        |
| `HEALTH_CHECK_URL`    | `http://127.0.0.1:3001/` | URL the server uses to verify nginx frontend status. Override when `BASE_PATH` changes the reachable root path.    |
| `HEALTH_RATE_LIMIT`   | `60`                     | Public health and authenticated health-diagnostics requests allowed per client IP per minute.                      |
| `IMAGE_RATE_LIMIT`    | `240`                    | Image proxy and public background-image list requests allowed per client IP per minute.                            |
| `TRUSTED_PROXY_CIDRS` | _(empty)_                | Comma-separated outer reverse-proxy IPs/CIDRs allowed to supply the original client address.                       |
| `APP_PORT`            | `3001`                   | Host port mapped to the container's nginx listener.                                                                |
| `APP_UID`             | `1000`                   | Runtime user ID used for writable Docker files. Set to `$(id -u)` on Linux hosts so `./.data` remains accessible.  |
| `APP_GID`             | `1000`                   | Runtime group ID used for writable Docker files. Set to `$(id -g)` on Linux hosts so `./.data` remains accessible. |

## Apps

| App                   | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| `apps/client`         | Main collection management UI                                 |
| `apps/health`         | Server health status dashboard                                |
| `apps/login`          | Authentication UI (sign-in / sign-up)                         |
| `apps/server`         | Fastify REST API                                              |
| `apps/dev-proxy`      | Local dev gateway serving everything through `localhost:4200` |
| `apps/collection-e2e` | Cypress E2E tests                                             |

## Standalone Projects

| Project   | Purpose                                               |
| --------- | ----------------------------------------------------- |
| `android` | Native Android WebView wrapper for deployed instances |

## Shared Libraries

| Library           | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| `libs/components` | Standalone Angular UI components                 |
| `libs/services`   | Angular services and signal stores               |
| `libs/shared`     | Models, constants, styles, animations, utilities |
| `libs/public`     | Static assets and PWA metadata                   |

## TypeScript Path Aliases

```text
@client/*     -> apps/client/src/app/*
@health/*     -> apps/health/src/app/*
@login/*      -> apps/login/src/app/*
@server/*     -> apps/server/src/*
@components/* -> libs/components/src/lib/*
@services/*   -> libs/services/src/lib/*
@shared/*     -> libs/shared/src/lib/*
@public/*     -> libs/public/src/lib/*
```

Cross-project imports must use a declared `@alias/*` path. Relative imports are acceptable within the same app or library.

## Commands

```bash
npm start               # Start all services in dev
npm run build           # Production build
npm run lint:check      # ESLint check, including CSS via @eslint/css
npm run lint            # ESLint fix
npm run typecheck       # TypeScript check
npm run format:check    # Prettier check
npm run test            # Unit tests with Vitest
npm run test:affected   # Test projects affected by local changes
npm run test:docker-lifecycle  # Docker first-start, restart, auth, and persistence integration test
npm run cypress:chrome  # Cypress E2E tests
cd android && ./gradlew testDebugUnitTest  # Android JVM unit tests
cd android && ./gradlew assembleDebug      # Android debug APK build
```

## Dev URLs

- Gateway: `http://localhost:4200/`
- Client: `http://localhost:4200/client/`
- Health: `http://localhost:4200/health/`
- Login: `http://localhost:4200/login/`
- API: `http://localhost:4200/api/v1/`

## Working In This Codebase

Always read the relevant source files before making changes. Do not suggest or apply modifications based on assumptions.

When adding or removing apps, libraries, routes, build scripts, or runtime requirements, keep all of the following in sync:

- `.opencode/project-instructions.md` - Apps table, path aliases, dev URLs, and project conventions
- `README.md` - Workspace section and quick start URLs
- `docs/README.md` - Documentation index
- The relevant page in `docs/` - create one if the app or library has none yet

When adding, removing, or changing any server API endpoint or its request/response shape, also update `apps/server/public/server-api.yaml`.

## Testing

Tests use Vitest and live next to the source file: `foo.ts` to `foo.spec.ts`.

Android JVM unit tests live under `android/app/src/test/kotlin` and run with `./gradlew testDebugUnitTest` from the `android` directory. Android Gradle commands require Java 17 or newer.
The Android project uses AGP 9+, which provides Kotlin support directly; do not add `org.jetbrains.kotlin.android` unless the Android Gradle plugin version requires it.

When changing a source file, update its spec file when behavior, dependencies, imports, branches, or assertions change. Add cases for new code paths. Run `npm run test` before committing; all tests must pass.

When tests fail, diagnose the root cause first. If the failure exposes a bug in production code, fix production code. Only update the test when production code is correct and the test is genuinely out of date.

Patterns by type:

- Utilities: plain `describe`/`it`, import directly, assert outputs.
- Angular components: `TestBed.configureTestingModule`, `provideStore(...)` for signal stores, `vi.useFakeTimers()` where timers are involved.
- Server APIs: use shared test helpers from `apps/server/test/mocks/`, including `buildApp`, `mockResponse`, and `getDatabase()` when seeding or asserting database state.
- Android: keep pure Kotlin helper logic separate from Activity/WebView framework code when practical so it can be tested without Android framework mocks.

Always follow the existing test style in the file being tested.

## E2E Tests

E2E tests live in `apps/collection-e2e/src/` and run against the Docker test container on port `2999`. The `.opencode/agents/testing.md` agent file contains the full Cypress conventions.

## Commit Conventions

Format: `type(scope): short imperative summary`.

- Use imperative mood.
- Lowercase after the colon.
- No trailing period.
- Keep the summary at or under 72 characters.
- Body explains why, not what.

Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`.

Scopes: `client`, `server`, `login`, `health`, `e2e`, `components`, `services`, `shared`, `public`, `dev-proxy`, `tsconfig`, `build`, `ai`, `git`, `vscode`, `hooks`, `i18n`.

## Code Conventions

- Angular code uses standalone components and directives with explicit selectors. Do not add NgModules.
- App component selectors use `ct-*`.
- Shared library component selectors use `libc-*`.
- Use the selector as the tag in templates.
- State uses signal stores from `ngx-simple-signal-store`, not traditional services or subjects.
- Prettier uses 120 character line width and single quotes.
- ESLint uses flat config and includes CSS through `@eslint/css`.
- CSS should use CSS nesting for related selectors, pseudo-classes, and component-local child selectors instead of repeating full selector chains.
- Husky runs lint and format checks on commit.
- Parameter names must be descriptive. Do not use single-letter or abbreviated names except `a`/`b` in sort comparators and `arg`/`args`/`argv` in CLI argument handling.
- Keep interfaces and type aliases in dedicated `*-model.ts` files, constants in dedicated `*-const.ts` files, and reusable runtime helpers in utility files rather than combining them. Exception: signal-store state interfaces and store-only type aliases stay in the matching `*-store.ts` file.
- Each server route `*-api.ts` registrar must register exactly one HTTP operation. Different methods on the same path use separate files; plugin registrars such as `docs-api.ts` are exempt.
- User-visible template text should use `NgxSignalTranslateService.translate()` from computed signals on a
  protected `translations` property. Keep the injected service private.
- New interactive and landmark elements should include stable `data-test-id` attributes for Cypress.

## Architecture Constraints

- Database changes stay server-side. Use the existing SQLite database layer, repository modules, and migrations for schema changes.
- Shared code belongs in `libs/`.
- Android wrapper code belongs in `android/`; do not couple it to web app internals or server internals.
- Apps must not import from other apps.
- Cross-project imports must use declared path aliases.
- Prefer small direct changes over speculative abstractions.

## TypeScript Error Policy

- Never suppress errors with `ignoreDeprecations`, `@ts-ignore`, `@ts-expect-error`, or path-alias hacks.
- `tsconfig.json` must not use `baseUrl`.
- All `paths` values use explicit `./` prefixes.
- All imports must use a declared `@alias/*` path or a relative path.
- Server spec imports in `apps/server/src/apis/*.spec.ts` use relative paths `../../test/mocks/build-app-mock` and `../../test/mocks/response-mock`.
