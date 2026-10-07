package io.github.tejasnafde.macremote

import org.junit.Assert.assertEquals
import org.junit.Test

class DistributionTest {
    @Test
    fun selfUpdatesOnlyRunInGithubFlavor() {
        assertEquals(BuildConfig.FLAVOR == "github", BuildConfig.ENABLE_SELF_UPDATES)
    }
}
