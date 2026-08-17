package io.github.tejasnafde.macremote.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import io.github.tejasnafde.macremote.BuildConfig
import io.github.tejasnafde.macremote.core.VersionComparator
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

class UpdateManager(private val context: Context) {
    suspend fun check(): LatestRelease? = withContext(Dispatchers.IO) {
        val connection = (URL(RELEASES_URL).openConnection() as HttpURLConnection).apply {
            connectTimeout = 8_000
            readTimeout = 8_000
            setRequestProperty("Accept", "application/vnd.github+json")
            setRequestProperty("User-Agent", "macremote-android/${BuildConfig.VERSION_NAME}")
        }
        try {
            if (connection.responseCode !in 200..299) error("Update check returned HTTP ${connection.responseCode}")
            val release = connection.inputStream.bufferedReader().use { ReleaseCodec.decode(it.readText()) }
                ?: error("Latest release did not contain a valid APK")
            release.takeIf { VersionComparator.isNewer(it.version, BuildConfig.VERSION_NAME) }
        } finally {
            connection.disconnect()
        }
    }

    suspend fun downloadAndInstall(release: LatestRelease, onProgress: (Int) -> Unit) = withContext(Dispatchers.IO) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
            context.startActivity(
                Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${context.packageName}"),
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            error("Allow installs from macremote, then tap the update again")
        }
        val destination = File(context.cacheDir, "macremote-update-${release.version}.apk")
        val connection = (URL(release.apkUrl).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 30_000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "macremote-android/${BuildConfig.VERSION_NAME}")
        }
        try {
            if (connection.responseCode !in 200..299) error("Update download returned HTTP ${connection.responseCode}")
            val total = connection.contentLengthLong
            val digest = MessageDigest.getInstance("SHA-256")
            connection.inputStream.use { input ->
                destination.outputStream().use { output ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    var written = 0L
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        output.write(buffer, 0, count)
                        digest.update(buffer, 0, count)
                        written += count
                        if (total > 0) onProgress(((written * 100) / total).toInt().coerceIn(0, 100))
                    }
                }
            }
            val actual = digest.digest().joinToString("") { "%02x".format(it) }
            if (release.sha256 != null && actual != release.sha256) {
                destination.delete()
                error("Downloaded update failed its SHA-256 integrity check")
            }
        } finally {
            connection.disconnect()
        }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", destination)
        val install = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(install)
    }

    private companion object {
        const val RELEASES_URL = "https://api.github.com/repos/tejasnafde/macremote/releases/latest"
    }
}
