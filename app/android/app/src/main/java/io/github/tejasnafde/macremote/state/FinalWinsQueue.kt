package io.github.tejasnafde.macremote.state

class FinalWinsQueue<T> {
    private var preview: T? = null
    private var committed: T? = null
    private var inFlight = false
    private var commitVersion = 0L
    private var inFlightCommitVersion: Long? = null

    @Synchronized
    fun offerPreview(value: T) {
        preview = value
    }

    @Synchronized
    fun commit(value: T) {
        committed = value
        commitVersion += 1
        preview = null
    }

    @Synchronized
    fun takeNext(): T? {
        if (inFlight) return null
        committed?.let {
            inFlight = true
            inFlightCommitVersion = commitVersion
            return it
        }
        return preview?.also {
            preview = null
            inFlight = true
            inFlightCommitVersion = null
        }
    }

    @Synchronized
    fun completeInFlight() {
        if (inFlightCommitVersion == commitVersion) committed = null
        inFlight = false
        inFlightCommitVersion = null
    }
}
