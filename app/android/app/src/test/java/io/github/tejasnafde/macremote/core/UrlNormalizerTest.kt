package io.github.tejasnafde.macremote.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UrlNormalizerTest {
    @Test fun `normalizes bare hosts and trailing slashes`() {
        assertEquals("http://macbook:8484", UrlNormalizer.normalize(" macbook:8484/// "))
    }

    @Test fun `repairs malformed protocol slashes from legacy clients`() {
        assertEquals("https://100.64.0.2:8484", UrlNormalizer.normalize("https:/100.64.0.2:8484/"))
    }

    @Test fun `rejects missing or protocol-shaped hosts`() {
        assertFalse(UrlNormalizer.isValid("http://"))
        assertFalse(UrlNormalizer.isValid("http://https"))
        assertTrue(UrlNormalizer.isValid("http://192.168.1.2:8484"))
    }
}
