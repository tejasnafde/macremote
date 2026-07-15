package expo.modules.mediasession

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.ServiceCompat
import androidx.media.session.MediaButtonReceiver

/**
 * Foreground service (type mediaPlayback) that hosts the MediaStyle
 * notification and keeps the React Native JS context warm so notification
 * actions can be handled in JS. It also handles ACTION_MEDIA_BUTTON intents
 * delivered by [MediaButtonReceiver] (notification buttons + hardware keys),
 * routing them into the shared session callback.
 */
class MediaNotificationService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification = MediaNotificationManager.buildNotification(this)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ServiceCompat.startForeground(
        this,
        MediaNotificationManager.NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      )
    } else {
      ServiceCompat.startForeground(this, MediaNotificationManager.NOTIFICATION_ID, notification, 0)
    }

    // No-op unless this is an ACTION_MEDIA_BUTTON intent; then it dispatches
    // the KeyEvent into the session callback.
    MediaButtonReceiver.handleIntent(MediaNotificationManager.ensureSession(this), intent)

    return START_NOT_STICKY
  }

  override fun onDestroy() {
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }
}
