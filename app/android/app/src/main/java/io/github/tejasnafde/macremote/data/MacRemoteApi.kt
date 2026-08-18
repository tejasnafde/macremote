package io.github.tejasnafde.macremote.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class ApiException(message: String, val status: Int? = null) : IOException(message)

class MacRemoteApi {
    suspend fun status(device: Device): MacStatus = StatusCodec.decode(request(device, "/status"))
    suspend fun health(device: Device) { request(device, "/health", authenticated = false) }
    suspend fun version(device: Device): String = JSONObject(request(device, "/version", authenticated = false)).optString("version")

    suspend fun playPause(device: Device) = unit(device, "/media/playpause")
    suspend fun next(device: Device) = unit(device, "/media/next")
    suspend fun previous(device: Device) = unit(device, "/media/previous")
    suspend fun seek(device: Device, seconds: Int) = unit(device, "/media/seek", body = JSONObject().put("seconds", seconds))

    suspend fun volumeUp(device: Device) = unit(device, "/volume/up")
    suspend fun volumeDown(device: Device) = unit(device, "/volume/down")
    suspend fun mute(device: Device) = unit(device, "/volume/mute")
    suspend fun setVolume(device: Device, level: Int) =
        unit(device, "/volume", method = "PUT", body = JSONObject().put("level", level.coerceIn(0, 100)))

    suspend fun displays(device: Device): List<DisplayInfo> {
        val root = JSONObject(request(device, "/displays"))
        return root.optJSONArray("displays").mapObjects { item ->
            DisplayInfo(
                id = item.optString("id"),
                name = item.optString("name"),
                builtin = item.optBoolean("builtin"),
                brightness = item.nullableInt("brightness"),
                gammaLevel = item.nullableInt("gamma_level"),
                method = item.nullableString("method"),
            )
        }
    }

    suspend fun brightnessStep(device: Device, direction: String, display: String?) = unit(
        device,
        "/brightness/$direction${display?.let { "?display=${encode(it)}" }.orEmpty()}",
    )

    suspend fun setBrightness(device: Device, level: Int, display: String) = unit(
        device,
        "/brightness",
        method = "PUT",
        body = JSONObject().put("level", level.coerceIn(0, 100)).put("display", display),
    )

    suspend fun lock(device: Device) = unit(device, "/system/lock")
    suspend fun sleep(device: Device) = unit(device, "/system/sleep")
    suspend fun blackout(device: Device) = unit(device, "/system/blackout")
    suspend fun screensOn(device: Device) = unit(device, "/system/screens-on")
    suspend fun banishCursor(device: Device) = unit(device, "/system/banish-cursor")

    suspend fun setSleepTimer(device: Device, minutes: Int, mode: SleepMode) = unit(
        device,
        "/sleep-timer",
        body = JSONObject().put("minutes", minutes).put("mode", mode.wireValue),
    )

    suspend fun cancelSleepTimer(device: Device) = unit(device, "/sleep-timer", method = "DELETE")

    suspend fun tabCommand(device: Device, tab: BrowserTab, action: String, value: Int? = null) = unit(
        device,
        "/browser/tabs/${tab.tabId}/command",
        body = JSONObject().put("action", action).put("browser", tab.browser).apply { value?.let { put("value", it) } },
    )

    suspend fun tabFullscreen(device: Device, tab: BrowserTab): FullscreenResult = FullscreenResultCodec.decode(
        request(
            device,
            "/browser/tabs/${tab.tabId}/fullscreen",
            method = "POST",
            body = JSONObject().put("browser", tab.browser),
        ),
    )

    suspend fun inputScroll(device: Device, dx: Int, dy: Int) = unit(
        device,
        "/input/scroll",
        body = JSONObject().put("dx", dx.coerceIn(-4000, 4000)).put("dy", dy.coerceIn(-4000, 4000)),
    )

    suspend fun inputKey(device: Device, key: String) = unit(device, "/input/key", body = JSONObject().put("key", key))

    suspend fun windows(device: Device): List<DisplayWindows> {
        val root = JSONObject(request(device, "/windows"))
        return root.optJSONArray("displays").mapObjects { display ->
            DisplayWindows(
                name = display.optString("name"),
                id = display.optInt("id"),
                windows = display.optJSONArray("windows").mapObjects { window ->
                    WindowEntry(
                        id = window.optInt("id"),
                        app = window.optString("app"),
                        bundleId = window.optString("bundle_id"),
                        title = window.optString("title"),
                        active = window.optBoolean("active"),
                    )
                },
            )
        }
    }

    suspend fun apps(device: Device): List<AppEntry> {
        val root = JSONObject(request(device, "/apps"))
        return root.optJSONArray("apps").mapObjects {
            AppEntry(it.optString("name"), it.optString("bundle_id"), it.optBoolean("active"))
        }
    }

    suspend fun focusWindow(device: Device, id: Int) = unit(device, "/windows/$id/focus")
    suspend fun focusApp(device: Device, bundleId: String) = unit(device, "/apps/focus", body = JSONObject().put("bundle_id", bundleId))

    suspend fun audioApps(device: Device): Pair<Boolean, List<AudioApp>> {
        val root = JSONObject(request(device, "/audio/apps"))
        return root.optBoolean("available") to root.optJSONArray("apps").mapObjects {
            AudioApp(it.optString("name"), it.optInt("volume"))
        }
    }

    suspend fun setAppVolume(device: Device, name: String, volume: Int) = unit(
        device,
        "/audio/apps",
        method = "PUT",
        body = JSONObject().put("name", name).put("volume", volume.coerceIn(0, 100)),
    )

    private suspend fun unit(
        device: Device,
        path: String,
        method: String = "POST",
        body: JSONObject? = null,
    ) {
        request(device, path, method, body)
    }

    private suspend fun request(
        device: Device,
        path: String,
        method: String = "GET",
        body: JSONObject? = null,
        authenticated: Boolean = true,
    ): String = withContext(Dispatchers.IO) {
        val connection = (URL("${device.url}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = TIMEOUT_MS
            readTimeout = TIMEOUT_MS
            setRequestProperty("Accept", "application/json")
            if (authenticated) setRequestProperty("Authorization", "Bearer ${device.token}")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            body?.let { payload -> connection.outputStream.use { it.write(payload.toString().toByteArray()) } }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val message = when (status) {
                    401, 403 -> "API token rejected by the Mac"
                    404 -> "This Mac is running an older server"
                    else -> "Mac returned HTTP $status"
                }
                throw ApiException(message, status)
            }
            response
        } catch (error: CancellationException) {
            throw error
        } catch (error: ApiException) {
            throw error
        } catch (error: Exception) {
            throw ApiException(error.message ?: "Could not reach the Mac")
        } finally {
            connection.disconnect()
        }
    }

    private fun encode(value: String): String = java.net.URLEncoder.encode(value, Charsets.UTF_8.name())

    private companion object { const val TIMEOUT_MS = 4_000 }
}
