# Components Library

Source: [`libs/components`](../libs/components)

`libs/components` provides the shared standalone Angular UI components used by the client and login applications.

## Modules

- `autocomplete`: suggestion-driven text input
- `blocker-loading`: full-screen blocking overlay and store
- `checkbox`: reusable boolean form control
- `details`: wrapper around native expandable panels
- `dialog-shell`: shared dialog layout for portal-driven overlays
- `input`: reusable text and password input
- `link-button`: router-aware link styled as a button
- `select`: typed select component
- `spinner-loading`: global spinner and store
- `textarea`: textarea control with shared styling
- `toast`: toast component and store
- `utils`: component-level helper utilities

## Integration Notes

- Import through the `@components/*` path alias.
- The applications provide the blocker, spinner, and toast stores from their application configuration.
- `dialog-shell` works with `PortalService` from the services library.

## Important Paths

- [Source root](../libs/components/src/lib)

## Checks

```powershell
npm run test
npm run lint:check
npm run typecheck
npm run typecheck:spec
npm run format:check
```
