# Android Wrapper

Source: [`android`](../android)

The Android project is a thin WebView wrapper around a deployed Collection Tracker instance.

## Behavior

- Prompts for the page URL and API URL on first run.
- Can optionally trust invalid HTTPS certificates for private self-hosted instances.
- Stores both values locally on the device.
- On Android 17 and newer, requests the Nearby devices permission (`ACCESS_LOCAL_NETWORK`) before loading an instance. This applies to all configured URLs because DNS names and separate API hosts can resolve to local-network addresses. WebView uses the app's permission; older Android versions do not prompt.
- If permission is denied, displays an explanation with Retry and App permissions buttons. If Android stops prompting, allow Nearby devices in the app's system permissions, return to the app, and tap Retry.
- Injects runtime config into the loaded page as `window.COLLECTION_TRACKER_CONFIG` and `localStorage.CT.ApiUrl`.
- Opens Android's document picker for web file inputs, including tag management import.
- Saves WebView downloads to Android Downloads, including tag management exports created from `blob:` URLs.
- Displays a native error screen when the page cannot be loaded or the device is offline.
- Checks instance content only for the current, non-failed navigation; failed loads and stale validation callbacks do not produce an invalid-instance message.
- Exposes `window.CollectionTracker.resetAppConfig()` so the web application can clear the stored configuration and return to setup.

## Open The Project

1. Open Android Studio.
2. Open the [`android`](../android) directory.
3. Sync the Gradle project and apply any required SDK updates.

## Test And Build

Run Android commands with Java 17 or newer from the [`android`](../android) directory:

```powershell
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

Release APK packaging and signing details are covered in [Release packaging](./release.md).

The rolling `snapshot` prerelease includes a signed APK built with the same key and application ID as stable releases. Snapshot filenames contain the package version and commit SHA; Android retains its package version name and existing hourly timestamp version code. Builds within the same UTC hour can share a version code. Installing an older build may require uninstalling the newer wrapper, which clears its saved configuration.
