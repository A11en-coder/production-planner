import copy
import json
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest

from app import main as main_module
from app import optimizer as optimizer_module
from app.main import app
from app.optimizer import CalculationTimeout, optimize
from app.validation import InputError, validate_inputs


SAMPLE = json.loads((Path(__file__).resolve().parents[2] / "contracts" / "sample-request.json").read_text())
client = TestClient(app)


def test_known_sample_and_changed_orange():
    baseline = optimize(validate_inputs(SAMPLE))
    assert baseline["status"] == "optimal"
    assert abs(baseline["profit_contribution_aud"] - 658 / 3) < 0.000001
    assert abs(baseline["production_litres"]["orange_apple"] - 50) < 0.000001
    assert abs(baseline["production_litres"]["apple_pineapple"] - 20) < 0.000001
    assert abs(baseline["production_litres"]["tropical"] - 100 / 3) < 0.000001
    changed = copy.deepcopy(SAMPLE)
    changed["available_ingredient_litres"]["orange"] = "30"
    reduced = optimize(validate_inputs(changed))
    assert abs(reduced["profit_contribution_aud"] - 211) < 0.000001
    assert abs(reduced["production_litres"]["orange_apple"] - 25) < 0.000001
    assert abs(reduced["production_litres"]["tropical"] - 50) < 0.000001


def test_every_shortage_is_returned_without_plan():
    request = copy.deepcopy(SAMPLE)
    for blend in request["blends"]:
        blend["min_litres"] = "10"
        blend["max_litres"] = "10"
    request["available_ingredient_litres"] = {name: "1" for name in ("orange", "apple", "pineapple")}
    request["processing_capacity_hours"] = "0"
    response = client.post("/api/v1/optimize", json=request)
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "infeasible"
    assert "production_litres" not in result
    assert "profit_contribution_aud" not in result
    assert {row["resource_id"]: row["required"] for row in result["shortages"]} == {
        "orange": 9, "apple": 12, "pineapple": 9, "processing": 70}


def test_invalid_fields_are_rejected():
    request = copy.deepcopy(SAMPLE)
    request["blends"][0]["recipe_percent"]["orange"] = "60.000"
    request["blends"][1]["max_litres"] = "-1"
    response = client.post("/api/v1/optimize", json=request)
    assert response.status_code == 422
    paths = {field["path"] for field in response.json()["error"]["fields"]}
    assert "blends[0].recipe_percent.orange" in paths
    assert "blends[1].max_litres" in paths


def test_body_and_media_limits():
    assert client.post("/api/v1/optimize", content=b"not-json",
                       headers={"Content-Type": "application/json"}).status_code == 400
    assert client.post("/api/v1/optimize", content=b"x" * 16385,
                       headers={"Content-Type": "application/json"}).status_code == 413
    assert client.post("/api/v1/optimize", content=b"{}", headers={
        "Content-Type": "application/json", "Content-Length": "16385"}).status_code == 413
    assert client.post("/api/v1/optimize", content=b"{}",
                       headers={"Content-Type": "text/plain"}).status_code == 415


def test_version_and_cors():
    request = copy.deepcopy(SAMPLE)
    request["model_version"] = "old"
    assert client.post("/api/v1/optimize", json=request).status_code == 409
    preflight = client.options("/api/v1/optimize", headers={
        "Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"})
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://localhost:3000"
    other_origin = client.options("/api/v1/optimize", headers={
        "Origin": "https://unpaired.example", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"})
    assert other_origin.status_code == 400
    assert "access-control-allow-origin" not in other_origin.headers


def test_malformed_identifiers_and_missing_version_are_field_errors():
    request = copy.deepcopy(SAMPLE)
    request["blends"][0]["id"] = []
    request.pop("model_version")
    response = client.post("/api/v1/optimize", json=request)
    assert response.status_code == 422
    paths = {field["path"] for field in response.json()["error"]["fields"]}
    assert "blends[0].id" in paths
    assert "request.model_version" in paths


def test_plain_signed_decimal_is_accepted():
    request = copy.deepcopy(SAMPLE)
    request["available_ingredient_litres"]["orange"] = "+40"
    response = client.post("/api/v1/optimize", json=request)
    assert response.status_code == 200
    assert response.json()["duration_ms"] >= 0


def test_solver_timeout_has_safe_service_response(monkeypatch):
    def timed_out(_):
        raise CalculationTimeout("internal solver detail")

    monkeypatch.setattr(main_module, "optimize", timed_out)
    response = client.post("/api/v1/optimize", json=SAMPLE)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "CALCULATION_TIMEOUT"
    assert "internal solver detail" not in response.text


def test_time_limit_solver_status_is_not_accepted_as_optimal(monkeypatch):
    monkeypatch.setattr(optimizer_module, "linprog", lambda **_: SimpleNamespace(
        status=1, message="Time limit reached", success=False, x=None))
    with pytest.raises(CalculationTimeout):
        optimize(validate_inputs(SAMPLE))
