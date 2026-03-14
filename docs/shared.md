# Shared Library

Source: [`libs/shared`](../libs/shared)

`libs/shared` holds the cross-cutting models, constants, styles, animations, and utilities that keep the client, login app, and server aligned.

## Contents

- `constants/`: API prefix, parser defaults, storage keys, and tag constants
- `models/`: API DTOs and shared language, theme, search, and select types
- `regexps/`: reusable regexp helpers such as IMDb ID extraction
- `styles/`: reset styles, design tokens, shared component CSS, and animation styles
- `utils/`: parser serialization, search helpers, color helpers, clipboard helpers, device heuristics, and general utilities
- `animations/`: shared animation helpers used by the frontend

## Integration Notes

- Import through the `@shared/*` path alias.
- The Angular applications consume the shared CSS and constants for consistent behavior and presentation.
- The server reuses the same constants and DTOs so the API contract stays in one place.

## Important Paths

- [Source root](../libs/shared/src/lib)
- [Project configuration](../libs/shared/project.json)

## Nx Targets

```powershell
npx nx test shared
npx nx lint shared
npx nx run shared:stylelint
npx nx run shared:typecheck
npx nx run shared:typecheck-spec
npx nx run shared:format-check
```
