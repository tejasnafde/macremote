package io.github.tejasnafde.macremote.widget

import io.github.tejasnafde.macremote.data.Device
import kotlinx.coroutines.CancellationException

object WidgetCommandExecutor {
    suspend fun execute(
        device: Device?,
        command: WidgetCommand,
        openSetup: () -> Unit,
        send: suspend (Device, WidgetCommand) -> Unit,
    ) {
        if (device == null) {
            openSetup()
            return
        }
        try {
            send(device, command)
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            // A home-screen widget has no error surface; failed remote taps are no-ops.
        }
    }
}
