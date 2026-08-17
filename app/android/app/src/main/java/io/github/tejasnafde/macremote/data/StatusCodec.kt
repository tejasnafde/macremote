package io.github.tejasnafde.macremote.data

import org.json.JSONArray
import org.json.JSONObject

object StatusCodec {
    fun decode(raw: String): MacStatus {
        val root = JSONObject(raw)
        val now = root.optJSONObject("now_playing")?.let {
            NowPlaying(it.nullableString("title"), it.nullableString("artist"), it.nullableString("app"), it.nullableString("state"))
        }
        val timer = root.optJSONObject("sleep_timer")?.let {
            SleepTimerStatus(it.optInt("remaining_seconds", 0), SleepMode.fromWire(it.nullableString("mode")))
        }
        val tabs = root.optJSONArray("browser_tabs").mapObjects { item ->
            BrowserTab(
                tabId = item.optInt("tab_id"),
                browser = item.optString("browser"),
                title = item.optString("title"),
                urlHost = item.nullableString("url_host"),
                playing = item.optBoolean("playing"),
                audible = item.optBoolean("audible"),
                muted = item.optBoolean("muted"),
                volume = item.nullableInt("volume"),
                fullscreen = item.optBoolean("fullscreen"),
                controllable = if (item.has("controllable") && !item.isNull("controllable")) item.optBoolean("controllable") else null,
            )
        }
        return MacStatus(
            nowPlaying = now,
            volume = root.nullableInt("volume"),
            muted = root.optBoolean("muted"),
            brightness = root.nullableInt("brightness"),
            battery = root.nullableInt("battery"),
            sleepTimer = timer,
            browserTabs = tabs,
        )
    }
}

internal fun JSONObject.nullableString(key: String): String? =
    takeIf { has(key) && !isNull(key) }?.optString(key)?.takeIf { it.isNotBlank() }

internal fun JSONObject.nullableInt(key: String): Int? =
    takeIf { has(key) && !isNull(key) }?.optInt(key)

internal inline fun <T> JSONArray?.mapObjects(block: (JSONObject) -> T): List<T> {
    if (this == null) return emptyList()
    return buildList {
        for (index in 0 until length()) optJSONObject(index)?.let { add(block(it)) }
    }
}
