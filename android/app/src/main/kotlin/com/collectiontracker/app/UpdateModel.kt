package com.collectiontracker.app

data class UpdateBuild(
  val channel: String,
  val version: String,
  val commit: String,
  val commitTime: Long,
  val versionCode: Long,
) {
  val identity: String get() = "$version:$commit"
  val releaseUrl: String get() = "https://github.com/adamcsk1/collection-tracker/releases/tag/" +
    if (channel == "snapshot") "snapshot" else "v$version"
}

data class UpdateState(
  val enabled: Boolean = false,
  val channel: String = "release",
  val lastAttempt: Long = 0,
  val cached: UpdateBuild? = null,
  val skipped: Map<String, UpdateBuild> = emptyMap(),
)

data class UpdateRequest(val generation: Long, val channel: String, val manual: Boolean = false)
