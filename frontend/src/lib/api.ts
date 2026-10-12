import {
  BLEND_IDS,
  INGREDIENT_IDS,
  type BlendId,
  type IngredientId,
  type PlanningInputs,
} from "./planner";
import { validateInputs } from "./validation";

export const API_VERSION = 1;
export const MODEL_VERSION = "juice-day-v1";
export const CALCULATION_DEADLINE_MS = 10_000;

type ResourceId = IngredientId | "processing";
type Resource = {
  id: ResourceId;
  unit: "litres" | "minutes";
  available: number;
  used: number;
  remaining: number;
  utilization_percent: number | null;
  is_fully_used: boolean;
};
type Shortage = {
  resource_id: ResourceId;
  unit: "litres" | "minutes";
  required: number;
  available: number;
  shortfall: number;
};
type NumericalResidual = { constraint: string; residual: number; unit: "litres" | "minutes" };
type OptimalResult = {
  status: "optimal";
  api_version: number;
  model_version: string;
  request_id: string;
  duration_ms: number;
  production_litres: Record<BlendId, number>;
  profit_contribution_aud: number;
  resources: Resource[];
  reached_demand_caps: BlendId[];
  numerical_residuals: NumericalResidual[];
  solver: { method: "highs"; status: 0; duration_ms: number };
};
type InfeasibleResult = {
  status: "infeasible";
  api_version: number;
  model_version: string;
  request_id: string;
  duration_ms: number;
  shortages: Shortage[];
};
export type CalculationResult = OptimalResult | InfeasibleResult;

export class ApiRequestError extends Error {
  constructor(message: string, readonly code: string, readonly requestId?: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function canonicalizeDecimal(value: string): string {
  const trimmed = value.trim();
  if (!/^[+-]?[0-9]+(?:\.[0-9]+)?$/.test(trimmed)) {
    throw new Error("A value must be a plain decimal before it can be submitted.");
  }
  const negative = trimmed.startsWith("-");
  const unsigned = trimmed.replace(/^[+-]/, "");
  const [whole, fraction = ""] = unsigned.split(".");
  const canonicalWhole = whole.replace(/^0+(?=\d)/, "");
  const canonicalFraction = fraction.replace(/0+$/, "");
  const isZero = /^0+$/.test(canonicalWhole) && canonicalFraction.length === 0;
  return `${negative && !isZero ? "-" : ""}${canonicalWhole}${canonicalFraction ? `.${canonicalFraction}` : ""}`;
}

export function buildOptimizeRequest(inputs: PlanningInputs) {
  if (Object.keys(validateInputs(inputs)).length > 0) {
    throw new Error("Correct invalid inputs before building a calculation request.");
  }
  return {
    api_version: API_VERSION,
    model_version: MODEL_VERSION,
    blends: inputs.blends.map((blend) => ({
      ...blend,
      recipe_percent: Object.fromEntries(INGREDIENT_IDS.map((ingredient) =>
        [ingredient, canonicalizeDecimal(blend.recipe_percent[ingredient])])) as Record<IngredientId, string>,
      profit_aud_per_litre: canonicalizeDecimal(blend.profit_aud_per_litre),
      processing_minutes_per_litre: canonicalizeDecimal(blend.processing_minutes_per_litre),
      min_litres: canonicalizeDecimal(blend.min_litres),
      max_litres: canonicalizeDecimal(blend.max_litres),
    })),
    available_ingredient_litres: Object.fromEntries(INGREDIENT_IDS.map((ingredient) =>
      [ingredient, canonicalizeDecimal(inputs.available_ingredient_litres[ingredient])])) as Record<IngredientId, string>,
    processing_capacity_hours: canonicalizeDecimal(inputs.processing_capacity_hours),
  };
}

export async function calculate(inputs: PlanningInputs, signal: AbortSignal): Promise<CalculationResult> {
  const configuredBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const base = configuredBase.replace(/\/+$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}/api/v1/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildOptimizeRequest(inputs)),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiRequestError("Could not reach the calculation service. Check your connection and retry.", "NETWORK_ERROR");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiRequestError("The calculation service returned an unreadable response. Retry manually.", "INVALID_RESPONSE");
  }
  if (!response.ok) throw parseApiError(payload, response.status);
  const result = parseCalculationResult(payload);
  if (!result) {
    throw new ApiRequestError("The calculation service returned an incompatible result. Retry manually.", "INVALID_RESPONSE");
  }
  return result;
}

