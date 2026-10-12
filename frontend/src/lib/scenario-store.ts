import { API_VERSION, MODEL_VERSION, parseCalculationResult, type CalculationResult } from "./api";
import { BLEND_IDS, INGREDIENT_IDS, type BlendId, type PlanningInputs } from "./planner";
import { validateInputs } from "./validation";

export const SCENARIO_STORAGE_KEY = "production-planner:scenarios:v1";
export const SCENARIO_SCHEMA_VERSION = 1;
export const MAX_SCENARIOS = 20;

export type SavedScenario = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  inputs: PlanningInputs;
  result: CalculationResult | null;
  result_input_snapshot: PlanningInputs | null;
  result_outdated: boolean;
};

export type ScenarioStoreEnvelope = {
  schema_version: 1;
  revision: number;
  scenarios: unknown[];
};

export type ScenarioStoreState =
  | { kind: "ready"; revision: number; scenarios: SavedScenario[]; unreadableCount: number; rawEnvelope: ScenarioStoreEnvelope | null }
  | { kind: "blocked"; reason: "unreadable" | "unsupported"; message: string; rawText: string }
  | { kind: "unavailable"; message: string };

export class ScenarioStoreError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "ScenarioStoreError";
  }
}

type StoragePort = Pick<Storage, "getItem" | "setItem">;
export type ScenarioLockPort = Pick<LockManager, "request">;
const SCENARIO_LOCK_NAME = "production-planner:scenarios:v1:write";

export function readScenarioStore(storage: StoragePort): ScenarioStoreState {
  let rawText: string | null;
  try {
    rawText = storage.getItem(SCENARIO_STORAGE_KEY);
  } catch {
    return { kind: "unavailable", message: "Browser storage is unavailable. Your current work is still usable in this tab." };
  }
  if (rawText === null) return { kind: "ready", revision: 0, scenarios: [], unreadableCount: 0, rawEnvelope: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { kind: "blocked", reason: "unreadable", rawText, message: "Saved data could not be read. It has been preserved, and saving is blocked to prevent overwriting it." };
  }
  if (!isRecord(parsed)) {
    return { kind: "blocked", reason: "unreadable", rawText, message: "Saved data has an unreadable format. It has been preserved, and saving is blocked." };
  }
  if (parsed.schema_version !== SCENARIO_SCHEMA_VERSION) {
    return { kind: "blocked", reason: "unsupported", rawText, message: "Saved data uses an unsupported format version. It has been preserved, and saving is blocked." };
  }
  if (!hasExactKeys(parsed, ["schema_version", "revision", "scenarios"]) ||
      !Number.isSafeInteger(parsed.revision) || (parsed.revision as number) < 0 ||
      !Array.isArray(parsed.scenarios) || parsed.scenarios.length > MAX_SCENARIOS) {
    return { kind: "blocked", reason: "unreadable", rawText, message: "Saved collection metadata is invalid. It has been preserved, and saving is blocked." };
  }

  const scenarios: SavedScenario[] = [];
  let unreadableCount = 0;
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const value of parsed.scenarios) {
    const scenario = parseSavedScenario(value);
    if (!scenario || ids.has(scenario.id) || names.has(scenario.name.toLowerCase())) {
      unreadableCount += 1;
      continue;
    }
    scenarios.push(scenario);
    ids.add(scenario.id);
    names.add(scenario.name.toLowerCase());
  }
  return {
    kind: "ready",
    revision: parsed.revision as number,
    scenarios,
    unreadableCount,
    rawEnvelope: parsed as unknown as ScenarioStoreEnvelope,
  };
}

