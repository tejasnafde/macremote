import asyncio

import pytest

from handler.sleep_timer_handler import FADE_STEPS, SleepTimerService


@pytest.mark.asyncio
async def test_start_marks_active_with_remaining_seconds():
    service = SleepTimerService(sleep_fn=asyncio.sleep, run_hs_fn=lambda lua: "ok", alert_fn=lambda msg: None)
    service.start(minutes=5)

    assert service.is_active()
    remaining = service.remaining_seconds()
    assert remaining is not None
    assert 0 < remaining <= 5 * 60

    service.cancel()
    await asyncio.sleep(0)  # let the cancellation propagate


@pytest.mark.asyncio
async def test_cancel_before_fire_stops_the_task_and_no_alert():
    alert_calls = []
    service = SleepTimerService(
        sleep_fn=asyncio.sleep,
        run_hs_fn=lambda lua: "ok",
        alert_fn=lambda msg: alert_calls.append(msg),
    )
    service.start(minutes=5)

    cancelled = service.cancel()
    await asyncio.sleep(0)

    assert cancelled is True
    assert service.is_active() is False
    assert service.remaining_seconds() is None
    assert alert_calls == []


@pytest.mark.asyncio
async def test_cancel_when_nothing_running_returns_false():
    service = SleepTimerService(sleep_fn=asyncio.sleep, run_hs_fn=lambda lua: "ok", alert_fn=lambda msg: None)
    assert service.cancel() is False


def make_fake_run_hs(hs_calls: list, playing_state: str = "playing"):
    """Fake hs bridge: records calls, answers VOLUME_GET / STATUS realistically."""
    import json as _json

    def fake_run_hs(lua: str) -> str:
        hs_calls.append(lua)
        if "tostring(math.floor" in lua:  # VOLUME_GET
            return "62"
        if "hs.json.encode" in lua:  # STATUS
            return _json.dumps(
                {"volume": 2, "muted": False, "brightness": 50, "battery": 90,
                 "nowplaying": {"title": "t", "artist": "a", "app": "Spotify", "state": playing_state}}
            )
        return "ok"

    return fake_run_hs


@pytest.mark.asyncio
async def test_expiry_fades_pauses_restores_volume_then_sleeps_and_alerts():
    hs_calls = []
    alert_calls = []

    async def fast_sleep(_seconds: float) -> None:
        return None

    service = SleepTimerService(
        sleep_fn=fast_sleep,
        run_hs_fn=make_fake_run_hs(hs_calls, playing_state="playing"),
        alert_fn=lambda msg: alert_calls.append(msg),
    )
    service.start(minutes=1)

    # Drive the task to completion with an instant fake clock.
    await asyncio.wait_for(service._task, timeout=2)

    fade_calls = [c for c in hs_calls if "outputVolume() -" in c]
    pause_calls = [c for c in hs_calls if 'newSystemKeyEvent("PLAY"' in c]
    restore_calls = [c for c in hs_calls if "setOutputVolume(math.max(0, math.min(100, 62)))" in c]
    sleep_calls = [c for c in hs_calls if "systemSleep" in c]

    assert len(fade_calls) == FADE_STEPS
    assert len(pause_calls) == 1, "media should be paused before sleeping"
    assert len(restore_calls) == 1, "pre-fade volume should be restored before sleeping"
    assert len(sleep_calls) == 1
    # ordering: fades happen before pause, pause before restore, restore before sleep
    assert hs_calls.index(pause_calls[0]) > hs_calls.index(fade_calls[-1])
    assert hs_calls.index(restore_calls[0]) > hs_calls.index(pause_calls[0])
    assert hs_calls.index(sleep_calls[0]) > hs_calls.index(restore_calls[0])
    assert alert_calls == ["sleep timer fired"]
    assert service.is_active() is False
    assert service.remaining_seconds() is None


@pytest.mark.asyncio
async def test_expiry_skips_pause_when_already_paused():
    hs_calls = []

    async def fast_sleep(_seconds: float) -> None:
        return None

    service = SleepTimerService(
        sleep_fn=fast_sleep,
        run_hs_fn=make_fake_run_hs(hs_calls, playing_state="paused"),
        alert_fn=lambda msg: None,
    )
    service.start(minutes=1)
    await asyncio.wait_for(service._task, timeout=2)

    pause_calls = [c for c in hs_calls if 'newSystemKeyEvent("PLAY"' in c]
    sleep_calls = [c for c in hs_calls if "systemSleep" in c]
    assert pause_calls == [], "must not toggle playback that is already paused"
    assert len(sleep_calls) == 1


@pytest.mark.asyncio
async def test_starting_a_new_timer_cancels_the_previous_one():
    alert_calls = []
    service = SleepTimerService(
        sleep_fn=asyncio.sleep,
        run_hs_fn=lambda lua: "ok",
        alert_fn=lambda msg: alert_calls.append(msg),
    )
    service.start(minutes=10)
    first_task = service._task

    service.start(minutes=20)
    await asyncio.sleep(0)

    assert first_task.cancelled() or first_task.done()
    assert service.is_active()
    assert alert_calls == []

    service.cancel()
    await asyncio.sleep(0)
