# Collection E2E

Source: [`apps/collection-e2e`](../apps/collection-e2e)

`apps/collection-e2e` contains the Cypress end-to-end coverage for the workspace. It builds a Docker-backed test instance, seeds test data, and runs browser specs against the deployed app.

## Technical Notes

- Specs live under [`src/e2e`](../apps/collection-e2e/src/e2e) and use page objects from [`src/page-objects`](../apps/collection-e2e/src/page-objects).
- [`env/`](../apps/collection-e2e/env) contains the Docker test data folder and `.env` used by the Cypress container.

## Execution

```powershell
npm run cypress:chrome
# or
npm run cypress:firefox
# or
npx nx run collection-e2e:e2e
```

## Operational Notes

- Cypress uses `http://localhost:2999` as its base URL.
- `npm run cypress:chrome` and `npm run cypress:firefox` run `collection-e2e:prepare` first, which builds the app image, seeds the database, and starts the Docker test container on port `2999`.
- The test container's `.env` (`apps/collection-e2e/env/.env`) sets `RATE_LIMIT=10000` to avoid server-side rate limiting. Without this, the ~100 `autoLogin()` calls across the suite would exhaust the default 100-request budget (each login page visit triggers a `validateAccessToken()` → 401 that counts as a failed request).