export async function saveScenario(
  storage: StoragePort,
  locks: ScenarioLockPort | undefined,
  current: ScenarioStoreState,
  nameValue: string,
  inputs: PlanningInputs,
  result: CalculationResult | null,
  resultInputs: PlanningInputs | null,
  now = new Date(),
  id = globalThis.crypto.randomUUID(),
): Promise<ScenarioStoreState> {
  if (current.kind !== "ready") throw new ScenarioStoreError("Reload the saved collection before saving.", "STORE_BLOCKED");
  if (current.unreadableCount > 0) throw new ScenarioStoreError("The collection contains unreadable records. Reset it with explicit confirmation before saving.", "INVALID_RECORDS");
  const name = nameValue.trim();
  if (name.length < 1 || name.length > 50) throw new ScenarioStoreError("Enter a scenario name from 1 to 50 characters.", "INVALID_NAME");
  if (Object.keys(validateInputs(inputs)).length > 0) throw new ScenarioStoreError("Correct the highlighted inputs before saving.", "INVALID_INPUTS");

  const currentResult = result && resultInputs && samePlanningInputs(inputs, resultInputs) &&
    result.api_version === API_VERSION && result.model_version === MODEL_VERSION;
  const stored: SavedScenario = {
    id,
    name,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    inputs: structuredClone(inputs),
    result: currentResult ? structuredClone(result) : null,
    result_input_snapshot: currentResult ? structuredClone(inputs) : null,
    result_outdated: false,
  };
  return mutateScenarioStore(storage, locks, current, (records) => [...records, stored], "The scenario was not saved.", (latest) => {
    if (latest.scenarios.length >= MAX_SCENARIOS) throw new ScenarioStoreError("The saved collection is full. No scenarios were changed.", "COLLECTION_FULL");
    if (latest.scenarios.some((scenario) => scenario.name.toLowerCase() === name.toLowerCase())) {
      throw new ScenarioStoreError("A scenario with this name already exists. Choose a different name.", "DUPLICATE_NAME");
    }
  });
}

export async function updateScenario(
  storage: StoragePort, locks: ScenarioLockPort | undefined, current: ScenarioStoreState, id: string,
  inputs: PlanningInputs, result: CalculationResult | null, resultInputs: PlanningInputs | null, now = new Date(),
): Promise<ScenarioStoreState> {
  if (Object.keys(validateInputs(inputs)).length > 0) throw new ScenarioStoreError("Correct the highlighted inputs before updating.", "INVALID_INPUTS");
  const existing = requireScenario(current, id);
  const currentResult = result && resultInputs && samePlanningInputs(inputs, resultInputs) &&
    result.api_version === API_VERSION && result.model_version === MODEL_VERSION;
  const updated: SavedScenario = {
    ...existing,
    inputs: structuredClone(inputs),
    result: currentResult ? structuredClone(result) : null,
    result_input_snapshot: currentResult ? structuredClone(inputs) : null,
    result_outdated: false,
    updated_at: now.toISOString(),
  };
  return mutateScenarioStore(storage, locks, current,
    (records) => replaceScenarioRecord(records, id, updated), "The scenario was not updated.");
}

export async function renameScenario(
  storage: StoragePort, locks: ScenarioLockPort | undefined, current: ScenarioStoreState, id: string,
  nameValue: string, now = new Date(),
): Promise<ScenarioStoreState> {
  const name = nameValue.trim();
  if (name.length < 1 || name.length > 50) throw new ScenarioStoreError("Enter a scenario name from 1 to 50 characters.", "INVALID_NAME");
  if (current.kind !== "ready") throw new ScenarioStoreError("Reload the saved collection before changing it.", "STORE_BLOCKED");
  const existing = requireScenario(current, id);
  return mutateScenarioStore(storage, locks, current,
    (records) => replaceScenarioRecord(records, id, { ...existing, name, updated_at: now.toISOString() }),
    "The scenario was not renamed.", (latest) => {
      if (latest.scenarios.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase())) {
        throw new ScenarioStoreError("A scenario with this name already exists. Choose a different name.", "DUPLICATE_NAME");
      }
    });
}

export async function deleteScenario(
  storage: StoragePort, locks: ScenarioLockPort | undefined, current: ScenarioStoreState, id: string,
): Promise<ScenarioStoreState> {
  requireScenario(current, id);
  return mutateScenarioStore(storage, locks, current,
    (records) => records.filter((record) => !isRecord(record) || record.id !== id), "The scenario was not deleted.");
}

export async function resetScenarioStore(storage: StoragePort, locks: ScenarioLockPort | undefined, confirmed: boolean): Promise<ScenarioStoreState> {
  if (!confirmed) throw new ScenarioStoreError("Explicit confirmation is required to reset saved scenarios.", "CONFIRMATION_REQUIRED");
  if (!locks) throw new ScenarioStoreError("This browser cannot safely lock saved scenarios. Collection reset is unavailable here.", "LOCK_UNAVAILABLE");
  try {
    return await locks.request(SCENARIO_LOCK_NAME, { mode: "exclusive" }, async () => {
      const latest = readScenarioStore(storage);
      const revision = latest.kind === "ready" ? latest.revision + 1 : 1;
      storage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify({ schema_version: 1, revision, scenarios: [] }));
      return readScenarioStore(storage);
    });
  } catch (cause) {
    if (cause instanceof ScenarioStoreError) throw cause;
    throw new ScenarioStoreError("The saved collection could not be reset. Its stored data remains unchanged.", "WRITE_FAILED");
  }
}

