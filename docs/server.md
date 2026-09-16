# Server Application

Source: [`apps/server`](../apps/server)

`apps/server` is the Fastify backend for Collection Tracker. It exposes the `/api/v1` HTTP API, serves the OpenAPI docs UI, manages authentication, and persists user content and configuration in SQLite.

## Responsibilities

- sign-up, sign-in, logout, and access-token lifecycle management
- CRUD for per-user collection items stored in SQLite, including structured media type, favorite state, matched-item, existence, random-item, and search-suggestion APIs
- tag management, user-settings, user-share, collection-list display, and collection feature preference persistence
- statistics summaries, media refresh, external rating refresh, and manage tracking data updates for movies, series, and books
- tracking list items (movies, series, books), series season metadata, completed episodes, and bulk completion updates
- SQLite database initialization and schema migrations
- external metadata proxying — forwards search and item lookups to the metadata provider service
- public aggregate health checks and authenticated resource/dependency diagnostics
- AI search proxying — embeds collection metadata for a requested `listType` (including derived watch status and series progress), applies deterministic status pre-filters for intents like unfinished/completed/favorite, retrieves semantic candidates, and forwards filtered CandidateId queries to Ollama using `ollama.config.json` in the active data folder (IMDb-backed items use raw IMDb IDs; provider-native items use `source:id`, e.g. `openlibrary:9780140328721`)
- runtime safeguards through Fastify plugins for Helmet, no-cache headers, CORS validation, request limits, form bodies, and signed cookies

## API Contract

The API base remains `/api/v1`, but the previous endpoint paths were replaced rather than aliased. Canonical paths are grouped by capability and resource under `/auth`, `/users/me`, `/collection-items`, `/external-metadata`, `/images`, and `/ai`. Public `GET /health` returns only aggregate status; authenticated `GET /users/me/health` returns resource and dependency diagnostics. See the OpenAPI reference for the complete path list.

Every JSON success response uses a data envelope:

```json
{
  "data": {}
}
```

For example, sign-up returns `{ "data": { "token": "..." } }`, user-token rotation returns `{ "data": { "newToken": "..." } }`, access-token creation returns `{ "data": { "accessToken": "..." } }`, and access-token listing returns `{ "data": [{ "tokenHash": "..." }] }`. Successful `204 No Content` responses and binary responses such as `GET /api/v1/images/proxy` are not enveloped.

Cursor-paginated responses use this shape and do not include an exact total:

```json
{
  "data": [],
  "page": {
    "limit": 50,
    "hasMore": false,
    "nextCursor": null
  }
}
```

Collection pagination uses SQLite keyset ordering by `createdAt` or `alphabet`, with item `id` as the deterministic tie-breaker. Supporting indexes are installed by the collection cursor-index migration. Cursors are opaque HMAC-signed tokens bound to the authenticated viewer, active filters, ordering, and matched identities; changing that context invalidates the cursor. Matched AI results retain in-memory rank order and use the last visible rank and item ID as the signed keyset boundary because rank is not a database sort key. The maximum page limit is `100`. Pagination is live rather than snapshot-isolated: changing an item's title while traversing alphabetical pages can move that item across the active boundary, so clients reset pagination after mutations.

Every JSON error uses RFC 9457 Problem Details with content type `application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "code": "HTTP_400",
  "detail": "Invalid cursor",
  "instance": "/api/v1/collection-items"
}
```

`detail` is optional and is omitted from internal-server-error responses.

`GET /api/v1/collection-items/statistics` uses the readable folded library scope. Omitting `type` returns compact
all-media totals. `type=movie|series|book` returns a focused summary and type-filtered tags, genres, release years, and
user-rating bands. Statuses come from current-viewer tracking twins: completed movies are watched; series partition into
untracked, completed, and in progress; books partition into read, positive-progress, and unread states. Tracking rows
never increase owned/readable collection totals.
Unsupported `type` values return an RFC 9457 `400 Bad Request` response instead of falling back to all-media scope.

## Runtime Model

