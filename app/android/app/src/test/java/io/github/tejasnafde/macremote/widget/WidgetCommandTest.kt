package io.github.tejasnafde.macremote.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WidgetCommandTest {
    @Test fun `maps only explicit private widget actions`() {
        assertEquals(WidgetCommand.PlayPause, WidgetCommand.fromAction("io.github.tejasnafde.macremote.widget.PLAY_PAUSE"))
        assertEquals(WidgetCommand.VolumeUp, WidgetCommand.fromAction("io.github.tejasnafde.macremote.widget.VOLUME_UP"))
        assertNull(WidgetCommand.fromAction("android.intent.action.VIEW"))
    }
}
