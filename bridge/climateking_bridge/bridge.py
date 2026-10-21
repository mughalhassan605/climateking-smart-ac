"""Runs one DeviceWorker per AC and connects them to Supabase."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from .discovery import scan_all
from .drivers import make_driver
from .drivers.base import DeviceRecord
from .store import SupabaseStore
from .worker import Command, DeviceWorker, Settings

_LOGGER = logging.getLogger(__name__)

HEARTBEAT_SECONDS = 15
COMMAND_POLL_SECONDS = 3
DEVICE_SYNC_SECONDS = 60
SYNC_DEBOUNCE_SECONDS = 5


def connection_key(record: DeviceRecord) -> tuple[Any, ...]:
    """Fields whose change means the worker must be rebuilt (not live state)."""
    secrets = sorted((k, v) for k, v in record.secrets.items() if v is not None)
    return (record.brand, record.ip, record.mac, record.cloud_id, repr(secrets))


class Bridge:
    def __init__(
        self,
        store: SupabaseStore,
        name: str,
        settings: Settings,
        discovery_minutes: float = 10,
        tuya_cloud: Any = None,
    ) -> None:
        self.store = store
        self.name = name
        self.settings = settings
        self.discovery_minutes = discovery_minutes
        self.tuya_cloud = tuya_cloud
        self.workers: dict[str, DeviceWorker] = {}
        self._keys: dict[str, tuple[Any, ...]] = {}
        self._seen_commands: set[int] = set()
        self._sync_requested = asyncio.Event()
        self._command_lock = asyncio.Lock()

    async def run(self) -> None:
        await self.store.connect()
        bridge_id = await self.store.register_bridge(self.name)
        _LOGGER.info("bridge %r registered (%s)", self.name, bridge_id)
        await self.sync_devices()
        await self.store.subscribe(self.dispatch_commands, self.request_sync)
        loops = [self._heartbeat_loop(), self._command_loop(), self._sync_loop()]
        if self.discovery_minutes > 0:
            loops.append(self._discovery_loop())
        try:
            await asyncio.gather(*loops)
        finally:
            for worker in list(self.workers.values()):
                await worker.stop()
            await self.store.close()

    # -- devices -----------------------------------------------------------------------------------

    async def request_sync(self) -> None:
        self._sync_requested.set()

    async def sync_devices(self) -> None:
        records = {r.id: r for r in await self.store.load_devices()}
        for device_id in list(self.workers):
            if device_id not in records:
                _LOGGER.info("%s removed", self.workers[device_id].record.name)
                await self.workers.pop(device_id).stop()
                self._keys.pop(device_id, None)
        for device_id, record in records.items():
            key = connection_key(record)
            worker = self.workers.get(device_id)
            # The second test catches the worker's own writes (a bind key it just learned and saved).
            if worker is not None and key in (self._keys.get(device_id), connection_key(worker.record)):
                worker.record.name = record.name
                self._keys[device_id] = key
                continue
            if worker is not None:
                # Keep what the running worker learned (state) when only its settings changed.
                record.last_state = worker.state
                await worker.stop()
            try:
                driver = make_driver(record, self.tuya_cloud if record.brand == "tuya" else None)
            except ValueError as exc:
                _LOGGER.warning("%s: %s", record.name, exc)
                continue
            worker = DeviceWorker(record, driver, self.store, self.settings)
            self.workers[device_id] = worker
            self._keys[device_id] = key
            worker.start()
            _LOGGER.info("watching %s (%s, %s)", record.name, record.brand, record.ip or "no IP yet")

    async def _sync_loop(self) -> None:
        while True:
            try:
                await asyncio.wait_for(self._sync_requested.wait(), DEVICE_SYNC_SECONDS)
                # Coalesce bursts (every state report is also a devices change).
                await asyncio.sleep(SYNC_DEBOUNCE_SECONDS)
            except asyncio.TimeoutError:
                pass
            self._sync_requested.clear()
            try:
                await self.sync_devices()
            except Exception:  # noqa: BLE001
                _LOGGER.warning("device sync failed", exc_info=True)

    # -- commands ----------------------------------------------------------------------------------

    async def dispatch_commands(self) -> None:
        async with self._command_lock:
            for command in await self.store.pending_commands():
                if command.id in self._seen_commands:
                    continue
                worker = self.workers.get(command.device_id)
                if worker is None:
                    await self.sync_devices()
                    worker = self.workers.get(command.device_id)
                    if worker is None:
                        continue
                if not await self.store.claim_command(command.id):
                    self._seen_commands.add(command.id)
                    continue
                self._seen_commands.add(command.id)
                worker.commands.put_nowait(command)
            if len(self._seen_commands) > 10000:
                self._seen_commands = set(sorted(self._seen_commands)[-1000:])

    async def _command_loop(self) -> None:
        while True:
            try:
                await self.dispatch_commands()
            except Exception:  # noqa: BLE001
                _LOGGER.warning("could not fetch commands", exc_info=True)
            await asyncio.sleep(COMMAND_POLL_SECONDS)

    # -- heartbeat and discovery -------------------------------------------------------------------

    async def _heartbeat_loop(self) -> None:
        while True:
            try:
                await self.store.heartbeat()
            except Exception:  # noqa: BLE001
                _LOGGER.warning("heartbeat failed", exc_info=True)
            await asyncio.sleep(HEARTBEAT_SECONDS)

    async def _discovery_loop(self) -> None:
        while True:
            try:
                found = await scan_all()
                known = {(w.record.brand, w.record.mac) for w in self.workers.values()}
                known |= {("tuya", w.record.secrets.get("device_id")) for w in self.workers.values()}
                new = [f for f in found if (f.brand, f.mac) not in known]
                await self.store.report_discovered(new)
                if new:
                    _LOGGER.info("found %d unit(s) not added yet", len(new))
            except Exception:  # noqa: BLE001
                _LOGGER.warning("discovery failed", exc_info=True)
            await asyncio.sleep(self.discovery_minutes * 60)


__all__ = ["Bridge", "Command"]
