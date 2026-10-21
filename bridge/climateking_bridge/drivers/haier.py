"""Haier units that pair with the Haier / HaiSmart (U+) app: uSS protocol on TCP 56800.

Uses haismart-hrdp from enapt/haismart-local (MIT). The unit's `local_key` comes from Haier's cloud
once: run `haismart-keys` (installed with the bridge) and enter the key in the app, or put it in the
unit's secrets. A unit accepts one local session at a time, so the bridge must be the only thing
talking to it locally (no Home Assistant integration on the same unit).

Older units that pair with "SmartAir2" and units on the European "hOn" app use other protocols and
are not handled here.
"""

from __future__ import annotations

import asyncio
import itertools
from typing import Any

from ..state import AcState, Airflow, Axis, clamp_temp
from .base import Driver, DriverError, NeedsSetup, Unreachable

try:
    import haismart_hrdp as hrdp
    from haismart_hrdp import uss
except ImportError:  # pragma: no cover - optional dependency
    hrdp = None
    uss = None

MODE_FROM_HAIER = {"0": "auto", "1": "cool", "2": "dry", "4": "heat", "6": "fan"}
MODE_TO_HAIER = {"auto": 0, "cool": 1, "dry": 2, "heat": 4, "fan": 6}
FAN_FROM_HAIER = {"1": "high", "2": "medium", "3": "low", "5": "auto"}
FAN_TO_HAIER = {"auto": 5, "quiet": 3, "low": 3, "mediumLow": 3, "medium": 2, "mediumHigh": 1, "high": 1, "turbo": 1}
VANE_V_SWING, VANE_H_SWING = 0x0C, 0x07


def to_state(status: dict[str, Any]) -> AcState:
    if not status or "power" not in status:
        raise DriverError("The unit sent a status report this model's layout could not decode.")
    if status.get("strong"):
        fan = "turbo"
    elif status.get("quiet"):
        fan = "quiet"
    else:
        fan = FAN_FROM_HAIER.get(str(status.get("wind_speed")), "auto")
    current = status.get("current_temperature")
    return AcState(
        is_on=bool(status["power"]),
        mode=MODE_FROM_HAIER.get(str(status.get("operation_mode")), "cool"),
        target_temp=clamp_temp(status.get("target_temperature") or 24),
        current_temp=float(current) if isinstance(current, (int, float)) else None,
        fan_speed=fan,
        airflow=Airflow(
            Axis("swing" if status.get("swing_vertical") else "off"),
            Axis("swing" if status.get("swing_horizontal") else "off"),
        ),
    )


def fields_for(target: AcState, patch: dict[str, Any]) -> dict[str, int]:
    fields: dict[str, int] = {}
    if "isOn" in patch:
        fields["onOffStatus"] = int(target.is_on)
    if "mode" in patch:
        fields["operationMode"] = MODE_TO_HAIER[target.mode]
    if "targetTemp" in patch:
        fields["targetTemperature"] = int(round(target.target_temp)) - 16
    if "fanSpeed" in patch:
        fields["windSpeed"] = FAN_TO_HAIER[target.fan_speed]
        fields["rapidMode"] = int(target.fan_speed == "turbo")
        fields["muteStatus"] = int(target.fan_speed == "quiet")
    if "airflow" in patch:
        fields["windDirectionVertical"] = VANE_V_SWING if target.airflow.vertical.mode == "swing" else 0
        fields["windDirectionHorizontal"] = VANE_H_SWING if target.airflow.horizontal.mode == "swing" else 0
    # The unit drops a whole group-set that combines fan-only with automatic fan speed.
    if target.mode == "fan" and fields.get("windSpeed", None if "fanSpeed" in patch else 5) == 5:
        fields["windSpeed"] = 3
    return fields


class HaierDriver(Driver):
    def __init__(self, record) -> None:
        super().__init__(record)
        self._blob: bytes | None = None
        self._counter = itertools.count(1)

    def _credentials(self) -> tuple[str, str]:
        if hrdp is None:
            raise NeedsSetup("Haier support is not installed on the bridge: pip install 'climateking-bridge[haier]'.")
        device_id = self.record.secrets.get("device_id") or self.record.mac.upper()
        key = self.record.secrets.get("local_key")
        if not key:
            raise NeedsSetup("This Haier unit needs its local key. Run `haismart-keys` on the bridge.")
        if not self.record.ip:
            raise Unreachable("The unit's IP address is not known yet.")
        return device_id, key

    async def read(self) -> AcState:
        device_id, key = self._credentials()
        try:
            blobs = await uss.async_read_status(self.record.ip, device_id, key, timeout=5.0)
        except uss.LocalKeyRotated as exc:
            raise NeedsSetup("Haier rotated this unit's local key. Run `haismart-keys` again.") from exc
        except (OSError, asyncio.TimeoutError) as exc:
            raise Unreachable(f"No answer from {self.record.ip}.") from exc
        except RuntimeError as exc:
            raise DriverError(f"The unit refused the session: {exc}.") from exc
        for blob in blobs:
            status = uss.parse_full_status(blob, uplus_id=self.record.secrets.get("uplus_id"))
            if status and "power" in status:
                if uss.is_control_baseline(blob, self.record.secrets.get("uplus_id")):
                    self._blob = blob
                return to_state(status)
        if not blobs:
            raise NeedsSetup("The unit answered but nothing decrypted: the local key is probably stale.")
        raise DriverError("The unit sent no status report this model's layout could decode.")

    async def apply(self, target: AcState, patch: dict[str, Any]) -> AcState | None:
        device_id, key = self._credentials()
        if self._blob is None:
            await self.read()
        fields = fields_for(target, patch)
        if not fields:
            return None
        fallback = self._blob

        def build(pushed: bytes | None) -> bytes:
            base = pushed or fallback
            if base is None:
                raise DriverError("No status report to base the change on.")
            words = uss.grsetdac_baseline_from_status(base)
            for name, value in fields.items():
                words = uss.set_grsetdac_field(words, name, value)
            return uss.grsetdac_op_frame(words)

        try:
            blobs = await uss.async_send_op(
                self.record.ip, device_id, key, build_frame=build, counter=next(self._counter),
                uplus_id=self.record.secrets.get("uplus_id"),
            )
        except (OSError, asyncio.TimeoutError) as exc:
            raise Unreachable(f"No answer from {self.record.ip}.") from exc
        except (KeyError, ValueError) as exc:
            raise DriverError(f"This model does not accept that setting locally ({exc}).") from exc
        if uss.reply_refused(blobs):
            raise DriverError(f"The unit refused the change (code {uss.refusal_code(blobs)}).")
        return None

    async def locate(self) -> str | None:
        if hrdp is None:
            return None
        from haismart_hrdp import udiscovery

        device_id = (self.record.secrets.get("device_id") or self.record.mac).upper()
        try:
            found = await asyncio.to_thread(udiscovery.discover)
        except OSError:
            return None
        for info in found:
            if str(getattr(info, "device_id", "")).upper() == device_id and info.host != self.record.ip:
                return info.host
        return None
