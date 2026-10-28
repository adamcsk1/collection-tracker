package com.collectiontracker.app

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class UpdateCodecInstrumentedTest {
  @Test fun parsesReleaseMetadataUsingAndroidRegex() {
    for (channel in listOf("release", "snapshot")) {
      val build = UpdateBuild(channel, "1.2.3", "b".repeat(40), 1790000000, 895000000)
      val metadata = """{"schema":1,"channel":"$channel","version":"1.2.3","commit":"${build.commit}","commitTime":1790000000,"versionCode":895000000}"""
      val response = JSONObject()
        .put("draft", false).put("prerelease", channel == "snapshot")
        .put("tag_name", if (channel == "snapshot") "snapshot" else "v1.2.3")
        .put("published_at", "2026-10-27T12:00:00Z").put("html_url", build.releaseUrl)
        .put("body", "## Changes\r\n- Android updates\r\n\r\n<!-- collection-tracker-android:$metadata -->\r\n\r\n## Downloads")

      assertEquals(build, UpdateCodec.release(response.toString(), channel))
    }
  }
}
