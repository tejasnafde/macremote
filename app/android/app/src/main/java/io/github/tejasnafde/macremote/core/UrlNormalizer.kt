package io.github.tejasnafde.macremote.core

import java.net.URI

object UrlNormalizer {
    fun normalize(input: String): String {
        val trimmed = input.trim()
            .replace(Regex("^(https?):/+", RegexOption.IGNORE_CASE), "$1://")
            .trimEnd('/')
        return if (trimmed.matches(Regex("^https?://.*", RegexOption.IGNORE_CASE))) {
            trimmed
        } else {
            "http://$trimmed"
        }
    }

    fun isValid(input: String): Boolean = runCatching {
        val uri = URI(normalize(input))
        val host = uri.host?.lowercase().orEmpty()
        uri.scheme in setOf("http", "https") && host.isNotBlank() && host !in setOf("http", "https")
    }.getOrDefault(false)

    fun hostname(input: String): String = runCatching {
        URI(normalize(input)).host?.takeIf { it.isNotBlank() }
    }.getOrNull() ?: "My Mac"
}
