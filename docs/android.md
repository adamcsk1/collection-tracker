# Android Wrapper

Source: [`android`](../android)

The Android project is a thin WebView wrapper around a deployed Collection Tracker instance.

## Behavior

- Prompts for the page URL and API URL on first run.
- Shows the native **App settings** bar only on the URL configuration screen. WebView and error screens have no settings bar or reserved space.
- Can optionally trust invalid HTTPS certificates for private self-hosted instances.
- Stores both values locally on the device.
- On Android 17 and newer, requests the Nearby devices permission (`ACCESS_LOCAL_NETWORK`) before loading an instance. This applies to all configured URLs because DNS names and separate API hosts can resolve to local-network addresses. WebView uses the app's permission; older Android versions do not prompt.
- If permission is denied, displays an explanation with Retry and App permissions buttons. If Android stops prompting, allow Nearby devices in the app's system permissions, return to the app, and tap Retry.
- Injects runtime config into the loaded page as `window.COLLECTION_TRACKER_CONFIG` and `localStorage.CT.ApiUrl`.
- Opens Android's document picker for web file inputs, including tag management import.
- Saves WebView downloads to Android Downloads, including tag management exports created from `blob:` URLs.
- Displays a native error screen when the page cannot be loaded or the device is offline.
- Checks instance content only for the current, non-failed navigation; failed loads and stale validation callbacks do not produce an invalid-instance message.
- Exposes `window.CollectionTrackerInterface.resetAppConfig()` so the web application can clear the stored configuration and return to setup, and `showSettings()` to open the native settings dialog on the UI thread.

## Open The Project

1. Open Android Studio.
2. Open the [`android`](../android) directory.
3. Sync the Gradle project and apply any required SDK updates.

## Test And Build

Run Android commands with Java 17 or newer from the [`android`](../android) directory:

```powershell
./gradlew testDebugUnitTest
./gradlew lintDebug
./gradlew assembleDebug
```

Release APK packaging and signing details are covered in [Release packaging](./release.md).

JVM tests cover update policy, persistence, HTTP failures and limits, and native settings/dialog wiring through Robolectric (API 35). Device testing is still useful for browser handoff and platform lifecycle behavior.

The rolling `snapshot` prerelease includes a signed APK built with the same key and application ID as stable releases. Snapshot filenames contain the package version and commit SHA. APK version codes use Unix time in two-second units, replacing the old hourly timestamp codes; release packaging shares the exact code and source identity with the update metadata. Installing an older build may require uninstalling the newer wrapper, which clears its saved configuration.

## Optional Update Checks

In **App settings**, enable **Check for app updates on launch** and choose **Release** or **Snapshot**. Checks are off by default. The initial channel matches the installed APK; local builds default to Release. Preferences are independent of instance configuration.

Automatic checks contact the public `adamcsk1/collection-tracker` GitHub repository at app launch, at most once per 24 hours, including failed attempts. Enabling checks or changing the selected channel while enabled checks immediately. **Check updates** checks the selected channel manually, even when automatic checks are disabled or the daily interval has not elapsed. It reports progress, no newer update, or failure and can show previously skipped or dismissed updates without enabling automatic checks. There is no background scheduler, notification, or notification permission. Network work runs off the UI thread with timeouts and a bounded response; failures do not block opening your instance. A cached eligible release can appear on a later launch without another request.

The dialog offers **Open release** (the trusted GitHub release page in an external browser), **Cancel** (dismiss for this launch), and **Skip this release** (remember the exact build per channel until a newer build appears). Disabling automatic checks prevents automatic requests and dialogs. Changing channels rejects results from previous requests.

Release checks exclude drafts and prereleases and compare numeric versions. Snapshot checks compare embedded commit identity and source commit time, not the rolling tag. Both reject older package versions, source timestamps, APK version codes, and the installed commit. Older releases without the new metadata are ignored. Equal source timestamps are conservatively not considered newer snapshots.
