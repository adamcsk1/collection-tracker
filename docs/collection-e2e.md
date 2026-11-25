# Collection E2E

Source: [`apps/collection-e2e`](../apps/collection-e2e)

`apps/collection-e2e` contains the Playwright end-to-end coverage for the workspace. It builds a Docker-backed test instance, seeds test data, and runs browser specs against the deployed app.

## Technical Notes

- Specs live under [`src/e2e`](../apps/collection-e2e/src/e2e) and use page-object factories from [`src/page-objects`](../apps/collection-e2e/src/page-objects).
- [`env/`](../apps/collection-e2e/env) contains the Docker test data folder and `.env` used by the Playwright container.
- `item-sharing.spec.ts` covers first-scope permission setup, permission reuse and cleanup, tri-state confirmation,
  selected-scope creation, received-item re-share prevention, and physical book routing against the real server.
- Tests run serially because the shared `playwright` user is cleaned by `autoLogin()` before each test.
- Playwright owns these `.spec.ts` files; the root Vitest configuration excludes the E2E project.
- Accessibility specs run axe against authentication, selected client and health routes, and representative dialogs in both browser projects. Full results are attached to the Playwright report. These scans do not replace keyboard and screen-reader testing.
- `accessibility-regressions.spec.ts` covers settings navigation at 320, 1000, and 1440 pixels in light/dark themes,
  library autocomplete suggestions, populated statistics and native summary names, selected tag colours, empty and
  populated shares, titled completed episodes, and keyboard focus on About links. Its expanded scans use WCAG A/AA
  tags only: known best-practice heading/region findings are outside these scans, not suppressed WCAG failures.
  Existing accessibility scans retain their best-practice checks. Statistics screenshots and full axe results are
  attached to the report; chart palette and theme contrast calculations are covered by unit tests.
- The focused regressions also exercise Enter/Tab focus through every Functions control, including scrolling at
  320×256; sign-in and sign-up from branding to the last control with API URL expanded and WCAG text spacing;
  selected media chips after removing hover/focus in both themes (3:1 contrast measured from screenshot pixels);
  a persistent no-results live status without focus movement; and field-linked season 51/episode 101 errors with
  successful real-server saving at the corrected 50/100 limits. These checks do not claim actual NVDA speech,
  native browser zoom, or exhaustive visual contrast coverage.

## Execution

Install the browser binaries once, then run a browser project:

```powershell
npx playwright install chromium
node node_modules/playwright-firefox-patched/cli.js install firefox
npm run playwright:chrome
# Focused WCAG regressions, after collection-e2e:prepare has started the test instance
npx playwright test --config apps/collection-e2e/playwright.config.ts --project=chromium accessibility-regressions.spec.ts
# or
npm run playwright:firefox
# Interactive runner (Chromium)
npm run playwright:ui
```

## Operational Notes

- CI builds the apps and both Docker images once, then transfers the compressed images through a one-day Actions
  artifact. Each browser runs one accessibility job and two functional shards, with a separate seeded database and
  containers per job. Tests remain serial within each job; local commands are unchanged. The accessibility selection
  includes all `accessibility*.spec.ts` files and the health diagnostics contrast test; functional shards run the
  complementary selection. Result artifacts include the browser and suite name. Increase the functional matrix entries
  and their `shard` denominators together if more parallelism is needed. Image transfer and runner availability affect
  the actual speedup.
- Firefox temporarily uses build 1578 from the exact `playwright-firefox-patched` package alias, while the test runner
  and Chromium stay on their existing versions. This build fixes the cross-world ARIA reflection crash tracked in
  [Playwright #43967](https://github.com/microsoft/playwright/issues/43967) and
  [Mozilla bug 2090055](https://bugzilla.mozilla.org/show_bug.cgi?id=2090055). Install it with the command above in local
  and CI environments. Remove the alias and `executablePath` override once stable Playwright ships the browser fix.
  `aria-reflection.spec.ts` covers page-world and locator-world reads without changing application markup or axe rules.
- Playwright uses `http://localhost:2999` as its base URL and `data-test-id` as its test ID attribute.
- `npm run playwright:chrome` and `npm run playwright:firefox` run `collection-e2e:prepare` first, which builds the app and metadata-provider images, seeds the database, and starts both containers on a private network with the app published on port `2999`.
- Screenshots and traces for failed tests are written to `apps/collection-e2e/playwright-results`.
- After an interactive session or a failed local run, stop the test containers with `bash apps/collection-e2e/scripts/stop.sh collection-tracker-playwright`.
- The test container's `.env` (`apps/collection-e2e/env/.env`) sets `RATE_LIMIT=10000`, `AUTH_RATE_LIMIT=10000`, and `REFRESH_RATE_LIMIT=10000` to avoid server-side rate limiting. Without these settings, repeated `autoLogin()` calls across the suite would exhaust the global, credential, or refresh budget.
