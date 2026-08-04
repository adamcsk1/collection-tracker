# Client Application

Source: [`apps/client`](../apps/client)

`apps/client` is the main Angular application. It loads the user's collection from the API and exposes the feature pages used to browse, search, configure, and maintain the catalog.

## Functional Areas

### Intent hubs (navigation)

Top navigation is **intent-first**. Media type uses always-visible chips on Collection and other multi-media hubs.

| Nav label | Route | Internal `list_type` | Purpose |
| --------- | ----- | -------------------- | ------- |
| Collection | `/collection/library` | `library` (+ own `books` when All) | Owned library. Chips: **All \| Movies \| Series \| Books**. |
| Wishlist | `/collection/wishlist` | `wishlist` | Want to buy/own. Chips: **All \| Movies \| Series \| Books**. |
| Watchlist | `/collection/watchlist` | `watchlist` | Want to watch/read later. Chips: **All \| Movies \| Series \| Books**. |
| Tracking | `/collection/tracking` | `tracking` | In-progress series and books. Chips: **All \| Series \| Books**. |
| Finished | `/collection/finished` | `finished` | Finished movies and books log. Chips: **All \| Movies \| Books**. |

**Collection chips**

- **All** (default): movies + series in `library`, plus own books (`list_type=books`)
- **Movies** / **Series**: `library` + content type
- **Books**: `type=book` → books list (own only); also `/collection/books`. Favorites allowed on books ownership items.

- statistics dialog: tag-driven summaries and Chart.js visualizations opened from the main menu
- `settings/features`: Wishlist, Watchlist, Tracking, Finished, Books
- `settings/*`: account, tags, display, media refresh, tracker data, shares, export/import
- about dialog: build metadata

## Technical Notes

- Standalone Angular, zoneless, hash routing
- Feature prefs: `wishlist`, `watchlist`, `tracking`, `finished`, `books`
- Route map: [`collection-list-route-const.ts`](../apps/client/src/app/collection/collection-list-route-const.ts)

## Development Routing

- Gateway: `http://localhost:4200/client/#/collection/library`
