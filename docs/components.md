# Components Library

Source: [`libs/components`](../libs/components)

`libs/components` provides the shared standalone Angular UI components used by the client, login, and health applications.

## Modules

- `action-menu`: animated secondary actions, using a mobile bottom sheet and an anchored desktop popup
- `autocomplete`: suggestion-driven text input
- `blocker-loading`: full-screen blocking overlay and store
- `callout`: emphasized contextual message with a decorative icon and projected content
- `checkbox`: reusable boolean form control with native indeterminate-state support
- `details`: wrapper around native expandable panels
- `dialog-shell`: shared dialog layout for portal-driven overlays
- `input`: reusable text and password input
- `message-dialog`: compact alert, information, and typed destructive confirmation dialogs
- `poster-background`: floating poster animation used by login and the client shell
- `link-button`: router-aware link styled as a button
- `reveal-label`: touch-hold behavior for icon buttons whose labels expand on fine pointers
- `select`: typed select component
- `spinner-loading`: global spinner and store
- `tabs`: accessible two- or three-option tabs with named content projection
- `textarea`: textarea control with shared styling
- `tooltip`: reusable presentation component for consumer-controlled tooltip triggers and positioning
- `toast`: toast component and store
- `utils`: component-level helper utilities

## Integration Notes

- Import through the `@components/*` path alias.
- The applications provide the blocker, spinner, and toast stores from their application configuration.
- `dialog-shell` works with `PortalService` from the services library.
- `callout` owns the visual treatment and note semantics. Consumers provide the icon and translated projected content.
- `checkbox` accepts `indeterminate` separately from its boolean value so select-all and partial-access controls expose
  native mixed checkbox semantics.
- `tooltip` owns presentation, accessibility semantics, animation, and horizontal collision handling. Consumers provide
  translated text, visibility, a stable ID, the desired horizontal anchor position, and trigger behavior.

### Dialog Actions

`message-dialog` reuses the shell's compact layout, focus trap, close gestures, and portal stack. It exposes a labelled
dialog (`alertdialog` for alerts and confirmations) with a described message. Destructive actions require an exact,
case-sensitive target-name match in the shared input before the action becomes available. Enter cannot bypass the check.
Long messages scroll within the dialog; actions remain outside the scrolling body.

Client, login, and health bind `MESSAGE_DIALOG_COMPONENT` to `MessageDialog` in their application configuration and
register a portal host. Mark background regions with `data-dialog-background`; the portal synchronously makes them inert
while a dialog is open and restores interactivity before returning focus.

Project actions through `dialog-shell-menu-content` or `dialog-shell-bottom-content`. Use `dialog-action` for visible,
labelled touch targets, `dialog-action-primary` for the main outcome, and `button-danger` for destructive actions.

Tracking dialogs use `libc-action-menu` for secondary operations. Supply translated `actions` (`id`, `label`, `icon`, and
optional `destructive`), a translated `title`, and a stable `testIdPrefix`. The `selected` output emits the action ID only
after the native dialog finishes closing and restores focus. Place the trigger in the bottom action area so desktop
menus have room above their anchor. Closed menus remain hidden from the parent shell's focus trap.

The menu uses a full-width sheet at 650 CSS pixels and below, an anchored popup at larger widths, and reduced-motion
alternatives. Destructive actions have a separate divider without changing their rounded focus outlines.

### Tabs

`libc-tabs` renders two or three tab options supplied through the required `options` input. Selection is controlled by the
parent through `selected` and `selectedChange`, allowing consumers to confirm or reject a change before committing it.
Consumers provide a translated `ariaLabel`, a stable `idPrefix`, and content through `tabs-first-content`,
`tabs-second-content`, and the optional `tabs-third-content` projection slots. `focusSelected()` restores focus after a
cancelled change.

The component owns the tab list, tab panels, ARIA relationships, roving tab index, and Left/Right/Home/End keyboard
navigation, skipping disabled options. Projected panels remain instantiated so local form state survives selection changes; the inactive panel
uses `hidden` to leave the accessibility tree and keyboard order.

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
