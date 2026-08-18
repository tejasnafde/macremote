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

    @Test fun `overlapping failed transitions restore the last server-confirmed state`() {
        val gate = AbsolutePlaybackGate()
        gate.observe(true, nowMs = 1_000)
        val pause = gate.begin(false, nowMs = 1_100)!!
        val play = gate.begin(true, nowMs = 1_200)!!

        gate.failed(pause)
        assertEquals(true, gate.current)

        gate.failed(play)
        assertEquals(true, gate.current)
    }

    @Test fun `newer failure restores an older successfully applied transition`() {
        val gate = AbsolutePlaybackGate()
        gate.observe(true, nowMs = 1_000)
        val pause = gate.begin(false, nowMs = 1_100)!!
        val play = gate.begin(true, nowMs = 1_200)!!

        gate.succeeded(pause)
        gate.failed(play)

        assertEquals(false, gate.current)
    }

    @Test fun `stale poll cannot replace a newer local playback intent`() {
        val gate = AbsolutePlaybackGate()
        gate.observe(true, nowMs = 1_000)
        gate.begin(false, nowMs = 1_100)

        gate.observe(true, nowMs = 1_200)

        assertEquals(false, gate.current)
    }

    @Test fun `server truth wins after the optimistic transition timeout`() {
        val gate = AbsolutePlaybackGate()
        gate.observe(true, nowMs = 1_000)
        gate.begin(false, nowMs = 1_100)

        gate.observe(true, nowMs = 7_000)

        assertEquals(true, gate.current)
    }
}
