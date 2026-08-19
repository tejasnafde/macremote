package io.github.tejasnafde.macremote.ui

import io.github.tejasnafde.macremote.data.DisplayInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DisplayControlLevelTest {
    @Test fun `gamma control uses gamma instead of readable ddc luminance`() {
        val display = DisplayInfo("1", "LG", false, brightness = 77, gammaLevel = 42, method = "gamma")

        assertEquals(42, displayControlLevel(display, builtinBrightness = 60))
    }

    @Test fun `unreadable selected ddc display does not borrow builtin brightness`() {
        val display = DisplayInfo("1", "LG", false, brightness = null, gammaLevel = null, method = "ddc")

        assertNull(displayControlLevel(display, builtinBrightness = 60))
    }
}
