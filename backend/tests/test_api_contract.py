"""API envelope, metadata, and safe-failure contract checks (TRD T04/T13)."""

import copy
import json
from pathlib import Path
from uuid import UUID

from fastapi.testclient import TestClient
import pytest

from app import main as main_module
from app.main import app
from app.optimizer import CalculationError, CalculationTimeout


SAMPLE = json.loads(
    (Path(__file__).resolve().parents[2] / "contracts" / "sample-request.json").read_text()
)
client = TestClient(app)


def test_health_reports_service_and_compatible_versions():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["api_version"] == 1
    assert response.json()["model_version"] == "juice-day-v1"
    assert isinstance(response.json()["build_id"], str)


def test_optimal_envelope_has_versions_request_id_and_no_store():
    response = client.post("/api/v1/optimize", json=SAMPLE)
    result = response.json()

    assert response.status_code == 200
    assert result["status"] == "optimal"
    assert result["api_version"] == 1
    assert result["model_version"] == "juice-day-v1"
    UUID(result["request_id"])
    assert response.headers["cache-control"] == "no-store"
    assert result["duration_ms"] >= 0
    assert {row["id"] for row in result["resources"]} == {
        "orange", "apple", "pineapple", "processing",
    }


def test_infeasible_envelope_has_versions_request_id_and_no_plan():
    request = copy.deepcopy(SAMPLE)
    for blend in request["blends"]:
        blend["min_litres"] = "10"
        blend["max_litres"] = "10"
    request["available_ingredient_litres"] = {
        "orange": "1", "apple": "1", "pineapple": "1",
    }
    request["processing_capacity_hours"] = "0"

    response = client.post("/api/v1/optimize", json=request)
    result = response.json()

    assert response.status_code == 200
    assert result["status"] == "infeasible"
    assert result["api_version"] == 1
    assert result["model_version"] == "juice-day-v1"
    UUID(result["request_id"])
    assert response.headers["cache-control"] == "no-store"
    assert len(result["shortages"]) == 4
    assert "production_litres" not in result
    assert "profit_contribution_aud" not in result


def test_version_failures_are_distinguished_before_solver(monkeypatch):
    def solver_must_not_run(_):
        raise AssertionError("Version-invalid requests must not reach the solver.")

    monkeypatch.setattr(main_module, "optimize", solver_must_not_run)
    old_model = copy.deepcopy(SAMPLE)
    old_model["model_version"] = "older-model"
    model_response = client.post("/api/v1/optimize", json=old_model)
    invalid_api = copy.deepcopy(SAMPLE)
    invalid_api["api_version"] = 2
    api_response = client.post("/api/v1/optimize", json=invalid_api)

    assert model_response.status_code == 409
    assert model_response.json()["error"]["code"] == "MODEL_VERSION_MISMATCH"
    UUID(model_response.json()["request_id"])
    assert api_response.status_code == 422
    assert api_response.json()["error"]["code"] == "VALIDATION_ERROR"
    UUID(api_response.json()["request_id"])


@pytest.mark.parametrize(
    ("exception", "expected_status", "expected_code"),
    [
        (CalculationTimeout("private timeout details"), 503, "CALCULATION_TIMEOUT"),
        (CalculationError("private solver details"), 500, "CALCULATION_ERROR"),
        (RuntimeError("private implementation details"), 500, "INTERNAL_ERROR"),
    ],
)
def test_solver_failures_have_safe_error_envelopes(
    monkeypatch, exception, expected_status, expected_code
):
    def fail(_):
        raise exception

    monkeypatch.setattr(main_module, "optimize", fail)
    response = client.post("/api/v1/optimize", json=SAMPLE)

    assert response.status_code == expected_status
    result = response.json()
    assert result["error"]["code"] == expected_code
    assert result["error"]["message"]
    UUID(result["request_id"])
    assert response.headers["cache-control"] == "no-store"
    assert "private" not in response.text
    assert "Traceback" not in response.text


def test_validation_errors_do_not_echo_input_and_logs_contain_only_metadata(caplog):
    request = copy.deepcopy(SAMPLE)
    private_value = "PRIVATE-CUSTOMER-VALUE-8192"
    request["blends"][0]["profit_aud_per_litre"] = private_value

    with caplog.at_level("INFO", logger="production_planner"):
        response = client.post("/api/v1/optimize", json=request)

    assert response.status_code == 422
    result = response.json()
    assert result["error"]["code"] == "VALIDATION_ERROR"
    assert result["error"]["fields"]
    UUID(result["request_id"])
    assert private_value not in response.text
    assert private_value not in caplog.text
    records = [json.loads(record.message) for record in caplog.records
               if record.name == "production_planner"]
    record = next(item for item in records if item["request_id"] == result["request_id"])
    assert set(record) == {
        "event", "request_id", "outcome", "error_code", "error_class",
        "process_instance_id", "duration_ms",
    }
    assert record["error_code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize(
    ("body", "headers", "status", "code"),
    [
        (b"not-json", {"Content-Type": "application/json"}, 400, "INVALID_JSON"),
        (b"{}", {"Content-Type": "text/plain"}, 415, "UNSUPPORTED_MEDIA_TYPE"),
        (b"{}", {"Content-Type": "application/json", "Content-Encoding": "gzip"},
         415, "UNSUPPORTED_MEDIA_TYPE"),
        (b"x" * 16385, {"Content-Type": "application/json"}, 413, "PAYLOAD_TOO_LARGE"),
    ],
)
def test_transport_failures_have_request_id_and_safe_no_store_envelope(
    body, headers, status, code
):
    response = client.post("/api/v1/optimize", content=body, headers=headers)

    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    UUID(response.json()["request_id"])
    assert response.headers["cache-control"] == "no-store"
