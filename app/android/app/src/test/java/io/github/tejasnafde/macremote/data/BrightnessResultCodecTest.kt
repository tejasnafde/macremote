package io.github.tejasnafde.macremote.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BrightnessResultCodecTest {
    @Test fun `decodes a successful gamma change`() {
        val result = BrightnessResultCodec.decode("""{"ok":true,"via":"gamma"}""")

        assertTrue(result.ok)
        assertEquals("gamma", result.via)
        assertFalse(result.displayUnsupported)
        assertFalse(result.requiresTargetRefresh)
        assertNull(result.failureMessage())
    }

    @Test fun `preserves unsupported display failures returned with HTTP 200`() {
        val result = BrightnessResultCodec.decode("""{"ok":false,"display_unsupported":true}""")

        assertFalse(result.ok)
        assertTrue(result.displayUnsupported)
        assertTrue(result.requiresTargetRefresh)
        assertEquals("That display is no longer available", result.failureMessage())
    }
}
