import pytest

from common_helper.auth import validate_api_token
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


@pytest.mark.parametrize(
    "token",
    ["", "   ", "change-me-to-a-long-random-token", "changeme"],
)
def test_server_rejects_empty_or_placeholder_configured_tokens(token):
    with pytest.raises(RuntimeError, match="API_TOKEN"):
        validate_api_token(token)


@pytest.mark.parametrize("token", ["existing-short-token", "a-secure-random-token-that-is-long-enough"])
def test_server_accepts_existing_non_placeholder_tokens_during_upgrade(token):
    assert validate_api_token(token) is None