function parseApiError(payload: unknown, status: number): ApiRequestError {
  if (!isRecord(payload) || !isRecord(payload.error) ||
      typeof payload.error.code !== "string" || typeof payload.error.message !== "string" ||
      typeof payload.request_id !== "string" || !UUID.test(payload.request_id)) {
    return new ApiRequestError(`The calculation service returned an error (${status}). Retry manually.`, "INVALID_RESPONSE");
  }
  return new ApiRequestError(payload.error.message, payload.error.code, payload.request_id);
}

export function parseCalculationResult(payload: unknown): CalculationResult | null {
  if (!isRecord(payload) || payload.api_version !== API_VERSION || payload.model_version !== MODEL_VERSION ||
      typeof payload.request_id !== "string" || !UUID.test(payload.request_id) ||
      !isFiniteNumber(payload.duration_ms) || payload.duration_ms < 0) return null;

  if (payload.status === "optimal") {
    if (!isRecord(payload.production_litres)) return null;
    const quantities = payload.production_litres;
    if (!BLEND_IDS.every((id) => isFiniteNumber(quantities[id])) ||
        Object.keys(quantities).length !== BLEND_IDS.length ||
        !isFiniteNumber(payload.profit_contribution_aud) ||
        !Array.isArray(payload.resources) || payload.resources.length !== 4 ||
        !payload.resources.every(isResource) || new Set(payload.resources.map((item) => isRecord(item) ? item.id : null)).size !== 4 ||
        !Array.isArray(payload.reached_demand_caps) ||
        !payload.reached_demand_caps.every(isBlendId) || new Set(payload.reached_demand_caps).size !== payload.reached_demand_caps.length ||
        !Array.isArray(payload.numerical_residuals) || !payload.numerical_residuals.every(isResidual) ||
        !isSolver(payload.solver)) return null;
    return payload as unknown as OptimalResult;
  }

  if (payload.status === "infeasible") {
    if (!Array.isArray(payload.shortages) || payload.shortages.length === 0 || payload.shortages.length > 4 ||
        !payload.shortages.every(isShortage) || new Set(payload.shortages.map((item) => isRecord(item) ? item.resource_id : null)).size !== payload.shortages.length || "production_litres" in payload ||
        "profit_contribution_aud" in payload) return null;
    return payload as unknown as InfeasibleResult;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBlendId(value: unknown): value is BlendId {
  return typeof value === "string" && BLEND_IDS.includes(value as BlendId);
}

function isResourceId(value: unknown): value is ResourceId {
  return value === "processing" || (typeof value === "string" && INGREDIENT_IDS.includes(value as IngredientId));
}

function isResource(value: unknown): value is Resource {
  if (!isRecord(value) || !isResourceId(value.id) ||
      (value.unit !== "litres" && value.unit !== "minutes") ||
      !isFiniteNumber(value.available) || !isFiniteNumber(value.used) ||
      !isFiniteNumber(value.remaining) ||
      !(value.utilization_percent === null || isFiniteNumber(value.utilization_percent)) ||
      typeof value.is_fully_used !== "boolean" || value.available < 0 || value.used < 0 ||
      value.remaining < -0.000001 || Math.abs(value.remaining - (value.available - value.used)) > 0.000001) return false;
  if (value.available === 0 && value.utilization_percent !== null) return false;
  if (value.available > 0 && !isFiniteNumber(value.utilization_percent)) return false;
  return (value.id === "processing") === (value.unit === "minutes");
}

function isShortage(value: unknown): value is Shortage {
  return isRecord(value) && isResourceId(value.resource_id) &&
    (value.unit === "litres" || value.unit === "minutes") &&
    isFiniteNumber(value.required) && value.required >= 0 && isFiniteNumber(value.available) && value.available >= 0 &&
    isFiniteNumber(value.shortfall) && value.shortfall > 0 &&
    value.required > value.available &&
    ((value.resource_id === "processing") === (value.unit === "minutes"));
}

function isResidual(value: unknown): value is NumericalResidual {
  return isRecord(value) && typeof value.constraint === "string" &&
    isFiniteNumber(value.residual) && value.residual > 0 &&
    (value.unit === "litres" || value.unit === "minutes");
}

function isSolver(value: unknown): value is OptimalResult["solver"] {
  return isRecord(value) && value.method === "highs" && value.status === 0 &&
    isFiniteNumber(value.duration_ms) && value.duration_ms >= 0;
}
