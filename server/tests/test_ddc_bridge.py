import subprocess

import pytest

from common_helper.ddc_bridge import DDCError, parse_display_list, run_m1ddc
from config.settings import settings

# Canned sample from a real `m1ddc display list` run (see ddc_bridge.py for
# the format notes): "(null)" is m1ddc's placeholder when it can't read a
# monitor's name over DDC.
SAMPLE_LIST = (
    "[1] (null) (37D8832A-2D66-02CA-B9F7-8F30A301B230)\n"
    "[2] LG ULTRAGEAR (13D61039-774A-93BC-0857-D6964E3302DB)\n"
)


def test_parse_display_list_canned_sample():
    # The "(null)" phantom is dropped (DDC writes never stick on it); only the
    # real, named monitor survives.
    assert parse_display_list(SAMPLE_LIST) == [
        {"index": 2, "name": "LG ULTRAGEAR", "label": "LG ULTRAGEAR"},
    ]


def test_parse_display_list_empty():
    assert parse_display_list("") == []


def test_parse_display_list_ignores_garbage_lines():
    assert parse_display_list("DDC communication failure: unknown subsystem error\n") == []


def test_run_m1ddc_returns_stdout(fake_m1ddc):
    fake_m1ddc.set_response("display list", SAMPLE_LIST)
    assert run_m1ddc(["display", "list"]) == SAMPLE_LIST.strip()


def test_run_m1ddc_nonzero_exit_raises(fake_m1ddc):
    fake_m1ddc.set_default("DDC communication failure", exit_code=1)
    with pytest.raises(DDCError):
        run_m1ddc(["display", "1", "get", "luminance"])


def test_run_m1ddc_missing_binary_raises(monkeypatch):
    monkeypatch.setattr(settings, "M1DDC_BIN", "/no/such/binary/here")
    with pytest.raises(DDCError):
        run_m1ddc(["display", "list"])


def test_run_m1ddc_timeout_raises(monkeypatch):
    def fake_run(*args, **kwargs):
        raise subprocess.TimeoutExpired(cmd="m1ddc", timeout=5)

    monkeypatch.setattr(subprocess, "run", fake_run)
    with pytest.raises(DDCError):
        run_m1ddc(["display", "list"])


def test_unnamed_external_kept_by_uuid_builtin_dropped():
    """A monitor behind a name-stripping adapter lists as "(null)", same as the
    built-in panel. Only the built-in may be dropped (2026-09-24)."""
    raw = (
        "[1] (null) (37D8832A-2D66-02CA-B9F7-8F30A301B230)\n"
        "[2] (null) (E4DB018A-E193-64D6-0857-D6964E3302DB)\n"
    )
    builtin = {"37D8832A-2D66-02CA-B9F7-8F30A301B230"}
    assert parse_display_list(raw, builtin) == [
        {"index": 2, "name": "E4DB018A-E193-64D6-0857-D6964E3302DB", "label": "External display"}
    ]
    assert parse_display_list(raw) == [], "unknown built-in: hide unnamed entries as before"
