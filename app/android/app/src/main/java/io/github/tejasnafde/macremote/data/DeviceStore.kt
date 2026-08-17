package io.github.tejasnafde.macremote.data

import android.content.Context
import io.github.tejasnafde.macremote.core.UrlNormalizer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.UUID

class DeviceStore(context: Context) {
    private val prefs = context.getSharedPreferences("macremote.native", Context.MODE_PRIVATE)
    private val legacy = LegacyStorageReader(context)
    private val cipher: StringCipher = AndroidStringCipher()
    private val mutex = Mutex()
    private val mutableState = MutableStateFlow(DevicesState())
    val state: StateFlow<DevicesState> = mutableState.asStateFlow()
    private var loaded = false

    suspend fun load(): DevicesState = mutex.withLock {
        if (loaded) return@withLock mutableState.value
        val stored = prefs.getString(DEVICES_KEY, null)?.let { raw ->
            runCatching { DeviceCodec.decode(raw, cipher) }.getOrNull()
        }
        val migrated = stored ?: LegacyMigration.decode(
            devicesJson = legacy.read("macremote:devices"),
            legacyUrl = legacy.read("macremote:serverUrl"),
            legacyToken = legacy.read("macremote:token"),
        )
        mutableState.value = migrated ?: DevicesState()
        if (stored == null && migrated != null) persist(migrated)
        migratePreferences()
        loaded = true
        mutableState.value
    }

    suspend fun add(name: String, url: String, token: String): Device = mutate { current ->
        val normalized = UrlNormalizer.normalize(url)
        require(UrlNormalizer.isValid(normalized)) { "Enter a valid Mac address" }
        require(token.trim().isNotEmpty()) { "Enter the API token" }
        val device = Device(
            id = "dev_${UUID.randomUUID()}",
            name = name.trim().ifBlank { UrlNormalizer.hostname(normalized) },
            url = normalized,
            token = token.trim(),
        )
        DevicesState(current.devices + device, device.id) to device
    }

    suspend fun update(id: String, name: String, url: String, token: String): Device = mutate { current ->
        val normalized = UrlNormalizer.normalize(url)
        require(UrlNormalizer.isValid(normalized)) { "Enter a valid Mac address" }
        require(token.trim().isNotEmpty()) { "Enter the API token" }
        val updated = Device(id, name.trim().ifBlank { UrlNormalizer.hostname(normalized) }, normalized, token.trim())
        DevicesState(current.devices.map { if (it.id == id) updated else it }, current.activeId) to updated
    }

    suspend fun activate(id: String) = mutateUnit { current ->
        if (current.devices.none { it.id == id }) current else current.copy(activeId = id)
    }

    suspend fun remove(id: String) = mutateUnit { current ->
        val remaining = current.devices.filterNot { it.id == id }
        val active = current.activeId.takeIf { activeId -> remaining.any { it.id == activeId } } ?: remaining.firstOrNull()?.id
        DevicesState(remaining, active)
    }

    fun mediaNotificationEnabled(): Boolean = prefs.getBoolean(MEDIA_NOTIFICATION_KEY, false)
    fun setMediaNotificationEnabled(enabled: Boolean) = prefs.edit().putBoolean(MEDIA_NOTIFICATION_KEY, enabled).apply()
    fun readingMode(): String = prefs.getString(READING_MODE_KEY, "arrows") ?: "arrows"
    fun setReadingMode(mode: String) = prefs.edit().putString(READING_MODE_KEY, mode).apply()

    fun brightnessTarget(deviceId: String): String? = prefs.getString("brightness.$deviceId", null)
    fun setBrightnessTarget(deviceId: String, displayId: String) = prefs.edit().putString("brightness.$deviceId", displayId).apply()

    private suspend fun <T> mutate(block: (DevicesState) -> Pair<DevicesState, T>): T = mutex.withLock {
        if (!loaded) error("DeviceStore.load() must run first")
        val (next, result) = block(mutableState.value)
        persist(next)
        mutableState.value = next
        result
    }

    private suspend fun mutateUnit(block: (DevicesState) -> DevicesState) = mutex.withLock {
        if (!loaded) error("DeviceStore.load() must run first")
        val next = block(mutableState.value)
        persist(next)
        mutableState.value = next
    }

    private fun persist(state: DevicesState) {
        prefs.edit().putString(DEVICES_KEY, DeviceCodec.encode(state, cipher)).commit()
    }

    private fun migratePreferences() {
        if (!prefs.contains(MEDIA_NOTIFICATION_KEY)) {
            prefs.edit().putBoolean(MEDIA_NOTIFICATION_KEY, legacy.read("macremote:mediaNotificationEnabled") == "true").apply()
        }
        if (!prefs.contains(READING_MODE_KEY)) {
            prefs.edit().putString(READING_MODE_KEY, legacy.read("macremote:readingPageMode") ?: "arrows").apply()
        }
        val brightness = legacy.read("macremote:brightnessTarget") ?: return
        runCatching {
            val root = org.json.JSONObject(brightness)
            val edit = prefs.edit()
            root.keys().forEach { id -> edit.putString("brightness.$id", root.optString(id)) }
            edit.apply()
        }
    }

    private companion object {
        const val DEVICES_KEY = "devices.v1"
        const val MEDIA_NOTIFICATION_KEY = "mediaNotificationEnabled"
        const val READING_MODE_KEY = "readingPageMode"
    }
}
