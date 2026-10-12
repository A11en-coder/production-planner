"""Shortage check and bounded continuous linear optimization."""

from decimal import Decimal
from math import isfinite
from time import perf_counter

from scipy.optimize import linprog

from .validation import BLEND_IDS, INGREDIENTS

TOLERANCE = 0.000001


class CalculationError(Exception):
    pass


class CalculationTimeout(CalculationError):
    pass


def optimize(model: dict) -> dict:
    blends = [model["blends"][blend_id] for blend_id in BLEND_IDS]
    resources = list(INGREDIENTS) + ["processing"]
    limits = [model["available"][name] for name in INGREDIENTS] + [model["minutes"]]
    coefficients = [[blend["recipe"][name] / Decimal(100) for blend in blends]
                    for name in INGREDIENTS]
    coefficients.append([blend["minutes"] for blend in blends])
    minimum_use = [sum(row[i] * blends[i]["minimum"] for i in range(3))
                   for row in coefficients]
    shortages = []
    for name, required, available in zip(resources, minimum_use, limits):
        if required > available:
            shortages.append({"resource_id": name,
                              "unit": "minutes" if name == "processing" else "litres",
                              "required": float(required), "available": float(available),
                              "shortfall": float(required - available)})
    if shortages:
        return {"status": "infeasible", "shortages": shortages}

    started = perf_counter()
    solution = linprog(
        c=[-float(blend["profit"]) for blend in blends],
        A_ub=[[float(value) for value in row] for row in coefficients],
        b_ub=[float(value) for value in limits],
        bounds=[(float(blend["minimum"]), float(blend["maximum"])) for blend in blends],
        method="highs", options={"time_limit": 1.0},
    )
    duration_ms = (perf_counter() - started) * 1000
    if solution.status == 1 and "time limit" in solution.message.lower():
        raise CalculationTimeout("The solver reached its time limit.")
    if solution.status != 0 or not solution.success or solution.x is None:
        raise CalculationError("The solver did not return an optimal plan.")
    quantities = [float(value) for value in solution.x]
    if not all(isfinite(value) for value in quantities):
        raise CalculationError("The solver returned a nonfinite quantity.")
    residuals = []
    for index, (blend_id, quantity, blend) in enumerate(zip(BLEND_IDS, quantities, blends)):
        lower = float(blend["minimum"]) - quantity
        upper = quantity - float(blend["maximum"])
        if max(lower, upper) > TOLERANCE:
            raise CalculationError("A production bound was exceeded.")
        for label, residual in (("minimum", lower), ("maximum", upper)):
            if residual > 0:
                residuals.append({"constraint": f"{blend_id}.{label}",
                                  "residual": residual, "unit": "litres"})
    resource_results = []
    for name, row, limit in zip(resources, coefficients, limits):
        used = sum(float(row[i]) * quantities[i] for i in range(3))
        available = float(limit)
        excess = used - available
        unit = "minutes" if name == "processing" else "litres"
        if not isfinite(used) or excess > TOLERANCE:
            raise CalculationError("A resource limit was exceeded.")
        if excess > 0:
            residuals.append({"constraint": name, "residual": excess, "unit": unit})
        resource_results.append({"id": name, "unit": unit, "available": available,
            "used": used, "remaining": available - used,
            "utilization_percent": used / available * 100 if available > 0 else None,
            "is_fully_used": abs(available - used) <= TOLERANCE})
    profit = sum(float(blends[i]["profit"]) * quantities[i] for i in range(3))
    if not isfinite(profit):
        raise CalculationError("The contribution was nonfinite.")
    return {"status": "optimal", "production_litres": dict(zip(BLEND_IDS, quantities)),
        "profit_contribution_aud": profit, "resources": resource_results,
        "reached_demand_caps": [BLEND_IDS[i] for i in range(3)
            if abs(quantities[i] - float(blends[i]["maximum"])) <= TOLERANCE],
        "numerical_residuals": residuals,
        "solver": {"method": "highs", "status": 0, "duration_ms": duration_ms}}
