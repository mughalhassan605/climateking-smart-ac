#!/usr/bin/env python3
"""Virtual Gree / Climate King AC that speaks the real, encrypted Gree LAN protocol (UDP 7000).

Unlike a plain beacon it answers scan, bind, status and command requests exactly like a unit's
Wi-Fi module, so the Home Bridge and the app can be tested end to end without hardware:

  python3 simulator/gree_ac.py                    # one AC on 0.0.0.0:7000
  python3 simulator/gree_ac.py --drop 0.3         # lose 30% of replies (flaky Wi-Fi)
  python3 simulator/gree_ac.py --cipher v2        # newer firmware (AES-GCM)

Needs: pip install cryptography
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import random
import secrets
import string
from dataclasses import dataclass, field

from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

GENERIC_KEY = {"v1": b"a3K8Bx%2r8Y7#xDh", "v2": b"{yxAHAY_Lm6pbC/<"}
GCM_NONCE = bytes.fromhex("5440784449675a516c5e6313")
GCM_AAD = b"qualcomm-test"
TEMP_SENSOR_OFFSET = 40


def encrypt(data: dict, key: bytes, cipher: str) -> tuple[str, str | None]:
    plain = json.dumps(data, separators=(",", ":")).encode()
    if cipher == "v2":
        sealed = AESGCM(key).encrypt(GCM_NONCE, plain, GCM_AAD)
        return base64.b64encode(sealed[:-16]).decode(), base64.b64encode(sealed[-16:]).decode()
    padder = padding.PKCS7(128).padder()
    enc = Cipher(algorithms.AES(key), modes.ECB()).encryptor()
    return base64.b64encode(enc.update(padder.update(plain) + padder.finalize()) + enc.finalize()).decode(), None


def decrypt(pack: str, key: bytes, cipher: str, tag: str | None) -> dict:
    data = base64.b64decode(pack)
    if cipher == "v2":
        plain = AESGCM(key).decrypt(GCM_NONCE, data + base64.b64decode(tag or ""), GCM_AAD)
    else:
        dec = Cipher(algorithms.AES(key), modes.ECB()).decryptor()
        padded = dec.update(data) + dec.finalize()
        unpadder = padding.PKCS7(128).unpadder()
        plain = unpadder.update(padded) + unpadder.finalize()
    return json.loads(plain)


@dataclass
class VirtualGree:
    mac: str = "f4911e5a0c01"
    name: str = "Virtual Climate King"
    cipher: str = "v1"
    drop: float = 0.0
    room_temp: int = 31
    key: str = field(default_factory=lambda: "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16)))
    props: dict = field(
        default_factory=lambda: {
            "Pow": 0, "Mod": 1, "SetTem": 24, "TemUn": 0, "TemRec": 0, "WdSpd": 0, "Quiet": 0, "Tur": 0,
            "SwUpDn": 0, "SwingLfRig": 0, "Lig": 1, "Blo": 0, "Health": 0, "SwhSlp": 0, "SvSt": 0,
        }
    )
    log: bool = False

    def reply(self, request: dict) -> dict | None:
        """The datagram the unit sends back to one request, or None for no reply."""
        if request.get("t") == "scan":
            pack, tag = encrypt(
                {
                    "t": "dev", "cid": self.mac, "bc": "gree", "brand": "gree", "catalog": "gree",
                    "mac": self.mac, "mid": "10001", "model": "gree", "name": self.name,
                    "series": "gree", "vender": "1", "ver": "V1.2.1", "lock": 0,
                },
                GENERIC_KEY[self.cipher], self.cipher,
            )
            return self._envelope(pack, tag, i=1)
        if request.get("t") != "pack" or "pack" not in request:
            return None
        bind = request.get("i") == 1
        key = GENERIC_KEY[self.cipher] if bind else self.key.encode()
        try:
            inner = decrypt(request["pack"], key, self.cipher, request.get("tag"))
        except Exception:  # noqa: BLE001 - wrong key or cipher: real units stay silent
            return None
        kind = inner.get("t")
        if kind == "bind":
            out = {"t": "bindok", "mac": self.mac, "key": self.key, "r": 200}
        elif kind == "status":
            cols = [c for c in inner.get("cols", []) if c in self.props or c in ("TemSen", "hid")]
            out = {"t": "dat", "mac": self.mac, "r": 200, "cols": cols, "dat": [self._value(c) for c in cols]}
        elif kind == "cmd":
            opts, values = inner.get("opt", []), inner.get("p", [])
            for name, value in zip(opts, values):
                if name in self.props:
                    self.props[name] = value
            if self.log:
                print(f"[gree] {self.name}: {dict(zip(opts, values))}")
            out = {"t": "res", "mac": self.mac, "r": 200, "opt": opts, "p": values, "val": values}
        else:
            return None
        pack, tag = encrypt(out, key, self.cipher)
        return self._envelope(pack, tag, i=1 if bind else 0)

    def _value(self, column: str):
        if column == "TemSen":
            return self.room_temp + TEMP_SENSOR_OFFSET
        if column == "hid":
            return "362001000762+U-WB05RT13V1.21.bin"
        return self.props[column]

    def _envelope(self, pack: str, tag: str | None, i: int) -> dict:
        env = {"t": "pack", "i": i, "uid": 0, "cid": self.mac, "tcid": "", "pack": pack}
        if tag:
            env["tag"] = tag
        return env


class _Protocol(asyncio.DatagramProtocol):
    def __init__(self, unit: VirtualGree) -> None:
        self.unit = unit
        self.transport: asyncio.DatagramTransport | None = None

    def connection_made(self, transport) -> None:
        self.transport = transport

    def datagram_received(self, data: bytes, addr) -> None:
        try:
            request = json.loads(data)
        except ValueError:
            return
        answer = self.unit.reply(request)
        if answer is None or random.random() < self.unit.drop:
            return
        assert self.transport is not None
        self.transport.sendto(json.dumps(answer).encode(), addr)


async def serve(unit: VirtualGree, host: str = "0.0.0.0", port: int = 7000) -> asyncio.DatagramTransport:
    """Start answering on host:port. Close the returned transport to stop."""
    loop = asyncio.get_running_loop()
    transport, _ = await loop.create_datagram_endpoint(
        lambda: _Protocol(unit), local_addr=(host, port), allow_broadcast=True
    )
    return transport


async def _main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=7000)
    parser.add_argument("--mac", default="f4911e5a0c01")
    parser.add_argument("--cipher", choices=["v1", "v2"], default="v1")
    parser.add_argument("--drop", type=float, default=0.0, help="fraction of replies to lose (0-1)")
    args = parser.parse_args()
    unit = VirtualGree(mac=args.mac, cipher=args.cipher, drop=args.drop, log=True)
    await serve(unit, args.host, args.port)
    print(f"Virtual Gree AC {unit.mac} ({unit.cipher}) on {args.host}:{args.port}, dropping {args.drop:.0%} of replies.")
    print("Ctrl+C to stop.")
    await asyncio.Event().wait()


if __name__ == "__main__":
    try:
        asyncio.run(_main())
    except KeyboardInterrupt:
        pass
