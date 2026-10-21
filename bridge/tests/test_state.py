import pytest

from climateking_bridge.state import AcState, Airflow, Axis, InvalidPatch, apply_patch, patch_matches


def test_apply_patch_uses_app_keys():
    state = apply_patch(AcState(), {"isOn": True, "mode": "heat", "targetTemp": 22.4, "fanSpeed": "turbo"})
    assert state.is_on and state.mode == "heat" and state.fan_speed == "turbo"
    assert state.target_temp == 22.5


def test_apply_patch_clamps_temperature():
    assert apply_patch(AcState(), {"targetTemp": 5}).target_temp == 16
    assert apply_patch(AcState(), {"targetTemp": 99}).target_temp == 30


@pytest.mark.parametrize(
    "patch",
    [{"mode": "turbo"}, {"fanSpeed": "max"}, {"isOn": "yes"}, {"targetTemp": "24"}, {"targetTemp": True}],
)
def test_apply_patch_rejects_unknown_values(patch):
    with pytest.raises(InvalidPatch):
        apply_patch(AcState(), patch)


def test_airflow_patch_keeps_other_axis():
    start = AcState(airflow=Airflow(Axis("fixed", 2), Axis("swing")))
    state = apply_patch(start, {"airflow": {"vertical": {"mode": "swing", "angle": 3}}})
    assert state.airflow.vertical == Axis("swing", 3)
    assert state.airflow.horizontal == Axis("swing")


def test_row_round_trip():
    state = AcState(True, "dry", 23.5, 29.0, None, "medium", Airflow(Axis("swing"), Axis("off")))
    assert AcState.from_row(state.to_row()) == state


def test_patch_matches():
    state = AcState(is_on=True, target_temp=24)
    assert patch_matches(state, {"isOn": True, "targetTemp": 24.5})
    assert not patch_matches(state, {"isOn": False})
    assert not patch_matches(state, {"targetTemp": 26})