async function mutateScenarioStore(
  storage: StoragePort, locks: ScenarioLockPort | undefined, expected: ScenarioStoreState,
  transform: (records: unknown[]) => unknown[], actionMessage: string,
  validateLatest: (latest: Extract<ScenarioStoreState, { kind: "ready" }>) => void = () => undefined,
): Promise<ScenarioStoreState> {
  if (!locks) throw new ScenarioStoreError("This browser cannot safely lock saved scenarios. Changes are unavailable here.", "LOCK_UNAVAILABLE");
  if (expected.kind !== "ready") throw new ScenarioStoreError("Reload the saved collection before changing it.", "STORE_BLOCKED");
  if (expected.unreadableCount > 0) throw new ScenarioStoreError("The collection contains unreadable records. Reset it with explicit confirmation before changing it.", "INVALID_RECORDS");
  try {
    return await locks.request(SCENARIO_LOCK_NAME, { mode: "exclusive" }, async () => {
      const latest = readScenarioStore(storage);
      if (latest.kind !== "ready") throw new ScenarioStoreError("Saved storage changed or became unavailable. Reload it before retrying.", "STORE_CHANGED");
      if (latest.revision !== expected.revision) throw new ScenarioStoreError("Another tab changed the saved collection. The latest list has been reloaded; your current inputs are unchanged.", "STALE_REVISION");
      if (latest.unreadableCount > 0) throw new ScenarioStoreError("The collection contains unreadable records. Reset it with explicit confirmation before changing it.", "INVALID_RECORDS");
      validateLatest(latest);
      const previous = latest.rawEnvelope ?? { schema_version: 1 as const, revision: 0, scenarios: [] };
      const next: ScenarioStoreEnvelope = { schema_version: 1, revision: latest.revision + 1, scenarios: transform(previous.scenarios) };
      storage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(next));
      const confirmed = readScenarioStore(storage);
      if (confirmed.kind !== "ready" || confirmed.revision !== next.revision || confirmed.unreadableCount > 0) {
        throw new ScenarioStoreError(`${actionMessage} Browser storage did not confirm the collection update.`, "WRITE_UNCONFIRMED");
      }
      return confirmed;
    });
  } catch (cause) {
    if (cause instanceof ScenarioStoreError) throw cause;
    throw new ScenarioStoreError(`${actionMessage} Browser storage may be unavailable or full; your current work is unchanged.`, "WRITE_FAILED");
  }
}

function requireScenario(current: ScenarioStoreState, id: string): SavedScenario {
  if (current.kind !== "ready") throw new ScenarioStoreError("Reload the saved collection before changing it.", "STORE_BLOCKED");
  if (current.unreadableCount > 0) throw new ScenarioStoreError("The collection contains unreadable records. Reset it with explicit confirmation before changing it.", "INVALID_RECORDS");
  const scenario = current.scenarios.find((item) => item.id === id);
  if (!scenario) throw new ScenarioStoreError("This scenario is no longer in the saved collection. Reload the list and try again.", "SCENARIO_MISSING");
  return scenario;
}

function replaceScenarioRecord(records: unknown[], id: string, replacement: SavedScenario): unknown[] {
  if (!records.some((record) => isRecord(record) && record.id === id)) {
    throw new ScenarioStoreError("This scenario is no longer in the saved collection. Reload the list and try again.", "SCENARIO_MISSING");
  }
  return records.map((record) => isRecord(record) && record.id === id ? replacement : record);
}

