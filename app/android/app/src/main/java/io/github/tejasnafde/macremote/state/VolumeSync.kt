package io.github.tejasnafde.macremote.state

class VolumeSync {
    private var generation = 0L
    private var pending: Int? = null
    private var pendingGeneration: Long? = null
    private var completedGeneration = 0L

    @Synchronized
    fun offer(level: Int): Long {
        generation += 1
        pending = level
        pendingGeneration = generation
        return generation
    }

    @Synchronized
    fun displayed(authoritative: Int?): Int? {
        if ((pendingGeneration ?: Long.MAX_VALUE) <= completedGeneration) {
            pending = null
            pendingGeneration = null
        }
        return pending ?: authoritative
    }

    @Synchronized
    fun complete(token: Long) {
        completedGeneration = maxOf(completedGeneration, token)
    }

    @Synchronized
    fun settle(token: Long): Boolean {
        if (token != generation) return false
        pending = null
        pendingGeneration = null
        return true
    }

    @Synchronized
    fun reset() {
        generation += 1
        pending = null
        pendingGeneration = null
        completedGeneration = generation
    }
}
