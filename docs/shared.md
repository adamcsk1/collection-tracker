# Shared Library

Source: [`libs/shared`](../libs/shared)

`libs/shared` holds the cross-cutting models, constants, styles, animations, and utilities that keep the client, login app, and server aligned.

## Contents

- `constants/`: API prefix, storage keys, export/import metadata, and series-tracker limits
- `models/`: API DTOs and shared AI search, collection item, collection-list display, language, share, statistics, theme, select, and OMDb types
- `omdb/`: reusable OMDb helpers such as IMDb ID extraction
- `styles/`: reset styles, design tokens, shared component CSS, and animation styles
- `utils/`: collection item helpers, color helpers, clipboard helpers, device heuristics, and general utilities

## Integration Notes

- Import through the `@shared/*` path alias.
- The Angular applications consume the shared CSS and constants for consistent behavior and presentation.
- The server reuses the same constants and DTOs so the API contract stays in one place.

## Important Paths

- [Source root](../libs/shared/src/lib)
- [Source root](../libs/shared/src/lib)

## Checks

```powershell
npm run test
npm run lint:check
npm run typecheck
npm run typecheck:spec
npm run format:check
```
