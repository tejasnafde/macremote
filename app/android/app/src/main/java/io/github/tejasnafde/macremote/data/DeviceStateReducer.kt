package io.github.tejasnafde.macremote.data

object DeviceStateReducer {
    fun replaceAndActivate(current: DevicesState, updated: Device): DevicesState = DevicesState(
        devices = current.devices.map { if (it.id == updated.id) updated else it },
        activeId = updated.id,
    )
}
