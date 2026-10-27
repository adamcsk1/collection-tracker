package com.collectiontracker.app

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class WebViewNavigationTest {
  private val pageUrl = "https://collection.example/client/"

  @Test
  fun verifiesOnlyCurrentNavigation() {
    val navigation = WebViewNavigation()
    assertFalse(navigation.canVerify(pageUrl))
    navigation.start(pageUrl)
    assertTrue(navigation.canVerify(pageUrl))
    assertFalse(navigation.canVerify("https://collection.example/login/"))
  }

  @Test
  fun failedLoadPreventsFinishedPageAndPendingVerification() {
    val navigation = WebViewNavigation()
    navigation.start(pageUrl)
    val generation = navigation.generation
    navigation.invalidate()
    assertFalse(navigation.canVerify(pageUrl))
    assertFalse(navigation.canVerify(pageUrl, generation))
  }

  @Test
  fun retryAcceptsNewResultButRejectsStaleResultForSameUrl() {
    val navigation = WebViewNavigation()
    navigation.start(pageUrl)
    val generation = navigation.generation
    navigation.invalidate()
    navigation.start(pageUrl)
    assertTrue(navigation.canVerify(pageUrl))
    assertFalse(navigation.canVerify(pageUrl, generation))
  }

  @Test
  fun redirectDiscardsPendingVerification() {
    val navigation = WebViewNavigation()
    navigation.start(pageUrl)
    val generation = navigation.generation
    val redirectedUrl = "https://collection.example/login/"
    navigation.start(redirectedUrl)
    assertFalse(navigation.canVerify(pageUrl, generation))
    assertTrue(navigation.canVerify(redirectedUrl))
  }

  @Test
  fun blankPagesAreNeverVerified() {
    val navigation = WebViewNavigation()
    for (url in listOf(null, "", "about:blank")) {
      navigation.start(url)
      assertFalse(navigation.canVerify(url))
    }
  }
}
