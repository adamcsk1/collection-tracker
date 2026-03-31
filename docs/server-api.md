# Server API Reference

Source: [`apps/server/src/apis`](../apps/server/src/apis)

Base path: `/api/v1`

## Authentication Model

- `POST /sign-up` returns the long-lived user token for a new account.
- `POST /sign-in` exchanges username and user token for a JWT access token and sets a signed, HTTP-only `token` cookie.
- Protected routes also accept `Authorization: Bearer <accessToken>`.
- Cookie-authenticated requests rotate the access token and refresh the 15-day cookie window.
- Access tokens created through `POST /user/access-token` are intended for header-based usage and are stored with `expiresAt: null`.

## Public Endpoints

| Method | Path       | Notes                                                                                              |
| ------ | ---------- | -------------------------------------------------------------------------------------------------- |
| `GET`  | `/health`  | Returns `{ "message": "Ok" }`.                                                                     |
| `POST` | `/sign-up` | Body: `{ "username": string }`. Returns `{ "token": string }`.                                     |
| `POST` | `/sign-in` | Body: `{ "username": string, "token": string }`. Returns `200` and sets the signed `token` cookie. |

## Session And Access Tokens

| Method   | Path                            | Notes                                                                                                            |
| -------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DELETE` | `/logout`                       | Revokes the current access token and clears the auth cookie.                                                     |
| `PUT`    | `/user/change-token`            | Rotates the user's long-lived token, replaces the active access-token set, and returns `{ "newToken": string }`. |
| `POST`   | `/user/access-token`            | Creates an additional access token for header-based clients. Returns `{ "accessToken": string }`.                |
| `GET`    | `/user/access-tokens`           | Returns the stored token hashes, creation dates, user agents, and `expiresAt` values.                            |
| `DELETE` | `/user/access-token/:tokenHash` | Deletes one access token by hash.                                                                                |
| `GET`    | `/user/access-token/validate`   | Validates the current token. Cookie-based requests also rotate the cookie token.                                 |

## User Endpoints

| Method   | Path             | Notes                                                                                                                                                                                                                        |
| -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DELETE` | `/user`          | Deletes the current user, the stored Markdown entries, and related configuration.                                                                                                                                            |
| `GET`    | `/user/settings` | Returns persisted user settings. Always includes `claudeAiAvailable: boolean` indicating whether `CLAUDE_API_KEY` is configured on the server. Returns `{ claudeAiAvailable: false }` when no settings have been stored yet. |
| `POST`   | `/user/settings` | Accepts any subset of `fetchBatchSize`, `theme`, `animatedBackground`, and `language`. Returns the merged settings object.                                                                                                   |

Valid values for `POST /user/settings`:

- `theme`: `system`, `dark`, `light`
- `language`: `en`

## Collection Endpoints

| Method   | Path                            | Notes                                                                                                                                                                                                   |
| -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/get-all?limit=<n>&offset=<n>` | Returns `Array<{ name, content, hash }>` sorted by file creation date descending. `hash` is the SHA-512 hash of the file content.                                                                       |
| `POST`   | `/create`                       | Body: `{ "content": string, "name": string }`. Returns `{ "name": string }`, where `name` is the final stored filename after collision handling. Returns `409` if a stale hash file exists (sync needed). |
| `PUT`    | `/change/:name`                 | Body: `{ "content": string, "hash": string }`. Updates one Markdown file. Returns `{ "hash": string }` with the new content hash. Returns `409` if `hash` does not match the stored hash.               |
| `DELETE` | `/delete/:name`                 | Query param: `hash=<string>`. Deletes one Markdown file. Returns `409` if `hash` does not match the stored hash.                                                                                        |

## OMDb Proxy Endpoints

These endpoints proxy requests to the OMDb API using the `OMDB_API_KEY` environment variable. The key is never exposed to the client. Respond with `503` if the variable is not set.

| Method | Path                 | Notes                                                         |
| ------ | -------------------- | ------------------------------------------------------------- |
| `GET`  | `/proxy/omdb/search` | Query param: `s` (title search). Returns `OMDbResponseModel`. |
| `GET`  | `/proxy/omdb/item`   | Query param: `i` (IMDb ID). Returns `OMDbResponseItemModel`.  |

## Claude Proxy Endpoint

This endpoint proxies a natural-language query to the Claude API using the optional `CLAUDE_API_KEY` environment variable. The key is never exposed to the client. Responds with `503` if the variable is not set.

| Method | Path                  | Notes                                                                |
| ------ | --------------------- | -------------------------------------------------------------------- |
| `POST` | `/proxy/claude/query` | Body: `ClaudeQueryRequestModel`. Returns `ClaudeQueryResponseModel`. |

Request body:

```json
{ "prompt": "Which are sci-fi movies?" }
```

Response body:

```json
{ "matchedIds": ["tt0133093"] }
```

The server reads the caller's collection from flat files, extracts IMDb IDs and metadata, and builds the prompt internally. Only the natural-language question is supplied by the client.

Error responses:

- `400` — missing or empty `prompt`
- `503` — `CLAUDE_API_KEY` not configured
- `502` — Claude returned an unparseable or truncated response
- The model used is controlled by the optional `CLAUDE_MODEL` env variable; defaults to `claude-haiku-4-5-20251001`

## Parser And Tag Configuration

| Method | Path                    | Notes                                                                                                                                                                            |
| ------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/parser/config`        | Returns the current parser template, filename pattern, and regexp fields, falling back to defaults when no user config exists.                                                   |
| `POST` | `/parser/change-config` | Accepts any subset of `IMDbId`, `genre`, `genreToken`, `image`, `IMDbRate`, `tags`, `tagToken`, `title`, `year`, `mdTemplate`, and `filenamePattern`. Returns the merged config. |
| `GET`  | `/tag/config`           | Returns the current tag configuration array.                                                                                                                                     |
| `POST` | `/tag/change-config`    | Replaces the full tag configuration array and returns the stored result.                                                                                                         |

Each tag configuration entry has the shape:

```json
{
  "tag": "#example",
  "color": "#112233",
  "useForImageBorder": true,
  "useForTextColor": false,
  "useForImageBadge": false,
  "weight": 0
}
```

## Operational Notes

- All protected endpoints require a valid access token.
- Collection filename patterns are user-configurable. The default pattern is `{{Year}}-{{Type}}-{{ClearedName}}-{{index}}.md`.
- The server keeps unresolved placeholders such as `{{index}}` available for collision handling when a file already exists.
- The server applies `helmet`, `nocache`, JSON body parsing, CORS validation against `CORS_ORIGIN`, and request limiting of 100 requests per 15 minutes per IP.
- Runtime data lives under the active data folder, which defaults to `.data`.
