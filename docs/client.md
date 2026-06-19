# Client Application

Source: [`apps/client`](../apps/client)

`apps/client` is the main Angular application. It loads the user's collection from the API and exposes the feature pages used to browse, search, configure, and maintain the catalog.

## Functional Areas

- `collection/library`: search and browse stored collection items; includes AI natural-language search via `AiSearchService` and `AiSearchInput`
- `collection/favorites`, `collection/watch-later`, `collection/wishlist`, and `collection/series-tracker`: filtered collection subroutes for saved item lists and series progress tracking
- statistics dialog: tag-driven summaries and Chart.js visualizations opened from the main menu
- `settings/tag-management`: per-tag color, weight, and presentation rules
- `settings/export-import`: export and import collection data and tag management settings
- `settings/collection-list-display`: per-user collection list metadata and preferred rating display rules
- `settings/media-refresh`: refresh stored images and external ratings from OMDb-backed APIs
- `settings/global-watch-status`: mark all visible collection items watched or unwatched
- `settings/shares`: manage outgoing and incoming collection shares by user share code
- `settings`: theme, language, search, app-mode, settings-lock, account actions, access tokens, media refresh, sharing, and global watch-status actions
- about dialog: build metadata and settings-lock release flow opened from the main menu

## Technical Notes

- Uses standalone Angular components, zoneless change detection, and hash-based routing.
- Copies static assets from both [`apps/client/public`](../apps/client/public) and [`libs/public/src`](../libs/public/src).
- Loads translations from `./client/i18n`.
- Keeps local build metadata placeholders in the About component; release packaging temporarily patches them before building and resets them afterwards.

## Important Paths

- [Route configuration](../apps/client/src/app/main/main-routes.ts)
- [Application config](../apps/client/src/app/main/main-config.ts)
- [Feature source](../apps/client/src/app)

## Build And Checks

```powershell
ng serve client
ng build client --configuration=production
npm run test
npm run lint:check
npm run typecheck
npm run typecheck:spec
npm run format:check
```

## Development Routing

- Standalone dev server: `http://localhost:4202/`
- Proxied path: `http://localhost:4200/client/`
- Because the router uses `withHashLocation()`, feature URLs resolve under `#/`, for example `http://localhost:4200/client/#/collection/library`.
