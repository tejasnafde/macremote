package io.github.tejasnafde.macremote.media

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class AbsolutePlaybackGateTest {
    @Test fun `duplicate absolute command cannot toggle playback twice`() {
        val gate = AbsolutePlaybackGate()
        gate.observe(true)

        assertNotNull(gate.begin(false))
        assertNull(gate.begin(false))
        assertEquals(false, gate.current)
    }

    @Test fun `failed transition restores state only when no newer intent replaced it`() {
        val gate = AbsolutePlaybackGate()
        gate.observe(true)
        val pause = gate.begin(false)!!
        val play = gate.begin(true)!!

        gate.failed(pause)
        assertEquals(true, gate.current)

        gate.failed(play)
        assertEquals(false, gate.current)
    }
}
