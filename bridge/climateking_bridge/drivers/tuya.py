"""Hyundai and other Smart Life / Tuya units (TCP 6668), with the Tuya cloud as a backup.

Local control needs the unit's `local_key`, which Tuya only hands out through its cloud. Put Tuya IoT
Platform credentials in bridge.env and run `climateking-bridge tuya-sync` once: the bridge fetches
every unit's id and key from the cloud and stores them (see README). With the same credentials the
bridge also falls back to the cloud when the unit does not answer locally.

Data points vary by model. The defaults below are Tuya's standard air-conditioner (category `kt`)
layout; a unit that differs can be given a `dp_map` in its secrets.
"""

from __future__ import annotations

import asyncio
import json
import logging
import socket
import time
from typing import Any

import tinytuya

from ..state import AcState, clamp_temp
from .base import Driver, DriverError, NeedsSetup, Unreachable

_LOGGER = logging.getLogger(__name__)

DEFAULT_DP_MAP = {"power": "1", "target": "2", "current": "3", "mode": "4", "fan": "5"}
VERSIONS = ("3.3", "3.4", "3.5", "3.1")
ERR_KEY_OR_VERSION = "914"
UNREACHABLE_ERRORS = {"901", "902", "905"}

# Tuya units name the same mode differently; both spellings are understood when reading.
MODE_FROM_TUYA = {
    "cold": "cool", "cool": "cool", "cooling": "cool",
    "hot": "heat", "heat": "heat", "heating": "heat",
    "wet": "dry", "dry": "dry", "dehumidification": "dry",
    "wind": "fan", "fan": "fan", "fan_only": "fan",
    "auto": "auto", "smart": "auto",
}
MODE_VOCAB_STANDARD = {"cool": "cold", "heat": "hot", "dry": "wet", "fan": "wind", "auto": "auto"}
MODE_VOCAB_PLAIN = {"cool": "cool", "heat": "heat", "dry": "dry", "fan": "fan", "auto": "auto"}

FAN_FROM_TUYA = {
    "auto": "auto", "low": "low", "middle": "medium", "mid": "medium", "medium": "medium",
    "high": "high", "strong": "turbo", "turbo": "turbo", "mute": "quiet", "quiet": "quiet",
    "sleep": "quiet",
}
FAN_TO_TUYA = {
    "auto": "auto", "quiet": "low", "low": "low", "mediumLow": "low", "medium": "middle",
    "mediumHigh": "high", "high": "high", "turbo": "high",
}


def mode_vocab(seen: str | None) -> dict[str, str]:
    return MODE_VOCAB_PLAIN if seen in MODE_VOCAB_PLAIN.values() and seen != "auto" else MODE_VOCAB_STANDARD


def fan_word(speed: str, seen: str | None) -> str:
    word = FAN_TO_TUYA[speed]
    if word == "middle" and seen in ("mid", "medium"):
        return seen
    return word


