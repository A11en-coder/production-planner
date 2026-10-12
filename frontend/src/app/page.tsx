"use client";

import { Fragment, useMemo, useRef, useState, type FormEvent } from "react";
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
import { ApiRequestError, CALCULATION_DEADLINE_MS, calculate, type CalculationResult } from "@/lib/api";
import { formatContribution, formatPercent, formatPrecision, formatQuantity } from "@/lib/display";

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
    setInputs((current) => ({
      ...current,
      blends: current.blends.map((blend) => blend.id === blendId ? { ...blend, [field]: value } : blend),
    }));
  }

  function updateRecipe(blendId: BlendId, ingredient: IngredientId, value: string) {
    invalidateActiveRequest();
    setInputs((current) => ({
      ...current,
      blends: current.blends.map((blend) => blend.id === blendId
        ? { ...blend, recipe_percent: { ...blend.recipe_percent, [ingredient]: value } }
        : blend),
    }));
  }

  function updateAvailability(ingredient: IngredientId, value: string) {
    invalidateActiveRequest();
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
      setCalculationState({ kind: "success", message: "Calculation complete." });
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
      <a className="brand" href="#top" aria-label="Production Planner home">
        <span className="brand-mark" aria-hidden="true">P</span>
        <span>Production Planner</span>
      </a>
      <span className="topbar-note"><span className="status-dot" />Daily blend planning</span>
    </header>

    <section className="hero" id="top" aria-labelledby="page-title">
      <div className="hero-copy">
        <p className="eyebrow">A clearer way to plan production</p>
        <h1 id="page-title">Make every litre<br /><span>count.</span></h1>
        <p className="hero-description">Balance your blend recipes, ingredient supply and production time to find a plan that works for today.</p>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="fruit fruit-orange" /><div className="fruit fruit-lime" /><div className="fruit fruit-berry" />
        <span className="art-leaf leaf-one" /><span className="art-leaf leaf-two" />
        <div className="art-label"><span>3</span><small>blends<br />in focus</small></div>
      </div>
    </section>

    <div className="notice-strip" role="note">
      <span className="notice-icon" aria-hidden="true">i</span>
      <p><strong>Sample scenario</strong> — Values are fictional and loaded for you to explore. Nothing is saved automatically.</p>
      <span className="sample-tag">DEMO DATA</span>
    </div>

    <div className="workspace-grid">
      <form className="planner-form" onSubmit={handleSubmit} noValidate>
        <div className="section-heading">
          <div><p className="eyebrow">Your production day</p><h2>Scenario inputs</h2></div>
          <button type="button" className="text-button" onClick={resetSample}>Reset sample</button>
        </div>

        <section className="panel resource-panel" aria-labelledby="resources-heading">
          <div className="panel-heading">
            <span className="step-number">01</span>
            <div><h3 id="resources-heading">Available resources</h3><p>Set the supply and shared production time for today.</p></div>
          </div>
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
              onChange={(value) => { invalidateActiveRequest(); setInputs((current) => ({ ...current, processing_capacity_hours: value })); }}
            />
          </div>
        </section>

        <section className="blend-section" aria-labelledby="blends-heading">
          <div className="panel-heading blend-heading">
            <span className="step-number">02</span>
            <div><h3 id="blends-heading">Blend setup</h3><p>Recipes, contribution and demand for each product.</p></div>
          </div>
          <div className="blend-list">
            {BLEND_IDS.map((blendId, index) => {
              const blend = blendInput(blendId);
              return <article className={`panel blend-card blend-${blendId}`} key={blendId} aria-labelledby={`blend-title-${blendId}`}>
                <div className="blend-card-top">
                  <span className={`blend-icon blend-icon-${index + 1}`} aria-hidden="true">{["◒", "◍", "✳"][index]}</span>
                  <div><p className="blend-kicker">BLEND 0{index + 1}</p><h4 id={`blend-title-${blendId}`}>{BLEND_LABELS[blendId]}</h4></div>
                  <span className="recipe-badge">Recipe shares</span>
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

        <div className="form-actions">
          <div className="action-copy"><span className="action-spark" aria-hidden="true">✦</span><span>Ready when your inputs are set.</span></div>
          <button className="primary-button" type="submit" disabled={isPending}>
            {isPending ? "Optimizing…" : "Optimize scenario"} <span aria-hidden="true">{isPending ? "◌" : "↗"}</span>
          </button>
        </div>
        {calculationState.message && <div className={`form-notice ${calculationState.kind === "error" ? "form-notice-error" : ""}`} role={calculationState.kind === "error" ? "alert" : "status"} aria-live="polite">
          <span>{calculationState.message}{calculationState.requestId && <small className="error-request-id">Request {calculationState.requestId}</small>}</span>
          {calculationState.kind === "error" && !hasErrors && <button type="button" className="retry-button" onClick={() => void runCalculation()}>Retry</button>}
        </div>}
        {result && <section className="result-panel" aria-labelledby="result-heading" aria-live="polite">
          <div className="result-title-row">
            <div><p className="eyebrow">Calculation response</p><h3 id="result-heading">{result.status === "optimal" ? "Recommended production" : "Minimum orders exceed resources"}</h3></div>
            {resultIsOutdated && <span className="outdated-badge">OUTDATED INPUTS</span>}
          </div>
          {result.status === "optimal" ? <>
            <div className="result-summary"><span>Total profit contribution</span><strong>{formatContribution(result.profit_contribution_aud)}</strong></div>
            <section className="result-block" aria-labelledby="production-results-heading">
              <h4 id="production-results-heading">Production plan</h4>
              <div className="table-scroll"><table className="result-table"><caption>Recommended production and demand-limit status</caption><thead><tr><th scope="col">Blend</th><th scope="col">Production</th><th scope="col">Demand limit</th><th scope="col">Contribution</th></tr></thead><tbody>
                {BLEND_IDS.map((blendId) => <tr key={blendId}>
                  <th scope="row">{BLEND_LABELS[blendId]}</th>
                  <td><span>{formatQuantity(result.production_litres[blendId], "L")}</span>{result.production_litres[blendId] > 0 && result.production_litres[blendId] < 0.001 && <small className="precision-detail">Exact: {formatPrecision(result.production_litres[blendId])} L</small>}</td>
                  <td>{result.reached_demand_caps.includes(blendId) ? <span className="result-flag">At demand cap</span> : "Below demand cap"}</td>
                  <td className={resultBlendContributions?.[blendId] !== undefined && resultBlendContributions[blendId] < 0 ? "negative-value" : ""}>{resultBlendContributions ? formatContribution(resultBlendContributions[blendId]) : "—"}</td>
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
              <div className="table-scroll"><table className="result-table"><caption>Contribution is input rate × returned quantity; rounded rows may not sum exactly to the total.</caption><thead><tr><th scope="col">Blend</th><th scope="col">Contribution</th><th scope="col">Production</th></tr></thead><tbody>
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
              <div className="table-scroll"><table className="result-table"><caption>Resource use, remaining capacity, and constraint status</caption><thead><tr><th scope="col">Resource</th><th scope="col">Used</th><th scope="col">Available</th><th scope="col">Remaining</th><th scope="col">Utilization</th><th scope="col">Status</th></tr></thead><tbody>
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
              <details className="precision-details"><summary>Unrounded calculation values</summary><div className="table-scroll"><table className="result-table"><caption>Full numeric values from the optimizer response and submitted input snapshot</caption><thead><tr><th scope="col">Measure</th><th scope="col">Unrounded value</th></tr></thead><tbody>
                <tr><th scope="row">Total contribution</th><td>{formatPrecision(result.profit_contribution_aud)} AUD</td></tr>
                {BLEND_IDS.map((blendId) => <Fragment key={blendId}><tr><th scope="row">{BLEND_LABELS[blendId]} production</th><td>{formatPrecision(result.production_litres[blendId])} L</td></tr>{resultBlendContributions && <tr><th scope="row">{BLEND_LABELS[blendId]} contribution</th><td>{formatPrecision(resultBlendContributions[blendId])} AUD</td></tr>}</Fragment>)}
                {result.resources.map((resource) => <Fragment key={resource.id}><tr><th scope="row">{resource.id} used</th><td>{formatPrecision(resource.used)} {resource.unit}</td></tr><tr><th scope="row">{resource.id} available</th><td>{formatPrecision(resource.available)} {resource.unit}</td></tr><tr><th scope="row">{resource.id} remaining</th><td>{formatPrecision(resource.remaining)} {resource.unit}</td></tr>{resource.utilization_percent !== null && <tr><th scope="row">{resource.id} utilization</th><td>{formatPrecision(resource.utilization_percent)}%</td></tr>}</Fragment>)}
                {result.numerical_residuals.map((item, index) => <tr key={`${item.constraint}-${index}`}><th scope="row">{item.constraint} residual</th><td>{formatPrecision(item.residual)} {item.unit}</td></tr>)}
              </tbody></table></div></details>
            </section>
          </> : <>
            <p className="shortage-intro">The minimum orders require more resources than are available. No production plan was returned.</p>
            <div className="table-scroll"><table className="result-table"><caption>Exact resource shortages for the submitted minimum orders</caption><thead><tr><th scope="col">Resource</th><th scope="col">Required</th><th scope="col">Available</th><th scope="col">Shortfall</th></tr></thead><tbody>{result.shortages.map((shortage) => {
              const unit = shortage.unit === "minutes" ? "min" : "L";
              const tiny = shortage.shortfall < 0.001;
              return <tr key={shortage.resource_id}><th scope="row">{shortage.resource_id === "processing" ? "Processing time" : `${INGREDIENT_LABELS[shortage.resource_id]} juice`}</th><td>{formatQuantity(shortage.required, unit)}</td><td>{formatQuantity(shortage.available, unit)}</td><td className="negative-value">{tiny ? <><span>&lt;0.001 {unit}</span><small className="precision-detail">Exact: {formatPrecision(shortage.shortfall)} {unit}</small></> : formatQuantity(shortage.shortfall, unit)}</td></tr>;
            })}</tbody></table></div>
          </>}
          <p className="request-reference">Request {result.request_id} <span>·</span> {result.duration_ms.toFixed(0)} ms</p>
        </section>}
      </form>

      <aside className="sidebar" aria-label="Model guide">
        <section className="guide-card">
          <div className="guide-icon" aria-hidden="true">✦</div>
          <p className="eyebrow">The planning model</p>
          <h2>Good plans<br />start with balance.</h2>
          <p>Production is planned for one day across three juice blends. Recipes stay fixed during a calculation and can be changed before the next one.</p>
          <div className="guide-divider" />
          <h3>What the plan considers</h3>
          <ul className="assumption-list">
            <li><span className="check-mark">✓</span><span>Ingredient supply is shared across blends.</span></li>
            <li><span className="check-mark">✓</span><span>Processing capacity is shared across the day.</span></li>
            <li><span className="check-mark">✓</span><span>Every litre of ingredients yields one litre of juice.</span></li>
            <li><span className="check-mark">✓</span><span>Production is continuous; fractional litres are possible.</span></li>
          </ul>
        </section>
        <section className="contribution-card">
          <span className="contribution-icon" aria-hidden="true">↗</span>
          <div><strong>Contribution ≠ net profit</strong><p>Contribution excludes costs outside the values entered here.</p></div>
        </section>
        <p className="sidebar-caption">Use this planner as a decision aid. Review the assumptions before acting on a recommendation.</p>
      </aside>
    </div>

    <footer className="footer"><span>PRODUCTION PLANNER</span><span>One day · Three blends · Fictional sample data</span></footer>
  </main>;
}
