"""BroadLink/DNA JSON transport used by TCL units that pair with the TCL "Intelligent AC" app.

Ported from jestempablo/home-assistant-tcl-intelligent-ac (custom_components/tcl_intelligent_ac/
protocol.py), MIT licence, Copyright (c) 2026 Pawel Forynski. Reduced to what the bridge needs:
discovery, local authentication and the get/set JSON request.
"""

from __future__ import annotations

import json
import math
import os
import socket
import struct
import time
from dataclasses import dataclass
from typing import Any

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

IV = bytes.fromhex("562e17996d093d28ddb3ba695a2e6f58")
MAGIC = bytes.fromhex("5aa5aa555aa5aa55")
INNER_MAGIC = bytes.fromhex("a5a55a5a")
TCL_DEVTYPES = (0x507C, 0x507A)
COMMAND = 0x006A
AUTH_COMMAND = 0x0065
INIT_KEY = bytes.fromhex("097628343fe99e23765c1513accf8b02")
RESPONSE_COMMAND = 0x03EE
PORT = 80
DISCOVERY_PAYLOAD = bytes.fromhex(
    "5aa5aa555aa5aa5502000000ea07041f0a001805000000001002000a688d0000ffc40000000006000000000000000000"
)


class DnaError(Exception):
    pass


class DnaTimeout(DnaError):
    pass


class DnaLocked(DnaError):
    pass


@dataclass(frozen=True)
class DnaDevice:
    host: str
    mac: str
    devtype: int
    name: str
    is_locked: bool


def checksum(data: bytes) -> int:
    value = 0xBEAF
    for byte in data:
        value = (value + byte) & 0xFFFF
    return value


def _aes(key: bytes, data: bytes, decrypt: bool) -> bytes:
    cipher = Cipher(algorithms.AES(key), modes.CBC(IV))
    op = cipher.decryptor() if decrypt else cipher.encryptor()
    return op.update(data) + op.finalize()


def _udp(host: str, packet: bytes, timeout: float) -> bytes:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.settimeout(timeout)
        sock.sendto(packet, (host, PORT))
        try:
            response, _ = sock.recvfrom(2048)
        except (TimeoutError, socket.timeout) as exc:
            raise DnaTimeout(f"no answer from {host}") from exc
    return response


def _packet(devtype: int, command: int, mac: str, device_id: int, key: bytes, plain: bytes) -> bytes:
    plain = plain + b"\x00" * ((16 - len(plain) % 16) % 16)
    encrypted = _aes(key, plain, decrypt=False)
    packet = bytearray(56 + len(encrypted))
    packet[0:8] = MAGIC
    struct.pack_into("<H", packet, 0x24, devtype)
    struct.pack_into("<H", packet, 0x26, command)
    packet[0x28:0x2A] = os.urandom(2)
    packet[0x2A:0x30] = bytes.fromhex(mac)[::-1]
    struct.pack_into("<I", packet, 0x30, device_id)
    struct.pack_into("<H", packet, 0x34, checksum(plain))
    packet[0x38:] = encrypted
    struct.pack_into("<H", packet, 0x20, checksum(bytes(packet)))
    return bytes(packet)


def discover(timeout: float = 3.0) -> list[DnaDevice]:
    found: dict[str, DnaDevice] = {}
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.settimeout(0.2)
        sock.bind(("0.0.0.0", 0))
        for target in (("255.255.255.255", PORT), ("224.0.0.251", PORT), ("224.0.0.251", 16680)):
            try:
                sock.sendto(DISCOVERY_PAYLOAD, target)
            except OSError:
                continue
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                packet, remote = sock.recvfrom(2048)
            except (TimeoutError, socket.timeout):
                continue
            except OSError:
                break
            if len(packet) < 0x40:
                continue
            devtype = struct.unpack_from("<H", packet, 0x34)[0]
            if devtype not in TCL_DEVTYPES:
                continue
            mac = packet[0x3A:0x40][::-1].hex()
            name = packet[0x40:].split(b"\x00")[0].decode(errors="ignore").strip()
            locked = bool(packet[0x7F]) if len(packet) > 0x7F else False
            found[mac] = DnaDevice(remote[0], mac, devtype, name or f"TCL AC {mac[-6:]}", locked)
    return list(found.values())


def authenticate(host: str, mac: str, devtype: int, timeout: float = 3.0) -> tuple[str, int]:
    """Local login. Returns (key as 32 hex chars, device id) for get_state/set_params."""
    payload = bytearray(0x50)
    payload[0x04:0x14] = b"\x31" * 16
    payload[0x1E] = 0x01
    payload[0x2D] = 0x01
    payload[0x30:0x36] = b"Test 1"
    response = _udp(host, _packet(devtype, AUTH_COMMAND, mac, 0, INIT_KEY, bytes(payload)), timeout)
    if len(response) < 0x48:
        raise DnaError("authentication reply too short")
    error = struct.unpack_from("<H", response, 0x22)[0]
    if error == 0xFFFF:
        raise DnaLocked("the unit is locked for local control")
    if error:
        raise DnaError(f"authentication failed (0x{error:04x})")
    plain = _aes(INIT_KEY, response[0x38:], decrypt=True)
    return plain[0x04:0x14].hex(), struct.unpack_from("<I", plain, 0)[0]


def request(
    host: str, mac: str, key: str, device_id: int, action: str, body: dict[str, Any], timeout: float = 3.0
) -> dict[str, Any]:
    """Send one get/set JSON request and return the unit's full state from the reply."""
    body_bytes = json.dumps(body, separators=(",", ":")).encode()
    plain = bytearray(math.ceil((14 + len(body_bytes)) / 16) * 16)
    struct.pack_into("<H", plain, 0, 12 + len(body_bytes))
    plain[2:6] = INNER_MAGIC
    plain[8] = 1 if action == "get" else 2
    plain[9] = 0x0B
    struct.pack_into("<I", plain, 10, len(body_bytes))
    plain[14 : 14 + len(body_bytes)] = body_bytes
    struct.pack_into("<H", plain, 6, checksum(bytes(plain[2:6]) + bytes(plain[8:])))

    key_bytes = bytes.fromhex(key)
    packet = _packet(TCL_DEVTYPES[0], COMMAND, mac, device_id, key_bytes, bytes(plain))
    response = _udp(host, packet, timeout)

    if len(response) < 72:
        raise DnaError(f"reply too short ({len(response)} bytes)")
    command = struct.unpack_from("<H", response, 0x26)[0]
    if command != RESPONSE_COMMAND:
        raise DnaError(f"unexpected reply command 0x{command:04x}")
    reply = _aes(key_bytes, response[0x38:], decrypt=True)
    if struct.unpack_from("<H", response, 0x34)[0] != checksum(reply):
        raise DnaError("reply checksum mismatch (wrong key?)")
    length = struct.unpack_from("<H", reply, 0)[0] - 12
    if length < 0 or 14 + length > len(reply):
        raise DnaError("invalid reply length")
    return json.loads(reply[14 : 14 + length].decode())
