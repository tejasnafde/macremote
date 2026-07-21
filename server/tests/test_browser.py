from tests.conftest import AUTH_HEADERS


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
        {"tab_id": 1, "browser": "chrome", "title": "Song A", "playing": True, "audible": True, "volume": None},
        {"tab_id": 2, "browser": "chrome", "title": "Song B", "playing": False, "audible": False, "volume": None},
    ]


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
