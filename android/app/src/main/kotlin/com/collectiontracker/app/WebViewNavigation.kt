package com.collectiontracker.app

class WebViewNavigation {
  var generation: Long = 0
    private set
  private var currentUrl: String? = null

  fun start(url: String?) {
    generation++
    currentUrl = url
  }

  fun invalidate() {
    generation++
    currentUrl = null
  }

  fun canVerify(url: String?, expectedGeneration: Long = generation): Boolean {
    return !url.isNullOrBlank() && url != "about:blank" && url == currentUrl && expectedGeneration == generation
  }
}
