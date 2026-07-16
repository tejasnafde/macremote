from tests.conftest import AUTH_HEADERS


def test_brightness_up(client, fake_hs):
    resp = client.post("/brightness/up", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    # Built-in brightness uses the hardware BRIGHTNESS_UP key (hs.brightness.set
    # hangs on Apple Silicon), not hs.brightness.set.
    assert 'newSystemKeyEvent("BRIGHTNESS_UP"' in fake_hs.calls[0]


def test_brightness_down(client, fake_hs):
    resp = client.post("/brightness/down", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert 'newSystemKeyEvent("BRIGHTNESS_DOWN"' in fake_hs.calls[0]


def test_brightness_set_builtin(client, fake_hs):
    resp = client.put("/brightness", headers=AUTH_HEADERS, json={"level": 33})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "level": 33, "display": "builtin"}
    assert "hs.brightness.set" in fake_hs.calls[0]
    assert "33" in fake_hs.calls[0]


def test_brightness_set_rejects_out_of_range(client, fake_hs):
    resp = client.put("/brightness", headers=AUTH_HEADERS, json={"level": 101})
    assert resp.status_code == 422
    assert fake_hs.calls == []


def test_brightness_up_external(client, fake_m1ddc):
    fake_m1ddc.set_response("display 1 get luminance", "50")

    resp = client.post("/brightness/up?display=1", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert fake_m1ddc.calls == ["display 1 get luminance", "display 1 set luminance 58"]


def test_brightness_down_external(client, fake_m1ddc):
    fake_m1ddc.set_response("display 1 get luminance", "50")

    resp = client.post("/brightness/down?display=1", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert fake_m1ddc.calls == ["display 1 get luminance", "display 1 set luminance 42"]


def test_brightness_up_external_clamps_at_100(client, fake_m1ddc):
    fake_m1ddc.set_response("display 1 get luminance", "99")

    resp = client.post("/brightness/up?display=1", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert fake_m1ddc.calls[-1] == "display 1 set luminance 100"


def test_brightness_down_external_clamps_at_zero(client, fake_m1ddc):
    fake_m1ddc.set_response("display 1 get luminance", "3")

    resp = client.post("/brightness/down?display=1", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert fake_m1ddc.calls[-1] == "display 1 set luminance 0"


def test_brightness_set_external(client, fake_m1ddc):
    resp = client.put("/brightness", headers=AUTH_HEADERS, json={"level": 60, "display": "1"})

    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "level": 60, "display": "1"}
    assert fake_m1ddc.calls == ["display 1 set luminance 60"]


def test_brightness_external_ddc_failure_is_graceful_no_alert(client, fake_m1ddc, monkeypatch):
    # A monitor ignoring DDC is expected, not a server fault: 200 with
    # display_unsupported, and no Discord alert (it would spam on every tap).
    fake_m1ddc.set_default("DDC communication failure", exit_code=1)

    alert_calls = []
    monkeypatch.setattr("main.alert", lambda **kw: alert_calls.append(kw))

    resp = client.post("/brightness/up?display=1", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json() == {"ok": False, "display_unsupported": True}
    assert alert_calls == []


def test_brightness_up_requires_auth(client):
    resp = client.post("/brightness/up")
    assert resp.status_code == 401


def test_brightness_put_requires_auth(client):
    resp = client.put("/brightness", json={"level": 50})
    assert resp.status_code == 401
