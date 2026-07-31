"""Browser tab bridge - in-memory registry of tabs reported by the companion
WebExtension (see extension/). No persistence: this is a live snapshot, not
a database. A browser's `report()` call replaces its whole tab list wholesale
(the extension always pushes its full list every 5s, so there is nothing to
diff). Sessions are considered stale 15s after their last report and are
lazily purged whenever the registry is read - this covers a closed browser or
a crashed extension without needing a background sweep task.

Commands (play/pause/playpause/focus/mute/seek/setvolume, enqueued by the app
via POST /browser/tabs/{tab_id}/command) sit in a small per-browser queue that
the extension drains on its own poll loop (GET /browser/commands). Queued
commands expire: a browser that was closed for a minute must not replay a
burst of stale toggles the moment it reconnects."""

import time


class BrowserSessionRegistry:
    SESSION_TTL_SECONDS = 15
    # Must stay comfortably ABOVE the extension's slowest poll interval (15s
    # idle, and Chrome can clamp alarms to 60s for a packed build): a TTL under
    # that silently ate every tap, since each command expired before the
    # extension could fetch it. Replay is also much less harmful now that
    # play/pause are absolute rather than toggles - a repeated pause is a no-op.
    COMMAND_TTL_SECONDS = 90
    # Backstop for a browser that never polls again: without a drain nothing
    # else purges the queue.
    MAX_QUEUED_COMMANDS = 32

    def __init__(self, clock=time.monotonic):
        self._clock = clock
        self._sessions: dict[str, dict] = {}  # key: "{browser}:{tab_id}"
        self._commands: dict[str, list[dict]] = {}  # browser -> queued commands
        self._next_command_id = 1

    def now(self) -> float:
        """The registry's clock, so callers can compare against `updated_at`."""
        return self._clock()

    def report(self, browser: str, tabs: list[dict]) -> None:
        """Replace `browser`'s sessions wholesale (idempotent, no diffing)."""
        now = self._clock()
        for key in [k for k, v in self._sessions.items() if v["browser"] == browser]:
            del self._sessions[key]
        for tab in tabs:
            key = f"{browser}:{tab['tab_id']}"
            self._sessions[key] = {
                "tab_id": tab["tab_id"],
                "browser": browser,
                "title": tab.get("title") or "",
                "url_host": tab.get("url_host") or "",
                "audible": bool(tab.get("audible", False)),
                "muted": bool(tab.get("muted", False)),
                "playing": bool(tab.get("playing", False)),
                "volume": tab.get("volume"),  # 0-100 or None when unreadable
                # Kept nullable on purpose: None marks a pre-fullscreen-ack
                # extension build, which is not the same as False.
                "active": tab.get("active"),
                "fullscreen": tab.get("fullscreen"),
                "controllable": tab.get("controllable"),
                "updated_at": now,
            }

    def _purge_expired(self) -> None:
        now = self._clock()
        expired = [
            key
            for key, session in self._sessions.items()
            if now - session["updated_at"] > self.SESSION_TTL_SECONDS
        ]
        for key in expired:
            del self._sessions[key]

    def list_tabs(self) -> list[dict]:
        """Lazy-purge expired sessions, then return the live ones (drops the
        internal `updated_at` bookkeeping field)."""
        self._purge_expired()
        return [
            {k: v for k, v in session.items() if k != "updated_at"}
            for session in self._sessions.values()
        ]

    def get_tab(self, browser: str, tab_id: int) -> dict | None:
        """One live tab, or None when unknown or stale. Keeps `updated_at` so a
        caller can tell a fresh report from a snapshot taken before its command."""
        self._purge_expired()
        session = self._sessions.get(f"{browser}:{tab_id}")
        return dict(session) if session else None

    def enqueue_command(self, browser: str, tab_id: int, action: str, value: int | None = None) -> dict:
        command = {"id": self._next_command_id, "tab_id": tab_id, "action": action}
        if value is not None:
            command["value"] = value  # e.g. seek delta in seconds
        self._next_command_id += 1
        queue = self._commands.setdefault(browser, [])
        queue.append({**command, "at": self._clock()})
        del queue[: -self.MAX_QUEUED_COMMANDS]
        return command

    def drain_commands(self, browser: str) -> list[dict]:
        """Return and clear `browser`'s queued commands, dropping expired ones."""
        now = self._clock()
        queued = self._commands.get(browser, [])
        self._commands[browser] = []
        return [
            {k: v for k, v in c.items() if k != "at"}
            for c in queued
            if now - c["at"] <= self.COMMAND_TTL_SECONDS
        ]


registry = BrowserSessionRegistry()
