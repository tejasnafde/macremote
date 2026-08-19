package io.github.tejasnafde.macremote.data

data class NowPlaying(
    val title: String?,
    val artist: String?,
    val app: String?,
    val state: String?,
) {
    val isPlaying: Boolean
        get() = state?.contains("play", ignoreCase = true) == true
}

enum class SleepMode(val wireValue: String) {
    Sleep("sleep"),
    Blackout("blackout");

    companion object {
        fun fromWire(value: String?): SleepMode = entries.firstOrNull { it.wireValue == value } ?: Sleep
    }
}

data class SleepTimerStatus(val remainingSeconds: Int, val mode: SleepMode)

data class BrowserTab(
    val tabId: Int,
    val browser: String,
    val title: String,
    val urlHost: String?,
    val playing: Boolean,
    val audible: Boolean,
    val muted: Boolean,
    val volume: Int?,
    val playbackRate: Float?,
    val fullscreen: Boolean,
    val controllable: Boolean?,
) {
    val key: String get() = "$browser:$tabId"
    val isDrivable: Boolean get() = controllable ?: true
}

data class FullscreenResult(val ok: Boolean, val note: String?)

data class BrowserBridge(val browser: String, val version: String?)

data class MacStatus(
    val nowPlaying: NowPlaying?,
    val volume: Int?,
    val muted: Boolean,
    val brightness: Int?,
    val battery: Int?,
    val sleepTimer: SleepTimerStatus?,
    val browserTabs: List<BrowserTab>,
    val browserBridges: List<BrowserBridge>,
)

data class DisplayInfo(
    val id: String,
    val name: String,
    val builtin: Boolean,
    val brightness: Int?,
    val gammaLevel: Int?,
    val method: String?,
)

data class AppEntry(val name: String, val bundleId: String, val active: Boolean)
data class WindowEntry(val id: Int, val app: String, val bundleId: String, val title: String, val active: Boolean)
data class DisplayWindows(val name: String, val id: Int, val windows: List<WindowEntry>)
data class AudioApp(val name: String, val volume: Int)

object AppListMerger {
    fun withoutListedWindows(windows: List<DisplayWindows>, apps: List<AppEntry>): List<AppEntry> {
        val listedBundleIds = windows.flatMap { it.windows }.mapTo(mutableSetOf()) { it.bundleId }
        return apps.filterNot { it.bundleId in listedBundleIds }
    }
}
