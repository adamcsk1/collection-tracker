# Development Proxy

Source: [`apps/dev-proxy`](../apps/dev-proxy)

`apps/dev-proxy` runs a single local origin for development and fronts the Angular applications and API behind `http://localhost:4200`.

## Route Map

| Path      | Target                         | Notes                                         |
| --------- | ------------------------------ | --------------------------------------------- |
| `/login`  | `http://localhost:4201/login`  | Proxies matching traffic as-is.               |
| `/client` | `http://localhost:4202/client` | Proxies matching traffic as-is.               |
| `/health` | `http://localhost:4203/health` | Proxies matching traffic as-is.               |
| `/api`    | `http://localhost:3000/api`    | Proxies API traffic as-is.                    |
| `/`       | local redirect                 | Redirects to `/login`.                        |

## Proxy Behavior

- Supports WebSocket and Angular HMR upgrade traffic.
- Rewrites `Set-Cookie` headers for local HTTP development by stripping the cookie domain and removing the `Secure` attribute.

## Development Command

```powershell
npm start
```
