from tests.conftest import AUTH_HEADERS


def test_seek_forward(client, fake_hs):
    resp = client.post("/media/seek", headers=AUTH_HEADERS, json={"seconds": 10})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    sent = fake_hs.calls[-1]
    assert "setPosition" in sent
    assert "player position" in sent
    assert "'right'" in sent
    assert "for i = 1, 2 do" in sent  # 10s falls back to two 5s arrow presses


def test_seek_back_small_delta_single_press(client, fake_hs):
    resp = client.post("/media/seek", headers=AUTH_HEADERS, json={"seconds": -5})
    assert resp.status_code == 200
    sent = fake_hs.calls[-1]
    assert "'left'" in sent
    assert "for i = 1, 1 do" in sent


def test_seek_zero_is_noop(client, fake_hs):
    before = len(fake_hs.calls)
    resp = client.post("/media/seek", headers=AUTH_HEADERS, json={"seconds": 0})
    assert resp.status_code == 200
    assert resp.json()["via"] == "noop"
    assert len(fake_hs.calls) == before


def test_seek_validation(client, fake_hs):
    assert client.post("/media/seek", headers=AUTH_HEADERS, json={"seconds": 999}).status_code == 422
    assert client.post("/media/seek", headers=AUTH_HEADERS, json={}).status_code == 422


def test_seek_requires_auth(client, fake_hs):
    assert client.post("/media/seek", json={"seconds": 10}).status_code == 401
