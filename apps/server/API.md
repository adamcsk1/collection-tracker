# API Reference (apps/server)

Base URL prefix: `/api/v1`

Authentication

- JWT bearer token in `Authorization: Bearer <token>` where indicated
- Tokens are issued on sign-up and can be rotated via `user/change-token`

## Health

GET `/status`

- Public
- 200: `{ "message": "Ok" }`

GET `/status-guarded`

- Requires JWT
- 200: `{ "message": "Ok" }`
- 401/403 on missing/invalid token

## Auth

POST `/sign-up`

- Body: `{ "username": string }`
- Behavior: Creates a user (unless `DISABLE_REGISTRATION=1` or `USER_LIMIT` reached)
- 200: `{ "token": string }` (JWT to use as bearer)
- 403: registration disabled or limit reached
- 409: username already exists
- 500: server error

POST `/sign-in`

- Body: `{ "username": string, "token": string }`
- Behavior: Validates that provided token matches the stored token hash and that the token is a valid JWT for the user
- 200: empty body on success
- 401: token doesn't match stored hash
- 403: token invalid/expired
- 404: user not found
- 500: server error

PUT `/user/change-token`

- Auth: Bearer required
- Body: `{ "expiration": string }` (JWT expiresIn value, e.g. `"1h"`, `"7d"`; pass an empty string/null to omit expiry)
- 200: `{ "newToken": string }`
- 500: server error

DELETE `/user/delete`

- Auth: Bearer required
- Behavior: Deletes user's store folder, cache entries, and user from database
- 200: empty body
- 500: server error

## Store (per-user markdown items)

GET `/get-all?limit=<n>&offset=<n>`

- Auth: Bearer required
- Query params:
  - `limit` number (default 10)
  - `offset` number (default 0)
- 200: `Array<{ name: string; content: string }>`
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