class TuyaValues:
    """Translates between data point values and the shared state for one unit."""

    def __init__(self, dp_map: dict[str, str] | None = None) -> None:
        self.dp = {**DEFAULT_DP_MAP, **{k: str(v) for k, v in (dp_map or {}).items()}}
        self.temp_scale = 1
        self.seen_mode: str | None = None
        self.seen_fan: str | None = None

    def to_state(self, dps: dict[str, Any], fallback: AcState) -> AcState:
        target = dps.get(self.dp["target"])
        if isinstance(target, (int, float)) and target > 60:
            self.temp_scale = 10
        current = dps.get(self.dp["current"])
        mode = dps.get(self.dp["mode"])
        fan = dps.get(self.dp["fan"])
        if isinstance(mode, str):
            self.seen_mode = mode
        if isinstance(fan, str):
            self.seen_fan = fan
        power = dps.get(self.dp["power"])
        return AcState(
            is_on=bool(power) if power is not None else fallback.is_on,
            mode=MODE_FROM_TUYA.get(mode, fallback.mode) if isinstance(mode, str) else fallback.mode,
            target_temp=clamp_temp(target / self.temp_scale) if isinstance(target, (int, float)) else fallback.target_temp,
            current_temp=round(current / self.temp_scale, 1) if isinstance(current, (int, float)) else fallback.current_temp,
            fan_speed=FAN_FROM_TUYA.get(fan, fallback.fan_speed) if isinstance(fan, str) else fallback.fan_speed,
            airflow=fallback.airflow,
        )

    def to_dps(self, target: AcState, patch: dict[str, Any]) -> dict[str, Any]:
        dps: dict[str, Any] = {}
        if "isOn" in patch:
            dps[self.dp["power"]] = target.is_on
        if "mode" in patch:
            dps[self.dp["mode"]] = mode_vocab(self.seen_mode)[target.mode]
        if "targetTemp" in patch:
            dps[self.dp["target"]] = int(round(target.target_temp * self.temp_scale))
        if "fanSpeed" in patch:
            dps[self.dp["fan"]] = fan_word(target.fan_speed, self.seen_fan)
        return dps

    def to_cloud_commands(self, target: AcState, patch: dict[str, Any]) -> list[dict[str, Any]]:
        """The same change in Tuya's standard instruction set, for the cloud API."""
        commands: list[dict[str, Any]] = []
        if "isOn" in patch:
            commands.append({"code": "switch", "value": target.is_on})
        if "mode" in patch:
            commands.append({"code": "mode", "value": MODE_VOCAB_STANDARD[target.mode]})
        if "targetTemp" in patch:
            commands.append({"code": "temp_set", "value": int(round(target.target_temp * self.temp_scale))})
        if "fanSpeed" in patch:
            commands.append({"code": "fan_speed_enum", "value": FAN_TO_TUYA[target.fan_speed]})
        return commands

    def from_cloud_status(self, status: list[dict[str, Any]], fallback: AcState) -> AcState:
        by_code = {item.get("code"): item.get("value") for item in status if isinstance(item, dict)}
        dps = {
            self.dp["power"]: by_code.get("switch"),
            self.dp["target"]: by_code.get("temp_set"),
            self.dp["current"]: by_code.get("temp_current"),
            self.dp["mode"]: by_code.get("mode"),
            self.dp["fan"]: by_code.get("fan_speed_enum", by_code.get("windspeed")),
        }
        return self.to_state({k: v for k, v in dps.items() if v is not None}, fallback)


