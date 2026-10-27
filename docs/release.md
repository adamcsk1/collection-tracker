# Release

`npm run release` builds the web apps, server, and Android wrapper, then writes versioned artifacts under `release/`. Bump the version in a separate step with `npm run bump-version` before packaging when you want a new version.

## Artifacts

For version `0.0.1`, the release output includes:

- `release/collection-tracker-0.0.1/` with the web/server build and Docker assets.
- `release/collection-tracker-0.0.1.zip`.
- `release/collection-tracker-0.0.1.apk` when Android signing is configured.
- `release/collection-tracker-0.0.1-unsigned.apk` when Gradle produces an unsigned Android APK.
- `.sha256` and `.md5` hash files for the zip files and APK.
- `android-update.json` and its `.sha256` and `.md5` files, identifying the Android channel, base version, full commit SHA, source commit timestamp, and APK version code.

Release packaging clears the existing `release/` folder before writing new artifacts.

## Version Bumps

Use `npm run bump-version` to update the app and Android versions before packaging:

```bash
npm run bump-version -- patch
npm run bump-version -- minor
npm run bump-version -- major
npm run release
```

Bump requires a clean git status and creates the version bump commit so build metadata points at the release commit. The commit message is `chore(release): bump version to X.Y.Z`. After artifacts are successfully created, `npm run release` creates the `vX.Y.Z` git tag when the worktree is clean and that tag does not already exist.

Use `--no-commit` to bump local version files without creating the release commit. This mode can run with a dirty worktree. `npm run release` then skips the git tag because the worktree is dirty:

```bash
npm run bump-version -- patch --no-commit
npm run release
```

## Android Signing

Release packaging runs `assembleRelease` and copies the APK from `android/app/build/outputs/apk/release/` directly under `release/`.

Release APK signing is optional and configured through environment variables. Set all of these before running `npm run release` to produce signed APK artifacts:

```powershell
$env:ANDROID_KEYSTORE_PATH = "C:\path\to\release.keystore"
$env:ANDROID_KEYSTORE_PASSWORD = "keystore-password"
$env:ANDROID_KEY_ALIAS = "key-alias"
$env:ANDROID_KEY_PASSWORD = "key-password"
```

Do not commit keystores or signing passwords. When these variables are omitted, Gradle may produce an unsigned release APK that must be signed before distribution.

## GitHub Actions

The existing CI → Docker GHCR → Release chain publishes the current default-branch commit to `/releases/tag/snapshot` after Android, Cypress (Chrome and Firefox), Format, i18n, Lint, Test, Typecheck, and both Docker GHCR image pushes are green. The snapshot is always a prerelease and never becomes stable Latest. Its notes identify the commit, UTC build time, and Actions run.

A default-branch commit tagged `vX.Y.Z` (matching `package.json`) additionally publishes a stable GitHub Release. Both channels are built on tagged commits. The app and metadata-provider GHCR images for that commit are also tagged `vX.Y.Z`. Existing published stable releases are left untouched on reruns.

```bash
npm run bump-version -- patch
git tag v0.0.2
git push origin main --tags
```

The Release workflow decodes `ANDROID_KEYSTORE_BASE64` and runs `npm run release` with `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. Both channels use the same signing key. It uploads the ZIP, signed APK, and checksum files; missing, unsigned, or checksum-invalid artifacts fail publication. `--no-commit` bumps are local only and do not create that GitHub Release.

Snapshots use `npm run release -- --snapshot`, which skips automatic version tagging. For package version `0.0.1` and commit `abcdef123456…`, artifacts are `collection-tracker-0.0.1-snapshot.abcdef123456.apk` and `.zip`, each with `.sha256` and `.md5` files. The About version uses the same snapshot identifier. Android keeps its base package version name and uses Unix time in two-second units for the version code, avoiding the previous hourly ordering ambiguity.

Packaging passes `CT_BUILD_CHANNEL`, `CT_BUILD_COMMIT`, `CT_COMMIT_TIME`, and `CT_BUILD_CODE` to Gradle and writes matching schema-1 `android-update.json`. The publisher validates its checksums and channel/SHA/tag before staging, uploads it alongside the existing assets, and includes the same JSON in a `collection-tracker-android` HTML comment in release notes. Android reads this metadata from the public GitHub release API for its opt-in launch-only checks; keep the comment intact when editing notes. Local Gradle builds use the current Git commit and Release channel. Source commit timestamps conservatively order snapshots; identical timestamps do not trigger an update.

The workflow can also be dispatched manually on the current default branch (snapshot, plus stable when tagged), or triggered by a version-tag push. A tag push before CI/Docker completion fails its gate; the later Docker completion retries both channels. Superseded commits never intentionally replace the current snapshot. Duplicate completions and reruns skip an already-published snapshot SHA. Docker run names carry the actual build SHA; the Release workflow uses that SHA rather than the nested event's workflow revision. Older Docker runs without this provenance are skipped.

## Staging And Recovery

Release runs are serialized without cancelling an active publisher. GitHub may replace an older pending run with a newer one. The publisher uploads all assets to a draft and verifies upload sizes before changing the public snapshot. It rechecks the default-branch tip immediately before replacement, archives the old release as a backup draft, moves the `snapshot` tag, and publishes the staged release. A branch advance after this final check is still possible; the next successful build replaces it.

On API failure, the publisher attempts to restore the previous tag and release with its original assets. Cleanup failures produce warnings; failed recovery preserves the backup and names it in the log. GitHub release/tag changes are not atomic, so a brief unavailable snapshot URL is possible during replacement. Hard runner termination cannot execute rollback.

If recovery needs attention, pause Release runs before making repairs. Inspect `snapshot-staging-<run>-<attempt>` and `snapshot-backup-<run>-<attempt>` draft releases and their recorded commit SHAs. Restore the `snapshot` tag to the desired commit and the corresponding complete release to tag `snapshot`, public prerelease, with **Set as latest release** disabled. Remove temporary releases/tags only after confirming the restored assets and checksums. Then resume or rerun Release for the current tip. An existing `snapshot` draft blocks automatic replacement so it can be recovered explicitly.

If `Cypress (firefox)` is listed in branch protection, keep it required. The Cypress workflow fails when Firefox E2E fails.
