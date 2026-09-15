# External Metadata Provider Contract

Collection Tracker can replace its built-in OMDb, Open Library, or MusicBrainz adapter with a deployment-wide HTTP provider. Custom providers implement this normalized contract; they do not run inside the Collection Tracker process.

## How to write a replacement

A replacement is a separate HTTP service. Collection Tracker does not load plugins or run your code. You implement the endpoints below, then point the metadata provider at that service.

You can replace only the `omdb`, `openlibrary`, and `musicbrainz` slots. There is no way to register a fourth provider name. A TMDB or other catalog must occupy one of those slots and keep that slot's identity scheme: IMDb IDs for `omdb`, ISBN-13 for `openlibrary`, and MusicBrainz release MBIDs for `musicbrainz`. Existing collection items, paste lookup, refresh, and duplicate merge all assume those identifiers.

1. Serve `GET /search?s=` and `GET /items/{id}` under your `baseUrl`. An `omdb` replacement must also serve `GET /items/by-imdb/{id}` and `GET /items/{id}/seasons`.
2. Return JSON with a `{ "data": ... }` envelope, an `application/json` or `+json` content type, at most 2 MiB, and at most 20 search results.
3. Use `""` for a missing poster. Do not return `"N/A"` or a non-HTTP(S) URL; one invalid poster fails the whole search.
4. Return `404` when an item does not exist. Broad searches with no useful hits should return `{ "data": { "results": [] } }`. Other failures surface in the app as `502`.
5. Keep season numbers unique. Stay within 50 seasons and 100 episodes per season.
6. Create `external-metadata.config.json` in the metadata-provider data folder: `.data` for local `npm start`, `./.metadata` for Docker Compose. Put header secrets in that folder's `.env` and reference them with `header.valueEnv`. Do not put secrets in the JSON file.
7. Restart the metadata provider, then the app, so the app reloads `GET /v1/providers`.

The app container never calls your service. Only the metadata provider does.

For local `npm start`, `baseUrl` may be another process on `127.0.0.1`. Docker Compose puts the metadata provider on a private `metadata` network and does not publish port `3002`. Your service must be on that network, reachable as `host.docker.internal`, or a public HTTPS URL.

`GET /v1/providers` confirms that the slot is available, but it does not distinguish a replacement from the built-in adapter. Verify the replacement by performing a search or item lookup and confirming that the request reaches your service. Search, item lookup, imports, image refresh, rating refresh, tracking season refresh, and missing background-poster resolution then use your service. Collection Tracker does not fall back to the built-in adapter if the replacement is down or returns invalid data.

## Configuration

Create `external-metadata.config.json` in the metadata provider data folder (`.data` for local `npm start`, `./.metadata` for Docker Compose):

```json
{
  "version": 1,
  "providers": {
    "omdb": {
      "baseUrl": "http://metadata:8080/v1",
      "header": {
        "name": "X-Api-Key",
        "valueEnv": "CUSTOM_METADATA_API_KEY"
      }
    },
    "openlibrary": {
      "baseUrl": "https://books.example.com/collection-tracker/v1"
    }
  }
}
```

Provider keys are limited to `omdb`, `openlibrary`, and `musicbrainz`. A configured key replaces that built-in adapter completely. An omitted key keeps the built-in adapter and its existing `.env` configuration. Collection Tracker does not silently fall back to a built-in adapter when a configured replacement fails.

`baseUrl` must use HTTP or HTTPS, must not contain credentials, a query, or a fragment, and may contain a path prefix. Use HTTPS whenever the provider is outside a trusted private network.

`header` is optional. When present, the metadata provider reads its value from the named variable in its data-folder `.env` and sends that header with every replacement request. The environment value must be non-empty. Secrets are never read from `external-metadata.config.json` or logged. `Accept`, `Connection`, `Content-Length`, `Cookie`, `Host`, `Proxy-Authorization`, and `Transfer-Encoding` cannot be configured as custom headers.

Invalid configuration, unsupported provider keys, invalid URLs, and missing header environment values stop metadata-provider startup. Restart the metadata provider after changing the configuration.

## Request Rules

Collection Tracker sends `Accept: application/json`, the optional configured header, no cookies, and no Collection Tracker authentication credentials. Requests time out after 10 seconds and do not follow redirects. Path identifiers are percent-encoded.

