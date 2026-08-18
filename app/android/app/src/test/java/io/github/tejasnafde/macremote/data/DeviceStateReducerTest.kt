package io.github.tejasnafde.macremote.data

import org.junit.Assert.assertEquals
import org.junit.Test

class DeviceStateReducerTest {
    @Test fun `editing an inactive device activates it consistently`() {
        val first = Device("first", "First", "http://first:8484", "one")
        val second = Device("second", "Second", "http://second:8484", "two")
        val edited = second.copy(name = "Studio")

        val result = DeviceStateReducer.replaceAndActivate(DevicesState(listOf(first, second), first.id), edited)

        assertEquals(edited.id, result.activeId)
        assertEquals(edited, result.activeDevice)
    }
}
