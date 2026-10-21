from datetime import timedelta

from climateking_bridge.worker import Command, DeviceWorker, Settings
from fakes import FakeClock, FakeDriver, FakeStore, now, record


def make(ip="10.0.0.5", home_ip=None, **settings):
    rec = record(ip)
    driver = FakeDriver(rec, home_ip)
    store = FakeStore()
    worker = DeviceWorker(rec, driver, store, Settings(readback_delay=0, **settings), clock=FakeClock())
    return worker, driver, store


async def test_one_missed_reply_does_not_mark_the_unit_offline():
    worker, driver, store = make()
    await worker.poll()
    assert store.online_flags == [True]
    driver.answering = False
    await worker.poll()
    await worker.poll()
    assert store.online_flags == [True], "two misses in a row must not flip the unit offline"
    await worker.poll()
    assert store.online_flags == [True, False]
    assert store.reports[-1][2] == "no answer"


async def test_offline_is_reported_once_and_recovery_is_immediate():
    worker, driver, store = make()
    driver.answering = False
    for _ in range(6):
        await worker.poll()
    assert store.online_flags == [False]
    driver.answering = True
    await worker.poll()
    assert store.online_flags == [False, True]


async def test_unit_that_moved_ip_is_found_again_by_mac():
    worker, driver, store = make(ip="10.0.0.5", home_ip="10.0.0.77")
    await worker.poll()  # first miss: no search yet
    assert driver.locates == 0
    await worker.poll()  # second miss: search the LAN
    assert driver.locates == 1
    assert store.ips == ["10.0.0.77"] and worker.record.ip == "10.0.0.77"
    await worker.poll()
    assert store.online_flags == [True], "the unit was never reported offline"


async def test_command_is_applied_and_confirmed():
    worker, driver, store = make()
    await worker.poll()
    await worker.execute(Command(7, "ac-1", {"isOn": True, "targetTemp": 22}, now()))
    assert driver.applied == [{"isOn": True, "targetTemp": 22}]
    assert store.finished[7] == ("done", None)
    assert store.reports[-1][0].is_on and store.reports[-1][0].target_temp == 22


async def test_command_after_ip_change_is_retried_at_the_new_address():
    worker, driver, store = make(ip="10.0.0.5", home_ip="10.0.0.9")
    await worker.execute(Command(8, "ac-1", {"isOn": True}, now()))
    assert store.finished[8][0] == "done"
    assert worker.record.ip == "10.0.0.9"


async def test_old_commands_expire_instead_of_switching_the_ac_on_later():
    worker, driver, store = make(command_ttl=120)
    await worker.execute(Command(9, "ac-1", {"isOn": True}, now() - timedelta(minutes=10)))
    assert store.finished[9][0] == "expired"
    assert driver.applied == []


async def test_invalid_command_fails_without_touching_the_unit():
    worker, driver, store = make()
    await worker.execute(Command(10, "ac-1", {"mode": "jet"}, now()))
    assert store.finished[10][0] == "failed"
    assert driver.applied == []


async def test_unreachable_command_fails_with_a_reason():
    worker, driver, store = make()
    driver.answering = False
    await worker.execute(Command(11, "ac-1", {"isOn": True}, now()))
    assert store.finished[11] == ("failed", "no answer")


async def test_missing_key_is_reported_as_setup_not_as_offline_noise():
    worker, driver, store = make()
    driver.needs_key = True
    await worker.poll()
    assert store.reports == [(None, False, "needs key")]
    assert worker.failures == 0


async def test_learned_secrets_are_saved():
    worker, driver, store = make()
    await worker.poll()
    assert store.secrets == {"key": "learned-key"}
