package io.github.tejasnafde.macremote.update

data class UpdatePresentation(
    val checkLabel: String,
    val checkEnabled: Boolean,
    val installLabel: String?,
    val installEnabled: Boolean,
) {
    companion object {
        fun create(checking: Boolean, release: LatestRelease?, progress: Int?): UpdatePresentation {
            val installLabel = when {
                release == null -> null
                progress != null -> "Downloading $progress%"
                else -> "macremote ${release.version} is ready"
            }
            return UpdatePresentation(
                checkLabel = if (checking) "Checking for update…" else "Check for app update",
                checkEnabled = !checking && progress == null,
                installLabel = installLabel,
                installEnabled = release != null && progress == null,
            )
        }
    }
}
