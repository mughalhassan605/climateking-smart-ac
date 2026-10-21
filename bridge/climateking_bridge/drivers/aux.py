"""Kenwood (AC Freedom app) and other AUX-built units, over BroadLink UDP 80."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import broadlink
from broadlink import exceptions as bl_errors

from ..protocols import aux
from ..state import AcState, Airflow, Axis
from .base import Driver, DriverError, Unreachable

_LOGGER = logging.getLogger(__name__)

TIMEOUT = 3
DISCOVER_SECONDS = 4


def to_state(raw: aux.AuxState, ambient: float | None) -> AcState:
    if raw.mute:
        fan = "quiet"
    elif raw.turbo:
        fan = "turbo"
    else:
        fan = {aux.FAN_HIGH: "high", aux.FAN_MEDIUM: "medium", aux.FAN_LOW: "low"}.get(raw.fan, "auto")
    vertical = (
        Axis("fixed", raw.vane_v) if 1 <= raw.vane_v <= 5 else Axis("swing" if raw.vane_v in (0, 6) else "off")
    )
    horizontal = Axis("swing") if raw.vane_h == aux.VANE_SWING_H else Axis("off")
    return AcState(
        is_on=bool(raw.power),
        mode=aux.MODE_FROM_CODE.get(raw.mode, "cool"),
        target_temp=raw.temp,
        current_temp=ambient,
        fan_speed=fan,
        airflow=Airflow(vertical, horizontal),
    )


def to_raw(base: aux.AuxState, target: AcState, patch: dict[str, Any]) -> aux.AuxState:
    changes: dict[str, Any] = {}
    if "isOn" in patch:
        changes["power"] = int(target.is_on)
    if "mode" in patch:
        changes["mode"] = aux.MODE_CODES[target.mode]
    if "targetTemp" in patch:
        changes["temp"] = target.target_temp
    if "fanSpeed" in patch:
        speed = target.fan_speed
        changes["mute"] = int(speed == "quiet")
        changes["turbo"] = int(speed == "turbo")
        changes["fan"] = {
            "auto": aux.FAN_AUTO,
            "quiet": aux.FAN_LOW,
            "low": aux.FAN_LOW,
            "mediumLow": aux.FAN_LOW,
            "medium": aux.FAN_MEDIUM,
            "mediumHigh": aux.FAN_HIGH,
            "high": aux.FAN_HIGH,
            "turbo": aux.FAN_HIGH,
        }[speed]
    if "airflow" in patch:
        v, h = target.airflow.vertical, target.airflow.horizontal
        changes["vane_v"] = v.angle if v.mode == "fixed" else aux.VANE_SWING_V if v.mode == "swing" else aux.VANE_OFF_V
        changes["vane_h"] = aux.VANE_SWING_H if h.mode == "swing" else aux.VANE_OFF_H
    return aux.with_changes(base, **changes)


class AuxDriver(Driver):
    # BroadLink firmware v53+ reboots its Wi-Fi module when it cannot reach the cloud unless it is
    # pinged at least every two minutes; the ping is harmless on older firmware.
    keepalive_seconds = 90

    def __init__(self, record) -> None:
        super().__init__(record)
        self._device: broadlink.Device | None = None
        self._raw: aux.AuxState | None = None

    def _connect(self) -> broadlink.Device:
        if self._device is not None:
            return self._device
        if not self.record.ip or not self.record.mac:
            raise Unreachable("The unit's IP or MAC address is not known yet.")
        device = broadlink.Device(
            (self.record.ip, 80), bytes.fromhex(self.record.mac), aux.DEVTYPE, timeout=TIMEOUT
        )
        try:
            device.auth()
        except bl_errors.NetworkTimeoutError as exc:
            raise Unreachable(f"No answer from {self.record.ip}.") from exc
        except bl_errors.BroadlinkException as exc:
            raise DriverError(
                "The unit refused the local login. In AC Freedom, turn off 'Lock device' for this AC."
            ) from exc
        self._device = device
        return device

    def _request(self, payload: bytes) -> bytes:
        device = self._connect()
        try:
            response = device.send_packet(0x6A, payload)
            bl_errors.check_error(response[0x22:0x24])
            return device.decrypt(response[0x38:])
        except bl_errors.NetworkTimeoutError as exc:
            self._device = None
            raise Unreachable(f"No answer from {self.record.ip}.") from exc
        except bl_errors.BroadlinkException as exc:
            # A rejected session key after the module rebooted: log in again on the next call.
            self._device = None
            raise Unreachable(f"The unit dropped the session ({exc}).") from exc

    def _read_sync(self) -> AcState:
        try:
            raw = aux.decode_state(self._request(aux.GET_STATE))
        except aux.AuxDecodeError as exc:
            raise DriverError(f"Unexpected reply from the unit: {exc}.") from exc
        try:
            ambient = aux.decode_ambient(self._request(aux.GET_INFO))
        except DriverError:
            ambient = None
        self._raw = raw
        return to_state(raw, ambient)

    async def read(self) -> AcState:
        return await asyncio.to_thread(self._read_sync)

    def _apply_sync(self, target: AcState, patch: dict[str, Any]) -> None:
        if self._raw is None:
            self._read_sync()
        assert self._raw is not None
        wanted = to_raw(self._raw, target, patch)
        self._request(aux.encode_set_state(wanted))
        self._raw = wanted

    async def apply(self, target: AcState, patch: dict[str, Any]) -> AcState | None:
        await asyncio.to_thread(self._apply_sync, target, patch)
        return None

    async def keepalive(self) -> None:
        if self.record.ip:
            await asyncio.to_thread(broadlink.ping, self.record.ip)

    async def locate(self) -> str | None:
        found = await asyncio.to_thread(broadlink.discover, timeout=DISCOVER_SECONDS)
        for device in found:
            if device.mac.hex() == self.record.mac and device.host[0] != self.record.ip:
                return device.host[0]
        return None

    def set_ip(self, ip: str) -> None:
        super().set_ip(ip)
        self._device = None
