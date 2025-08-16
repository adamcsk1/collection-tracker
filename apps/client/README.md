# Client (apps/client)

Angular application for the main Collection Tracker UI. Built with Nx and Angular application builder.

## Run & build (Nx)

- Dev server: `nx run client:serve`
- Production build: `nx run client:build:production`
- Development build: `nx run client:build:development`
- Lint: `nx run client:lint`
- Stylelint: `nx run client:stylelint`
- Format (write/check): `nx run client:format` / `nx run client:format-check`
- Extract i18n: `nx run client:extract-i18n`

Pre/post build hooks:

- `prebuild`: `apps/client/scripts/set-build-infos.js`
- `postbuild`: `apps/client/scripts/reset-build-infos.js`

## Dev proxy integration

When using `apps/dev-proxy`, the client is expected at `/client` and runs on port 4202.

- Start with base-href aligned to the path (already set in dev config): `/client/`
- Access via the proxy origin, e.g. `http://localhost:4200/client/`
