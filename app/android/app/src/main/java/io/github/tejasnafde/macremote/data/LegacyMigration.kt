package io.github.tejasnafde.macremote.data

import io.github.tejasnafde.macremote.core.UrlNormalizer
import org.json.JSONObject

object LegacyMigration {
    fun decode(devicesJson: String?, legacyUrl: String?, legacyToken: String?): DevicesState? {
        decodeDevices(devicesJson)?.takeIf { it.devices.isNotEmpty() }?.let { return it }

        val url = legacyUrl?.takeIf { it.isNotBlank() }?.let(UrlNormalizer::normalize) ?: return null
        val token = legacyToken?.trim().orEmpty()
        if (!UrlNormalizer.isValid(url) || token.isBlank()) return null
        val device = Device(
            id = "legacy_${url.hashCode().toUInt().toString(16)}",
            name = UrlNormalizer.hostname(url),
            url = url,
            token = token,
        )
        return DevicesState(listOf(device), device.id)
    }

    fun decodeBrightnessTargets(raw: String?, occupiedDeviceIds: Set<String>): Map<String, String> = runCatching {
        if (raw.isNullOrBlank()) return@runCatching emptyMap()
        val root = JSONObject(raw)
        buildMap {
            root.keys().forEach { id ->
                val target = root.optString(id).trim()
                if (id !in occupiedDeviceIds && target.isNotBlank()) put(id, target)
            }
        }
    }.getOrDefault(emptyMap())

    private fun decodeDevices(raw: String?): DevicesState? = runCatching {
        if (raw.isNullOrBlank()) return@runCatching null
        val root = JSONObject(raw)
        val array = root.optJSONArray("devices") ?: return@runCatching null
        val devices = buildList {
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                val id = item.optString("id").trim()
                val url = UrlNormalizer.normalize(item.optString("url"))
                val token = item.optString("token").trim()
                if (id.isBlank() || token.isBlank() || !UrlNormalizer.isValid(url)) continue
                add(
                    Device(
                        id = id,
                        name = item.optString("name").trim().ifBlank { UrlNormalizer.hostname(url) },
                        url = url,
                        token = token,
                    ),
                )
            }
        }
        val requestedActive = root.optString("activeId").takeIf { it.isNotBlank() }
        val active = requestedActive?.takeIf { id -> devices.any { it.id == id } } ?: devices.firstOrNull()?.id
        DevicesState(devices, active)
    }.getOrNull()
}
