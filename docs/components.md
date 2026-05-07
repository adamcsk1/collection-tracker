# Components Library

Source: [`libs/components`](../libs/components)

`libs/components` provides the shared standalone Angular UI components used by the client and login applications.

## Modules

- `autocomplete`: suggestion-driven text input
- `blocker-loading`: full-screen blocking overlay and store
- `checkbox`: reusable boolean form control
- `details`: wrapper around native expandable panels
- `dialog-shell`: shared dialog layout for portal-driven overlays
- `image-icon`: icon rendered as a `<span>` with a CSS background image; accepts `imageUrl` and `ariaLabel` inputs
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
- [Project configuration](../libs/components/project.json)

## Nx Targets

```powershell
npx nx test components
npx nx lint components
npx nx run components:typecheck
npx nx run components:typecheck-spec
npx nx run components:format-check
```
