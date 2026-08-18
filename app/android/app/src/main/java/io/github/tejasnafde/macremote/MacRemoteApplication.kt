package io.github.tejasnafde.macremote

import android.app.Application
import io.github.tejasnafde.macremote.data.DeviceStore
import io.github.tejasnafde.macremote.data.MacRemoteApi
import io.github.tejasnafde.macremote.update.UpdateManager
import io.github.tejasnafde.macremote.widget.reconcileLegacyWidgetProvider

class MacRemoteApplication : Application() {
    lateinit var graph: AppGraph
        private set

    override fun onCreate() {
        super.onCreate()
        graph = AppGraph(DeviceStore(this), MacRemoteApi(), UpdateManager(this))
        reconcileLegacyWidgetProvider(this)
    }
}

data class AppGraph(
    val devices: DeviceStore,
    val api: MacRemoteApi,
    val updates: UpdateManager,
)
