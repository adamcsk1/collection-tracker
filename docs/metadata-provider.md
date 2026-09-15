# Metadata Provider

Source: [`apps/metadata-provider`](../apps/metadata-provider)

`apps/metadata-provider` is the Fastify service that owns built-in OMDb, Open Library, and MusicBrainz adapters plus optional HTTP replacements. The Collection Tracker server never talks to those upstream APIs directly.

## Local Development

`npm start` serves this app the same way it serves `apps/server`. It reads `.data/.env` for `OMDB_API_KEY` and optional upstream URL overrides, binds `127.0.0.1:3002`, and does not go through the development proxy.

The server waits for `GET /v1/providers` at `METADATA_SERVICE_URL` (default `http://127.0.0.1:3002`) before listen. Authenticated health diagnostics also ping `GET /health`. Changing provider keys or replacements requires restarting the metadata provider, then the app, so the app reloads its provider list.

## Docker

Compose runs a second image on a private `metadata` network. The metadata port is not published. Provider secrets live in `./.metadata`, not the app `./.data` volume.

## Search and Diagnostics

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
