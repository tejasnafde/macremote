"""Bridge to Hammerspoon via the `hs` IPC CLI. The Mac-side `macremote.lua`
module (see hammerspoon/) is what actually presses keys / reads state; this
module just shells out and returns whatever the Lua expression prints."""

import subprocess
import threading

from config.settings import settings


class HSError(Exception):
    """Raised when the Hammerspoon bridge fails, times out, or can't be invoked."""


# Hammerspoon's CFMessagePort IPC is fragile under concurrent CLI connections
# (observed EXC_BREAKPOINT crash in libipc on macOS 26 with HS 1.1.1), so all
# bridge calls are serialized through this lock.
_hs_lock = threading.Lock()


def _sanitize(stdout: str) -> str:
    """Strip Hammerspoon console chatter from CLI output.

    Lazy extension loading interleaves lines like `-- Loading extension: json`
    into the CLI stream; the actual return value is the last non-comment line.
    """
    lines = [
        ln for ln in stdout.strip().splitlines() if ln.strip() and not ln.lstrip().startswith("--")
    ]
    return lines[-1].strip() if lines else ""


def run_hs(lua: str) -> str:
    """Run a Lua snippet through `hs -c <lua>` and return its stdout, sanitized.

    Raises HSError on a non-zero exit, a timeout, or if the `hs` binary itself
    can't be launched (e.g. Hammerspoon isn't running / IPC CLI not installed).
    """
    try:
        with _hs_lock:
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

    return _sanitize(result.stdout)
