from tests.conftest import AUTH_HEADERS


def test_banish_cursor(client, fake_hs):
    resp = client.post("/system/banish-cursor", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert any("absolutePosition" in c for c in fake_hs.calls)


def test_banish_cursor_requires_auth(client, fake_hs):
    resp = client.post("/system/banish-cursor")
    assert resp.status_code == 401
