from handler.sleep_timer_handler import sleep_timer_service
from tests.conftest import AUTH_HEADERS


def test_set_sleep_timer(client, fake_hs):
    resp = client.post("/sleep-timer", headers=AUTH_HEADERS, json={"minutes": 5})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "minutes": 5}
    assert sleep_timer_service.is_active()

    status_resp = client.get("/status", headers=AUTH_HEADERS)
    remaining = (status_resp.json()["sleep_timer"] or {}).get("remaining_seconds")
    assert remaining is not None
    assert 0 < remaining <= 5 * 60


def test_cancel_sleep_timer(client, fake_hs):
    client.post("/sleep-timer", headers=AUTH_HEADERS, json={"minutes": 5})

    resp = client.delete("/sleep-timer", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "cancelled": True}
    assert not sleep_timer_service.is_active()

    status_resp = client.get("/status", headers=AUTH_HEADERS)
    assert status_resp.json()["sleep_timer"] is None


def test_cancel_sleep_timer_when_none_active(client, fake_hs):
    resp = client.delete("/sleep-timer", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "cancelled": False}


def test_set_sleep_timer_rejects_out_of_range_minutes(client, fake_hs):
    resp = client.post("/sleep-timer", headers=AUTH_HEADERS, json={"minutes": 0})
    assert resp.status_code == 422

    resp = client.post("/sleep-timer", headers=AUTH_HEADERS, json={"minutes": 481})
    assert resp.status_code == 422