- Default data folder: `.data`
- CLI flags: `--dataFolder=<path>` and `--debug=true|false`
- Startup expects `.env` in the active data folder and requires non-empty `JWT_SECRET` and `COOKIE_SECRET` values plus an explicitly configured `SALT`; `METADATA_SERVICE_URL` (or `--metadataServiceUrl`) is required and must point at the metadata provider; the server waits for that service before listen; AI search reads `ollama.config.json` from the active data folder and merges configured options over `DEFAULT_OLLAMA_OPTIONS` of `{ "temperature": 0, "top_k": 20, "num_thread": 16, "num_ctx": 16384 }`; Ollama availability is checked by the AI query API rather than during server startup
- `RATE_LIMIT` — default maximum number of requests per 1-minute window per Fastify-validated client IP. Defaults to `120` when not set. Collection entry workflow routes use their own higher per-route limit so adding several items in a row does not exhaust a small global bucket.
- `AUTH_RATE_LIMIT` — independent per-IP limit for sign-in and sign-up. Defaults to `10` when missing or invalid.
- `REFRESH_RATE_LIMIT` — independent per-IP limit for session refresh. Defaults to `60` when missing or invalid so multiple users and tabs behind one address do not share the stricter credential endpoint budget. A refresh `429` preserves the browser's logged-in state so a later request can retry.
- `HEALTH_RATE_LIMIT` — independent per-IP limit shared by public health status and authenticated diagnostics. Defaults to `60` requests per minute when missing or invalid. Health requests do not consume the normal API budget. Health results are cached for 5 seconds.
- `IMAGE_RATE_LIMIT` — independent per-IP limit for image proxy requests and the public animated-background URL list. Defaults to `240` requests per minute when missing or invalid; requests above the limit return `429 Too Many Requests` and do not consume the normal API budget. Image fetch queue saturation or queue wait timeout instead returns `503 Service Unavailable` with `Retry-After` guidance.
- `LOG_LEVEL` — controls console log verbosity. Defaults to `info` when not set. Set to `DEBUG` to echo all log levels (info, warning, error, debug) to the console, equivalent to `--debug=true`
- `npm start` creates `.data/.env`, `.data/ollama.config.json`, and `.data/background.config.json` from [`apps/server/scripts`](../apps/server/scripts) for local development
- Production deployments should run behind an HTTPS reverse proxy; see [Docker deployment](./docker.md)
- `SALT` participates in persisted hashes and must remain unchanged after data has been created. Legacy deployments that previously omitted it can use an explicit `SALT=` value to preserve their existing hashes.

## Data Layout

- `database/collection-tracker.sqlite`
- `ollama.config.json` — Ollama host, model, embedding model, optional root-level `keep_alive`, generate options, optional `batchSize`, optional `parallelRequests`, and optional `semanticCandidateLimit` for AI search. Defaults favor a local GPU desktop (`batchSize: 16`, `parallelRequests: 2`, `semanticCandidateLimit: 120`, `num_ctx: 16384`). Pure status queries such as “unfinished series” on tracking (or favorites on any list) resolve from derived item fields without calling Ollama; unfinished/completed pre-filters apply only on the tracking list so thematic library prompts are not emptied.
- Provider replacements are configured on the [metadata provider](./metadata-provider.md), not in the server data folder.
- `background.config.json` — IMDb IDs, ISBNs, and MusicBrainz release MBIDs for the login and client animated poster background. Created with default IMDb IDs when missing. The ID arrays are never replaced; after listen the server resolves missing posters through the corresponding configured metadata provider, writes source URLs to `posters`, and caches missing images in `cache/`. Restart reuses saved `posters` and does not call metadata providers again for unchanged IDs. Public `GET /images/background` returns those cached source URLs for `/images/proxy`. Unauthenticated proxy requests only serve that allowlist from cache.
- `logs/`
- `cache/` — image proxy cache files and metadata. Uncached fetches are limited to four concurrently, 32 queued requests with a 10-second queue wait, and one 30-second deadline across DNS resolution and redirects. Empty images are rejected, each image is limited to 10 MiB, and least-recently-accessed entries are removed before writes to keep the cache within 512 MiB including estimated metadata/filesystem overhead and 10,000 entries.

