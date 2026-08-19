package io.github.tejasnafde.macremote.data

import org.junit.Assert.assertEquals
import org.junit.Test

class AppListMergerTest {
    @Test fun `keeps running apps whose windows are on another macOS space`() {
        val windows = listOf(
            DisplayWindows(
                name = "LG",
                id = 2,
                windows = listOf(
                    WindowEntry(1, "Finder", "com.apple.finder", "Downloads", false),
                ),
            ),
        )
        val apps = listOf(
            AppEntry("Finder", "com.apple.finder", false),
            AppEntry("Firefox", "org.mozilla.firefox", false),
        )

        assertEquals(
            listOf(AppEntry("Firefox", "org.mozilla.firefox", false)),
            AppListMerger.withoutListedWindows(windows, apps),
        )
    }
}
