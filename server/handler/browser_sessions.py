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
    COMMAND_TTL_SECONDS = 10

    def __init__(self, clock=time.monotonic):
        self._clock = clock
        self._sessions: dict[str, dict] = {}  # key: "{browser}:{tab_id}"
        self._commands: dict[str, list[dict]] = {}  # browser -> queued commands
        self._next_command_id = 1

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
                "active": bool(tab.get("active", False)),
                "fullscreen": bool(tab.get("fullscreen", False)),
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
        """One live tab, or None when unknown or stale."""
        self._purge_expired()
        session = self._sessions.get(f"{browser}:{tab_id}")
        return {k: v for k, v in session.items() if k != "updated_at"} if session else None

    def enqueue_command(self, browser: str, tab_id: int, action: str, value: int | None = None) -> dict:
        command = {"id": self._next_command_id, "tab_id": tab_id, "action": action}
        if value is not None:
            command["value"] = value  # e.g. seek delta in seconds
        self._next_command_id += 1
        self._commands.setdefault(browser, []).append({**command, "at": self._clock()})
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
