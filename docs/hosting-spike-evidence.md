# Capability 1.1 — hosting and Python API feasibility evidence

Status: **approved and committed**. Allen approved Capability 1.1 on 12 October 2026; implementation checkpoint `a9c44b1`. Recorded 12 October 2026 (Australia/Sydney). This is evidence for the capped G01 investigation, not final T14 performance acceptance.

## Question and approved target

Can two free Vercel Hobby projects host a Next.js browser harness and a separate Python 3.12 FastAPI/SciPy HiGHS service, return the approved plan and all minimum-order shortages, permit exact paired CORS, and render an accepted browser result within five seconds, including a first request after inactivity? The spike is capped at 10 hours ([TRD §18](Production_Planner_TRD.md#18-implementation-plan)).

## Deployment pair and build facts

| Item | Preview record |
| --- | --- |
| Vercel account/team | `pche0414-2053` / `team_FsTdUIDDeg2JiPY6TTNC650M`; Allen confirmed on 12 October 2026 that this team is on **Hobby** and Function usage is within quota. The signed-in Vercel Usage page also showed “Upgrade to Pro” and, for its displayed last-30-days period, **10,875 / 1,000,000** Function invocations, **2.4 / 360 GB-hours** Fluid provisioned memory, and **23m 7s / 4h** Fluid active CPU. Its data was marked about 31 minutes old when read at 00:54 UTC. No paid resource was selected. |
| Backend project | `production-planner-api` / `prj_dLdEzhgjk1G20hdBCpTAEuKcmUb3`; root directory `backend`, framework `fastapi`, Node setting `24.x`, Python `.python-version` `3.12`. |
| Frontend project | `production-planner-web` / `prj_xJDBCEzy5MsVfxrCAvEs5nXzqkJ2`; root directory `frontend`, framework `nextjs`, Node setting `24.x`. |
| Backend public alias | <https://production-planner-api-spike-20261012.vercel.app> |
| Frontend public alias | <https://production-planner-web-spike-20261012.vercel.app> |
| Current backend preview | `dpl_5Sw3E9qUAPv5Gq2oTxUCSCz5hbkZ` (`READY`); `/health` returned this exact deployment ID on the public alias. |
| Current frontend preview | `dpl_FWraEEpkJ9eagAhKBrYfjaKaiDBo` (`READY`); public alias returned the feasibility harness. |
| Origin pairing | Preview backend `ALLOWED_ORIGINS` is the exact frontend alias; frontend `NEXT_PUBLIC_BACKEND_URL` is the exact backend alias. Browser preflight and actual POST were observed to work. |
| Protection | Vercel Authentication disabled for these dedicated public demo projects, as required for the anonymous cross-origin preview. |
| Build/runtime | Backend build log: Python 3.12, uv 0.10.11, dependency install and Python bundle optimization completed in 19 seconds. Build cache upload was 55.79 MB; this is **not** a measured function bundle size. Frontend build detected Next.js 16.4.0 and completed. |
| Dependency pins | Backend `requirements.txt` pins FastAPI 0.117.1, SciPy 1.16.3 and their production transitive dependencies. Frontend `package-lock.json` pins Next.js 16.4.0, React 19.2.0 and the TypeScript toolchain. Local machine had Node 24.16.0 and Python 3.13.9; hosted backend uses the TRD's Python 3.12. |

The API deployment endpoint treated the first deployment of each newly created project as `production` despite a preview request. Both initial builds were canceled before becoming live (`dpl_2JA4h86pksNnJgu6zcw8Hexp86MA` and `dpl_2qy9fk32RoUByLJFFXenPmrVTDFd`). Subsequent deployments omitted `target` and returned `target: null`, the API's preview state. This is a deployment workflow finding to retain for later releases.

## Correctness, validation, and CORS evidence

Local checks: `backend/.venv/Scripts/python.exe -m pytest -q` passed **9 tests** (one third-party Starlette/anyio deprecation warning). `npm run build` passed after the latest frontend edit. Local test coverage includes the PRD baseline, orange-reduced fixture, all four shortages, invalid fields, body/media limits, model version, allowed and rejected CORS origins, malformed IDs, signed decimal syntax, the response duration, and safe solver-timeout handling.

Public preview check: `backend/tests/preview_smoke.py` returned preflight 200 with the allowed frontend origin; actual POST carried the same CORS allow-origin header. It observed baseline contribution **AUD 219.33333333333334**, orange-reduced **AUD 211.00000000000003**, all four exact expected shortages (required 9/12/9 L and 70 minutes; shortfalls 8/11/8 L and 70 minutes), 422 for excess recipe precision, and a nonnegative backend `duration_ms`. The final public smoke run after browser timing measured API round trips of **257.5 ms** baseline, **252.3 ms** orange-reduced, and **267.8 ms** shortages; these are not click-to-render timings. The public `/health` response identified deployment `dpl_5Sw3E9qUAPv5Gq2oTxUCSCz5hbkZ`. Vercel runtime logs correlated the four smoke request IDs before the idle test with that deployment, Python 3.12 in `syd1`, and metadata-only calculation logs; no submitted input values appeared in those entries. All four had process instance marker `4477e7b413b348b4b48a50ca37d49fb6` for later comparison.

The browser rendered the fictional baseline at **AUD 219.33**, with 50.000 L orange–apple, 20.000 L apple–pineapple and 33.333 L tropical. The edited 30 L orange fixture rendered **AUD 211.00**, with 25.000 L, 20.000 L and 50.000 L respectively. Both were read from the public frontend alias after an actual browser POST to the API alias.

## Browser timing observations

Environment observed: Codex in-app browser on Windows, normal unthrottled session; user timezone Australia/Sydney. Connection type and physical network location were not measured. Backend log reports region `syd1` for the observed request. The browser harness records `performance.now()` from Optimize click through a double `requestAnimationFrame` after the result component renders. This is a practical spike measure, not the final dashboard's T14 benchmark method.

Exploratory measurements on earlier preview revisions (exact click timestamps were not captured):

| Observation | Click-to-render |
| --- | ---: |
| First sample on the initial paired preview, before any intentional API health probe | 913.9 ms |
| Orange-reduced sample after a manual retry | 919.5 ms |
| Orange-reduced sample on revised frontend preview | 515.1 ms |
| Five browser sessions started together, session 1 | 605.2 ms |
| Session 2 | 2550.1 ms |
| Session 3 | 2861.3 ms |
| Session 4 | 594.0 ms |
| Session 5 | 572.6 ms |

Final paired preview measurements on backend `dpl_5Sw3E9qUAPv5Gq2oTxUCSCz5hbkZ` and frontend `dpl_FWraEEpkJ9eagAhKBrYfjaKaiDBo` (UTC timestamps are matching API log entries):

| Observation | UTC API log time | Click-to-render |
| --- | --- | ---: |
| First baseline after inactivity | 00:56:49.315 | **3484.6 ms** |
| Warm baseline | 00:57:11.832 | 581.3 ms |
| Five concurrent sessions, 1 | 00:57:34.065 | 756.2 ms |
| Session 2 | 00:57:35.952 | 2680.2 ms |
| Session 3 | 00:57:36.139 | 2844.0 ms |
| Session 4 | 00:57:35.947 | 2643.2 ms |
| Session 5 | 00:57:34.093 | 783.2 ms |
| Edited orange 30 L | 00:57:54.734 | 539.7 ms |

The last intentional backend contact before the idle test completed by **00:26:30 UTC**. The first later browser request reached the API at **00:56:49.315 UTC**, at least **30 minutes 19 seconds** later. It returned the correct baseline with request ID `93b092d1-811e-40a7-99fc-8abb64254d96` and process marker `d4736af30d434ecdb316794d20afa5ce`, different from the earlier `4477e7b413b348b4b48a50ca37d49fb6`. Thus the later request ran in a different Python process; the marker does not prove why Vercel selected that process. All eight accepted browser measurements on the final pair were below five seconds. The edited fixture returned **AUD 211.00** and 25/20/50 L.

One orange-reduced browser call displayed `Failed to fetch` and did not reach the FastAPI application log. The next manual retry succeeded. The frontend now translates network `TypeError` into a retryable service message; the cause of that one failed request remains unverified and is not counted as an accepted timing. The current harness also normalizes displayed negative zero and discloses accepted tiny solver residuals, after the first browser check exposed `-0.000` resource remaining.

Reviewer correction: a hosting/firewall error can return HTML rather than JSON. The frontend now shows a fixed retry message when JSON parsing fails. `npm run build` passed after this change, the revised frontend preview reached `READY`, and its public alias returned HTTP 200. A forced HTML response has not been exercised in the hosted browser; that failure test remains in later T13.

## Reviewer findings and scope

The preview follows the approved browser → separate FastAPI API → SciPy HiGHS path. The server checks the declared and streamed byte count, JSON and fixed IDs/decimal strings before solving. Exact Decimal arithmetic identifies all minimum-order shortages; only an optimal HiGHS status with finite quantities and independently checked bounds/resources becomes a plan. A time-limit status returns a safe 503 without a plan. The browser preserves the edited orange input on failure and requires a manual retry. CORS names one frontend origin, the API has no browser-held secret, and calculation logs contain request/status/timing/process metadata without submitted values.

This is deliberately a fixed-sample harness. Full Pydantic request/response models, editable product fields, scenario storage, charts, deployed rate limiting, forced provider-failure tests, and the final T14 browser matrix remain their roadmap capabilities. The custom Decimal parser and shallow browser response check are adequate to probe G01 but are not being treated as completion of those later contract tests.

The LP has three variables and four resource rows. On the current preview, application processing was 30.655 ms for the first sample request and 2.144 ms for the next; direct HTTP round trips were hundreds of milliseconds. The after-inactivity browser result took 3484.6 ms while its application processing took 28.533 ms. The observed cost is primarily outside the fixed-size model, and the browser and platform path dominate the click-to-render measure. There is no measured code hot path that justifies adding caching, workers, or a different solver in this spike.

## G01 evidence and completion gate

- [x] Rerun the public smoke script against the reassigned backend alias and confirm the structured metadata log. Last recorded optimize request: **2026-10-12 00:26:22.204 UTC**. The last intentional backend contact, including a health check, was complete by **00:26:30 UTC**; use that conservative time for the inactivity interval.
- [x] Measure a first browser calculation after **30 minutes with no intentional backend requests**. The exact interval, request ID, result, timing, and differing process marker are recorded above.
- [x] Confirm the connected Vercel account's free plan/usage through Allen and the signed-in Usage page values above. The successfully deployed Python bundle establishes that this build fits the account's current deployment limits. The exact uncompressed function bundle size is not exposed by the available deployment/build output; the 55.79 MB build cache is not that size.
- [x] Review the one earlier browser network failure: it did not reach the FastAPI log, and no repeat occurred in the final pair's eight accepted browser calculations or two public smoke passes. Its root cause is unverified, so it remains an observed transient reliability risk rather than a proven platform or application defect; later T13/T14 checks must retain it in the evidence.
- [x] Record spike time: approximately **1.1 wall-clock hours** from capability preparation at about 23:53 UTC to the final verification at 00:58 UTC, including the intentional 30-minute idle interval. This is below the 10-hour cap; hands-on time was not separately clocked.
- [x] Complete the guided code walkthrough; Allen explicitly approved completion on 12 October 2026. Capability checkpoint: `a9c44b1`; `progress.md` was updated after that checkpoint.

Final T14 (20 individual warm calls, three batches of five concurrent calls, and three after-inactivity calls on the completed dashboard), the WAF rate rule, full accessibility/browser matrix, reviewer timing, release and rollback remain later gates in [progress.md](../progress.md). This harness does not claim those gates are complete.
