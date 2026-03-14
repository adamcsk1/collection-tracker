# Login Application

Source: [`apps/login`](../apps/login)

`apps/login` is the Angular authentication shell. Its scope is intentionally narrow: create an account, sign in with the issued user token, and establish the session required by the rest of the workspace.

## Responsibilities

- `sign-up`: create a user and return the user token that must be retained by the operator
- `sign-in`: exchange username and user token for an authenticated API session
- render the shared blocker, toast, and theme experience used by the workspace
- route under the login subpath with hash-based navigation

## Technical Notes

- Uses standalone Angular components, zoneless change detection, and `withHashLocation()`.
- Shares `@components`, `@services`, `@shared`, and `libs/public/src` with the client application.
- Loads translations from `./login/i18n`.

## Important Paths

- [Route configuration](../apps/login/src/app/main/main-routes.ts)
- [Application config](../apps/login/src/app/main/main-config.ts)
- [Feature source](../apps/login/src/app)

## Nx Targets

```powershell
npx nx serve login
npx nx build login --configuration=production
npx nx test login
npx nx lint login
npx nx run login:stylelint
npx nx run login:typecheck
npx nx run login:typecheck-spec
npx nx run login:format-check
```

## Development Routing

- Standalone dev server: `http://localhost:4201/`
- Proxied path: `http://localhost:4200/login/`
- Feature URLs resolve under `#/`, for example `http://localhost:4200/login/#/sign-in`.
