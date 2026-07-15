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
_LIST_LINE_RE = re.compile(r"^\[(\d+)\]\s+(.*?)\s*\([0-9A-Fa-f-]+\)\s*$")


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


def parse_display_list(raw: str) -> list[dict]:
    """Parse `m1ddc display list` output into [{"index": int, "name": str}].

    Liberal on purpose: silently skips lines that don't match the expected
    shape instead of raising, and falls back to "Display N" when m1ddc can't
    read a monitor's name (printed as "(null)").
    """
    displays = []
    for line in raw.splitlines():
        match = _LIST_LINE_RE.match(line.strip())
        if not match:
            continue
        index = int(match.group(1))
        name = match.group(2).strip()
        # "(null)" is m1ddc's phantom entry: DDC writes report success but never
        # stick (verified on real hardware), so it is not a controllable display.
        if not name or name == "(null)":
            continue
        displays.append({"index": index, "name": name})
    return displays
