package io.github.tejasnafde.macremote.core

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VersionComparatorTest {
    @Test fun `compares numeric segments rather than lexically`() {
        assertTrue(VersionComparator.isNewer("0.10.0", "0.9.9"))
        assertFalse(VersionComparator.isNewer("0.4.4", "0.4.4"))
        assertFalse(VersionComparator.isNewer("0.4.3", "0.4.4"))
    }

    @Test fun `accepts release tag prefix and missing trailing segments`() {
        assertTrue(VersionComparator.isNewer("v1.1", "1.0.9"))
        assertFalse(VersionComparator.isNewer("1.0", "1.0.0"))
    }

    @Test fun `rejects malformed versions`() {
        assertFalse(VersionComparator.isNewer("latest", "0.4.4"))
        assertFalse(VersionComparator.isNewer("1.two.0", "0.4.4"))
    }
}
