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

# Built-in brightness via the hardware brightness KEYS, not hs.brightness.set/
# get, which is slow and frequently times out (5s) on Apple Silicon. Key events
# are instant and never hang. Each press = one OS brightness step; hold-repeat
# gives range. (step arg kept for signature symmetry with the external path.)
BRIGHTNESS_KEY_UP = (
    'hs.eventtap.event.newSystemKeyEvent("BRIGHTNESS_UP", true):post(); '
    'hs.eventtap.event.newSystemKeyEvent("BRIGHTNESS_UP", false):post()'
)
BRIGHTNESS_KEY_DOWN = (
    'hs.eventtap.event.newSystemKeyEvent("BRIGHTNESS_DOWN", true):post(); '
    'hs.eventtap.event.newSystemKeyEvent("BRIGHTNESS_DOWN", false):post()'
)


def brightness_up(step: int) -> str:
    return BRIGHTNESS_KEY_UP


def brightness_down(step: int) -> str:
    return BRIGHTNESS_KEY_DOWN


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


# ── Generic input (reading mode: scroll + page-turn keys) ────────────────────
# Drives whatever app is frontmost, so one surface covers browser manga/novels
# and Readest. Scroll uses pixel units for smooth 1:1 finger tracking.
def scroll_event(dx: int, dy: int) -> str:
    return f'hs.eventtap.event.newScrollEvent({{{int(dx)}, {int(dy)}}}, {{}}, "pixel"):post()'


# Keys allowed for page turns / navigation (allowlisted in the handler).
KEY_STROKES = ("left", "right", "up", "down", "pageup", "pagedown", "space", "home", "end")


def key_press(key: str) -> str:
    return f'hs.eventtap.keyStroke({{}}, "{key}", 0)'


# ── Focus an app by bundle id ────────────────────────────────────────────────
# Raises the app to the foreground on whichever Space/display its window is on.
# Used when the phone focuses a browser tab: the extension switches the tab, but
# only the Mac can bring the backgrounded browser app itself to the front.
def focus_app(bundle_id: str) -> str:
    safe = bundle_id.replace('"', '')
    return f'hs.application.launchOrFocusByBundleID("{safe}")'


# ── Window-grouped switcher ──────────────────────────────────────────────────
# List standard windows as JSON [{id, app, bundle_id, title, screen, screen_id,
# active}]. isStandard() filters palettes/panels/hidden scratch windows; the
# application gate drops windows whose owning app has already quit.
LIST_WINDOWS = (
    "local out = {}; "
    "local focused = hs.window.focusedWindow(); "
    "for _, w in ipairs(hs.window.allWindows()) do "
    "  local app = w:application(); "
    "  if w:isStandard() and app then "
    "    local scr = w:screen(); "
    "    table.insert(out, {"
    "      id = w:id(), "
    "      app = app:name(), "
    "      bundle_id = app:bundleID(), "
    "      title = w:title() or '', "
    "      screen = scr and scr:name() or '', "
    "      screen_id = scr and scr:id() or 0, "
    "      active = (w == focused)"
    "    }) "
    "  end "
    "end; "
    "return hs.json.encode(out)"
)


# Focus one window by hs id. Nil-safe: the window may have closed between the
# phone's list refresh and the tap, which is a "gone", not a server error.
def focus_window(window_id: int) -> str:
    return (
        f"local w = hs.window.get({int(window_id)}); "
        "if w then w:focus(); return 'ok' else return 'gone' end"
    )


# ── Gamma dimming (external-display fallback when DDC/CI is unavailable) ─────
# Framebuffer dimming via hs.screen:setGamma(whitepoint, blackpoint) - works
# over any cable (verified live on real external hardware), but the backlight
# stays on. level is 0-100 where 100 = no dimming.
def gamma_set(screen_name: str, level: int) -> str:
    safe = screen_name.replace("\\", "").replace('"', "")
    return (
        f'local s = hs.screen.find("{safe}"); '
        f"if s then local l = {int(level)}/100; "
        "s:setGamma({red=l, green=l, blue=l}, {red=0, green=0, blue=0}) end"
    )


# List running, visible (dock-worthy) apps as JSON [{name, bundle_id, active}].
# Filters to regular apps with a bundle id, so background daemons and agents
# (including macremote/Hammerspoon itself) do not clutter the switcher.
LIST_APPS = (
    "local out = {}; "
    "for _, app in ipairs(hs.application.runningApplications()) do "
    "  local bid = app:bundleID(); "
    "  if bid and app:kind() == 1 then "
    "    table.insert(out, {name = app:name(), bundle_id = bid, active = app:isFrontmost()}) "
    "  end "
    "end; "
    "return hs.json.encode(out)"
)
