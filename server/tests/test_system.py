from tests.conftest import AUTH_HEADERS


def test_lock(client, fake_hs):
    resp = client.post("/system/lock", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert "lockScreen" in fake_hs.calls[0]


def test_sleep(client, fake_hs):
    resp = client.post("/system/sleep", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert "systemSleep" in fake_hs.calls[0]
