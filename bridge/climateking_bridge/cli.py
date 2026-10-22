"""climateking-bridge command line.

  climateking-bridge run           keep every AC connected (the normal mode; runs until stopped)
  climateking-bridge discover      list the ACs this computer can see on the LAN
  climateking-bridge check ...     talk to one AC directly, without Supabase, to test it
  climateking-bridge tuya-sync     copy Tuya ids and local keys from the Tuya cloud to your devices
  climateking-bridge doctor        check bridge.env, the sign-in and what is on the LAN
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys

from . import __version__
from .config import ConfigError, load


def _logging(level: str, log_file: str | None = None) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler()]
    if log_file:
        from logging.handlers import RotatingFileHandler

        handlers.append(RotatingFileHandler(log_file, maxBytes=2_000_000, backupCount=3, encoding="utf-8"))
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s: %(message)s", handlers=handlers)
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
    _logging(config.log_level, config.log_file)
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


async def cmd_doctor(args) -> int:
    """Walk through everything `run` needs and say plainly what is wrong."""
    from .discovery import scan_all
    from .store import SupabaseStore

    _logging("WARNING")
    ok = True
    config = load(args.config)
    print(f"[ok]   bridge.env loaded (bridge name: {config.bridge_name})")
    store = SupabaseStore(config.supabase_url, config.supabase_anon_key, config.email, config.password)
    try:
        await store.connect()
        devices = await store.load_devices()
        print(f"[ok]   signed in as {config.email}: {len(devices)} AC(s) in your account")
        for d in devices:
            missing = []
            if d.brand in ("gree", "broadlink", "tcl") and not d.mac:
                missing.append("MAC address")
            if d.brand in ("tuya", "haier") and not d.secrets.get("local_key"):
                missing.append("local key")
            note = f"  -> needs {', '.join(missing)}" if missing else ""
            print(f"         {d.name:24} {d.brand:10} {d.ip or 'no IP yet':15}{note}")
    except Exception as exc:  # noqa: BLE001
        ok = False
        print(f"[FAIL] could not sign in to Supabase: {exc}")
        print("       Check CK_EMAIL / CK_PASSWORD (the account you use in the app) and SUPABASE_URL.")
    finally:
        await store.close()
    if config.tuya_cloud_configured:
        cloud = tuya_cloud(config)
        result = await asyncio.to_thread(cloud.getdevices, False)
        if isinstance(result, list):
            print(f"[ok]   Tuya cloud: {len(result)} unit(s) linked")
        else:
            ok = False
            print(f"[FAIL] Tuya cloud: {result}")
    else:
        print("[--]   Tuya cloud not configured (only needed for Hyundai / Smart Life units)")
    found = await scan_all(6)
    if found:
        print(f"[ok]   {len(found)} AC(s) answering on this Wi-Fi:")
        for f in found:
            print(f"         {f.brand:10} {f.ip:15} {f.mac}")
    else:
        print("[??]   no AC answered on this Wi-Fi. Is this computer on the same network as the ACs?")
        print("       On Windows, allow Python through the firewall (private networks).")
    return 0 if ok else 1


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
    sub.add_parser("doctor", help="check the setup step by step")

    args = parser.parse_args(argv)
    handler = {
        None: cmd_run, "run": cmd_run, "discover": cmd_discover, "check": cmd_check, "tuya-sync": cmd_tuya_sync, "doctor": cmd_doctor,
    }[args.command]
    try:
        return asyncio.run(handler(args))
    except ConfigError as exc:
        print(f"config error: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 0
