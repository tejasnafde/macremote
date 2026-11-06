package io.github.tejasnafde.macremote.state

import io.github.tejasnafde.macremote.data.MacStatus

/**
 * The play state the user just asked for on one tab. The browser extension
 * runs a command up to ~2 s after the tap, so the status refresh right after a
 * tap still shows the old state; a quick second tap then sent "pause" twice.
 * Until the Mac reports the requested state, or [untilMs] passes, the app
 * shows the requested state instead.
 */
data class TabPlaybackOverride(val tabKey: String, val playing: Boolean, val untilMs: Long) {
    /** Returns the status to show and the override to keep (null when done). */
    fun applyTo(status: MacStatus, nowMs: Long): Pair<MacStatus, TabPlaybackOverride?> {
        if (nowMs >= untilMs) return status to null
        val tab = status.browserTabs.firstOrNull { it.key == tabKey } ?: return status to null
        if (tab.playing == playing) return status to null
        val tabs = status.browserTabs.map { if (it.key == tabKey) it.copy(playing = playing) else it }
        return status.copy(browserTabs = tabs) to this
    }

    companion object { const val HOLD_MS = 6_000L }
}
