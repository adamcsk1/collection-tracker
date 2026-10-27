package com.collectiontracker.app

import java.net.HttpURLConnection
import java.net.URL
import java.io.ByteArrayOutputStream

object UpdateClient {
  private const val MAX_BYTES = 512 * 1024

  fun fetch(channel: String, open: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection }): UpdateBuild? {
    require(channel in listOf("release", "snapshot"))
    val endpoint = if (channel == "snapshot") "tags/snapshot" else "latest"
    val connection = open(URL("https://api.github.com/repos/adamcsk1/collection-tracker/releases/$endpoint"))
    val deadline = System.nanoTime() + 20_000_000_000L
    try {
      connection.connectTimeout = 10000
      connection.readTimeout = 10000
      connection.instanceFollowRedirects = false
      connection.setRequestProperty("Accept", "application/vnd.github+json")
      connection.setRequestProperty("X-GitHub-Api-Version", "2022-11-28")
      connection.setRequestProperty("User-Agent", "CollectionTracker-Android")
      if (connection.responseCode == 404) return null
      check(connection.responseCode == 200)
      check(connection.contentLengthLong <= MAX_BYTES)
      val bytes = connection.inputStream.use { input ->
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        while (true) {
          check(System.nanoTime() < deadline && !Thread.currentThread().isInterrupted)
          val count = input.read(buffer)
          if (count < 0) break
          check(output.size() + count <= MAX_BYTES)
          output.write(buffer, 0, count)
        }
        output.toByteArray()
      }
      return UpdateCodec.release(bytes.toString(Charsets.UTF_8), channel)
    } finally {
      connection.disconnect()
    }
  }
}
