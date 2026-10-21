from climateking_bridge.drivers.aux import to_raw, to_state
from climateking_bridge.protocols import aux
from climateking_bridge.state import AcState, Airflow, Axis, apply_patch


def test_status_requests_match_the_ac_freedom_app():
    # The app's own query bytes (captured in liaan/broadlink_ac_mqtt) carry an internet checksum.
    assert aux.frame(bytes.fromhex("bb0006800000020011 01".replace(" ", ""))) == aux.GET_STATE
    assert aux.frame(bytes.fromhex("bb000680000002002101")) == aux.GET_INFO


def reply_for(state: aux.AuxState) -> bytes:
    """What a unit sends back: the set frame with the reply marker (0x07) in byte 4."""
    framed = bytearray(aux.encode_set_state(state))
    framed[4] = 0x07
    return bytes(framed)


def test_set_state_round_trips_through_the_status_layout():
    raw = aux.AuxState(power=1, temp=23.5, mode=aux.MODE_CODES["heat"], fan=aux.FAN_LOW, vane_v=6, vane_h=0,
                       turbo=0, mute=1, sleep=1, health=1, clean=0, display=1, mildew=1)
    assert aux.decode_state(reply_for(raw)) == raw


def test_set_frame_layout():
    framed = aux.encode_set_state(aux.AuxState(power=1, temp=24, mode=1, fan=aux.FAN_AUTO))
    assert len(framed) == 32
    assert framed[0] == 25 and framed[2:12] == bytes.fromhex("bb00068000000f000101")
    assert int.from_bytes(framed[25:27], "big") == aux.internet_checksum(framed[2:25])


def test_mapping_preserves_unrelated_settings():
    base = aux.AuxState(power=0, temp=26, mode=1, fan=aux.FAN_AUTO, health=1, display=0, mildew=1)
    target = apply_patch(to_state(base, None), {"isOn": True, "fanSpeed": "quiet"})
    wanted = to_raw(base, target, {"isOn": True, "fanSpeed": "quiet"})
    assert wanted.power == 1 and wanted.mute == 1 and wanted.fan == aux.FAN_LOW
    assert (wanted.health, wanted.display, wanted.mildew, wanted.temp) == (1, 0, 1, 26)


def test_state_mapping():
    state = to_state(aux.AuxState(power=1, temp=22, mode=6, fan=aux.FAN_HIGH, vane_v=3, vane_h=0), 31.5)
    assert state == AcState(True, "fan", 22, 31.5, None, "high", Airflow(Axis("fixed", 3), Axis("swing")))


def test_ambient_above_31_degrees():
    plain = bytearray(40)
    plain[17] = 32 + 36
    plain[33] = 5
    assert aux.decode_ambient(bytes(plain)) == 36.5
