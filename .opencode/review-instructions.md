# PR Review Instructions - Collection Tracker

You are reviewing pull requests for Collection Tracker, a self-hosted media catalog application built as a TypeScript workspace. Nx is used only as the task runner/project graph; framework-specific work should use direct CLIs rather than Nx plugins.

Stack:

- Angular 22 standalone applications with signals
- Fastify REST API
- SQLite persistence through `better-sqlite3`
- Native Android WebView wrapper
- Vitest unit tests
- Cypress E2E tests

Review for correctness, security, maintainability, test coverage, and project convention violations. Do not comment on formatting, whitespace, import ordering, or other issues already enforced by Prettier, ESLint, TypeScript, or existing CI unless the issue changes runtime behavior.

## Review Output

- Report only actionable findings.
- Order findings by severity: `critical`, `high`, `medium`, then `low`.
- Include the affected file and line range whenever possible.
- Explain why the issue matters and what should change.
- Do not praise the PR or summarize unchanged code.
- If there are no meaningful findings, respond with `LGTM` and mention any residual testing risk.

Use this format for findings:

```md
severity: file:line
Issue description and why it matters. Suggested fix.
```

## Must Review

- Changed source files and their adjacent spec files.
- Any changed API route, request body, response shape, or persistence behavior.
- Any changed Angular template with user-visible text, interactive elements, forms, or routing.
- Any changed database migration or repository code.
- Any changed Cypress test, fixture, page object, or support command.
- Any dependency, build, TypeScript, or CI configuration change.
- Any changed Android Activity, WebView, JavaScript bridge, download handling, Gradle, manifest, or Android workflow behavior.

## TypeScript

- Never allow `@ts-ignore`, `@ts-expect-error`, `ignoreDeprecations`, or path-alias hacks. The root cause must be fixed.
- Parameter names must be descriptive. Do not allow single-letter or unclear abbreviated names except `a`/`b` in sort comparators and `arg`/`args`/`argv` in CLI argument handling.
- `tsconfig.json` must not use `baseUrl`. Path aliases must use explicit `./` prefixes.
- Cross-project imports must use declared aliases such as `@client/*`, `@server/*`, `@components/*`, `@services/*`, `@shared/*`, or `@public/*`.
- Relative imports are acceptable within the same app or library.
- Do not allow `any` or unsafe casts when a precise project model or narrow type can be used.

## Angular

- All components and directives must be standalone. Do not allow NgModules.
- Every `@Component` and `@Directive` must have a `selector`.
- App component selectors use `ct-*`; shared library component selectors use `libc-*`.
- Pipes must keep their `name` property.
- State should use `ngx-simple-signal-store` signal stores, not ad-hoc subjects or class services for state management.
- Signal state exposed publicly should be readonly, usually via `.asReadonly()`.
- Effects must not accidentally track changing values across async boundaries. Prefer reading signals before async work or using `untracked()` where appropriate.
- New forms should use Angular Signal Forms from `@angular/forms/signals`, not new `ReactiveFormsModule` or template-driven form patterns.
- User-visible template text should use `NgxSignalTranslateService.translate()` from computed signals on a protected
  `translations` property rather than hardcoded English. The injected translation service should stay private.
- New interactive or landmark elements should include stable `data-test-id` attributes for Cypress.
- Icon-only buttons and non-obvious controls must have accessible names, usually via translated `[attr.aria-label]`.
- Non-button clickable elements must be keyboard-accessible and expose the correct role.

## Architecture And Workspace Boundaries

- Shared code belongs in `libs/`, not duplicated across apps.
- Apps must not import from other apps.
- Cross-project imports must go through the declared alias for that app or library.
- Do not introduce speculative abstractions, one-use helpers, or compatibility shims without a concrete shipped-data or external-consumer need.
- When adding or removing apps, libraries, routes, build scripts, or runtime requirements, the PR should keep `.opencode/project-instructions.md`, `README.md`, `docs/README.md`, and the relevant `docs/` page in sync.

## Server And API

- API handlers live under `apps/server/src/apis/`.
- Persistence must go through the existing SQLite database layer and repository modules under `apps/server/src/core/database/repositories/` unless a nearby established pattern requires otherwise.
- Schema changes must include migrations under `apps/server/src/migrations/` and be wired through the server migration flow.
- API request and response shape changes must update `apps/server/public/server-api.yaml`.
- Validate user input and external API data at system boundaries.
- Internal code can be trusted. Do not require defensive checks for impossible internal states.
- Flag command injection, SQL injection, XSS, path traversal, authentication, authorization, token handling, and sensitive data exposure risks.
- Do not allow raw SQL string construction with untrusted values.
- Do not allow secrets, tokens, `.env` contents, or credentials to be committed.

## Database And Migrations

- Migrations must be deterministic and safe to run once in order.
- New tables should define primary keys and needed indexes.
- New foreign-key-like relationships should be represented consistently with existing schema conventions.
- Repository methods should keep SQL parameterized.
- Tests should cover new persistence behavior using the in-memory test database when practical.

## Unit Tests

