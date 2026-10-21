"""The whole bridge against an in-memory store and the virtual Gree AC: command in, AC changes."""

import asyncio
import socket
from datetime import datetime, timezone

from climateking_bridge import bridge as bridge_module
from climateking_bridge.bridge import Bridge
from climateking_bridge.drivers import gree
from climateking_bridge.drivers.base import DeviceRecord
from climateking_bridge.worker import Command, Settings
from gree_ac import VirtualGree, serve


class MemoryStore:
    def __init__(self, records):
        self.records = records
        self.commands: dict[int, dict] = {}
        self.rows: dict[str, dict] = {r.id: {} for r in records}
        self.secrets: dict[str, dict] = {}
        self.heartbeats = 0

    async def connect(self): pass
    async def register_bridge(self, name): return "bridge-1"
    async def subscribe(self, on_command, on_devices): pass
    async def close(self): pass
    async def report_discovered(self, found): pass

    async def heartbeat(self):
        self.heartbeats += 1

    async def load_devices(self):
        return list(self.records)

    async def pending_commands(self):
        return [Command(i, c["device_id"], c["patch"], c["created_at"])
                for i, c in self.commands.items() if c["status"] == "pending"]

    async def claim_command(self, command_id):
        if self.commands[command_id]["status"] != "pending":
            return False
        self.commands[command_id]["status"] = "running"
        return True

    async def finish_command(self, command_id, status, error=None):
        self.commands[command_id].update(status=status, error=error)

    async def report_state(self, device_id, state, *, online, error=None):
        row = self.rows[device_id]
        row.update(status="online" if online else "offline", last_error=error)
        if state is not None:
            row.update(state.to_row())

    async def report_ip(self, device_id, ip): pass

    async def save_secrets(self, device_id, secrets):
        self.secrets[device_id] = secrets


async def wait_for(condition, seconds=8.0):
    deadline = asyncio.get_running_loop().time() + seconds
    while not condition():
        assert asyncio.get_running_loop().time() < deadline, "timed out"
        await asyncio.sleep(0.05)


async def test_command_from_the_app_reaches_the_ac(monkeypatch):
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    monkeypatch.setattr(gree, "GREE_PORT", port)
    monkeypatch.setattr(gree, "REPLY_TIMEOUT", 0.5)
    monkeypatch.setattr(bridge_module, "COMMAND_POLL_SECONDS", 0.1)
    ac = VirtualGree()
    transport = await serve(ac, "127.0.0.1", port)

    record = DeviceRecord(id="ck-1", name="Lounge", brand="gree", vendor="Climate King", ip="127.0.0.1", mac=ac.mac)
    store = MemoryStore([record])
    bridge = Bridge(store, "test", Settings(poll_seconds=1, readback_delay=0.1), discovery_minutes=0)
    task = asyncio.create_task(bridge.run())
    try:
        await wait_for(lambda: store.rows["ck-1"].get("status") == "online")
        assert store.secrets["ck-1"]["key"] == ac.key, "the bind key is saved for the phone's LAN fallback"

        store.commands[1] = {"device_id": "ck-1", "patch": {"isOn": True, "targetTemp": 20, "mode": "cool"},
                             "created_at": datetime.now(timezone.utc), "status": "pending"}
        await wait_for(lambda: store.commands[1]["status"] == "done")
        assert store.commands[1]["error"] is None
        assert ac.props["Pow"] == 1 and ac.props["SetTem"] == 20
        assert store.rows["ck-1"]["is_on"] is True and store.rows["ck-1"]["target_temp"] == 20
        assert store.heartbeats >= 1
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        transport.close()
