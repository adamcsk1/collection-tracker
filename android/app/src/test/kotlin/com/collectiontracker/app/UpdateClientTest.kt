package com.collectiontracker.app

import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import kotlin.test.*

class UpdateClientTest {
  private class Connection(val status: Int = 200, val body: String = "{}", val length: Long = -1) :
    HttpURLConnection(URL("https://api.github.com")) {
    var disconnected = false
    var timeout = false
    override fun connect() = Unit
    override fun disconnect() { disconnected = true }
    override fun usingProxy() = false
    override fun getResponseCode(): Int {
      if (timeout) throw SocketTimeoutException()
      return status
    }
    override fun getContentLengthLong() = length
    override fun getInputStream() = ByteArrayInputStream(body.toByteArray())
  }

  @Test fun usesOnlyFixedGithubEndpointsAndTimeoutsWithoutRedirects() {
    for ((channel, endpoint) in listOf("release" to "latest", "snapshot" to "tags/snapshot")) {
      val connection = Connection(status = 404)
      assertNull(UpdateClient.fetch(channel) { url ->
        assertEquals("https://api.github.com/repos/adamcsk1/collection-tracker/releases/$endpoint", url.toString())
        connection
      })
      assertEquals(10000, connection.connectTimeout)
      assertEquals(10000, connection.readTimeout)
      assertFalse(connection.instanceFollowRedirects)
      assertTrue(connection.disconnected)
    }
  }

  @Test fun rejectsOversizedMalformedRateLimitedRedirectAndTimeoutResponsesAndAlwaysDisconnects() {
    for (connection in listOf(Connection(length = 524289), Connection(body = " ".repeat(524289)),
      Connection(body = "malformed"), Connection(status = 429), Connection(status = 302),
      Connection().apply { timeout = true })) {
      assertFails { UpdateClient.fetch("snapshot") { connection } }
      assertTrue(connection.disconnected)
    }
  }

  @Test fun parsesSuccessfulPublishedReleaseAndSnapshotResponses() {
    for ((channel, tag) in listOf("release" to "v1.2.3", "snapshot" to "snapshot")) {
      val body = """
        {
          "id": 123456789,
          "tag_name": "$tag",
          "name": "Collection Tracker — $tag",
          "draft": false,
          "prerelease": ${channel == "snapshot"},
          "published_at": "2026-10-27T12:00:00Z",
          "html_url": "https://github.com/adamcsk1/collection-tracker/releases/tag/$tag",
          "body": "## Changes\r\n- Android updates\r\n\r\n<!-- collection-tracker-android:{\"schema\":1,\"channel\":\"$channel\",\"version\":\"1.2.3\",\"commit\":\"${"b".repeat(40)}\",\"commitTime\":1790000000,\"versionCode\":895000000} -->\r\n\r\n## Downloads",
          "assets": [{"name": "collection-tracker.apk", "size": 123456}]
        }
      """.trimIndent()
      for (length in listOf(-1L, body.toByteArray(Charsets.UTF_8).size.toLong())) {
        val connection = Connection(body = body, length = length)
        assertEquals(UpdateBuild(channel, "1.2.3", "b".repeat(40), 1790000000, 895000000),
          UpdateClient.fetch(channel) { connection })
        assertTrue(connection.disconnected)
      }
    }
  }
}
