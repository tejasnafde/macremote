package io.github.tejasnafde.macremote.media

class PlaybackTransition internal constructor(
    val from: Boolean,
    val to: Boolean,
    internal val startedAtMs: Long,
)

class AbsolutePlaybackGate {
    var current: Boolean? = null
        private set

    private var pending: PlaybackTransition? = null
    private var confirmed: Boolean? = null

    @Synchronized
    fun observe(playing: Boolean, nowMs: Long = System.currentTimeMillis()) {
        confirmed = playing
        val transition = pending
        if (transition != null && playing != transition.to && nowMs - transition.startedAtMs < PENDING_TIMEOUT_MS) return
        current = playing
        if (transition == null || playing == transition.to || nowMs - transition.startedAtMs >= PENDING_TIMEOUT_MS) {
            pending = null
        }
    }

    @Synchronized
    fun begin(desired: Boolean, nowMs: Long = System.currentTimeMillis()): PlaybackTransition? {
        val previous = current ?: return null
        if (previous == desired) return null
        current = desired
        return PlaybackTransition(previous, desired, nowMs).also { pending = it }
    }

    @Synchronized
    fun failed(transition: PlaybackTransition) {
        if (pending === transition && current == transition.to) {
            current = confirmed ?: transition.from
            pending = null
        }
    }

    private companion object { const val PENDING_TIMEOUT_MS = 5_000L }
}