Collection items, users, tokens, settings, shares, collection-list display preferences, collection feature preferences, tracking season and completed-episode data, tags, and genres are stored in SQLite tables managed by migrations in [`apps/server/src/migrations`](../apps/server/src/migrations). Core item fields live in `collection_items`; contributor and description data use `contributors` and `description`. Provider IDs remain on each item in `external_provider` and `external_item_id`, while cross-provider aliases and canonical identity mappings live in `external_item_identities`. External ratings use `collection_item_external_ratings`, and completion timestamps use `collection_item_tracker_state`. Genres, tags, series seasons, and completed episodes remain normalized child tables keyed by collection item ID. Public API fields such as `IMDbId`, `actors`, `plot`, and `watchedAt` are compatibility projections over this storage layout rather than physical `collection_items` columns.

Migration files `039` and later contain schema SQL only. The migration runner wraps each file and its `schema_migrations` marker in one transaction. Earlier migrations retain their legacy self-managed transaction behavior.

Books use `content_type = 'book'`. Owned catalog uses `list_type = 'books'` (favorites allowed). Books also allowed on `wishlist`, `up-next`, and `tracking` (in-progress or completed via tracker state). Collection **All** merges `library` + viewer’s own books; `type=book` is books-only. Canonical list types: `library`, `wishlist`, `up-next`, `tracking`, `books`, `music`. Feature prefs: `wishlist`, `upNext`, `tracking`, `books`, `music`. Tracker state may store `progress_current` / `progress_total` for book reading progress and `completed_at` for finished items. ISBN-10/13 normalize to ISBN-13.

Albums use `content_type = 'album'`. Owned catalog uses `list_type = 'music'` (favorites allowed). Albums also allowed on `wishlist`, `up-next`, and `tracking`. Collection **All** also folds music; `type=album` is music-only. MusicBrainz release MBIDs are the canonical identity; Cover Art Archive supplies poster URLs.

## Sharing

Outgoing relationships live in `user_shares`. Each list/content grant has a read mode: `all` exposes every owned item in
the physical scope, while `selected` exposes only rows recorded in `user_share_item_selections`. Item selections reference
physical collection item IDs, so copies in different lists remain independent. Books use the `books/book` scope and albums
use the `music/album` scope even when displayed in Collection. Update and delete permissions apply only to readable selected rows. Create permission in a
selected scope automatically selects the new owner item for the recipient who created it. Bulk tracking and metadata
operations likewise process only authorized selected rows.

Owners manage an item's recipients through
`GET|PUT /api/v1/collection-items/{externalIdentitySource}/{externalIdentityId}/shares?listType=...`. Only existing
outgoing relationships are eligible, and received items cannot be re-shared. Switching a scope to `all` or `none`,
deleting an item, or changing its physical scope removes obsolete selections and prunes empty selected grants.

## Import And Export

- Current collection data exports use `collection-tracker-export` version 11. Import accepts version 11 only.
- Version 11 exports are complete import documents: `GET /api/v1/users/me/export` includes `type`, `version`, settings, items, tag management, and tracking season / completed-episode data.
- Full imports allow at most 10,000 collection items, 1,000 tag configurations, and 10,000 tracking-data properties. Each item allows at most 100 genres, 100 tags, and 20 external identities. Each tracking entry allows at most 50 seasons and 5,000 completed episodes, with at most 100 episode titles per season. String limits are 65,536 characters for plots; 16,384 for actors; 8,192 for images; 2,048 for tracking-data keys; 1,024 for titles, cached titles, canonical item IDs, and episode titles; 512 for external identity IDs, provider item IDs, and legacy IMDb IDs; 256 for tags, genres, and share codes; 128 for exported hashes; and 64 for identity sources, providers, years, rating text, completion timestamps, and tag colors. A structurally valid document above any count or string limit returns `413 Payload Too Large` before normalization, hashing, or database access; malformed documents return `400 Bad Request`.
- Series episode progress is stored in `series_completed_episodes` and exposed under `/api/v1/collection-items/{externalIdentitySource}/{externalIdentityId}/tracking/completed-episodes`.
- Exported items always include `externalProvider`, `externalItemId`, `externalIds` (primary + aliases), and an identity-anchored `canonicalItemId`.
- Imported `canonicalItemId` values must match an identity derived from the item (`infer` or `source:id`); unanchored overrides are rejected.
- Identity upsert prefers stronger canonicals (`imdb:tt…` over `isbn:…` over provider-scoped ids) and rewrites all rows under a weaker canonical when merging.

