"use client";

import { useEffect, useRef, useState } from "react";

const sample = {
  api_version: 1,
  model_version: "juice-day-v1",
  blends: [
    { id: "orange_apple", recipe_percent: { orange: "60", apple: "40", pineapple: "0" }, profit_aud_per_litre: "2.00", processing_minutes_per_litre: "2", min_litres: "0", max_litres: "60" },
    { id: "apple_pineapple", recipe_percent: { orange: "0", apple: "50", pineapple: "50" }, profit_aud_per_litre: "1.80", processing_minutes_per_litre: "2", min_litres: "0", max_litres: "60" },
    { id: "tropical", recipe_percent: { orange: "30", apple: "30", pineapple: "40" }, profit_aud_per_litre: "2.50", processing_minutes_per_litre: "3", min_litres: "0", max_litres: "60" },
  ],
  available_ingredient_litres: { orange: "40", apple: "40", pineapple: "30" },
  processing_capacity_hours: "4",
};

type Resource = { id: string; unit: string; available: number; used: number; remaining: number };
type Optimal = { status: "optimal"; request_id: string; production_litres: Record<string, number>; profit_contribution_aud: number; resources: Resource[]; numerical_residuals: { constraint: string; residual: number; unit: string }[] };
type Infeasible = { status: "infeasible"; request_id: string; shortages: { resource_id: string; unit: string; required: number; available: number; shortfall: number }[] };
type Result = Optimal | Infeasible;

function three(value: number) {
  return Math.abs(value) < 0.0005 ? "0.000" : value.toFixed(3);
}

export default function Home() {
  const [orange, setOrange] = useState("40");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const start = useRef<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const revision = useRef(0);

  useEffect(() => {
    if (result && start.current !== null) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setElapsed(performance.now() - start.current!);
        start.current = null;
      }));
    }
  }, [result]);

  async function calculate() {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    const requestRevision = revision.current;
    const timeout = window.setTimeout(() => active.abort(), 10_000);
    setPending(true);
    setError("");
    setResult(null);
    setElapsed(null);
    start.current = performance.now();
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      // send the sample data to the API endpoint
      const response = await fetch(`${base}/api/v1/optimize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sample, available_ingredient_litres: { ...sample.available_ingredient_litres, orange } }),
        signal: active.signal, cache: "no-store",
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("The calculation service returned an unreadable response. Retry manually.");
      }
      if (!response.ok) throw new Error(data?.error?.message || `Calculation failed (${response.status}).`);
      if (data.api_version !== 1 || data.model_version !== "juice-day-v1" ||
          !["optimal", "infeasible"].includes(data.status)) throw new Error("The API returned an incompatible result.");
      if (data.status === "optimal" &&
          (!data.production_litres || !Array.isArray(data.resources) ||
           !Array.isArray(data.numerical_residuals) ||
           !Number.isFinite(data.profit_contribution_aud))) throw new Error("The API returned an incomplete result.");
      if (data.status === "infeasible" && !Array.isArray(data.shortages))
        throw new Error("The API returned an incomplete shortage result.");
      if (requestRevision !== revision.current || controller.current !== active) return;
      setResult(data as Result);
    } catch (cause) {
      if (requestRevision !== revision.current || controller.current !== active) return;
      setError(cause instanceof Error && cause.name === "AbortError"
        ? "Calculation exceeded the 10-second deadline. Retry manually."
        : cause instanceof TypeError ? "Could not reach the calculation service. Retry manually."
        : cause instanceof Error ? cause.message : "Calculation is unavailable. Retry manually.");
      start.current = null;
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === active) setPending(false);
    }
  }

  function changeOrange(value: string) {
    revision.current += 1;
    controller.current?.abort();
    controller.current = null;
    start.current = null;
    setOrange(value);
    setResult(null);
    setElapsed(null);
    setError("");
    setPending(false);
  }

  return <main>
    <h1>Production Planner feasibility harness</h1>
    <p className="muted">Fictional juice data. This page tests the deployed API path and timing before the full dashboard is built.</p>
    <section className="card" aria-labelledby="sample-heading">
      <h2 id="sample-heading">Sample calculation</h2>
      <p>Orange–apple, apple–pineapple, and tropical blends share ingredients and four hours of processing time. Change orange availability to 30 L to try the comparison fixture.</p>
      <div className="controls">
        <label>Orange available (L)<input value={orange} onChange={event => changeOrange(event.target.value)} inputMode="decimal" /></label>
        <button disabled={pending} onClick={calculate}>{pending ? "Calculating…" : "Optimize"}</button>
      </div>
      <p className="muted">Other sample values remain fixed for this spike. No scenario is saved.</p>
    </section>
    {error && <p className="error" role="alert">{error}</p>}
    {result && <section className="card" aria-live="polite">
      <h2>{result.status === "optimal" ? "Optimal sample result" : "Minimum orders exceed resources"}</h2>
      <p>Request ID: {result.request_id}</p>
      {elapsed !== null && <p>Click to rendered result: {elapsed.toFixed(1)} ms</p>}
      {result.status === "optimal" ? <>
        <p>Total profit contribution: AUD {result.profit_contribution_aud.toFixed(2)}</p>
        <div className="table-wrap"><table><caption>Recommended production</caption><thead><tr><th>Blend</th><th>Litres</th><th>Relative quantity</th></tr></thead><tbody>
          {Object.entries(result.production_litres).map(([id, litres]) => <tr key={id}><th>{id.replaceAll("_", "–")}</th><td>{three(litres)}</td><td><div className="bar" style={{ width: `${Math.max(0, litres / 60 * 100)}%` }} /></td></tr>)}
        </tbody></table></div>
        <div className="table-wrap"><table><caption>Resource use</caption><thead><tr><th>Resource</th><th>Used</th><th>Available</th><th>Remaining</th></tr></thead><tbody>
          {result.resources.map(resource => <tr key={resource.id}><th>{resource.id}</th><td>{three(resource.used)} {resource.unit}</td><td>{three(resource.available)} {resource.unit}</td><td>{three(resource.remaining)} {resource.unit}</td></tr>)}
        </tbody></table></div>
        {result.numerical_residuals.length > 0 && <p className="muted">Tiny residuals within the solver tolerance: {result.numerical_residuals.map(item => `${item.constraint} ${item.residual} ${item.unit}`).join(", ")}.</p>}
      </> : <ul>{result.shortages.map(shortage => <li key={shortage.resource_id}>{shortage.resource_id}: need {shortage.required} {shortage.unit}, have {shortage.available}; short {shortage.shortfall}.</li>)}</ul>}
    </section>}
  </main>;
}
