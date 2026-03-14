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

| Method   | Path             | Notes                                                                                                                                    |
| -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `DELETE` | `/user`          | Deletes the current user, the stored Markdown entries, and related configuration.                                                        |
| `GET`    | `/user/settings` | Returns persisted user settings or `{}` when none have been stored yet.                                                                  |
| `POST`   | `/user/settings` | Accepts any subset of `fetchBatchSize`, `theme`, `animatedBackground`, `language`, and `searchMode`. Returns the merged settings object. |

Valid values for `POST /user/settings`:

- `theme`: `system`, `dark`, `light`
- `language`: `en`
- `searchMode`: `standard`, `fuzzy`

## Collection Endpoints

| Method   | Path                            | Notes                                                             |
| -------- | ------------------------------- | ----------------------------------------------------------------- |
| `GET`    | `/get-all?limit=<n>&offset=<n>` | Returns `Array<{ name, content }>` sorted by filename descending. |
| `POST`   | `/create`                       | Body: `{ "content": string }`. Returns `{ "name": string }`.      |
| `PUT`    | `/modify/:name`                 | Body: `{ "content": string }`. Updates one Markdown file.         |
| `DELETE` | `/delete/:name`                 | Deletes one Markdown file.                                        |

## Parser And Tag Configuration

| Method | Path                    | Notes                                                                                                                                                         |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/parser/config`        | Returns the current parser template and regexp fields, falling back to defaults when no user config exists.                                                   |
| `POST` | `/parser/change-config` | Accepts any subset of `IMDbId`, `genre`, `genreToken`, `image`, `IMDbRate`, `tags`, `tagToken`, `title`, `year`, and `mdTemplate`. Returns the merged config. |
| `GET`  | `/tag/config`           | Returns the current tag configuration array.                                                                                                                  |
| `POST` | `/tag/change-config`    | Replaces the full tag configuration array and returns the stored result.                                                                                      |

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
- The server applies `helmet`, `nocache`, JSON body parsing, CORS validation against `CORS_ORIGIN`, and request limiting of 100 requests per 15 minutes per IP.
- Runtime data lives under the active data folder, which defaults to `.data`.
