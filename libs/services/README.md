# Services Library (libs/services)

[![Nx Workspace](https://img.shields.io/badge/Monorepo-Nx-143055?logo=nx&logoColor=white)](https://nx.dev)
[![Angular](https://img.shields.io/badge/Angular-Services-dd0031?logo=angular&logoColor=white)](https://angular.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

Cross-app Angular services and signal stores: API client, OMDb integration, portal utilities, simple alert/confirm, theme management, and web storage helpers.

Highlights

- Injectable services with focused responsibilities
- Signal stores via `ngx-simple-signal-store` for lightweight app state
- Clean models in `@shared/models/*`
- Works seamlessly with the components library

## Contents

Services

- AlertService — minimal alert wrapper
- ConfirmService — minimal confirm wrapper returning Observable<boolean>
- PortalService — open/close dynamic components via ViewContainerRef
- ThemeService — system/dark/light theme management
- ApiService — backend REST client with lazy pagination
- OMDbService — public OMDb API helper for movie/series lookup
- WebstorageService — tiny localStorage/sessionStorage helper

Stores

- apiStateToken — API URL, token, fetchBatchSize, and loadNetworkStatus
- omdbStateToken — OMDb API key
- themeStateToken — current theme preference

Import path alias: `@services/*` (see monorepo `tsconfig.json`).

## Setup

Provide the stores once at app bootstrap:

```ts
import { ApplicationConfig } from '@angular/core';
import { provideStore } from 'ngx-simple-signal-store';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { initialOMDbState, omdbStateToken } from '@services/omdb/omdb-store';
import { initialThemeState, themeStateToken } from '@services/theme/theme-store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStore(initialApiState, apiStateToken),
    provideStore(initialOMDbState, omdbStateToken),
    provideStore(initialThemeState, themeStateToken),
  ],
};
```

## Usage

### ApiService

```ts
import { inject } from '@angular/core';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';

const api = inject(ApiService);
const apiState = inject(apiStateToken);

// Configure at runtime (e.g., settings screen)
apiState.setState('apiUrl', 'https://your.api/v1');
apiState.setState('token', '<JWT>');
apiState.setState('fetchBatchSize', 25);

// Check server status
api.getStatus({ suppressErrors: true }).subscribe();

// Load all items, emits pages lazily
api.getAll().subscribe((items) => {
  // consume items page-by-page
});

// CRUD
api.create('{ markdown or json }').subscribe();
api.update('item-name.md', 'new content').subscribe();
api.delete('item-name.md').subscribe();
```

Load network status is tracked via store key `loadNetworkStatus` ('pending' | 'finished' | 'error' | null).

### OMDbService

```ts
import { Component, inject } from '@angular/core';
import { OMDbService } from '@services/omdb/omdb-service';
import { omdbStateToken } from '@services/omdb/omdb-store';

@Component({ selector: 'demo-omdb', standalone: true, template: '', providers: [OMDbService] })
export class DemoOMDb {
  private readonly omdb = inject(OMDbService);
  private readonly omdbStore = inject(omdbStateToken);

  constructor() {
    this.omdbStore.setState('apiKey', '<OMDB_API_KEY>');
    this.omdb.getMatchedContents('The Matrix');
    this.omdb.matchedContent(); // signal with [{ text, value }] options
  }

  select(id: string) {
    this.omdb.getSelectedContent(id).subscribe();
  }
}
```

Note: OMDbService is provided locally (not `providedIn: 'root'`). Add it to the `providers` array where you use it.

### PortalService

```ts
import { Component, ViewContainerRef, viewChild, inject } from '@angular/core';
import { PortalService } from '@services/portal-service';

@Component({
  selector: 'app-root-portal',
  template: '<ng-container #portal></ng-container>',
  standalone: true,
})
export class RootPortalHost {
  private readonly portal = inject(PortalService);
  readonly portalRef = viewChild('portal', { read: ViewContainerRef });

  ngOnInit() {
    this.portal.setViewContainerRef(this.portalRef()!);
  }
}

// later
// this.portal.open(SomeDialogComponent, { someInput: 42 });
// this.portal.close();
// this.portal.componentRef(); // access last opened component ref (signal)
```

### ThemeService

```ts
import { inject } from '@angular/core';
import { ThemeService } from '@services/theme/theme-service';
import { themeStateToken } from '@services/theme/theme-store';

const theme = inject(ThemeService);
const themeStore = inject(themeStateToken);

theme.listen(); // start listening once (system changes, initialize class on <html>)
theme.darkTheme(); // computed signal -> true when dark is active
themeStore.setState('theme', 'dark'); // 'system' | 'dark' | 'light'
```

### WebstorageService

```ts
import { inject } from '@angular/core';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { WebStorageTypes } from '@services/webstorage/webstorage-model';

const storage = inject(WebstorageService);

// Write (defaults to 'local')
storage.setItem('token', 'abc123');
storage.setItem('sessionId', 's-42', 'session'); // explicitly session

// Read (auto: sessionStorage first, then localStorage)
// Optional: force a specific storage with the 2nd arg
const token = storage.getItem('token');
const sessionToken = storage.getItem('token', 'session');
const localToken = storage.getItem('token', 'local');

// Remove and clear
storage.removeItem('token'); // defaults have been removed from both session and local storage
storage.clear('session'); // clears sessionStorage

// Tip: store JSON
// storage.setItem('settings', JSON.stringify(obj));
// const settings = JSON.parse(storage.getItem('settings') ?? 'null');
```

### AlertService and ConfirmService

```ts
import { inject } from '@angular/core';
import { AlertService } from '@services/alert-service';
import { ConfirmService } from '@services/confirm-service';

const alert = inject(AlertService);
const confirm = inject(ConfirmService);

alert.show('Saved successfully');
confirm.open('Are you sure?').subscribe((yes) => yes && doDelete());
```

## Nx tasks

Run from the repo root.

```powershell
# Lint TS
npx nx lint services

# Format (write) or check
npx nx run services:format
npx nx run services:format-check
```

## Contributing

- Keep services focused (single responsibility) and composable.
- Prefer `providedIn: 'root'` for app-wide services; use local providers when scoping is needed.
- Use `ngx-simple-signal-store` for shared, minimal state; avoid global singletons when a scoped store suffices.
- Keep the shared models in `@shared/models/*`; avoid duplicating DTOs.
- Handle errors consistently (surface via `AlertService` or caller UI); don’t swallow errors.
- When adding a service/store, update this README with a brief usage snippet.

## License

MIT — see the [LICENSE](../../LICENSE).
