# Dev Proxy (apps/dev-proxy)

A tiny Angular dev-server used purely as a reverse-proxy during local development to mirror the Docker/Nginx routing used in production. It lets you access the whole app via a single origin while developing separate frontends and the API.

## What it does
- Runs an Angular dev server on port 4200
- Proxies routes according to `proxy.conf.js`:
  - `/api` → Node server (http://localhost:3000)
  - `/login` → Login app dev server (http://localhost:4201)
  - `/client` → Client app dev server (http://localhost:4202)
  - `/` → Redirects to `/login`

## Why
- Mimic the production path structure: `/login`, `/client`, and `/api`

## Start locally (Nx)
- Start the proxy: `nx run dev-proxy:serve`
- In parallel, start the other dev servers on the expected ports:
  - Login: `nx run login:serve` (ensure it listens on 4201; set base-href if needed)
  - Client: `nx run client:serve` (ensure it listens on 4202; set base-href if needed)
  - Server: `nx run server:serve` (ensure HOST/PORT in `.data/.env` match `localhost:3000`)

Tip: for clean sub-path hosting in dev, serve SPAs with matching base-href:

```
nx run login:serve  -- --base-href=/login/
nx run client:serve -- --base-href=/client/
```

## Configuration
- Proxy rules live in `apps/dev-proxy/proxy.conf.js`
- Port is configured in `apps/dev-proxy/project.json` (default 4200)

## Notes
- This app serves no UI; `index.html` is a placeholder
- Ensure your API server `.env` allows the proxy origin via `CORS_ORIGIN=http://localhost:4200` (or `*`)
