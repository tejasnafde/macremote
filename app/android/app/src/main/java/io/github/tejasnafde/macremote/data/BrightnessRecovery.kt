package io.github.tejasnafde.macremote.data

enum class DisplayRefresh { None, Immediate, Debounced }

object BrightnessRecovery {
    fun after(result: BrightnessResult, attemptedTarget: String?): DisplayRefresh = when {
        result.requiresTargetRefresh -> DisplayRefresh.Immediate
        attemptedTarget != null && attemptedTarget != "builtin" -> DisplayRefresh.Debounced
        else -> DisplayRefresh.None
    }
}
