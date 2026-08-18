package io.github.tejasnafde.macremote.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SleepTimerSelectionTest {
    @Test fun `default timer remains one hour`() {
        assertEquals(60, SleepTimerSelection().minutes)
    }

    @Test fun `custom timer steps are bounded and remain custom`() {
        val adjusted = SleepTimerSelection(minutes = 20).adjust(-30)

        assertEquals(5, adjusted.minutes)
        assertTrue(adjusted.custom)
    }

    @Test fun `custom timer opens at the previous twenty minute value`() {
        assertEquals(20, SleepTimerSelection().beginCustom().minutes)
    }

    @Test fun `custom value survives a temporary preset selection`() {
        val restored = SleepTimerSelection().beginCustom().adjust(15).choosePreset(60).beginCustom()

        assertEquals(35, restored.minutes)
    }

    @Test fun `preset selection leaves custom mode`() {
        val selected = SleepTimerSelection(minutes = 25, custom = true).choosePreset(45)

        assertEquals(45, selected.minutes)
        assertEquals(false, selected.custom)
    }

    @Test fun `editing a running non-preset duration visibly selects custom`() {
        val selected = SleepTimerSelection.forEditing(59)

        assertEquals(59, selected.minutes)
        assertTrue(selected.custom)
    }

    @Test fun `editing a running preset duration visibly selects that preset`() {
        val selected = SleepTimerSelection.forEditing(45)

        assertEquals(45, selected.minutes)
        assertEquals(false, selected.custom)
    }

    @Test fun `custom timer retains the previous three hour ceiling`() {
        val adjusted = SleepTimerSelection(minutes = 175).adjust(30)

        assertEquals(180, adjusted.minutes)
    }
}
