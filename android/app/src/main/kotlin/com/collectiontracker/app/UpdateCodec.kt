package com.collectiontracker.app

import org.json.JSONObject

object UpdateCodec {
  fun build(json: JSONObject): UpdateBuild {
    require(json.getInt("schema") == 1)
    val channel = json.getString("channel")
    val version = json.getString("version")
    val commit = json.getString("commit")
    val time = json.getLong("commitTime")
    val code = json.getLong("versionCode")
    require(channel in listOf("release", "snapshot") && UpdatePolicy.version(version) != null)
    require(Regex("[a-f0-9]{40}").matches(commit) && time > 0 && code in 1..2100000000L)
    return UpdateBuild(channel, version, commit, time, code)
  }

  fun json(build: UpdateBuild): JSONObject = JSONObject().put("schema", 1)
    .put("channel", build.channel).put("version", build.version).put("commit", build.commit)
    .put("commitTime", build.commitTime).put("versionCode", build.versionCode)

  fun release(source: String, channel: String): UpdateBuild? {
    val release = JSONObject(source)
    if (release.getBoolean("draft")) return null
    val tag = release.getString("tag_name")
    if (channel == "release" && (release.getBoolean("prerelease") || !Regex("v[0-9]+\\.[0-9]+\\.[0-9]+").matches(tag))) return null
    if (channel == "snapshot" && (tag != "snapshot" || !release.getBoolean("prerelease"))) return null
    if (release.isNull("published_at")) return null
    val body = release.getString("body")
    val matches = Regex("<!-- collection-tracker-android:(\\{[^\\r\\n]*}) -->").findAll(body).toList()
    if (matches.size != 1) return null
    val build = build(JSONObject(matches.single().groupValues[1]))
    if (build.channel != channel || (channel == "release" && tag != "v${build.version}")) return null
    if (release.getString("html_url") != build.releaseUrl) return null
    return build
  }

  fun encode(state: UpdateState): String = JSONObject().put("enabled", state.enabled).put("channel", state.channel)
    .put("lastAttempt", state.lastAttempt).put("cached", state.cached?.let(::json))
    .put("skipped", JSONObject().apply { state.skipped.forEach { (channel, build) -> put(channel, json(build)) } }).toString()

  fun decode(source: String?, defaultChannel: String): UpdateState = try {
    val json = JSONObject(source ?: "{}")
    val channel = json.optString("channel", defaultChannel)
    require(channel in listOf("release", "snapshot"))
    val skipped = json.optJSONObject("skipped")
    UpdateState(json.optBoolean("enabled", false), channel, json.optLong("lastAttempt", 0),
      json.optJSONObject("cached")?.let(::build),
      listOf("release", "snapshot").mapNotNull { name -> skipped?.optJSONObject(name)?.let { name to build(it) } }.toMap())
  } catch (_: Exception) { UpdateState(channel = defaultChannel) }
}
