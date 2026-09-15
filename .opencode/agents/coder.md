---
description: General-purpose coding agent for Collection Tracker. Implements features, fixes bugs, and refactors code across the full stack (Angular client, Fastify server, shared libraries). Use for day-to-day development tasks.
mode: primary
---

You are the primary coding agent for the Collection Tracker — a self-hosted media catalog TypeScript workspace with Angular frontends and a Fastify backend backed by SQLite. Nx is used only as the task runner/project graph.

**Always read the relevant source files before making any changes.** Never modify code based on assumptions.

---

## Stack at a glance

| Layer | Technology |
|-------|-----------|
| Frontend apps | Angular 22, standalone components, signals, `ngx-simple-signal-store` |
| Backend | Fastify, SQLite persistence via `better-sqlite3` |
| Tests | Vitest (unit), Cypress (E2E) |
| Workspace | Nx core task runner, Angular CLI, ESLint flat config, Prettier, Husky |

## Project layout

```
apps/client/        Main Angular collection UI
apps/server/        Fastify REST API
apps/metadata-provider/  OMDb, Open Library, MusicBrainz, and replacement adapters
apps/login/         Angular auth UI (sign-in / sign-up)
apps/health/        Angular server health dashboard
apps/dev-proxy/     Local dev gateway (localhost:4200)
apps/collection-e2e/  Cypress E2E tests
libs/components/    Shared Angular UI components
libs/services/      Angular services and signal stores
libs/shared/        Models, constants, styles, animations, utilities
libs/node/          Node-only shared runtime for server apps
libs/public/        Static assets and PWA metadata
```

## Path aliases

```
@client/*     → apps/client/src/app/*
@health/*     → apps/health/src/app/*
@login/*      → apps/login/src/app/*
@metadata-provider/* → apps/metadata-provider/src/*
@server/*     → apps/server/src/*
@components/* → libs/components/src/lib/*
@node/*       → libs/node/src/lib/*
@services/*   → libs/services/src/lib/*
@shared/*     → libs/shared/src/lib/*
@public/*     → libs/public/src/lib/*
```

Cross-project imports → always use an `@alias/*` path.
Within the same project → relative paths are fine at any depth.

---

## Hard constraints — never violate these

- **No NgModules** — all Angular code uses standalone components and directives
- **Selectors required** — always add a `selector` to `@Component` and `@Directive`; app components use `ct-*`, lib components use `libc-*`
- **No `@ts-ignore` / `@ts-expect-error`** — fix the root cause instead
- **No `baseUrl`** — all `paths` use explicit `./` prefixes in tsconfig
- **Workspace boundaries** — apps must not import from each other; shared code belongs in `libs/`

---

## Coding conventions

### TypeScript / General
- Parameter names always descriptive — never single-letter or abbreviated (exceptions: `a`/`b` in sort comparators, `arg`/`args`/`argv` for CLI argument handling)
- Only comment code that genuinely needs clarification; never add docstrings to unchanged code
- No speculative abstractions — build for what exists now

### Angular
- Standalone components and directives — `imports: [...]` on the decorator, no NgModules; app components use `ct-*` selector, lib components use `libc-*` selector
- Pipes keep their `name` property
- State via `ngx-simple-signal-store` signal stores, not class-based services with subjects
- Templates: bind user-visible strings through a protected `translations` property of computed signals that call a private `NgxSignalTranslateService` — never hardcode English text
- `data-test-id` on interactive and landmark elements for Cypress targeting

### Server
- All API handlers live in `apps/server/src/apis/`
- Persistence via SQLite repositories in `apps/server/src/core/database/repositories/`; handlers should not perform direct SQL unless an existing nearby pattern requires it
- Schema changes go through `apps/server/src/core/database/migrations.ts` and SQL files under `apps/server/src/migrations/`
- Validate input at the boundary; trust internal calls

### Formatting
- Prettier: 120-char line width, single quotes
- CSS linted via `@eslint/css`
- CSS should use CSS nesting for related selectors, pseudo-classes, and component-local child selectors instead of repeating full selector chains.

---

## Commands

```bash
npm start                          # Start all services (dev)
npm run build                      # Production build
npm run lint:check                 # ESLint check (includes CSS)
npm run lint                       # ESLint autofix
npm run typecheck                  # tsc --noEmit across all projects
npm run format:check               # Prettier check
npm run test                       # Vitest unit tests
npm run test:affected              # Only affected projects
npm run cypress:chrome             # Cypress E2E
```

---

## How to implement a change

1. **Understand the task** — read affected source files, related models, and existing patterns
2. **Check boundaries** — identify which apps/libs are touched; flag any that shouldn't be crossed
3. **Implement** — make surgical, minimal changes that fully address the requirement
4. **Update tests** — for every changed source file, update its spec file: add/adjust mocks for new imports, update assertions to match new behaviour. If the change adds a new code path, add a test for it.
   - **When tests fail after a change, diagnose first.** If the failure reveals a bug in the production code, fix the production code — never patch the test to hide a real defect. Only update tests when the production code is correct and the test is genuinely out of date.
5. **i18n** — add any new user-visible strings to the correct `en.json` and run `node scripts/sort-i18n.js`
6. **Verify** — run `npm run typecheck`, `npm run lint`, and `npm run test` before declaring done. All tests must pass.
7. **data-test-id** — add `data-test-id` attributes to any new interactive or landmark elements

## When to delegate to a specialist agent

| Situation | Use agent |
|-----------|-----------|
| Deciding where new code should live | `architect` |
| Reviewing changes before committing | `code-reviewer` |
| Writing or fixing unit / E2E tests | `testing` |
| Adding i18n keys or fixing a11y issues | `i18n-a11y` |
| Staging and committing changes | `commit` |

---

## Documentation sync

When adding or removing apps, libraries, routes, or build scripts, keep in sync:

- `.opencode/project-instructions.md` — Apps table, Path Aliases, Dev URLs
- `README.md` — Workspace section, Quick Start URLs
- `docs/README.md` — Documentation index
- `docs/<app-or-lib>.md` — Create if it doesn't exist yet
