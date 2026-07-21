"""Bridge to the Background Music virtual audio driver via its AppleScript
API (osascript). Feature-detected: Background Music may not be installed at
all (it needs an admin-password install, a user step), or installed but not
running - every probe here degrades to "unavailable" instead of raising, so
callers can answer honestly without a 5xx.

Mirrors the other bridges' shape: subprocess, 5s timeout, serialized through
its own lock. The detection call goes through System Events on purpose:
`tell application "Background Music"` would LAUNCH the app via LaunchServices
if it were installed but stopped, which a status probe must never do."""

import subprocess
import threading

from config.settings import settings

_osascript_lock = threading.Lock()

_PROCESS_EXISTS = (
    'tell application "System Events" to exists application process "Background Music"'
)

# One line per app: name<TAB>volume. A custom delimiter instead of AppleScript
# list coercion because app names can contain commas.
_LIST_APPS = (
    'tell application "Background Music"\n'
    'set out to ""\n'
    "repeat with a in audio apps\n"
    'set out to out & (name of a) & tab & (volume of a) & linefeed\n'
    "end repeat\n"
    "return out\n"
    "end tell"
)


def _run_osascript(script: str) -> str | None:
    """Run an AppleScript via osascript and return stripped stdout, or None on
    any failure (non-zero exit, timeout, missing binary). Never raises."""
    try:
        with _osascript_lock:
            result = subprocess.run(
                [settings.OSASCRIPT_BIN, "-e", script],
                capture_output=True,
                timeout=5,
                text=True,
            )
    except (subprocess.TimeoutExpired, OSError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def is_running() -> bool:
    """True when the Background Music app process is up (implies installed)."""
    return _run_osascript(_PROCESS_EXISTS) == "true"


def list_audio_apps() -> list[dict] | None:
    """[{"name": str, "volume": int 0-100}] per audio app BGM knows about, or
    None when BGM is unavailable / the script fails."""
    out = _run_osascript(_LIST_APPS)
    if out is None:
        return None
    apps = []
    for line in out.splitlines():
        name, sep, volume = line.rpartition("\t")
        if not sep or not name:
            continue
        try:
            level = int(float(volume))
        except ValueError:
            continue
        apps.append({"name": name, "volume": max(0, min(100, level))})
    return apps


def set_app_volume(name: str, volume: int) -> bool:
    """Set one audio app's BGM volume (0-100). False when unavailable."""
    safe = name.replace("\\", "").replace('"', "")
    script = (
        'tell application "Background Music" to set volume of '
        f'(first audio app whose name is "{safe}") to {int(volume)}'
    )
    return _run_osascript(script) is not None