Successful responses must have an `application/json` or `+json` content type, use the `{ "data": ... }` envelope, and remain at or below 2 MiB. Item fields use the same normalized shape for every provider. Collection Tracker ignores any returned `provider` field and stamps the configured provider key itself.

## Search

```http
GET {baseUrl}/search?s=the%20matrix
```

Response:

```json
{
  "data": {
    "results": [
      {
        "providerItemId": "tt0133093",
        "externalIds": [{ "source": "imdb", "id": "tt0133093" }],
        "title": "The Matrix",
        "year": "1999",
        "contentType": "movie",
        "poster": "https://images.example.com/matrix.jpg",
        "plot": "A computer hacker learns the nature of reality.",
        "actors": "Keanu Reeves, Laurence Fishburne",
        "genres": ["Action", "Science Fiction"],
        "ratings": [{ "source": "Internet Movie Database", "value": "8.7" }]
      }
    ]
  }
}
```

A search response may contain at most 20 items.

## Item Lookup

```http
GET {baseUrl}/items/{providerItemId}
```

Response:

```json
{
  "data": {
    "providerItemId": "tt0133093",
    "externalIds": [{ "source": "imdb", "id": "tt0133093" }],
    "title": "The Matrix",
    "year": "1999",
    "contentType": "movie",
    "poster": "https://images.example.com/matrix.jpg",
    "plot": "A computer hacker learns the nature of reality.",
    "actors": "Keanu Reeves, Laurence Fishburne",
    "genres": ["Action", "Science Fiction"],
    "ratings": [{ "source": "Internet Movie Database", "value": "8.7" }]
  }
}
```

Return `404` when an item does not exist.

Allowed content types depend on the replaced slot:

| Provider key  | Allowed content types |
| ------------- | --------------------- |
| `omdb`        | `movie`, `series`     |
| `openlibrary` | `book`                |
| `musicbrainz` | `album`               |

`providerItemId` and `title` must be non-empty. Replacements must keep the built-in identity scheme for the replaced slot: IMDb IDs for `omdb`, ISBN-13 for `openlibrary`, and MusicBrainz release MBIDs for `musicbrainz`. Existing collection rows, paste lookup, refresh, and duplicate merge all assume those identifiers. `year`, `poster`, `plot`, and `actors` must be strings and may be empty. A non-empty `poster` must be an absolute public HTTP(S) URL the Collection Tracker image proxy already allows; private or link-local poster hosts are not fetched. `genres` and `ratings` are required arrays. `externalIds` is optional and should use the same alias sources as the replaced slot (`imdb`, `isbn`, or `musicbrainz`).

Field and collection limits:

| Value                              |             Limit |
| ---------------------------------- | ----------------: |
| Search results                     |                20 |
| External IDs per item              |                20 |
| Genres per item                    |               100 |
| Ratings per item                   |                20 |
| Provider and external identity IDs |    512 characters |
| Title                              |  1,024 characters |
| Year                               |     64 characters |
| Poster URL                         |  8,192 characters |
| Plot                               | 65,536 characters |
| Actors                             | 16,384 characters |
| Individual genre                   |    256 characters |
| Rating source or value             |    256 characters |
| Episode title                      |  1,024 characters |

## OMDb Replacement Operations

An `omdb` replacement also provides direct IMDb lookup:

```http
GET {baseUrl}/items/by-imdb/{imdbId}
```

It returns the same item envelope as normal item lookup, or `404` when the item does not exist.

Series season lookup:

```http
GET {baseUrl}/items/{providerItemId}/seasons
```

Response:

```json
{
  "data": {
    "seasons": [
      {
        "season": 1,
        "episodes": 10,
        "titles": ["Episode 1", "Episode 2"]
      }
    ]
  }
}
```

`titles` is optional. Season numbers must be unique. Use at most 50 seasons and 100 episodes per season.

## Operational Behavior

- Metadata search, item lookup, imports, image refresh, rating refresh, tracking season refresh, and missing background-poster resolution use the selected replacement.
- Existing collection items retain the same provider key. Replacing an adapter requires no database migration when the replacement keeps that slot's built-in identity scheme.
- Removing a replacement restores the built-in adapter on the next metadata-provider start. Restart the app afterward so it reloads `GET /v1/providers`.
- Built-in endpoint overrides remain active only for provider slots without replacements.
