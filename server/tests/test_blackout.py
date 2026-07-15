import asyncio

import pytest

from handler.sleep_timer_handler import SleepTimerService
from tests.conftest import AUTH_HEADERS


def test_system_blackout_endpoint(client, fake_hs, fake_m1ddc):
    resp = client.post("/system/blackout", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert any("setOutputVolume(0)" in c for c in fake_hs.calls)


def test_sleep_timer_accepts_blackout_mode(client, fake_hs):
    resp = client.post("/sleep-timer", headers=AUTH_HEADERS, json={"minutes": 5, "mode": "blackout"})
    assert resp.status_code == 200
    assert resp.json()["mode"] == "blackout"
    status = client.get("/status", headers=AUTH_HEADERS).json()
    assert status["sleep_timer"]["mode"] == "blackout"
    client.delete("/sleep-timer", headers=AUTH_HEADERS)


def test_sleep_timer_rejects_unknown_mode(client, fake_hs):
    resp = client.post("/sleep-timer", headers=AUTH_HEADERS, json={"minutes": 5, "mode": "party"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_blackout_expiry_skips_sleep_and_restore():
    hs_calls = []
    blackout_calls = []

    async def fast_sleep(_s):
        return None

    async def fake_blackout():
        blackout_calls.append(True)

    def fake_run_hs(lua):
        hs_calls.append(lua)
        if "tostring(math.floor" in lua:
            return "62"
        return "ok"

    service = SleepTimerService(
        sleep_fn=fast_sleep, run_hs_fn=fake_run_hs, alert_fn=lambda m: None, blackout_fn=fake_blackout
    )
    service.start(minutes=1, mode="blackout")
    await asyncio.wait_for(service._task, timeout=2)

    assert blackout_calls == [True]
    assert not any("systemSleep" in c for c in hs_calls), "blackout must not sleep the Mac"
    assert not any("setOutputVolume(math.max(0, math.min(100, 62)))" in c for c in hs_calls), (
        "blackout must not restore volume"
    )


def test_screens_on_restores_after_blackout(client, fake_hs, fake_m1ddc):
    fake_hs.set_output("55")  # VOLUME_GET and BRIGHTNESS_GET readbacks
    client.post("/system/blackout", headers=AUTH_HEADERS)
    fake_hs.calls.clear()
    resp = client.post("/system/screens-on", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert any("setOutputVolume(math.max(0, math.min(100, 55)))" in c for c in fake_hs.calls)
    assert any("hs.brightness.set(math.max(0, math.min(100, 55)))" in c for c in fake_hs.calls)


def test_screens_on_without_prior_blackout_uses_defaults(client, fake_hs, fake_m1ddc):
    import handler.system_handler as sh

    sh._blackout_snapshot = None
    resp = client.post("/system/screens-on", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert any("min(100, 40)" in c for c in fake_hs.calls)
    assert any("min(100, 60)" in c for c in fake_hs.calls)


def test_displays_hides_phantom_null_entry(client, fake_hs, fake_m1ddc):
    fake_m1ddc.set_response("display list", "[1] (null) (id 5)\n[2] LG ULTRAGEAR (id 7)\n")
    fake_hs.set_output("50")
    resp = client.get("/displays", headers=AUTH_HEADERS)
    names = [d["name"] for d in resp.json()["displays"]]
    assert "(null)" not in names
