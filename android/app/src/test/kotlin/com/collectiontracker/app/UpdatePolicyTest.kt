package com.collectiontracker.app

import kotlin.test.*

class UpdatePolicyTest {
  private val installed = UpdateBuild("release", "1.2.3", "a".repeat(40), 100, 100)
  private val next = installed.copy(version = "1.2.4", commit = "b".repeat(40), commitTime = 200, versionCode = 200)

  @Test fun manualChecksBypassOptOutThrottleAndSkipWithoutChangingPreferences() {
    val session = UpdateSession(installed, UpdateState(false, "release", 1000, skipped = mapOf("release" to next))) {}
    session.dismissed = true
    val request = session.begin(1001, manual = true)!!
    session.complete(request, next)
    assertEquals(next, session.available())
    assertFalse(session.state.enabled)
    assertEquals(next, session.state.skipped["release"])
    assertNull(UpdateSession(installed, session.state) {}.available())
    assertNull(session.begin(1002))
  }

  @Test fun manualResultsRejectChangedChannelsAndFailedChecksDoNotRedisplayCache() {
    val session = UpdateSession(installed, UpdateState(true, cached = next)) {}
    val stale = session.begin(1000, manual = true)!!
    assertNull(session.available())
    session.configure(true, "snapshot")
    assertFalse(session.accepts(stale))
    session.complete(stale, next)
    assertNull(session.available())
    val request = session.begin(1001, manual = true)!!
    session.complete(request, next.copy(channel = "snapshot"))
    assertEquals("snapshot", session.available()?.channel)
  }

  @Test fun comparesSemanticVersionsAndSourceIdentityWithoutDowngrades() {
    assertTrue(UpdatePolicy.newer(next, installed))
    assertTrue(UpdatePolicy.newer(next.copy(version = "1.10.0"), installed))
    for (candidate in listOf(next.copy(version = "1.2.2"), next.copy(commit = installed.commit),
      next.copy(commitTime = 99), next.copy(versionCode = 99), next.copy(version = "1.2.3"),
      next.copy(version = "v1.2.4"), next.copy(version = "999999999999999999999.0.0"))) {
      assertFalse(UpdatePolicy.newer(candidate, installed), candidate.toString())
    }
    assertTrue(UpdatePolicy.newer(next.copy(channel = "snapshot", version = "1.2.3"), installed))
    assertFalse(UpdatePolicy.newer(next.copy(channel = "snapshot", commitTime = 100), installed))
  }

  @Test fun allowsReleaseChannelToCatchUpWithSnapshotVersion() {
    val installedSnapshot = installed.copy(channel = "snapshot", version = "1.2.4")
    assertTrue(UpdatePolicy.newer(next, installedSnapshot))
    assertFalse(UpdatePolicy.newer(next.copy(commitTime = 100), installedSnapshot))
    assertFalse(UpdatePolicy.newer(installed.copy(version = "1.2.4"), next.copy(channel = "release")))
  }

  @Test fun defaultsOffAndThrottlesAttemptsIncludingFailuresAndClockRollback() {
    val session = UpdateSession(installed, UpdateState()) {}
    assertNull(session.begin(1000, true))
    assertNull(session.available())
    session.configure(true, "release")
    assertNotNull(session.begin(1000))
    assertNull(session.begin(1000 + UpdatePolicy.INTERVAL - 1))
    assertNotNull(session.begin(1000 + UpdatePolicy.INTERVAL))
    assertNotNull(session.begin(999))
    assertNotNull(session.begin(999, true))
  }

  @Test fun cachesDismissesAndSkipsExactBuildUntilNewerAcrossLaunches() {
    var saved = UpdateState(enabled = true)
    val session = UpdateSession(installed, saved) { saved = it }
    session.complete(session.begin(1000)!!, next)
    assertEquals(next, session.available())
    session.dismissed = true
    assertNull(session.available())
    val relaunched = UpdateSession(installed, saved) { saved = it }
    assertNull(relaunched.begin(1001))
    assertEquals(next, relaunched.available())
    relaunched.skip(next)
    assertNull(UpdateSession(installed, saved) {}.available())
    val rolledBack = UpdateSession(installed, saved) {}
    rolledBack.complete(rolledBack.begin(1500, true)!!,
      next.copy(commit = "c".repeat(40), commitTime = 150, versionCode = 150))
    assertNull(rolledBack.available())
    val newer = next.copy(version = "1.2.5", commit = "c".repeat(40), commitTime = 300, versionCode = 300)
    val later = UpdateSession(installed, saved) {}
    later.complete(later.begin(2000, true)!!, newer)
    assertEquals(newer, later.available())
    assertNull(UpdateSession(newer, saved) {}.available())
  }

  @Test fun rejectsInFlightResultsAfterDisableChannelChangeAndNewerRequest() {
    val session = UpdateSession(installed, UpdateState(enabled = true)) {}
    val first = session.begin(1000)!!
    session.configure(false, "release")
    session.complete(first, next)
    assertNull(session.state.cached)
    session.configure(true, "release")
    val second = session.begin(1001, true)!!
    session.configure(true, "snapshot")
    session.configure(true, "release")
    session.complete(second, next)
    assertNull(session.available())
    val third = session.begin(1002, true)!!
    val fourth = session.begin(1003, true)!!
    session.complete(third, next)
    assertNull(session.available())
    session.complete(fourth, next)
    assertEquals(next, session.available())
    // A failed fetch never calls complete; its cached result and attempt throttle survive.
    assertNotNull(session.begin(1004, true))
    assertEquals(next, session.available())
    assertNull(session.begin(1005))
    session.complete(session.begin(1004, true)!!, null)
    assertNull(session.available())
  }
}
