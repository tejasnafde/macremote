package io.github.tejasnafde.macremote.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BrightnessTargetResolverTest {
    private val builtin = DisplayInfo("builtin", "Built-in", true, 42, null, null)
    private val external = DisplayInfo("1", "Studio", false, 70, 100, "gamma")

    @Test fun `preserves a saved target that is still connected`() {
        assertEquals("1", BrightnessTargetResolver.resolve("1", listOf(builtin, external)))
    }

    @Test fun `repairs a disconnected target to the built in display`() {
        assertEquals("builtin", BrightnessTargetResolver.resolve("9", listOf(builtin)))
    }

    @Test fun `uses the first display when a Mac has no built in panel`() {
        assertEquals("1", BrightnessTargetResolver.resolve("missing", listOf(external)))
    }

    @Test fun `skips the synthetic built in entry when that Mac has no brightness API`() {
        val unavailableBuiltin = builtin.copy(brightness = null)

        assertEquals("1", BrightnessTargetResolver.resolve(null, listOf(unavailableBuiltin, external)))
    }

    @Test fun `returns no target when the Mac reports no controllable display`() {
        val unavailableBuiltin = builtin.copy(brightness = null)

        assertNull(BrightnessTargetResolver.resolve("builtin", listOf(unavailableBuiltin)))
    }
}
