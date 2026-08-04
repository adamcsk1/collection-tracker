# Server Application

Source: [`apps/server`](../apps/server)

`apps/server` is the Fastify backend for Collection Tracker. It exposes the `/api/v1` HTTP API, serves the OpenAPI docs UI, manages authentication, and persists user content and configuration in SQLite.

## Responsibilities

- sign-up, sign-in, logout, and access-token lifecycle management
- CRUD for per-user collection items stored in SQLite, including structured media type, favorite state, matched-item, existence, random-item, and search-suggestion APIs
- tag management, user-settings, user-share, collection-list display, and collection feature preference persistence
- statistics summaries, media refresh, external rating refresh, and manage tracker data updates split across movie, series, and book tracker rows
- movie tracker items, book tracker items, series tracker season metadata, watched episodes, and watched-state bulk updates
- SQLite database initialization and schema migrations
- external metadata proxying — forwards search and item lookups to OMDb and Open Library providers
- AI search proxying — embeds collection metadata for a requested `listType` (including derived watch status and series progress), applies deterministic status pre-filters for intents like unfinished/completed/favorite, retrieves semantic candidates, and forwards filtered CandidateId queries to Ollama using `ollama.config.json` in the active data folder (IMDb-backed items use raw IMDb IDs; provider-native items use `source:id`, e.g. `openlibrary:9780140328721`)
- runtime safeguards through Fastify plugins for Helmet, no-cache headers, CORS validation, request limits, form bodies, and signed cookies

## Runtime Model

- Default data folder: `.data`
- CLI flags: `--dataFolder=<path>` and `--debug=true|false`
- Startup expects `.env` in the active data folder and requires non-empty `JWT_SECRET` and `COOKIE_SECRET` values plus an explicitly configured `SALT`; `OMDB_API_KEY` enables OMDb, optional `OMDB_API_URL` overrides `https://www.omdbapi.com/`, and optional `OPENLIBRARY_API_URL` overrides `https://openlibrary.org/`; Open Library needs no API key; AI search reads `ollama.config.json` from the active data folder and merges configured options over `DEFAULT_OLLAMA_OPTIONS` of `{ "temperature": 0, "top_k": 20, "num_thread": 16, "num_ctx": 16384 }`; Ollama availability is checked by the AI query API rather than during server startup
- `RATE_LIMIT` — default maximum number of requests per 1-minute window per Fastify-validated client IP. Defaults to `120` when not set. Collection entry workflow routes use their own higher per-route limit so adding several items in a row does not exhaust a small global bucket.
- `AUTH_RATE_LIMIT` — independent per-IP limit for sign-in and sign-up. Defaults to `10` when missing or invalid.
- `REFRESH_RATE_LIMIT` — independent per-IP limit for session refresh. Defaults to `60` when missing or invalid so multiple users and tabs behind one address do not share the stricter credential endpoint budget. A refresh `429` preserves the browser's logged-in state so a later request can retry.
- `LOG_LEVEL` — controls console log verbosity. Defaults to `info` when not set. Set to `DEBUG` to echo all log levels (info, warning, error, debug) to the console, equivalent to `--debug=true`
- `npm start` creates `.data/.env` and `.data/ollama.config.json` from [`apps/server/scripts`](../apps/server/scripts) for local development
- Production deployments should run behind an HTTPS reverse proxy; see [Docker deployment](./docker.md)
- `SALT` participates in persisted hashes and must remain unchanged after data has been created. Legacy deployments that previously omitted it can use an explicit `SALT=` value to preserve their existing hashes.

## Data Layout

- `database/collection-tracker.sqlite`
- `ollama.config.json` — Ollama host, model, embedding model, optional root-level `keep_alive`, generate options, optional `batchSize`, optional `parallelRequests`, and optional `semanticCandidateLimit` for AI search. Defaults favor a local GPU desktop (`batchSize: 16`, `parallelRequests: 2`, `semanticCandidateLimit: 120`, `num_ctx: 16384`). Pure status queries such as “unfinished series” on watching (or favorites on any list) resolve from derived item fields without calling Ollama; unfinished/completed pre-filters apply only on tracker lists so thematic library prompts are not emptied.
- `logs/`
- `cache/` — image proxy cache files and metadata

