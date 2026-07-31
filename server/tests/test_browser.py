import time

from tests.conftest import AUTH_HEADERS


def test_stale_commands_are_dropped_on_drain(client, fake_hs, browser_registry):
    """A browser that was closed must not replay a burst of stale toggles when
    it reconnects: four queued playpause presses net out to nothing useful."""
    for _ in range(4):
        client.post(
            "/browser/tabs/1/command", headers=AUTH_HEADERS, json={"action": "pause", "browser": "chrome"}
        )
    browser_registry.clock.tick(browser_registry.COMMAND_TTL_SECONDS + 1)
    cmds = client.get("/browser/commands?browser=chrome", headers=AUTH_HEADERS).json()["commands"]
    assert cmds == []


def test_fresh_commands_survive_drain(client, fake_hs, browser_registry):
    client.post(
        "/browser/tabs/1/command", headers=AUTH_HEADERS, json={"action": "play", "browser": "chrome"}
    )
    cmds = client.get("/browser/commands?browser=chrome", headers=AUTH_HEADERS).json()["commands"]
    assert [c["action"] for c in cmds] == ["play"]
    assert "at" not in cmds[0]


def test_report_requires_auth(client):
    resp = client.post("/browser/report", json={"browser": "chrome", "tabs": []})
    assert resp.status_code == 401


def test_report_and_status_shape(client, fake_hs, browser_registry):
    body = {
        "browser": "chrome",
        "tabs": [
            {
                "tab_id": 1,
                "title": "Song A",
                "url_host": "youtube.com",
                "audible": True,
                "muted": False,
                "playing": True,
            },
            {
                "tab_id": 2,
                "title": "Song B",
                "url_host": "spotify.com",
                "audible": False,
                "muted": True,
                "playing": False,
            },
        ],
    }

    resp = client.post("/browser/report", headers=AUTH_HEADERS, json=body)
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "count": 2}

    status_resp = client.get("/status", headers=AUTH_HEADERS)
    assert status_resp.status_code == 200
    assert status_resp.json()["browser_tabs"] == [
        {
            "tab_id": 1, "browser": "chrome", "title": "Song A", "playing": True,
            "audible": True, "muted": False, "volume": None, "fullscreen": False, "controllable": None,
        },
        {
            "tab_id": 2, "browser": "chrome", "title": "Song B", "playing": False,
            "audible": False, "muted": True, "volume": None, "fullscreen": False, "controllable": None,
        },
    ]


def test_playing_is_independent_of_audible(client, fake_hs, browser_registry):
    """A muted tab can still be playing. Inferring `playing` from `audible`
    inverted the phone's icon, which then paused a video labelled 'Play'."""
    body = {
        "browser": "chrome",
        "tabs": [{"tab_id": 1, "audible": False, "muted": True, "playing": True}],
    }
    assert client.post("/browser/report", headers=AUTH_HEADERS, json=body).status_code == 200
    tab = client.get("/status", headers=AUTH_HEADERS).json()["browser_tabs"][0]
    assert tab["playing"] is True
    assert tab["audible"] is False
    assert tab["muted"] is True


