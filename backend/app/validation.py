"""Exact input checks for the fixed three-blend demonstration model."""

from decimal import Decimal, InvalidOperation
import re

BLEND_IDS = ("orange_apple", "apple_pineapple", "tropical")
INGREDIENTS = ("orange", "apple", "pineapple")
DECIMAL_TEXT = re.compile(r"^[+-]?[0-9]+(?:\.[0-9]+)?$")


class InputError(Exception):
    def __init__(self, fields: list[dict[str, str]]):
        self.fields = fields


def parse_decimal(value: object, path: str, minimum: str, maximum: str, places: int,
                  errors: list[dict[str, str]]) -> Decimal | None:
    if not isinstance(value, str) or not DECIMAL_TEXT.fullmatch(value):
        errors.append({"path": path, "message": "Enter a plain decimal string."})
        return None
    try:
        parsed = Decimal(value)
    except InvalidOperation:
        errors.append({"path": path, "message": "Enter a valid decimal."})
        return None
    if not parsed.is_finite() or len(value.partition(".")[2]) > places:
        errors.append({"path": path, "message": f"Use no more than {places} decimal places."})
        return None
    if not Decimal(minimum) <= parsed <= Decimal(maximum):
        errors.append({"path": path, "message": f"Enter a value from {minimum} to {maximum}."})
        return None
    return Decimal(0) if parsed.is_zero() else parsed


def exact_keys(value: object, expected: set[str], path: str,
               errors: list[dict[str, str]], optional: set[str] | None = None) -> dict | None:
    if not isinstance(value, dict):
        errors.append({"path": path, "message": "Enter the required object."})
        return None
    optional = optional or set()
    for key in sorted((expected - optional) - value.keys()):
        errors.append({"path": f"{path}.{key}", "message": "This field is required."})
    for key in sorted(value.keys() - expected):
        errors.append({"path": f"{path}.{key}", "message": "This field is not supported."})
    return value


def validate_inputs(data: object) -> dict:
    errors: list[dict[str, str]] = []
    root = exact_keys(data, {"api_version", "model_version", "blends",
                             "available_ingredient_litres", "processing_capacity_hours"},
                      "request", errors)
    if root is None:
        raise InputError(errors)
    if type(root.get("api_version")) is not int or root.get("api_version") != 1:
        errors.append({"path": "api_version", "message": "API version 1 is required."})
    if root.get("model_version") != "juice-day-v1":
        errors.append({"path": "model_version", "message": "Model version juice-day-v1 is required."})
    raw_blends = root.get("blends")
    if not isinstance(raw_blends, list) or len(raw_blends) != 3:
        errors.append({"path": "blends", "message": "Exactly three blends are required."})
        raw_blends = []
    parsed_blends = {}
    for index, raw in enumerate(raw_blends):
        path = f"blends[{index}]"
        blend = exact_keys(raw, {"id", "recipe_percent", "profit_aud_per_litre",
                                 "processing_minutes_per_litre", "min_litres", "max_litres"},
                           path, errors, optional={"min_litres"})
        if blend is None:
            continue
        blend_id = blend.get("id")
        supported_id = isinstance(blend_id, str) and blend_id in BLEND_IDS
        duplicate_id = supported_id and blend_id in parsed_blends
        if not supported_id or duplicate_id:
            errors.append({"path": f"{path}.id", "message": "Use each supported blend ID once."})
        recipe = exact_keys(blend.get("recipe_percent"), set(INGREDIENTS),
                            f"{path}.recipe_percent", errors)
        recipe_basis_points = {}
        if recipe is not None:
            for ingredient in INGREDIENTS:
                share = parse_decimal(recipe.get(ingredient),
                    f"{path}.recipe_percent.{ingredient}", "0", "100", 2, errors)
                recipe_basis_points[ingredient] = (
                    int(share * 100) if share is not None else None
                )
            if all(value is not None for value in recipe_basis_points.values()):
                if sum(recipe_basis_points.values()) != 10000:
                    errors.append({"path": f"{path}.recipe_percent",
                                   "message": "Recipe shares must total exactly 100%."})
                excluded = ({"orange_apple": "pineapple", "apple_pineapple": "orange"}.get(blend_id)
                            if supported_id else None)
                if excluded and recipe_basis_points[excluded] != 0:
                    errors.append({"path": f"{path}.recipe_percent.{excluded}",
                                   "message": "This ingredient is excluded from the blend."})
        profit = parse_decimal(blend.get("profit_aud_per_litre"),
            f"{path}.profit_aud_per_litre", "-1000", "1000", 2, errors)
        minutes = parse_decimal(blend.get("processing_minutes_per_litre"),
            f"{path}.processing_minutes_per_litre", "0", "60", 3, errors)
        minimum = parse_decimal(blend.get("min_litres", "0"),
            f"{path}.min_litres", "0", "10000", 3, errors)
        maximum = parse_decimal(blend.get("max_litres"),
            f"{path}.max_litres", "0", "10000", 3, errors)
        if minimum is not None and maximum is not None and minimum > maximum:
            errors.append({"path": f"{path}.min_litres",
                           "message": "Minimum cannot exceed maximum demand."})
        if supported_id and not duplicate_id:
            parsed_blends[blend_id] = {"recipe_basis_points": recipe_basis_points,
                                       "profit": profit,
                                       "minutes": minutes, "minimum": minimum, "maximum": maximum}
    if set(parsed_blends) != set(BLEND_IDS):
        errors.append({"path": "blends", "message": "All three distinct blends are required."})
    raw_available = exact_keys(root.get("available_ingredient_litres"),
                               set(INGREDIENTS), "available_ingredient_litres", errors)
    available = {}
    if raw_available is not None:
        for ingredient in INGREDIENTS:
            available[ingredient] = parse_decimal(raw_available.get(ingredient),
                f"available_ingredient_litres.{ingredient}", "0", "10000", 3, errors)
    hours = parse_decimal(root.get("processing_capacity_hours"),
                          "processing_capacity_hours", "0", "24", 3, errors)
    if errors:
        raise InputError(errors)
    return {"blends": parsed_blends, "available": available, "minutes": hours * 60}
