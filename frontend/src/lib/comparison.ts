import { API_VERSION, MODEL_VERSION } from "./api";
import { BLEND_IDS, BLEND_LABELS, INGREDIENT_IDS, INGREDIENT_LABELS, type PlanningInputs } from "./planner";
import { samePlanningInputs, type SavedScenario } from "./scenario-store";

export type ComparisonUnit = "L" | "min" | "hr" | "%" | "AUD/L" | "AUD" | "min/L";
export type ComparisonMetric = {
  key: string;
  label: string;
  unit: ComparisonUnit;
  a: number;
  b: number;
};

export type ComparisonEligibility =
  | { eligible: true }
  | { eligible: false; reason: "Calculate first" | "Recalculate required" | "Optimal result required" | "Current model result required" };

export function getComparisonEligibility(scenario: SavedScenario): ComparisonEligibility {
  if (!scenario.result) {
    return { eligible: false, reason: scenario.result_outdated ? "Recalculate required" : "Calculate first" };
  }
  if (scenario.result.status !== "optimal") return { eligible: false, reason: "Optimal result required" };
  if (scenario.result_outdated || !scenario.result_input_snapshot || !samePlanningInputs(scenario.inputs, scenario.result_input_snapshot)) {
    return { eligible: false, reason: "Recalculate required" };
  }
  if (scenario.result.api_version !== API_VERSION || scenario.result.model_version !== MODEL_VERSION) {
    return { eligible: false, reason: "Current model result required" };
  }
  return { eligible: true };
}

export function buildInputComparison(a: PlanningInputs, b: PlanningInputs): ComparisonMetric[] {
  const rows: ComparisonMetric[] = [];
  for (const ingredient of INGREDIENT_IDS) {
    rows.push(metric(`available-${ingredient}`, `${INGREDIENT_LABELS[ingredient]} available`, "L",
      a.available_ingredient_litres[ingredient], b.available_ingredient_litres[ingredient]));
  }
  rows.push(metric("processing-capacity", "Processing capacity", "hr", a.processing_capacity_hours, b.processing_capacity_hours));
  for (const blendId of BLEND_IDS) {
    const blendA = a.blends.find((blend) => blend.id === blendId)!;
    const blendB = b.blends.find((blend) => blend.id === blendId)!;
    for (const ingredient of INGREDIENT_IDS) {
      rows.push(metric(`${blendId}-recipe-${ingredient}`, `${BLEND_LABELS[blendId]} · ${INGREDIENT_LABELS[ingredient]} recipe`, "%",
        blendA.recipe_percent[ingredient], blendB.recipe_percent[ingredient]));
    }
    rows.push(metric(`${blendId}-profit-rate`, `${BLEND_LABELS[blendId]} · contribution rate`, "AUD/L",
      blendA.profit_aud_per_litre, blendB.profit_aud_per_litre));
    rows.push(metric(`${blendId}-processing-rate`, `${BLEND_LABELS[blendId]} · processing rate`, "min/L",
      blendA.processing_minutes_per_litre, blendB.processing_minutes_per_litre));
    rows.push(metric(`${blendId}-minimum`, `${BLEND_LABELS[blendId]} · minimum order`, "L", blendA.min_litres, blendB.min_litres));
    rows.push(metric(`${blendId}-maximum`, `${BLEND_LABELS[blendId]} · maximum demand`, "L", blendA.max_litres, blendB.max_litres));
  }
  return rows;
}

export function buildResultComparison(a: SavedScenario, b: SavedScenario): ComparisonMetric[] | null {
  if (a.id === b.id || !getComparisonEligibility(a).eligible || !getComparisonEligibility(b).eligible || !a.result || !b.result ||
      a.result.status !== "optimal" || b.result.status !== "optimal") return null;
  const resultA = a.result;
  const resultB = b.result;
  const rows: ComparisonMetric[] = BLEND_IDS.map((id) => metric(`production-${id}`, `${BLEND_LABELS[id]} production`, "L",
    resultA.production_litres[id], resultB.production_litres[id]));
  rows.push(metric("total-contribution", "Total contribution", "AUD", resultA.profit_contribution_aud, resultB.profit_contribution_aud));
  for (const ingredient of INGREDIENT_IDS) {
    const resourceA = resultA.resources.find((resource) => resource.id === ingredient);
    const resourceB = resultB.resources.find((resource) => resource.id === ingredient);
    if (!resourceA || !resourceB) return null;
    rows.push(metric(`used-${ingredient}`, `${INGREDIENT_LABELS[ingredient]} used`, "L", resourceA.used, resourceB.used));
  }
  const processingA = resultA.resources.find((resource) => resource.id === "processing");
  const processingB = resultB.resources.find((resource) => resource.id === "processing");
  if (!processingA || !processingB) return null;
  rows.push(metric("used-processing", "Processing used", "min", processingA.used, processingB.used));
  return rows;
}

function metric(key: string, label: string, unit: ComparisonUnit, a: string | number, b: string | number): ComparisonMetric {
  return { key, label, unit, a: Number(a), b: Number(b) };
}
