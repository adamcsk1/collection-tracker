# Components Library (libs/components)

[![Nx Workspace](https://img.shields.io/badge/Monorepo-Nx-143055?logo=nx&logoColor=white)](https://nx.dev)
[![Angular](https://img.shields.io/badge/Angular-Standalone%20Components-dd0031?logo=angular&logoColor=white)](https://angular.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

Reusable Angular standalone UI components shared across the workspace. Built with modern Angular (signals, standalone imports, control flow blocks) and designed to be simple to compose and theme.

Highlights

- Standalone Angular components, no NgModule required
- Form-friendly inputs (FormControl) with validation hints
- Lightweight state via ngx-simple-signal-store
- i18n friendly via ngx-signal-translate
- Clean CSS

## Contents

- libc-input — Text/password input with label, required marker, reset button, icon and validation hints
- libc-select — Select dropdown bound to a FormControl with typed options
- libc-textarea — Textarea with optional auto-height and sizing
- libc-details — Native details/summary with optional default open and persisted state
- libc-spinner-loading — Global loading spinner driven by a simple store
- libc-blocker-loading — Full-screen blocking overlay with title/logo shown during critical app loading
- libc-toast — Tiny toast message component with auto-dismiss
- libc-dialog-shell — Shell for dialogs with action/content slots and close button

Import path aliases: `@components/*` (see `tsconfig.json`).

## Installation & peers

This is an internal Nx library; consumers inside the monorepo import directly via path aliases. Components rely on these workspace deps:

- Angular (standalone components, ReactiveForms)
- ngx-simple-signal-store — for small, injectable signal stores
- ngx-signal-translate — for i18n helpers used in templates

If you use the spinner or toast components, make sure to provide their stores at the application level (see Setup below).

## Setup

Provide the stores once at app bootstrap (example from `apps/client/src/app/app-config.ts`):

```ts
import { ApplicationConfig } from '@angular/core';
import { provideStore } from 'ngx-simple-signal-store';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import {
  initialBlockerLoadingState,
  blockerLoadingStateToken,
} from '@components/blocker-loading/blocker-loading-store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStore(initialToastState, toastStateToken),
    provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
    provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
    provideSignalTranslateConfig({ path: './i18n' }),
  ],
};
```

## Usage

All components are standalone. Import them directly where you need them.

### libc-input

```ts
// component.ts
import { Component } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Input as LibcInput } from '@components/input/input';

@Component({
  selector: 'demo-input',
  imports: [LibcInput],
  templateUrl: './demo.html',
})
export class DemoInputComponent {
  username = new FormControl<string>('', { validators: [Validators.required] });
}
```

```html
<!-- demo.html -->
<libc-input
  [label]="'Username'"
  [mandatory]="true"
  [placeholder]="'Type your username'"
  [showReset]="true"
  [icon]="'person'"
  [control]="username"
>
  <!-- extra field-level errors can be projected -->
  <span errors *ngIf="username.hasError('minlength')">Min length is 3</span>
</libc-input>
```

Inputs

- inputId?: string (auto-generated)
- type?: 'text' | 'password' (default: 'text')
- label?: string
- mandatory?: boolean
- showReset?: boolean
- placeholder?: string
- icon?: string
- control: FormControl<T> (required)
- hint?: string

### libc-select

```ts
import { Component } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Select } from '@components/select/select';
import { SelectInputModel } from '@shared/models/select-model';

@Component({ selector: 'demo-select', imports: [Select], templateUrl: './demo.html' })
export class DemoSelectComponent {
  options: SelectInputModel = [
    { text: 'One', value: 1 },
    { text: 'Two', value: 2 },
  ];
  value = new FormControl<number | null>(null, { validators: [Validators.required] });
}
```

```html
<libc-select [label]="'Choose'" [mandatory]="true" [options]="options" [control]="value">
  <span errors *ngIf="value.hasError('required')">Selection required</span>
</libc-select>
```

Inputs

- selectId?: string (auto-generated)
- options: SelectInputModel (required: array of { text, value })
- label: string (required)
- mandatory?: boolean
- control: FormControl<T> (required)
- hint?: string

### libc-textarea

```ts
import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Textarea } from '@components/textarea/textarea';

@Component({ selector: 'demo-textarea', imports: [Textarea], templateUrl: './demo.html' })
export class DemoTextareaComponent {
  notes = new FormControl<string>('');
}
```

```html
<libc-textarea
  [label]="'Notes'"
  [rows]="6"
  [autoHeight]="true"
  [control]="notes"
  hint="Markdown supported"
></libc-textarea>
```

Inputs

- textareaId?: string (auto-generated)
- label?: string
- mandatory?: boolean
- control: FormControl<T> (required)
- hint?: string
- rows?: number
- cols?: number
- autoHeight?: boolean (auto-fits to container height)

### libc-details

Lightweight wrapper around the native HTML details/summary elements. Supports an optional default-open state and automatically persists the last open/closed state per summary in web storage.

```ts
import { Component } from '@angular/core';
import { Details } from '@components/details/details';

@Component({ selector: 'demo-details', imports: [Details], templateUrl: './demo.html' })
export class DemoDetailsComponent {}
```

```html
<libc-details [summary]="'Advanced options'" [open]="false">
  <p>Here go additional settings and explanations.</p>
  <!-- Any projected content is supported -->
  <div class="stack gap-small">
    <label><input type="checkbox" /> Enable beta features</label>
    <label><input type="checkbox" /> Show debug info</label>
  </div>

  <!-- You can include other components inside as needed -->
  <!-- <libc-input ...></libc-input> -->

  <p class="muted">State is remembered per device/browser.</p>

  <!-- Optional long content to demonstrate collapse/expand -->
  <!-- ... -->
</libc-details>
```

Inputs

- summary: string (required) — The text shown in the summary line; also used as part of the storage key, so keep it stable and unique for a given details block.
- open?: boolean (default: false) — Initial open state. User toggles are persisted using the workspace WebstorageService.

Notes

- Accessibility: It uses native <details>/<summary>, so keyboard and semantics come for free.
- Persistence: Open/closed state is saved per summary in web storage; changing the summary text will reset the remembered state.

### libc-spinner-loading

Place once near the app root so it can overlay screens when active.

```ts
import { Component } from '@angular/core';
import { SpinnerLoading } from '@components/spinner-loading/spinner-loading';

@Component({ selector: 'app-root-ui', imports: [SpinnerLoading], template: '<libc-spinner-loading />' })
export class AppRootUi {}
```

Trigger from anywhere:

```ts
import { inject } from '@angular/core';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';

const spinner = inject(spinnerLoadingStateToken);
spinner.setState('show', true); // show
spinner.setState('show', false); // hide
```

### libc-blocker-loading

Full-screen overlay that blocks interaction while the app performs critical work (e.g., bootstrapping, heavy route resolves). It appears after a short delay (~500ms) to avoid flicker on very fast operations.

```ts
import { Component } from '@angular/core';
import { BlockerLoading } from '@components/blocker-loading/blocker-loading';

@Component({ selector: 'app-root-ui', imports: [BlockerLoading], template: '<libc-blocker-loading />' })
export class AppRootUi {}
```

Trigger from anywhere:

```ts
import { inject } from '@angular/core';
import { blockerLoadingStateToken } from '@components/blocker-loading/blocker-loading-store';

const blocker = inject(blockerLoadingStateToken);
blocker.setState('show', true); // show full-screen blocker
blocker.setState('show', false); // hide
```

Notes

- Uses `ngx-signal-translate` for i18n strings like `Title` and `Message.Loading`.
- The template references `icons/logo.png`; ensure a logo exists in your app's public assets or adjust as needed.

### libc-toast

Place once near the app root:

```ts
import { Component } from '@angular/core';
import { Toast } from '@components/toast/toast';

@Component({ selector: 'app-toasts', imports: [Toast], template: '<libc-toast />' })
export class AppToasts {}
```

Show a message programmatically:

```ts
import { inject } from '@angular/core';
import { toastStateToken } from '@components/toast/toast-store';

const toast = inject(toastStateToken);
toast.setState('timeout', 3000);
toast.setState('message', 'Saved successfully');
```

### libc-dialog-shell

Wrapper that provides an action bar (with a close button) and a content area via slots:

```html
<libc-dialog-shell>
  <div dialog-shell-actions>
    <button class="button" (click)="onSave()">Save</button>
  </div>

  <div dialog-shell-content>
    <!-- your dialog body here -->
  </div>
</libc-dialog-shell>
```

The close button uses `PortalService` from `@services/portal-service` under the hood to close the active portal.

## Nx tasks

Run from the repo root.

```powershell
# Lint TS + HTML
npx nx lint components

# Lint CSS via stylelint
npx nx run components:stylelint

# Format (write) or check
npx nx run components:format
npx nx run components:format-check
```

## Contributing

- Keep components standalone and self-contained.
- Favor `FormControl` inputs for form components.
  - Avoid implementing ControlValueAccessor when possible to simplify the components.
- Keep CSS minimal and accessible; prefer CSS variables for theming.
- Add small usage snippets in this README when adding a new component.

## License

MIT — see the [LICENSE](../../LICENSE).
