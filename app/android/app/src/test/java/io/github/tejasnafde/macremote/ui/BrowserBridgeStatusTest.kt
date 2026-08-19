package io.github.tejasnafde.macremote.ui

import io.github.tejasnafde.macremote.data.BrowserBridge
import org.junit.Assert.assertEquals
import org.junit.Test

class BrowserBridgeStatusTest {
    @Test fun `missing bridge message is browser neutral`() {
        assertEquals(
            "Browser bridge not connected. Install or reload the extension.",
            browserBridgeMessage(emptyList()),
        )
    }

    @Test fun `all connected browsers are named`() {
        assertEquals(
            "Firefox and Chrome bridges connected. No media detected.",
            browserBridgeMessage(
                listOf(BrowserBridge("firefox", "0.5.4"), BrowserBridge("chrome", "0.5.4")),
            ),
        )
    }

    @Test fun `older versioned bridge asks for an update`() {
        assertEquals(
            "Firefox bridge connected. Update it for full controls.",
            browserBridgeMessage(listOf(BrowserBridge("firefox", "0.5.3"))),
        )
    }

    @Test fun `malformed version cannot masquerade as current`() {
        assertEquals(
            "Firefox bridge connected. Update it for full controls.",
            browserBridgeMessage(listOf(BrowserBridge("firefox", "0.x.9"))),
        )
    }
}
