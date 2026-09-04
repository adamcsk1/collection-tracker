# Metadata Provider

Source: [`apps/metadata-provider`](../apps/metadata-provider)

`apps/metadata-provider` is the Fastify service that owns built-in OMDb, Open Library, and MusicBrainz adapters plus optional HTTP replacements. The Collection Tracker server never talks to those upstream APIs directly.

## Local Development

`npm start` serves this app the same way it serves `apps/server`. It reads `.data/.env` for `OMDB_API_KEY` and optional upstream URL overrides, binds `127.0.0.1:3002`, and does not go through the development proxy.

The server waits for `GET /v1/providers` at `METADATA_SERVICE_URL` (default `http://127.0.0.1:3002`) before listen. Authenticated health diagnostics also ping `GET /health`. Changing provider keys or replacements requires restarting the metadata provider, then the app, so the app reloads its provider list.

## Docker

Compose runs a second image on a private `metadata` network. The metadata port is not published. Provider secrets live in `./.metadata`, not the app `./.data` volume.

## Contract

The service implements the [normalized provider contract](./external-metadata-provider-contract.md) at:

- `GET /health`
- `GET /v1/providers`
- `GET /v1/{provider}/search?s=`
- `GET /v1/{provider}/items/{id}`
- `GET /v1/omdb/items/by-imdb/{id}`
- `GET /v1/omdb/items/{id}/seasons`
