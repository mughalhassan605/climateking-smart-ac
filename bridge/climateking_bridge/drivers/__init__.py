"""One driver per wire protocol. `brand` in the devices table picks the driver."""

from __future__ import annotations

from typing import Any

from .base import DeviceRecord, Driver, DriverError, NeedsSetup, Unreachable

BRANDS = ("gree", "broadlink", "tcl", "tuya", "haier")


def make_driver(record: DeviceRecord, tuya_cloud: Any = None) -> Driver:
    if record.brand == "gree":
        from .gree import GreeDriver

        return GreeDriver(record)
    if record.brand == "broadlink":
        from .aux import AuxDriver

        return AuxDriver(record)
    if record.brand == "tcl":
        from .tcl import TclDriver

        return TclDriver(record)
    if record.brand == "tuya":
        from .tuya import TuyaDriver

        return TuyaDriver(record, tuya_cloud)
    if record.brand == "haier":
        from .haier import HaierDriver

        return HaierDriver(record)
    raise ValueError(f"unsupported brand {record.brand!r}")


__all__ = ["BRANDS", "DeviceRecord", "Driver", "DriverError", "NeedsSetup", "Unreachable", "make_driver"]
