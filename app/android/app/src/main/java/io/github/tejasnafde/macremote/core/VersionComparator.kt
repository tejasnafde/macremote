package io.github.tejasnafde.macremote.core

object VersionComparator {
    fun isNewer(candidate: String, current: String): Boolean {
        val a = parse(candidate) ?: return false
        val b = parse(current) ?: return false
        for (index in 0 until maxOf(a.size, b.size)) {
            val difference = (a.getOrElse(index) { 0 }) - (b.getOrElse(index) { 0 })
            if (difference != 0) return difference > 0
        }
        return false
    }

    private fun parse(value: String): List<Int>? {
        val clean = value.trim().removePrefix("v")
        if (!clean.matches(Regex("\\d+(?:\\.\\d+)*"))) return null
        return clean.split('.').map { it.toIntOrNull() ?: return null }
    }
}
