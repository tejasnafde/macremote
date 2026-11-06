package io.github.tejasnafde.macremote.state

import io.github.tejasnafde.macremote.data.BrowserTab
import io.github.tejasnafde.macremote.data.MacStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

class TabPlaybackOverrideTest {
    private fun tab(id: Int, playing: Boolean) = BrowserTab(id, "firefox", "t$id", "music.youtube.com", playing, true, false, null, null, false, true)
    private fun status(vararg tabs: BrowserTab) = MacStatus(null, 50, false, 50, 100, null, tabs.toList(), emptyList())

    @Test
    fun staleRefreshKeepsTheRequestedState() {
        val override = TabPlaybackOverride("firefox:1", playing = false, untilMs = 6_000)
        val (shown, kept) = override.applyTo(status(tab(1, playing = true), tab(2, playing = true)), nowMs = 1_000)
        assertEquals(listOf(false, true), shown.browserTabs.map { it.playing })
        assertSame(override, kept)
    }

    @Test
    fun overrideEndsWhenTheMacAgreesOrTimeRunsOut() {
        val override = TabPlaybackOverride("firefox:1", playing = false, untilMs = 6_000)
        assertNull(override.applyTo(status(tab(1, playing = false)), nowMs = 1_000).second)
        val (shown, kept) = override.applyTo(status(tab(1, playing = true)), nowMs = 6_000)
        assertEquals(true, shown.browserTabs.single().playing)
        assertNull(kept)
    }
}
