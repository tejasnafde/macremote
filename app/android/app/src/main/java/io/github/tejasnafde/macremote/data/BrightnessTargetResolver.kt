package io.github.tejasnafde.macremote.data

object BrightnessTargetResolver {
    fun resolve(savedTarget: String?, displays: List<DisplayInfo>): String? {
        val available = displays.filter { display ->
            if (display.builtin) display.brightness != null
            else display.gammaLevel != null || display.brightness != null
        }
        if (available.any { it.id == savedTarget }) return savedTarget
        return available.firstOrNull { it.builtin }?.id ?: available.firstOrNull()?.id
    }
}
