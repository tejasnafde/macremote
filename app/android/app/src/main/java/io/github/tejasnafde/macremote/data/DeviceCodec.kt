package io.github.tejasnafde.macremote.data

import org.json.JSONArray
import org.json.JSONObject

interface StringCipher {
    fun encrypt(value: String): String
    fun decrypt(value: String): String
}

object DeviceCodec {
    fun encode(state: DevicesState, cipher: StringCipher): String = JSONObject().apply {
        put("activeId", state.activeId)
        put("devices", JSONArray().apply {
            state.devices.forEach { device ->
                put(JSONObject().apply {
                    put("id", device.id)
                    put("name", device.name)
                    put("url", device.url)
                    put("tokenCiphertext", cipher.encrypt(device.token))
                })
            }
        })
    }.toString()

    fun decode(raw: String, cipher: StringCipher): DevicesState {
        val root = JSONObject(raw)
        val devices = root.optJSONArray("devices").mapObjects { item ->
            Device(
                id = item.getString("id"),
                name = item.getString("name"),
                url = item.getString("url"),
                token = cipher.decrypt(item.getString("tokenCiphertext")),
            )
        }
        val activeId = root.nullableString("activeId")?.takeIf { id -> devices.any { it.id == id } }
            ?: devices.firstOrNull()?.id
        return DevicesState(devices, activeId)
    }
}
