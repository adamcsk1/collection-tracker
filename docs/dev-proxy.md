# Development Proxy

Source: [`apps/dev-proxy`](../apps/dev-proxy)

`apps/dev-proxy` runs a single local origin for development and fronts the Angular applications and API behind `http://localhost:4200`.

## Route Map

| Path      | Target                         | Notes                                                   |
| --------- | ------------------------------ | ------------------------------------------------------- |
| `/login`  | `http://localhost:4201/login`  | Removes the `/login` prefix before proxying.            |
| `/client` | `http://localhost:4202/client` | Removes the `/client` prefix before proxying.           |
| `/api`    | `http://localhost:3000/api`    | Proxies API traffic without changing the `/api` prefix. |
| `/`       | local redirect                 | Redirects to `/login`.                                  |
| `/health` | local handler                  | Returns `ok`.                                           |

## Proxy Behavior

- Supports WebSocket and Angular HMR upgrade traffic.
- Rewrites `Set-Cookie` headers for local HTTP development by stripping the cookie domain and removing the `Secure` attribute.
- Tracks repeated HTML refreshes on the same path and redirects back to `/` after rapid repeated reloads.

## Nx Target

```powershell
npx nx serve dev-proxy
```
