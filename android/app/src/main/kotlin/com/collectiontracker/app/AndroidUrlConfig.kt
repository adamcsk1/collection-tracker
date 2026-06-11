package com.collectiontracker.app

import java.net.URI

object AndroidUrlConfig {
  fun normalizeInput(input: String): String {
    var cleaned = input.trim()
    if (cleaned.isBlank()) return cleaned
    if (!cleaned.startsWith("http://", ignoreCase = true) && !cleaned.startsWith("https://", ignoreCase = true)) {
      cleaned = "https://$cleaned"
    }
    return cleaned
  }

  fun deriveApiUrlFromPage(inputPageUrl: String): String {
    val trimmed = normalizeInput(inputPageUrl).trimEnd('/')
    if (trimmed.isBlank()) return ""
    return if (trimmed.endsWith("/api/v1")) trimmed else "$trimmed/api/v1"
  }

  fun isLikelyCollectionTrackerPage(configuredPageUrl: String, loadedUrl: String?): Boolean {
    if (loadedUrl.isNullOrBlank() || configuredPageUrl.isBlank()) return false

    val configured = runCatching { URI.create(configuredPageUrl) }.getOrElse { return false }
    val loaded = runCatching { URI.create(loadedUrl) }.getOrElse { return false }

    if (!configured.scheme.isNullOrBlank() && loaded.scheme?.lowercase() != configured.scheme.lowercase()) {
      return false
    }

    if (!configured.host.isNullOrBlank() && loaded.host?.lowercase() != configured.host.lowercase()) {
      return false
    }

    val configuredPort = effectivePort(configured)
    val loadedPort = effectivePort(loaded)
    if (configuredPort != -1 && loadedPort != -1 && configuredPort != loadedPort) {
      return false
    }

    return true
  }

  private fun effectivePort(uri: URI): Int {
    if (uri.port != -1) return uri.port
    return when (uri.scheme?.lowercase()) {
      "http" -> 80
      "https" -> 443
      else -> -1
    }
  }
}
