package expo.modules.mediasession

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class MediaMeta : Record {
  @Field val title: String? = null

  @Field val artist: String? = null

  @Field val app: String? = null

  @Field val isPlaying: Boolean = false
}

class MediaSessionModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val mainHandler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("MacRemoteMediaSession")

    Events("onMediaAction")

    OnCreate {
      MediaNotificationManager.actionListener = { action ->
        sendEvent("onMediaAction", mapOf("action" to action))
      }
    }

    OnDestroy {
      MediaNotificationManager.actionListener = null
    }

    Function("startOrUpdate") { meta: MediaMeta ->
      val ctx = context.applicationContext
      mainHandler.post {
        MediaNotificationManager.update(ctx, meta.title, meta.artist, meta.app, meta.isPlaying)
        if (!MediaNotificationManager.started) {
          MediaNotificationManager.started = true
          ContextCompat.startForegroundService(ctx, Intent(ctx, MediaNotificationService::class.java))
        } else {
          val notification = MediaNotificationManager.buildNotification(ctx)
          NotificationManagerCompat.from(ctx).notify(MediaNotificationManager.NOTIFICATION_ID, notification)
        }
      }
    }

    Function("stop") {
      val ctx = context.applicationContext
      mainHandler.post {
        ctx.stopService(Intent(ctx, MediaNotificationService::class.java))
        MediaNotificationManager.release(ctx)
      }
    }
  }
}
