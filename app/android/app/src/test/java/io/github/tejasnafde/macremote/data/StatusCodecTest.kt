package io.github.tejasnafde.macremote.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StatusCodecTest {
    @Test fun `decodes nullable status and browser extension fields`() {
        val json = """{
          "now_playing":{"title":"Low","artist":"Chet Faker","app":"Spotify","state":"kPlaybackStatePlaying"},
          "volume":42,"muted":false,"brightness":null,"battery":87,
          "sleep_timer":{"remaining_seconds":125,"mode":"blackout"},
          "browser_tabs":[{"tab_id":7,"browser":"firefox","title":"Video","playing":true,"audible":true,"muted":false,"volume":65,"fullscreen":false,"controllable":true}]
        }"""

        val status = StatusCodec.decode(json)

        assertEquals("Low", status.nowPlaying?.title)
        assertTrue(status.nowPlaying?.isPlaying == true)
        assertEquals(42, status.volume)
        assertNull(status.brightness)
        assertEquals(125, status.sleepTimer?.remainingSeconds)
        assertEquals(SleepMode.Blackout, status.sleepTimer?.mode)
        assertEquals("firefox:7", status.browserTabs.single().key)
        assertFalse(status.browserTabs.single().muted)
    }

    @Test fun `older server response degrades missing optional fields safely`() {
        val status = StatusCodec.decode("""{
          "now_playing":null,"volume":null,"muted":false,"brightness":50,"battery":null,"sleep_timer":null,
          "browser_tabs":[{"tab_id":3,"browser":"chrome","title":"Embedded player","playing":true,"audible":true,"volume":null}]
        }""")

        assertNull(status.nowPlaying)
        assertNull(status.browserTabs.single().controllable)
        assertEquals(50, status.brightness)
    }
}
