import { MODEL_VERSION, type CalculationResult } from "../src/lib/api";
import { SAMPLE_INPUTS, type PlanningInputs } from "../src/lib/planner";

export function sampleInputs(): PlanningInputs {
  return structuredClone(SAMPLE_INPUTS);
}

export function optimalResult(overrides: Partial<Extract<CalculationResult, { status: "optimal" }>> = {}): CalculationResult {
  return {
    status: "optimal",
    api_version: 1,
    model_version: MODEL_VERSION,
    request_id: "6d8b4960-9d6a-4e4d-94d8-69dc01f0fb8e",
    duration_ms: 2.5,
    production_litres: { orange_apple: 30, apple_pineapple: 20, tropical: 10 },
    profit_contribution_aud: 155,
    resources: [
      { id: "orange", unit: "litres", available: 40, used: 21, remaining: 19, utilization_percent: 52.5, is_fully_used: false },
      { id: "apple", unit: "litres", available: 40, used: 29, remaining: 11, utilization_percent: 72.5, is_fully_used: false },
      { id: "pineapple", unit: "litres", available: 30, used: 14, remaining: 16, utilization_percent: 46.67, is_fully_used: false },
      { id: "processing", unit: "minutes", available: 240, used: 150, remaining: 90, utilization_percent: 62.5, is_fully_used: false },
    ],
    reached_demand_caps: [],
    numerical_residuals: [],
    solver: { method: "highs", status: 0, duration_ms: 0.5 },
    ...overrides,
  };
}
