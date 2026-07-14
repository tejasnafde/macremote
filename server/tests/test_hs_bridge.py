import subprocess

import pytest

from common_helper.hs_bridge import HSError, run_hs
from config.settings import settings


def test_run_hs_returns_stdout(fake_hs):
    fake_hs.set_output("hello")
    assert run_hs("return 1") == "hello"


def test_run_hs_nonzero_exit_raises(fake_hs):
    fake_hs.set_exit_code(1)
    fake_hs.set_output("bad lua")
    with pytest.raises(HSError):
        run_hs("this is broken")


def test_run_hs_missing_binary_raises(monkeypatch):
    monkeypatch.setattr(settings, "HS_BIN", "/no/such/binary/here")
    with pytest.raises(HSError):
        run_hs("return 1")


def test_run_hs_timeout_raises(monkeypatch):
    def fake_run(*args, **kwargs):
        raise subprocess.TimeoutExpired(cmd="hs", timeout=5)

    monkeypatch.setattr(subprocess, "run", fake_run)
    with pytest.raises(HSError):
        run_hs("return 1")
