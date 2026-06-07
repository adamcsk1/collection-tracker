package com.collectiontracker.app

import android.app.Activity
import android.webkit.JavascriptInterface

class CollectionTrackerBridge(
  private val activity: Activity,
  private val resetAppConfig: () -> Unit,
  private val downloadHandler: AndroidDownloadHandler,
) {
  @Suppress("unused")
  @JavascriptInterface
  fun resetAppConfig(): Boolean {
    activity.runOnUiThread { resetAppConfig.invoke() }
    return true
  }

  @Suppress("unused")
  @JavascriptInterface
  fun saveDownload(fileName: String, mimeType: String, base64Content: String): Boolean =
    downloadHandler.saveDownloadFromBridge(fileName, mimeType, base64Content)

  @Suppress("unused")
  @JavascriptInterface
  fun showDownloadFailed() {
    downloadHandler.showDownloadFailed()
  }
}
