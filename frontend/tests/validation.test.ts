import { describe, expect, it } from "vitest";
import { sampleInputs } from "./fixtures";
import { validateInputs } from "../src/lib/validation";

describe("validateInputs", () => {
  it("accepts the PRD sample and reports invalid decimal, recipe, and order bounds", () => {
    expect(validateInputs(sampleInputs())).toEqual({});

    const inputs = sampleInputs();
    inputs.available_ingredient_litres.orange = "1e2";
    inputs.blends[0].recipe_percent.orange = "59.99";
    inputs.blends[0].min_litres = "61";

    const errors = validateInputs(inputs);
    expect(errors["available_ingredient_litres.orange"]).toMatch(/decimal|number/i);
    expect(errors["blends.orange_apple.recipe_percent"]).toMatch(/100|100%/i);
    expect(errors["blends.orange_apple.min_litres"]).toBeDefined();
  });

  it("rejects excluded ingredients and excess precision without changing sample values", () => {
    const inputs = sampleInputs();
    inputs.blends[0].recipe_percent.pineapple = "0.01";
    inputs.blends[0].recipe_percent.orange = "59.99";
    inputs.blends[0].profit_aud_per_litre = "2.001";

    const errors = validateInputs(inputs);
    expect(errors["blends.orange_apple.recipe_percent.pineapple"]).toBeDefined();
    expect(errors["blends.orange_apple.profit_aud_per_litre"]).toBeDefined();
    expect(sampleInputs().available_ingredient_litres.orange).toBe("40");
  });
});