Collection items, users, tokens, settings, shares, collection-list display preferences, collection feature preferences, series tracker data, tags, and genres are stored in SQLite tables managed by migrations in [`apps/server/src/migrations`](../apps/server/src/migrations). Core item fields live in `collection_items`; contributor and description data use `contributors` and `description`. Provider IDs remain on each item in `external_provider` and `external_item_id`, while cross-provider aliases and canonical identity mappings live in `external_item_identities`. External ratings use `collection_item_external_ratings`, and completion timestamps use `collection_item_tracker_state`. Genres, tags, series seasons, and watched episodes remain normalized child tables keyed by collection item ID. Public API fields such as `IMDbId`, `actors`, `plot`, and `watchedAt` are compatibility projections over this storage layout rather than physical `collection_items` columns.

Books use `content_type = 'book'`. Owned catalog uses `list_type = 'books'` (favorites allowed). Books also allowed on `wishlist`, `watchlist`, `tracking` (reading), and `finished` (read). Collection **All** merges `library` + viewer’s own books; `type=book` is books-only. Canonical list types: `library`, `wishlist`, `watchlist`, `tracking`, `finished`, `books`. Feature prefs: `wishlist`, `watchlist`, `tracking`, `finished`, `books`. Tracker state may store `progress_current` / `progress_total` for book reading progress. ISBN-10/13 normalize to ISBN-13.

## Import And Export

- Current collection data exports use `collection-tracker-export` version 8 (`trackingData` with `completedEpisodes`).
- Version 8 exports are complete import documents: server `/export` includes `type`, `version`, settings, items, tag management, and series tracker data.
- Series episode progress is stored in `series_completed_episodes` (API `/tracking/.../completed-episodes`).
- Exported items always include `externalProvider`, `externalItemId`, `externalIds` (primary + aliases), and an identity-anchored `canonicalItemId`.
- Imported `canonicalItemId` values must match an identity derived from the item (`infer` or `source:id`); unanchored overrides are rejected.
- Identity upsert prefers stronger canonicals (`imdb:tt…` over `isbn:…` over provider-scoped ids) and rewrites all rows under a weaker canonical when merging.

## External Metadata Providers

The provider seam supports provider-qualified search and external identity item lookup. Search aggregates all configured metadata providers when the `provider` query parameter is omitted, or filters to one known provider name when supplied. Unknown provider names return `400`; known but unconfigured providers return `503`. Providers can advertise direct IMDb ID lookup support for pasted IMDb shortcuts through the regular `/proxy/external-metadata/item?externalIdentitySource=imdb&externalIdentityId=...` endpoint. Collection items persist `externalProvider` and `externalItemId` for metadata refreshes, duplicate checks, imports, exports, and tracker copy flows. Existing rows are backfilled as `externalProvider = 'omdb'` and `externalItemId = IMDbId`.

Each provider owns a default endpoint constant and can resolve a provider-specific override from the active data-folder `.env`. OMDb uses `OMDB_API_URL`; Open Library uses `OPENLIBRARY_API_URL`. Missing and empty values use provider defaults.

Provider implementations must return canonical provider item IDs and should emit cross-source aliases in `externalIds` (for example `{ source: 'imdb', id: 'tt…' }`). Persistence treats `externalItemId` as the provider's canonical, case-sensitive identifier. Provider names are normalized to lowercase at collection item boundaries. Known provider names live in `EXTERNAL_METADATA_PROVIDER_NAMES`; the database does not hard-check provider name values so a new provider only needs a shared name entry, factory registration, and adapter.

Duplicate checks stay local to the app database. Collection items also store a local `canonicalItemId` and `external_item_identities` mappings so known cross-provider IDs, such as an OMDb item and a future TMDb item that both expose the same IMDb ID, can resolve to the same existing collection item without calling external providers or using fuzzy title/year matching. Identity rows use `source_confidence` of `primary` (owning provider mapping) or `alias` (cross-source mapping). When the same external id is seen under two canonicals, upsert keeps the stronger canonical (`imdb:tt…`, then `isbn:…`, then provider-scoped) and rewrites collection items plus all identity rows (primary and alias) from the weaker canonical.

Ratings are normalized into `collection_item_external_ratings` rows for IMDb, Rotten Tomatoes, and Metacritic. Providers with different rating sources can still expose them in metadata responses, but only those normalized sources are persisted and displayed today.

`IMDbId` remains in the public collection model as a legacy compatibility identifier. Provider-qualified routes own collection and tracker item URLs. Bulk text import remains IMDb-specific for now:

1. Bulk text import: `/import/collection-items` extracts IMDb IDs and imports through the first configured provider that supports direct IMDb lookup.

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
