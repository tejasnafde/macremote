package io.github.tejasnafde.macremote.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import io.github.tejasnafde.macremote.MacRemoteApplication
import io.github.tejasnafde.macremote.MainActivity
import io.github.tejasnafde.macremote.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

open class RemoteWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { id -> manager.updateAppWidget(id, views(context)) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val command = WidgetCommand.fromAction(intent.action) ?: return
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val graph = (context.applicationContext as MacRemoteApplication).graph
                val device = graph.devices.load().activeDevice
                WidgetCommandExecutor.execute(
                    device,
                    command,
                    openSetup = {
                        context.startActivity(
                            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                        )
                    },
                ) { target, action ->
                    when (action) {
                        WidgetCommand.Previous -> graph.api.previous(target)
                        WidgetCommand.PlayPause -> graph.api.playPause(target)
                        WidgetCommand.Next -> graph.api.next(target)
                        WidgetCommand.VolumeDown -> graph.api.volumeDown(target)
                        WidgetCommand.VolumeUp -> graph.api.volumeUp(target)
                    }
                }
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                // Loading migrated state can fail too; keep the host process alive.
            } finally {
                pending.finish()
            }
        }
    }

    private fun views(context: Context): RemoteViews = RemoteViews(context.packageName, R.layout.macremote_widget).apply {
        bind(context, R.id.widget_previous, WidgetCommand.Previous)
        bind(context, R.id.widget_play, WidgetCommand.PlayPause)
        bind(context, R.id.widget_next, WidgetCommand.Next)
        bind(context, R.id.widget_volume_down, WidgetCommand.VolumeDown)
        bind(context, R.id.widget_volume_up, WidgetCommand.VolumeUp)
    }

    private fun RemoteViews.bind(context: Context, viewId: Int, command: WidgetCommand) {
        val intent = Intent(context, RemoteWidget::class.java).setAction(command.action)
        val pending = PendingIntent.getBroadcast(
            context,
            command.ordinal + 1,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        setOnClickPendingIntent(viewId, pending)
    }
}

/** Compatibility provider for widgets created by the v0.5.0 native preview. */
class MacRemoteWidget : RemoteWidget()
