package io.github.tejasnafde.macremote.data

data class Device(
    val id: String,
    val name: String,
    val url: String,
    val token: String,
)

data class DevicesState(
    val devices: List<Device> = emptyList(),
    val activeId: String? = null,
) {
    val activeDevice: Device?
        get() = devices.firstOrNull { it.id == activeId } ?: devices.firstOrNull()
}
