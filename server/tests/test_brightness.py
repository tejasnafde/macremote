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


LG = "[1] LG ULTRAGEAR (37D8832A-2D66-02CA-B9F7-8F30A301B230)\n"


def test_brightness_down_external_defaults_to_gamma(client, fake_hs, fake_m1ddc):
    # External displays dim via gamma by default (DDC "success" is unverifiable),
    # so no m1ddc set luminance, a hs.screen setGamma instead, and via == gamma.
    fake_m1ddc.set_response("display list", LG)

    resp = client.post("/brightness/down?display=1", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json()["via"] == "gamma"
    assert any("setGamma" in c for c in fake_hs.calls)
    assert not any("set luminance" in c for c in fake_m1ddc.calls)


def test_brightness_gamma_step_and_clamp_floor(client, fake_hs, fake_m1ddc, gamma_levels):
    fake_m1ddc.set_response("display list", LG)
    gamma_levels["LG ULTRAGEAR"] = 20
    # step is 8; 20 - 8 = 12, clamped up to the GAMMA_FLOOR of 15.
    client.post("/brightness/down?display=1", headers=AUTH_HEADERS)
    assert gamma_levels["LG ULTRAGEAR"] == 15


def test_brightness_set_external_gamma(client, fake_hs, fake_m1ddc, gamma_levels):
    fake_m1ddc.set_response("display list", LG)

    resp = client.put("/brightness", headers=AUTH_HEADERS, json={"level": 60, "display": "1"})

    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "level": 60, "display": "1", "via": "gamma"}
    assert gamma_levels["LG ULTRAGEAR"] == 60


def test_brightness_external_ddc_when_opted_in(client, fake_m1ddc):
    # A display opted into "ddc" uses m1ddc hardware brightness.
    fake_m1ddc.set_response("display list", LG)
    fake_m1ddc.set_response("display 1 get luminance", "50")
    client.put("/displays/1/method", headers=AUTH_HEADERS, json={"method": "ddc"})

    resp = client.post("/brightness/up?display=1", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json()["via"] == "ddc"
    assert "display 1 set luminance 58" in fake_m1ddc.calls


def test_set_method_unknown_display_404(client, fake_m1ddc):
    fake_m1ddc.set_response("display list", LG)
    resp = client.put("/displays/9/method", headers=AUTH_HEADERS, json={"method": "ddc"})
    assert resp.status_code == 404


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
