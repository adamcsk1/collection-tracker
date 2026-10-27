package com.collectiontracker.app

import org.json.JSONObject
import kotlin.test.*

class UpdateCodecTest {
  private val build = UpdateBuild("snapshot", "1.2.3", "b".repeat(40), 1790000000, 895000000)
  private fun release(candidate: UpdateBuild = build) = JSONObject()
    .put("draft", false).put("prerelease", candidate.channel == "snapshot")
    .put("tag_name", if (candidate.channel == "snapshot") "snapshot" else "v${candidate.version}")
    .put("published_at", "2026-10-27T12:00:00Z").put("html_url", candidate.releaseUrl)
    .put("body", "Notes\n<!-- collection-tracker-android:${UpdateCodec.json(candidate)} -->")

  @Test fun parsesExactPublishedBuildNotRollingTag() {
    assertEquals(build, UpdateCodec.release(release().toString(), "snapshot"))
    val stable = build.copy(channel = "release")
    assertEquals(stable, UpdateCodec.release(release(stable).toString(), "release"))
    assertNull(UpdateCodec.release(release().toString(), "release"))
  }

  @Test fun rejectsDraftsWrongUrlsMissingMetadataAndChannelMismatch() {
    for ((key, value) in listOf("draft" to true, "prerelease" to false, "tag_name" to "snapshot-backup-1",
      "html_url" to "https://evil.example/releases/tag/snapshot", "body" to "old release")) {
      assertNull(UpdateCodec.release(release().put(key, value).toString(), "snapshot"))
    }
    assertNull(UpdateCodec.release(release().put("published_at", JSONObject.NULL).toString(), "snapshot"))
    assertFails { UpdateCodec.release("broken", "snapshot") }
    assertFails { UpdateCodec.build(UpdateCodec.json(build).put("commit", "main")) }
    assertFails { UpdateCodec.build(UpdateCodec.json(build).put("versionCode", -1)) }
  }

  @Test fun persistsSettingsCacheAndPerChannelSkipWithSafeDefaults() {
    val state = UpdateState(true, "snapshot", 1000, build, mapOf("snapshot" to build))
    assertEquals(state, UpdateCodec.decode(UpdateCodec.encode(state), "release"))
    assertEquals(UpdateState(channel = "snapshot"), UpdateCodec.decode(null, "snapshot"))
    assertEquals(UpdateState(), UpdateCodec.decode("corrupt", "release"))
    assertEquals(UpdateState(), UpdateCodec.decode("{\"channel\":\"unknown\"}", "release"))
  }
}
