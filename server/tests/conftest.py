import json

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
def fake_m1ddc(tmp_path, monkeypatch):
    """A fake `m1ddc` CLI: records every invocation's args to a log file and
    returns canned output/exit code keyed by the joined argv (falling back to
    a shared default), so one test can script `display list` and
    `get luminance` calls differently. Point `settings.M1DDC_BIN` at it so
    tests never touch real m1ddc/DDC hardware.
    """
    script = tmp_path / "fake_m1ddc.py"
    calls_file = tmp_path / "ddc_calls.log"
    responses_file = tmp_path / "ddc_responses.json"

    responses_file.write_text(json.dumps({"__default__": {"output": "", "exit_code": 0}}))

    script.write_text(
        f"""#!/usr/bin/env python3
import json
import sys

args = sys.argv[1:]
key = " ".join(args)

with open({str(calls_file)!r}, "a") as f:
    f.write(key + "\\n")

with open({str(responses_file)!r}) as f:
    responses = json.load(f)

resp = responses.get(key, responses["__default__"])
sys.stdout.write(resp["output"])
sys.exit(resp["exit_code"])
"""
    )
    script.chmod(0o755)

    class FakeM1DDC:
        path = str(script)

        @property
        def calls(self) -> list[str]:
            if not calls_file.exists():
                return []
            return calls_file.read_text().splitlines()

        def set_response(self, key: str, output: str, exit_code: int = 0) -> None:
            responses = json.loads(responses_file.read_text())
            responses[key] = {"output": output, "exit_code": exit_code}
            responses_file.write_text(json.dumps(responses))

        def set_default(self, output: str, exit_code: int = 0) -> None:
            self.set_response("__default__", output, exit_code)

    monkeypatch.setattr(settings, "M1DDC_BIN", str(script))
    return FakeM1DDC()


@pytest.fixture
def fake_osascript(tmp_path, monkeypatch):
    """A fake `osascript` CLI for the Background Music bridge: records every
    invocation's script text and answers with canned output/exit code chosen
    by SUBSTRING match against the script (AppleScripts here are multiline,
    so exact-argv keying like fake_m1ddc's would be brittle). First matching
    rule wins; falls back to a default. Point `settings.OSASCRIPT_BIN` at it
    so tests never talk to System Events or a real Background Music app."""
    script = tmp_path / "fake_osascript.py"
    calls_file = tmp_path / "osa_calls.log"
    rules_file = tmp_path / "osa_rules.json"

    rules_file.write_text(json.dumps({"rules": [], "default": {"output": "", "exit_code": 1}}))

    script.write_text(
        f"""#!/usr/bin/env python3
import json
import sys

# argv: -e <script> (possibly repeated); join all script args for matching.
scripts = [a for a in sys.argv[1:] if a != "-e"]
text = "\\n".join(scripts)

with open({str(calls_file)!r}, "a") as f:
    f.write(json.dumps(text) + "\\n")

with open({str(rules_file)!r}) as f:
    config = json.load(f)

resp = config["default"]
for rule in config["rules"]:
    if rule["contains"] in text:
        resp = rule
        break
sys.stdout.write(resp["output"])
sys.exit(resp["exit_code"])
"""
    )
    script.chmod(0o755)

    class FakeOsascript:
        path = str(script)

        @property
        def calls(self) -> list[str]:
            if not calls_file.exists():
                return []
            return [json.loads(line) for line in calls_file.read_text().splitlines()]

        def add_rule(self, contains: str, output: str, exit_code: int = 0) -> None:
            config = json.loads(rules_file.read_text())
            config["rules"].append(
                {"contains": contains, "output": output, "exit_code": exit_code}
            )
            rules_file.write_text(json.dumps(config))

        def set_default(self, output: str, exit_code: int = 0) -> None:
            config = json.loads(rules_file.read_text())
            config["default"] = {"output": output, "exit_code": exit_code}
            rules_file.write_text(json.dumps(config))

    monkeypatch.setattr(settings, "OSASCRIPT_BIN", str(script))
    return FakeOsascript()


@pytest.fixture
def gamma_levels(monkeypatch):
    """Fresh, isolated gamma-level store (it is otherwise module-level state
    in brightness_handler, shared with displays_handler)."""
    from handler import brightness_handler

    fresh: dict[str, int] = {}
    monkeypatch.setattr(brightness_handler, "gamma_levels", fresh)
    return fresh


@pytest.fixture
def browser_registry(monkeypatch):
    """A fresh BrowserSessionRegistry with a fake, test-controlled clock so
    TTL expiry can be exercised without real sleeps, and so state never
    leaks between tests (the registry is otherwise a module-level singleton).
    """
    from handler import browser_sessions

    class FakeClock:
        def __init__(self):
            self.now = 1_000_000.0

        def __call__(self) -> float:
            return self.now

        def tick(self, seconds: float) -> None:
            self.now += seconds

    clock = FakeClock()
    fresh = browser_sessions.BrowserSessionRegistry(clock=clock)
    fresh.clock = clock  # exposed so tests can fast-forward: browser_registry.clock.tick(16)
    monkeypatch.setattr(browser_sessions, "registry", fresh)
    return fresh


@pytest.fixture
def client(monkeypatch):
    """TestClient with test-safe settings applied before the app's lifespan runs
    (so startup's Discord lifecycle post never hits a real webhook)."""
    monkeypatch.setattr(settings, "API_TOKEN", "test-token")
    monkeypatch.setattr(settings, "DISCORD_WEBHOOK_URL", "")

    from main import app

    with TestClient(app) as c:
        yield c
