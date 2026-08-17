package io.github.tejasnafde.macremote.media

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.IBinder
import io.github.tejasnafde.macremote.MacRemoteApplication
import io.github.tejasnafde.macremote.MainActivity
import io.github.tejasnafde.macremote.R
import io.github.tejasnafde.macremote.data.Device
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class MediaControlService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var session: MediaSession
    private var device: Device? = null
    private val playbackGate = AbsolutePlaybackGate()
    private var pollJob: Job? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
        session = MediaSession(this, "macremote").apply {
            setCallback(object : MediaSession.Callback() {
                override fun onPlay() = requestAbsolutePlayback(true)
                override fun onPause() = requestAbsolutePlayback(false)
                override fun onSkipToNext() = withDevice { graph().api.next(it) }
                override fun onSkipToPrevious() = withDevice { graph().api.previous(it) }
            })
            isActive = true
        }
        startForeground(NOTIFICATION_ID, notification())
        pollJob = scope.launch { pollStatus() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { stopSelf(); return START_NOT_STICKY }
            ACTION_PLAY -> requestAbsolutePlayback(true)
            ACTION_PAUSE -> requestAbsolutePlayback(false)
            ACTION_NEXT -> withDevice { graph().api.next(it) }
            ACTION_PREVIOUS -> withDevice { graph().api.previous(it) }
        }
        return START_STICKY
    }

    private suspend fun pollStatus() {
        while (scope.isActive) {
            val active = runCatching { graph().devices.load().activeDevice }.getOrNull()
            device = active
            active?.let { target ->
                runCatching { graph().api.status(target) }.onSuccess { status ->
                    playbackGate.observe(status.browserTabs.any { it.playing } || status.nowPlaying?.isPlaying == true)
                    val playback = if (playbackGate.current == true) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED
                    session.setPlaybackState(
                        PlaybackState.Builder()
                            .setActions(
                                PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or
                                    PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS,
                            )
                            .setState(playback, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f)
                            .build(),
                    )
                    session.setMetadata(
                        MediaMetadata.Builder()
                            .putString(MediaMetadata.METADATA_KEY_TITLE, status.nowPlaying?.title ?: target.name)
                            .putString(MediaMetadata.METADATA_KEY_ARTIST, status.nowPlaying?.artist ?: "macremote")
                            .build(),
                    )
                    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification())
                }
            }
            delay(5_000)
        }
    }

    private fun requestAbsolutePlayback(shouldPlay: Boolean) {
        val target = device ?: return
        val transition = playbackGate.begin(shouldPlay) ?: return
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification())
        scope.launch {
            runCatching { graph().api.playPause(target) }
                .onFailure {
                    playbackGate.failed(transition)
                    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification())
                }
        }
    }

    private fun withDevice(block: suspend (Device) -> Unit) {
        val target = device ?: return
        scope.launch { runCatching { block(target) } }
    }

    private fun graph() = (application as MacRemoteApplication).graph

    private fun notification(): Notification {
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val previous = serviceIntent(ACTION_PREVIOUS, 1)
        val toggle = serviceIntent(if (playbackGate.current == true) ACTION_PAUSE else ACTION_PLAY, 2)
        val next = serviceIntent(ACTION_NEXT, 3)
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            Notification.Builder(this)
        }
        return builder
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("macremote")
            .setContentText(device?.name ?: "Mac controls")
            .setContentIntent(open)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(android.R.drawable.ic_media_previous, "Previous", previous).build())
            .addAction(Notification.Action.Builder(if (playbackGate.current == true) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play, "Play or pause", toggle).build())
            .addAction(Notification.Action.Builder(android.R.drawable.ic_media_next, "Next", next).build())
            .setStyle(Notification.MediaStyle().setMediaSession(session.sessionToken).setShowActionsInCompactView(0, 1, 2))
            .build()
    }

    private fun serviceIntent(action: String, request: Int): PendingIntent = PendingIntent.getService(
        this,
        request,
        Intent(this, MediaControlService::class.java).setAction(action),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Mac media controls", NotificationManager.IMPORTANCE_LOW),
        )
    }

    override fun onDestroy() {
        pollJob?.cancel()
        session.isActive = false
        session.release()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val CHANNEL_ID = "macremote_media"
        private const val NOTIFICATION_ID = 6401
        private const val ACTION_STOP = "io.github.tejasnafde.macremote.media.STOP"
        private const val ACTION_PLAY = "io.github.tejasnafde.macremote.media.PLAY"
        private const val ACTION_PAUSE = "io.github.tejasnafde.macremote.media.PAUSE"
        private const val ACTION_NEXT = "io.github.tejasnafde.macremote.media.NEXT"
        private const val ACTION_PREVIOUS = "io.github.tejasnafde.macremote.media.PREVIOUS"

        fun setEnabled(context: Context, enabled: Boolean) {
            val intent = Intent(context, MediaControlService::class.java)
            if (!enabled) {
                context.stopService(intent)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}
