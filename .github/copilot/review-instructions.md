# Copilot PR Review Instructions — Collection Tracker

You are reviewing a pull request for **Collection Tracker**, a self-hosted media catalog Nx monorepo.
Stack: Angular 21 (standalone components, signals), Express REST API, flat-file persistence, Vitest + Cypress tests.

Only report issues that genuinely matter — bugs, security vulnerabilities, logic errors, convention violations.
**Do not comment on style, formatting, or whitespace** — Prettier and ESLint enforce those automatically.

---

## TypeScript

- Never allow `@ts-ignore`, `@ts-expect-error`, or `ignoreDeprecations` — fix the root cause.
- Cross-project imports must use a declared `@alias/*` path (e.g. `@shared/`, `@components/`, `@server/`). Relative paths are only acceptable within the same project.
- Parameter names must be descriptive — no single-letter or abbreviated names. Exceptions: `a`/`b` in sort comparators; `arg`/`args`/`argv` in CLI argument handling.
- No `baseUrl` in `tsconfig.json` — all paths use explicit `./` prefixes.

## Angular

- **Selectors required** on `@Component` and `@Directive` — app components use the `ct-*` prefix (e.g. `ct-header`), lib components use the `libc-*` prefix (e.g. `libc-toast`).
- **No NgModules** — all Angular code uses standalone components.
- State management via `ngx-simple-signal-store` signal stores — not traditional services or subjects.
- Signal best practices: expose state as `readonly` via `.asReadonly()`; read signals before async boundaries in effects; use `untracked()` to avoid unwanted dependencies.
- Use Angular Signal Forms (`@angular/forms/signals`) for all new forms — not `ReactiveFormsModule` or template-driven forms.
- Component tests use the zoneless pattern: do **not** call `fixture.detectChanges()` — use `await fixture.whenStable()` after acting.
- Pipes keep their `name` property.

## Architecture

- **No database** — persistence is flat-file only. Never introduce a database dependency.
- **No NgModules** — standalone only.
- Shared code belongs in `libs/` — never duplicated across apps.
- Nx project boundaries must be respected: `apps/client`, `apps/server`, `libs/components`, `libs/services`, `libs/shared`, `libs/public`.

## Server / API

- All user input and external API data must be validated at system boundaries.
- No command injection, XSS, path traversal, or other OWASP Top 10 issues.
- Internal code is trusted — don't add defensive checks for impossible internal states.

## Testing

- Unit tests live next to the source file: `foo.ts` → `foo.spec.ts`.
- Server API tests use helpers from `apps/server/test/mocks/` (`buildApp`, `mockResponse`) and `vi.mock(...)` for the store.
- E2E tests live in `apps/collection-e2e/src/` and run against the Docker test container on port `2999`.
- New code paths must have accompanying tests unless trivially covered by existing ones.

## Code Quality

- No speculative abstractions or helpers used in only one place.
- No backwards-compatibility shims for removed code.
- No feature flags when you can just change the code.
- No comments or docstrings added to unchanged code.

## Testing

- Every changed source file must have its spec file updated: adjust mocks for new imports, update assertions for changed behaviour, add cases for new code paths.
- `vi.mock(...)` factory must export every symbol the source imports from the mocked module.
- Mock return values must satisfy the full interface the source uses (e.g. a mocked `spawn` must return `{ on, unref }` if the source calls both).
- **When tests fail, diagnose the root cause first.** If the failure reveals a real bug in the production code, flag it as a `Needs changes` finding — do not accept a test patch that hides a defect.
- New code paths introduced by the PR must have test coverage.

Format: `type(scope): short imperative summary` — imperative mood, lowercase after colon, no trailing period, ≤72 chars.
**Types**: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`
**Scopes**: `client`, `server`, `login`, `health`, `e2e`, `components`, `services`, `shared`, `public`, `dev-proxy`; cross-cutting: `tsconfig`, `build`, `git`, `vscode`, `hooks`, `i18n`
