package io.github.tejasnafde.macremote.state

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ResponseGateTest {
    @Test fun `response from the previous device cannot update current state`() {
        val gate = ResponseGate()
        val deskRequest = gate.activate("desk")
        val studioRequest = gate.activate("studio")

        assertFalse(gate.accepts(deskRequest))
        assertTrue(gate.accepts(studioRequest))
    }

    @Test fun `overlapping polls only accept the newest request`() {
        val gate = ResponseGate()
        gate.activate("desk")
        val first = gate.nextRequest()
        val second = gate.nextRequest()

        assertFalse(gate.accepts(first))
        assertTrue(gate.accepts(second))
    }
}
