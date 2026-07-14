"""Bridge to Hammerspoon via the `hs` IPC CLI. The Mac-side `macremote.lua`
module (see hammerspoon/) is what actually presses keys / reads state; this
module just shells out and returns whatever the Lua expression prints."""

import subprocess

from config.settings import settings


class HSError(Exception):
    """Raised when the Hammerspoon bridge fails, times out, or can't be invoked."""


def run_hs(lua: str) -> str:
    """Run a Lua snippet through `hs -c <lua>` and return its stdout, stripped.

    Raises HSError on a non-zero exit, a timeout, or if the `hs` binary itself
    can't be launched (e.g. Hammerspoon isn't running / IPC CLI not installed).
    """
    try:
        result = subprocess.run(
            [settings.HS_BIN, "-c", lua],
            capture_output=True,
            timeout=5,
            text=True,
        )
    except subprocess.TimeoutExpired as exc:
        raise HSError(f"hs timed out after 5s running: {lua!r}") from exc
    except OSError as exc:
        raise HSError(f"failed to invoke hs ({settings.HS_BIN}): {exc}") from exc

    if result.returncode != 0:
        raise HSError(
            f"hs exited {result.returncode} for {lua!r}: {result.stderr.strip()}"
        )

    return result.stdout.strip()
