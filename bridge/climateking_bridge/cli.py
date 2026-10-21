"""climateking-bridge command line.

  climateking-bridge run           keep every AC connected (the normal mode; runs until stopped)
  climateking-bridge discover      list the ACs this computer can see on the LAN
  climateking-bridge check ...     talk to one AC directly, without Supabase, to test it
  climateking-bridge tuya-sync     copy Tuya ids and local keys from the Tuya cloud to your devices
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys

from . import __version__
from .config import ConfigError, load


def _logging(level: str) -> None:
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    # Library chatter (every UDP packet) only in DEBUG.
    for noisy in ("greeclimate", "httpx", "hpack", "realtime", "websockets"):
        logging.getLogger(noisy).setLevel(max(logging.WARNING, logging.getLogger().level))


def tuya_cloud(config):
    if not config.tuya_cloud_configured:
        return None
    import tinytuya

    return tinytuya.Cloud(config.tuya_region, config.tuya_api_key, config.tuya_api_secret)


async def cmd_run(args) -> int:
    from .bridge import Bridge
    from .store import SupabaseStore

    config = load(args.config)
    _logging(config.log_level)
    store = SupabaseStore(config.supabase_url, config.supabase_anon_key, config.email, config.password)
    bridge = Bridge(store, config.bridge_name, config.settings, config.discovery_minutes, tuya_cloud(config))
    await bridge.run()
    return 0


async def cmd_discover(args) -> int:
    from .discovery import scan_all

    _logging("WARNING")
    print(f"Scanning the LAN for {args.seconds} s ...")
    found = await scan_all(args.seconds)
    if not found:
        print("Nothing found. Is this computer on the same Wi-Fi as the ACs (2.4 GHz network)?")
        return 1
    for item in sorted(found, key=lambda f: (f.brand, f.ip)):
        note = "  (needs key)" if item.needs_key else ""
        print(f"{item.brand:10} {item.ip:15} {item.mac:24} {item.name or item.model or ''}{note}")
    return 0


async def cmd_check(args) -> int:
    from .drivers import make_driver
    from .drivers.base import DeviceRecord, DriverError, normalize_mac
    from .state import apply_patch

    _logging("DEBUG" if args.verbose else "WARNING")
    secrets = json.loads(args.secrets) if args.secrets else {}
    record = DeviceRecord(
        id="check", name=args.ip, brand=args.brand, vendor=args.brand, ip=args.ip,
        mac=normalize_mac(args.mac or ""), secrets=secrets, cloud_id=args.cloud_id,
    )
    driver = make_driver(record)
    try:
        state = await driver.read()
        print("status:", json.dumps(state.to_row()))
        if args.set:
            patch = json.loads(args.set)
            echoed = await driver.apply(apply_patch(state, patch), patch)
            await asyncio.sleep(1)
            print("after:", json.dumps((echoed or await driver.read()).to_row()))
        learned = driver.take_secret_changes()
        if learned:
            print("learned secrets:", json.dumps(learned))
        return 0
    except DriverError as exc:
        print(f"failed: {exc}", file=sys.stderr)
        return 1
    finally:
        await driver.close()


async def cmd_tuya_sync(args) -> int:
    from .drivers.base import normalize_mac
    from .store import SupabaseStore

    config = load(args.config)
    _logging(config.log_level)
    cloud = tuya_cloud(config)
    if cloud is None:
        print("Set TUYA_REGION, TUYA_API_KEY and TUYA_API_SECRET in bridge.env first (see README).")
        return 1
    tuya_devices = await asyncio.to_thread(cloud.getdevices, False)
    if not isinstance(tuya_devices, list):
        print(f"Tuya cloud error: {tuya_devices}")
        return 1
    store = SupabaseStore(config.supabase_url, config.supabase_anon_key, config.email, config.password)
    await store.connect()
    devices = [d for d in await store.load_devices() if d.brand == "tuya"]
    updated = 0
    for remote in tuya_devices:
        match = next(
            (
                d for d in devices
                if d.cloud_id == remote.get("id")
                or d.secrets.get("device_id") == remote.get("id")
                or (d.mac and d.mac == normalize_mac(remote.get("mac") or ""))
            ),
            None,
        )
        label = f"{remote.get('name')} ({remote.get('id')})"
        if match is None:
            print(f"  not in the app yet: {label}  - add it in the app, then run tuya-sync again")
            continue
        secrets = {**match.secrets, "device_id": remote["id"], "local_key": remote.get("key")}
        await store.save_secrets(match.id, secrets)
        await store.update_device(match.id, {"cloud_id": remote["id"]})
        updated += 1
        print(f"  {match.name}: key saved from {label}")
    print(f"{updated} unit(s) updated.")
    await store.close()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="climateking-bridge", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--version", action="version", version=__version__)
    parser.add_argument("--config", help="path to bridge.env (default: ./bridge.env or ~/.climateking-bridge/bridge.env)")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("run", help="keep every AC connected")
    discover = sub.add_parser("discover", help="list ACs on the LAN")
    discover.add_argument("--seconds", type=int, default=6)

    check = sub.add_parser("check", help="read (and optionally change) one AC directly")
    check.add_argument("--brand", required=True, choices=["gree", "broadlink", "tcl", "tuya", "haier"])
    check.add_argument("--ip", required=True)
    check.add_argument("--mac", help="needed for gree, broadlink and tcl")
    check.add_argument("--secrets", help='JSON, e.g. \'{"device_id": "...", "local_key": "..."}\' for tuya')
    check.add_argument("--cloud-id")
    check.add_argument("--set", help='JSON patch, e.g. \'{"isOn": true, "targetTemp": 24}\'')
    check.add_argument("-v", "--verbose", action="store_true")

    sub.add_parser("tuya-sync", help="fetch Tuya ids and local keys from the Tuya cloud")

    args = parser.parse_args(argv)
    handler = {
        None: cmd_run, "run": cmd_run, "discover": cmd_discover, "check": cmd_check, "tuya-sync": cmd_tuya_sync,
    }[args.command]
    try:
        return asyncio.run(handler(args))
    except ConfigError as exc:
        print(f"config error: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 0
