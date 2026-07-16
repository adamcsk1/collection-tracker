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
- `reveal-label`: touch-hold behavior for icon buttons whose labels expand on fine pointers
- `select`: typed select component
- `spinner-loading`: global spinner and store
- `textarea`: textarea control with shared styling
- `tooltip`: reusable presentation component for consumer-controlled tooltip triggers and positioning
- `toast`: toast component and store
- `utils`: component-level helper utilities

## Integration Notes

- Import through the `@components/*` path alias.
- The applications provide the blocker, spinner, and toast stores from their application configuration.
- `dialog-shell` works with `PortalService` from the services library.
- `tooltip` owns presentation, accessibility semantics, animation, and horizontal collision handling. Consumers provide
  translated text, visibility, a stable ID, the desired horizontal anchor position, and trigger behavior.

### Dialog Actions

Project actions through `dialog-shell-menu-content` or `dialog-shell-bottom-content`. Action buttons use
`button-icon button-reveal-label`, apply `[libcRevealLabel]` with the translated label, include a translated `aria-label`
and `title`, and wrap their translated visual label in `button-reveal-label-text` with an inner `span`.

On fine pointers, labels expand on hover and keyboard focus. On touch input, actions remain icon-only: a normal tap
executes immediately, while pressing and holding displays the translated label without executing the action. Moving the
pointer cancels the hold so horizontally scrolling the action row remains available.

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