def test_status_browser_tabs_empty_by_default(client, fake_hs, browser_registry):
    resp = client.get("/status", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["browser_tabs"] == []


def test_report_replaces_wholesale(client, fake_hs, browser_registry):
    first = {
        "browser": "firefox",
        "tabs": [{"tab_id": 1, "title": "One"}, {"tab_id": 2, "title": "Two"}],
    }
    client.post("/browser/report", headers=AUTH_HEADERS, json=first)

    second = {"browser": "firefox", "tabs": [{"tab_id": 3, "title": "Three"}]}
    client.post("/browser/report", headers=AUTH_HEADERS, json=second)

    tabs = browser_registry.list_tabs()
    assert [t["tab_id"] for t in tabs] == [3]


def test_report_keeps_other_browsers_sessions(client, fake_hs, browser_registry):
    client.post(
        "/browser/report",
        headers=AUTH_HEADERS,
        json={"browser": "chrome", "tabs": [{"tab_id": 1, "title": "Chrome tab"}]},
    )
    client.post(
        "/browser/report",
        headers=AUTH_HEADERS,
        json={"browser": "firefox", "tabs": [{"tab_id": 9, "title": "FF tab"}]},
    )

    tabs = browser_registry.list_tabs()
    assert {t["browser"] for t in tabs} == {"chrome", "firefox"}


def test_sessions_expire_after_ttl(client, fake_hs, browser_registry):
    client.post(
        "/browser/report",
        headers=AUTH_HEADERS,
        json={"browser": "chrome", "tabs": [{"tab_id": 1, "title": "Tab"}]},
    )
    assert len(browser_registry.list_tabs()) == 1

    browser_registry.clock.tick(16)

    assert browser_registry.list_tabs() == []


def test_sessions_survive_within_ttl(client, fake_hs, browser_registry):
    client.post(
        "/browser/report",
        headers=AUTH_HEADERS,
        json={"browser": "chrome", "tabs": [{"tab_id": 1, "title": "Tab"}]},
    )

    browser_registry.clock.tick(10)

    assert len(browser_registry.list_tabs()) == 1


def test_command_enqueue_and_drain(client, fake_hs, browser_registry):
    resp = client.post(
        "/browser/tabs/42/command",
        headers=AUTH_HEADERS,
        json={"action": "playpause", "browser": "chrome"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    command = body["command"]
    assert command["tab_id"] == 42
    assert command["action"] == "playpause"

    drain_resp = client.get(
        "/browser/commands", headers=AUTH_HEADERS, params={"browser": "chrome"}
    )
    assert drain_resp.status_code == 200
    assert drain_resp.json()["commands"] == [command]

    # Second poll drains empty - commands are cleared once read.
    drain_resp2 = client.get(
        "/browser/commands", headers=AUTH_HEADERS, params={"browser": "chrome"}
    )
    assert drain_resp2.json()["commands"] == []


def test_commands_are_per_browser(client, fake_hs, browser_registry):
    client.post(
        "/browser/tabs/1/command",
        headers=AUTH_HEADERS,
        json={"action": "focus", "browser": "chrome"},
    )
    client.post(
        "/browser/tabs/2/command",
        headers=AUTH_HEADERS,
        json={"action": "mute", "browser": "firefox"},
    )

    chrome_commands = client.get(
        "/browser/commands", headers=AUTH_HEADERS, params={"browser": "chrome"}
    ).json()["commands"]
    firefox_commands = client.get(
        "/browser/commands", headers=AUTH_HEADERS, params={"browser": "firefox"}
    ).json()["commands"]

    assert [c["action"] for c in chrome_commands] == ["focus"]
    assert [c["action"] for c in firefox_commands] == ["mute"]


def test_commands_requires_auth(client):
    resp = client.get("/browser/commands", params={"browser": "chrome"})
    assert resp.status_code == 401


def test_tab_command_requires_auth(client):
    resp = client.post("/browser/tabs/1/command", json={"action": "focus", "browser": "chrome"})
    assert resp.status_code == 401


def test_report_rejects_invalid_browser(client):
    resp = client.post(
        "/browser/report", headers=AUTH_HEADERS, json={"browser": "safari", "tabs": []}
    )
    assert resp.status_code == 422


def test_commands_requires_browser_param(client):
    resp = client.get("/browser/commands", headers=AUTH_HEADERS)
    assert resp.status_code == 422


def test_command_rejects_invalid_action(client):
    resp = client.post(
        "/browser/tabs/1/command",
        headers=AUTH_HEADERS,
        json={"action": "rewind", "browser": "chrome"},
    )
    assert resp.status_code == 422


def test_fullscreen_tab_enqueues_focus_and_raises(client, fake_hs, browser_registry):
    resp = client.post("/browser/tabs/7/fullscreen", headers=AUTH_HEADERS, json={"browser": "firefox"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    # It queues a focus command for the extension...
    cmds = client.get("/browser/commands?browser=firefox", headers=AUTH_HEADERS).json()["commands"]
    assert any(c["tab_id"] == 7 and c["action"] == "focus" for c in cmds)
    # ...and raises the browser app on the Mac, without launching it.
    assert any("hs.application.get" in c and "firefox" in c for c in fake_hs.calls)
    assert not any("launchOrFocusByBundleID" in c for c in fake_hs.calls)


def _sent_f(fake_hs) -> bool:
    return any("keyStroke" in c and '"f"' in c for c in fake_hs.calls)


def _wait_for_f(fake_hs, timeout=3.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if _sent_f(fake_hs):
            return True
        time.sleep(0.05)
    return False


def _ack(client, browser_registry, **tab):
    """Simulate the extension acting on the focus command and reporting back:
    the report must be NEWER than the command for the ack to count."""
    browser_registry.clock.tick(1)
    client.post(
        "/browser/report",
        headers=AUTH_HEADERS,
        json={"browser": "firefox", "tabs": [{"tab_id": 7, "playing": True, **tab}]},
    )


def test_fullscreen_sends_key_once_tab_reports_active(client, fake_hs, browser_registry):
    assert client.post(
        "/browser/tabs/7/fullscreen", headers=AUTH_HEADERS, json={"browser": "firefox"}
    ).status_code == 200
    _ack(client, browser_registry, active=True, fullscreen=False)
    assert _wait_for_f(fake_hs), f"no 'f' keystroke; calls={fake_hs.calls}"


def test_fullscreen_skips_key_when_already_fullscreen(client, fake_hs, browser_registry):
    """'f' toggles, so pressing it on an already-fullscreen video would exit."""
    assert client.post(
        "/browser/tabs/7/fullscreen", headers=AUTH_HEADERS, json={"browser": "firefox"}
    ).status_code == 200
    _ack(client, browser_registry, active=True, fullscreen=True)
    assert not _wait_for_f(fake_hs, timeout=1.0)


def test_fullscreen_ignores_a_report_older_than_the_command(client, fake_hs, browser_registry):
    """The race this ack exists to close: the tab was active up to 5s ago, the
    user has since switched tabs, and the extension has not run the focus command
    yet. Trusting that snapshot aimed 'f' at whatever tab is on screen now."""
    client.post(
        "/browser/report",
        headers=AUTH_HEADERS,
        json={"browser": "firefox", "tabs": [{"tab_id": 7, "active": True, "fullscreen": False}]},
    )
    assert client.post(
        "/browser/tabs/7/fullscreen", headers=AUTH_HEADERS, json={"browser": "firefox"}
    ).status_code == 200
    assert not _wait_for_f(fake_hs, timeout=1.0)


def test_fullscreen_sends_no_key_when_the_switch_is_never_confirmed(client, fake_hs, browser_registry):
    """No ack means no keystroke. 'f' is a real system-wide key, so a blind
    fallback types the letter into whatever app happens to be focused."""
    assert client.post(
        "/browser/tabs/7/fullscreen", headers=AUTH_HEADERS, json={"browser": "firefox"}
    ).status_code == 200
    assert not _wait_for_f(fake_hs, timeout=1.0)


def test_fullscreen_gives_up_when_the_browser_is_not_running(client, fake_hs, browser_registry):
    fake_hs.set_output("not-running")
    resp = client.post("/browser/tabs/7/fullscreen", headers=AUTH_HEADERS, json={"browser": "firefox"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is False
    assert not _wait_for_f(fake_hs, timeout=0.5)


def test_fullscreen_second_tap_does_not_double_toggle(client, fake_hs, browser_registry):
    for _ in range(2):
        client.post("/browser/tabs/7/fullscreen", headers=AUTH_HEADERS, json={"browser": "firefox"})
    _ack(client, browser_registry, active=True, fullscreen=False)
    assert _wait_for_f(fake_hs)
    time.sleep(0.4)
    assert sum(1 for c in fake_hs.calls if "keyStroke" in c and '"f"' in c) == 1


def test_fullscreen_tab_requires_auth(client, fake_hs):
    assert client.post("/browser/tabs/7/fullscreen", json={"browser": "firefox"}).status_code == 401


def test_fullscreen_tells_you_to_reload_an_old_extension(client, fake_hs, browser_registry):
    """A build that never reports `active` can never satisfy the ack, so the
    button would do nothing at all. The extension is reloaded by hand while the
    server auto-updates, so this pairing really happens."""
    client.post(
        "/browser/report",
        headers=AUTH_HEADERS,
        json={"browser": "firefox", "tabs": [{"tab_id": 7, "playing": True}]},
    )
    resp = client.post("/browser/tabs/7/fullscreen", headers=AUTH_HEADERS, json={"browser": "firefox"})
    assert resp.json()["ok"] is False
    assert "Reload" in resp.json()["note"]
    assert not _wait_for_f(fake_hs, timeout=0.5)


def test_controllable_passes_through(client, fake_hs, browser_registry):
    """An iframe or shadow-DOM player reports playing (from `audible`) but takes
    no commands. The phone needs to know, so it can use the system media key
    instead of sending a tab command that silently does nothing."""
    client.post(
        "/browser/report",
        headers=AUTH_HEADERS,
        json={
            "browser": "firefox",
            "tabs": [
                {"tab_id": 1, "playing": True, "audible": True, "controllable": False},
                {"tab_id": 2, "playing": True, "audible": True, "controllable": True},
            ],
        },
    )
    tabs = {t["tab_id"]: t for t in client.get("/status", headers=AUTH_HEADERS).json()["browser_tabs"]}
    assert tabs[1]["controllable"] is False
    assert tabs[2]["controllable"] is True
