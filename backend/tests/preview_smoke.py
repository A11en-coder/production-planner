"""Run a small, explicit check against a paired public preview.

Usage: python tests/preview_smoke.py API_BASE FRONTEND_ORIGIN
"""

import argparse
import copy
import json
from pathlib import Path
from time import perf_counter

import httpx


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("api_base")
    parser.add_argument("frontend_origin")
    args = parser.parse_args()
    sample = json.loads((Path(__file__).resolve().parents[2] / "contracts" / "sample-request.json").read_text())
    origin = args.frontend_origin.rstrip("/")
    base = args.api_base.rstrip("/")
    with httpx.Client(timeout=15, follow_redirects=False) as client:
        preflight = client.options(f"{base}/api/v1/optimize", headers={
            "Origin": origin, "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"})
        assert preflight.status_code == 200, (preflight.status_code, preflight.text[:200])
        assert preflight.headers.get("access-control-allow-origin") == origin

        def calculate(request: dict) -> tuple[dict, float]:
            started = perf_counter()
            response = client.post(f"{base}/api/v1/optimize", json=request,
                                   headers={"Origin": origin})
            duration = (perf_counter() - started) * 1000
            assert response.status_code == 200, (response.status_code, response.text[:200])
            assert response.headers.get("access-control-allow-origin") == origin
            result = response.json()
            assert result["duration_ms"] >= 0
            return result, duration

        baseline, baseline_ms = calculate(sample)
        assert baseline["status"] == "optimal"
        assert abs(baseline["profit_contribution_aud"] - 658 / 3) < 0.000001
        changed = copy.deepcopy(sample)
        changed["available_ingredient_litres"]["orange"] = "30"
        reduced, reduced_ms = calculate(changed)
        assert abs(reduced["profit_contribution_aud"] - 211) < 0.000001

        impossible = copy.deepcopy(sample)
        for blend in impossible["blends"]:
            blend["min_litres"] = blend["max_litres"] = "10"
        impossible["available_ingredient_litres"] = {name: "1" for name in ("orange", "apple", "pineapple")}
        impossible["processing_capacity_hours"] = "0"
        shortages, shortage_ms = calculate(impossible)
        assert shortages["status"] == "infeasible"
        assert {item["resource_id"]: (item["required"], item["shortfall"])
                for item in shortages["shortages"]} == {
            "orange": (9, 8), "apple": (12, 11),
            "pineapple": (9, 8), "processing": (70, 70)}

        invalid = copy.deepcopy(sample)
        invalid["blends"][0]["recipe_percent"]["orange"] = "60.000"
        bad = client.post(f"{base}/api/v1/optimize", json=invalid,
                          headers={"Origin": origin})
        assert bad.status_code == 422 and bad.json()["error"]["code"] == "VALIDATION_ERROR"
        assert bad.headers.get("access-control-allow-origin") == origin

        print(json.dumps({"preflight": preflight.status_code,
            "baseline": {"request_id": baseline["request_id"], "duration_ms": baseline_ms,
                         "profit": baseline["profit_contribution_aud"]},
            "orange_reduced": {"request_id": reduced["request_id"], "duration_ms": reduced_ms,
                               "profit": reduced["profit_contribution_aud"]},
            "shortages": {"request_id": shortages["request_id"], "duration_ms": shortage_ms,
                          "count": len(shortages["shortages"])},
            "invalid": bad.status_code}, indent=2))


if __name__ == "__main__":
    main()
