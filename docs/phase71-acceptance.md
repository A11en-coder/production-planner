# Phase 7.1 — acceptance and portfolio closeout

Record updated 13 October 2026 (Australia/Sydney). This matrix checks the approved [PRD](Production_Planner_PRD.md) and [TRD](Production_Planner_TRD.md) against the committed code, automated checks, public Preview measurements, and Phase 6.2 Production evidence. It does not add requirements or claim tests that were not run.

## Release snapshot

- GitHub Actions [Checks #3](https://github.com/A11en-coder/production-planner/actions/runs/38269613193) passed for `59a4d5a` on `master`: backend and frontend/browser jobs succeeded; Vitest reported 19 passing tests and Playwright reported 12 passing Chromium/WebKit tests. The run took 2m 41s.
- Production is live at [the web alias](https://production-planner-web-tan.vercel.app) and [API health endpoint](https://production-planner-api.vercel.app/health). API-first release, public workflow smoke, rollback, and limitations are in [Phase 6.2 evidence](phase62-evidence.md).
- The Production app source was deployed from `a782db60499508c98fbf48a10316a624882186e5`. A Git comparison from that source through `59a4d5a` shows no changes under `backend/` or `frontend/`; later commits changed documentation only.
- “Pass” means evidence is recorded for the stated scope. “Approved exception” and “unverified” are not presented as test passes.

## Product requirements

| Requirement | Status | Evidence and limits |
| --- | --- | --- |
| FR01 sample planner | Pass | Preloaded fictional sample and public Production calculation; T01 and core workflow checks. See [progress](../progress.md) and [Phase 6.2 evidence](phase62-evidence.md). |
| FR02 editable scenarios | Pass | Editable model inputs, stale-result handling, and real API recalculation; 3.1–3.3 evidence and Playwright workflow. |
| FR03 input validation | Pass | Frontend and backend validation, numeric bounds, recipe rules, redacted field errors; T02/T04 backend and frontend tests. |
| FR04 optimal plan | Pass | HiGHS status and feasibility checks plus independently recomputed baseline objective/resource certificate; T03/T05. |
| FR05 results and charts | Pass | Production, contribution, and resource tables with accessible chart equivalents; 3.3 and T07/T12 checks. |
| FR06 assumptions and result meaning | Pass | Dashboard model guide and README describe assumptions and contribution terminology; zero/negative contribution cases covered. |
| FR07 save/reopen | Pass | Versioned same-origin browser storage with explicit save/open and reload checks; 4.1, T08/T09. |
| FR08 saved scenario management | Pass | Explicit rename/update/delete, capacity and naming checks; 4.2 and T08/T10. |
| FR09 result freshness | Pass | Input revision and saved result snapshot/model checks; 3.2, 4.1 and T06/T09. |
| FR10 comparison | Pass | Two current compatible results, unrounded B-minus-A values, and accessible tables; 4.3, T11, and Production smoke. |
| FR11 storage failure handling | Pass | Failed or unavailable saves preserve the working session and offer retry; 4.1 and T09. |
| FR12 infeasible minimum orders | Pass | All shortages are returned without a plan; exact/tiny-shortage tests and Production infeasible smoke. |
| FR13 calculation failures | Pass | Typed safe API errors, request IDs, preserved inputs, and retry; 2.4, 3.2, T04/T06/T13. |
| FR14 responsive interaction | Pass in the approved matrix | Chromium and WebKit at 360/768/1280 CSS pixels, keyboard/focus/errors/status/contrast and table equivalents passed. Firefox was explicitly deferred; physical-device and screen-reader checks were not run. |

## Non-functional requirements

| Requirement | Status | Evidence and limits |
| --- | --- | --- |
| NFR01 calculation display within 5 seconds | Pass on public Preview candidate; Production matrix not repeated | T14 recorded 38/38 Preview browser click-to-render measurements under 5 seconds. Production received calculation smoke tests with browser-reported request durations of 0–28 ms; those are not render timings or a full Production T14 matrix. |
| NFR02 first-time workflow within 2 minutes | Pass by owner-confirmed test | A new reviewer completed the sample/save/edit/save/compare flow in under one minute. The exact reviewer device/browser and assistance were not recorded. |
| NFR03 units and numerical correctness | Pass | Independent objective/resource checks, capacity conversions, shortage cases, and numerical tolerance tests; T03/T05. |
| NFR04 preserve inputs and response freshness | Pass | Delayed/obsolete response, abort, timeout, error, and retry checks; T06/T13. |
| NFR05 validation, transport, privacy and endpoint safeguards | Pass with accepted Production rate-limit exception | Exact environment CORS, bounded JSON, independent validation, safe logs, no browser secret, and Preview rate rule are recorded. Production has no custom Vercel rate-limit rule because the Hobby dashboard required a Pro upgrade; the owner accepted this gap. |
| NFR06 browser-local scenario storage | Pass | README and UI state that scenarios remain in same-origin browser storage, without accounts, cloud backup, or API persistence. |
| NFR07 accessibility and responsive presentation | Pass in the owner-approved browser scope | Automated axe, keyboard, labels/errors/status, contrast, zoom-equivalent reflow, and chart-equivalent tables passed in Chromium/WebKit. Firefox was deferred; physical-device and screen-reader checks remain unverified. |
| NFR08 maintainability and reproducible checks | Pass | Project structure, setup/test instructions, pinned dependencies, and GitHub Actions Checks #3 passed. |
| NFR09 public demonstration availability | Pass | Both Production aliases are live; Preview remains separate. No commercial uptime or scale guarantee is claimed. |

## TRD tests

| Test | Status | Evidence and limits |
| --- | --- | --- |
| T01 sample fixture | Pass | Backend fixture tests and Production baseline passed. `frontend/src/app/page.tsx` initializes from `SAMPLE_INPUTS` and reads the saved collection on load; it does not clear the collection when the sample opens. Saved scenarios also survived the tested reload/rollback. |
| T02 input validation | Pass | Frontend and backend syntax, precision, range, recipe, exclusion, and min/max checks. |
| T03 model correctness | Pass | Independent baseline certificate, edited scenario, resource checks, negative contributions, minimum bounds, and shortages. |
| T04 API contract | Pass | Optimal/infeasible/error shapes, version, transport, size and redaction tests. |
| T05 solver and plan checks | Pass | Nonoptimal statuses, nonfinite solver values, and order/resource tolerance boundaries tested. |
| T06 freshness and timeout | Pass | Request identity/revision, obsolete response, abort, 10-second deadline, retry and input-preservation checks. |
| T07 core workflow | Pass | Core workflow Playwright coverage and Production baseline/edit/infeasible checks. |
| T08 saved management | Pass | Save/reopen/rename/update/delete/capacity and reload workflow checks. |
| T09 recovery and versions | Pass | Storage errors, corrupt/unsupported data, compatibility and explicit recovery checks. |
| T10 concurrency | Pass | Two-tab storage refresh and stale revision rejection were verified during 4.2. |
| T11 comparison | Pass | Distinct current saved scenarios and unrounded B-minus-A values checked in tests and Production smoke. |
| T12 accessibility and browsers | Pass in approved scope; deferred coverage recorded | Chromium/WebKit at target widths passed. Firefox was explicitly deferred. No physical device or screen-reader run. |
| T13 calculation failures | Pass for exercised cases | Forced API failure/retry, malformed responses, timeout, CORS and safe backend errors covered; ordinary CI does not exercise a real provider outage. |
| T14 deployed performance | Pass on Preview release candidate | 20 warm, 15 concurrent-session, and 3 after-inactivity browser runs passed: 38/38 under 5 seconds. A full matrix was not repeated against Production. |
| T15 reviewer usability | Pass by owner-confirmed first-time review | New reviewer completed the required flow in under one minute. Device/browser and assistance were unspecified. |
| T16 security and privacy | Pass with accepted Production rate-limit exception | Preview rate rule, exact CORS, body/schema limits, redacted logs, no client secret and repository scans are documented. Production custom rate limiting remains absent by owner-approved Hobby-plan choice. Development/test dependency advisories remain documented for maintenance. |
| T17 release smoke | Pass for deployed pair; mixed-version detail not applicable to prior Production state | API deployed before web and the pair passed public sample/edit/save/compare/reload and identity checks. There was no earlier successful Production frontend to serve during the backend-first deployment, so a mixed-version Production run was unavailable. |
| T18 rollback rehearsal | Pass with stated platform limit | Both aliases rolled back from an identical second pair to the first; browser collection and baseline calculation survived. There was no prior Production deployment to restore to a no-service state. |

## TRD release gates

| Gate | Status | Basis |
| --- | --- | --- |
| G01 hosting feasibility | Pass | Public Preview solver bundle, correctness, paired CORS and after-inactivity timing evidence; see [hosting spike evidence](hosting-spike-evidence.md). |
| G02 correctness and contract | Pass | Backend/frontend tests and successful Checks #3. |
| G03 complete product workflow | Pass | Automated workflow tests plus public Production sample, edit, save, compare, reload and infeasible smoke. |
| G04 public safeguards and usability | Pass with owner-approved exceptions | Public protections and first-time review passed; Production rate rule is absent by accepted Hobby-plan decision; browser/device scope is limited as above. |
| G05 performance and recovery | Pass for recorded candidate evidence, with Production benchmark limit | T14 passed on Preview; rollback pair rehearsal passed. The full T14 matrix was not repeated in Production, and the production rate rule gap is accepted. |
| G06 Production verification | Pass | API-first Production release, public smoke, live repository/README, and restored alias pair are recorded. |

## Open limitations and maintenance

- The Production calculation endpoint has no Vercel custom rate-limit rule under the current Hobby plan. The owner explicitly accepted this safeguard gap for the release; no plan upgrade or workaround was used.
- Firefox was explicitly deferred. Physical-device and screen-reader verification remain unperformed.
- T14 measurements used the public Preview pair. Production smoke passed, but the full 38-measurement browser matrix was not repeated against the Production pair.
- T17's mixed-version Production case could not be exercised because no Production frontend existed before the first release. The newly deployed pair passed smoke checks.
- The prior audit records Starlette API advisories reviewed as not reachable in this application and a pytest temporary-directory advisory in the test environment; a development-only ESLint transitive advisory was also reported. These versions were not changed in Phase 7.1; dependency maintenance remains separate.
- Historical per-capability hours were generally not recorded. No retrospective project-hours total is claimed; Capability 1.1's recorded elapsed time remains the only measured phase entry.

## Closeout checks

No P0 application defect is indicated by the accepted test evidence and Production smoke checks reviewed here. GitHub Actions Checks #3 passed; application code under `backend/` and `frontend/` matches the deployed source checkpoint. This closeout updates documentation only; it does not repeat the full live performance matrix. `git diff --check` passed after the documentation changes.
