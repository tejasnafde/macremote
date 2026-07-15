"""Bridge to Hammerspoon via the `hs` IPC CLI. The Mac-side `macremote.lua`
module (see hammerspoon/) is what actually presses keys / reads state; this
module just shells out and returns whatever the Lua expression prints."""

import subprocess
import threading
import time

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


# Transient Hammerspoon IPC failures worth one retry (vs a real Lua error):
#  - "ipc port is no longer valid": the CLI hit the old port right after a reload
#  - the CLI itself crashing (SIGABRT / NSDestinationInvalidException / target
#    thread exited): HS 1.1.1 IPC on macOS 26 occasionally aborts a CLI call
_TRANSIENT_IPC_MARKERS = (
    "ipc port is no longer valid",
    "NSDestinationInvalidException",
    "target thread exited",
)


def _is_transient_ipc(stderr: str) -> bool:
    return any(m in stderr for m in _TRANSIENT_IPC_MARKERS)


def _invoke(lua: str) -> subprocess.CompletedProcess:
    with _hs_lock:
        return subprocess.run(
            [settings.HS_BIN, "-c", lua],
            capture_output=True,
            timeout=5,
            text=True,
        )


def run_hs(lua: str) -> str:
    """Run a Lua snippet through `hs -c <lua>` and return its stdout, sanitized.

    Raises HSError on a non-zero exit, a timeout, or if the `hs` binary itself
    can't be launched (e.g. Hammerspoon isn't running / IPC CLI not installed).

    Retries once on a stale-IPC-port error: right after Hammerspoon reloads its
    config, the CLI can hit "ipc port is no longer valid" for a beat before the
    port re-registers. Transient, so a single retry (after a short pause) clears
    it instead of surfacing a 502 + Discord alert.
    """
    try:
        result = _invoke(lua)
        if result.returncode != 0 and _is_transient_ipc(result.stderr):
            time.sleep(0.4)
            result = _invoke(lua)
    except subprocess.TimeoutExpired as exc:
        raise HSError(f"hs timed out after 5s running: {lua!r}") from exc
    except OSError as exc:
        raise HSError(f"failed to invoke hs ({settings.HS_BIN}): {exc}") from exc

    if result.returncode != 0:
        raise HSError(
            f"hs exited {result.returncode} for {lua!r}: {result.stderr.strip()}"
        )

    return _sanitize(result.stdout)
