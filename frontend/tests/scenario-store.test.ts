import { describe, expect, it } from "vitest";
import {
  readScenarioStore,
  saveScenario,
  renameScenario,
  updateScenario,
  deleteScenario,
  ScenarioStoreError,
  type ScenarioLockPort,
} from "../src/lib/scenario-store";
import { optimalResult, sampleInputs } from "./fixtures";

class MemoryStorage {
  value: string | null = null;
  failWrites = false;
  getItem() { return this.value; }
  setItem(_key: string, value: string) {
    if (this.failWrites) throw new DOMException("Quota exceeded", "QuotaExceededError");
    this.value = value;
  }
}

const locks = {
  request: async (_name: string, _options: unknown, callback: (lock: unknown) => Promise<unknown>) => callback({}),
} as unknown as ScenarioLockPort;

describe("versioned scenario store", () => {
  it("saves a compatible result snapshot and supports rename, update, and delete", async () => {
    const storage = new MemoryStorage();
    const inputs = sampleInputs();
    const result = optimalResult();
    const saved = await saveScenario(storage, locks, readScenarioStore(storage), " Baseline ", inputs, result, inputs,
      new Date("2026-10-12T00:00:00.000Z"), "6d8b4960-9d6a-4e4d-94d8-69dc01f0fb8e");
    expect(saved).toMatchObject({ kind: "ready", revision: 1 });
    if (saved.kind !== "ready") throw new Error("Expected ready store");
    expect(saved.scenarios[0]).toMatchObject({ name: "Baseline", result, result_input_snapshot: inputs });

    const id = "6d8b4960-9d6a-4e4d-94d8-69dc01f0fb8e";
    const renamed = await renameScenario(storage, locks, saved, id, "October baseline");
    expect(renamed.kind === "ready" && renamed.scenarios[0].name).toBe("October baseline");
    const updated = await updateScenario(storage, locks, renamed, id, inputs, null, null);
    expect(updated.kind === "ready" && updated.scenarios[0].result).toBeNull();
    const deleted = await deleteScenario(storage, locks, updated, id);
    expect(deleted.kind === "ready" && deleted.scenarios).toHaveLength(0);
  });

  it("preserves corrupt storage and rejects writes when cross-tab locks are unavailable", async () => {
    const storage = new MemoryStorage();
    storage.value = "{broken";
    const blocked = readScenarioStore(storage);
    expect(blocked.kind).toBe("blocked");
    await expect(saveScenario(storage, locks, blocked, "Draft", sampleInputs(), null, null)).rejects.toBeInstanceOf(ScenarioStoreError);
    expect(storage.value).toBe("{broken");

    const ready = readScenarioStore(new MemoryStorage());
    await expect(saveScenario(new MemoryStorage(), undefined, ready, "Draft", sampleInputs(), null, null))
      .rejects.toMatchObject({ code: "LOCK_UNAVAILABLE" });
  });

  it("rejects stale revisions instead of overwriting another tab", async () => {
    const storage = new MemoryStorage();
    const initial = readScenarioStore(storage);
    const first = await saveScenario(storage, locks, initial, "First", sampleInputs(), null, null,
      new Date("2026-10-12T00:00:00.000Z"), "6d8b4960-9d6a-4e4d-94d8-69dc01f0fb8e");
    await expect(saveScenario(storage, locks, initial, "Stale", sampleInputs(), null, null))
      .rejects.toMatchObject({ code: "STALE_REVISION" });
    const latest = readScenarioStore(storage);
    expect(latest.kind).toBe("ready");
    if (latest.kind === "ready") expect(latest.scenarios).toHaveLength(1);
    expect(first.kind).toBe("ready");
  });

  it("reports storage quota failure without a save-success state", async () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    await expect(saveScenario(storage, locks, readScenarioStore(storage), "No space", sampleInputs(), null, null))
      .rejects.toMatchObject({ code: "WRITE_FAILED" });
    expect(storage.value).toBeNull();
  });
});
