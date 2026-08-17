package io.github.tejasnafde.macremote.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ReleaseCodecTest {
    @Test fun `selects the signed apk and strips the release tag prefix`() {
        val digest = "a".repeat(64)
        val raw = """{"tag_name":"v0.5.0","assets":[{"name":"macremote-firefox-v0.5.0.xpi","browser_download_url":"https://x/xpi"},{"name":"macremote-v0.5.0.apk","browser_download_url":"https://x/apk","digest":"sha256:$digest"}]}"""
        assertEquals(LatestRelease("0.5.0", "https://x/apk", digest), ReleaseCodec.decode(raw))
    }

    @Test fun `rejects releases without an apk`() {
        assertNull(ReleaseCodec.decode("""{"tag_name":"v0.5.0","assets":[]}"""))
    }
}
