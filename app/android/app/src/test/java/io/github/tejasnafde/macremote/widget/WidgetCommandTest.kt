package io.github.tejasnafde.macremote.widget

import io.github.tejasnafde.macremote.data.Device
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetCommandTest {
    @Test fun `maps only explicit private widget actions`() {
        assertEquals(WidgetCommand.PlayPause, WidgetCommand.fromAction("io.github.tejasnafde.macremote.widget.PLAY_PAUSE"))
        assertEquals(WidgetCommand.VolumeUp, WidgetCommand.fromAction("io.github.tejasnafde.macremote.widget.VOLUME_UP"))
        assertNull(WidgetCommand.fromAction("android.intent.action.VIEW"))
    }

    @Test fun `missing setup opens the app instead of dropping the widget tap`() = runBlocking {
        var opened = false

        WidgetCommandExecutor.execute(null, WidgetCommand.PlayPause, openSetup = { opened = true }) { _, _ -> }

        assertTrue(opened)
    }

    @Test fun `offline widget command is contained as a best effort failure`() = runBlocking {
        val device = Device("dev", "Mac", "http://mac:8484", "token")

        WidgetCommandExecutor.execute(device, WidgetCommand.PlayPause, openSetup = {}) { _, _ ->
            error("offline")
        }
    }

    @Test(expected = CancellationException::class)
    fun `widget execution preserves coroutine cancellation`() = runBlocking {
        val device = Device("dev", "Mac", "http://mac:8484", "token")

        WidgetCommandExecutor.execute(device, WidgetCommand.PlayPause, openSetup = {}) { _, _ ->
            throw CancellationException("stopped")
        }
    }
}
