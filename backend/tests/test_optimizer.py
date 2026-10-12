"""Solver acceptance and independent plan-certificate checks (TRD T03/T05)."""

import copy
import json
from math import isfinite
from pathlib import Path
from types import SimpleNamespace

import pytest

from app import optimizer as optimizer_module
from app.optimizer import CalculationError, optimize
from app.validation import validate_inputs


SAMPLE = json.loads(
    (Path(__file__).resolve().parents[2] / "contracts" / "sample-request.json").read_text()
)


def test_baseline_plan_has_independent_objective_and_resource_certificate():
    result = optimize(validate_inputs(SAMPLE))

    assert result["status"] == "optimal"
    quantities = result["production_litres"]
    blends = {blend["id"]: blend for blend in SAMPLE["blends"]}
    independently_computed_profit = sum(
        float(blends[blend_id]["profit_aud_per_litre"]) * quantity
        for blend_id, quantity in quantities.items()
    )
    assert abs(result["profit_contribution_aud"] - independently_computed_profit) <= 1e-6
    assert abs(independently_computed_profit - 658 / 3) <= 1e-6

    available = SAMPLE["available_ingredient_litres"]
    for resource in ("orange", "apple", "pineapple"):
        used = sum(
            float(blends[blend_id]["recipe_percent"][resource]) / 100 * quantity
            for blend_id, quantity in quantities.items()
        )
        row = next(item for item in result["resources"] if item["id"] == resource)
        assert abs(row["used"] - used) <= 1e-6
        assert used <= float(available[resource]) + 1e-6

    minutes_used = sum(
        float(blends[blend_id]["processing_minutes_per_litre"]) * quantity
        for blend_id, quantity in quantities.items()
    )
    processing = next(item for item in result["resources"] if item["id"] == "processing")
    assert abs(processing["used"] - minutes_used) <= 1e-6
    assert minutes_used <= 240 + 1e-6
    assert all(isfinite(quantity) for quantity in quantities.values())


def test_zero_demand_returns_zero_plan_and_contribution():
    request = copy.deepcopy(SAMPLE)
    for blend in request["blends"]:
        blend["max_litres"] = "0"

    result = optimize(validate_inputs(request))

    assert result["status"] == "optimal"
    assert set(result["production_litres"].values()) == {0}
    assert result["profit_contribution_aud"] == 0


def test_zero_resource_and_processing_capacity_returns_zero_plan():
    request = copy.deepcopy(SAMPLE)
    request["available_ingredient_litres"] = {
        "orange": "0", "apple": "0", "pineapple": "0",
    }
    request["processing_capacity_hours"] = "0"

    result = optimize(validate_inputs(request))

    assert result["status"] == "optimal"
    assert set(result["production_litres"].values()) == {0}
    assert result["profit_contribution_aud"] == 0


def test_zero_processing_coefficients_are_supported():
    request = copy.deepcopy(SAMPLE)
    for blend in request["blends"]:
        blend["processing_minutes_per_litre"] = "0"

    result = optimize(validate_inputs(request))

    assert result["status"] == "optimal"
    assert all(0 <= quantity <= 60 for quantity in result["production_litres"].values())
    processing = next(item for item in result["resources"] if item["id"] == "processing")
    assert processing["used"] == 0
    assert processing["utilization_percent"] == 0


def test_solver_uses_highs_with_one_second_limit(monkeypatch):
    actual_linprog = optimizer_module.linprog
    captured = {}

    def recording_linprog(**kwargs):
        captured.update(kwargs)
        return actual_linprog(**kwargs)

    monkeypatch.setattr(optimizer_module, "linprog", recording_linprog)
    result = optimize(validate_inputs(SAMPLE))

    assert result["status"] == "optimal"
    assert captured["method"] == "highs"
    assert captured["options"]["time_limit"] == 1.0


def test_negative_contribution_with_zero_minimum_produces_nothing():
    request = copy.deepcopy(SAMPLE)
    request["blends"][0]["profit_aud_per_litre"] = "-1"

    result = optimize(validate_inputs(request))

    assert result["status"] == "optimal"
    assert result["production_litres"]["orange_apple"] == 0


def test_negative_contribution_with_feasible_minimum_is_preserved():
    request = copy.deepcopy(SAMPLE)
    request["blends"][0]["profit_aud_per_litre"] = "-1"
    request["blends"][0]["min_litres"] = "2"
    request["blends"][0]["max_litres"] = "2"
    request["blends"][1]["max_litres"] = "0"
    request["blends"][2]["max_litres"] = "0"

    result = optimize(validate_inputs(request))

    assert result["status"] == "optimal"
    assert result["production_litres"]["orange_apple"] == 2
    assert result["profit_contribution_aud"] < 0


@pytest.mark.parametrize("status", [2, 3, 4])
def test_nonoptimal_solver_statuses_are_rejected(monkeypatch, status):
    monkeypatch.setattr(optimizer_module, "linprog", lambda **_: SimpleNamespace(
        status=status, message="solver stopped", success=False, x=None))

    with pytest.raises(CalculationError, match="did not return an optimal plan"):
        optimize(validate_inputs(SAMPLE))


@pytest.mark.parametrize("quantity", [float("nan"), float("inf"), -float("inf")])
def test_nonfinite_quantities_are_rejected(monkeypatch, quantity):
    monkeypatch.setattr(optimizer_module, "linprog", lambda **_: SimpleNamespace(
        status=0, message="optimal", success=True, x=[quantity, 0, 0]))

    with pytest.raises(CalculationError, match="nonfinite quantity"):
        optimize(validate_inputs(SAMPLE))


@pytest.mark.parametrize("excess", [0.0000005, 0.0000011])
def test_order_bound_residual_uses_trd_tolerance(monkeypatch, excess):
    request = copy.deepcopy(SAMPLE)
    request["blends"][0]["max_litres"] = "1"
    model = validate_inputs(request)
    monkeypatch.setattr(optimizer_module, "linprog", lambda **_: SimpleNamespace(
        status=0, message="optimal", success=True, x=[1 + excess, 0, 0]))

    if excess <= optimizer_module.TOLERANCE:
        result = optimize(model)
        assert result["status"] == "optimal"
        residual = next(row for row in result["numerical_residuals"]
                        if row["constraint"] == "orange_apple.maximum")
        assert 0 < residual["residual"] <= optimizer_module.TOLERANCE
    else:
        with pytest.raises(CalculationError, match="production bound was exceeded"):
            optimize(model)


@pytest.mark.parametrize("excess", [0.0000005, 0.0000011])
def test_resource_residual_uses_trd_tolerance(monkeypatch, excess):
    model = validate_inputs(SAMPLE)
    model["available"]["orange"] = 1
    model["blends"]["orange_apple"]["recipe_basis_points"] = {
        "orange": 10000, "apple": 0, "pineapple": 0,
    }
    monkeypatch.setattr(optimizer_module, "linprog", lambda **_: SimpleNamespace(
        status=0, message="optimal", success=True, x=[1 + excess, 0, 0]))

    if excess <= optimizer_module.TOLERANCE:
        result = optimize(model)
        residual = next(row for row in result["numerical_residuals"]
                        if row["constraint"] == "orange")
        assert 0 < residual["residual"] <= optimizer_module.TOLERANCE
    else:
        with pytest.raises(CalculationError, match="resource limit was exceeded"):
            optimize(model)
