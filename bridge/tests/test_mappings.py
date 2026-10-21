"""Value mapping for the brands that cannot be simulated end to end here (TCL, Tuya, Haier)."""

import pytest

from climateking_bridge.drivers import haier, tcl
from climateking_bridge.drivers.tuya import TuyaValues
from climateking_bridge.state import AcState, apply_patch


def test_tcl_state_and_params():
    raw = {"pwr": 1, "temp": 235, "envtemp": 33, "tcl_mode": 3, "tcl_mark": 2, "tcl_vdir": 7, "tcl_hdir": 0,
           "if_function": 1 << 7}
    state = tcl.to_state(raw)
    assert (state.is_on, state.mode, state.target_temp, state.current_temp, state.fan_speed) == (True, "cool", 23.5, 33.0, "medium")
    assert state.airflow.vertical.mode == "swing" and state.airflow.horizontal.mode == "off"
    patch = {"mode": "heat", "targetTemp": 26, "fanSpeed": "turbo", "airflow": {"horizontal": {"mode": "swing", "angle": 3}}}
    params = tcl.to_params(raw, apply_patch(state, patch), patch)
    assert params == {"tcl_mode": 1, "pwr": 1, "temp": 260, "tcl_mark": 3, "pwfmode": 1, "qtmode": 0,
                      "tcl_vdir": 7, "tcl_hdir": 10}


def test_tcl_basic_units_use_code_1_for_swing():
    state = tcl.to_state({"pwr": 0, "tcl_vdir": 1})
    assert state.airflow.vertical.mode == "swing"
    patch = {"airflow": {"vertical": {"mode": "swing", "angle": 3}}}
    assert tcl.to_params({}, apply_patch(state, patch), patch)["tcl_vdir"] == 1


def test_tuya_standard_layout():
    values = TuyaValues()
    state = values.to_state({"1": True, "2": 240, "3": 310, "4": "cold", "5": "middle"}, AcState())
    assert (state.is_on, state.target_temp, state.current_temp, state.mode, state.fan_speed) == (True, 24, 31.0, "cool", "medium")
    patch = {"targetTemp": 22, "mode": "dry", "fanSpeed": "high"}
    assert values.to_dps(apply_patch(state, patch), patch) == {"2": 220, "4": "wet", "5": "high"}


def test_tuya_follows_the_units_own_words_and_custom_dps():
    values = TuyaValues({"mode": 101, "fan": 102})
    values.to_state({"1": False, "2": 25, "101": "cool", "102": "mid"}, AcState())
    patch = {"mode": "fan", "fanSpeed": "medium"}
    assert values.to_dps(apply_patch(AcState(), patch), patch) == {"101": "fan", "102": "mid"}
    assert values.temp_scale == 1


def test_tuya_cloud_commands():
    commands = TuyaValues().to_cloud_commands(apply_patch(AcState(), {"isOn": True, "mode": "cool"}), {"isOn": True, "mode": "cool"})
    assert commands == [{"code": "switch", "value": True}, {"code": "mode", "value": "cold"}]


def test_haier_fields():
    patch = {"isOn": True, "mode": "cool", "targetTemp": 24, "fanSpeed": "auto"}
    assert haier.fields_for(apply_patch(AcState(), patch), patch) == {
        "onOffStatus": 1, "operationMode": 1, "targetTemperature": 8, "windSpeed": 5, "rapidMode": 0, "muteStatus": 0}


def test_haier_never_sends_fan_only_with_auto_fan():
    patch = {"mode": "fan"}
    fields = haier.fields_for(apply_patch(AcState(fan_speed="auto"), patch), patch)
    assert fields["operationMode"] == 6 and fields["windSpeed"] == 3


def test_haier_status_decode():
    state = haier.to_state({"power": True, "target_temperature": 25.0, "operation_mode": "4", "wind_speed": "3",
                            "current_temperature": 29.5, "swing_vertical": True, "strong": False, "quiet": True})
    assert (state.is_on, state.mode, state.target_temp, state.fan_speed, state.current_temp) == (True, "heat", 25, "quiet", 29.5)
    with pytest.raises(Exception):
        haier.to_state({})
