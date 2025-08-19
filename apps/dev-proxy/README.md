# Dev Proxy (apps/dev-proxy)

Single dev gateway that fronts all three apps during development behind one origin.

## What it does

- Listens on http://localhost:4200
- Proxies with subpaths:
  - `/login` → http://localhost:4201 (path rewritten to `/`)
  - `/client` → http://localhost:4202 (path rewritten to `/`)
  - `/api` → http://localhost:3000 (no path rewrite; server exposes `/api/v1/...`)
- `/` redirects to `/login/`
- WebSockets/HMR supported

## Dev cookie handling

To make auth cookies work over HTTP in dev, the proxy:

- strips the `Domain` attribute (host-only cookies)
- removes `Secure` (browsers reject it on http)

Note: This is for development only. Don’t use these relaxations in production.

## Health check

- `GET http://localhost:4200/health` → `ok`
