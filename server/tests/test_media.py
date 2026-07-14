import pytest

from tests.conftest import AUTH_HEADERS


@pytest.mark.parametrize(
    "path,expected_key",
    [
        ("/media/playpause", "PLAY"),
        ("/media/next", "FAST"),
        ("/media/previous", "REWIND"),
    ],
)
def test_media_happy_path(client, fake_hs, path, expected_key):
    resp = client.post(path, headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert len(fake_hs.calls) == 1
    assert expected_key in fake_hs.calls[0]


def test_media_hs_failure_returns_502_and_alerts(client, fake_hs, monkeypatch):
    fake_hs.set_exit_code(1)
    fake_hs.set_output("boom")

    alert_calls = []
    monkeypatch.setattr("main.alert", lambda **kw: alert_calls.append(kw))

    resp = client.post("/media/playpause", headers=AUTH_HEADERS)

    assert resp.status_code == 502
    assert resp.json() == {"error": "hammerspoon bridge failed"}
    assert len(alert_calls) == 1


def test_unhandled_exception_returns_500_and_alerts(client, monkeypatch):
    async def boom():
        raise RuntimeError("kaboom")

    monkeypatch.setattr("routers.media.media_handler.playpause", boom)

    alert_calls = []
    monkeypatch.setattr("main.alert", lambda **kw: alert_calls.append(kw))

    resp = client.post("/media/playpause", headers=AUTH_HEADERS)

    assert resp.status_code == 500
    assert resp.json() == {"error": "internal server error"}
    assert len(alert_calls) == 1
