package com.collectiontracker.app

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AndroidUrlConfigTest {
  @Test
  fun normalizeInputTrimsWhitespace() {
    assertEquals("https://collection.example", AndroidUrlConfig.normalizeInput("  collection.example  "))
  }

  @Test
  fun normalizeInputPreservesHttpUrl() {
    assertEquals("http://collection.example", AndroidUrlConfig.normalizeInput("http://collection.example"))
  }

  @Test
  fun normalizeInputPreservesHttpsUrl() {
    assertEquals("https://collection.example", AndroidUrlConfig.normalizeInput("https://collection.example"))
  }

  @Test
  fun normalizeInputPreservesUppercaseHttpsUrl() {
    assertEquals("HTTPS://collection.example", AndroidUrlConfig.normalizeInput("HTTPS://collection.example"))
  }

  @Test
  fun normalizeInputReturnsBlankInput() {
    assertEquals("", AndroidUrlConfig.normalizeInput("   "))
  }

  @Test
  fun deriveApiUrlFromPageAppendsApiPath() {
    assertEquals("https://collection.example/api/v1", AndroidUrlConfig.deriveApiUrlFromPage("collection.example"))
  }

  @Test
  fun deriveApiUrlFromPageAvoidsDuplicateApiPath() {
    assertEquals("https://collection.example/api/v1", AndroidUrlConfig.deriveApiUrlFromPage("https://collection.example/api/v1"))
  }

  @Test
  fun deriveApiUrlFromPageTrimsTrailingSlash() {
    assertEquals("https://collection.example/api/v1", AndroidUrlConfig.deriveApiUrlFromPage("https://collection.example/"))
  }

  @Test
  fun deriveApiUrlFromPageReturnsBlankInput() {
    assertEquals("", AndroidUrlConfig.deriveApiUrlFromPage("   "))
  }

  @Test
  fun isLikelyCollectionTrackerPageAcceptsSameOrigin() {
    assertTrue(
      AndroidUrlConfig.isLikelyCollectionTrackerPage(
        configuredPageUrl = "https://collection.example:8443/client",
        loadedUrl = "https://collection.example:8443/client/dashboard",
      ),
    )
  }

  @Test
  fun isLikelyCollectionTrackerPageAcceptsMixedCaseSchemeAndHost() {
    assertTrue(
      AndroidUrlConfig.isLikelyCollectionTrackerPage(
        configuredPageUrl = "HTTPS://Collection.Example/client",
        loadedUrl = "https://collection.example/client/dashboard",
      ),
    )
  }

  @Test
  fun isLikelyCollectionTrackerPageRejectsDifferentScheme() {
    assertFalse(
      AndroidUrlConfig.isLikelyCollectionTrackerPage(
        configuredPageUrl = "https://collection.example",
        loadedUrl = "http://collection.example",
      ),
    )
  }

  @Test
  fun isLikelyCollectionTrackerPageRejectsDifferentHost() {
    assertFalse(
      AndroidUrlConfig.isLikelyCollectionTrackerPage(
        configuredPageUrl = "https://collection.example",
        loadedUrl = "https://other.example",
      ),
    )
  }

  @Test
  fun isLikelyCollectionTrackerPageRejectsDifferentExplicitPort() {
    assertFalse(
      AndroidUrlConfig.isLikelyCollectionTrackerPage(
        configuredPageUrl = "https://collection.example:8443",
        loadedUrl = "https://collection.example:9443",
      ),
    )
  }

  @Test
  fun isLikelyCollectionTrackerPageRejectsMissingLoadedPortWhenConfiguredHasExplicitPort() {
    assertFalse(
      AndroidUrlConfig.isLikelyCollectionTrackerPage(
        configuredPageUrl = "https://collection.example:8443",
        loadedUrl = "https://collection.example/client",
      ),
    )
  }

  @Test
  fun isLikelyCollectionTrackerPageRejectsLoadedExplicitPortWhenConfiguredHasDefaultPort() {
    assertFalse(
      AndroidUrlConfig.isLikelyCollectionTrackerPage(
        configuredPageUrl = "https://collection.example",
        loadedUrl = "https://collection.example:9443/client",
      ),
    )
  }

  @Test
  fun isLikelyCollectionTrackerPageAllowsLoadedExplicitDefaultPortWhenConfiguredHasDefaultPort() {
    assertTrue(
      AndroidUrlConfig.isLikelyCollectionTrackerPage(
        configuredPageUrl = "https://collection.example",
        loadedUrl = "https://collection.example:443/client",
      ),
    )
  }

  @Test
  fun isLikelyCollectionTrackerPageAllowsLoadedUrlWithoutExplicitPortWhenConfiguredHasNone() {
    assertTrue(
      AndroidUrlConfig.isLikelyCollectionTrackerPage(
        configuredPageUrl = "https://collection.example",
        loadedUrl = "https://collection.example/client",
      ),
    )
  }

  @Test
  fun isLikelyCollectionTrackerPageRejectsMalformedUrl() {
    assertFalse(
      AndroidUrlConfig.isLikelyCollectionTrackerPage(
        configuredPageUrl = "https://collection.example",
        loadedUrl = "https://exa mple.test",
      ),
    )
  }
}
