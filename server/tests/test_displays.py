from tests.conftest import AUTH_HEADERS


def test_displays_shape_builtin_and_external(client, fake_hs, fake_m1ddc):
    fake_hs.set_output("42")
    fake_m1ddc.set_response(
        "display list", "[2] LG ULTRAGEAR (13D61039-774A-93BC-0857-D6964E3302DB)\n"
    )
    fake_m1ddc.set_response("display 2 get luminance", "77")

    resp = client.get("/displays", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json() == {
        "displays": [
            {"id": "builtin", "name": "Built-in", "builtin": True, "brightness": 42},
            {
                "id": "2",
                "name": "LG ULTRAGEAR",
                "builtin": False,
                "brightness": 77,
                "gamma_level": 100,
            },
        ]
    }


def test_displays_external_reports_stored_gamma_level(client, fake_hs, fake_m1ddc, gamma_levels):
    fake_hs.set_output("42")
    fake_m1ddc.set_response(
        "display list", "[2] LG ULTRAGEAR (13D61039-774A-93BC-0857-D6964E3302DB)\n"
    )
    fake_m1ddc.set_response("display 2 get luminance", "77")
    gamma_levels["LG ULTRAGEAR"] = 60

    resp = client.get("/displays", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json()["displays"][1]["gamma_level"] == 60


def test_displays_degrades_when_m1ddc_unavailable(client, fake_hs, fake_m1ddc):
    fake_hs.set_output("50")
    fake_m1ddc.set_default("m1ddc: command not found", exit_code=127)

    resp = client.get("/displays", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json() == {
        "displays": [
            {"id": "builtin", "name": "Built-in", "builtin": True, "brightness": 50}
        ]
    }


def test_displays_external_luminance_probe_failure_is_null(client, fake_hs, fake_m1ddc):
    fake_hs.set_output("50")
    fake_m1ddc.set_response(
        "display list", "[1] LG ULTRAGEAR (37D8832A-2D66-02CA-B9F7-8F30A301B230)\n"
    )
    fake_m1ddc.set_response(
        "display 1 get luminance", "DDC communication failure", exit_code=1
    )

    resp = client.get("/displays", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json()["displays"][1] == {
        "id": "1",
        "name": "LG ULTRAGEAR",
        "builtin": False,
        "brightness": None,
        "gamma_level": 100,
    }


def test_displays_builtin_brightness_null_when_hs_fails(client, fake_hs, fake_m1ddc):
    fake_hs.set_exit_code(1)
    fake_hs.set_output("no brightness API on this Mac")
    fake_m1ddc.set_default("", exit_code=1)

    resp = client.get("/displays", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json()["displays"][0]["brightness"] is None


def test_displays_requires_auth(client):
    resp = client.get("/displays")
    assert resp.status_code == 401
