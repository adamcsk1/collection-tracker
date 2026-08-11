# Client Application

Source: [`apps/client`](../apps/client)

`apps/client` is the main Angular application. It loads the user's collection from the API and exposes the feature pages used to browse, search, configure, and maintain the catalog.

## Functional Areas

### Intent hubs (navigation)

Top navigation is **intent-first**. Media type uses always-visible chips on Collection and other multi-media hubs.

| Nav label  | Route                  | Internal `list_type`                    | Purpose                                                                                                          |
| ---------- | ---------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Collection | `/collection/library`  | `library` (+ readable `books` when All) | Library items plus readable physical books, including shared items. Chips: **All \| Movies \| Series \| Books**. |
| Wishlist   | `/collection/wishlist` | `wishlist`                              | Want to buy/own. Chips: **All \| Movies \| Series \| Books**.                                                    |
| Up Next    | `/collection/up-next`  | `up-next`                               | Want to watch/read later. Chips: **All \| Movies \| Series \| Books**.                                           |
| Tracking   | `/collection/tracking` | `tracking`                              | Progress hub for movies, series, and books. Chips: **All \| Movies \| Series \| Books**.                         |

**Collection chips**

- **All** (default): movies + series in `library`, plus readable physical books (`list_type=books`), including shared items
- **Movies** / **Series**: `library` + content type
- **Books**: `type=book` → books list; also `/collection/books`. Readable shared physical books can appear alongside owned
  books.

- statistics page: **All | Movies | Series | Books** media chips with focused summaries and scoped tags. All shows only
  total, media-type, and favorite cards. Type views show relevant watch, tracking, or reading status cards. Chart.js
  visualizations adapt between media mix and mutually exclusive status distributions, plus genres, release years, user
  rating bands, and selected tags. Scope responses are loaded lazily and cached while the page remains open.
- `settings/features`: Wishlist, Up Next, Tracking, Books
- `settings/*`: account, tags, display, media refresh, tracker data, shares, export/import
- about page: build metadata

### Sharing

Owned items in every list expose a Share action in item details. The item-sharing dialog lists existing outgoing
relationships. A recipient's first item in a list/content scope prompts for Read, Create, Update, and Delete permissions.
Later item selections reuse those scope permissions.

Received items cannot be re-shared. Their update, delete, and favorite actions may be available according to granted
physical-scope permissions.

Sharing settings render each Read permission as checked for all items, indeterminate for individual selections, and
unchecked for no access. Moving an indeterminate scope to all or none requires confirmation because explicit selections
are deleted.

## Technical Notes

- Standalone Angular, zoneless, hash routing
- Feature prefs: `wishlist`, `upNext`, `tracking`, `books`
- Route map: [`collection-list-route-const.ts`](../apps/client/src/app/collection/collection-list-route-const.ts)

## Development Routing

- Gateway: `http://localhost:4200/client/#/collection/library`
