# Production Planner release candidate

Record updated 13 October 2026 (Australia/Sydney). This document records the paired public preview and the completed repository/CI gates for Capability 6.1. It does not authorize or perform a production release; production deployment and rollback belong to Capability 6.2.

## Candidate overview

| Item | Recorded candidate |
| --- | --- |
| Frontend project | Vercel `production-planner-web`; preview alias [production-planner-web-spike-20261012.vercel.app](https://production-planner-web-spike-20261012.vercel.app) |
| Frontend deployment | `dpl_HBiKVgwRfKYpmSeeUwqqo93tUPws`, READY, preview (`target: null`) |
| API project | Vercel `production-planner-api`; preview alias [production-planner-api-spike-20261012.vercel.app](https://production-planner-api-spike-20261012.vercel.app) |
| API deployment | `dpl_5rXryM1dY7tkpQS94qAiET1nA1N3`, READY, preview (`target: null`); Python 3.12, `syd1` |
| API/model identity | API version `1`; model version `juice-day-v1` |
| Vercel team | `pche0414-2053`, Hobby plan confirmed by the owner; usage-within-quota confirmation was made 12 October 2026 and is not a current usage snapshot |
| Git source | Public repository [A11en-coder/production-planner](https://github.com/A11en-coder/production-planner), branch `master`, published through commit `bc86ff1`. |
| CI | [Initial `Checks` run #1](https://github.com/A11en-coder/production-planner/actions/runs/38264084794) passed on push for `bc86ff1` on 13 October 2026. Backend and frontend/browser jobs succeeded. |

The frontend preview was built with `NEXT_PUBLIC_BACKEND_URL` set to the API preview alias. The API preview's `ALLOWED_ORIGINS` contains exactly the frontend preview origin. No production environment values were changed. The API's active 30-request-per-source-IP-per-60-second rule matches only preview `POST /api/v1/optimize`; over-limit requests receive HTTP 429. It does not match production-environment requests.

## Verified evidence

- The public preview pair passed the API health, baseline, edited-input, shortage, validation, CORS, malformed/oversized request, and safe-error checks in [Phase 5.3 evidence](phase53-evidence.md).
- Thirty-eight deployed browser calculations passed the five-second click-to-render target. The first-time reviewer completed the full sample/save/edit/save/compare flow in under one minute.
- Backend verification: 77 tests passed. Frontend verification: lint, typecheck, unit/component tests, production build, and the approved Chromium/WebKit Playwright suite passed. See the evidence and `progress.md` for exact results and scope limits.
- The frontend stores named scenarios in browser `localStorage`; the backend has no scenario database or user accounts. This preview record is not a production backup or recovery point.

## Readiness gates

| Gate | Status | Evidence / next step |
| --- | --- | --- |
| Product, model, setup, privacy, and limitations explained | Prepared locally | [`README.md`](../README.md), approved PRD/TRD, and preview evidence |
| Paired public frontend and API previews | Passed | Deployment IDs and exact origin pairing above and in [Phase 5.3 evidence](phase53-evidence.md) |
| Local backend/frontend/browser verification | Passed 13 October 2026 | `npm ci --no-audit --no-fund`; backend 77 tests; frontend lint, typecheck, 19 unit/component tests, production build, and 12 Chromium/WebKit Playwright tests. The Windows sandbox stalled some worker-based checks; they completed with normal local process access. |
| Public GitHub repository | Passed | [A11en-coder/production-planner](https://github.com/A11en-coder/production-planner) is public and contains the approved `master` history. |
| GitHub Actions run | Passed | [Checks #1](https://github.com/A11en-coder/production-planner/actions/runs/38264084794): backend and frontend/browser jobs succeeded. |
| Production deploy and rollback rehearsal | Not part of 6.1 | Capability 6.2, after the release candidate and G06 prerequisites are reviewed |

The first hosted run completed in 2m 32s. It passed the 77-test backend suite, frontend lint/typecheck/build, 19 frontend unit tests, and 12 Chromium/WebKit browser tests. GitHub attached informational warnings that the current `actions/checkout@v4`, `actions/setup-node@v4`, and `actions/setup-python@v5` releases are being forced to Node.js 24, and that `ubuntu-latest` will migrate to Ubuntu 26 beginning 19 October 2026. These did not fail the run; review action/runtime updates as maintenance.

The owner created the public repository and pushed the approved local history. The repository includes the PRD, TRD, README, progress record, test workflow, and evidence. No Vercel token or deployment credential is required by CI.

The tracked-file credential scan passed before publication, and `.gitignore` excludes local `.env` files, virtual environments, dependency directories, and `.codex/` user state. Production deployment and rollback remain separate work under Capability 6.2.

Local Next.js build and Playwright runs passed. Next.js printed a Windows-host warning about an ancestor `C:\Users\Allen\package-lock.json` outside this Git repository and ignored it; the build used the repository's pinned frontend lockfile and completed. `npm ci` also warned that pinned ESLint 9.39.5 is deprecated. The linter passed; toolchain upgrades remain separate maintenance work.
