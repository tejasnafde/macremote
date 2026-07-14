import pytest
from fastapi.testclient import TestClient

from config.settings import settings

AUTH_HEADERS = {"Authorization": "Bearer test-token"}


@pytest.fixture
def fake_hs(tmp_path, monkeypatch):
    """A fake `hs` CLI: records every invocation's args to a log file and prints
    canned output. Point `settings.HS_BIN` at it so tests never touch real Hammerspoon.
    """
    script = tmp_path / "fake_hs.sh"
    calls_file = tmp_path / "calls.log"
    output_file = tmp_path / "output.txt"
    exit_file = tmp_path / "exit_code.txt"

    # Valid JSON by default so /status works out of the box without every test
    # having to call fake_hs.set_output(...) first.
    output_file.write_text(
        '{"volume": 50, "muted": false, "brightness": 50, "battery": 100, "nowplaying": null}'
    )
    exit_file.write_text("0")

    script.write_text(
        f"""#!/bin/bash
echo "$@" >> "{calls_file}"
cat "{output_file}"
exit "$(cat "{exit_file}")"
"""
    )
    script.chmod(0o755)

    class FakeHS:
        path = str(script)

        @property
        def calls(self) -> list[str]:
            if not calls_file.exists():
                return []
            return calls_file.read_text().splitlines()

        def set_output(self, text: str) -> None:
            output_file.write_text(text)

        def set_exit_code(self, code: int) -> None:
            exit_file.write_text(str(code))

    monkeypatch.setattr(settings, "HS_BIN", str(script))
    return FakeHS()


@pytest.fixture
def client(monkeypatch):
    """TestClient with test-safe settings applied before the app's lifespan runs
    (so startup's Discord lifecycle post never hits a real webhook)."""
    monkeypatch.setattr(settings, "API_TOKEN", "test-token")
    monkeypatch.setattr(settings, "DISCORD_WEBHOOK_URL", "")

    from main import app

    with TestClient(app) as c:
        yield c
