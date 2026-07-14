"""Lua snippets sent to Hammerspoon via `hs -c`. The Mac-side `macremote.lua`
(hammerspoon/, built in P2) provides the `macremote` global used below (currently
just `macremote.nowPlaying()`); everything else calls stock `hs.*` APIs directly.
"""

# ── Media keys ────────────────────────────────────────────────────────────────
# hs.eventtap.event.newSystemKeyEvent(key, isDown):post() - press then release.

MEDIA_PLAYPAUSE = (
    'hs.eventtap.event.newSystemKeyEvent("PLAY", true):post(); '
    'hs.eventtap.event.newSystemKeyEvent("PLAY", false):post()'
)

MEDIA_NEXT = (
    'hs.eventtap.event.newSystemKeyEvent("FAST", true):post(); '
    'hs.eventtap.event.newSystemKeyEvent("FAST", false):post()'
)

MEDIA_PREVIOUS = (
    'hs.eventtap.event.newSystemKeyEvent("REWIND", true):post(); '
    'hs.eventtap.event.newSystemKeyEvent("REWIND", false):post()'
)


# ── Volume ─────────────────────────────────────────────────────────────────────
# hs.audiodevice.defaultOutputDevice() controls the absolute output volume (0-100).

def volume_up(step: int) -> str:
    return (
        "local d = hs.audiodevice.defaultOutputDevice(); "
        f"d:setOutputVolume(math.min(100, d:outputVolume() + {step}))"
    )


def volume_down(step: int) -> str:
    return (
        "local d = hs.audiodevice.defaultOutputDevice(); "
        f"d:setOutputVolume(math.max(0, d:outputVolume() - {step}))"
    )


def volume_set(level: int) -> str:
    return (
        "local d = hs.audiodevice.defaultOutputDevice(); "
        f"d:setOutputVolume(math.max(0, math.min(100, {level})))"
    )


VOLUME_MUTE_TOGGLE = (
    "local d = hs.audiodevice.defaultOutputDevice(); d:setMuted(not d:muted())"
)

VOLUME_GET = (
    "local d = hs.audiodevice.defaultOutputDevice(); "
    "return tostring(math.floor((d:outputVolume() or 0) + 0.5))"
)


# ── Brightness ─────────────────────────────────────────────────────────────────
# hs.brightness.get()/set() operate on 0-100.

def brightness_up(step: int) -> str:
    return f"hs.brightness.set(math.min(100, hs.brightness.get() + {step}))"


def brightness_down(step: int) -> str:
    return f"hs.brightness.set(math.max(0, hs.brightness.get() - {step}))"


# ── System ─────────────────────────────────────────────────────────────────────

LOCK = "hs.caffeinate.lockScreen()"
SLEEP = "hs.caffeinate.systemSleep()"

# Park the pointer in the bottom-right corner of the main screen. The movement
# re-arms video players' cursor auto-hide (fixes the stuck cursor after
# app-switching back into a fullscreen video) and leaves the pointer out of
# the way in the meantime.
CURSOR_BANISH = (
    "local f = hs.screen.mainScreen():fullFrame(); "
    "hs.mouse.absolutePosition({x = f.x + f.w - 2, y = f.y + f.h - 2})"
)


# ── Status ─────────────────────────────────────────────────────────────────────
# A single Lua expression returning a JSON string (hs.json.encode) with volume,
# muted, brightness, battery, and now-playing (may be null).

STATUS = (
    "local d = hs.audiodevice.defaultOutputDevice(); "
    "return hs.json.encode({"
    "volume = d:outputVolume(), "
    "muted = d:muted(), "
    "brightness = hs.brightness.get(), "
    "battery = hs.battery.percentage(), "
    "nowplaying = macremote.nowPlaying()"
    "})"
)
