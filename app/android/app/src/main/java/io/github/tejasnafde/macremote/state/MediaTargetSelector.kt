package io.github.tejasnafde.macremote.state

import io.github.tejasnafde.macremote.data.BrowserTab
import io.github.tejasnafde.macremote.data.MacStatus

object MediaTargetSelector {
    const val MEMORY_MS = 60_000L

    fun select(
        status: MacStatus?,
        rememberedTabKey: String?,
        rememberedAtMs: Long,
        nowMs: Long,
    ): BrowserTab? {
        status ?: return null
        val nativeNowPlaying = status.nowPlaying?.let { it.title != null || it.state != null } == true
        if (nativeNowPlaying) return null
        return status.browserTabs.firstOrNull {
            it.playing && it.isDrivable && it.audible && !it.muted
        }
            ?: status.browserTabs.firstOrNull { it.playing && it.isDrivable }
            ?: status.browserTabs.firstOrNull {
                nowMs - rememberedAtMs <= MEMORY_MS &&
                    nowMs >= rememberedAtMs &&
                    it.key == rememberedTabKey &&
                    it.isDrivable
            }
    }
}
