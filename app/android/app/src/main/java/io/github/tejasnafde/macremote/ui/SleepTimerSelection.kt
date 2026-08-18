package io.github.tejasnafde.macremote.ui

data class SleepTimerSelection(
    val minutes: Int = 60,
    val custom: Boolean = false,
    private val customMinutes: Int = 20,
) {
    fun choosePreset(value: Int): SleepTimerSelection = copy(minutes = value, custom = false)
    fun beginCustom(): SleepTimerSelection = copy(minutes = customMinutes, custom = true)
    fun adjust(delta: Int): SleepTimerSelection = copy(
        minutes = (minutes + delta).coerceIn(MIN_MINUTES, MAX_MINUTES),
        custom = true,
        customMinutes = (minutes + delta).coerceIn(MIN_MINUTES, MAX_MINUTES),
    )

    companion object {
        val presets = listOf(15, 30, 45, 60)
        private const val MIN_MINUTES = 5
        private const val MAX_MINUTES = 180
    }
}
