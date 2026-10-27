package com.collectiontracker.app

object UpdatePolicy {
  const val INTERVAL = 24 * 60 * 60 * 1000L

  fun version(value: String): List<Long>? {
    if (!Regex("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)").matches(value)) return null
    return value.split('.').map { it.toLongOrNull() ?: return null }
  }

  fun newer(candidate: UpdateBuild, installed: UpdateBuild): Boolean {
    val available = version(candidate.version) ?: return false
    val current = version(installed.version) ?: return false
    val comparison = available.zip(current).firstOrNull { it.first != it.second }
      ?.let { it.first.compareTo(it.second) } ?: 0
    if (comparison < 0 || candidate.commit == installed.commit || candidate.versionCode < installed.versionCode) return false
    if (candidate.commitTime < installed.commitTime) return false
    if (candidate.channel == "snapshot") return candidate.commitTime > installed.commitTime
    if (installed.channel != "snapshot") return comparison > 0
    return comparison > 0 || (comparison == 0 && candidate.commitTime > installed.commitTime)
  }

  fun due(last: Long, now: Long): Boolean = last <= 0 || now < last || now - last >= INTERVAL
}

// All state transitions run on the UI thread; a request token rejects obsolete network results.
class UpdateSession(
  val installed: UpdateBuild,
  initial: UpdateState,
  private val save: (UpdateState) -> Unit,
) {
  var state = initial
    private set
  private var generation = 0L
  var dismissed = false
  private var manualResult = false

  fun configure(enabled: Boolean, channel: String): Boolean {
    require(channel in listOf("release", "snapshot"))
    if (state.enabled == enabled && state.channel == channel) return false
    generation++
    manualResult = false
    dismissed = false
    state = state.copy(enabled = enabled, channel = channel, cached = if (state.channel == channel) state.cached else null)
    save(state)
    return true
  }

  fun begin(now: Long, force: Boolean = false, manual: Boolean = false): UpdateRequest? {
    if (!manual && (!state.enabled || (!force && !UpdatePolicy.due(state.lastAttempt, now)))) return null
    if (manual) {
      dismissed = true
      manualResult = false
    }
    state = state.copy(lastAttempt = now)
    save(state)
    return UpdateRequest(++generation, state.channel, manual)
  }

  fun accepts(request: UpdateRequest): Boolean =
    (state.enabled || request.manual) && request.generation == generation && request.channel == state.channel

  fun complete(request: UpdateRequest, candidate: UpdateBuild?) {
    if (!accepts(request)) return
    manualResult = request.manual
    if (request.manual) dismissed = false
    state = state.copy(cached = candidate?.takeIf { it.channel == state.channel && UpdatePolicy.newer(it, installed) })
    save(state)
  }

  fun available(): UpdateBuild? = state.cached?.takeIf {
    (state.enabled || manualResult) && !dismissed && it.channel == state.channel && UpdatePolicy.newer(it, installed) &&
      (manualResult || state.skipped[it.channel]?.let { skipped -> it.identity != skipped.identity && UpdatePolicy.newer(it, skipped) } != false)
  }

  fun skip(build: UpdateBuild) {
    state = state.copy(skipped = state.skipped + (build.channel to build))
    save(state)
    dismissed = true
  }
}
