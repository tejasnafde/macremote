package io.github.tejasnafde.macremote.state

import io.github.tejasnafde.macremote.data.BrowserTab
import io.github.tejasnafde.macremote.data.MacStatus
import io.github.tejasnafde.macremote.data.NowPlaying
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MediaTargetSelectorTest {
    private val tab = BrowserTab(
        tabId = 7,
        browser = "firefox",
        title = "Video",
        urlHost = "example.com",
        playing = true,
        audible = true,
        muted = false,
        volume = 80,
        fullscreen = false,
        controllable = true,
    )

    @Test
    fun `playing controllable browser tab is used without native now-playing`() {
        val status = status(tabs = listOf(tab))

        assertEquals(tab, MediaTargetSelector.select(status, null, 0, nowMs = 1_000))
    }

    @Test
    fun `native now-playing keeps the system media transport in control`() {
        val status = status(
            nowPlaying = NowPlaying("Song", "Artist", "Music", "playing"),
            tabs = listOf(tab),
        )

        assertNull(MediaTargetSelector.select(status, tab.key, 1_000, nowMs = 1_100))
    }

    @Test
    fun `recently paused tab remains the target long enough to resume`() {
        val paused = tab.copy(playing = false)
        val status = status(tabs = listOf(paused))

        assertEquals(paused, MediaTargetSelector.select(status, paused.key, 1_000, nowMs = 10_000))
        assertNull(MediaTargetSelector.select(status, paused.key, 1_000, nowMs = 70_001))
    }

    @Test
    fun `uncontrollable browser media falls back to system transport`() {
        val blocked = tab.copy(controllable = false, volume = null)

        assertNull(MediaTargetSelector.select(status(tabs = listOf(blocked)), null, 0, nowMs = 1_000))
    }

    private fun status(
        nowPlaying: NowPlaying? = null,
        tabs: List<BrowserTab>,
    ) = MacStatus(
        nowPlaying = nowPlaying,
        volume = 50,
        muted = false,
        brightness = 50,
        battery = 80,
        sleepTimer = null,
        browserTabs = tabs,
    )
}
