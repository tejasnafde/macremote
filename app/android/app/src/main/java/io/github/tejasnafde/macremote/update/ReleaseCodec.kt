package io.github.tejasnafde.macremote.update

import org.json.JSONObject

data class LatestRelease(val version: String, val apkUrl: String, val sha256: String? = null)

object ReleaseCodec {
    fun decode(raw: String): LatestRelease? = runCatching {
        val root = JSONObject(raw)
        val version = root.optString("tag_name").removePrefix("v").takeIf { it.isNotBlank() } ?: return null
        val assets = root.optJSONArray("assets") ?: return null
        for (index in 0 until assets.length()) {
            val asset = assets.optJSONObject(index) ?: continue
            if (!asset.optString("name").endsWith(".apk")) continue
            val url = asset.optString("browser_download_url").takeIf { it.startsWith("https://") } ?: continue
            val digest = asset.optString("digest")
                .removePrefix("sha256:")
                .lowercase()
                .takeIf { it.matches(Regex("[0-9a-f]{64}")) }
            return LatestRelease(version, url, digest)
        }
        null
    }.getOrNull()
}
