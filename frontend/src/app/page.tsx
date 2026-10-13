"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  BLEND_IDS,
  BLEND_LABELS,
  INGREDIENT_IDS,
  INGREDIENT_LABELS,
  SAMPLE_INPUTS,
  type BlendId,
  type IngredientId,
  type PlanningInputs,
} from "@/lib/planner";
import { validateInputs } from "@/lib/validation";
import { API_VERSION, MODEL_VERSION, ApiRequestError, CALCULATION_DEADLINE_MS, calculate, type CalculationResult } from "@/lib/api";
import { formatContribution, formatDisplayNumber, formatPercent, formatPrecision, formatQuantity } from "@/lib/display";
import { buildInputComparison, buildResultComparison, getComparisonEligibility, type ComparisonMetric, type ComparisonUnit } from "@/lib/comparison";
import {
  readScenarioStore,
  resetScenarioStore,
  ScenarioStoreError,
  samePlanningInputs,
  saveScenario,
  updateScenario,
  renameScenario,
  deleteScenario,
  SCENARIO_STORAGE_KEY,
  type ScenarioStoreState,
  type ScenarioLockPort,
} from "@/lib/scenario-store";

type FieldProps = {
  id: string;
  label: string;
  value: string;
  inputMode?: "decimal" | "text";
  unit?: string;
  hint?: string;
  error?: string;
  onChange: (value: string) => void;
};

type PendingScenarioAction =
  | { kind: "update"; id: string; name: string }
  | { kind: "delete"; id: string; name: string }
  | { kind: "rename"; id: string; name: string; proposedName: string };

function subscribeToLockSupport() {
  return () => undefined;
}

function readLockSupport() {
  return typeof navigator !== "undefined" && typeof navigator.locks !== "undefined";
}

function formatComparisonValue(value: number, unit: ComparisonUnit): string {
  if (unit === "AUD") return formatContribution(value);
  if (unit === "%") {
    if (value < 0 && Math.abs(value) < 0.005) return "−<0.01%";
    return formatPercent(value);
  }
  if (unit === "L" || unit === "min") {
    if (value !== 0 && Math.abs(value) < 0.0005) return `${value < 0 ? "−" : ""}<0.001 ${unit}`;
    return formatQuantity(value, unit);
  }
  const digits = unit === "AUD/L" ? 2 : 3;
  const threshold = 0.5 * 10 ** -digits;
  if (value !== 0 && Math.abs(value) < threshold) return `${value < 0 ? "−" : ""}<${digits === 2 ? "0.01" : "0.001"} ${unit}`;
  return `${formatDisplayNumber(value, digits)} ${unit}`;
}

function formatComparisonDelta(value: number, unit: ComparisonUnit): string {
  if (unit === "AUD") return `AUD ${formatDisplayNumber(value, 2)}`;
  if (unit === "%") return `${formatDisplayNumber(value, 2)}%`;
  const digits = unit === "AUD/L" ? 2 : 3;
  return `${formatDisplayNumber(value, digits)} ${unit}`;
}

function ComparisonTable({ caption, aName, bName, rows }: { caption: string; aName: string; bName: string; rows: ComparisonMetric[] }) {
  return <div className="table-scroll" tabIndex={0} role="region" aria-label={`${caption} comparison table`}><table className="result-table comparison-table">
    <caption>{caption}</caption>
    <thead><tr><th scope="col">Measure</th><th scope="col">Unit</th><th scope="col">Scenario A · {aName}</th><th scope="col">Scenario B · {bName}</th><th scope="col">B − A</th></tr></thead>
    <tbody>{rows.map((row) => {
      const delta = row.b - row.a;
      const deltaDisplay = formatComparisonDelta(delta, row.unit);
      return <tr key={row.key}>
        <th scope="row">{row.label}</th><td>{row.unit}</td>
        <td aria-label={`Exact scenario A value: ${formatPrecision(row.a)} ${row.unit}`}>{formatComparisonValue(row.a, row.unit)}</td>
        <td aria-label={`Exact scenario B value: ${formatPrecision(row.b)} ${row.unit}`}>{formatComparisonValue(row.b, row.unit)}</td>
        <td className={delta < 0 ? "comparison-negative" : delta > 0 ? "comparison-positive" : undefined}
          aria-label={`Exact B minus A difference: ${formatPrecision(delta)} ${row.unit}`}>{deltaDisplay}
          {delta !== 0 && Number(deltaDisplay.replace(/[^0-9.+-]/g, "")) === 0 && <small className="precision-detail">Exact: {formatPrecision(delta)} {row.unit}</small>}</td>
      </tr>;
    })}</tbody>
  </table></div>;
}

function ComparisonChart({ title, rows }: { title: string; rows: ComparisonMetric[] }) {
  const maximum = Math.max(...rows.flatMap((row) => [Math.abs(row.a), Math.abs(row.b)]), Number.EPSILON);
  const description = rows.map((row) => `${row.label}: scenario A ${formatComparisonValue(row.a, row.unit)}, scenario B ${formatComparisonValue(row.b, row.unit)}`).join("; ");
  return <div className="comparison-chart" role="img" aria-label={`${title}. ${description}`}>
    <h4>{title}</h4>
    <div className="comparison-legend"><span><i className="comparison-swatch swatch-a" />Scenario A</span><span><i className="comparison-swatch swatch-b" />Scenario B</span></div>
    {rows.map((row) => <div className="comparison-chart-row" key={row.key}>
      <span className="comparison-chart-label">{row.label}</span>
      <div className="comparison-bars" aria-hidden="true">
        <div className="bar-track"><div className={`bar-fill comparison-fill-a${row.a < 0 ? " comparison-fill-negative" : ""}`} style={{ width: `${Math.abs(row.a) / maximum * 100}%` }} /></div>
        <div className="bar-track"><div className={`bar-fill comparison-fill-b${row.b < 0 ? " comparison-fill-negative" : ""}`} style={{ width: `${Math.abs(row.b) / maximum * 100}%` }} /></div>
      </div>
      <span className="comparison-chart-values">A {formatComparisonValue(row.a, row.unit)} · B {formatComparisonValue(row.b, row.unit)}</span>
    </div>)}
  </div>;
}

function Field({ id, label, value, inputMode = "decimal", unit, hint, error, onChange }: FieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return <div className="field">
    <label htmlFor={id}>{label}{unit && <span className="unit">{unit}</span>}</label>
    <input
      id={id}
      type="text"
      inputMode={inputMode}
      autoComplete="off"
      spellCheck={false}
      value={value}
      aria-invalid={Boolean(error)}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
    />
    {hint && <small id={hintId} className="field-hint">{hint}</small>}
    {error && <small id={errorId} className="field-error">{error}</small>}
  </div>;
}

