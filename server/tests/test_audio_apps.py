from tests.conftest import AUTH_HEADERS


def _bgm_running(fake_osascript, running: bool = True) -> None:
    fake_osascript.add_rule("application process", "true" if running else "false")


def test_audio_apps_available(client, fake_osascript):
    _bgm_running(fake_osascript)
    fake_osascript.add_rule("audio apps", "Music\t40\nFirefox\t85\n")

    resp = client.get("/audio/apps", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json() == {
        "available": True,
        "apps": [
            {"name": "Music", "volume": 40},
            {"name": "Firefox", "volume": 85},
        ],
    }


def test_audio_apps_unavailable_when_bgm_not_running(client, fake_osascript):
    _bgm_running(fake_osascript, running=False)

    resp = client.get("/audio/apps", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json() == {"available": False, "apps": []}
    # Detection stops at the System Events probe: telling app "Background
    # Music" directly would LAUNCH it, which a status read must never do.
    assert len(fake_osascript.calls) == 1


def test_audio_apps_unavailable_when_osascript_fails(client, fake_osascript):
    # Default rule: exit 1 (e.g. osascript erroring, BGM never installed).
    resp = client.get("/audio/apps", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json() == {"available": False, "apps": []}


def test_audio_apps_list_failure_after_detection_degrades(client, fake_osascript):
    _bgm_running(fake_osascript)
    fake_osascript.add_rule("audio apps", "execution error", exit_code=1)

    resp = client.get("/audio/apps", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json() == {"available": False, "apps": []}


def test_set_audio_app_volume(client, fake_osascript):
    _bgm_running(fake_osascript)
    fake_osascript.add_rule("first audio app", "")

    resp = client.put(
        "/audio/apps", headers=AUTH_HEADERS, json={"name": "Firefox", "volume": 30}
    )

    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    set_call = fake_osascript.calls[-1]
    assert 'first audio app whose name is "Firefox"' in set_call
    assert "to 30" in set_call


def test_set_audio_app_volume_unavailable(client, fake_osascript):
    _bgm_running(fake_osascript, running=False)

    resp = client.put(
        "/audio/apps", headers=AUTH_HEADERS, json={"name": "Firefox", "volume": 30}
    )

    assert resp.status_code == 200
    assert resp.json() == {"ok": False, "available": False}


def test_set_audio_app_volume_validates_range(client, fake_osascript):
    resp = client.put(
        "/audio/apps", headers=AUTH_HEADERS, json={"name": "Firefox", "volume": 101}
    )
    assert resp.status_code == 422
    assert fake_osascript.calls == []


def test_audio_apps_require_auth(client):
    assert client.get("/audio/apps").status_code == 401
    assert client.put("/audio/apps", json={"name": "x", "volume": 1}).status_code == 401