## External Metadata Providers

The provider seam supports provider-qualified search and external identity item lookup. Search aggregates all configured metadata providers when the `provider` query parameter is omitted, or filters to one known provider name when supplied. Unknown provider names return `400`; known but unconfigured providers return `503`. Providers can advertise direct IMDb ID lookup support for pasted IMDb shortcuts through `GET /api/v1/external-metadata/items?externalIdentitySource=imdb&externalIdentityId=...`. Collection items persist `externalProvider` and `externalItemId` for metadata refreshes, duplicate checks, imports, exports, and tracker copy flows. Existing rows are backfilled as `externalProvider = 'omdb'` and `externalItemId = IMDbId`.

The server talks only to the [metadata provider](./metadata-provider.md) over the normalized HTTP contract. Built-in OMDb, Open Library, and MusicBrainz adapters, endpoint overrides, and `external-metadata.config.json` replacements live in that service. Client and database migrations stay unnecessary only when replacements also keep the built-in identity schemes: IMDb IDs for `omdb`, ISBN-13 for `openlibrary`, and MusicBrainz release MBIDs for `musicbrainz`.

Provider implementations must return canonical provider item IDs and should emit cross-source aliases in `externalIds` (for example `{ source: 'imdb', id: 'tt…' }`). Persistence treats `externalItemId` as the provider's canonical, case-sensitive identifier. Provider names are normalized to lowercase at collection item boundaries. Known provider names live in `EXTERNAL_METADATA_PROVIDER_NAMES`; the database does not hard-check provider name values so a new provider only needs a shared name entry, factory registration, and adapter.

Duplicate checks stay local to the app database. Collection items also store a local `canonicalItemId` and `external_item_identities` mappings so known cross-provider IDs, such as an OMDb item and a future TMDb item that both expose the same IMDb ID, can resolve to the same existing collection item without calling external providers or using fuzzy title/year matching. Identity rows use `source_confidence` of `primary` (owning provider mapping) or `alias` (cross-source mapping). When the same external id is seen under two canonicals, upsert keeps the stronger canonical (`imdb:tt…`, then `isbn:…`, then provider-scoped) and rewrites collection items plus all identity rows (primary and alias) from the weaker canonical.

Ratings are normalized into `collection_item_external_ratings` rows for IMDb, Rotten Tomatoes, and Metacritic. Providers with different rating sources can still expose them in metadata responses, but only those normalized sources are persisted and displayed today.

`IMDbId` remains in the public collection model as a legacy compatibility identifier. Provider-qualified routes own collection and tracker item URLs. Bulk text import remains IMDb-specific for now:

1. Bulk text import: `POST /api/v1/collection-items/imports` extracts IMDb IDs and imports through the first configured provider that supports direct IMDb lookup.

## Important Paths

- [Entrypoint](../apps/server/src/bootstrap.ts)
- [Server startup](../apps/server/src/core/main.ts)
- [API registration](../apps/server/src/apis/index.ts)
- [Development environment bootstrap](../apps/server/scripts/create-dev-env.js)

## Build And Checks

```powershell
npm start
npm run build:server
npm run test
npm run lint:check
npm run typecheck
npm run typecheck:spec
npm run format:check
```

## Related Documentation

- [Server API reference](../apps/server/public/server-api.yaml) — also served interactively at `/api/docs` when the server is running
- [Docker deployment](./docker.md)
