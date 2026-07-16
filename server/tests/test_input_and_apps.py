import json

from tests.conftest import AUTH_HEADERS


# ── reading-mode input ────────────────────────────────────────────────────────
def test_scroll(client, fake_hs):
    resp = client.post("/input/scroll", headers=AUTH_HEADERS, json={"dx": 0, "dy": -120})
    assert resp.status_code == 200
    assert "newScrollEvent" in fake_hs.calls[-1]
    assert "-120" in fake_hs.calls[-1]


def test_scroll_zero_is_noop(client, fake_hs):
    before = len(fake_hs.calls)
    resp = client.post("/input/scroll", headers=AUTH_HEADERS, json={"dx": 0, "dy": 0})
    assert resp.status_code == 200
    assert len(fake_hs.calls) == before


def test_scroll_clamps_validation(client, fake_hs):
    assert client.post("/input/scroll", headers=AUTH_HEADERS, json={"dy": 99999}).status_code == 422


def test_key_allowed(client, fake_hs):
    resp = client.post("/input/key", headers=AUTH_HEADERS, json={"key": "right"})
    assert resp.status_code == 200
    assert 'keyStroke({}, "right"' in fake_hs.calls[-1]


def test_key_rejected(client, fake_hs):
    resp = client.post("/input/key", headers=AUTH_HEADERS, json={"key": "delete"})
    assert resp.status_code == 422


def test_input_requires_auth(client, fake_hs):
    assert client.post("/input/scroll", json={"dy": 10}).status_code == 401
    assert client.post("/input/key", json={"key": "right"}).status_code == 401


# ── app switcher ──────────────────────────────────────────────────────────────
def test_list_apps_shape_and_order(client, fake_hs):
    fake_hs.set_output(
        json.dumps(
            [
                {"name": "Firefox", "bundle_id": "org.mozilla.firefox", "active": False},
                {"name": "Readest", "bundle_id": "com.readest.app", "active": True},
            ]
        )
    )
    resp = client.get("/apps", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    apps = resp.json()["apps"]
    assert apps[0]["name"] == "Readest"  # frontmost sorts first
    assert {a["bundle_id"] for a in apps} == {"org.mozilla.firefox", "com.readest.app"}


def test_focus_app(client, fake_hs):
    resp = client.post("/apps/focus", headers=AUTH_HEADERS, json={"bundle_id": "com.readest.app"})
    assert resp.status_code == 200
    assert "launchOrFocusByBundleID" in fake_hs.calls[-1]
    assert "com.readest.app" in fake_hs.calls[-1]


def test_apps_require_auth(client, fake_hs):
    assert client.get("/apps").status_code == 401
    assert client.post("/apps/focus", json={"bundle_id": "x"}).status_code == 401
