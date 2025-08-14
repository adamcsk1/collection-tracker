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

## Nx tasks

Run from the repo root.

```powershell
# Lint TS
npx nx lint shared

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
