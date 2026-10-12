import {
  BLEND_IDS,
  BLEND_RECIPE_RULES,
  INGREDIENT_IDS,
  type BlendInput,
  type IngredientId,
  type PlanningInputs,
} from "./planner";

export type FieldErrors = Record<string, string>;

const DECIMAL = /^[+-]?[0-9]+(?:\.[0-9]+)?$/;

function scaledDecimal(value: string, places: number): number | null {
  const trimmed = value.trim();
  if (!DECIMAL.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.replace(/^[+-]/, "").split(".");
  if (fraction.length > places) return null;
  const scale = 10 ** places;
  const magnitude = Number(whole) * scale + Number(fraction.padEnd(places, "0") || "0");
  return trimmed.startsWith("-") ? -magnitude : magnitude;
}

function validateNumber(
  errors: FieldErrors,
  path: string,
  value: string,
  places: number,
  minimum: number,
  maximum: number,
): number | null {
  const scaled = scaledDecimal(value, places);
  if (scaled === null) {
    errors[path] = `Enter a plain decimal with no more than ${places} decimal places.`;
    return null;
  }
  const scale = 10 ** places;
  if (scaled < minimum * scale || scaled > maximum * scale) {
    errors[path] = `Enter a value from ${minimum} to ${maximum}.`;
    return null;
  }
  return scaled;
}

export function validateInputs(inputs: PlanningInputs): FieldErrors {
  const errors: FieldErrors = {};
  for (const blendId of BLEND_IDS) {
    const blend = inputs.blends.find((item) => item.id === blendId);
    if (!blend) continue;
    validateBlend(errors, blend);
  }
  for (const ingredient of INGREDIENT_IDS) {
    validateNumber(errors, `available_ingredient_litres.${ingredient}`,
      inputs.available_ingredient_litres[ingredient], 3, 0, 10000);
  }
  validateNumber(errors, "processing_capacity_hours", inputs.processing_capacity_hours, 3, 0, 24);
  return errors;
}

function validateBlend(errors: FieldErrors, blend: BlendInput) {
  const recipeValues: Partial<Record<IngredientId, number>> = {};
  for (const ingredient of INGREDIENT_IDS) {
    const path = `blends.${blend.id}.recipe_percent.${ingredient}`;
    recipeValues[ingredient] = validateNumber(errors, path, blend.recipe_percent[ingredient], 2, 0, 100) ?? undefined;
  }
  if (INGREDIENT_IDS.every((ingredient) => recipeValues[ingredient] !== undefined)) {
    const total = INGREDIENT_IDS.reduce((sum, ingredient) => sum + recipeValues[ingredient]!, 0);
    if (total !== 10000) {
      errors[`blends.${blend.id}.recipe_percent`] = "Recipe shares must total exactly 100.00%.";
    }
  }
  const excludedIngredient = BLEND_RECIPE_RULES[blend.id];
  if (excludedIngredient && recipeValues[excludedIngredient] !== 0) {
    errors[`blends.${blend.id}.recipe_percent.${excludedIngredient}`] =
      `This blend does not use ${excludedIngredient}.`;
  }

  validateNumber(errors, `blends.${blend.id}.profit_aud_per_litre`, blend.profit_aud_per_litre, 2, -1000, 1000);
  validateNumber(errors, `blends.${blend.id}.processing_minutes_per_litre`, blend.processing_minutes_per_litre, 3, 0, 60);
  const minimum = validateNumber(errors, `blends.${blend.id}.min_litres`, blend.min_litres, 3, 0, 10000);
  const maximum = validateNumber(errors, `blends.${blend.id}.max_litres`, blend.max_litres, 3, 0, 10000);
  if (minimum !== null && maximum !== null && minimum > maximum) {
    errors[`blends.${blend.id}.min_litres`] = "Minimum quantity cannot exceed maximum demand.";
  }
}

