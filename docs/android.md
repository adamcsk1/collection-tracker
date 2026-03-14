# Android Wrapper

Source: [`android`](../android)

The Android project is a thin WebView wrapper around a deployed Collection Tracker instance.

## Behavior

- Prompts for the page URL and API URL on first run.
- Stores both values locally on the device.
- Injects runtime config into the loaded page as `window.COLLECTION_TRACKER_CONFIG` and `localStorage.CT.ApiUrl`.
- Displays a native error screen when the page cannot be loaded or the device is offline.
- Exposes `window.CollectionTracker.resetAppConfig()` so the web application can clear the stored configuration and return to setup.

## Open The Project

1. Open Android Studio.
2. Open the [`android`](../android) directory.
3. Sync the Gradle project and apply any required SDK updates.
