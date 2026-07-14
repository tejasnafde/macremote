from tests.conftest import AUTH_HEADERS


def test_volume_up(client, fake_hs):
    resp = client.post("/volume/up", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert "outputVolume() + 6" in fake_hs.calls[0]


def test_volume_down(client, fake_hs):
    resp = client.post("/volume/down", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert "outputVolume() - 6" in fake_hs.calls[0]


def test_volume_mute(client, fake_hs):
    resp = client.post("/volume/mute", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert "setMuted" in fake_hs.calls[0]


def test_volume_set(client, fake_hs):
    resp = client.put("/volume", headers=AUTH_HEADERS, json={"level": 42})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "level": 42}
    assert "42" in fake_hs.calls[0]


def test_volume_set_rejects_out_of_range(client, fake_hs):
    resp = client.put("/volume", headers=AUTH_HEADERS, json={"level": 101})
    assert resp.status_code == 422
    assert fake_hs.calls == []

    resp = client.put("/volume", headers=AUTH_HEADERS, json={"level": -1})
    assert resp.status_code == 422
