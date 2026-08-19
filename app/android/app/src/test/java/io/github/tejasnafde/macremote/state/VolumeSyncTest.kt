package io.github.tejasnafde.macremote.state

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VolumeSyncTest {
    @Test fun `pending local volume wins over a stale status poll`() {
        val sync = VolumeSync()

        sync.offer(10)

        assertEquals(10, sync.displayed(authoritative = 15))
    }

    @Test fun `an older completed write cannot clear a newer drag value`() {
        val sync = VolumeSync()
        val old = sync.offer(15)
        sync.offer(10)

        assertFalse(sync.settle(old))
        assertEquals(10, sync.displayed(authoritative = 15))
    }

    @Test fun `the latest authoritative response releases pending volume`() {
        val sync = VolumeSync()
        val latest = sync.offer(10)

        assertTrue(sync.settle(latest))
        assertEquals(9, sync.displayed(authoritative = 9))
    }

    @Test fun `a poll accepted after a completed write releases the matching pending volume`() {
        val sync = VolumeSync()
        val completed = sync.offer(10)

        sync.complete(completed)

        assertEquals(10, sync.displayed(authoritative = 10))
        assertEquals(9, sync.displayed(authoritative = 9))
    }

    @Test fun `a completed older write cannot release a newer pending volume`() {
        val sync = VolumeSync()
        val completed = sync.offer(15)
        sync.offer(10)

        sync.complete(completed)

        assertEquals(10, sync.displayed(authoritative = 15))
    }
}
