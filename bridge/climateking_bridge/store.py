"""Everything the bridge reads from and writes to Supabase, signed in as the AC owner.

Row level security limits every query to that owner's rows, so the bridge can only ever see and
control the ACs of the account it signs in with.
"""

from __future__ import annotations

import asyncio
import logging
import platform
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from supabase import AsyncClient, acreate_client

from . import __version__
from .discovery import Found
from .drivers.base import DeviceRecord
from .state import AcState
from .worker import Command

_LOGGER = logging.getLogger(__name__)


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class SupabaseStore:
    def __init__(self, url: str, anon_key: str, email: str, password: str) -> None:
        self.url = url
        self.anon_key = anon_key
        self.email = email
        self.password = password
        self.client: AsyncClient | None = None
        self.bridge_id: str | None = None
        self._channel = None

    async def connect(self) -> None:
        self.client = await acreate_client(self.url, self.anon_key)
        await self.client.auth.sign_in_with_password({"email": self.email, "password": self.password})
        _LOGGER.info("signed in to Supabase as %s", self.email)

    @property
    def db(self) -> AsyncClient:
        if self.client is None:
            raise RuntimeError("connect() first")
        return self.client

    # -- bridge ------------------------------------------------------------------------------------

    async def register_bridge(self, name: str) -> str:
        row = {
            "name": name,
            "version": __version__,
            "host_info": {"platform": platform.platform(), "python": platform.python_version()},
            "last_seen": utcnow(),
        }
        result = await self.db.table("bridges").upsert(row, on_conflict="owner_id,name").execute()
        self.bridge_id = result.data[0]["id"]
        return self.bridge_id

    async def heartbeat(self) -> None:
        await self.db.table("bridges").update({"last_seen": utcnow()}).eq("id", self.bridge_id).execute()

    # -- devices -----------------------------------------------------------------------------------

    async def load_devices(self) -> list[DeviceRecord]:
        devices = (await self.db.table("devices").select("*").execute()).data or []
        secrets = (await self.db.table("device_secrets").select("device_id,secrets").execute()).data or []
        by_id = {row["device_id"]: row.get("secrets") or {} for row in secrets}
        return [DeviceRecord.from_rows(row, by_id.get(row["id"])) for row in devices]

    async def report_state(
        self, device_id: str, state: AcState | None, *, online: bool, error: str | None = None
    ) -> None:
        row: dict[str, Any] = {"status": "online" if online else "offline", "last_error": error}
        if state is not None:
            row.update(state.to_row())
        if online:
            row["last_seen"] = utcnow()
        await self.db.table("devices").update(row).eq("id", device_id).execute()

    async def report_ip(self, device_id: str, ip: str) -> None:
        await self.db.table("devices").update({"ip_address": ip}).eq("id", device_id).execute()

    async def save_secrets(self, device_id: str, secrets: dict[str, Any]) -> None:
        clean = {k: v for k, v in secrets.items() if v is not None}
        await self.db.table("device_secrets").upsert(
            {"device_id": device_id, "secrets": clean}, on_conflict="device_id"
        ).execute()

    async def update_device(self, device_id: str, values: dict[str, Any]) -> None:
        await self.db.table("devices").update(values).eq("id", device_id).execute()

    # -- commands ----------------------------------------------------------------------------------

    async def pending_commands(self) -> list[Command]:
        rows = (
            await self.db.table("device_commands")
            .select("id,device_id,patch,created_at")
            .eq("status", "pending")
            .order("created_at")
            .limit(50)
            .execute()
        ).data or []
        return [Command(r["id"], r["device_id"], r.get("patch") or {}, parse_time(r["created_at"])) for r in rows]

    async def claim_command(self, command_id: int) -> bool:
        """Atomically move a command from pending to running. False if someone else took it."""
        result = (
            await self.db.table("device_commands")
            .update({"status": "running", "executed_by": f"bridge:{self.bridge_id}"})
            .eq("id", command_id)
            .eq("status", "pending")
            .execute()
        )
        return bool(result.data)

    async def finish_command(self, command_id: int, status: str, error: str | None = None) -> None:
        await self.db.table("device_commands").update(
            {"status": status, "error": error, "executed_at": utcnow()}
        ).eq("id", command_id).execute()

    # -- discovery ---------------------------------------------------------------------------------

    async def report_discovered(self, found: list[Found]) -> None:
        if not found:
            return
        rows = [
            {
                "bridge_id": self.bridge_id,
                "brand": f.brand,
                "mac_address": f.mac,
                "ip_address": f.ip,
                "name": f.name,
                "model": f.model,
                "needs_key": f.needs_key,
                "details": f.details,
                "seen_at": utcnow(),
            }
            for f in found
        ]
        await self.db.table("discovered_devices").upsert(rows, on_conflict="owner_id,brand,mac_address").execute()

    # -- realtime ----------------------------------------------------------------------------------

    async def subscribe(
        self, on_command: Callable[[], Awaitable[None]], on_devices: Callable[[], Awaitable[None]]
    ) -> None:
        """Nudge the bridge as soon as a command or device changes; polling still covers any gap."""
        loop = asyncio.get_running_loop()

        def nudge(fn: Callable[[], Awaitable[None]]) -> Callable[[Any], None]:
            return lambda _payload: loop.call_soon_threadsafe(lambda: asyncio.ensure_future(fn()))

        try:
            channel = self.db.channel("climateking-bridge")
            channel.on_postgres_changes("INSERT", nudge(on_command), table="device_commands", schema="public")
            channel.on_postgres_changes("*", nudge(on_devices), table="devices", schema="public")
            channel.on_postgres_changes("*", nudge(on_devices), table="device_secrets", schema="public")
            await channel.subscribe()
            self._channel = channel
        except Exception:  # noqa: BLE001 - realtime is an optimisation; polling keeps working
            _LOGGER.warning("realtime subscription failed; falling back to polling", exc_info=True)

    async def close(self) -> None:
        if self.client is not None:
            try:
                await self.client.remove_all_channels()
            except Exception:  # noqa: BLE001
                pass
