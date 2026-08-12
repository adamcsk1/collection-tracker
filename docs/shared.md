# Shared Library

Source: [`libs/shared`](../libs/shared)

`libs/shared` holds the cross-cutting models, constants, styles, animations, and utilities that keep the client, login app, and server aligned.

## Contents

- `constants/`: API prefix, storage keys, export/import metadata, and series season/episode limits
- `models/`: API DTOs and shared AI search, collection item, collection-list display, external metadata, language, share, statistics, theme, select, and provider DTO types
- `styles/`: reset styles, design tokens, shared component CSS, and animation styles
- `utils/`: collection item helpers, color helpers, clipboard helpers, device heuristics, IMDb ID helpers, and general utilities

## Integration Notes

- Import through the `@shared/*` path alias.
- The Angular applications consume the shared CSS and constants for consistent behavior and presentation.
- The server reuses the same constants and DTOs so the API contract stays in one place.
- Share grant DTOs require `readMode` values `all` or `selected`; an absent grant means no scope access. Item-share DTOs
  use `none`, `selected`, or `all` because they report each recipient's state for one item.
- Default collection owners are stored per exact list and content scope. Recipients can select an incoming owner only
  when that scope grants Add permission; missing or invalid defaults use the recipient's own collection.

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
