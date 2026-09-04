# Collection E2E

Source: [`apps/collection-e2e`](../apps/collection-e2e)

`apps/collection-e2e` contains the Cypress end-to-end coverage for the workspace. It builds a Docker-backed test instance, seeds test data, and runs browser specs against the deployed app.

## Technical Notes

- Specs live under [`src/e2e`](../apps/collection-e2e/src/e2e) and use page objects from [`src/page-objects`](../apps/collection-e2e/src/page-objects).
- [`env/`](../apps/collection-e2e/env) contains the Docker test data folder and `.env` used by the Cypress container.
- `item-sharing.cy.ts` covers first-scope permission setup, permission reuse and cleanup, tri-state confirmation,
  selected-scope creation, received-item re-share prevention, and physical book routing against the real server.

## Execution

```powershell
npm run cypress:chrome
# or
npm run cypress:firefox
```

## Operational Notes

- Cypress uses `http://localhost:2999` as its base URL.
- `npm run cypress:chrome` and `npm run cypress:firefox` run `collection-e2e:prepare` first, which builds the app and metadata-provider images, seeds the database, and starts both containers on a private network with the app published on port `2999`.
- The test container's `.env` (`apps/collection-e2e/env/.env`) sets `RATE_LIMIT=10000`, `AUTH_RATE_LIMIT=10000`, and `REFRESH_RATE_LIMIT=10000` to avoid server-side rate limiting. Without these settings, repeated `autoLogin()` calls across the suite would exhaust the global, credential, or refresh budget.
