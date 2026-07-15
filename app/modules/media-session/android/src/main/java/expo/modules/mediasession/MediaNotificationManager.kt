package expo.modules.mediasession

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.media.session.MediaButtonReceiver

/**
 * Single owner of the MediaSessionCompat + MediaStyle notification, shared
 * between [MediaSessionModule] (JS bridge, drives updates) and
 * [MediaNotificationService] (foreground host, routes media-button intents).
 *
 * Notification buttons, hardware media keys, and the Quick Settings /
 * lockscreen transport controls all reach the SAME [MediaSessionCompat.Callback]
 * below, which forwards the action to JS via [actionListener].
 */
object MediaNotificationManager {
  const val CHANNEL_ID = "macremote_media"
  const val NOTIFICATION_ID = 0x6D61 // "ma" — arbitrary non-zero id

  private const val SESSION_TAG = "MacRemoteMediaSession"

  /** Set by the module; receives "playpause" | "next" | "previous". */
  var actionListener: ((String) -> Unit)? = null

  /** Whether the foreground service has been started for the current session. */
  var started: Boolean = false

  private var mediaSession: MediaSessionCompat? = null

  private var title: String = "macremote"
  private var artist: String = ""
  private var appLabel: String = ""
  private var isPlaying: Boolean = false

  fun ensureSession(context: Context): MediaSessionCompat {
    mediaSession?.let { return it }
    val session = MediaSessionCompat(context.applicationContext, SESSION_TAG).apply {
      setFlags(
        MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTON_KEYS or
          MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
      )
      setCallback(object : MediaSessionCompat.Callback() {
        override fun onPlay() = dispatch("playpause")
        override fun onPause() = dispatch("playpause")
        override fun onSkipToNext() = dispatch("next")
        override fun onSkipToPrevious() = dispatch("previous")
      })
    }
    mediaSession = session
    return session
  }

  private fun dispatch(action: String) {
    actionListener?.invoke(action)
  }

  fun update(context: Context, title: String?, artist: String?, appLabel: String?, isPlaying: Boolean) {
    this.title = if (title.isNullOrBlank()) "macremote" else title
    this.artist = artist ?: ""
    this.appLabel = appLabel ?: ""
    this.isPlaying = isPlaying

    val session = ensureSession(context)
    session.isActive = true

    session.setMetadata(
      MediaMetadataCompat.Builder()
        .putString(MediaMetadataCompat.METADATA_KEY_TITLE, this.title)
        .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, this.artist)
        .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, this.title)
        .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, this.artist)
        .build()
    )

    val state = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
    session.setPlaybackState(
      PlaybackStateCompat.Builder()
        .setActions(
          PlaybackStateCompat.ACTION_PLAY_PAUSE or
            PlaybackStateCompat.ACTION_PLAY or
            PlaybackStateCompat.ACTION_PAUSE or
            PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
            PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
        )
        .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, if (isPlaying) 1f else 0f)
        .build()
    )
  }

  fun buildNotification(context: Context): Notification {
    ensureChannel(context)
    val session = ensureSession(context)

    val contentIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
      PendingIntent.getActivity(
        context,
        0,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    val prevAction = NotificationCompat.Action(
      android.R.drawable.ic_media_previous,
      "Previous",
      MediaButtonReceiver.buildMediaButtonPendingIntent(context, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)
    )
    val playPauseAction = NotificationCompat.Action(
      if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
      if (isPlaying) "Pause" else "Play",
      MediaButtonReceiver.buildMediaButtonPendingIntent(context, PlaybackStateCompat.ACTION_PLAY_PAUSE)
    )
    val nextAction = NotificationCompat.Action(
      android.R.drawable.ic_media_next,
      "Next",
      MediaButtonReceiver.buildMediaButtonPendingIntent(context, PlaybackStateCompat.ACTION_SKIP_TO_NEXT)
    )

    val mediaStyle = androidx.media.app.NotificationCompat.MediaStyle()
      .setMediaSession(session.sessionToken)
      .setShowActionsInCompactView(0, 1, 2)

    return NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(if (artist.isNotBlank()) artist else appLabel)
      .setSubText(if (appLabel.isNotBlank()) appLabel else null)
      .setContentIntent(contentIntent)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .addAction(prevAction)
      .addAction(playPauseAction)
      .addAction(nextAction)
      .setStyle(mediaStyle)
      .build()
  }

  fun release(context: Context) {
    started = false
    mediaSession?.let { session ->
      session.isActive = false
      session.release()
    }
    mediaSession = null
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Media controls",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Media controls for the active Mac"
      setShowBadge(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }
    manager.createNotificationChannel(channel)
  }
}
