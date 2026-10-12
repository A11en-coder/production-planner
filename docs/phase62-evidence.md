# Phase 6.2 production release and rollback evidence

Record updated 13 October 2026 (Australia/Sydney). The production release uses the approved clean source checkpoint `a782db60499508c98fbf48a10316a624882186e5` from `master`. No application source files changed in this capability. The Vercel projects were deployed from uploaded files because their local CLI projects were not linked; deployment metadata records the approved repository and commit.

## Paired deployment record

| Project | First Production deployment | Identical second deployment | Final Production alias after rollback |
| --- | --- | --- | --- |
| API `production-planner-api` | `dpl_AKK7mYKRkNBBGcM1Ppu21tevnoa5` | `dpl_BbTP6A5uUzvwPwQ7hshArVv4x9aq` | `https://production-planner-api.vercel.app` → first deployment |
| Web `production-planner-web` | `dpl_4KGwF4QCZwQbeaUJbHUEW9hL5Qm7` | `dpl_D5Ye1EcjKZpwXTkquoaPKEmKkekD` | `https://production-planner-web-tan.vercel.app` → first deployment |

Both first deployments reached `READY` before the second pair was created. Both second deployments also reached `READY`; Vercel marked the first deployments as rollback candidates. Vercel's rollback API restored the API and web aliases to the first pair. The API's `/health` response then returned `build_id: dpl_AKK7mYKRkNBBGcM1Ppu21tevnoa5`, API v1, and model `juice-day-v1`. The production web browser was reloaded after rollback and completed another calculation against the restored API.

The Vercel Hobby team had no successful Production release before this capability. The two older Production attempts were canceled. Therefore, the rehearsal restored the first release after a second identical release; it did not simulate recovery to an empty, never-deployed Production project.

Two initial API upload attempts failed before serving traffic because their file paths did not match the project's configured `backend` root. The source was repacked with repository-relative `backend/...` paths, after which the API deployment reached `READY`. These failed deployment IDs are `dpl_DCBrZ9eMpYAXTjrh5vWBB9xYLamw` and `dpl_H3edbrwudKT9QcjNrkAvreF2t5pX`.

## Environment and firewall configuration

- API production variable `ALLOWED_ORIGINS` targets only Production and contains `https://production-planner-web-tan.vercel.app` (variable ID `jqAgAphfEammn60I`).
- Web production variable `NEXT_PUBLIC_BACKEND_URL` targets only Production and contains `https://production-planner-api.vercel.app` (variable ID `4oajDyYdBSMt95QA`).
- Existing Preview variables remain Preview-only: API variable ID `lLWK224viFRCTOu7`, web variable ID `AjXjDqLc5zzzf5VH`.
- The active firewall rule `rule_preview_optimize_api_rate_observation_YP5I4s` remains Preview-only: POST `/api/v1/optimize`, fixed 60-second window, 30 requests per source IP, Too Many Requests (429). The dashboard still displays this one project rule as active.
- The owner chose to deploy without a Production rate rule after the Hobby dashboard offered a Pro upgrade when a separate Production rule was submitted. No upgrade was accepted and the Preview rule was not changed. The Production calculation endpoint currently has no Vercel custom rate-limit rule; this is an explicit safeguard gap for a future plan or rule-design decision.

## Production smoke results

The public browser loaded the Production web alias and submitted real requests to the Production API:

| Check | Result |
| --- | --- |
| Health and model metadata | HTTP 200; API v1; model `juice-day-v1`; build ID matched the active API deployment |
| Baseline sample | Optimal; contribution AUD 219.33; 50.000 L orange + apple, 20.000 L apple + pineapple, 33.333 L tropical |
| Edited scenario | Orange availability changed from 40 L to 35 L; optimal contribution AUD 217.04 |
| Saved scenarios and comparison | Saved `Capability 6.2 baseline` and `Capability 6.2 edited`; comparison reported orange availability −5 L and contribution −AUD 2.29 |
| Infeasible response | Set all three minimum orders to 30 L and processing capacity to 1 hour; API returned a processing shortfall of 150 min without a production plan |
| Reload and rollback persistence | Both saved scenarios, stored results, and comparison remained after reload through the second web deployment and again after rollback to the first deployment |
| Final post-rollback calculation | Optimal baseline contribution AUD 219.33; browser-reported request time 28 ms |

Other browser-reported request times were 25 ms for the first baseline, 2 ms for the edited scenario, and 0 ms for the infeasible response. These are individual request durations reported by the app, not whole-workflow or full T14 benchmark measurements. The browser collection contains two harmless, explicitly named smoke scenarios for review.

The end-to-end workflow passed the sample, edit, save, compare, reload, infeasibility, and post-rollback calculation checks. Preview, API health, and production frontend/API origin pairing remain available at the aliases above.

## Rollback runbook exercised

1. Record each current Production deployment ID and confirm its replacement is `READY`.
2. Use the Vercel rollback action on the API project to select its immediately previous Production deployment.
3. Use the Vercel rollback action on the web project to select its immediately previous Production deployment.
4. Confirm the API `/health` build ID and API/model versions; load the production web alias, reload saved scenarios, and submit the baseline calculation.
5. Do not clear browser storage. The saved collection is origin-scoped in `localStorage`; keeping the same production web origin preserved it in this rehearsal.

On Hobby, rollback is constrained to the immediately previous Production deployment. The no-op second pair made that target available for this rehearsal. The pre-release state had no successful Production deployment and cannot be restored as an alias rollback.
