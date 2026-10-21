"""The Gree driver against the virtual Gree AC (real encrypted protocol over UDP on localhost)."""

import random
import socket

import pytest

from climateking_bridge.drivers import gree
from climateking_bridge.drivers.base import DeviceRecord, Unreachable
from climateking_bridge.state import AcState, apply_patch
from gree_ac import VirtualGree, serve


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture
async def unit(monkeypatch, request):
    port = free_port()
    monkeypatch.setattr(gree, "GREE_PORT", port)
    monkeypatch.setattr(gree, "REPLY_TIMEOUT", 0.5)
    ac = VirtualGree(cipher=getattr(request, "param", "v1"))
    transport = await serve(ac, "127.0.0.1", port)
    yield ac
    transport.close()


def driver_for(ac: VirtualGree, secrets=None) -> gree.GreeDriver:
    rec = DeviceRecord(id="ck", name="Living room", brand="gree", vendor="Climate King",
                       ip="127.0.0.1", mac=ac.mac, secrets=dict(secrets or {}))
    return gree.GreeDriver(rec)


@pytest.mark.parametrize("unit", ["v1", "v2"], indirect=True)
async def test_read_binds_and_reports_state(unit):
    unit.props.update({"Pow": 1, "Mod": 4, "SetTem": 27, "WdSpd": 3, "SwUpDn": 1})
    driver = driver_for(unit)
    state = await driver.read()
    assert state.is_on and state.mode == "heat" and state.target_temp == 27
    assert state.fan_speed == "medium" and state.airflow.vertical.mode == "swing"
    assert state.current_temp == unit.room_temp
    learned = driver.take_secret_changes()
    assert learned == {"key": unit.key, "cipher": unit.cipher}
    await driver.close()


async def test_apply_changes_the_unit(unit):
    driver = driver_for(unit)
    state = await driver.read()
    patch = {"isOn": True, "mode": "cool", "targetTemp": 21, "fanSpeed": "turbo",
             "airflow": {"vertical": {"mode": "fixed", "angle": 2}}}
    echoed = await driver.apply(apply_patch(state, patch), patch)
    assert unit.props["Pow"] == 1 and unit.props["Mod"] == 1 and unit.props["SetTem"] == 21
    assert unit.props["Tur"] == 1 and unit.props["WdSpd"] == 5 and unit.props["SwUpDn"] == 3
    assert echoed.is_on and echoed.fan_speed == "turbo" and echoed.airflow.vertical.angle == 2
    await driver.close()


async def test_survives_heavy_packet_loss(unit):
    random.seed(7)  # the simulator drops replies at random; keep the run repeatable
    unit.drop = 0.5
    driver = driver_for(unit)
    successes = 0
    for _ in range(10):
        try:
            await driver.read()
            successes += 1
        except Unreachable:
            pass
    # Each request is retried 3 times, so a poll fails only when all 3 replies are lost (1 in 8),
    # and the worker needs 3 failed polls in a row before it reports offline.
    assert successes >= 7
    await driver.close()


async def test_rebinds_after_the_unit_gets_a_new_key(unit):
    driver = driver_for(unit)
    await driver.read()
    unit.key = "NewKeyAfterReset"
    for _ in range(2):  # the old session is kept through one miss, dropped after two
        with pytest.raises(Unreachable):
            await driver.read()
    state = await driver.read()  # fresh bind with the new key
    assert isinstance(state, AcState)
    assert driver.take_secret_changes()["key"] == "NewKeyAfterReset"
    await driver.close()


async def test_unreachable_when_nothing_answers(monkeypatch):
    monkeypatch.setattr(gree, "GREE_PORT", free_port())
    monkeypatch.setattr(gree, "REPLY_TIMEOUT", 0.2)
    driver = driver_for(VirtualGree())
    with pytest.raises(Unreachable):
        await driver.read()
