package com.collectiontracker.app

object DownloadFile {
  fun sanitizeFileName(fileName: String): String = fileName
    .replace(Regex("[\\\\/:*?\"<>|]"), "_")
    .ifBlank { "collection-tracker-download" }

  fun normalizeMimeType(mimeType: String): String = mimeType.ifBlank { "application/octet-stream" }
}
