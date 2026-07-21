import json

from tests.conftest import AUTH_HEADERS


def _hs_windows(fake_hs, windows):
    fake_hs.set_output(json.dumps(windows))


def test_windows_shape_and_grouping(client, fake_hs):
    _hs_windows(
        fake_hs,
        [
            {
                "id": 11,
                "app": "Firefox",
                "bundle_id": "org.mozilla.firefox",
                "title": "Docs",
                "screen": "Built-in Retina Display",
                "screen_id": 1,
                "active": False,
            },
            {
                "id": 22,
                "app": "Firefox",
                "bundle_id": "org.mozilla.firefox",
                "title": "YouTube",
                "screen": "BenQ EX2710S",
                "screen_id": 2,
                "active": True,
            },
            {
                "id": 33,
                "app": "Alacritty",
                "bundle_id": "org.alacritty",
                "title": "zsh",
                "screen": "BenQ EX2710S",
                "screen_id": 2,
                "active": False,
            },
        ],
    )

    resp = client.get("/windows", headers=AUTH_HEADERS)

    assert resp.status_code == 200
    displays = resp.json()["displays"]
    # The display holding the active window comes first.
    assert [d["name"] for d in displays] == ["BenQ EX2710S", "Built-in Retina Display"]
    assert displays[0]["id"] == 2
    # Windows: active first, then app name; entries carry no screen fields.
    assert displays[0]["windows"] == [
        {
            "id": 22,
            "app": "Firefox",
            "bundle_id": "org.mozilla.firefox",
            "title": "YouTube",
            "active": True,
        },
        {
            "id": 33,
            "app": "Alacritty",
            "bundle_id": "org.alacritty",
            "title": "zsh",
            "active": False,
        },
    ]
    assert displays[1]["windows"][0]["id"] == 11


def test_windows_two_same_app_windows_on_different_displays(client, fake_hs):
    # The v0.4 motivating case: two Firefox windows, one per monitor - the
    # app-level switcher cannot tell them apart, /windows must.
    _hs_windows(
        fake_hs,
        [
            {"id": 1, "app": "Firefox", "bundle_id": "org.mozilla.firefox", "title": "A",
             "screen": "S1", "screen_id": 10, "active": False},
            {"id": 2, "app": "Firefox", "bundle_id": "org.mozilla.firefox", "title": "B",
             "screen": "S2", "screen_id": 20, "active": False},
        ],
    )

    resp = client.get("/windows", headers=AUTH_HEADERS)

    displays = resp.json()["displays"]
    assert {d["name"] for d in displays} == {"S1", "S2"}
    assert all(len(d["windows"]) == 1 for d in displays)


def test_windows_empty_list(client, fake_hs):
    fake_hs.set_output("[]")
    resp = client.get("/windows", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert resp.json() == {"displays": []}


def test_windows_hs_empty_table_encodes_as_object(client, fake_hs):
    # hs.json.encode({}) can emit an object for an empty Lua table.
    fake_hs.set_output("{}")
    resp = client.get("/windows", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert resp.json() == {"displays": []}


def test_windows_non_json_is_502(client, fake_hs):
    fake_hs.set_output("not json at all")
    resp = client.get("/windows", headers=AUTH_HEADERS)
    assert resp.status_code == 502


def test_focus_window(client, fake_hs):
    fake_hs.set_output("ok")
    resp = client.post("/windows/1234/focus", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert "hs.window.get(1234)" in fake_hs.calls[-1]
    assert "focus()" in fake_hs.calls[-1]


def test_focus_window_gone_is_not_5xx(client, fake_hs):
    fake_hs.set_output("gone")
    resp = client.post("/windows/999/focus", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert resp.json() == {"ok": False, "gone": True}


def test_windows_require_auth(client, fake_hs):
    assert client.get("/windows").status_code == 401
    assert client.post("/windows/1/focus").status_code == 401