export default function Home() {
  const [inputs, setInputs] = useState<PlanningInputs>(() => structuredClone(SAMPLE_INPUTS));
  const [submitted, setSubmitted] = useState(false);
  const [calculationState, setCalculationState] = useState<{
    kind: "idle" | "pending" | "success" | "error";
    message?: string;
    requestId?: string;
  }>({ kind: "idle" });
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [resultInputs, setResultInputs] = useState<PlanningInputs | null>(null);
  const [resultRevision, setResultRevision] = useState<number | null>(null);
  const [storeState, setStoreState] = useState<ScenarioStoreState>({ kind: "unavailable", message: "Loading saved scenarios…" });
  const [scenarioName, setScenarioName] = useState("");
  const [storeMessage, setStoreMessage] = useState("");
  const [storeMessageKind, setStoreMessageKind] = useState<"success" | "error" | "info">("info");
  const [retrySaveAvailable, setRetrySaveAvailable] = useState(false);
  const supportsScenarioLocks = useSyncExternalStore(subscribeToLockSupport, readLockSupport, () => false);
  const [hasUnsavedWork, setHasUnsavedWork] = useState(true);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState<{ id: string; name: string; value: string } | null>(null);
  const [pendingScenarioAction, setPendingScenarioAction] = useState<PendingScenarioAction | null>(null);
  const [pendingOpenScenarioId, setPendingOpenScenarioId] = useState<string | null>(null);
  const [pendingCollectionReset, setPendingCollectionReset] = useState(false);
  const [comparisonAId, setComparisonAId] = useState<string | null>(null);
  const [comparisonBId, setComparisonBId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("plan");
  const requestedSection = useRef<string | null>(null);
  const requestedSectionUntil = useRef(0);
  const revision = useRef(0);
  const activeRequest = useRef<{
    revision: number;
    controller: AbortController;
    timer: number;
    timedOut: boolean;
  } | null>(null);
  const errors = useMemo(() => validateInputs(inputs), [inputs]);
  const hasErrors = Object.keys(errors).length > 0;
  const resultIsOutdated = result !== null && resultRevision !== revision.current;
  const comparisonOptions = storeState.kind === "ready"
    ? storeState.scenarios.map((scenario) => ({ scenario, eligibility: getComparisonEligibility(scenario) }))
    : [];
  const eligibleComparisonOptions = comparisonOptions.filter((option) => option.eligibility.eligible);
  const comparisonA = eligibleComparisonOptions.find((option) => option.scenario.id === comparisonAId) ?? eligibleComparisonOptions[0];
  const comparisonB = eligibleComparisonOptions.find((option) => option.scenario.id === comparisonBId && option.scenario.id !== comparisonA?.scenario.id)
    ?? eligibleComparisonOptions.find((option) => option.scenario.id !== comparisonA?.scenario.id);
  const inputComparison = comparisonA && comparisonB
    ? buildInputComparison(comparisonA.scenario.inputs, comparisonB.scenario.inputs)
    : null;
  const resultComparison = comparisonA && comparisonB
    ? buildResultComparison(comparisonA.scenario, comparisonB.scenario)
    : null;

  const scenarioPanel = (
    <section id="scenarios" className="section-block scenario-panel" aria-labelledby="saved-scenarios-heading">
      <div className="section-title-row">
        <div><p className="section-index">03 / Saved work</p><h2 id="saved-scenarios-heading">Scenarios</h2></div>
        {storeState.kind === "ready" && <span className="scenario-count">{storeState.scenarios.length}{storeState.unreadableCount ? ` readable + ${storeState.unreadableCount} unreadable` : ""} / 20 saved</span>}
      </div>
      <p className="section-intro">Save a named version of this plan in this browser. Nothing syncs to another device or saves automatically.</p>
      {storeState.kind === "ready" ? <>
        {!supportsScenarioLocks && <p className="store-help">This browser does not support safe cross-tab storage locks. Saved scenarios can be opened, but changes are disabled here.</p>}
        <div className="scenario-save-row">
          <div className="field scenario-name-field"><label htmlFor="scenario-name">Scenario name<span className="unit">1–50 characters</span></label>
            <input id="scenario-name" type="text" maxLength={50} value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} placeholder="e.g. Reduced orange supply" />
          </div>
          <button type="button" className="save-button" onClick={saveCurrentScenario} disabled={!supportsScenarioLocks || hasErrors || storeState.unreadableCount > 0 || storeState.scenarios.length >= 20}>Save current scenario</button>
        </div>
        {hasErrors && <p className="store-help">Fix the highlighted fields before saving. Incomplete input drafts are not stored.</p>}
        {storeState.unreadableCount > 0 && <div className="store-warning" role="status"><span>{storeState.unreadableCount} unreadable records are preserved. Saving is blocked to protect stored data.</span><button type="button" className="recovery-button" onClick={requestCollectionReset}>Reset saved collection</button></div>}
        {storeState.scenarios.length === 0 ? <div className="empty-scenarios"><p>No saved scenarios in this browser yet.</p><span>Calculate a plan, give it a name, then save it here.</span></div> : <ul className="saved-scenario-list">{storeState.scenarios.map((scenario) => <li key={scenario.id}>
          <div className="saved-scenario-detail"><strong>{scenario.name}{activeScenarioId === scenario.id ? " · open in planner" : ""}</strong><small>{scenario.result && !scenario.result_outdated ? "Current result saved" : scenario.result_outdated ? "Inputs saved · result needs recalculation" : "Inputs saved · no current result"} · Saved {new Date(scenario.updated_at).toLocaleString()}</small></div>
          <div className="scenario-actions">
            <button type="button" className="open-scenario-button" onClick={() => openSavedScenario(scenario.id)}>Open</button>
            <button type="button" className="manage-scenario-button" onClick={() => setPendingScenarioAction({ kind: "update", id: scenario.id, name: scenario.name })} disabled={!supportsScenarioLocks || hasErrors || storeState.unreadableCount > 0} aria-label={`Update ${scenario.name} from current inputs`}>Update</button>
            <button type="button" className="manage-scenario-button" onClick={() => setRenameDraft({ id: scenario.id, name: scenario.name, value: scenario.name })} disabled={!supportsScenarioLocks || storeState.unreadableCount > 0}>Rename</button>
            <button type="button" className="delete-scenario-button" onClick={() => setPendingScenarioAction({ kind: "delete", id: scenario.id, name: scenario.name })} disabled={!supportsScenarioLocks || storeState.unreadableCount > 0}>Delete</button>
          </div>
          {pendingOpenScenarioId === scenario.id && <div className="scenario-edit-confirm" role="group" aria-label={`Confirm opening ${scenario.name}`}>
            <span>Replace the current unsaved planner inputs with “{scenario.name}”?</span>
            <button type="button" className="manage-scenario-button" onClick={() => openSavedScenario(scenario.id, true)}>Open and replace</button>
            <button type="button" className="manage-scenario-button" onClick={() => setPendingOpenScenarioId(null)}>Cancel</button>
          </div>}
          {renameDraft?.id === scenario.id && <div className="scenario-edit-confirm">
            <label htmlFor={`rename-${scenario.id}`}>New name for {scenario.name}</label>
            <input id={`rename-${scenario.id}`} type="text" maxLength={50} value={renameDraft.value} onChange={(event) => setRenameDraft({ ...renameDraft, value: event.target.value })} />
            <button type="button" className="manage-scenario-button" onClick={() => { setPendingScenarioAction({ kind: "rename", id: scenario.id, name: scenario.name, proposedName: renameDraft.value }); setRenameDraft(null); }}>Review rename</button>
            <button type="button" className="manage-scenario-button" onClick={() => setRenameDraft(null)}>Cancel</button>
          </div>}
          {pendingScenarioAction?.id === scenario.id && <div className="scenario-edit-confirm" role="group" aria-label={`Confirm ${pendingScenarioAction.kind} for ${scenario.name}`}>
            <span>{pendingScenarioAction.kind === "update" ? `Replace “${scenario.name}” with the current planner inputs?` : pendingScenarioAction.kind === "delete" ? `Permanently delete “${scenario.name}” from this browser?` : `Rename “${scenario.name}” to “${pendingScenarioAction.proposedName.trim()}”?`}</span>
            <button type="button" className={pendingScenarioAction.kind === "delete" ? "delete-scenario-button" : "manage-scenario-button"} onClick={confirmScenarioAction}>Confirm {pendingScenarioAction.kind}</button>
            <button type="button" className="manage-scenario-button" onClick={() => setPendingScenarioAction(null)}>Cancel</button>
          </div>}
        </li>)}</ul>}
        {storeState.scenarios.length >= 20 && <p className="store-help">The collection limit is 20 scenarios. Saved items are not removed automatically.</p>}
        {storeState.scenarios.length > 0 && <section className="scenario-comparison" aria-labelledby="scenario-comparison-heading">
          <div className="comparison-heading"><h3 id="scenario-comparison-heading">Compare saved scenarios</h3><p>Choose two current optimal results. Differences are calculated as scenario B minus scenario A.</p></div>
          <div className="comparison-selects">
            <div className="field"><label htmlFor="compare-scenario-a">Scenario A</label>
              <select id="compare-scenario-a" value={comparisonA?.scenario.id ?? ""} onChange={(event) => {
                const nextId = event.target.value;
                setComparisonAId(nextId || null);
                if (comparisonB?.scenario.id === nextId) setComparisonBId(eligibleComparisonOptions.find((option) => option.scenario.id !== nextId)?.scenario.id ?? null);
              }}>
                <option value="">Select scenario A</option>
                {comparisonOptions.map(({ scenario, eligibility }) => <option key={scenario.id} value={scenario.id} disabled={!eligibility.eligible || scenario.id === comparisonB?.scenario.id}>
                  {scenario.name}: {eligibility.eligible ? "Ready to compare" : eligibility.reason}
                </option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="compare-scenario-b">Scenario B</label>
              <select id="compare-scenario-b" value={comparisonB?.scenario.id ?? ""} onChange={(event) => {
                const nextId = event.target.value;
                setComparisonBId(nextId || null);
                if (comparisonA?.scenario.id === nextId) setComparisonAId(eligibleComparisonOptions.find((option) => option.scenario.id !== nextId)?.scenario.id ?? null);
              }}>
                <option value="">Select scenario B</option>
                {comparisonOptions.map(({ scenario, eligibility }) => <option key={scenario.id} value={scenario.id} disabled={!eligibility.eligible || scenario.id === comparisonA?.scenario.id}>
                  {scenario.name}: {eligibility.eligible ? "Ready to compare" : eligibility.reason}
                </option>)}
              </select>
            </div>
          </div>
          {eligibleComparisonOptions.length < 2
            ? <p className="comparison-unavailable" role="status">Save two distinct scenarios with current optimal results to compare them. Drafts, infeasible results, outdated snapshots, and prior model versions need attention first.</p>
            : comparisonA && comparisonB && inputComparison && resultComparison && <>
              <div className="comparison-tables">
                <ComparisonTable caption="Saved planner inputs" aName={comparisonA.scenario.name} bName={comparisonB.scenario.name} rows={inputComparison} />
                <ComparisonTable caption="Optimal production and resource use" aName={comparisonA.scenario.name} bName={comparisonB.scenario.name} rows={resultComparison} />
              </div>
              <div className="comparison-charts">
                <ComparisonChart title="Recommended production" rows={resultComparison.filter((row) => row.key.startsWith("production-"))} />
                <ComparisonChart title="Resource use" rows={resultComparison.filter((row) => row.key.startsWith("used-"))} />
                <ComparisonChart title="Total contribution" rows={resultComparison.filter((row) => row.key === "total-contribution")} />
              </div>
            </>}
        </section>}
      </> : <div className="store-warning" role="status"><span>{storeState.message}</span>
        {storeState.kind === "unavailable" ? <button type="button" className="recovery-button" onClick={refreshStoredScenarios}>Retry storage</button> : <button type="button" className="recovery-button" onClick={requestCollectionReset}>Reset saved collection</button>}
      </div>}
      {pendingCollectionReset && <div className="scenario-edit-confirm" role="group" aria-label="Confirm saved collection reset">
        <span>Reset the saved collection? This removes every saved scenario in this browser. Current planner inputs will remain.</span>
        <button type="button" className="delete-scenario-button" onClick={() => void recoverSavedCollection()}>Confirm reset</button>
        <button type="button" className="manage-scenario-button" onClick={() => setPendingCollectionReset(false)}>Cancel</button>
      </div>}
      {storeMessage && <p className={`store-message store-message-${storeMessageKind}`} role={storeMessageKind === "error" ? "alert" : "status"}>{storeMessage}{retrySaveAvailable && <button type="button" className="recovery-button" onClick={saveCurrentScenario}>Retry save</button>}</p>}
    </section>
  );

  useEffect(() => {
    refreshStoredScenarios();
    function handleStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== SCENARIO_STORAGE_KEY) return;
      refreshStoredScenarios();
      setStoreMessage("Saved scenarios changed in another tab. The list was refreshed; current planner inputs were kept.");
      setStoreMessageKind("info");
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const sections = ["plan", "results", "scenarios"]
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    function updateActiveSection() {
      if (requestedSection.current && Date.now() < requestedSectionUntil.current) {
        setActiveSection(requestedSection.current);
        return;
      }
      if (requestedSection.current) {
        requestedSection.current = null;
      }
      const activeLine = Math.min(window.innerHeight * 0.65, 640);
      const passed = sections.filter((section) => section.getBoundingClientRect().top <= activeLine);
      setActiveSection(passed.at(-1)?.id ?? sections[0]?.id ?? "plan");
    }
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    updateActiveSection();
    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, []);

  function refreshStoredScenarios() {
    try {
      setStoreState(readScenarioStore(window.localStorage));
      setStoreMessage("");
      setRetrySaveAvailable(false);
    } catch {
      setStoreState({ kind: "unavailable", message: "Browser storage is unavailable. Your current work is still usable in this tab." });
    }
  }

  function invalidateActiveRequest() {
    const active = activeRequest.current;
    if (active) {
      window.clearTimeout(active.timer);
      active.controller.abort();
      activeRequest.current = null;
    }
    revision.current += 1;
    setCalculationState({ kind: "idle" });
  }

  function updateBlend(blendId: BlendId, field: "profit_aud_per_litre" | "processing_minutes_per_litre" | "min_litres" | "max_litres", value: string) {
    invalidateActiveRequest();
    setHasUnsavedWork(true);
    setInputs((current) => ({
      ...current,
      blends: current.blends.map((blend) => blend.id === blendId ? { ...blend, [field]: value } : blend),
    }));
  }

  function updateRecipe(blendId: BlendId, ingredient: IngredientId, value: string) {
    invalidateActiveRequest();
    setHasUnsavedWork(true);
    setInputs((current) => ({
      ...current,
      blends: current.blends.map((blend) => blend.id === blendId
        ? { ...blend, recipe_percent: { ...blend.recipe_percent, [ingredient]: value } }
        : blend),
    }));
  }

  function updateAvailability(ingredient: IngredientId, value: string) {
    invalidateActiveRequest();
    setHasUnsavedWork(true);
    setInputs((current) => ({
      ...current,
      available_ingredient_litres: { ...current.available_ingredient_litres, [ingredient]: value },
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors) {
      setCalculationState({ kind: "error", message: "Review the highlighted fields before calculating." });
      return;
    }
    void runCalculation();
  }

  function resetSample() {
    invalidateActiveRequest();
    setInputs(structuredClone(SAMPLE_INPUTS));
    setSubmitted(false);
    setHasUnsavedWork(true);
    setActiveScenarioId(null);
    setStoreMessage("");
  }

  function scenarioLocks(): ScenarioLockPort | undefined {
    return typeof window.navigator.locks === "undefined" ? undefined : window.navigator.locks;
  }

  async function saveCurrentScenario() {
    const submittedRevision = revision.current;
    try {
      const currentResult = result && resultRevision === revision.current && !resultIsOutdated &&
        resultInputs && samePlanningInputs(inputs, resultInputs) ? result : null;
      const saved = await saveScenario(window.localStorage, scenarioLocks(), storeState, scenarioName, inputs, currentResult,
        currentResult ? resultInputs : null);
      setStoreState(saved);
      const changedWhileSaving = revision.current !== submittedRevision;
      setStoreMessage(changedWhileSaving
        ? `“${scenarioName.trim()}” was saved. Newer planner edits remain unsaved.`
        : `“${scenarioName.trim()}” was saved in this browser.`);
      setStoreMessageKind("success");
      setRetrySaveAvailable(false);
      if (!changedWhileSaving) {
        setHasUnsavedWork(false);
        setActiveScenarioId(null);
      }
      setScenarioName("");
    } catch (cause) {
      if (cause instanceof ScenarioStoreError && ["STALE_REVISION", "STORE_CHANGED"].includes(cause.code)) refreshStoredScenarios();
      setRetrySaveAvailable(cause instanceof ScenarioStoreError && !["STALE_REVISION", "STORE_CHANGED"].includes(cause.code));
      setStoreMessage(cause instanceof ScenarioStoreError ? cause.message : "The scenario was not saved. Your current work remains available; retry when ready.");
      setStoreMessageKind("error");
    }
  }

  async function updateSavedScenario(id: string, name: string) {
    const submittedRevision = revision.current;
    try {
      const currentResult = result && resultRevision === revision.current && !resultIsOutdated &&
        resultInputs && samePlanningInputs(inputs, resultInputs) ? result : null;
      const saved = await updateScenario(window.localStorage, scenarioLocks(), storeState, id, inputs, currentResult,
        currentResult ? resultInputs : null);
      setStoreState(saved);
      const changedWhileSaving = revision.current !== submittedRevision;
      setStoreMessage(changedWhileSaving
        ? `“${name}” was updated. Newer planner edits remain unsaved.`
        : `“${name}” was updated from the current planner inputs.`);
      setStoreMessageKind("success");
      setRetrySaveAvailable(false);
      if (!changedWhileSaving) {
        setHasUnsavedWork(false);
        setActiveScenarioId(id);
      }
    } catch (cause) {
      if (cause instanceof ScenarioStoreError && ["STALE_REVISION", "STORE_CHANGED", "SCENARIO_MISSING"].includes(cause.code)) refreshStoredScenarios();
      setRetrySaveAvailable(false);
      setStoreMessage(cause instanceof ScenarioStoreError ? cause.message : "The scenario was not updated. Current planner inputs remain available.");
      setStoreMessageKind("error");
    }
  }

  async function renameSavedScenario(id: string, currentName: string, proposedName: string) {
    try {
      const saved = await renameScenario(window.localStorage, scenarioLocks(), storeState, id, proposedName);
      setStoreState(saved);
      setStoreMessage(`Scenario renamed to “${proposedName.trim()}”.`);
      setStoreMessageKind("success");
      setRetrySaveAvailable(false);
    } catch (cause) {
      if (cause instanceof ScenarioStoreError && ["STALE_REVISION", "STORE_CHANGED", "SCENARIO_MISSING"].includes(cause.code)) refreshStoredScenarios();
      setRetrySaveAvailable(false);
      setStoreMessage(cause instanceof ScenarioStoreError ? cause.message : "The scenario was not renamed.");
      setStoreMessageKind("error");
    }
  }

  async function deleteSavedScenario(id: string, name: string) {
    try {
      const saved = await deleteScenario(window.localStorage, scenarioLocks(), storeState, id);
      setStoreState(saved);
      if (activeScenarioId === id) setActiveScenarioId(null);
      setStoreMessage(`“${name}” was deleted from this browser.`);
      setStoreMessageKind("success");
      setRetrySaveAvailable(false);
    } catch (cause) {
      if (cause instanceof ScenarioStoreError && ["STALE_REVISION", "STORE_CHANGED", "SCENARIO_MISSING"].includes(cause.code)) refreshStoredScenarios();
      setRetrySaveAvailable(false);
      setStoreMessage(cause instanceof ScenarioStoreError ? cause.message : "The scenario was not deleted.");
      setStoreMessageKind("error");
    }
  }

  function confirmScenarioAction() {
    const action = pendingScenarioAction;
    setPendingScenarioAction(null);
    if (!action) return;
    if (action.kind === "update") void updateSavedScenario(action.id, action.name);
    if (action.kind === "delete") void deleteSavedScenario(action.id, action.name);
    if (action.kind === "rename") void renameSavedScenario(action.id, action.name, action.proposedName);
  }

  function openSavedScenario(id: string, confirmed = false) {
    if (hasUnsavedWork && !confirmed) {
      setPendingOpenScenarioId(id);
      return;
    }
    setPendingOpenScenarioId(null);
    if (storeState.kind !== "ready") return;
    const scenario = storeState.scenarios.find((item) => item.id === id);
    if (!scenario) return;
    invalidateActiveRequest();
    const openedInputs = structuredClone(scenario.inputs);
    const compatibleResult = scenario.result && !scenario.result_outdated && scenario.result_input_snapshot &&
      samePlanningInputs(openedInputs, scenario.result_input_snapshot) &&
      scenario.result.api_version === API_VERSION && scenario.result.model_version === MODEL_VERSION
      ? scenario.result
      : null;
    setInputs(openedInputs);
    setSubmitted(false);
    setResult(compatibleResult ? structuredClone(compatibleResult) : null);
    setResultInputs(compatibleResult && scenario.result_input_snapshot ? structuredClone(scenario.result_input_snapshot) : null);
    setResultRevision(compatibleResult ? revision.current : null);
    setHasUnsavedWork(false);
    setActiveScenarioId(id);
    setStoreMessage(compatibleResult
      ? `Opened “${scenario.name}” with its saved result.`
      : scenario.result_outdated
        ? `Opened “${scenario.name}”. Its saved result is outdated or incompatible; calculate again to refresh it.`
        : `Opened “${scenario.name}”. This scenario has no current calculation result.`);
    setStoreMessageKind(compatibleResult ? "success" : "info");
  }

  async function recoverSavedCollection() {
    setPendingCollectionReset(false);
    try {
      const reset = await resetScenarioStore(window.localStorage, scenarioLocks(), true);
      setStoreState(reset);
      setActiveScenarioId(null);
      setStoreMessage(reset.kind === "ready" ? "Saved collection reset. Current planner inputs were preserved." : reset.message);
      setStoreMessageKind(reset.kind === "ready" ? "success" : "error");
      setRetrySaveAvailable(false);
    } catch (cause) {
      setRetrySaveAvailable(false);
      setStoreMessage(cause instanceof Error ? cause.message : "The collection was not reset.");
      setStoreMessageKind("error");
    }
  }

  function requestCollectionReset() {
    setPendingCollectionReset(true);
  }

  async function runCalculation() {
    if (activeRequest.current?.revision === revision.current) return;
    if (hasErrors) {
      setSubmitted(true);
      setCalculationState({ kind: "error", message: "Review the highlighted fields before calculating." });
      return;
    }
    const previous = activeRequest.current;
    if (previous) {
      window.clearTimeout(previous.timer);
      previous.controller.abort();
    }
    const controller = new AbortController();
    const request = {
      revision: revision.current,
      controller,
      timer: 0,
      timedOut: false,
    };
    activeRequest.current = request;
    request.timer = window.setTimeout(() => {
      request.timedOut = true;
      controller.abort();
    }, CALCULATION_DEADLINE_MS);
    setCalculationState({ kind: "pending", message: "Checking the scenario against available resources…" });

    try {
      const snapshot = structuredClone(inputs);
      const response = await calculate(snapshot, controller.signal);
      if (activeRequest.current !== request || revision.current !== request.revision) return;
      setResult(response);
      setResultInputs(snapshot);
      setResultRevision(request.revision);
      setHasUnsavedWork(true);
      setCalculationState({ kind: "success", message: "Calculation complete." });
      window.requestAnimationFrame(() => {
        const resultsSection = document.getElementById("results");
        const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const behavior = reduceMotion ? "auto" : "smooth";
        resultsSection?.scrollIntoView?.({ behavior, block: "start" });
        document.getElementById("results-heading")?.focus({ preventScroll: true });
      });
    } catch (cause) {
      if (activeRequest.current !== request || revision.current !== request.revision) return;
      const message = request.timedOut
        ? "Calculation exceeded the 10-second deadline. Your inputs are unchanged; retry when ready."
        : cause instanceof DOMException && cause.name === "AbortError"
          ? "Calculation was cancelled. Your inputs are unchanged."
          : cause instanceof ApiRequestError || cause instanceof Error
            ? cause.message
            : "Calculation failed. Your inputs are unchanged; retry manually.";
      setCalculationState({
        kind: "error",
        message,
        requestId: cause instanceof ApiRequestError ? cause.requestId : undefined,
      });
    } finally {
      window.clearTimeout(request.timer);
      if (activeRequest.current === request) activeRequest.current = null;
    }
  }

  function fieldError(path: string) {
    return submitted ? errors[path] : undefined;
  }

  const isPending = calculationState.kind === "pending";

  const resultBlendContributions = result?.status === "optimal" && resultInputs
    ? Object.fromEntries(BLEND_IDS.map((blendId) => {
      const blend = resultInputs.blends.find((item) => item.id === blendId)!;
      return [blendId, Number(blend.profit_aud_per_litre) * result.production_litres[blendId]];
    })) as Record<BlendId, number>
    : null;

  function blendInput(blendId: BlendId) {
    return inputs.blends.find((blend) => blend.id === blendId)!;
  }

  return <main className="shell">
    <header className="topbar">
      <a className="brand" href="#top">Production Planner</a>
      <span className="topbar-note">Daily planning <span aria-hidden="true">/</span> one production day</span>
    </header>

    <section className="page-intro" id="top" aria-labelledby="page-title">
      <div>
        <p className="section-index">Today&apos;s production</p>
        <h1 id="page-title">Plan today&apos;s production</h1>
        <p>Set ingredient supply and blend limits, then calculate a feasible plan.</p>
      </div>
      <a className="intro-link" href="#plan">Review inputs <span aria-hidden="true">↓</span></a>
    </section>

    <nav className="section-nav" aria-label="Planner sections">
      <a href="#plan" onClick={() => { requestedSection.current = "plan"; requestedSectionUntil.current = Date.now() + 1200; setActiveSection("plan"); }} aria-current={activeSection === "plan" ? "location" : undefined}><span>01</span>Plan</a>
      <a href="#results" onClick={() => { requestedSection.current = "results"; requestedSectionUntil.current = Date.now() + 1200; setActiveSection("results"); }} aria-current={activeSection === "results" ? "location" : undefined}><span>02</span>Results</a>
      <a href="#scenarios" onClick={() => { requestedSection.current = "scenarios"; requestedSectionUntil.current = Date.now() + 1200; setActiveSection("scenarios"); }} aria-current={activeSection === "scenarios" ? "location" : undefined}><span>03</span>Scenarios</a>
    </nav>

    <form id="planner-form" className="planner-form" onSubmit={handleSubmit} noValidate>
      <section id="plan" className="plan-section" aria-labelledby="plan-heading">
        <div className="plan-heading">
          <div><p className="section-index">01 / Inputs</p><h2 id="plan-heading">Set your production limits</h2></div>
          <button type="button" className="text-button" onClick={resetSample}>Reset sample</button>
        </div>
        <div className="sample-note" role="note"><strong>{samePlanningInputs(inputs, SAMPLE_INPUTS) && activeScenarioId === null ? "Fictional sample inputs" : "Current planning inputs"}</strong><span>Changes are not saved automatically.</span></div>

        <section className="resource-section" aria-labelledby="resources-heading">
          <div className="panel-heading input-group-heading">
            <div><h3 id="resources-heading">Available resources</h3><p>Set the supply and shared production time for today.</p></div>
          </div>
          <div className="panel resource-panel">
            <div className="resource-fields">
              {INGREDIENT_IDS.map((ingredient) => <Field
                key={ingredient}
                id={`available-${ingredient}`}
                label={`${INGREDIENT_LABELS[ingredient]} juice`}
                unit="L available"
                value={inputs.available_ingredient_litres[ingredient]}
                error={fieldError(`available_ingredient_litres.${ingredient}`)}
                onChange={(value) => updateAvailability(ingredient, value)}
              />)}
              <Field
                id="processing-capacity"
                label="Processing time"
                unit="hours"
                value={inputs.processing_capacity_hours}
                hint="Shared across all blends"
                error={fieldError("processing_capacity_hours")}
                onChange={(value) => { invalidateActiveRequest(); setHasUnsavedWork(true); setInputs((current) => ({ ...current, processing_capacity_hours: value })); }}
              />
            </div>
          </div>
        </section>

        <section className="blend-section" aria-labelledby="blends-heading">
          <div className="panel-heading input-group-heading">
            <div><h3 id="blends-heading">Blend setup</h3><p>Recipes, contribution and demand for each product.</p></div>
          </div>
          <div className="blend-list">
            {BLEND_IDS.map((blendId, index) => {
              const blend = blendInput(blendId);
              return <article className={`panel blend-card blend-${blendId}`} key={blendId} aria-labelledby={`blend-title-${blendId}`}>
                <div className="blend-card-top">
                  <span className="blend-index" aria-label={`Blend ${index + 1}`}>0{index + 1}</span>
                  <div><p className="blend-kicker">Blend</p><h4 id={`blend-title-${blendId}`}>{BLEND_LABELS[blendId]}</h4></div>
                </div>
                <div className="recipe-grid">
                  {INGREDIENT_IDS.map((ingredient) => <Field
                    key={ingredient}
                    id={`recipe-${blendId}-${ingredient}`}
                    label={INGREDIENT_LABELS[ingredient]}
                    unit="%"
                    value={blend.recipe_percent[ingredient]}
                    error={fieldError(`blends.${blendId}.recipe_percent.${ingredient}`)}
                    onChange={(value) => updateRecipe(blendId, ingredient, value)}
                  />)}
                </div>
                {submitted && errors[`blends.${blendId}.recipe_percent`] && <p className="group-error" role="alert">{errors[`blends.${blendId}.recipe_percent`]}</p>}
                <div className="blend-detail-grid">
                  <Field id={`profit-${blendId}`} label="Contribution" inputMode="text" unit="AUD / L" value={blend.profit_aud_per_litre}
                    hint="Can be negative" error={fieldError(`blends.${blendId}.profit_aud_per_litre`)}
                    onChange={(value) => updateBlend(blendId, "profit_aud_per_litre", value)} />
                  <Field id={`processing-${blendId}`} label="Processing" unit="min / L" value={blend.processing_minutes_per_litre}
                    error={fieldError(`blends.${blendId}.processing_minutes_per_litre`)}
                    onChange={(value) => updateBlend(blendId, "processing_minutes_per_litre", value)} />
                  <Field id={`minimum-${blendId}`} label="Minimum order" unit="L" value={blend.min_litres}
                    error={fieldError(`blends.${blendId}.min_litres`)}
                    onChange={(value) => updateBlend(blendId, "min_litres", value)} />
                  <Field id={`maximum-${blendId}`} label="Maximum demand" unit="L" value={blend.max_litres}
                    error={fieldError(`blends.${blendId}.max_litres`)}
                    onChange={(value) => updateBlend(blendId, "max_litres", value)} />
                </div>
                <p className="blend-footnote">Recipe percentages must add up to 100%. Enter continuous litres; fractional output is allowed.</p>
              </article>;
            })}
          </div>
        </section>

        <details className="model-assumptions">
          <summary>What the plan considers</summary>
          <ul>
            <li>Ingredient supply and processing time are shared across blends.</li>
            <li>Recipes stay fixed during a calculation and can change before the next one.</li>
            <li>One litre of ingredients yields one litre of juice, with no production loss.</li>
            <li>Production can include fractional litres.</li>
          </ul>
        </details>
        <div className="form-actions">
          <p>Uses the limits and recipe shares entered above.</p>
          <button id="calculate-plan" className="primary-button" type="submit" disabled={isPending}>
            {isPending ? <><span className="loading-spinner" aria-hidden="true" />Calculating plan</> : "Calculate production plan"}
          </button>
        </div>
        {calculationState.message && <div className={`form-notice ${calculationState.kind === "error" ? "form-notice-error" : ""}`} role={calculationState.kind === "error" ? "alert" : "status"} aria-live="polite">
          <span>{calculationState.message}{calculationState.requestId && <small className="error-request-id">Request {calculationState.requestId}</small>}</span>
          {calculationState.kind === "error" && !hasErrors && <button type="button" className="retry-button" onClick={() => void runCalculation()}>Retry</button>}
        </div>}
      </section>
    </form>

    <section id="results" className="results-section" aria-labelledby="results-section-heading">
      <div className="section-title-row results-heading-row">
        <div><p className="section-index">02 / Recommendation</p><h2 id="results-section-heading">Results</h2></div>
        {result && resultIsOutdated && <span className="outdated-badge">Inputs changed. Recalculate</span>}
      </div>
      {result ? <div className="result-panel" aria-labelledby="results-heading" aria-live="polite">
          <div className="result-title-row">
            <div><h3 id="results-heading" tabIndex={-1}>{result.status === "optimal" ? "Recommended production" : "Minimum orders exceed resources"}</h3></div>
          </div>
          {result.status === "optimal" ? <>
            <div className="result-summary"><span>Total profit contribution</span><strong>{formatContribution(result.profit_contribution_aud)}</strong></div>
            <section className="result-block" aria-labelledby="production-results-heading">
              <h4 id="production-results-heading">Production plan</h4>
              <div className="table-scroll" tabIndex={0} role="region" aria-label="Recommended production and demand-limit table"><table className="result-table"><caption>Recommended production and demand-limit status</caption><thead><tr><th scope="col">Blend</th><th scope="col">Production</th><th scope="col">Demand limit</th><th scope="col">Contribution</th></tr></thead><tbody>
                {BLEND_IDS.map((blendId) => <tr key={blendId}>
                  <th scope="row">{BLEND_LABELS[blendId]}</th>
                  <td><span>{formatQuantity(result.production_litres[blendId], "L")}</span>{result.production_litres[blendId] > 0 && result.production_litres[blendId] < 0.001 && <small className="precision-detail">Exact: {formatPrecision(result.production_litres[blendId])} L</small>}</td>
                  <td>{result.reached_demand_caps.includes(blendId) ? <span className="result-flag">At demand cap</span> : "Below demand cap"}</td>
                  <td className={resultBlendContributions?.[blendId] !== undefined && resultBlendContributions[blendId] < 0 ? "negative-value" : ""}>{resultBlendContributions ? formatContribution(resultBlendContributions[blendId]) : "Not calculated"}</td>
                </tr>)}
              </tbody></table></div>
              <div className="chart-card" role="img" aria-label={`Production by blend: ${BLEND_IDS.map((id) => `${BLEND_LABELS[id]} ${formatQuantity(result.production_litres[id], "L")}`).join("; ")}`}>
                <h5>Production by blend</h5>{BLEND_IDS.map((blendId) => {
                  const value = result.production_litres[blendId];
                  const maximum = Math.max(...BLEND_IDS.map((id) => result.production_litres[id]), 0);
                  const width = maximum > 0 ? value / maximum * 100 : 0;
                  return <div className="bar-row" key={blendId}><span>{BLEND_LABELS[blendId]}</span><div className="bar-track"><div className="bar-fill production-fill" style={{ width: `${width}%` }} /></div><strong>{formatQuantity(value, "L")}</strong></div>;
                })}
              </div>
            </section>
            {resultBlendContributions && <section className="result-block" aria-labelledby="contribution-results-heading">
              <h4 id="contribution-results-heading">Contribution by blend</h4>
              <div className="table-scroll" tabIndex={0} role="region" aria-label="Contribution by blend table"><table className="result-table"><caption>Contribution is input rate × returned quantity; rounded rows may not sum exactly to the total.</caption><thead><tr><th scope="col">Blend</th><th scope="col">Contribution</th><th scope="col">Production</th></tr></thead><tbody>
                {BLEND_IDS.map((blendId) => <tr key={blendId}><th scope="row">{BLEND_LABELS[blendId]}</th><td className={resultBlendContributions[blendId] < 0 ? "negative-value" : ""}>{formatContribution(resultBlendContributions[blendId])}</td><td>{formatQuantity(result.production_litres[blendId], "L")}</td></tr>)}
              </tbody></table></div>
              <div className="chart-card" role="img" aria-label={`Contribution by blend: ${BLEND_IDS.map((id) => `${BLEND_LABELS[id]} ${formatContribution(resultBlendContributions[id])}`).join("; ")}`}>
                <h5>Contribution by blend</h5>{BLEND_IDS.map((blendId) => {
                  const value = resultBlendContributions[blendId];
                  const maximum = Math.max(...BLEND_IDS.map((id) => Math.abs(resultBlendContributions[id])), 0);
                  const width = maximum > 0 ? Math.abs(value) / maximum * 100 : 0;
                  return <div className="bar-row" key={blendId}><span>{BLEND_LABELS[blendId]}</span><div className="bar-track"><div className={`bar-fill ${value < 0 ? "negative-fill" : "contribution-fill"}`} style={{ width: `${width}%` }} /></div><strong>{formatContribution(value)}</strong></div>;
                })}
              </div>
            </section>}
            <section className="result-block" aria-labelledby="resource-results-heading">
              <h4 id="resource-results-heading">Resource use</h4>
              <div className="table-scroll" tabIndex={0} role="region" aria-label="Resource use and constraint status table"><table className="result-table"><caption>Resource use, remaining capacity, and constraint status</caption><thead><tr><th scope="col">Resource</th><th scope="col">Used</th><th scope="col">Available</th><th scope="col">Remaining</th><th scope="col">Utilization</th><th scope="col">Status</th></tr></thead><tbody>
                {result.resources.map((resource) => {
                  const unit = resource.unit === "minutes" ? "min" : "L";
                  const residual = result.numerical_residuals.find((item) => item.constraint === resource.id);
                  const status = resource.available === 0 ? "No capacity" : resource.is_fully_used ? "Fully used" : "Capacity remains";
                  return <tr key={resource.id}><th scope="row">{resource.id === "processing" ? "Processing time" : `${INGREDIENT_LABELS[resource.id]} juice`}</th>
                    <td>{formatQuantity(resource.used, unit)}</td><td>{formatQuantity(resource.available, unit)}</td>
                    <td>{resource.remaining < 0 && residual ? <><span>Within solver tolerance</span><small className="precision-detail">Excess: {formatPrecision(residual.residual)} {unit}</small></> : formatQuantity(resource.remaining, unit)}</td>
                    <td>{resource.utilization_percent === null ? "No capacity" : formatPercent(resource.utilization_percent)}</td><td>{resource.available === 0 ? status : resource.is_fully_used ? <span className="result-flag">{status}</span> : status}</td>
                  </tr>;
                })}
              </tbody></table></div>
              <div className="chart-card" role="img" aria-label={`Resource utilization: ${result.resources.map((resource) => `${resource.id === "processing" ? "Processing" : INGREDIENT_LABELS[resource.id]} ${resource.utilization_percent === null ? "No capacity" : formatPercent(resource.utilization_percent)}`).join("; ")}`}>
                <h5>Resource utilization</h5>{result.resources.map((resource) => {
                  const percent = resource.utilization_percent;
                  const label = resource.id === "processing" ? "Processing" : INGREDIENT_LABELS[resource.id];
                  return <div className="bar-row" key={resource.id}><span>{label}</span><div className="bar-track">{percent !== null && <div className={`bar-fill ${resource.is_fully_used ? "full-fill" : "resource-fill"}`} style={{ width: `${Math.max(0, Math.min(percent, 100))}%` }} />}</div><strong>{percent === null ? "No capacity" : formatPercent(percent)}</strong></div>;
                })}
              </div>
              <p className="result-footnote">“Fully used” and “At demand cap” identify active limits; more capacity does not guarantee higher contribution.</p>
              {result.numerical_residuals.length > 0 && <div className="residual-note"><strong>Solver tolerance applied.</strong> Small positive residuals within the accepted 0.000001 tolerance are disclosed here, not treated as exact equality.<ul>{result.numerical_residuals.map((item, index) => <li key={`${item.constraint}-${index}`}>{item.constraint}: {item.residual < 0.001 ? `<0.001 ${item.unit === "litres" ? "L" : "min"}` : formatQuantity(item.residual, item.unit === "litres" ? "L" : "min")} <small>(exact {formatPrecision(item.residual)} {item.unit})</small></li>)}</ul></div>}
              <details className="precision-details"><summary>Unrounded calculation values</summary><div className="table-scroll" tabIndex={0} role="region" aria-label="Unrounded calculation values table"><table className="result-table"><caption>Full numeric values from the optimizer response and submitted input snapshot</caption><thead><tr><th scope="col">Measure</th><th scope="col">Unrounded value</th></tr></thead><tbody>
                <tr><th scope="row">Total contribution</th><td>{formatPrecision(result.profit_contribution_aud)} AUD</td></tr>
                {BLEND_IDS.map((blendId) => <Fragment key={blendId}><tr><th scope="row">{BLEND_LABELS[blendId]} production</th><td>{formatPrecision(result.production_litres[blendId])} L</td></tr>{resultBlendContributions && <tr><th scope="row">{BLEND_LABELS[blendId]} contribution</th><td>{formatPrecision(resultBlendContributions[blendId])} AUD</td></tr>}</Fragment>)}
                {result.resources.map((resource) => <Fragment key={resource.id}><tr><th scope="row">{resource.id} used</th><td>{formatPrecision(resource.used)} {resource.unit}</td></tr><tr><th scope="row">{resource.id} available</th><td>{formatPrecision(resource.available)} {resource.unit}</td></tr><tr><th scope="row">{resource.id} remaining</th><td>{formatPrecision(resource.remaining)} {resource.unit}</td></tr>{resource.utilization_percent !== null && <tr><th scope="row">{resource.id} utilization</th><td>{formatPrecision(resource.utilization_percent)}%</td></tr>}</Fragment>)}
                {result.numerical_residuals.map((item, index) => <tr key={`${item.constraint}-${index}`}><th scope="row">{item.constraint} residual</th><td>{formatPrecision(item.residual)} {item.unit}</td></tr>)}
              </tbody></table></div></details>
            </section>
          </> : <>
            <p className="shortage-intro">The minimum orders require more resources than are available. No production plan was returned.</p>
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Exact resource shortages table"><table className="result-table"><caption>Exact resource shortages for the submitted minimum orders</caption><thead><tr><th scope="col">Resource</th><th scope="col">Required</th><th scope="col">Available</th><th scope="col">Shortfall</th></tr></thead><tbody>{result.shortages.map((shortage) => {
              const unit = shortage.unit === "minutes" ? "min" : "L";
              const tiny = shortage.shortfall < 0.001;
              return <tr key={shortage.resource_id}><th scope="row">{shortage.resource_id === "processing" ? "Processing time" : `${INGREDIENT_LABELS[shortage.resource_id]} juice`}</th><td>{formatQuantity(shortage.required, unit)}</td><td>{formatQuantity(shortage.available, unit)}</td><td className="negative-value">{tiny ? <><span>&lt;0.001 {unit}</span><small className="precision-detail">Exact: {formatPrecision(shortage.shortfall)} {unit}</small></> : formatQuantity(shortage.shortfall, unit)}</td></tr>;
            })}</tbody></table></div>
          </>}
          <p className="request-reference">Request {result.request_id} <span>·</span> {result.duration_ms.toFixed(0)} ms</p>
        </div> : <div className="empty-result">
        <p className="empty-result-label">No calculation yet</p>
        <h3 id="results-heading" tabIndex={-1}>Your plan will appear here</h3>
        <p>Enter today&apos;s limits and calculate to see recommended litres, contribution, and resource use.</p>
        <a className="text-button" href="#plan">Review plan inputs</a>
      </div>}
      <p className="contribution-note">Contribution is not net profit. It excludes costs beyond the values entered here.</p>
    </section>

    {scenarioPanel}

    <footer className="footer"><span>Production Planner</span><span>One day, three blends, browser-saved scenarios</span></footer>
  </main>;
}
