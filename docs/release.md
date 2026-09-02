# Release

`npm run release` builds the web apps, server, and Android wrapper, then writes versioned artifacts under `release/`. Bump the version in a separate step with `npm run bump-version` before packaging when you want a new version.

## Artifacts

For version `0.0.1`, the release output includes:

- `release/collection-tracker-0.0.1/` with the web/server build and Docker assets.
- `release/collection-tracker-0.0.1.zip`.
- `release/collection-tracker-0.0.1.apk` when Android signing is configured.
- `release/collection-tracker-0.0.1-unsigned.apk` when Gradle produces an unsigned Android APK.
- `.sha256` and `.md5` hash files for the zip files and APK.

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
