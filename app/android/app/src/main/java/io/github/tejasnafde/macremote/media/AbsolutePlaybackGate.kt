package io.github.tejasnafde.macremote.media

class PlaybackTransition internal constructor(
    val from: Boolean,
    val to: Boolean,
)

class AbsolutePlaybackGate {
    var current: Boolean? = null
        private set

    @Synchronized
    fun observe(playing: Boolean) {
        current = playing
    }

    @Synchronized
    fun begin(desired: Boolean): PlaybackTransition? {
        val previous = current ?: return null
        if (previous == desired) return null
        current = desired
        return PlaybackTransition(previous, desired)
    }

    @Synchronized
    fun failed(transition: PlaybackTransition) {
        if (current == transition.to) current = transition.from
    }
}
