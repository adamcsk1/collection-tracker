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
}