export function parsePlanningInputs(value: unknown): PlanningInputs | null {
  if (!isRecord(value) || !hasExactKeys(value, ["blends", "available_ingredient_litres", "processing_capacity_hours"]) ||
      !Array.isArray(value.blends) || value.blends.length !== BLEND_IDS.length ||
      typeof value.processing_capacity_hours !== "string" ||
      !isStringRecordWithKeys(value.available_ingredient_litres, INGREDIENT_IDS)) return null;
  const blends = new Map<BlendId, PlanningInputs["blends"][number]>();
  for (const blend of value.blends) {
    if (!isRecord(blend) || !hasExactKeys(blend, ["id", "recipe_percent", "profit_aud_per_litre", "processing_minutes_per_litre", "min_litres", "max_litres"]) ||
        typeof blend.id !== "string" || !BLEND_IDS.includes(blend.id as BlendId) || blends.has(blend.id as BlendId) ||
        typeof blend.profit_aud_per_litre !== "string" || typeof blend.processing_minutes_per_litre !== "string" ||
        typeof blend.min_litres !== "string" || typeof blend.max_litres !== "string" ||
        !isStringRecordWithKeys(blend.recipe_percent, INGREDIENT_IDS)) return null;
    const id = blend.id as BlendId;
    blends.set(id, {
      id,
      recipe_percent: { orange: blend.recipe_percent.orange as string, apple: blend.recipe_percent.apple as string, pineapple: blend.recipe_percent.pineapple as string },
      profit_aud_per_litre: blend.profit_aud_per_litre,
      processing_minutes_per_litre: blend.processing_minutes_per_litre,
      min_litres: blend.min_litres,
      max_litres: blend.max_litres,
    });
  }
  if (!BLEND_IDS.every((id) => blends.has(id))) return null;
  const inputs: PlanningInputs = {
    blends: BLEND_IDS.map((id) => blends.get(id)!),
    available_ingredient_litres: {
      orange: value.available_ingredient_litres.orange as string,
      apple: value.available_ingredient_litres.apple as string,
      pineapple: value.available_ingredient_litres.pineapple as string,
    },
    processing_capacity_hours: value.processing_capacity_hours,
  };
  return Object.keys(validateInputs(inputs)).length === 0 ? inputs : null;
}

export function samePlanningInputs(left: PlanningInputs, right: PlanningInputs): boolean {
  try {
    return JSON.stringify(canonicalInput(left)) === JSON.stringify(canonicalInput(right));
  } catch {
    return false;
  }
}

function canonicalInput(inputs: PlanningInputs): unknown {
  return {
    blends: BLEND_IDS.map((id) => {
      const blend = inputs.blends.find((item) => item.id === id)!;
      return [id, ...INGREDIENT_IDS.map((ingredient) => normalizeDecimal(blend.recipe_percent[ingredient])),
        normalizeDecimal(blend.profit_aud_per_litre), normalizeDecimal(blend.processing_minutes_per_litre),
        normalizeDecimal(blend.min_litres), normalizeDecimal(blend.max_litres)];
    }),
    available: INGREDIENT_IDS.map((id) => normalizeDecimal(inputs.available_ingredient_litres[id])),
    processing: normalizeDecimal(inputs.processing_capacity_hours),
  };
}

function normalizeDecimal(value: string): string {
  const trimmed = value.trim();
  if (!/^[+-]?[0-9]+(?:\.[0-9]+)?$/.test(trimmed)) throw new Error("Invalid decimal");
  const negative = trimmed.startsWith("-");
  const [whole, fraction = ""] = trimmed.replace(/^[+-]/, "").split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  const normalizedFraction = fraction.replace(/0+$/, "");
  const zero = /^0+$/.test(normalizedWhole) && normalizedFraction.length === 0;
  return `${negative && !zero ? "-" : ""}${normalizedWhole}${normalizedFraction ? `.${normalizedFraction}` : ""}`;
}

function parseSavedScenario(value: unknown): SavedScenario | null {
  if (!isRecord(value) || !hasExactKeys(value, ["id", "name", "created_at", "updated_at", "inputs", "result", "result_input_snapshot", "result_outdated"]) ||
      typeof value.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id) ||
      typeof value.name !== "string" || value.name !== value.name.trim() || value.name.length < 1 || value.name.length > 50 ||
      !isIsoTimestamp(value.created_at) || !isIsoTimestamp(value.updated_at) || typeof value.result_outdated !== "boolean") return null;
  const inputs = parsePlanningInputs(value.inputs);
  if (!inputs) return null;
  const snapshot = value.result_input_snapshot === null ? null : parsePlanningInputs(value.result_input_snapshot);
  if (value.result_input_snapshot !== null && !snapshot) return null;
  if ((value.result !== null && snapshot === null) ||
      (value.result === null && snapshot !== null && value.result_outdated !== true)) return null;
  const parsedResult = value.result === null ? null : parseCalculationResult(value.result);
  const resultMatches = parsedResult !== null && snapshot !== null && samePlanningInputs(inputs, snapshot) &&
    parsedResult.api_version === API_VERSION && parsedResult.model_version === MODEL_VERSION && !value.result_outdated;
  return {
    id: value.id,
    name: value.name,
    created_at: value.created_at,
    updated_at: value.updated_at,
    inputs,
    result: resultMatches ? parsedResult : null,
    result_input_snapshot: snapshot,
    result_outdated: value.result_outdated || (value.result !== null && !resultMatches),
  };
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
}

function isStringRecordWithKeys(value: unknown, keys: readonly string[]): value is Record<string, string> {
  return isRecord(value) && hasExactKeys(value, keys) && keys.every((key) => typeof value[key] === "string");
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
