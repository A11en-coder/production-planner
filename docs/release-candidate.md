# Production Planner release record

Record updated 13 October 2026 (Australia/Sydney). This document records the paired public Preview and Production environments, repository/CI gates, and the completed Capability 6.2 release and rollback rehearsal. Acceptance status and the reviewer walkthrough are in [Phase 7.1 acceptance evidence](phase71-acceptance.md) and [the reviewer walkthrough](reviewer-walkthrough.md). Production evidence and the accepted Hobby firewall limit are in [Phase 6.2 evidence](phase62-evidence.md).

## Preview candidate overview

| Item | Recorded candidate |
| --- | --- |
| Frontend project | Vercel `production-planner-web`; preview alias [production-planner-web-spike-20261012.vercel.app](https://production-planner-web-spike-20261012.vercel.app) |
| Frontend deployment | `dpl_HBiKVgwRfKYpmSeeUwqqo93tUPws`, READY, preview (`target: null`) |
| API project | Vercel `production-planner-api`; preview alias [production-planner-api-spike-20261012.vercel.app](https://production-planner-api-spike-20261012.vercel.app) |
| API deployment | `dpl_5rXryM1dY7tkpQS94qAiET1nA1N3`, READY, preview (`target: null`); Python 3.12, `syd1` |
| API/model identity | API version `1`; model version `juice-day-v1` |
| Vercel team | `pche0414-2053`, Hobby plan confirmed by the owner; usage-within-quota confirmation was made 12 October 2026 and is not a current usage snapshot |
| Git source | Public repository [A11en-coder/production-planner](https://github.com/A11en-coder/production-planner), branch `master`. The source snapshot reviewed for this closeout is `59a4d5a`; Production application source was deployed from `a782db6`; commits after that deployment changed documentation only. |
| CI | [Checks run #3](https://github.com/A11en-coder/production-planner/actions/runs/38269613193) passed on push for `59a4d5a` on 13 October 2026 in 2m 41s. Backend and frontend/browser jobs succeeded; 19 Vitest tests and 12 Playwright tests passed. The initial [Checks run #1](https://github.com/A11en-coder/production-planner/actions/runs/38264084794) also passed. |

The frontend preview was built with `NEXT_PUBLIC_BACKEND_URL` set to the API preview alias. The API preview's `ALLOWED_ORIGINS` contains exactly the frontend preview origin. Production now uses the paired aliases below. The active 30-request-per-source-IP-per-60-second firewall rule still matches only Preview `POST /api/v1/optimize`; at the owner's direction, no separate Production rate rule was enabled because Vercel offered a Pro upgrade when submitting it from the Hobby plan.

## Production deployment

| Item | Production state after rollback rehearsal |
| --- | --- |
| Frontend alias | [production-planner-web-tan.vercel.app](https://production-planner-web-tan.vercel.app) |
| API alias | [production-planner-api.vercel.app](https://production-planner-api.vercel.app) |
| Frontend currently assigned deployment | `dpl_4KGwF4QCZwQbeaUJbHUEW9hL5Qm7`, READY, Production; restored after identical deployment `dpl_D5Ye1EcjKZpwXTkquoaPKEmKkekD` |
| API currently assigned deployment | `dpl_AKK7mYKRkNBBGcM1Ppu21tevnoa5`, READY, Production; restored after identical deployment `dpl_BbTP6A5uUzvwPwQ7hshArVv4x9aq` |
| Source | Approved, clean repository state at `a782db60499508c98fbf48a10316a624882186e5` (`master`); uploaded source files were taken from that commit |
| API identity | API version `1`; model version `juice-day-v1`; production `/health` returned build ID `dpl_AKK7mYKRkNBBGcM1Ppu21tevnoa5` after rollback |
| Runtime region | Vercel deployment metadata reports `iad1` for both Production deployments |
| Production environment variables | API `ALLOWED_ORIGINS` targets only Production and contains the web alias above; web `NEXT_PUBLIC_BACKEND_URL` targets only Production and points to the API alias. Preview-only values remain in Preview. |
| Production rate limiting | Not configured, by owner choice after Vercel Hobby presented a Pro upgrade prompt. The existing Preview-only rule remains active and unchanged. See accepted safeguard gap in [Phase 6.2 evidence](phase62-evidence.md). |

The rollback rehearsal started with no successful Production deployment. It created a first pair and a second pair from the same source and configuration, then restored both aliases to the first pair. It proves rollback between equivalent releases and that same-origin browser storage survives; it cannot restore the earlier no-service state.

## Verified evidence

- The public preview pair passed the API health, baseline, edited-input, shortage, validation, CORS, malformed/oversized request, and safe-error checks in [Phase 5.3 evidence](phase53-evidence.md).
- Thirty-eight public Preview browser calculations passed the five-second click-to-render target. The Production smoke flow passed after release; the full T14 matrix was not repeated on Production. The owner confirmed the first-time reviewer completed the full sample/save/edit/save/compare flow in under one minute.
- Backend verification: 77 tests passed. Frontend verification: lint, typecheck, unit/component tests, production build, and the approved Chromium/WebKit Playwright suite passed. See the evidence and `progress.md` for exact results and scope limits.
- The frontend stores named scenarios in browser `localStorage`; the backend has no scenario database or user accounts. Browser storage is not a production backup or recovery point. Production deployment and rollback details are in [Phase 6.2 evidence](phase62-evidence.md).

## Readiness gates

| Gate | Status | Evidence / next step |
| --- | --- | --- |
| Product, model, setup, privacy, and limitations explained | Passed | [`README.md`](../README.md), approved PRD/TRD, and [acceptance matrix](phase71-acceptance.md) |
| Paired public frontend and API previews | Passed | Deployment IDs and exact origin pairing above and in [Phase 5.3 evidence](phase53-evidence.md) |
| Local backend/frontend/browser verification | Passed 13 October 2026 | `npm ci --no-audit --no-fund`; backend 77 tests; frontend lint, typecheck, 19 unit/component tests, production build, and 12 Chromium/WebKit Playwright tests. The Windows sandbox stalled some worker-based checks; they completed with normal local process access. |
| Public GitHub repository | Passed | [A11en-coder/production-planner](https://github.com/A11en-coder/production-planner) is public and contains the approved `master` history. |
| GitHub Actions run | Passed | [Checks #3](https://github.com/A11en-coder/production-planner/actions/runs/38269613193) passed for the `59a4d5a` source snapshot; backend and frontend/browser jobs succeeded. |
| Production deploy and rollback rehearsal | Passed with owner-approved rate-limit exception | Production sample/edit/save/compare/reload/infeasible flow passed; identical second pair rolled back to the first pair; browser scenarios survived. See [Phase 6.2 evidence](phase62-evidence.md). |
| Requirement closeout | Passed with documented accepted/unverified limits | See [Phase 7.1 acceptance matrix](phase71-acceptance.md). Firefox was deferred; physical-device and screen-reader checks remain unverified; Production has no custom rate-limit rule under Hobby. |

The initial hosted run (#1) completed in 2m 32s. Checks #3 completed in 2m 41s and passed the 77-test backend suite, frontend lint/typecheck/build, 19 frontend unit tests, and 12 Chromium/WebKit browser tests. GitHub attached informational warnings that the current `actions/checkout@v4`, `actions/setup-node@v4`, and `actions/setup-python@v5` releases are being forced to Node.js 24, and that `ubuntu-latest` will migrate to Ubuntu 26 beginning 19 October 2026. These did not fail the run; review action/runtime updates as maintenance.

The owner created the public repository and pushed the approved local history. The repository includes the PRD, TRD, README, progress record, test workflow, and evidence. No Vercel token or deployment credential is required by CI.

The tracked-file credential scan passed before publication, and `.gitignore` excludes local `.env` files, virtual environments, dependency directories, and `.codex/` user state. Production deployment and rollback were completed under Capability 6.2; the Production rate limit remains an explicitly accepted Hobby-plan gap.

Local Next.js build and Playwright runs passed. Next.js printed a Windows-host warning about an ancestor `C:\Users\Allen\package-lock.json` outside this Git repository and ignored it; the build used the repository's pinned frontend lockfile and completed. `npm ci` also warned that pinned ESLint 9.39.5 is deprecated. The linter passed; toolchain upgrades remain separate maintenance work.
