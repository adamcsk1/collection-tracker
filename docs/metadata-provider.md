# Metadata Provider

Source: [`apps/metadata-provider`](../apps/metadata-provider)

`apps/metadata-provider` is the Fastify service that owns built-in OMDb, Open Library, and MusicBrainz adapters plus optional HTTP replacements. The Collection Tracker server never talks to those upstream APIs directly.

## Local Development

`npm start` serves this app the same way it serves `apps/server`. It reads `.data/.env` for `OMDB_API_KEY` and optional upstream URL overrides, binds `127.0.0.1:3002`, and does not go through the development proxy.

The server waits for `GET /v1/providers` at `METADATA_SERVICE_URL` (default `http://127.0.0.1:3002`) before listen. Authenticated health diagnostics also ping `GET /health`. Changing provider keys or replacements requires restarting the metadata provider, then the app, so the app reloads its provider list.

## Docker

Compose runs a second image on a private `metadata` network. The metadata port is not published. Provider secrets live in `./.metadata`, not the app `./.data` volume.

## Search and Diagnostics

MusicBrainz 429/503 responses receive at most two retries, with the existing official-host request pacing and a shared ten-second fetch timeout. Retries honor numeric or HTTP-date `Retry-After` values up to two seconds; longer delays fail without retrying early. Missing or invalid values use one second. Exhausted upstream availability failures return 503 from the metadata service; the public search API retains its existing 502 response.

Book title/author search returns Open Library works (`OL…W`), including books without ISBNs. Music title/artist search returns MusicBrainz release groups (`release-group:<MBID>`), including albums, EPs, and singles. Results show title, creator, year, and artwork without asking users to choose a pressing or edition.

ISBN and release/barcode discovery carries verified work/group relationships as aliases. Legacy ISBN-13 and bare release MBID lookups retain their original IDs for refresh and imports. Open Library work descriptions, subjects, authors, and covers supplement missing edition metadata. Work lookups do not require an ISBN. Open Library requests identify the application and are paced at one request per second across provider instances.

Existing collection rows are not bulk migrated or automatically merged. Known aliases support duplicate detection; old records without a known work/group relationship remain distinct until that relationship is supplied through lookup and saving. Conflicting aliases never merge existing editions. Missing covers do not prevent adding an item.

### Provider coverage benchmark (planned)

Before adding another provider, compare the updated defaults against Discogs (music) and Google Books (books):

1. Choose 20 albums and 20 books, including reported failures, popular titles, local-language titles, older items, EPs/singles, books without ISBNs, and available barcode/ISBN examples. Use public catalog examples unless the owner approves sharing collection data with providers.
2. Record the expected album/work and creator. Run title-only, title plus creator, creator-only, and available identifier searches. A matching edition counts as coverage only when it resolves to the intended album/work; exact pressing matching is not required.
3. Measure correct top-1/top-5 results, missing matches, duplicate editions, wrong identities, usable artwork, descriptions, p50/p95 latency, upstream request count, and throttling/errors. Repeat cold and warm runs with fixed queries and timestamps, respecting provider limits.
4. Verify credential setup, quotas, attribution, caching/image terms, and self-hosted deployment cost. Keep credentials out of fixtures and logs; do not scrape websites or bypass limits.
5. Add a fallback only if it recovers at least three default-provider misses in the 20-item category without introducing false identity matches. Report paired results and remaining misses, not a universal provider ranking. Otherwise keep the current providers and fix specific query/ranking problems.

This benchmark is not implemented or run yet. Discogs credentials and a Google Books API key are prerequisites for the comparison; no new provider is enabled by this change.

OMDb's `Too many results.` response produces an empty search result so users can continue typing a more specific title. Unavailable OMDb posters (`N/A`) are returned as empty strings so a missing image does not fail the whole search. Authentication, quota, network, timeout, and unsafe poster URL failures remain errors.

Local `npm start` already enables provider debug logging with `--debug=true`. `LOG_LEVEL=DEBUG` also enables it. Restart `npm start` after source changes to rebuild and restart the provider.

Provider logs are written to `<dataFolder>/logs/metadata-provider-YYYY-MM-DD.txt` (UTC date), with a `metadata-provider` label. Locally this is `.data/logs`; Docker Compose persists them under `.metadata/logs`. Info and error messages are always saved; debug messages require debug mode. File-write failures do not fail requests.

Request failures include the route template, local request ID, duration, and a safe diagnostic reason. Debug completion logs also include HTTP status. Server search failures are saved in the existing `.data/logs/log-YYYY-MM-DD.txt`, including individual failures during multi-provider searches. Request IDs are local to each service; correlate the two logs by timestamp, provider, and operation.

Search text, credentials, headers, upstream URLs, and raw response bodies are omitted. Only known error messages are logged verbatim; unexpected error text is replaced with a safe category.

## Contract

To replace a built-in adapter with your own HTTP service, follow [How to write a replacement](./external-metadata-provider-contract.md#how-to-write-a-replacement).

The service implements the [normalized provider contract](./external-metadata-provider-contract.md) at:

- `GET /health`
- `GET /v1/providers`
- `GET /v1/{provider}/search?s=`
- `GET /v1/{provider}/items/{id}`
- `GET /v1/omdb/items/by-imdb/{id}`
- `GET /v1/omdb/items/{id}/seasons`
