# Client Application

Source: [`apps/client`](../apps/client)

`apps/client` is the main Angular application. It loads the user's collection from the API and exposes the feature pages used to browse, search, configure, and maintain the catalog.

## Functional Areas

- `collection/library`: search and browse stored collection items; includes AI natural-language list search via the floating AI button and `AiSearchService`; favorites are available through the library `favorite=true` filter
- `collection/watch-later`, `collection/wishlist`, `collection/movie-tracker`, `collection/series-tracker`, and `collection/book-tracker`: filtered collection subroutes for saved item lists, watched movies, series progress, and books sourced from OpenLibrary; books are dedicated to Book Tracker in v1, with no library, read-later, or wishlist book lists; each list supports the same floating AI search scoped to that list type
- statistics dialog: tag-driven summaries and Chart.js visualizations opened from the main menu
- `settings/tag-management`: per-tag color, weight, and presentation rules
- `settings/export-import`: export and import collection data, tag management settings, and series tracker progress using the current `collection-tracker-export` format
- `settings/collection-list-display`: per-user collection list metadata and preferred rating display rules
- `settings/features`: show or hide Wishlist, Watch Later, Movie Tracker, Series Tracker, and Book Tracker navigation and connected actions without blocking direct routes or deleting data
- `settings/media-refresh`: refresh stored images and external ratings from external metadata provider-backed APIs
- `settings/manage-tracker-data`: mark collection movies and series watched or unwatched, or clear owned movie, series, and book tracker data
- `settings/shares`: manage outgoing and incoming collection shares by user share code
- `settings`: theme, language, search, app-mode, settings-lock, account actions, access tokens, media refresh, sharing, and manage tracker data actions
- about dialog: build metadata and settings-lock release flow opened from the main menu

## Technical Notes

- Uses standalone Angular components, zoneless change detection, and hash-based routing.
- Copies static assets from both [`apps/client/public`](../apps/client/public) and [`libs/public/src`](../libs/public/src).
- Loads translations from `./client/i18n`.
- Hydrates feature preferences synchronously from the configured browser storage, then replaces the cache with the authenticated user's API settings when they load.
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
