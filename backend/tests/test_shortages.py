"""Exact minimum-order feasibility checks, before solver execution."""

import copy
import json
from pathlib import Path

from fastapi.testclient import TestClient

from app import optimizer as optimizer_module
from app.main import app


SAMPLE = json.loads(
    (Path(__file__).resolve().parents[2] / "contracts" / "sample-request.json").read_text()
)
client = TestClient(app)


def test_tiny_positive_shortage_is_reported_and_skips_solver(monkeypatch):
    request = copy.deepcopy(SAMPLE)
    for blend in request["blends"]:
        blend["min_litres"] = "0"
        blend["max_litres"] = "0"
    orange_apple = request["blends"][0]
    orange_apple["recipe_percent"] = {
        "orange": "0.01", "apple": "99.99", "pineapple": "0"
    }
    orange_apple["min_litres"] = "0.001"
    orange_apple["max_litres"] = "0.001"
    request["available_ingredient_litres"] = {
        "orange": "0", "apple": "1", "pineapple": "1"
    }
    request["processing_capacity_hours"] = "1"

    def solver_must_not_run(**_):
        raise AssertionError("The solver must not run when minimum orders are infeasible.")

    monkeypatch.setattr(optimizer_module, "linprog", solver_must_not_run)
    response = client.post("/api/v1/optimize", json=request)

    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "infeasible"
    assert "production_litres" not in result
    assert "profit_contribution_aud" not in result
    assert result["shortages"] == [{
        "resource_id": "orange", "unit": "litres", "required": 1e-7,
        "available": 0, "shortfall": 1e-7,
    }]


def test_minimum_resource_use_equal_to_capacity_is_feasible():
    request = copy.deepcopy(SAMPLE)
    for blend in request["blends"]:
        blend["min_litres"] = "0"
        blend["max_litres"] = "0"
    orange_apple = request["blends"][0]
    orange_apple["recipe_percent"] = {
        "orange": "100", "apple": "0", "pineapple": "0"
    }
    orange_apple["min_litres"] = "0.001"
    orange_apple["max_litres"] = "0.001"
    request["available_ingredient_litres"] = {
        "orange": "0.001", "apple": "0", "pineapple": "0"
    }
    request["processing_capacity_hours"] = "1"

    response = client.post("/api/v1/optimize", json=request)

    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "optimal"
    assert result["production_litres"]["orange_apple"] == 0.001
