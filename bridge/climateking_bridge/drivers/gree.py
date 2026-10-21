"""Climate King and Gree units: Gree LAN protocol on UDP 7000, through greeclimate.

Why the old app dropped the connection after ~30 seconds, and what this driver does instead:

* One lost datagram used to mark the unit offline. Here every request is retried inside its own
  timeout, and the worker only reports "offline" after several polls in a row fail.
* When the router hands the unit a new IP address the stored one stops answering. On failure the
  driver re-scans the LAN, finds the unit by MAC and carries on at the new address.
* The bind key is renegotiated whenever a session is lost (module reboot, new key after a reset),
  instead of reusing a key the unit no longer accepts.
* The phone is not the one holding the session: the bridge stays on the home Wi-Fi all the time,
  so closing the app or leaving the house no longer ends it.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from greeclimate.cipher import CipherV1, CipherV2
from greeclimate.device import Device, DeviceInfo
from greeclimate.discovery import Discovery
from greeclimate.exceptions import DeviceNotBoundError, DeviceTimeoutError
from greeclimate.network import Response

from ..state import AcState, Airflow, Axis, clamp_temp
from .base import Driver, DriverError, Unreachable

_LOGGER = logging.getLogger(__name__)

GREE_PORT = 7000
REPLY_TIMEOUT = 2.0
ATTEMPTS = 3
SCAN_SECONDS = 3

MODE_FROM_GREE = {0: "auto", 1: "cool", 2: "dry", 3: "fan", 4: "heat"}
MODE_TO_GREE = {mode: code for code, mode in MODE_FROM_GREE.items()}
FAN_FROM_GREE = {0: "auto", 1: "low", 2: "mediumLow", 3: "medium", 4: "mediumHigh", 5: "high"}
FAN_TO_GREE = {"auto": 0, "quiet": 1, "low": 1, "mediumLow": 2, "medium": 3, "mediumHigh": 4, "high": 5, "turbo": 5}


def axis_from_gree(raw: Any) -> Axis:
    """SwUpDn / SwingLfRig: 0 default, 1 full swing, 2-6 fixed positions, 7-11 partial swings."""
    if not isinstance(raw, int) or raw == 0:
        return Axis("off")
    if raw == 1 or raw >= 7:
        return Axis("swing")
    return Axis("fixed", raw - 1)


def axis_to_gree(axis: Axis) -> int:
    if axis.mode == "swing":
        return 1
    if axis.mode == "fixed":
        return axis.angle + 1
    return 0


def state_from_props(props: dict[str, Any], current_temp: float | None) -> AcState:
    """Map Gree properties to the shared state. Raises DriverError when the reply is empty."""
    if "Pow" not in props:
        raise DriverError("The unit answered without its power state.")
    if props.get("Tur") == 1:
        fan = "turbo"
    elif props.get("Quiet") in (1, 2):
        fan = "quiet"
    else:
        fan = FAN_FROM_GREE.get(props.get("WdSpd"), "auto")
    target = props.get("SetTem")
    return AcState(
        is_on=props.get("Pow") == 1,
        mode=MODE_FROM_GREE.get(props.get("Mod"), "cool"),
        target_temp=clamp_temp(target) if isinstance(target, (int, float)) else 24,
        current_temp=current_temp,
        fan_speed=fan,
        airflow=Airflow(axis_from_gree(props.get("SwUpDn")), axis_from_gree(props.get("SwingLfRig"))),
    )


def props_for(target: AcState, patch: dict[str, Any]) -> dict[str, int]:
    """The Gree properties a patch touches, taken from the full target state."""
    props: dict[str, int] = {}
    if "isOn" in patch:
        props["Pow"] = int(target.is_on)
    if "mode" in patch:
        props["Mod"] = MODE_TO_GREE[target.mode]
    if "targetTemp" in patch:
        props["SetTem"] = int(round(target.target_temp))
        props["TemUn"] = 0
        props["TemRec"] = 0
    if "fanSpeed" in patch:
        props["WdSpd"] = FAN_TO_GREE[target.fan_speed]
        props["Quiet"] = 1 if target.fan_speed == "quiet" else 0
        props["Tur"] = 1 if target.fan_speed == "turbo" else 0
    if "airflow" in patch:
        props["SwUpDn"] = axis_to_gree(target.airflow.vertical)
        props["SwingLfRig"] = axis_to_gree(target.airflow.horizontal)
    return props


class GreeDriver(Driver):
    def __init__(self, record) -> None:
        super().__init__(record)
        self._device: Device | None = None
        self._misses = 0

    async def _connect(self) -> Device:
        if self._device is not None and self._device.ready.is_set():
            return self._device
        await self._drop()
        if not self.record.ip:
            raise Unreachable("The unit's IP address is not known yet.")
        known = {"v1": CipherV1, "v2": CipherV2}.get(self.record.secrets.get("cipher"))
        # The cipher that worked last time first; None lets greeclimate try v1 then v2.
        ciphers = [known, None] if known else [None]
        for attempt in range(ATTEMPTS):
            info = DeviceInfo(self.record.ip, GREE_PORT, self.record.mac, self.record.name)
            device = Device(info, timeout=10, bind_timeout=REPLY_TIMEOUT)
            cipher = ciphers[min(attempt, len(ciphers) - 1)]
            try:
                await device.bind(cipher=cipher() if cipher else None)
            except (DeviceTimeoutError, DeviceNotBoundError, OSError, asyncio.TimeoutError):
                device.close()
                continue
            key = device.device_cipher.key if device.device_cipher else None
            if key:
                self.update_secrets(key=key, cipher="v2" if isinstance(device.device_cipher, CipherV2) else "v1")
            self._device = device
            self._misses = 0
            return device
        raise Unreachable(f"No answer from {self.record.ip}.")

    async def _exchange(self, response: Response, send) -> None:
        """Run `send` until the unit answers with `response`, retrying inside the timeout."""
        fresh = self._device is None or not self._device.ready.is_set()
        device = await self._connect()
        got = asyncio.Event()

        def handler(*_args: Any) -> None:
            got.set()

        device.add_handler(response, handler)
        try:
            if fresh and response is Response.DATA:
                # greeclimate asks for status by itself right after binding. Wait for that answer
                # rather than sending a second request whose late reply would then be mistaken
                # for the answer to the next poll.
                try:
                    await asyncio.wait_for(got.wait(), REPLY_TIMEOUT)
                    return
                except asyncio.TimeoutError:
                    pass
            for _ in range(ATTEMPTS):
                got.clear()
                try:
                    await send(device)
                    await asyncio.wait_for(got.wait(), REPLY_TIMEOUT)
                    self._misses = 0
                    return
                except (asyncio.TimeoutError, DeviceTimeoutError):
                    continue
                except (DeviceNotBoundError, OSError) as exc:
                    await self._drop()
                    raise Unreachable(f"Lost the session with {self.record.ip}.") from exc
        finally:
            try:
                device.remove_handler(response, handler)
            except ValueError:
                pass
        # Keep the session through one bad patch of Wi-Fi; after two, bind again in case the unit
        # rebooted or was reset and no longer accepts the old key.
        self._misses += 1
        if self._misses >= 2:
            await self._drop()
        raise Unreachable(f"No answer from {self.record.ip}.")

    async def read(self) -> AcState:
        await self._exchange(Response.DATA, lambda device: device.update_state())
        device = self._device
        assert device is not None
        return state_from_props(dict(device.raw_properties), device.current_temperature)

    async def apply(self, target: AcState, patch: dict[str, Any]) -> AcState | None:
        props = props_for(target, patch)
        if not props:
            return None

        async def send(device: Device) -> None:
            await device.send(device.create_command_message(device.device_info, **props))

        await self._exchange(Response.RESULT, send)
        device = self._device
        assert device is not None
        # The RESULT reply only echoes what changed; keep the local copy in step with it.
        device.raw_properties.update(props)
        return state_from_props(dict(device.raw_properties), device.current_temperature)

    async def locate(self) -> str | None:
        found = await scan(SCAN_SECONDS)
        for info in found:
            if normalize(info.mac) == self.record.mac and info.ip != self.record.ip:
                _LOGGER.info("%s moved from %s to %s", self.record.name, self.record.ip, info.ip)
                await self._drop()
                return info.ip
        return None

    def set_ip(self, ip: str) -> None:
        super().set_ip(ip)
        if self._device is not None:
            self._device.close()
            self._device = None

    async def _drop(self) -> None:
        if self._device is not None:
            self._device.close()
            self._device = None

    async def close(self) -> None:
        await self._drop()


def normalize(mac: str) -> str:
    return mac.replace(":", "").replace("-", "").lower()


async def scan(seconds: int = SCAN_SECONDS) -> list[DeviceInfo]:
    """Broadcast a Gree scan on every interface and return what answered."""
    discovery = Discovery(timeout=seconds)
    try:
        return list(await discovery.scan(wait_for=seconds))
    finally:
        discovery.close()
