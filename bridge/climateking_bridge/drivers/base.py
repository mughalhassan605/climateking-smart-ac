"""What every brand driver provides to the device worker."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any

from ..state import AcState


class DriverError(Exception):
    """A failure talking to a unit. The message is shown to the user, so keep it plain."""


class Unreachable(DriverError):
    """The unit did not answer on the LAN (off, out of Wi-Fi range, or its address moved)."""


class NeedsSetup(DriverError):
    """The unit answered but cannot be controlled until the user supplies something (a key)."""


@dataclass
class DeviceRecord:
    """One `devices` row plus its `device_secrets`, as the bridge sees it."""

    id: str
    name: str
    brand: str
    vendor: str
    ip: str
    mac: str
    secrets: dict[str, Any] = field(default_factory=dict)
    cloud_id: str | None = None
    last_state: AcState = field(default_factory=AcState)

    @classmethod
    def from_rows(cls, row: dict[str, Any], secrets: dict[str, Any] | None) -> DeviceRecord:
        return cls(
            id=row["id"],
            name=row.get("name") or row["id"],
            brand=row.get("brand") or "",
            vendor=row.get("vendor") or "",
            ip=row.get("ip_address") or "",
            mac=normalize_mac(row.get("mac_address") or ""),
            secrets=dict(secrets or {}),
            cloud_id=row.get("cloud_id") or None,
            last_state=AcState.from_row(row),
        )


def normalize_mac(mac: str) -> str:
    """'AA:BB:CC:00:11:22' / 'aa-bb-...' / 'aabbcc001122' -> 'aabbcc001122' ('' if not a MAC)."""
    compact = "".join(ch for ch in mac.lower() if ch in "0123456789abcdef")
    return compact if len(compact) == 12 else ""


class Driver(abc.ABC):
    """Talks to one unit. A worker owns exactly one driver and never calls it concurrently."""

    #: Seconds between keepalive() calls, or None when the protocol needs none.
    keepalive_seconds: float | None = None

    def __init__(self, record: DeviceRecord) -> None:
        self.record = record
        self._secrets_changed = False

    @abc.abstractmethod
    async def read(self) -> AcState:
        """Fetch the unit's live state. Raises Unreachable / NeedsSetup / DriverError."""

    @abc.abstractmethod
    async def apply(self, target: AcState, patch: dict[str, Any]) -> AcState | None:
        """Make the unit match `target` (the current state with `patch` applied).

        Return the state the unit reported back, or None when the protocol does not echo one (the
        worker then reads it back itself).
        """

    async def locate(self) -> str | None:
        """Find the unit again by MAC after its IP address changed. Returns the new IP or None."""
        return None

    async def keepalive(self) -> None:
        """Called every keepalive_seconds while the unit is reachable."""

    async def close(self) -> None:
        """Release sockets. The driver is not used again afterwards."""

    def set_ip(self, ip: str) -> None:
        self.record.ip = ip

    def update_secrets(self, **values: Any) -> None:
        """Remember something learned from the unit (a bind key, an auth id) for the next start."""
        for key, value in values.items():
            if self.record.secrets.get(key) != value:
                self.record.secrets[key] = value
                self._secrets_changed = True

    def take_secret_changes(self) -> dict[str, Any] | None:
        """The full secrets dict if it changed since the last call, else None."""
        if not self._secrets_changed:
            return None
        self._secrets_changed = False
        return dict(self.record.secrets)
