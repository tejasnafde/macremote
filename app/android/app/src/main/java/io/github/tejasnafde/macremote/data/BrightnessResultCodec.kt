package io.github.tejasnafde.macremote.data

import org.json.JSONObject

data class BrightnessResult(
    val ok: Boolean,
    val displayUnsupported: Boolean,
    val via: String?,
) {
    val requiresTargetRefresh: Boolean
        get() = displayUnsupported

    fun failureMessage(): String? = when {
        ok -> null
        displayUnsupported -> "That display is no longer available"
        else -> "The Mac could not change brightness"
    }

}

object BrightnessResultCodec {
    fun decode(raw: String): BrightnessResult {
        val root = JSONObject(raw)
        return BrightnessResult(
            ok = root.optBoolean("ok"),
            displayUnsupported = root.optBoolean("display_unsupported"),
            via = root.optString("via").takeIf { it.isNotBlank() },
        )
    }
}