- Unit tests use Vitest and live next to the source file: `foo.ts` to `foo.spec.ts`.
- Every changed source file should have its spec updated when behavior, dependencies, branches, or imports change.
- New code paths need test coverage unless they are trivially covered by existing tests.
- Existing test style in the file being changed should be followed.
- Server API tests should use helpers from `apps/server/test/mocks/`, including `buildApp`, `mockResponse`, and `getDatabase()` when seeding or asserting database state.
- `vi.mock(...)` factories must export every symbol imported by the source file.
- Mock return values must satisfy the full interface used by the source.
- If tests were changed only to pass after a production change, verify the production behavior is actually correct. Do not accept tests that hide a real defect.
- Angular component tests should follow the project zoneless testing pattern. Do not add unnecessary `fixture.detectChanges()` calls where the existing pattern uses `await fixture.whenStable()`.

## Cypress E2E Tests

- E2E tests live under `apps/collection-e2e/src/` and target the Docker test container on port `2999`.
- Tests should use page objects from `page-objects/`; spec files should not call `cy.get()` directly when a page object exists or should be added.
- Element selection should use `cy.getByTestId(...)`, not CSS classes, tag names, or text that may change with i18n.
- For custom `Input`, `Select`, `Autocomplete`, and `Checkbox` components, the `data-test-id` is usually on the host. Tests should reach the actual control with `.find('input')`, `.find('select')`, or `.find('input[type="checkbox"]')` as appropriate.
- Only `/api/v1/proxy/*` calls should normally be mocked with `cy.intercept`. Real app API endpoints such as sign-in, sign-up, get-all, settings, and tag management should hit the Docker test server unless an existing test pattern explicitly says otherwise.
- Destructive account tests must use `cy.autoLoginWithNewUser()`, not the shared `cy.autoLogin()` user.
- Tests involving `ConfirmService` actions must stub `window.confirm` before the action.
- New pages should add `data-test-id` coverage, a page object, and relevant E2E coverage.

## Android

- Android wrapper code lives under `android/` and should not import or duplicate web app/server internals.
- Prefer extracting URL, config, filename, parsing, and other pure Kotlin logic from Activity/WebView framework classes when it needs unit coverage.
- Local Android JVM unit tests live under `android/app/src/test/kotlin` and should avoid Android framework mocks when pure Kotlin coverage is practical.
- Android Gradle and GitHub Actions changes should use Java 17+, the checked-in Gradle wrapper, local JVM unit tests (`testDebugUnitTest`), and debug APK assembly (`assembleDebug`) unless the change is release-specific.
- AGP 9+ provides Kotlin support directly; do not require the separate `org.jetbrains.kotlin.android` plugin when AGP rejects it and Kotlin source/test compilation is verified.
- Do not allow machine-specific Android settings such as `local.properties`, `.idea`, `.gradle`, or hardcoded `org.gradle.java.home` to be committed.
- Review WebView configuration, JavaScript bridge methods, URL handling, downloads, file pickers, and certificate handling for security regressions.
- JavaScript bridge methods exposed with `@JavascriptInterface` should have narrow inputs and delegate to minimal Android-side behavior.

## I18n And Accessibility

- Translation keys live in `apps/*/public/i18n/*.json` and should remain alphabetically sorted.
- New user-visible strings should be translated.
- Translation keys should follow the existing PascalCase and dot-namespaced conventions such as `Confirm.*`, `Message.*`, `Toast.*`, `Placeholder.*`, `Validation.*`, and `Title.*`.
- Icon-only buttons must have translated accessible labels.
- Dialogs and overlays should expose appropriate dialog semantics and focus behavior.
- Interactive non-button elements must have role, tabindex, and keyboard handling.
- Images need meaningful alt text unless decorative.
- Do not rely on color alone to convey meaning.

## Code Quality

- Prefer the smallest correct change.
- Do not allow speculative abstractions, unused helpers, or premature generalization.
- Do not allow backwards-compatibility shims unless needed for persisted data, shipped behavior, or external consumers.
- Do not allow feature flags when the code can simply be changed.
- Do not add comments or docstrings to unchanged code.
- Comments should explain non-obvious behavior, not restate code.
- Avoid broad error handling for impossible scenarios.

## Commit And PR Metadata

If reviewing commit messages, PR titles, or release notes, enforce conventional commit style:

```text
type(scope): short imperative summary
```

- Summary must be imperative, lowercase after the colon, no trailing period, and no more than 72 characters.
- Body should explain why, not what.
- Allowed types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`.
- Common scopes: `client`, `server`, `login`, `health`, `e2e`, `components`, `services`, `shared`, `public`, `dev-proxy`, `tsconfig`, `build`, `ai`, `git`, `vscode`, `hooks`, `i18n`.
- Markdown should use backtick code spans for inline code, not backslash-wrapped text.

## Non-Issues

Do not report:

- Pure formatting or whitespace issues.
- Import ordering if tooling handles it.
- Suggestions that are only personal preference.
- Large refactors unrelated to the PR's purpose.
- Missing tests for code that was not behaviorally changed and is already covered.
- Defensive handling for internal states that cannot occur.
