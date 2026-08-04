# Client Application

Source: [`apps/client`](../apps/client)

`apps/client` is the main Angular application. It loads the user's collection from the API and exposes the feature pages used to browse, search, configure, and maintain the catalog.

## Functional Areas

### Intent hubs (navigation)

Top navigation is **intent-first**. Media type uses always-visible chips on Collection.

| Nav label | Route | Internal `list_type` | Purpose |
| --------- | ----- | -------------------- | ------- |
| Collection | `/collection/library` | `library` (+ own `books` when All) | Owned library. Chips: **All \| Movies \| Series \| Books**. |
| Wishlist | `/collection/wishlist` | `wishlist` | Want to buy/own. |
| Watchlist | `/collection/watchlist` | `watchlist` | Want to watch/read later. |
| Watching | `/collection/watching` | `watching` | In-progress series. |
| Watched | `/collection/watched` | `watched` | Finished movies log. |

**Collection chips**

- **All** (default): movies + series in `library`, plus own books (`list_type=books`)
- **Movies** / **Series**: `library` + content type
- **Books**: `type=book` → books list (own only); also `/collection/books`

- statistics dialog: tag-driven summaries and Chart.js visualizations opened from the main menu
- `settings/features`: Wishlist, Watchlist, Watching, Watched, Books
- `settings/*`: account, tags, display, media refresh, tracker data, shares, export/import
- about dialog: build metadata

## Technical Notes

- Standalone Angular, zoneless, hash routing
- Feature prefs: `wishlist`, `watchlist`, `watching`, `watched`, `books`
- Route map: [`collection-list-route-const.ts`](../apps/client/src/app/collection/collection-list-route-const.ts)

## Development Routing

- Gateway: `http://localhost:4200/client/#/collection/library`
