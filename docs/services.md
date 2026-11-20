# Services Library

Source: [`libs/services`](../libs/services)

`libs/services` contains the shared Angular service layer and signal stores used across the client, login, and health applications.

## Modules

- `api/`: HTTP client, auth/session integration, pagination, API store, collection CRUD, scope and individual-item shares, statistics, media refresh, tracking and books cleanup, and AI list search query (`getAiQueryData(prompt, listType)`)
- `external-metadata/`: external metadata lookup logic (search and item fetch via server proxy)
- User profile and avatar loading support authenticated navigation and sharing identity displays; see
  [User profiles](./user-profiles.md).
- `theme/`: theme state and DOM class management
- `webstorage/`: local and session storage abstraction
- root services: `alert-service.ts`, `confirm-service.ts`, `portal-service.ts`, `translate-service.ts`

## Integration Notes

- Import through the `@services/*` path alias.
- `apiStateToken` and `themeStateToken` are the primary cross-application stores.
- `PortalService` is the common primitive for dialog and dynamic component hosting.
- `AndroidBackHandlerService` installs the WebView Back hook in client, login, and health so Back cancels the top dialog
  before falling through to Android navigation.
- `AlertService.show()` opens an alert, and `info()` opens an informational dialog. `ConfirmService.open()` emits one
  boolean and completes; `ifConfirmed()` emits only affirmative results. These dialogs are asynchronous and do not block
  JavaScript. They stack above an existing dialog without discarding its form state.
- Destructive confirmations pass `{ destructive: true, confirmationText }`, with an optional translated `actionLabel`.
  Use the target's actual name or identifier; bulk operations use the displayed scope. Account actions use the Account
  scope rather than the editable display name. Dismissal or destruction resolves as false.
  Clearing all episode progress requires the Series scope; bulk uncompleted actions require Movies, Series, Books, or Music.
- `MESSAGE_DIALOG_COMPONENT` keeps concrete UI imports out of the services library. Dialogs close before result handlers
  run, so handlers may safely open a replacement dialog.
- New-item duplicate checks are advisory and suppress global error dialogs. A selected-item share may allow creation
  without permission to inspect other owner items. Lookup errors still propagate to the form's existing fallback; actual
  saves retain error alerts and server-side uniqueness and authorization checks.
  Closing a saved new-item dialog leaves any tracking-update failure alert open for acknowledgement.
- `ApiService.getCollectionItemShares()` and `saveCollectionItemShares()` load and replace explicit recipients for one
  owned physical item.
- The client uses the full library; the login app uses the API, theme, translation, and notification subset.

## Important Paths

- [Source root](../libs/services/src/lib)
- [Source root](../libs/services/src/lib)

## Checks

```powershell
npm run test
npm run lint:check
npm run typecheck
npm run typecheck:spec
npm run format:check
```
