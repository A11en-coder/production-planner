"""Focused tests for the public input contract and exact decimal rules."""

import asyncio
import copy
import json
from decimal import Decimal
from pathlib import Path

import pytest
from starlette.requests import Request

from app.main import MAX_REQUEST_BYTES, calculate
from app.validation import BLEND_IDS, InputError, validate_inputs


SAMPLE = json.loads(
    (Path(__file__).resolve().parents[2] / "contracts" / "sample-request.json").read_text()
)


def set_path(value: dict, path: str, replacement: object) -> None:
    target = value
    parts = path.split(".")
    for part in parts[:-1]:
        target = target[int(part)] if part.isdigit() else target[part]
    target[parts[-1]] = replacement


@pytest.mark.parametrize(
    ("value", "expected_message"),
    [
        ("", "Enter a plain decimal string."),
        ("NaN", "Enter a plain decimal string."),
        ("Infinity", "Enter a plain decimal string."),
        ("1e2", "Enter a plain decimal string."),
        ("1,000", "Enter a plain decimal string."),
        ("١٢", "Enter a plain decimal string."),
        (True, "Enter a plain decimal string."),
        (40, "Enter a plain decimal string."),
        ("-0.001", "Enter a value from 0 to 10000."),
        ("10000.0001", "Use no more than 3 decimal places."),
        ("40.0000", "Use no more than 3 decimal places."),
    ],
)
def test_decimal_syntax_type_range_and_precision_are_checked(value, expected_message):
    request = copy.deepcopy(SAMPLE)
    request["available_ingredient_litres"]["orange"] = value

    with pytest.raises(InputError) as error:
        validate_inputs(request)

    field = next(item for item in error.value.fields
                 if item["path"] == "available_ingredient_litres.orange")
    assert field["message"] == expected_message


@pytest.mark.parametrize(
    ("path", "value", "expected_message"),
    [
        ("blends.0.recipe_percent.orange", "100.01", "Enter a value from 0 to 100."),
        ("blends.0.profit_aud_per_litre", "1000.01", "Enter a value from -1000 to 1000."),
        ("blends.0.profit_aud_per_litre", "-1000.01", "Enter a value from -1000 to 1000."),
        ("blends.0.processing_minutes_per_litre", "60.001", "Enter a value from 0 to 60."),
        ("blends.0.min_litres", "-0.001", "Enter a value from 0 to 10000."),
        ("blends.0.max_litres", "10000.001", "Enter a value from 0 to 10000."),
        ("available_ingredient_litres.orange", "-0.001", "Enter a value from 0 to 10000."),
        ("processing_capacity_hours", "24.001", "Enter a value from 0 to 24."),
        ("blends.0.recipe_percent.orange", "60.001", "Use no more than 2 decimal places."),
        ("blends.0.profit_aud_per_litre", "2.001", "Use no more than 2 decimal places."),
        ("blends.0.processing_minutes_per_litre", "2.0001", "Use no more than 3 decimal places."),
        ("blends.0.min_litres", "0.0001", "Use no more than 3 decimal places."),
        ("blends.0.max_litres", "60.0001", "Use no more than 3 decimal places."),
        ("available_ingredient_litres.orange", "40.0001", "Use no more than 3 decimal places."),
        ("processing_capacity_hours", "4.0001", "Use no more than 3 decimal places."),
    ],
)
def test_every_numeric_field_enforces_its_range_and_precision(path, value, expected_message):
    request = copy.deepcopy(SAMPLE)
    set_path(request, path, value)

    with pytest.raises(InputError) as error:
        validate_inputs(request)

    expected_path = path.replace(".0.", "[0].")
    field = next(item for item in error.value.fields if item["path"] == expected_path)
    assert field["message"] == expected_message


def test_signed_decimal_is_valid_and_negative_zero_normalizes_to_zero():
    request = copy.deepcopy(SAMPLE)
    request["available_ingredient_litres"]["orange"] = "+40.000"
    request["available_ingredient_litres"]["apple"] = "-0.000"
    request["blends"][0]["profit_aud_per_litre"] = "-1.25"

    model = validate_inputs(request)

    assert model["available"]["orange"] == Decimal("40")
    assert model["available"]["apple"] == Decimal(0)
    assert not model["available"]["apple"].is_signed()
    assert model["blends"]["orange_apple"]["profit"] == Decimal("-1.25")


def test_recipe_percentages_are_exact_integer_basis_points():
    request = copy.deepcopy(SAMPLE)
    request["blends"][0]["recipe_percent"] = {
        "orange": "60.25", "apple": "39.75", "pineapple": "0"
    }

    model = validate_inputs(request)

    assert model["blends"]["orange_apple"]["recipe_basis_points"] == {
        "orange": 6025, "apple": 3975, "pineapple": 0
    }
    assert sum(model["blends"]["orange_apple"]["recipe_basis_points"].values()) == 10000


