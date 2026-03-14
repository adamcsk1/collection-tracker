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
- `markdown-editor`: EasyMDE-based Markdown editor
- `select`: typed select component
- `spinner-loading`: global spinner and store
- `textarea`: textarea control with shared styling
- `toast`: toast component and store

## Integration Notes

- Import through the `@components/*` path alias.
- The applications provide the blocker, spinner, and toast stores from their application configuration.
- `dialog-shell` works with `PortalService` from the services library.
- `markdown-editor` wraps `easymde`, which is already accounted for in the client build configuration.

## Important Paths

- [Source root](../libs/components/src/lib)
- [Project configuration](../libs/components/project.json)

## Nx Targets

```powershell
npx nx test components
npx nx lint components
npx nx run components:stylelint
npx nx run components:typecheck
npx nx run components:typecheck-spec
npx nx run components:format-check
```
