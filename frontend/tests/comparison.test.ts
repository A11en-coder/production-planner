import { describe, expect, it } from "vitest";
import { buildInputComparison, buildResultComparison, getComparisonEligibility } from "../src/lib/comparison";
import { sampleInputs, optimalResult } from "./fixtures";
import type { SavedScenario } from "../src/lib/scenario-store";
import type { CalculationResult } from "../src/lib/api";

function scenario(id: string, name: string, inputs = sampleInputs()): SavedScenario {
  const result = optimalResult();
  return {
    id, name, created_at: "2026-10-12T00:00:00.000Z", updated_at: "2026-10-12T00:00:00.000Z",
    inputs, result, result_input_snapshot: structuredClone(inputs), result_outdated: false,
  };
}

describe("saved scenario comparison", () => {
  it("exposes input and result metrics as unrounded numbers", () => {
    const a = scenario("a", "A");
    const bInputs = sampleInputs();
    bInputs.available_ingredient_litres.orange = "30";
    const b = scenario("b", "B", bInputs);
    const inputRows = buildInputComparison(a.inputs, b.inputs);
    expect(inputRows).toHaveLength(25);
    expect(inputRows.find((row) => row.key === "available-orange")).toMatchObject({ a: 40, b: 30, unit: "L" });
    expect(buildResultComparison(a, b)).toHaveLength(8);
  });

  it.each([
    ["draft", { result: null }],
    ["infeasible", { result: {
      status: "infeasible", api_version: 1, model_version: "juice-day-v1",
      request_id: "6d8b4960-9d6a-4e4d-94d8-69dc01f0fb8e", duration_ms: 1,
      shortages: [{ resource_id: "orange", unit: "litres", required: 2, available: 1, shortfall: 1 }],
    } satisfies CalculationResult }],
    ["outdated", { result_outdated: true }],
    ["snapshot mismatch", { result_input_snapshot: { ...sampleInputs(), processing_capacity_hours: "5" } }],
    ["old model", { result: { ...optimalResult(), model_version: "old" } }],
  ])("blocks %s from comparison", (_label, overrides) => {
    const eligible = scenario("a", "A");
    const blocked = { ...eligible, ...overrides } as SavedScenario;
    expect(getComparisonEligibility(blocked).eligible).toBe(false);
    expect(buildResultComparison(eligible, blocked)).toBeNull();
  });
});
