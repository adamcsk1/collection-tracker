# Health Application

Source: [`apps/health`](../apps/health)

`apps/health` is a lightweight Angular dashboard that loads server health metrics from the API on page initialization and shows status, memory, CPU, disk, load averages, frontend availability, metadata-provider availability, and AI availability.

## Data Source

When a session is present, the dashboard calls authenticated `GET /api/v1/users/me/health` via `SharedApiService.getHealthDiagnostics()`. The response is typed as `HealthDiagnosticsApiResponseModel` (see [`libs/shared/src/lib/models/api-model.ts`](../libs/shared/src/lib/models/api-model.ts)) and the page shows the aggregate status plus resource and dependency diagnostics.

Signed-out visitors still see the public aggregate `ok`, `warn`, or `error` status from `GET /api/v1/health` via `PublicApiService.getHealth()`. Resource and dependency diagnostics require a valid session or bearer token. Both endpoints share a 5-second result cache and one dedicated per-IP health bucket, which defaults to 60 requests per minute and can be changed with `HEALTH_RATE_LIMIT`; requests above the limit return `429 Too Many Requests`. Health requests do not consume the normal API bucket.

## Technical Notes

- Uses standalone Angular components, zoneless change detection, no routing.
- Copies static assets from [`libs/public/src`](../libs/public/src).
- Loads diagnostics once on page initialization. A 401 or 403 falls back to the public aggregate status. Failed requests can be retried manually.

## Important Paths

- [Application config](../apps/health/src/app/main/main-config.ts)
- [Main component](../apps/health/src/app/main/main.ts)

## Build And Checks

```powershell
ng serve health
ng build health --configuration=production
npm run test
npm run lint:check
npm run typecheck
npm run typecheck:spec
npm run format:check
```

## Development Routing

- Standalone dev server: `http://localhost:4203/`
- Proxied path: `http://localhost:4200/health/`
