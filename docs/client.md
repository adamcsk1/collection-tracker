# Client Application

Source: [`apps/client`](../apps/client)

`apps/client` is the main Angular application. It loads the user's collection from the API and exposes the feature pages used to browse, search, configure, and maintain the catalog.

## Functional Areas

- `collection/library`: search and browse stored collection items; includes AI natural-language search via `AiSearchService` and `AiSearchInput`
- `collection/favorites` and `collection/watch-later`: filtered collection subroutes for saved item lists
- `statistics`: tag-driven summaries and Chart.js visualizations
- `settings/tag-configs`: per-tag color, weight, and presentation rules
- `settings`: theme, search, account actions, access tokens, image refresh, and global watch-status actions
- `about`: build metadata and settings-lock release flow

## Technical Notes

- Uses standalone Angular components, zoneless change detection, and hash-based routing.
- Copies static assets from both [`apps/client/public`](../apps/client/public) and [`libs/public/src`](../libs/public/src).
- Loads translations from `./client/i18n`.
- Runs build metadata hooks through [`apps/client/scripts/set-build-infos.js`](../apps/client/scripts/set-build-infos.js) and [`apps/client/scripts/reset-build-infos.js`](../apps/client/scripts/reset-build-infos.js).

## Important Paths

- [Route configuration](../apps/client/src/app/main/main-routes.ts)
- [Application config](../apps/client/src/app/main/main-config.ts)
- [Feature source](../apps/client/src/app)

## Nx Targets

```powershell
npx nx serve client
npx nx build client --configuration=production
npx nx test client
npx nx lint client
npx nx run client:typecheck
npx nx run client:typecheck-spec
npx nx run client:format-check
```

## Development Routing

- Standalone dev server: `http://localhost:4202/`
- Proxied path: `http://localhost:4200/client/`
- Because the router uses `withHashLocation()`, feature URLs resolve under `#/`, for example `http://localhost:4200/client/#/collection/library`.
