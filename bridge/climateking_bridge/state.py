"""The brand-neutral AC state the app, the database and every driver agree on.

Values use the app's vocabulary (src/features/devices/types.ts) so a row written by the bridge reads
back in the app without translation:

  mode       cool | heat | dry | fan | auto
  fan_speed  auto | quiet | low | mediumLow | medium | mediumHigh | high | turbo
  airflow    {"vertical": {"mode": off|swing|fixed, "angle": 1..5},
              "horizontal": {...}}   angle 1 = top/left ... 5 = bottom/right
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any

MODES = ("cool", "heat", "dry", "fan", "auto")
FAN_SPEEDS = ("auto", "quiet", "low", "mediumLow", "medium", "mediumHigh", "high", "turbo")
AXIS_MODES = ("off", "swing", "fixed")

TEMP_MIN = 16
TEMP_MAX = 30
DEFAULT_ANGLE = 3


def clamp_temp(value: float) -> float:
    """Round to the nearest half degree inside the range every supported unit accepts."""
    return min(TEMP_MAX, max(TEMP_MIN, round(float(value) * 2) / 2))


@dataclass(frozen=True)
class Axis:
    mode: str = "off"
    angle: int = DEFAULT_ANGLE

    @classmethod
    def from_json(cls, value: Any) -> Axis:
        if not isinstance(value, dict):
            return cls()
        mode = value.get("mode") if value.get("mode") in AXIS_MODES else "off"
        angle = value.get("angle")
        angle = int(angle) if isinstance(angle, (int, float)) and 1 <= angle <= 5 else DEFAULT_ANGLE
        return cls(mode, angle)

    def to_json(self) -> dict[str, Any]:
        return {"mode": self.mode, "angle": self.angle}


@dataclass(frozen=True)
class Airflow:
    vertical: Axis = field(default_factory=Axis)
    horizontal: Axis = field(default_factory=Axis)

    @classmethod
    def from_json(cls, value: Any) -> Airflow:
        if not isinstance(value, dict):
            return cls()
        return cls(Axis.from_json(value.get("vertical")), Axis.from_json(value.get("horizontal")))

    def to_json(self) -> dict[str, Any]:
        return {"vertical": self.vertical.to_json(), "horizontal": self.horizontal.to_json()}


@dataclass(frozen=True)
class AcState:
    is_on: bool = False
    mode: str = "cool"
    target_temp: float = 24
    current_temp: float | None = None
    humidity: float | None = None
    fan_speed: str = "auto"
    airflow: Airflow = field(default_factory=Airflow)

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> AcState:
        """Last known state from a `devices` row, used to seed a driver before its first read."""

        def num(key: str) -> float | None:
            value = row.get(key)
            try:
                return float(value) if value is not None else None
            except (TypeError, ValueError):
                return None

        return cls(
            is_on=bool(row.get("is_on")),
            mode=row.get("mode") if row.get("mode") in MODES else "cool",
            target_temp=clamp_temp(num("target_temp") or 24),
            current_temp=num("current_temp"),
            humidity=num("humidity"),
            fan_speed=row.get("fan_speed") if row.get("fan_speed") in FAN_SPEEDS else "auto",
            airflow=Airflow.from_json(row.get("airflow")),
        )

    def to_row(self) -> dict[str, Any]:
        row: dict[str, Any] = {
            "is_on": self.is_on,
            "mode": self.mode,
            "target_temp": self.target_temp,
            "fan_speed": self.fan_speed,
            "airflow": self.airflow.to_json(),
        }
        if self.current_temp is not None:
            row["current_temp"] = self.current_temp
        if self.humidity is not None:
            row["humidity"] = self.humidity
        return row


class InvalidPatch(ValueError):
    """A command carried a value no unit understands; it is failed instead of guessed at."""


def apply_patch(state: AcState, patch: dict[str, Any]) -> AcState:
    """Return `state` with an app DevicePatch applied (camelCase keys, as the app sends them).

    Raises InvalidPatch for values outside the shared vocabulary, so a typo in a client never
    reaches a unit as some arbitrary code.
    """
    changes: dict[str, Any] = {}
    if "isOn" in patch:
        if not isinstance(patch["isOn"], bool):
            raise InvalidPatch("isOn must be true or false")
        changes["is_on"] = patch["isOn"]
    if "mode" in patch:
        if patch["mode"] not in MODES:
            raise InvalidPatch(f"unknown mode {patch['mode']!r}")
        changes["mode"] = patch["mode"]
    if "targetTemp" in patch:
        value = patch["targetTemp"]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise InvalidPatch("targetTemp must be a number")
        changes["target_temp"] = clamp_temp(value)
    if "fanSpeed" in patch:
        if patch["fanSpeed"] not in FAN_SPEEDS:
            raise InvalidPatch(f"unknown fan speed {patch['fanSpeed']!r}")
        changes["fan_speed"] = patch["fanSpeed"]
    if "airflow" in patch:
        value = patch["airflow"]
        if not isinstance(value, dict):
            raise InvalidPatch("airflow must be an object")
        changes["airflow"] = Airflow(
            Axis.from_json(value.get("vertical")) if "vertical" in value else state.airflow.vertical,
            Axis.from_json(value.get("horizontal")) if "horizontal" in value else state.airflow.horizontal,
        )
    return replace(state, **changes)


def patch_matches(state: AcState, patch: dict[str, Any]) -> bool:
    """Whether a read-back state shows every setting a command asked for."""
    try:
        wanted = apply_patch(state, patch)
    except InvalidPatch:
        return False
    keys = {"isOn": "is_on", "mode": "mode", "targetTemp": "target_temp", "fanSpeed": "fan_speed"}
    for app_key, attr in keys.items():
        if app_key not in patch:
            continue
        if attr == "target_temp":
            # Units without half degrees round the setpoint; a whole degree away is a mismatch.
            if abs(getattr(state, attr) - getattr(wanted, attr)) >= 1:
                return False
        elif getattr(state, attr) != getattr(wanted, attr):
            return False
    return True
