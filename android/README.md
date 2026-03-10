# Collection Tracker Android Wrapper (WebView)

This is a minimal native Android host that:

- accepts a **Page URL** and **API URL** on first run,
- saves both values locally,
- loads the page in a `WebView`,
- injects runtime config into the loaded page as:
  - `window.COLLECTION_TRACKER_CONFIG = { pageUrl, apiUrl }`
  - `localStorage.CT.ApiUrl`
- shows a native **error screen** if the page fails to load or there is no internet.
- exposes a JS bridge:
  - `window.CollectionTracker.resetAppConfig()`
    - clears stored page/api config on the native side,
    - removes `localStorage.CT.ApiUrl`,
    - returns to the config screen.

## Open in Android Studio

1. Open Android Studio.
2. Open the `android` folder as a project.
3. Sync/build.

If Studio asks for SDK/Gradle updates, choose them and sync again.

