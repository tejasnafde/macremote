package io.github.tejasnafde.macremote.data

import org.json.JSONObject

object FullscreenResultCodec {
    fun decode(raw: String): FullscreenResult {
        val root = JSONObject(raw)
        return FullscreenResult(root.optBoolean("ok", true), root.nullableString("note"))
    }
}
