"use client";

import { useMemo, useState, type FormEvent } from "react";
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
  const [notice, setNotice] = useState("");
  const errors = useMemo(() => validateInputs(inputs), [inputs]);
  const hasErrors = Object.keys(errors).length > 0;

  function updateBlend(blendId: BlendId, field: "profit_aud_per_litre" | "processing_minutes_per_litre" | "min_litres" | "max_litres", value: string) {
    setInputs((current) => ({
      ...current,
      blends: current.blends.map((blend) => blend.id === blendId ? { ...blend, [field]: value } : blend),
    }));
    setNotice("");
  }

  function updateRecipe(blendId: BlendId, ingredient: IngredientId, value: string) {
    setInputs((current) => ({
      ...current,
      blends: current.blends.map((blend) => blend.id === blendId
        ? { ...blend, recipe_percent: { ...blend.recipe_percent, [ingredient]: value } }
        : blend),
    }));
    setNotice("");
  }

  function updateAvailability(ingredient: IngredientId, value: string) {
    setInputs((current) => ({
      ...current,
      available_ingredient_litres: { ...current.available_ingredient_litres, [ingredient]: value },
    }));
    setNotice("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors) {
      setNotice("Review the highlighted fields before continuing.");
      return;
    }
    setNotice("Inputs are valid. The calculation service is not connected yet.");
  }

  function resetSample() {
    setInputs(structuredClone(SAMPLE_INPUTS));
    setSubmitted(false);
    setNotice("");
  }

  function fieldError(path: string) {
    return submitted ? errors[path] : undefined;
  }

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
              onChange={(value) => { setInputs((current) => ({ ...current, processing_capacity_hours: value })); setNotice(""); }}
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
          <button className="primary-button" type="submit">Optimize scenario <span aria-hidden="true">↗</span></button>
        </div>
        {notice && <p className={hasErrors ? "form-notice form-notice-error" : "form-notice"} role="status">{notice}</p>}
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
