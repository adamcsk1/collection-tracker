# Node Library

Source: [`libs/node`](../libs/node)

`libs/node` holds Node-only runtime shared by `apps/server` and `apps/metadata-provider`. It is not imported by Angular apps.

## Contents

- `models/`: runtime provider interfaces, replacement HTTP client config, and file-logger config
- `constants/`: normalized HTTP provider limits and timeouts
- `utils/`: normalized HTTP metadata client, season-capability type guard, shared file logger, and safe metadata-error diagnostics

## Integration Notes

- Import through the `@node/*` path alias.
- DTOs and identity helpers stay in `libs/shared`.
- Built-in OMDb, Open Library, and MusicBrainz adapters stay in `apps/metadata-provider`.
- Server and metadata-provider factories keep their own provider lists and call `createNormalizedHttpExternalMetadataProvider` for HTTP slots.
- Server and metadata-provider loggers call `createFileLogger`. The server writes `log-YYYY-MM-DD.txt` with no service label; the metadata provider writes `metadata-provider-YYYY-MM-DD.txt` labelled `metadata-provider`. Argv parsing stays in each app.

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
