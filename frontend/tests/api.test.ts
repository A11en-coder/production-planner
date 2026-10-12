import { afterEach, describe, expect, it, vi } from "vitest";
import { API_VERSION, buildOptimizeRequest, calculate, canonicalizeDecimal, parseCalculationResult } from "../src/lib/api";
import { sampleInputs, optimalResult } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());

describe("calculation API boundary", () => {
  it("canonicalizes accepted decimals without rounding", () => {
    expect(canonicalizeDecimal("  +0002.3400 ")).toBe("2.34");
    expect(canonicalizeDecimal("-000.000")).toBe("0");
    expect(() => canonicalizeDecimal("1e2")).toThrow(/plain decimal/);
  });

  it("builds the versioned request from valid sample input and rejects invalid input", () => {
    const request = buildOptimizeRequest(sampleInputs());
    expect(request.api_version).toBe(API_VERSION);
    expect(request.blends).toHaveLength(3);
    expect(request.blends[0].profit_aud_per_litre).toBe("2");

    const invalid = sampleInputs();
    invalid.processing_capacity_hours = "1e2";
    expect(() => buildOptimizeRequest(invalid)).toThrow(/Correct invalid inputs/);
  });

  it("accepts compatible optimal and infeasible envelopes and rejects malformed data", () => {
    expect(parseCalculationResult(optimalResult())).toMatchObject({ status: "optimal", model_version: "juice-day-v1" });
    const infeasible = {
      ...optimalResult(),
      status: "infeasible",
      shortages: [{ resource_id: "orange", unit: "litres", required: 4, available: 3, shortfall: 1 }],
    };
    delete (infeasible as Record<string, unknown>).production_litres;
    delete (infeasible as Record<string, unknown>).profit_contribution_aud;
    expect(parseCalculationResult(infeasible)).toMatchObject({ status: "infeasible" });
    expect(parseCalculationResult({ ...optimalResult(), model_version: "old" })).toBeNull();
    expect(parseCalculationResult({ ...optimalResult(), profit_contribution_aud: Number.NaN })).toBeNull();
  });

  it("turns HTTP errors into safe request errors and propagates cancellation", async () => {
    const errorResponse = new Response(JSON.stringify({
      request_id: "6d8b4960-9d6a-4e4d-94d8-69dc01f0fb8e",
      error: { code: "CALCULATION_TIMEOUT", message: "Calculation timed out. Please retry." },
    }), { status: 503, headers: { "content-type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse));
    await expect(calculate(sampleInputs(), new AbortController().signal)).rejects.toMatchObject({
      code: "CALCULATION_TIMEOUT",
      requestId: "6d8b4960-9d6a-4e4d-94d8-69dc01f0fb8e",
    });

    const abort = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
    await expect(calculate(sampleInputs(), new AbortController().signal)).rejects.toBe(abort);
  });
});
