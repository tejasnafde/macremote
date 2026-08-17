package io.github.tejasnafde.macremote.state

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FinalWinsQueueTest {
    @Test fun `coalesces drag values and always sends the final commit last`() {
        val queue = FinalWinsQueue<Int>()
        queue.offerPreview(10)
        queue.offerPreview(20)
        assertEquals(20, queue.takeNext())

        queue.offerPreview(30)
        queue.commit(40)
        queue.completeInFlight()
        assertEquals(40, queue.takeNext())
        queue.completeInFlight()
        assertNull(queue.takeNext())
    }

    @Test fun `a preview arriving after commit cannot replace it`() {
        val queue = FinalWinsQueue<Int>()
        queue.offerPreview(10)
        assertEquals(10, queue.takeNext())
        queue.commit(50)
        queue.offerPreview(20)
        queue.completeInFlight()
        assertEquals(50, queue.takeNext())
    }

    @Test fun `a newer commit arriving while a commit is in flight is not discarded`() {
        val queue = FinalWinsQueue<Int>()
        queue.commit(40)
        assertEquals(40, queue.takeNext())

        queue.commit(70)
        queue.completeInFlight()

        assertEquals(70, queue.takeNext())
        queue.completeInFlight()
        assertNull(queue.takeNext())
    }
}
