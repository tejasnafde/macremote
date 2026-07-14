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


@pytest.mark.asyncio
async def test_expiry_fades_volume_then_sleeps_and_alerts():
    hs_calls = []
    alert_calls = []

    async def fast_sleep(_seconds: float) -> None:
        return None

    def fake_run_hs(lua: str) -> str:
        hs_calls.append(lua)
        return "ok"

    service = SleepTimerService(sleep_fn=fast_sleep, run_hs_fn=fake_run_hs, alert_fn=lambda msg: alert_calls.append(msg))
    service.start(minutes=1)

    # Drive the task to completion with an instant fake clock.
    await asyncio.wait_for(service._task, timeout=2)

    fade_calls = [c for c in hs_calls if "outputVolume() -" in c]
    sleep_calls = [c for c in hs_calls if "systemSleep" in c]

    assert len(fade_calls) == FADE_STEPS
    assert len(sleep_calls) == 1
    assert alert_calls == ["sleep timer fired"]
    assert service.is_active() is False
    assert service.remaining_seconds() is None


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
