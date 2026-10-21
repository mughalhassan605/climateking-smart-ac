"""TCL units that pair with the TCL "Intelligent AC" app (BroadLink/DNA, UDP 80).

TCL units that pair with "TCL SmartLife" are Tuya units: add them with brand `tuya`. Units that only
work with the newer "TCL Home" app talk to TCL's cloud alone and have no local protocol to use.
"""

from __future__ import annotations

import asyncio
from typing import Any

from ..protocols import broadlink_dna as dna
from ..state import AcState, Airflow, Axis, clamp_temp
from .base import Driver, DriverError, NeedsSetup, Unreachable

MODE_FROM_TCL = {1: "heat", 2: "dry", 3: "cool", 4: "fan", 5: "auto"}
MODE_TO_TCL = {mode: code for code, mode in MODE_FROM_TCL.items()}
FAN_FROM_TCL = {0: "auto", 1: "low", 4: "mediumLow", 2: "medium", 5: "mediumHigh", 3: "high"}
FAN_TO_TCL = {"auto": 0, "quiet": 1, "low": 1, "mediumLow": 4, "medium": 2, "mediumHigh": 5, "high": 3, "turbo": 3}
PRECISION_AIRFLOW_BIT = 7


def _precise(raw: dict[str, Any]) -> bool:
    flags = raw.get("if_function")
    return type(flags) is int and flags >= 0 and bool(flags & (1 << PRECISION_AIRFLOW_BIT))


def _axis_from(code: Any, full_swing: int) -> Axis:
    if code in (full_swing, 1) or (isinstance(code, int) and code >= 7):
        return Axis("swing")
    if isinstance(code, int) and 1 <= code <= 5:
        return Axis("fixed", code)
    return Axis("off")


def to_state(raw: dict[str, Any]) -> AcState:
    if raw.get("pwfmode") == 1:
        fan = "turbo"
    elif raw.get("qtmode") == 1:
        fan = "quiet"
    else:
        fan = FAN_FROM_TCL.get(raw.get("tcl_mark"), "auto")
    temp = raw.get("temp")
    env = raw.get("envtemp")
    precise = _precise(raw)
    return AcState(
        is_on=raw.get("pwr") == 1,
        mode=MODE_FROM_TCL.get(raw.get("tcl_mode"), "cool"),
        target_temp=clamp_temp(temp / 10) if isinstance(temp, (int, float)) else 24,
        current_temp=float(env) if isinstance(env, (int, float)) and -20 < env < 60 else None,
        fan_speed=fan,
        airflow=Airflow(
            _axis_from(raw.get("tcl_vdir"), 7 if precise else 1),
            _axis_from(raw.get("tcl_hdir"), 10 if precise else 1),
        ),
    )


def to_params(raw: dict[str, Any], target: AcState, patch: dict[str, Any]) -> dict[str, Any]:
    params: dict[str, Any] = {}
    if "isOn" in patch:
        params["pwr"] = int(target.is_on)
    if "mode" in patch:
        params["tcl_mode"] = MODE_TO_TCL[target.mode]
        if target.is_on:
            params["pwr"] = 1
    if "targetTemp" in patch:
        params["temp"] = int(round(target.target_temp * 10))
    if "fanSpeed" in patch:
        params["tcl_mark"] = FAN_TO_TCL[target.fan_speed]
        params["pwfmode"] = int(target.fan_speed == "turbo")
        params["qtmode"] = int(target.fan_speed == "quiet")
    if "airflow" in patch:
        precise = _precise(raw)
        for axis, key, full in (
            (target.airflow.vertical, "tcl_vdir", 7 if precise else 1),
            (target.airflow.horizontal, "tcl_hdir", 10 if precise else 1),
        ):
            if axis.mode == "swing":
                params[key] = full
            elif axis.mode == "fixed" and precise:
                params[key] = axis.angle
            else:
                params[key] = 0
    return params


class TclDriver(Driver):
    def __init__(self, record) -> None:
        super().__init__(record)
        self._raw: dict[str, Any] = {}

    def _credentials(self) -> tuple[str, int]:
        key = self.record.secrets.get("key")
        device_id = self.record.secrets.get("device_id")
        if isinstance(key, str) and len(key) == 32 and isinstance(device_id, int):
            return key, device_id
        devtype = int(self.record.secrets.get("devtype") or dna.TCL_DEVTYPES[0])
        try:
            key, device_id = dna.authenticate(self.record.ip, self.record.mac, devtype)
        except dna.DnaTimeout as exc:
            raise Unreachable(f"No answer from {self.record.ip}.") from exc
        except dna.DnaLocked as exc:
            raise NeedsSetup(
                "The AC's Wi-Fi module is locked for local control. Reset its Wi-Fi (see the bridge "
                "README, TCL section) and add it again."
            ) from exc
        except dna.DnaError as exc:
            raise DriverError(f"Local login failed: {exc}.") from exc
        self.update_secrets(key=key, device_id=device_id)
        return key, device_id

    def _call(self, action: str, body: dict[str, Any]) -> dict[str, Any]:
        if not self.record.ip or not self.record.mac:
            raise Unreachable("The unit's IP or MAC address is not known yet.")
        key, device_id = self._credentials()
        try:
            raw = dna.request(self.record.ip, self.record.mac, key, device_id, action, body)
        except dna.DnaTimeout as exc:
            raise Unreachable(f"No answer from {self.record.ip}.") from exc
        except dna.DnaError as exc:
            # Most likely a key from before a module reset: log in again next time.
            self.update_secrets(key=None, device_id=None)
            raise Unreachable(f"The unit rejected the request ({exc}).") from exc
        if isinstance(raw, dict):
            self._raw = {**self._raw, **raw}
        return self._raw

    async def read(self) -> AcState:
        return to_state(await asyncio.to_thread(self._call, "get", {}))

    async def apply(self, target: AcState, patch: dict[str, Any]) -> AcState | None:
        if not self._raw:
            await self.read()
        params = to_params(self._raw, target, patch)
        if not params:
            return None
        return to_state(await asyncio.to_thread(self._call, "set", params))

    async def locate(self) -> str | None:
        for device in await asyncio.to_thread(dna.discover, 3.0):
            if device.mac == self.record.mac and device.host != self.record.ip:
                return device.host
        return None
