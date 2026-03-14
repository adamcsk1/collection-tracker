# Collection E2E

Source: [`apps/collection-e2e`](../apps/collection-e2e)

`apps/collection-e2e` contains the Cypress end-to-end coverage for the workspace. The project is intentionally minimal at the moment.

## Technical Notes

- [`src/test-setup.ts`](../apps/collection-e2e/src/test-setup.ts) is a placeholder for future environment bootstrap logic.
- [`env/`](../apps/collection-e2e/env) is reserved for local, project-specific test environment files.

## Execution

```powershell
npm run e2e
# or
npx nx run collection-e2e:e2e
```

## Operational Notes

- Cypress uses `http://localhost:4200` as its base URL.
- The tests target the proxy origin, so the full local stack must be available for meaningful end-to-end coverage.
