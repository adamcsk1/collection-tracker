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

## Execution

Install the browser binaries once, then run a browser project:

```powershell
npx playwright install chromium firefox
npm run playwright:chrome
# or
npm run playwright:firefox
# Interactive runner (Chromium)
npm run playwright:ui
```

## Operational Notes

- Playwright uses `http://localhost:2999` as its base URL and `data-test-id` as its test ID attribute.
- `npm run playwright:chrome` and `npm run playwright:firefox` run `collection-e2e:prepare` first, which builds the app and metadata-provider images, seeds the database, and starts both containers on a private network with the app published on port `2999`.
- Screenshots and traces for failed tests are written to `apps/collection-e2e/playwright-results`.
- After an interactive session or a failed local run, stop the test containers with `bash apps/collection-e2e/scripts/stop.sh collection-tracker-playwright`.
- The test container's `.env` (`apps/collection-e2e/env/.env`) sets `RATE_LIMIT=10000`, `AUTH_RATE_LIMIT=10000`, and `REFRESH_RATE_LIMIT=10000` to avoid server-side rate limiting. Without these settings, repeated `autoLogin()` calls across the suite would exhaust the global, credential, or refresh budget.
