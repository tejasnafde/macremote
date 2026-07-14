from tests.conftest import AUTH_HEADERS


def test_brightness_up(client, fake_hs):
    resp = client.post("/brightness/up", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert "hs.brightness" in fake_hs.calls[0]
    assert "+ 6" in fake_hs.calls[0]


def test_brightness_down(client, fake_hs):
    resp = client.post("/brightness/down", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert "hs.brightness" in fake_hs.calls[0]
    assert "- 6" in fake_hs.calls[0]
