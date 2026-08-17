package io.github.tejasnafde.macremote.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class DeviceCodecTest {
    @Test fun `stored device tokens pass through the cipher boundary`() {
        val cipher = object : StringCipher {
            override fun encrypt(value: String) = "sealed:${value.reversed()}"
            override fun decrypt(value: String) = value.removePrefix("sealed:").reversed()
        }
        val state = DevicesState(
            devices = listOf(Device("one", "Desk", "http://desk:8484", "private")),
            activeId = "one",
        )

        val encoded = DeviceCodec.encode(state, cipher)
        val decoded = DeviceCodec.decode(encoded, cipher)

        assertFalse(encoded.contains("private"))
        assertEquals(state, decoded)
    }
}
