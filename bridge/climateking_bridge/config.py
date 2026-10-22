"""Bridge settings, from environment variables or a `bridge.env` file (KEY=value per line)."""

from __future__ import annotations

import os
import socket
from dataclasses import dataclass
from pathlib import Path

from .worker import Settings

DEFAULT_FILES = (Path("bridge.env"), Path.home() / ".climateking-bridge" / "bridge.env")


class ConfigError(Exception):
    pass


@dataclass
class Config:
    supabase_url: str
    supabase_anon_key: str
    email: str
    password: str
    bridge_name: str
    settings: Settings
    discovery_minutes: float = 10
    tuya_region: str | None = None
    tuya_api_key: str | None = None
    tuya_api_secret: str | None = None
    log_level: str = "INFO"
    log_file: str | None = None

    @property
    def tuya_cloud_configured(self) -> bool:
        return bool(self.tuya_region and self.tuya_api_key and self.tuya_api_secret)


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        values[key.strip()] = value
    return values


def load(path: str | None = None) -> Config:
    values: dict[str, str] = {}
    candidates = [Path(path)] if path else [p for p in DEFAULT_FILES if p.exists()]
    for candidate in candidates[:1]:
        if not candidate.exists():
            raise ConfigError(f"config file {candidate} does not exist")
        values.update(read_env_file(candidate))
    values.update({k: v for k, v in os.environ.items() if k.startswith(("CK_", "SUPABASE_", "TUYA_"))})

    def get(key: str, default: str | None = None) -> str | None:
        value = values.get(key, default)
        return value if value not in ("", None) else default

    def number(key: str, default: float) -> float:
        raw = get(key)
        try:
            return float(raw) if raw is not None else default
        except ValueError as exc:
            raise ConfigError(f"{key} must be a number, got {raw!r}") from exc

    missing = [k for k in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "CK_EMAIL", "CK_PASSWORD") if not get(k)]
    if missing:
        raise ConfigError(
            "missing settings: " + ", ".join(missing) + ". Copy bridge.env.example to bridge.env and fill it in."
        )

    return Config(
        supabase_url=get("SUPABASE_URL"),
        supabase_anon_key=get("SUPABASE_ANON_KEY"),
        email=get("CK_EMAIL"),
        password=get("CK_PASSWORD"),
        bridge_name=get("CK_BRIDGE_NAME", socket.gethostname()),
        settings=Settings(
            poll_seconds=number("CK_POLL_SECONDS", 10),
            offline_after=int(number("CK_OFFLINE_AFTER", 3)),
            command_ttl=number("CK_COMMAND_TTL_SECONDS", 120),
        ),
        discovery_minutes=number("CK_DISCOVERY_MINUTES", 10),
        tuya_region=get("TUYA_REGION"),
        tuya_api_key=get("TUYA_API_KEY"),
        tuya_api_secret=get("TUYA_API_SECRET"),
        log_level=get("CK_LOG_LEVEL", "INFO").upper(),
        log_file=get("CK_LOG_FILE"),
    )
