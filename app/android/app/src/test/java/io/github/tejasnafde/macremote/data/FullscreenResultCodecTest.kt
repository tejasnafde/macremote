package io.github.tejasnafde.macremote.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class FullscreenResultCodecTest {
    @Test fun `preserves a successful HTTP response that declined fullscreen`() {
        val result = FullscreenResultCodec.decode("""{"ok":false,"note":"reload the extension"}""")

        assertFalse(result.ok)
        assertEquals("reload the extension", result.note)
    }
}
