# Shared Library (libs/shared)

[![Nx Workspace](https://img.shields.io/badge/Monorepo-Nx-143055?logo=nx&logoColor=white)](https://nx.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Utility%20Types-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

Cross-cutting models, utility types, animations, and helpers shared across the workspace. Import with the alias `@shared/*`.

## Contents

Models

- `@shared/models/api-model` — DTOs for API requests/responses
- `@shared/models/form-model` — `Form<T>` helper type mapping fields to FormControl
- `@shared/models/select-model` — `SelectInputModel` and item shape for select components

Animations

- `@shared/animations/opacity-animation`
- `@shared/animations/scale-animation`

Styles

- Base: `libs/shared/src/lib/styles/reset.css`, `libs/shared/src/lib/styles/colors.css`, `libs/shared/src/lib/styles/variables.css`
- Components: `libs/shared/src/lib/styles/components/button.css`, `libs/shared/src/lib/styles/components/form.css`, `libs/shared/src/lib/styles/components/dialog.css`

Utils

- `@shared/utils/random-int-util` — `randomInt(min, max)`

## Usage

### API models

```ts
import { CreateApiRequestModel, GetAllApiResponseModel } from '@shared/models/api-model';

const body: CreateApiRequestModel = { content: '# markdown' };
// ...use with ApiService
```

### Form type helper

```ts
import { Form } from '@shared/models/form-model';
import { FormControl } from '@angular/forms';

interface SettingsFormModel {
  apiUrl: string;
  token: string;
}

const form: Form<SettingsFormModel> = {
  apiUrl: new FormControl(''),
  token: new FormControl(''),
};
```

### Select model

```ts
import { SelectInputModel } from '@shared/models/select-model';

const options: SelectInputModel = [
  { text: 'One', value: 1 },
  { text: 'Two', value: 2 },
];
```

### Utils

```ts
import { randomInt } from '@shared/utils/random-int-util';

const n = randomInt(1, 6); // 1..6
```

### Styles

Shared CSS utilities and tokens to keep look-and-feel consistent across apps.

- Base styles
  - `reset.css` — minimal reset and a11y-friendly defaults
  - `colors.css` — theme tokens; switch via `.dark` or `.light` on a container
  - `variables.css` — sizing, spacing, borders, and focus variables
- Component styles
  - `components/button.css` — base `button` styles and modifiers: `.button-danger`, `.button-basic`, `.button-icon`
  - `components/form.css` — vertical layout and `.form-buttons` toolbar
  - `components/dialog.css` — fixed-position `.dialog` overlay

Usage (import in your app's global `styles.css`):

```css
@import url('../../../libs/shared/src/lib/styles/reset.css');
@import url('../../../libs/shared/src/lib/styles/colors.css');
@import url('../../../libs/shared/src/lib/styles/variables.css');
@import url('../../../libs/shared/src/lib/styles/components/button.css');
@import url('../../../libs/shared/src/lib/styles/components/form.css');
@import url('../../../libs/shared/src/lib/styles/components/dialog.css');
```

Quick examples:

```html
<body class="dark">
  <!-- or light -->
  <form>
    <div class="form-buttons">
      <button>Save</button>
      <button class="button-basic" type="button">Cancel</button>
      <button class="button-danger" type="button">Delete</button>
    </div>
  </form>

  <div class="dialog"><!-- overlay content --></div>

  <!-- CSS variables available, e.g.: var(--main-color), var(--text-color), var(--size-small) -->
  <!-- Focus styles use var(--outline-style) and var(--outline-offset) -->
</body>
```

## Nx tasks

Run from the repo root.

```powershell
# Lint TS
npx nx lint shared

# Lint CSS via stylelint
npx nx run shared:stylelint

# Format (write) or check
npx nx run shared:format
npx nx run shared:format-check
```

## Contributing

- Keep models framework-agnostic and small; avoid runtime dependencies.
- Prefer reusable types and narrow interfaces; avoid leaking UI concerns.
- Place only cross-cutting utilities here; keep domain-specific logic in feature libs.
- Add brief docs and examples here when introducing new models or utils.

## License

MIT — see the [LICENSE](../../LICENSE).
