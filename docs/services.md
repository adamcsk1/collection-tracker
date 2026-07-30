# Services Library

Source: [`libs/services`](../libs/services)

`libs/services` contains the shared Angular service layer and signal stores used across the client and login applications.

## Modules

- `api/`: HTTP client, auth/session integration, pagination, API store, collection CRUD, statistics, shares, media refresh, movie tracker, series tracker, and AI list search query (`getAiQueryData(prompt, listType)`)
- `external-metadata/`: external metadata lookup logic (search and item fetch via server proxy)
- `theme/`: theme state and DOM class management
- `webstorage/`: local and session storage abstraction
- root services: `alert-service.ts`, `confirm-service.ts`, `portal-service.ts`, `translate-service.ts`

## Integration Notes

- Import through the `@services/*` path alias.
- `apiStateToken` and `themeStateToken` are the primary cross-application stores.
- `PortalService` is the common primitive for dialog and dynamic component hosting.
- The client uses the full library; the login app uses the API, theme, translation, and notification subset.

## Important Paths

- [Source root](../libs/services/src/lib)
- [Source root](../libs/services/src/lib)

## Checks

```powershell
npm run test
npm run lint:check
npm run typecheck
npm run typecheck:spec
npm run format:check
```
