package io.github.tejasnafde.macremote.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdatePresentationTest {
    @Test fun `manual check has visible busy feedback and cannot be started twice`() {
        val presentation = UpdatePresentation.create(checking = true, release = null, progress = null)

        assertEquals("Checking for update…", presentation.checkLabel)
        assertFalse(presentation.checkEnabled)
        assertNull(presentation.installLabel)
    }

    @Test fun `available release exposes the install action on the checking screen`() {
        val release = LatestRelease("0.5.3", "https://example.test/macremote.apk")

        val presentation = UpdatePresentation.create(checking = false, release = release, progress = null)

        assertEquals("macremote 0.5.3 is ready", presentation.installLabel)
        assertTrue(presentation.installEnabled)
    }

    @Test fun `download progress replaces the install action and disables repeated taps`() {
        val release = LatestRelease("0.5.3", "https://example.test/macremote.apk")

        val presentation = UpdatePresentation.create(checking = false, release = release, progress = 47)

        assertEquals("Downloading 47%", presentation.installLabel)
        assertFalse(presentation.installEnabled)
        assertFalse(presentation.checkEnabled)
    }
}
