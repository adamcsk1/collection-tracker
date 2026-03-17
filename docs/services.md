# Services Library

Source: [`libs/services`](../libs/services)

`libs/services` contains the shared Angular service layer and signal stores used across the client and login applications.

## Modules

- `api/`: HTTP client, auth/session integration, pagination, and API store
- `omdb/`: OMDb lookup logic (search and item fetch via server proxy)
- `parser/`: parser configuration, template regeneration, parser cache helpers, and filename/tag parsing utilities
- `md-content-generator/`: Markdown generation from OMDb payloads
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
- [Project configuration](../libs/services/project.json)

## Nx Targets

```powershell
npx nx test services
npx nx lint services
npx nx run services:typecheck
npx nx run services:typecheck-spec
npx nx run services:format-check
```
