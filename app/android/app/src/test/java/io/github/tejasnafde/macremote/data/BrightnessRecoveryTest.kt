package io.github.tejasnafde.macremote.data

import org.junit.Assert.assertEquals
import org.junit.Test

class BrightnessRecoveryTest {
    @Test fun `unsupported external target is refreshed but never retargeted automatically`() {
        val result = BrightnessResult(ok = false, displayUnsupported = true, via = null)

        assertEquals(DisplayRefresh.Immediate, BrightnessRecovery.after(result, attemptedTarget = "1"))
    }

    @Test fun `successful external change refreshes its displayed level`() {
        val result = BrightnessResult(ok = true, displayUnsupported = false, via = "gamma")

        assertEquals(DisplayRefresh.Debounced, BrightnessRecovery.after(result, attemptedTarget = "1"))
    }

    @Test fun `successful built in change relies on the normal status refresh`() {
        val result = BrightnessResult(ok = true, displayUnsupported = false, via = null)

        assertEquals(DisplayRefresh.None, BrightnessRecovery.after(result, attemptedTarget = "builtin"))
    }
}
