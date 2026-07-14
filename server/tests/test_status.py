import json

from tests.conftest import AUTH_HEADERS


def test_status_shape(client, fake_hs):
    canned = {
        "volume": 55,
        "muted": False,
        "brightness": 80,
        "battery": 73,
        "nowplaying": {"title": "Song", "artist": "Artist", "app": "Music"},
    }
    fake_hs.set_output(json.dumps(canned))

    resp = client.get("/status", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    body = resp.json()
    assert body["volume"] == 55
    assert body["muted"] is False
    assert body["brightness"] == 80
    assert body["battery"] == 73
    assert body["now_playing"] == canned["nowplaying"]
    assert "nowplaying" not in body
    assert body["sleep_timer"] is None
    assert "macremote.nowPlaying" in fake_hs.calls[0]


def test_status_null_nowplaying(client, fake_hs):
    canned = {"volume": 10, "muted": True, "brightness": 20, "battery": 99, "nowplaying": None}
    fake_hs.set_output(json.dumps(canned))

    resp = client.get("/status", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json()["now_playing"] is None


def test_status_hs_bad_json_returns_502(client, fake_hs, monkeypatch):
    fake_hs.set_output("not json")
    monkeypatch.setattr("main.alert", lambda **kw: None)

    resp = client.get("/status", headers=AUTH_HEADERS)

    assert resp.status_code == 502
