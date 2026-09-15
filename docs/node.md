# Node Library

Source: [`libs/node`](../libs/node)

`libs/node` holds Node-only runtime shared by `apps/server` and `apps/metadata-provider`. It is not imported by Angular apps.

## Contents

- `models/`: runtime provider interfaces and replacement HTTP client config
- `constants/`: normalized HTTP provider limits and timeouts
- `utils/`: normalized HTTP metadata client and season-capability type guard

## Integration Notes

- Import through the `@node/*` path alias.
- DTOs and identity helpers stay in `libs/shared`.
- Built-in OMDb, Open Library, and MusicBrainz adapters stay in `apps/metadata-provider`.
- Server and metadata-provider factories keep their own provider lists and call `createNormalizedHttpExternalMetadataProvider` for HTTP slots.

## Important Paths

- [Source root](../libs/node/src/lib)

## Checks

```powershell
npm run test
npm run lint:check
npm run typecheck
npm run typecheck:spec
npm run format:check
```