@pytest.mark.parametrize(
    "recipe",
    [
        {"orange": "60", "apple": "39.99", "pineapple": "0"},
        {"orange": "60.001", "apple": "39.999", "pineapple": "0"},
        {"orange": "100.01", "apple": "-0.01", "pineapple": "0"},
    ],
)
def test_recipe_total_range_and_precision_are_enforced(recipe):
    request = copy.deepcopy(SAMPLE)
    request["blends"][0]["recipe_percent"] = recipe

    with pytest.raises(InputError) as error:
        validate_inputs(request)

    paths = {item["path"] for item in error.value.fields}
    assert any(path.startswith("blends[0].recipe_percent") for path in paths)


def test_excluded_recipe_ingredient_must_be_zero():
    request = copy.deepcopy(SAMPLE)
    request["blends"][0]["recipe_percent"] = {
        "orange": "59", "apple": "40", "pineapple": "1"
    }

    with pytest.raises(InputError) as error:
        validate_inputs(request)

    assert {item["path"] for item in error.value.fields} >= {
        "blends[0].recipe_percent.pineapple"
    }


def test_identifiers_keys_versions_and_minimum_maximum_are_validated():
    cases = []

    duplicate_id = copy.deepcopy(SAMPLE)
    duplicate_id["blends"][1]["id"] = duplicate_id["blends"][0]["id"]
    cases.append((duplicate_id, "blends[1].id"))

    unsupported_id = copy.deepcopy(SAMPLE)
    unsupported_id["blends"][0]["id"] = "mango"
    unsupported_id["blends"][0]["max_litres"] = "-1"
    cases.append((unsupported_id, "blends[0].id"))

    unknown_key = copy.deepcopy(SAMPLE)
    unknown_key["unexpected"] = "do not accept"
    cases.append((unknown_key, "request.unexpected"))

    boolean_version = copy.deepcopy(SAMPLE)
    boolean_version["api_version"] = True
    cases.append((boolean_version, "api_version"))

    backwards_bounds = copy.deepcopy(SAMPLE)
    backwards_bounds["blends"][0]["min_litres"] = "12"
    backwards_bounds["blends"][0]["max_litres"] = "11"
    cases.append((backwards_bounds, "blends[0].min_litres"))

    for request, expected_path in cases:
        with pytest.raises(InputError) as error:
            validate_inputs(request)
        assert expected_path in {item["path"] for item in error.value.fields}

    with pytest.raises(InputError) as error:
        validate_inputs(unsupported_id)
    assert {item["path"] for item in error.value.fields} >= {
        "blends[0].id", "blends[0].max_litres"
    }


def test_missing_minimum_defaults_to_zero_and_all_blends_are_required():
    request = copy.deepcopy(SAMPLE)
    request["blends"][0].pop("min_litres")
    model = validate_inputs(request)
    assert model["blends"]["orange_apple"]["minimum"] == Decimal(0)

    request["blends"].pop()
    with pytest.raises(InputError) as error:
        validate_inputs(request)
    assert "blends" in {item["path"] for item in error.value.fields}


def test_field_errors_aggregate_without_echoing_submitted_values():
    request = copy.deepcopy(SAMPLE)
    request["available_ingredient_litres"]["orange"] = "PRIVATE-VALUE"
    request["blends"][0]["max_litres"] = "-PRIVATE-VALUE"

    with pytest.raises(InputError) as error:
        validate_inputs(request)

    paths = {item["path"] for item in error.value.fields}
    assert "available_ingredient_litres.orange" in paths
    assert "blends[0].max_litres" in paths
    assert "PRIVATE-VALUE" not in repr(error.value.fields)


def test_blend_contract_contains_only_the_three_supported_identifiers():
    assert set(BLEND_IDS) == {"orange_apple", "apple_pineapple", "tropical"}


def test_streamed_request_limit_accepts_exact_boundary_and_rejects_one_byte_over():
    encoded_sample = json.dumps(SAMPLE, separators=(",", ":")).encode("utf-8")
    exact_body = encoded_sample + b" " * (MAX_REQUEST_BYTES - len(encoded_sample))
    assert len(exact_body) == MAX_REQUEST_BYTES

    async def post_without_content_length(body: bytes):
        chunks = [body[:8192], body[8192:]]
        next_chunk = 0

        async def receive():
            nonlocal next_chunk
            chunk = chunks[next_chunk]
            next_chunk += 1
            return {"type": "http.request", "body": chunk,
                    "more_body": next_chunk < len(chunks)}

        scope = {
            "type": "http", "method": "POST", "scheme": "http",
            "path": "/api/v1/optimize", "query_string": b"",
            "headers": [(b"content-type", b"application/json")],
            "server": ("testserver", 80), "client": ("testclient", 1234),
            "http_version": "1.1",
        }
        return await calculate(Request(scope, receive))

    accepted = asyncio.run(post_without_content_length(exact_body))
    rejected = asyncio.run(post_without_content_length(exact_body + b" "))

    assert accepted.status_code == 200
    assert rejected.status_code == 413
