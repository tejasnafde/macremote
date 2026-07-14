from pathlib import Path

VERSION_FILE = Path(__file__).resolve().parent.parent / "VERSION"


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_version_matches_file(client):
    resp = client.get("/version")
    assert resp.status_code == 200
    assert resp.json() == {"version": VERSION_FILE.read_text().strip()}