class TuyaDriver(Driver):
    def __init__(self, record, cloud: tinytuya.Cloud | None = None) -> None:
        super().__init__(record)
        self.cloud = cloud
        self.values = TuyaValues(record.secrets.get("dp_map"))
        self._last = record.last_state

    @property
    def _device_id(self) -> str | None:
        return self.record.secrets.get("device_id") or self.record.cloud_id

    def _local(self, version: str) -> tinytuya.Device:
        device = tinytuya.Device(
            self._device_id,
            address=self.record.ip,
            local_key=self.record.secrets.get("local_key"),
            version=float(version),
            connection_timeout=3,
            connection_retry_limit=2,
            connection_retry_delay=1,
        )
        return device

    def _call_local(self, action) -> dict[str, Any]:
        """Run `action(device)`, discovering the protocol version on first use."""
        if not self._device_id or not self.record.secrets.get("local_key"):
            raise NeedsSetup(
                "This Smart Life unit needs its Tuya local key. Run `climateking-bridge tuya-sync` "
                "on the bridge, or enter the key in the app."
            )
        if not self.record.ip:
            raise Unreachable("The unit's IP address is not known yet.")
        known = self.record.secrets.get("version")
        versions = [known] if known else list(VERSIONS)
        last_error = None
        for version in versions:
            result = action(self._local(version))
            error = str(result.get("Err")) if isinstance(result, dict) and "Err" in result else None
            if error is None:
                if not known:
                    self.update_secrets(version=version)
                return result if isinstance(result, dict) else {}
            last_error = result
            if error in UNREACHABLE_ERRORS:
                raise Unreachable(f"No answer from {self.record.ip}.")
            if error != ERR_KEY_OR_VERSION:
                break
        if known:
            # The stored version stopped working (firmware update?): probe all of them next time.
            self.update_secrets(version=None)
        raise DriverError(f"The unit rejected the local key or protocol version ({last_error}).")

    def _read_local(self) -> AcState:
        result = self._call_local(lambda device: device.status())
        dps = result.get("dps") or {}
        return self.values.to_state({str(k): v for k, v in dps.items()}, self._last)

    def _read_cloud(self) -> AcState:
        if self.cloud is None or not self.record.cloud_id:
            raise Unreachable("No local answer and no Tuya cloud configured.")
        result = self.cloud.getstatus(self.record.cloud_id)
        if not isinstance(result, dict) or not result.get("success"):
            raise Unreachable(f"Tuya cloud could not reach the unit ({_cloud_error(result)}).")
        return self.values.from_cloud_status(result.get("result") or [], self._last)

    async def read(self) -> AcState:
        try:
            state = await asyncio.to_thread(self._read_local)
        except (Unreachable, NeedsSetup):
            if self.cloud is None or not self.record.cloud_id:
                raise
            state = await asyncio.to_thread(self._read_cloud)
        self._last = state
        return state

    def _apply_local(self, target: AcState, patch: dict[str, Any]) -> None:
        dps = self.values.to_dps(target, patch)
        if dps:
            self._call_local(lambda device: device.set_multiple_values(dps) or {})

    def _apply_cloud(self, target: AcState, patch: dict[str, Any]) -> None:
        assert self.cloud is not None
        commands = self.values.to_cloud_commands(target, patch)
        result = self.cloud.sendcommand(self.record.cloud_id, {"commands": commands})
        if not isinstance(result, dict) or not result.get("success"):
            raise DriverError(f"Tuya cloud refused the command ({_cloud_error(result)}).")

    async def apply(self, target: AcState, patch: dict[str, Any]) -> AcState | None:
        try:
            await asyncio.to_thread(self._apply_local, target, patch)
        except (Unreachable, NeedsSetup):
            if self.cloud is None or not self.record.cloud_id:
                raise
            _LOGGER.info("%s: local control failed, sending through the Tuya cloud", self.record.name)
            await asyncio.to_thread(self._apply_cloud, target, patch)
        return None

    async def locate(self) -> str | None:
        found = await asyncio.to_thread(listen_for_broadcasts, 7.0)
        info = found.get(self._device_id or "")
        if info and info.get("ip") and info["ip"] != self.record.ip:
            if info.get("version"):
                self.update_secrets(version=str(info["version"]))
            return info["ip"]
        return None


def _cloud_error(result: Any) -> str:
    if isinstance(result, dict):
        return str(result.get("msg") or result.get("Error") or result.get("code") or result)
    return str(result)


def listen_for_broadcasts(seconds: float) -> dict[str, dict[str, Any]]:
    """Collect the announcements Tuya units broadcast every few seconds. Keyed by device id."""
    found: dict[str, dict[str, Any]] = {}
    sockets = []
    for port in (tinytuya.UDPPORT, tinytuya.UDPPORTS, tinytuya.UDPPORTAPP):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        if hasattr(socket, "SO_REUSEPORT"):
            try:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
            except OSError:
                pass
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        try:
            sock.bind(("", port))
        except OSError:
            sock.close()
            continue
        sock.settimeout(0.2)
        sockets.append(sock)
    deadline = time.monotonic() + seconds
    try:
        while sockets and time.monotonic() < deadline:
            for sock in sockets:
                try:
                    data, addr = sock.recvfrom(4096)
                except (TimeoutError, socket.timeout, OSError):
                    continue
                try:
                    info = json.loads(tinytuya.decrypt_udp(data))
                except Exception:  # noqa: BLE001 - foreign or malformed broadcast
                    continue
                device_id = info.get("gwId") or info.get("devId")
                if device_id:
                    info.setdefault("ip", addr[0])
                    found[device_id] = info
    finally:
        for sock in sockets:
            sock.close()
    return found
