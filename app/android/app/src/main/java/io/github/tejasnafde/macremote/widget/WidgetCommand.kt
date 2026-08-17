package io.github.tejasnafde.macremote.widget

enum class WidgetCommand(val action: String) {
    Previous("io.github.tejasnafde.macremote.widget.PREVIOUS"),
    PlayPause("io.github.tejasnafde.macremote.widget.PLAY_PAUSE"),
    Next("io.github.tejasnafde.macremote.widget.NEXT"),
    VolumeDown("io.github.tejasnafde.macremote.widget.VOLUME_DOWN"),
    VolumeUp("io.github.tejasnafde.macremote.widget.VOLUME_UP");

    companion object {
        fun fromAction(action: String?): WidgetCommand? = entries.firstOrNull { it.action == action }
    }
}
