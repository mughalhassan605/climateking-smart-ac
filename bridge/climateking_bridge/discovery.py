"""Find every supported AC on the LAN, whatever its brand, in one pass."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

_LOGGER = logging.getLogger(__name__)


@dataclass
class Found:
    brand: str
    ip: str
    mac: str
    name: str | None = None
    model: str | None = None
    needs_key: bool = False
    details: dict[str, Any] = field(default_factory=dict)


async def _gree(seconds: int) -> list[Found]:
    from .drivers.gree import normalize, scan

    return [
        Found("gree", info.ip, normalize(info.mac), info.name, info.model, details={"brand": info.brand})
        for info in await scan(seconds)
    ]


async def _broadlink(seconds: int) -> list[Found]:
    import broadlink

    from .protocols import aux, broadlink_dna

    found = []
    for device in await asyncio.to_thread(broadlink.discover, timeout=seconds):
        if device.devtype == aux.DEVTYPE:
            found.append(
                Found(
                    "broadlink", device.host[0], device.mac.hex(), device.name or None, "AC Freedom",
                    details={"locked": bool(device.is_locked)},
                )
            )
        elif device.devtype in broadlink_dna.TCL_DEVTYPES:
            found.append(_tcl_found(device.host[0], device.mac.hex(), device.name, device.is_locked, device.devtype))
    return found


def _tcl_found(ip: str, mac: str, name: str | None, locked: bool, devtype: int) -> Found:
    return Found(
        "tcl", ip, mac, name or None, "TCL Intelligent AC", details={"locked": bool(locked), "devtype": devtype}
    )


async def _tcl(seconds: int) -> list[Found]:
    """TCL modules also answer the Intelligent AC app's own probe, which some ignore the plain hello for."""
    from .protocols import broadlink_dna

    return [
        _tcl_found(d.host, d.mac, d.name, d.is_locked, d.devtype)
        for d in await asyncio.to_thread(broadlink_dna.discover, float(seconds))
    ]


async def _tuya(seconds: int) -> list[Found]:
    from .drivers.tuya import listen_for_broadcasts

    found = []
    for device_id, info in (await asyncio.to_thread(listen_for_broadcasts, seconds)).items():
        found.append(
            Found(
                # Tuya announcements carry no MAC; the device id is the stable identity instead.
                "tuya", info.get("ip", ""), device_id, None, info.get("productKey"), needs_key=True,
                details={"device_id": device_id, "version": str(info.get("version", ""))},
            )
        )
    return found


async def _haier(seconds: int) -> list[Found]:
    try:
        from haismart_hrdp import udiscovery
    except ImportError:
        return []
    found = []
    for info in await asyncio.to_thread(udiscovery.discover):
        device_id = str(getattr(info, "device_id", ""))
        if not device_id:
            continue
        found.append(
            Found(
                "haier", info.host, device_id.lower(), None,
                getattr(info, "uplus_id", None), needs_key=True,
                details={"device_id": device_id, "uplus_id": getattr(info, "uplus_id", None)},
            )
        )
    return found


async def scan_all(seconds: int = 6) -> list[Found]:
    """Run every brand's discovery side by side. A brand whose scan fails is skipped, not fatal."""
    scans = {
        "gree": _gree(seconds),
        "broadlink": _broadlink(seconds),
        "tcl": _tcl(seconds),
        "tuya": _tuya(seconds + 2),
        "haier": _haier(seconds),
    }
    results = await asyncio.gather(*scans.values(), return_exceptions=True)
    found: dict[tuple[str, str], Found] = {}
    for brand, result in zip(scans, results):
        if isinstance(result, BaseException):
            _LOGGER.debug("%s discovery failed: %s", brand, result)
            continue
        for item in result:
            if item.mac:
                found[(item.brand, item.mac)] = item
    return list(found.values())
