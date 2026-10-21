"""AUX payloads carried over BroadLink (devtype 0x4E2A), the protocol of the AC Freedom app.

Kenwood eSmart units sold in Pakistan pair with AC Freedom, as do AUX, Tornado, Ballu, Rcool and
other AUX-built units. The BroadLink transport (UDP 80, AES-CBC, auth handshake) comes from
python-broadlink; this module only builds and parses the AC payloads inside it.

Sources, cross-checked against each other:
  * liaan/broadlink_ac_mqtt (ac_db.py), which lists Kenwood among its units
  * ArtemVladimirov/broadlinkac2mqtt (app/service/local.go)
  * mjg59/python-broadlink (climate.py, class hvac)
The two status requests below are byte-for-byte what the AC Freedom app sends, and their trailing
two bytes are a ones'-complement (internet) checksum, which is what this module computes. Where the
sources disagree on a code (heat/fan mode, the vane codes) the two that agree are followed.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

DEVTYPE = 0x4E2A

# (len=12) bb 00 06 80 00 00 | data len 2 | 11 01 = "get state" | checksum
GET_STATE = bytes.fromhex("0c00bb0006800000020011012b7e0000")
# same frame with 21 01 = "get info" (ambient temperature)
GET_INFO = bytes.fromhex("0c00bb0006800000020021011b7e0000")

MODE_CODES = {"auto": 0, "cool": 1, "dry": 2, "heat": 4, "fan": 6}
MODE_FROM_CODE = {0: "auto", 1: "cool", 2: "dry", 3: "heat", 4: "heat", 6: "fan"}
FAN_HIGH, FAN_MEDIUM, FAN_LOW, FAN_AUTO = 1, 2, 3, 5
VANE_SWING_V = 6
VANE_OFF_V = 7
VANE_SWING_H = 0
VANE_OFF_H = 7


@dataclass(frozen=True)
class AuxState:
    """Every field the unit reports, so a write can send back the ones it does not change."""

    power: int = 0
    temp: float = 24
    mode: int = 1
    fan: int = FAN_AUTO
    vane_v: int = VANE_OFF_V
    vane_h: int = VANE_OFF_H
    turbo: int = 0
    mute: int = 0
    sleep: int = 0
    health: int = 0
    clean: int = 0
    display: int = 1
    mildew: int = 0


def internet_checksum(data: bytes) -> int:
    padded = data + b"\x00" if len(data) % 2 else data
    total = sum((padded[i] << 8) + padded[i + 1] for i in range(0, len(padded), 2))
    total = (total >> 16) + (total & 0xFFFF)
    total += total >> 16
    return ~total & 0xFFFF


def frame(body: bytes) -> bytes:
    """[len][0] body [checksum BE], zero padded to a multiple of 16 for the BroadLink layer."""
    length = len(body) + 2
    out = bytearray([length & 0xFF, length >> 8]) + body
    out += internet_checksum(body).to_bytes(2, "big")
    out += bytes((-len(out)) % 16)
    return bytes(out)


def encode_set_state(state: AuxState) -> bytes:
    temp = min(32.0, max(16.0, round(state.temp * 2) / 2))
    whole = int(temp)
    half = 1 if temp - whole else 0
    body = bytearray(23)
    body[0:10] = bytes.fromhex("bb00068000000f000101")
    body[10] = ((whole - 8) << 3) | (state.vane_v & 0b111)
    body[11] = (state.vane_h & 0b111) << 5
    body[12] = 0b00001111 | (half << 7)
    body[13] = (state.fan & 0b111) << 5
    body[14] = (state.turbo & 1) << 6 | (state.mute & 1) << 7
    body[15] = (state.mode & 0b111) << 5 | (state.sleep & 1) << 2
    body[18] = (state.power & 1) << 5 | (state.health & 1) << 1 | (state.clean & 1) << 2
    body[20] = (state.display & 1) << 4 | (state.mildew & 1) << 3
    return frame(bytes(body))


class AuxDecodeError(ValueError):
    pass


def decode_state(plain: bytes) -> AuxState:
    """Parse the decrypted reply to GET_STATE."""
    if len(plain) < 25 or plain[4] != 0x07:
        raise AuxDecodeError("not a state reply")
    p = plain[2:]
    temp = 8 + (p[10] >> 3) + 0.5 * (p[12] >> 7)
    if not 16 <= temp <= 32:
        raise AuxDecodeError(f"implausible setpoint {temp}")
    return AuxState(
        power=p[18] >> 5 & 1,
        temp=temp,
        mode=p[15] >> 5 & 0b111,
        fan=p[13] >> 5 & 0b111,
        vane_v=p[10] & 0b111,
        vane_h=p[11] >> 5 & 0b111,
        turbo=p[14] >> 6 & 1,
        mute=p[14] >> 7 & 1,
        sleep=p[15] >> 2 & 1,
        health=p[18] >> 1 & 1,
        clean=p[18] >> 2 & 1,
        display=p[20] >> 4 & 1,
        mildew=p[20] >> 3 & 1,
    )


def decode_ambient(plain: bytes) -> float | None:
    """Room temperature from the decrypted reply to GET_INFO, or None if it carries none."""
    if len(plain) < 34:
        return None
    raw = plain[17]
    whole = raw - 32 if raw >= 32 else raw & 0b11111
    value = whole + (plain[33] & 0b11111) / 10
    return round(value, 1) if 0 < value < 60 else None


def with_changes(base: AuxState, **changes) -> AuxState:
    return replace(base, **changes)
