import subprocess

import common_helper.hs_bridge as hb


def test_run_hs_retries_once_on_stale_ipc_port(monkeypatch):
    calls = []

    def fake_invoke(lua):
        calls.append(lua)
        if len(calls) == 1:
            return subprocess.CompletedProcess([], 65, stdout="", stderr="ipc port is no longer valid (early)")
        return subprocess.CompletedProcess([], 0, stdout="ok", stderr="")

    monkeypatch.setattr(hb, "_invoke", fake_invoke)
    monkeypatch.setattr(hb.time, "sleep", lambda _s: None)

    assert hb.run_hs("whatever") == "ok"
    assert len(calls) == 2  # failed once (stale port), retried, succeeded


def test_run_hs_no_retry_on_other_errors(monkeypatch):
    calls = []

    def fake_invoke(lua):
        calls.append(lua)
        return subprocess.CompletedProcess([], 1, stdout="", stderr="some other error")

    monkeypatch.setattr(hb, "_invoke", fake_invoke)
    try:
        hb.run_hs("x")
        assert False, "expected HSError"
    except hb.HSError:
        pass
    assert len(calls) == 1  # non-transient error: no retry


def test_run_hs_relaunches_missing_hammerspoon_and_retries(monkeypatch):
    """Hammerspoon quit overnight and every call timed out until morning."""
    import subprocess

    calls = []

    def fake_invoke(lua):
        calls.append(lua)
        if len(calls) == 1:
            raise subprocess.TimeoutExpired("hs", 5)
        return subprocess.CompletedProcess([], 0, "ok\n", "")

    monkeypatch.setattr(hb, "_invoke", fake_invoke)
    monkeypatch.setattr(hb, "_relaunch_hammerspoon", lambda: True)
    assert hb.run_hs("return 1") == "ok"
    assert len(calls) == 2


def test_run_hs_timeout_with_hammerspoon_running_is_not_retried(monkeypatch):
    import subprocess

    import pytest

    calls = []

    def fake_invoke(lua):
        calls.append(lua)
        raise subprocess.TimeoutExpired("hs", 5)

    monkeypatch.setattr(hb, "_invoke", fake_invoke)
    monkeypatch.setattr(hb, "_relaunch_hammerspoon", lambda: False)
    with pytest.raises(hb.HSError):
        hb.run_hs("return 1")
    assert len(calls) == 1
