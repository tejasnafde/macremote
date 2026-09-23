"""Bridge to external-display DDC/CI control via the `m1ddc` CLI. Mirrors
hs_bridge.py's shape: subprocess, 5s timeout, serialized through its own lock,
raises DDCError on failure. DDC/CI support varies by monitor and cable, so
every caller must be ready to degrade gracefully rather than treat this as
always-available."""

import re
import subprocess
import threading

from config.settings import settings


class DDCError(Exception):
    """Raised when the m1ddc bridge fails, times out, or can't be invoked."""


_ddc_lock = threading.Lock()

# `m1ddc display list` prints one line per display, e.g.:
#   [1] (null) (37D8832A-2D66-02CA-B9F7-8F30A301B230)
#   [2] LG ULTRAGEAR (13D61039-774A-93BC-0857-D6964E3302DB)
# Name is "(null)" when m1ddc can't read the monitor's name over DDC.
_LIST_LINE_RE = re.compile(r"^\[(\d+)\]\s+(.*?)\s*\(([0-9A-Fa-f-]+)\)\s*$")
_UUID_RE = re.compile(r"^[0-9A-Fa-f]{8}(-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}$")


def run_m1ddc(args: list[str]) -> str:
    """Run `m1ddc <args>` and return its stdout, stripped.

    Raises DDCError on a non-zero exit, a timeout, or if the `m1ddc` binary
    itself can't be launched (not installed, no external display connected,
    or the connected display/cable doesn't support DDC/CI).
    """
    try:
        with _ddc_lock:
            result = subprocess.run(
                [settings.M1DDC_BIN, *args],
                capture_output=True,
                timeout=5,
                text=True,
                check=False,
            )
    except subprocess.TimeoutExpired as exc:
        raise DDCError(f"m1ddc timed out after 5s running: {args!r}") from exc
    except OSError as exc:
        raise DDCError(f"failed to invoke m1ddc ({settings.M1DDC_BIN}): {exc}") from exc

    if result.returncode != 0:
        raise DDCError(
            f"m1ddc exited {result.returncode} for {args!r}: {result.stderr.strip()}"
        )

    return result.stdout.strip()


def parse_display_list(raw: str, builtin_uuids: set[str] | None = None) -> list[dict]:
    """Parse `m1ddc display list` output into [{"index", "name", "label"}].

    `name` is the key Hammerspoon's hs.screen.find() resolves (monitor name, or
    the screen UUID when the monitor sends none); `label` is what the phone shows.

    "(null)" means no EDID name. The built-in panel always reads that way (the
    old "phantom" entry: DDC writes report success but never stick), but so does
    a real monitor behind an adapter that strips the name (2026-09-24). With
    `builtin_uuids` known, only the built-in is dropped; without it, every
    unnamed entry is dropped as before.
    """
    displays = []
    for line in raw.splitlines():
        match = _LIST_LINE_RE.match(line.strip())
        if not match:
            continue
        index, name, uuid = int(match.group(1)), match.group(2).strip(), match.group(3)
        if name and name != "(null)":
            displays.append({"index": index, "name": name, "label": name})
        elif builtin_uuids and uuid.upper() not in builtin_uuids:
            displays.append({"index": index, "name": uuid, "label": "External display"})
    return displays


def builtin_screen_uuids() -> set[str] | None:
    """UUIDs of the Mac's own panel(s), via Hammerspoon. None when unknown
    (Hammerspoon down, or lid closed); callers then hide unnamed displays."""
    from common_helper import lua_snippets as lua
    from common_helper.hs_bridge import HSError, run_hs

    try:
        raw = run_hs(lua.BUILTIN_SCREEN_UUIDS)
    except HSError:
        return None
    uuids = {u.strip().upper() for u in raw.split(",") if _UUID_RE.match(u.strip())}
    return uuids or None
