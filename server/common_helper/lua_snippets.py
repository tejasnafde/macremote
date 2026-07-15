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


def media_seek(delta_seconds: int) -> str:
    """Seek by delta_seconds. Exact for Spotify and Apple Music; for anything
    else falls back to arrow-key presses on the frontmost app (YouTube steps
    5s per press, so |delta| >= 10 sends two presses)."""
    d = int(delta_seconds)
    key = "right" if d > 0 else "left"
    presses = 1 if abs(d) < 10 else 2
    # Gate on hs.application.get (does NOT launch) instead of isRunning() /
    # tell application, which LaunchServices would start if the app is closed.
    return (
        f"local d = {d}; "
        "if hs.application.get('com.spotify.client') then "
        "local st = hs.spotify.getPlaybackState(); "
        "if st == hs.spotify.state_playing or st == hs.spotify.state_paused then "
        "hs.spotify.setPosition(math.max(0, hs.spotify.getPosition() + d)); return 'spotify' end end; "
        "if hs.application.get('com.apple.Music') then "
        "local ok = hs.osascript.applescript("
        "'tell application \"Music\" to set player position to (player position + ' .. d .. ')'); "
        "if ok then return 'music' end end; "
        f"for i = 1, {presses} do hs.eventtap.keyStroke({{}}, '{key}', 0) end; "
        "return 'keys'"
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


def brightness_set(level: int) -> str:
    return f"hs.brightness.set(math.max(0, math.min(100, {level})))"


# Safe brightness read for GET /displays: some Macs (desktops with no panel)
# have no built-in brightness API and hs.brightness.get() returns nil, which
# should surface as brightness: null rather than a bad request.
BRIGHTNESS_GET = (
    "local b = hs.brightness.get(); "
    "if b then return tostring(math.floor(b + 0.5)) else return 'null' end"
)


# ── System ─────────────────────────────────────────────────────────────────────

LOCK = "hs.caffeinate.lockScreen()"
SLEEP = "hs.caffeinate.systemSleep()"

# Blackout: volume to 0 and built-in brightness to 0 (external displays are
# handled by the caller via m1ddc). The Mac stays awake.
BLACKOUT = (
    "local d = hs.audiodevice.defaultOutputDevice(); "
    "if d then d:setOutputVolume(0) end; "
    "if hs.brightness.get() then hs.brightness.set(0) end"
)

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


# ── Focus an app by bundle id ────────────────────────────────────────────────
# Raises the app to the foreground on whichever Space/display its window is on.
# Used when the phone focuses a browser tab: the extension switches the tab, but
# only the Mac can bring the backgrounded browser app itself to the front.
def focus_app(bundle_id: str) -> str:
    safe = bundle_id.replace('"', '')
    return f'hs.application.launchOrFocusByBundleID("{safe}")'
