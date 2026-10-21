"""Keeps one AC connected: polls it, runs its commands, and recovers when it stops answering.

The rules that replace the old "connected for 30 seconds, then gone" behaviour:

* A single missed reply is never "offline". The unit is reported offline only after
  `offline_after` polls in a row fail (about 30 s with the defaults), and online again on the
  first good reply.
* From the second failure on, the worker looks for the unit by MAC on the LAN, in case the router
  gave it a new IP address, and continues at the new address.
* A command that hits a unit which stopped answering is retried once after the same search.
* Commands older than `command_ttl` are not run: an AC switching on hours after the button was
  pressed is worse than one that did not switch on.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Protocol

from .drivers.base import DeviceRecord, Driver, DriverError, NeedsSetup, Unreachable
from .state import AcState, InvalidPatch, apply_patch, patch_matches

_LOGGER = logging.getLogger(__name__)


@dataclass
class Settings:
    poll_seconds: float = 10
    offline_after: int = 3
    locate_after: int = 2
    command_ttl: float = 120
    readback_delay: float = 0.8


@dataclass
class Command:
    id: int
    device_id: str
    patch: dict[str, Any]
    created_at: datetime


class Store(Protocol):
    async def report_state(
        self, device_id: str, state: AcState | None, *, online: bool, error: str | None = None
    ) -> None: ...

    async def report_ip(self, device_id: str, ip: str) -> None: ...

    async def save_secrets(self, device_id: str, secrets: dict[str, Any]) -> None: ...

    async def finish_command(self, command_id: int, status: str, error: str | None = None) -> None: ...


class DeviceWorker:
    def __init__(
        self,
        record: DeviceRecord,
        driver: Driver,
        store: Store,
        settings: Settings,
        clock: Callable[[], float] = time.monotonic,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ) -> None:
        self.record = record
        self.driver = driver
        self.store = store
        self.settings = settings
        self.clock = clock
        self.now = now
        self.state = record.last_state
        self.commands: asyncio.Queue[Command] = asyncio.Queue()
        self.failures = 0
        self.online: bool | None = None
        self._next_poll = 0.0
        self._next_keepalive = 0.0
        self._task: asyncio.Task | None = None

    # -- lifecycle ---------------------------------------------------------------------------------

    def start(self) -> None:
        self._task = asyncio.create_task(self.run(), name=f"device-{self.record.id}")

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await self.driver.close()

    async def run(self) -> None:
        while True:
            try:
                await self.step()
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - a bug in one driver must not stop the others
                _LOGGER.exception("%s: unexpected error", self.record.name)
                await asyncio.sleep(self.settings.poll_seconds)

    async def step(self) -> None:
        """Wait for the next command or poll, and handle it."""
        timeout = max(0.0, self._next_poll - self.clock())
        try:
            command = await asyncio.wait_for(self.commands.get(), timeout)
        except asyncio.TimeoutError:
            command = None
        if command is not None:
            await self.execute(command)
        else:
            await self.poll()
        await self.keepalive()

    # -- polling -----------------------------------------------------------------------------------

    async def poll(self) -> None:
        self._next_poll = self.clock() + self.settings.poll_seconds
        try:
            state = await self.driver.read()
        except NeedsSetup as exc:
            await self._needs_setup(exc)
        except DriverError as exc:
            await self._failed(exc)
        else:
            await self._succeeded(state)

    async def _succeeded(self, state: AcState) -> None:
        recovered = self.online is not True
        self.failures = 0
        self.online = True
        self.state = state
        await self.store.report_state(self.record.id, state, online=True)
        await self._save_secrets()
        if recovered:
            _LOGGER.info("%s: online at %s", self.record.name, self.record.ip)

    async def _failed(self, exc: Exception) -> None:
        self.failures += 1
        _LOGGER.debug("%s: poll failed (%d in a row): %s", self.record.name, self.failures, exc)
        if self.failures >= self.settings.locate_after and await self._relocate():
            # Found it at a new address: try again right away instead of waiting a full interval.
            self._next_poll = self.clock()
            return
        if self.failures >= self.settings.offline_after and self.online is not False:
            self.online = False
            _LOGGER.warning("%s: offline (%s)", self.record.name, exc)
            await self.store.report_state(self.record.id, None, online=False, error=str(exc))

    async def _needs_setup(self, exc: NeedsSetup) -> None:
        self.failures = 0
        if self.online is not False:
            _LOGGER.warning("%s: %s", self.record.name, exc)
        self.online = False
        await self.store.report_state(self.record.id, None, online=False, error=str(exc))
        await self._save_secrets()

    async def _relocate(self) -> bool:
        try:
            ip = await self.driver.locate()
        except Exception:  # noqa: BLE001 - discovery is best effort
            _LOGGER.debug("%s: locate failed", self.record.name, exc_info=True)
            return False
        if not ip or ip == self.record.ip:
            return False
        _LOGGER.info("%s: moved from %s to %s", self.record.name, self.record.ip or "?", ip)
        self.driver.set_ip(ip)
        await self.store.report_ip(self.record.id, ip)
        return True

    async def keepalive(self) -> None:
        period = self.driver.keepalive_seconds
        if not period or self.online is not True or self.clock() < self._next_keepalive:
            return
        self._next_keepalive = self.clock() + period
        try:
            await self.driver.keepalive()
        except Exception:  # noqa: BLE001
            _LOGGER.debug("%s: keepalive failed", self.record.name, exc_info=True)

    # -- commands ----------------------------------------------------------------------------------

    async def execute(self, command: Command) -> None:
        age = (self.now() - command.created_at).total_seconds()
        if age > self.settings.command_ttl:
            await self.store.finish_command(command.id, "expired", f"Not run: sent {int(age)} s ago.")
            return
        try:
            target = apply_patch(self.state, command.patch)
        except InvalidPatch as exc:
            await self.store.finish_command(command.id, "failed", str(exc))
            return

        try:
            echoed = await self._apply_with_retry(target, command.patch)
        except NeedsSetup as exc:
            await self.store.finish_command(command.id, "failed", str(exc))
            await self._needs_setup(exc)
            return
        except DriverError as exc:
            await self.store.finish_command(command.id, "failed", str(exc))
            await self._failed(exc)
            return

        state = echoed or await self._read_back(target)
        confirmed = patch_matches(state, command.patch)
        await self.store.finish_command(
            command.id, "done", None if confirmed else "Sent, but the unit's status does not show it yet."
        )
        await self._succeeded(state)
        # Look again soon: some units apply a change a moment after acknowledging it.
        self._next_poll = min(self._next_poll, self.clock() + 3)

    async def _apply_with_retry(self, target: AcState, patch: dict[str, Any]) -> AcState | None:
        try:
            return await self.driver.apply(target, patch)
        except Unreachable:
            if not await self._relocate():
                raise
            return await self.driver.apply(target, patch)

    async def _read_back(self, fallback: AcState) -> AcState:
        await asyncio.sleep(self.settings.readback_delay)
        try:
            return await self.driver.read()
        except DriverError:
            return fallback

    async def _save_secrets(self) -> None:
        changed = self.driver.take_secret_changes()
        if changed is not None:
            await self.store.save_secrets(self.record.id, changed)
