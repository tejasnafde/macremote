package io.github.tejasnafde.macremote.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LegacyMigrationTest {
    @Test fun `reads multi-device AsyncStorage state without losing active selection`() {
        val raw = """{"devices":[{"id":"dev_a","name":"Desk Mac","url":"http://desk:8484","token":" secret "},{"id":"dev_b","name":"Studio","url":"https://studio:8484","token":"two"}],"activeId":"dev_b"}"""

        val state = LegacyMigration.decode(raw, null, null)

        assertEquals(2, state?.devices?.size)
        assertEquals("dev_b", state?.activeId)
        assertEquals("secret", state?.devices?.first()?.token)
    }

    @Test fun `falls back to the original single-device keys`() {
        val state = LegacyMigration.decode(null, "macbook:8484", " token ")

        assertEquals(1, state?.devices?.size)
        assertEquals("macbook", state?.devices?.single()?.name)
        assertEquals("http://macbook:8484", state?.devices?.single()?.url)
    }

    @Test fun `ignores incomplete legacy configuration`() {
        assertNull(LegacyMigration.decode(null, "macbook:8484", ""))
    }
}
