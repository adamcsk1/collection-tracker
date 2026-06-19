# Development

This workspace keeps local development simple: direct framework commands do the real work, Nx core coordinates project selection and caching from explicit project metadata, and Cypress runs against a built Docker deployment instead of a loose collection of development servers.

## Cypress Uses A Built Docker Container

The Cypress suite runs against the Docker test container on `http://localhost:2999` because the E2E tests are meant to verify the application as it is deployed, not only as it behaves in a local development server.

Running Cypress this way gives the suite a stable system boundary:

- The same nginx, server bundle, static app output, runtime paths, cookies, and API routing shape are exercised together.
- The database and test data live in the Cypress test data folder, so each run can prepare a known environment without depending on a developer's local data.
- Docker exposes one predictable app URL, which avoids coordinating several independent dev-server ports during browser tests.
- Packaging mistakes are caught earlier because Cypress tests the built image rather than only testing TypeScript source through dev tooling.
- Server runtime settings such as rate limits, data folders, and production-style static serving are close to the real deployment path.

The tradeoff is that `npm run cypress:chrome` and `npm run cypress:firefox` do more work before the browser opens: they build the app image, prepare the database, and start the test container. That is intentional. Cypress is the deployment-level confidence check, while unit tests and type checks stay fast for source-level feedback.

## Development Proxy Verification

The development proxy in `apps/dev-proxy` is development-only infrastructure. It is not part of the production Docker runtime and is not shipped as an application feature, so it does not currently have a dedicated unit test harness.

That is intentional for now. Useful automated coverage would need local upstream HTTP servers or proxy mocks, WebSocket routing checks, cookie rewrite assertions, and error-path assertions. That harness would add maintenance cost around code whose job is to make local development convenient.

When the proxy changes, verify it manually with `npm start` and confirm the gateway starts on `http://localhost:4200`, forwards app routes, forwards `/api`, and keeps browser refresh/WebSocket behaviour working. Add automated tests only if the proxy becomes production-facing, grows substantially more logic, or has repeated regressions.

## Nx Core With Direct CLI Commands

Nx is used as a task runner and project registry with explicit dependency edges, not as the owner of Angular, Cypress, Vitest, ESLint, or server build behaviour.

Each project `project.json` uses `nx:run-commands` targets that call the real tool directly, such as Angular CLI, Cypress, Vitest, ESLint, Prettier, TypeScript, or the server build script. Nx still provides useful workspace-level coordination:

- `run-many` runs the same target across selected projects.
- `affected` selects projects touched by a change.
- The project graph records workspace relationships from `implicitDependencies` in `project.json` files.
- Cacheable targets can reuse safe outputs when their own inputs and dependency inputs have not changed.

This is deliberately simpler than using framework-specific Nx plugins. The previous plugin-heavy setup coupled dependency updates to Nx executor support. When Angular, Cypress, Vitest, ESLint, or build tooling moved faster than Nx plugin compatibility, routine upgrades became blocked by orchestration code rather than application code.

The current model keeps the orchestration thin:

- Angular apps are described in `angular.json`, which the Angular CLI understands directly.
- Cypress uses its own config and commands directly.
- Vitest, TypeScript, ESLint, and Prettier run through their native CLIs.
- The server build is an app-local script at `apps/server/scripts/build-server.js` because it is server-specific packaging logic.
- Workspace boundaries are enforced with ESLint import restrictions instead of a custom boundary script.

Because the framework-specific Nx plugins are intentionally not installed, Nx does not infer TypeScript import edges from Angular or library executors. Project relationships that matter to `affected`, `dependsOn: ["^build"]`, and cache inputs are therefore listed explicitly in each relevant `project.json`. Keep those `implicitDependencies` entries in sync when adding or removing cross-project imports.

This keeps the build system easier to inspect and easier to repair. If a command fails, the failing tool is usually the real tool, not a wrapper executor. If a package needs to be upgraded, the workspace mostly depends on that package's own CLI contract rather than waiting for an Nx plugin to expose it.

The important rule is that direct commands should stay explicit and boring. Avoid reintroducing custom orchestration unless a standard CLI or small project target cannot express the requirement.
