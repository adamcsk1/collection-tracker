# API Reference (apps/server)

Base URL prefix: `/api/v1`

Authentication

- There are two token types:
  - User token: issued on sign-up; used only to sign in and to rotate tokens
  - Access token: JWT issued by sign-in/change-token; for protected routes provide it either
    - as a signed HTTP-only cookie named `token` (preferred), or
    - in the `Authorization` header as `Bearer <accessToken>`
- Rotating via `PUT /user/change-token` issues a new user token and a new access token, invalidating all previous access tokens
- Access tokens currently have no expiry.
  - Cookie has a 1-year expiry and is `HttpOnly`, `Secure`, `SameSite=Strict`, and signed. Ensure `COOKIE_SECRET` is configured.

## Health

GET `/health`

- Public
- 200: `{ "message": "Ok" }`

## Auth

POST `/sign-up`

- Body: `{ "username": string }`
- Behavior: Creates a user (unless `DISABLE_REGISTRATION=1` or `USER_LIMIT` reached)
- 200: `{ "token": string }` (user token; keep it safe—used for sign-in and rotating tokens)
- 403: registration disabled or limit reached
- 409: username already exists
- 500: server error

POST `/sign-in`

- Body: `{ "username": string, "token": string }`
- Behavior: Validates that the provided user token matches the stored hash; on success, issues a new JWT access token, stores its hash, and sets it as a signed HTTP-only cookie named `token`
- 200: empty body (access token is set in the `token` cookie)
- 401: token doesn't match stored hash
- 404: user not found
- 500: server error

PUT `/user/change-token`

- Auth: Bearer required
- Body: none
- Behavior: Generates a new user token and a new JWT access token; replaces the user's allowed token list (all previous access tokens become invalid). The new access token is set as a signed HTTP-only cookie named `token`.
- 200: `{ "newToken": string }` (access token is set in the `token` cookie)
- 500: server error

DELETE `/user/delete`

- Auth: Bearer required
- Behavior: Deletes user's store folder, cache entries, and user from database
- 200: empty body
- 500: server error

## Token management

POST `/user/access-token`

- Auth: Bearer required
- Behavior: Issues a new JWT access token and appends it to the user's allowed token list (existing access tokens remain valid)
- 200: `{ "accessToken": string }`
- 500: server error

GET `/user/access-tokens`

- Auth: Bearer required
- 200: `Array<{ tokenHash: string; createdAt: string; userAgent: string }>`
- 500: server error

DELETE `/user/access-token/:tokenHash`

- Auth: Bearer required
- Params: `tokenHash` (hash of the access token to delete)
- 204: no content (succeeds even if the token hash does not exist)
- 500: server error

GET `/user/access-token/validate`

- Auth: Bearer required
- Behavior: Validates that the provided access token (from the signed `token` cookie or the `Authorization: Bearer` header) is currently allowed for the user
- 204: no content (token is valid)
- 500: server error

## Store (per-user markdown items)

GET `/get-all?limit=<n>&offset=<n>`

- Auth: Bearer required
- Query params:
  - `limit` number (default 10)
  - `offset` number (default 0)
- 200: `Array<{ name: string; content: string }>` (items are sorted by filename descending; newest first)
- 500: server error

POST `/create`

- Auth: Bearer required
- Body: `{ "content": string }`
- 200: `{ "name": string }` (created file name)
- 409: conflict if a file with generated name somehow already exists
- 500: server error

PUT `/modify/:name`

- Auth: Bearer required
- Params: `name` (filename). Path separators are stripped server-side.
- Body: `{ "content": string }`
- 200: empty body
- 404: file not found
- 500: server error

DELETE `/delete/:name`

- Auth: Bearer required
- Params: `name` (filename). Path separators are stripped server-side.
- 200: empty body
- 404: file not found
- 500: server error

## Notes

- Rate limiting applies (100 requests / 15 minutes per IP, successful requests skipped)
- CORS origin must match `CORS_ORIGIN` or be `*`
- Body size limit: 50mb
- Authentication on protected routes accepts either a signed cookie (`token`) or the `Authorization: Bearer` header.
