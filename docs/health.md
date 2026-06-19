# Health Application

Source: [`apps/health`](../apps/health)

`apps/health` is a lightweight Angular dashboard that displays live server health metrics from the API. It polls the health endpoint every 30 seconds and shows status, memory, CPU, disk, load averages, and frontend availability.

## Data Source

The dashboard calls `GET /api/v1/health` via `ApiService.getHealth()`. The response is typed as `HealthApiResponseModel` (see [`libs/shared/src/lib/models/api-model.ts`](../libs/shared/src/lib/models/api-model.ts)).

## Technical Notes

- Uses standalone Angular components, zoneless change detection, no routing.
- Copies static assets from [`libs/public/src`](../libs/public/src).
- Polls on a 30-second `timer` using `switchMap`; polling restarts on manual refresh.

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
