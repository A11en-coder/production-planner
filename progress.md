# Production Planner — project progress

Last updated: 12 October 2026 (Australia/Sydney)

## Source of truth and status

- Product scope: [PRD v1.0](docs/Production_Planner_PRD.md), 11 October 2026, FR01–FR14 and NFR01–NFR09. The PRD prints “First draft for review”; [TRD v1.0](docs/Production_Planner_TRD.md#3-source-and-scope) records Allen's explicit approval of that scope.
- Technical design: [TRD v1.0](docs/Production_Planner_TRD.md), 11 October 2026, approved. Its architecture and release gates are specifications, not completed implementation evidence.
- Overall state: **Capabilities 1.1, 1.2, 2.1, 2.2, and 2.3 implemented, verified, approved, and committed**. Capability 2.4 is queued.
- Current phase: **Phase 2 — trusted optimization API**. Last completed capability: **2.3 LP construction and solver acceptance**. Next capability: **2.4 complete API contract and safe failures**, queued for approval.
- Calendar start date: **not assigned**. The TRD's weeks are relative; do not infer a calendar deadline.
- Budget: **180 planned hours**, 12 relative weeks × 15 hours. Capability 1.1 used approximately **1.1 wall-clock hours**, including its intentional 30-minute idle measurement; hands-on time was not separately clocked.
- Last approved capability: **2.3 LP construction and solver acceptance**, explicitly approved 12 October 2026. Capability checkpoint: `7a6d9a5`.

## Working rules for this tracker

Use one capability at a time. Before implementation, brief its role, dependencies, expected files, data flow, and completion criteria, then obtain approval. After implementation, verify, review, explain the actual code, obtain completion approval, commit, and update this file with evidence and the commit. A checkbox means complete only after those steps. Keep unverified hosting, timing, device, and release claims marked pending.

Record actual hours against the phase's allocation. A material change to product scope, architecture, security, cost, or acceptance targets needs an explicit decision before dependent work. If the ten-hour hosting spike cannot prove feasibility, record the failing dimension and budget impact and return to Allen for a hosting/design decision ([TRD §18](docs/Production_Planner_TRD.md#18-implementation-plan)).

## Roadmap and capability checklist

The phases retain the TRD's 180-hour allocation. Capability boundaries below make each result independently reviewable; their order follows the API contract, frontend workflow, browser persistence, and public acceptance dependencies. Tests listed with a capability are its local completion evidence; final T01–T18 and G01–G06 gates still apply to the assembled app.

### Phase 1 — feasibility and foundations (week 1; 15 hours)

- [x] **1.1 Hosting/Python API spike — maximum 10 hours.** G01 passed in approximately 1.1 wall-clock hours. The public Hobby preview pair returned the PRD baseline, edited sample, all four exact shortages, safe validation and timeout errors, and exact paired CORS. Final preview click-to-render: 3484.6 ms after ≥30 minutes idle, 581.3 ms warm, 756.2–2844.0 ms in five concurrent sessions, 539.7 ms for the edited sample. Evidence and unresolved risks: [hosting spike record](docs/hosting-spike-evidence.md). Final T14 remains later work. Commit: `a9c44b1`. [TRD §§16, 18](docs/Production_Planner_TRD.md#16-deployment-and-rollout)
- [x] **1.2 Repository/API foundations.** Added [README.md](README.md) with reproducible local API/web startup and check commands, runtime versus development dependency guidance, project map, model limits, and API/fixture contract notes. Confirmed the existing fixture-driven API foundation without duplicating spike code. Dependency: 1.1 passed. Evidence: 9 backend tests passed; frontend typecheck/build passed; local Uvicorn and Next.js startup plus health, baseline optimize (AUD 219.3333), and frontend HTTP 200 smoke checks passed. No API runtime changes. Relevant design: [TRD §§8, 10](docs/Production_Planner_TRD.md#8-repository-and-configuration); **NFR08**. Owner approved completion 12 October 2026. Commit: `f3640bb`.

### Phase 2 — trusted optimization API (weeks 2–3; 30 hours)

- [x] **2.1 Input schema and validation.** Backend validates fixed blend IDs and exact object keys, ASCII decimal-string syntax and each field's precision/range, exact 10,000-basis-point recipes, excluded ingredients, minimum/maximum consistency, and the 16 KiB streamed request limit. Errors aggregate without echoing submitted values. Corrected the TRD-defined omitted-minimum default to zero and continued collecting fields on invalid-ID rows. Public request/response unchanged. Dependency: 1.2. Evidence: 46 backend tests pass, including exact-size and one-byte-over streaming cases. **T02; validation portion of T04; FR03, NFR03, NFR05.** Commit: `4eb1fa2`.
- [x] **2.2 Exact minimum-order shortage check.** The optimizer computes required orange, apple, pineapple, and processing use from entered Decimal values before solver conversion; reports every positive shortfall with units and no plan. Dependency: 2.1. Evidence: 48 backend tests pass, including all four shortages, a `1e-7` positive shortfall (solver not called), and equality at capacity (feasible). **FR12.** Checkpoint `63b2fbe`.
- [x] **2.3 LP construction and solver acceptance.** Existing optimizer builds the three-variable bounded model; calls SciPy `linprog(method="highs")` with the one-second limit; accepts only optimal status with finite values and independent order/resource checks at the TRD tolerance; recomputes profit and usage from unrounded quantities. Dependency: 2.1–2.2. Evidence: 65 backend tests pass, including the independent baseline certificate, edited orange sample (existing test), zero-demand/capacity and zero-processing cases, negative-profit cases, nonoptimal statuses, nonfinite quantities, and order/resource residuals inside and outside `1e-6`. **T03/T05; FR04, NFR03.** Test checkpoint `7a6d9a5`.
- [ ] **2.4 Complete API contract and safe failures.** Implement `/api/v1/optimize`, `/health`, typed optimal/infeasible/error envelopes, version checks, CORS, request IDs, and redacted metadata logs. Dependency: 2.1–2.3. Evidence: T04/T05 and API portions of T13/T16; **G02** API checks. **FR13, NFR04–NFR05, NFR08.**

### Phase 3 — public planner interface (weeks 4–6; 45 hours)

- [ ] **3.1 Sample dashboard and editable inputs.** Create the single dark dashboard with fictional fixture, intro/assumptions, responsive form, labels/units, frontend validation, and fixed three-blend model. No automatic save. Dependency: stable contract fixture/API. Evidence: T01/T02/T07. **FR01–FR03, FR06, FR14.**
- [ ] **3.2 Calculation controller and freshness.** Post canonical inputs to the real API, validate response versions/shapes, track input revision and active request ID, discard obsolete responses, handle the ten-second browser deadline, preserve inputs, and provide manual Retry. Dependency: 3.1 and 2.4. Evidence: T06/T13. **FR09, FR13, NFR04.**
- [ ] **3.3 Results and explanation.** Show unrounded-backed quantities, contribution, resource used/remaining, binding/demand flags, tables plus matching simple charts; handle zero, negative, infeasible, and small residual displays without mislabelling a result. Dependency: 3.2. Evidence: T03/T05/T07 and chart accessibility portion of T12. **FR05–FR06, FR12.**

### Phase 4 — saved scenarios and comparison (weeks 7–8; 30 hours)

- [ ] **4.1 Versioned local collection and recovery.** Save/reopen valid inputs with optional current result; enforce schema/model compatibility and result snapshot; preserve corrupt/unsupported bytes and usable in-memory work on storage failure. Dependency: 3.2–3.3. Evidence: T08/T09. **FR07, FR09, FR11, NFR06.**
- [ ] **4.2 Explicit management and concurrent writes.** Implement name trim/case uniqueness, 1–50 characters, 20-entry limit, explicit update/rename/delete and confirmations; guard writes with Web Lock plus collection revision and handle storage events. Dependency: 4.1. Evidence: T08/T10, including two-tab conflict and unavailable-lock cases. **FR08, FR11.**
- [ ] **4.3 Saved comparison.** Select two distinct current, compatible optimal saved results; display input and result values with unrounded **B minus A** deltas, units, and mobile-readable tables/charts. Dependency: 4.1–4.2. Evidence: T11/T12. **FR10, FR14.**

### Phase 5 — system verification (weeks 9–10; 30 hours)

- [ ] **5.1 Automated cross-layer checks.** Run pytest, frontend lint/type/build, Vitest/React Testing Library, contract fixtures, and Playwright local integration in GitHub Actions using pinned dependencies. Cover failure preservation and all PRD flows. Dependency: Phases 2–4. Evidence: T01–T13 and **G02/G03** results. **NFR08.**
- [ ] **5.2 Accessibility and browser matrix.** Verify Chromium, Firefox, and WebKit at 360/768/1280 widths, keyboard/focus/field errors/status/contrast/zoom/reflow and chart-equivalent tables. Record actual real-device coverage separately. Dependency: complete UI. Evidence: T12. **FR14, NFR07.**
- [ ] **5.3 Public safeguards, speed, and first-time use.** Check exact CORS and public previews, body/schema/solver limits, deployed 30 POST/IP/60-second WAF rule, secrets/logging, and free-plan usage. Record browser click-to-render T14 measurements (20 individual, three batches of five concurrent, three first-after-inactivity) and time a first-time reviewer through the full flow at ≤2 minutes. Dependency: complete paired preview. Evidence: T14–T16 and **G04/G05**. **NFR01–NFR02, NFR05–NFR06, NFR09.**

### Phase 6 — public release and recovery (week 11; 15 hours)

- [ ] **6.1 Portfolio documentation and release candidate.** Publish setup, model/units/assumptions/limitations, local-storage scope, test commands, evidence, configuration and known limits in README and repository. Confirm public GitHub repository and passing CI. Dependency: Phase 5. Evidence: PRD release checklist and **G06** candidate record. **NFR08–NFR09.**
- [ ] **6.2 Paired production release and rollback rehearsal.** Release backend before frontend, verify old-frontend compatibility, then run public sample/edit/save/compare/reload smoke. Record deployment IDs, effective origins, versions, firewall settings, benchmark pair, and restore steps. Rehearse rollback without clearing browser data. Dependency: 6.1 and G01–G05. Evidence: T17/T18 and **G06**. **FR01–FR14, NFR09.**

### Phase 7 — contingency and acceptance (week 12; 15 hours)

- [ ] **7.1 Acceptance fixes and honest portfolio evidence.** Resolve outstanding P0 failures, rerun affected checks, document screenshots or a short reviewer walkthrough, reconcile actual hours, and record limitations. Reserve time is not authority for new features. Dependency: release evidence. Evidence: all FR01–FR14, NFR01–NFR09, T01–T18, and G01–G06 pass or an owner-approved change is recorded.

## Completed capability record: 1.1 hosting/Python API spike

**Purpose and outcome:** Establish that the approved free-host Next.js → FastAPI → SciPy path can serve a correct optimization result within the required public timing scope before the dashboard depends on it. G01 passed on the Hobby preview pair; the complete evidence is in [hosting-spike-evidence.md](docs/hosting-spike-evidence.md).

**Implemented request path:** [frontend `Home.calculate()`](frontend/src/app/page.tsx) posts the fixed sample → [FastAPI `calculate()`](backend/app/main.py) enforces transport limits and calls [validation](backend/app/validation.py) → [optimizer](backend/app/optimizer.py) reports exact minimum shortages or runs HiGHS and checks the plan → the harness validates the response and renders it. `/health` reports build/API/model identity but is not solver proof.

**Completion evidence:** previews `production-planner-api-spike-20261012` and `production-planner-web-spike-20261012`; Python 3.12 and pinned dependencies; baseline/edit/shortage results; invalid-input and solver-timeout handling; exact paired CORS; warm, concurrent, and after-inactivity browser timings; explicit owner approval; checkpoint `a9c44b1`. The exact uncompressed function bundle size was not exposed. Final performance acceptance waits for T14 on the complete UI.

## Completed capability record: 1.2 repository/API foundations

**Purpose and outcome:** Make the existing spike repository and API contract reproducible and understandable for the next implementation capabilities. Added [README.md](README.md); the API and frontend implementation were already established in 1.1, so this capability did not duplicate or restructure them.

**Documented request path:** [frontend `Home.calculate()`](frontend/src/app/page.tsx) posts JSON to [FastAPI `calculate()`](backend/app/main.py), which applies transport/version checks, calls [validation](backend/app/validation.py), and passes valid models to [the optimizer](backend/app/optimizer.py). The UI checks response compatibility before rendering. [The sample fixture](contracts/sample-request.json) is shared with backend tests.

**Completion evidence:** 9 backend tests passed; `npm run typecheck` and `npm run build` passed; local API and Next.js development servers started from the documented commands, `/health` returned ready, the fixture returned an optimal AUD 219.3333 baseline, and the frontend returned HTTP 200. One existing Starlette/AnyIO deprecation warning remains. Owner explicitly approved the walkthrough and completion on 12 October 2026; checkpoint `f3640bb`.

## Completed capability record: 2.1 input schema and validation

**Purpose and outcome:** Enforce the approved API input rules before optimization while preserving the public request and response format. [Validation](backend/app/validation.py) now canonicalizes negative zero, accepts ASCII-only decimal syntax, implements the documented optional zero minimum, validates recipes as integer basis points, and gathers independent errors even when an ID is invalid. [The optimizer](backend/app/optimizer.py) converts basis points back to exact Decimal ingredient coefficients before solver conversion.

**Representative path:** `main.calculate()` enforces media type and checks both declared and streamed body length, parses JSON, then invokes `validate_inputs()`. On success it calls `optimize()` with validated Decimal bounds and basis-point recipes. A validation failure returns field paths and generic messages without submitted values; the solver is not called.

**Completion evidence:** 46 backend tests passed, covering numeric syntax/types/ranges/precision, recipe totals and exclusions, fixed IDs and exact keys, optional minimum and min/max consistency, error aggregation/redaction, and 16 KiB streamed-body boundary behavior. The established Starlette/AnyIO deprecation warning remains. No meaningful runtime optimization is justified for this three-blend, 4×3 model; the basis-point conversion follows the TRD’s exact recipe representation. Owner approved on 12 October 2026; implementation checkpoint `4eb1fa2`.

## Completed capability record: 2.2 exact minimum-order shortage check

**Purpose and outcome:** Return all infeasible minimum-order resource requirements before invoking the floating-point solver. [The optimizer](backend/app/optimizer.py) derives ingredient proportions from validated basis points and uses `Decimal` for minimum resource requirements; it returns every strictly positive shortage with the resource unit and no plan.

**Representative path:** `main.calculate()` passes validated models to `optimize()`. The optimizer computes all four minimum-use amounts using Decimal arithmetic, compares them with entered Decimal capacities, and returns the complete infeasible envelope immediately when any resource is short. HiGHS receives no call in that path. A capacity equal to minimum use remains feasible.

**Completion evidence:** 48 backend tests passed. The expanded all-resource test checks required/available/shortfall values and units; focused tests preserve a `1e-7` positive shortage and prove the solver is skipped, and confirm equality at capacity is feasible. Existing Starlette/AnyIO deprecation warning remains. Owner approved on 12 October 2026; test checkpoint `63b2fbe`.

## Completed capability record: 2.3 LP construction and solver acceptance

**Purpose and outcome:** Verify the bounded continuous three-blend optimization contract against independent model calculations and hostile solver outputs. The existing [optimizer](backend/app/optimizer.py) required no production-code changes: it calls SciPy HiGHS with a one-second limit, accepts only status 0 with finite quantities, checks lower/upper bounds and every resource independently at the TRD's `1e-6` tolerance, reports accepted positive residuals, and recomputes contribution/resource usage from unrounded solver quantities.

**Representative path:** Validated Decimal coefficients/minima/capacities become bounded floating-point LP inputs only after the exact shortage precheck. HiGHS returns a candidate; status and finite-value checks gate it; independent checks prevent an invalid candidate from becoming a plan; only then are contribution, resource usage, remaining capacities, and result metadata calculated.

**Completion evidence:** Added [optimizer contract tests](backend/tests/test_optimizer.py). The complete backend suite passed: 65 tests, including independently recomputed baseline profit/resource usage, zero demand/capacity, zero processing coefficients, negative-contribution cases, HiGHS/time-limit configuration, nonoptimal statuses, NaN/Infinity, and bound/resource residuals inside and outside tolerance. Existing Starlette/AnyIO deprecation warning remains. `git diff --check` passed. Owner approved on 12 October 2026; test checkpoint `7a6d9a5`.

## Decisions, dependencies, and open risks

| Item | Current record |
| --- | --- |
| Architecture | Approved ADR01–ADR08 in [TRD §19](docs/Production_Planner_TRD.md#19-risks-and-decisions): separate Next.js/FastAPI projects, SciPy HiGHS, browser-local versioned collection, conditional two-project Vercel Hobby hosting, numeric/failure policies, manual release, and verification matrix. |
| Hosting feasibility | **G01 passed.** Hobby account and displayed usage were confirmed; the SciPy API deployed and all final-pair browser timings were under five seconds. Exact uncompressed bundle size is unavailable. One earlier browser `Failed to fetch` did not recur in the final eight accepted calls; its cause remains unknown and must stay visible in later T13/T14 evidence. |
| Repository and calendar | Public repository URL and calendar start date are not recorded. Local commits establish implementation checkpoints; publish URL only when the repository is actually published. |
| Package versions and devices | Exact tested versions and real-device availability remain to be recorded during implementation. |
| Scope boundary | Three blends, three ingredients, one day, continuous litres, no waste, free services; no accounts, cloud storage, arbitrary products, integer bottles, exports, or other excluded extensions. |
| Performance | **G01 spike evidence passed**: idle 3484.6 ms; warm 581.3 ms; five concurrent 756.2–2844.0 ms. Final T14 requires the full set of 20 warm, three concurrent batches, and three after-inactivity calls on the completed dashboard. |
| Release | G01 passed. G02–G06 and T01–T18 remain pending. Public preview is not a production release; deployed WAF rate rule, full browser matrix, reviewer timing, and rollback are not verified. |

## Evidence and checkpoint log

| Date | Capability or gate | Result and evidence location | Actual hours | Commit |
| --- | --- | --- | ---: | --- |
| 12 Oct 2026 | Planning intake | PRD/TRD read; repository inventory found planning documents only. No application checks or deployment claimed. | Not recorded | None |
| 12 Oct 2026 | Capability 1.1 / G01 | Passed; owner approved; browser/API evidence in [hosting-spike-evidence.md](docs/hosting-spike-evidence.md). Progress tracking recorded in this commit. | ~1.1 elapsed hours (includes 30-min idle wait) | `a9c44b1` |
| 12 Oct 2026 | Capability 1.2 / repository/API foundations | Owner approved; README setup and contract documentation; 9 backend tests, frontend typecheck/build, and local API/web startup smoke passed. | Not separately tracked | `f3640bb` |
| 12 Oct 2026 | Capability 2.1 / input schema and validation | Owner approved; 46 backend tests pass; exact recipe basis points, field rules, optional minimum, aggregated errors, and streamed-body boundary verified. | Not separately tracked | `4eb1fa2` |
| 12 Oct 2026 | Capability 2.2 / exact minimum-order shortage check | Owner approved; 48 backend tests pass; all four resources, tiny positive shortfall, solver bypass, and capacity equality verified. | Not separately tracked | `63b2fbe` |
| 12 Oct 2026 | Capability 2.3 / LP construction and solver acceptance | Owner approved; 65 backend tests pass; independent objective/resource certificate, edge cases, status/finite checks, and order/resource tolerance boundaries verified. Existing optimizer required no production changes. | Not separately tracked | `7a6d9a5` |

When closing a capability, add its check results, relevant PRD/TRD IDs, approval/decision, actual hours, and Git commit here; then advance the current phase/capability above. Keep failures and unresolved risks visible rather than checking a gate based on intent.
