from tests.conftest import AUTH_HEADERS


def test_health_exempt_from_auth(client):
    resp = client.get("/health")
    assert resp.status_code == 200


def test_version_exempt_from_auth(client):
    resp = client.get("/version")
    assert resp.status_code == 200


def test_protected_endpoint_without_token_is_401(client):
    resp = client.post("/media/playpause")
    assert resp.status_code == 401


def test_protected_endpoint_with_wrong_token_is_401(client):
    resp = client.post("/media/playpause", headers={"Authorization": "Bearer nope"})
    assert resp.status_code == 401


def test_protected_endpoint_with_correct_token_is_200(client, fake_hs):
    resp = client.post("/media/playpause", headers=AUTH_HEADERS)
    assert resp.status_code == 200
