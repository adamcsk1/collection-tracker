# Client Application

Source: [`apps/client`](../apps/client)

`apps/client` is the main Angular application. It loads the user's collection from the API and exposes the feature pages used to browse, search, configure, and maintain the catalog.

## Functional Areas

### Intent hubs (navigation)

Top navigation is **intent-first**. Media type uses always-visible chips on Collection and other multi-media hubs.

| Nav label  | Route                  | Internal `list_type`                    | Purpose                                                                                                          |
| ---------- | ---------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Collection | `/collection/library`  | `library` (+ readable `books`/`music` when All) | Library items plus readable books and albums, including shared items. Chips: **All \| Movies \| Series \| Books \| Music**. |
| Wishlist   | `/collection/wishlist` | `wishlist`                              | Want to buy/own. Chips: **All \| Movies \| Series \| Books \| Music**.                                                    |
| Up Next    | `/collection/up-next`  | `up-next`                               | Want to watch/read/listen later. Chips: **All \| Movies \| Series \| Books \| Music**.                                           |
| Tracking   | `/collection/tracking` | `tracking`                              | Progress hub for movies, series, books, and albums. Chips: **All \| Movies \| Series \| Books \| Music**.                         |

**Collection chips**

- **All** (default): movies + series in `library`, plus readable physical books (`list_type=books`) and albums (`list_type=music`), including shared items
- **Movies** / **Series**: `library` + content type
- **Books**: `type=book` → books list; also `/collection/books`. Readable shared physical books can appear alongside owned
  books.
- **Music**: `type=album` → music list; also `/collection/music`. Readable shared albums can appear alongside owned albums.

- statistics page: **All | Movies | Series | Books | Music** media chips with focused summaries and scoped tags. All shows only
  total, media-type, and favorite cards. Type views show relevant watch, tracking, reading, or listening status cards. Chart.js
  visualizations adapt between media mix and mutually exclusive status distributions, plus genres, release years, user
  rating bands, and selected tags. A page-scoped `ngx-simple-signal-store` owns scope, load status, retry state, current
  response, and per-scope cache; scope responses are loaded lazily and cached while the page remains open.
- `settings/features`: Wishlist, Up Next, Tracking, Books, Music
- `settings/*`: account, tags, display, media refresh, tracker data, shares, export/import
- about page: build metadata

### Sharing

Owned items in every list expose a Share action in item details. The item-sharing dialog lists existing outgoing
relationships. A recipient's first item in a list/content scope prompts for Read, Create, Update, and Delete permissions.
Later item selections reuse those scope permissions.

Received items cannot be re-shared. Their update, delete, and favorite actions may be available according to granted
physical-scope permissions.

AI search keeps pending, success, and error states distinct. A failed AI request surfaces through the collection's normal load-error state rather than showing unfiltered results; retrying reruns the current AI prompt.

Sharing settings render each Read permission as checked for all items, indeterminate for individual selections, and
unchecked for no access. Moving an indeterminate scope to all or none requires confirmation because explicit selections
are deleted.

## Technical Notes

- Standalone Angular, zoneless, hash routing
- Feature prefs: `wishlist`, `upNext`, `tracking`, `books`, `music`
- Route map: [`collection-list-route-const.ts`](../apps/client/src/app/collection/collection-list-route-const.ts)

## Development Routing

- Gateway: `http://localhost:4200/client/#/collection/library`
