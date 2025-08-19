# Login (apps/login)

Angular application used exclusively for user authentication: sign up and sign in. It’s a minimal shell that handles issuing/validating tokens via the backend API and forwards users into the main client app afterwards.

## Scope

- Sign up: creates a user and returns a user token (keep it safe)
- Sign in: sends username + user token; server issues a JWT access token and sets it as a signed, HttpOnly `token` cookie (15-day expiry).
  - On each cookie-authenticated API call, the server rotates the token and refreshes the cookie (sliding session).
  - The backend also accepts the access token via `Authorization: Bearer` header.

## Run & build (Nx)

- Dev server: `nx run login:serve` (port 4201)
- Production build: `nx run login:build:production`
- Development build: `nx run login:build:development`
- Lint: `nx run login:lint`
- Stylelint: `nx run login:stylelint`
- Format (write/check): `nx run login:format` / `nx run login:format-check`
- Extract i18n: `nx run login:extract-i18n`

## Dev proxy integration

When using `apps/dev-proxy`, this app is served under `/login`.

- Dev base href is set to `/login/` in the development configuration
- Access via the proxy origin, e.g. `http://localhost:4200/login/`
