package com.collectiontracker.app

import android.app.Activity
import android.content.ContentValues
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.DownloadListener
import android.webkit.URLUtil
import android.webkit.WebView
import android.widget.Toast
import org.json.JSONObject

class AndroidDownloadHandler(
  private val activity: Activity,
  private val webView: WebView,
) {
  fun createDownloadListener(): DownloadListener = DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
    val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
    saveWebViewDownload(url, fileName, mimeType)
  }

  fun saveDownloadFromBridge(fileName: String, mimeType: String, base64Content: String): Boolean {
    if (base64Content.isBlank()) {
      showDownloadFailed()
      return false
    }

    return runCatching {
      val bytes = Base64.decode(base64Content, Base64.DEFAULT)
      saveToDownloads(fileName, mimeType, bytes)
      activity.runOnUiThread {
        Toast.makeText(activity, activity.getString(R.string.download_saved), Toast.LENGTH_LONG).show()
      }
      true
    }.getOrElse {
      showDownloadFailed()
      false
    }
  }

  fun showDownloadFailed() {
    activity.runOnUiThread {
      Toast.makeText(activity, activity.getString(R.string.download_failed), Toast.LENGTH_LONG).show()
    }
  }

  private fun saveWebViewDownload(url: String, fileName: String, mimeType: String?) {
    activity.runOnUiThread {
      Toast.makeText(activity, activity.getString(R.string.download_started), Toast.LENGTH_SHORT).show()
    }

    val script = """
      (function() {
        fetch(${JSONObject.quote(url)}, { credentials: 'include' })
          .then(function(response) { return response.blob(); })
          .then(function(blob) {
            var reader = new FileReader();
            reader.onloadend = function() {
              var result = String(reader.result || '');
              var base64Content = result.indexOf(',') === -1 ? result : result.substring(result.indexOf(',') + 1);
              window.CollectionTrackerInterface.saveDownload(
                ${JSONObject.quote(fileName)},
                ${JSONObject.quote(mimeType ?: "application/octet-stream")},
                base64Content
              );
            };
            reader.readAsDataURL(blob);
          })
          .catch(function() {
            window.CollectionTrackerInterface.showDownloadFailed();
          });
      })();
    """.trimIndent()

    webView.evaluateJavascript(script, null)
  }

  private fun saveToDownloads(fileName: String, mimeType: String, bytes: ByteArray) {
    val safeFileName = fileName.replace(Regex("[\\\\/:*?\"<>|]"), "_").ifBlank { "collection-tracker-download" }
    val values = ContentValues().apply {
      put(MediaStore.Downloads.DISPLAY_NAME, safeFileName)
      put(MediaStore.Downloads.MIME_TYPE, mimeType.ifBlank { "application/octet-stream" })
      put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
      put(MediaStore.Downloads.IS_PENDING, 1)
    }

    val resolver = activity.contentResolver
    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
      ?: throw IllegalStateException("Could not create download file")

    try {
      resolver.openOutputStream(uri)?.use { outputStream -> outputStream.write(bytes) }
        ?: throw IllegalStateException("Could not open download file")
      values.clear()
      values.put(MediaStore.Downloads.IS_PENDING, 0)
      resolver.update(uri, values, null, null)
    } catch (error: Throwable) {
      resolver.delete(uri, null, null)
      throw error
    }
  }
}
