from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from climateking_bridge.drivers.base import DeviceRecord, Driver, NeedsSetup, Unreachable
from climateking_bridge.state import AcState


class FakeClock:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


class FakeStore:
    def __init__(self) -> None:
        self.reports: list[tuple[AcState | None, bool, str | None]] = []
        self.ips: list[str] = []
        self.secrets: dict[str, Any] | None = None
        self.finished: dict[int, tuple[str, str | None]] = {}

    async def report_state(self, device_id, state, *, online, error=None):
        self.reports.append((state, online, error))

    async def report_ip(self, device_id, ip):
        self.ips.append(ip)

    async def save_secrets(self, device_id, secrets):
        self.secrets = secrets

    async def finish_command(self, command_id, status, error=None):
        self.finished[command_id] = (status, error)

    @property
    def online_flags(self) -> list[bool]:
        return [online for _, online, _ in self.reports]


class FakeDriver(Driver):
    """A unit at `home_ip`; it only answers while the record points there and `answering` is set."""

    def __init__(self, record: DeviceRecord, home_ip: str | None = None) -> None:
        super().__init__(record)
        self.home_ip = home_ip or record.ip
        self.answering = True
        self.needs_key = False
        self.unit = AcState(current_temp=30)
        self.applied: list[dict[str, Any]] = []
        self.locates = 0

    def _check(self) -> None:
        if self.needs_key:
            raise NeedsSetup("needs key")
        if not self.answering or self.record.ip != self.home_ip:
            raise Unreachable("no answer")

    async def read(self) -> AcState:
        self._check()
        self.update_secrets(key="learned-key")
        return self.unit

    async def apply(self, target, patch):
        self._check()
        self.applied.append(patch)
        self.unit = target
        return None

    async def locate(self):
        self.locates += 1
        return self.home_ip if self.answering else None


def record(ip: str = "10.0.0.5") -> DeviceRecord:
    return DeviceRecord(id="ac-1", name="Bedroom", brand="gree", vendor="Gree", ip=ip, mac="aabbccddeeff")


def now() -> datetime:
    return datetime.now(timezone.utc)
