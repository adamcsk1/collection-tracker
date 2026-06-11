package com.collectiontracker.app

import kotlin.test.Test
import kotlin.test.assertEquals

class DownloadFileTest {
  @Test
  fun sanitizeFileNamePreservesValidName() {
    assertEquals("tags-export.json", DownloadFile.sanitizeFileName("tags-export.json"))
  }

  @Test
  fun sanitizeFileNameReplacesInvalidCharacters() {
    assertEquals("collection_tracker_export_.json", DownloadFile.sanitizeFileName("collection/tracker:export?.json"))
  }

  @Test
  fun sanitizeFileNameUsesFallbackForBlankName() {
    assertEquals("collection-tracker-download", DownloadFile.sanitizeFileName(""))
  }

  @Test
  fun normalizeMimeTypePreservesProvidedMimeType() {
    assertEquals("application/json", DownloadFile.normalizeMimeType("application/json"))
  }

  @Test
  fun normalizeMimeTypeUsesFallbackForBlankMimeType() {
    assertEquals("application/octet-stream", DownloadFile.normalizeMimeType(""))
  }
}
