# Capability 5.3 — public safeguards, speed, and first-time use

Status: **in progress; preview-only verification**. No production application deployment or promotion was performed. Record prepared 12 October 2026 (Australia/Sydney); T14 and T15 are complete. Final walkthrough and owner completion approval remain open.

## Deployment pair

| Item | Preview evidence |
| --- | --- |
| Team | `pche0414-2053`; the owner confirmed Hobby plan and usage within quota on 12 October 2026. This is owner confirmation, not a newly read usage snapshot. |
| Frontend | `https://production-planner-web-spike-20261012.vercel.app`; deployment `dpl_HBiKVgwRfKYpmSeeUwqqo93tUPws`; READY, non-production (`target: null`). |
| API | `https://production-planner-api-spike-20261012.vercel.app`; deployment `dpl_5rXryM1dY7tkpQS94qAiET1nA1N3`; READY, non-production (`target: null`), Python 3.12 in `syd1`. |
| CORS | Preview API `ALLOWED_ORIGINS` contains exactly the frontend preview alias. Frontend preview `NEXT_PUBLIC_BACKEND_URL` points to exactly the API preview alias. Production variables were not changed. |
| Build | Next.js 16.4.0 production build passed. Python 3.12 / SciPy service deployment completed successfully. |

## Checks completed

- Frontend `npm run typecheck`, `npm run build`, `npm run lint`, and `npm test`: pass; 19 unit/component tests across five files.
- Backend `pytest`: 77 passed; one existing Starlette/AnyIO deprecation warning. `git diff --check` passes for tracked changes and will be repeated after final evidence assembly.
- Public smoke: baseline AUD 219.333333; edited orange scenario AUD 211.00; exact shortages for all four constrained resources; invalid precision rejected with 422.
- Public boundary checks: exact-origin preflight accepted and an unlisted origin rejected; malformed JSON returns 400; unsupported media type and content encoding return 415; 16,385 bytes returns 413 and the 16,384-byte boundary reaches schema validation; invalid decimal is rejected without echoing its sentinel. Error responses include `Cache-Control: no-store`.
- Runtime log review correlated all 38 performance calls and public smoke/boundary calls. Records contain request ID, outcome, error code/class, process instance, and duration only; no submitted inputs or sentinel values. The idle calls ran in `syd1` on Python 3.12 and used two process markers.
- Repository scan found no tracked credential-named files or matches for common credential/token/private-key patterns. This is a pattern scan, not proof that every possible secret format is absent.
- `npm audit --omit=dev --audit-level=high` reported zero production dependency vulnerabilities. The previous full development audit recorded five high advisories in the ESLint transitive `braces` chain with no patched version reported; see the 5.1 entry in [`progress.md`](../progress.md#phase-5--system-verification-weeks-910).
- Preview self-rehearsal of calculate, save, edit, recalculate, save, compare, and reload completed in 4.833 seconds with the expected 40 L, 30 L, and −10 L B-minus-A production deltas. This is **not T15 evidence** because the participant was not a first-time reviewer.

## T14 timing method and current results

Measured in headless Chromium 156.0.8078.4 on Windows, 1280×720, no artificial throttling, browser timezone Australia/Sydney, browser-reported effective connection `4g`; physical network location was not measured. `clickToRenderMs` runs from the Optimize click to two animation frames after the result is rendered. Each accepted result was HTTP 200 and optimal. The target is 5,000 ms per measurement.

All 38 calculations passed. Warm click-to-render ranged from 496.8 to 793.8 ms; concurrent batches ranged from 576.7 to 3,042.3 ms; the three first-after-inactivity runs ranged from 2,927.2 to 3,277.8 ms. The idle clicks occurred 30 minutes 55 seconds after the last intentional API request. Every result was HTTP 200 and rendered as optimal; there were no browser errors.

| Group | Label | UTC click time | Click to render (ms) | API duration (ms) | Request ID |
| --- | --- | --- | ---: | ---: | --- |
| Warm/concurrent | warm-1 | 2026-10-12 12:09:38.381 UTC | 640.4 | 2.491 | `fd80e81f-43d5-49e0-81cd-29c2e61cefd9` |
| Warm/concurrent | warm-2 | 2026-10-12 12:09:41.063 UTC | 793.8 | 2.236 | `c621a6d0-c910-4439-8c72-807a5f48ff0a` |
| Warm/concurrent | warm-3 | 2026-10-12 12:09:43.883 UTC | 529.5 | 2.289 | `a903c6a8-c50f-44f1-872c-ea2794e060c0` |
| Warm/concurrent | warm-4 | 2026-10-12 12:09:46.438 UTC | 563.7 | 2.235 | `1af2a0e7-db4b-4b90-be8c-60236428e28d` |
| Warm/concurrent | warm-5 | 2026-10-12 12:09:49.038 UTC | 562.7 | 2.247 | `343bac8b-ad53-47c0-88ca-772339b2661e` |
| Warm/concurrent | warm-6 | 2026-10-12 12:09:51.638 UTC | 514.1 | 2.264 | `01e6c11e-a185-42d0-ac7c-f48a0880c6f4` |
| Warm/concurrent | warm-7 | 2026-10-12 12:09:54.190 UTC | 531.3 | 2.287 | `89763033-f390-43df-9e62-1e833157c3ab` |
| Warm/concurrent | warm-8 | 2026-10-12 12:09:56.755 UTC | 496.8 | 2.666 | `d4c62266-8e44-4f9b-8994-b724cbbac8fc` |
| Warm/concurrent | warm-9 | 2026-10-12 12:09:59.282 UTC | 528.9 | 2.345 | `8982ae42-f462-48ab-ade5-cb8f9b32b390` |
| Warm/concurrent | warm-10 | 2026-10-12 12:10:01.838 UTC | 529.2 | 2.264 | `0420e38e-86ec-460d-8cf0-a4da4a3cd51d` |
| Warm/concurrent | warm-11 | 2026-10-12 12:10:04.402 UTC | 511.3 | 2.332 | `eccaf154-f2fe-44c7-97f6-e2236136b598` |
| Warm/concurrent | warm-12 | 2026-10-12 12:10:06.931 UTC | 529.9 | 2.479 | `5b96915b-20ab-45c7-9a6d-832cf7689a0f` |
| Warm/concurrent | warm-13 | 2026-10-12 12:10:09.489 UTC | 544.3 | 2.336 | `257bfa23-ea70-4a54-adaf-cb433caa5695` |
| Warm/concurrent | warm-14 | 2026-10-12 12:10:12.067 UTC | 547.5 | 2.292 | `59ed2a41-214c-44ed-8e39-2ee01a30773c` |
| Warm/concurrent | warm-15 | 2026-10-12 12:10:14.652 UTC | 547.7 | 2.48 | `f5fdd485-66b4-4362-9486-483fa999a557` |
| Warm/concurrent | warm-16 | 2026-10-12 12:10:17.222 UTC | 780.5 | 2.255 | `ac077ca1-8029-4267-af5c-fbfba34b5d5b` |
| Warm/concurrent | warm-17 | 2026-10-12 12:10:20.037 UTC | 527.9 | 2.195 | `34cef115-2bda-45df-aa75-7c9f051ff9c3` |
| Warm/concurrent | warm-18 | 2026-10-12 12:10:22.601 UTC | 530.5 | 2.283 | `056c604a-db68-4d9b-9a5b-f6758b02884b` |
| Warm/concurrent | warm-19 | 2026-10-12 12:10:25.170 UTC | 514.8 | 2.271 | `669c4a6b-bb5d-47bc-8bf9-65d942f89b0c` |
| Warm/concurrent | warm-20 | 2026-10-12 12:10:27.719 UTC | 513.1 | 2.19 | `530c7e69-a90e-4aab-94a4-694c37c84d73` |
| Warm/concurrent | batch-1-session-1 | 2026-10-12 12:11:34.710 UTC | 3042.3 | 28.571 | `0da6c4eb-f038-48cb-ad73-6873af97ba0f` |
| Warm/concurrent | batch-1-session-2 | 2026-10-12 12:11:34.710 UTC | 596.3 | 2.278 | `6ccc2275-232a-4b53-b79b-d02296b8db0a` |
| Warm/concurrent | batch-1-session-3 | 2026-10-12 12:11:34.710 UTC | 611.9 | 2.372 | `1dce17ed-5c03-4835-996e-b2d7d3dc56d1` |
| Warm/concurrent | batch-1-session-4 | 2026-10-12 12:11:34.711 UTC | 2946.2 | 28.339 | `9ded6942-1e8e-443f-a397-8fe4bff9e7d9` |
| Warm/concurrent | batch-1-session-5 | 2026-10-12 12:11:34.711 UTC | 613.7 | 2.248 | `970b3a6c-644f-4be3-8be7-3fca5fbc36a0` |
| Warm/concurrent | batch-2-session-1 | 2026-10-12 12:12:44.246 UTC | 627.3 | 2.337 | `2a0babad-9059-48a1-b1f2-0da1ea49ca77` |
| Warm/concurrent | batch-2-session-2 | 2026-10-12 12:12:44.246 UTC | 627.2 | 28.023 | `73a01964-fb6e-4ceb-8fd6-2e93ffc69b3a` |
| Warm/concurrent | batch-2-session-3 | 2026-10-12 12:12:44.246 UTC | 610.5 | 2.455 | `d191e975-48a5-47d6-8591-db166451f0f7` |
| Warm/concurrent | batch-2-session-4 | 2026-10-12 12:12:44.246 UTC | 662.2 | 2.035 | `3f3e1a4f-e6bf-4a7b-af06-5962f48fb13c` |
| Warm/concurrent | batch-2-session-5 | 2026-10-12 12:12:44.246 UTC | 646.5 | 2.245 | `4a82e288-8ff0-4a45-82b9-e47683fbeaae` |
| Warm/concurrent | batch-3-session-1 | 2026-10-12 12:13:51.415 UTC | 593.3 | 2.279 | `3a4f6fd2-7551-4f49-b988-45f24fedd5dc` |
| Warm/concurrent | batch-3-session-2 | 2026-10-12 12:13:51.415 UTC | 593.3 | 2.382 | `a67f10e3-3230-4fec-a3d7-27ccc9720742` |
| Warm/concurrent | batch-3-session-3 | 2026-10-12 12:13:51.416 UTC | 576.7 | 2.215 | `8c7befec-a91f-4f3d-b068-5bf61dcf3a53` |
| Warm/concurrent | batch-3-session-4 | 2026-10-12 12:13:51.416 UTC | 593.3 | 2.337 | `13954c43-7f23-4d52-afa4-e1dcad527a7d` |
| Warm/concurrent | batch-3-session-5 | 2026-10-12 12:13:51.416 UTC | 608.7 | 2.763 | `e2a56690-7991-4f27-bc0b-e54a18f25d07` |
| First after inactivity | idle-first-1 | 2026-10-12 12:53:38.059 UTC | 2,927.2 | 24.364 | `2f119757-e4f3-4af8-bb07-95627c9dc989` |
| First after inactivity | idle-first-2 | 2026-10-12 12:53:38.060 UTC | 3,277.8 | 2.274 | `477b6eba-674d-44b0-84f5-07aa3eff84c0` |
| First after inactivity | idle-first-3 | 2026-10-12 12:53:38.061 UTC | 3,167.3 | 28.008 | `e8c6ad47-3669-4bb8-b7e6-8d11cbcc1fca` |

Idle request IDs were found in the API deployment logs. Each record reports only calculation outcome and operational metadata; no submitted input fields were logged.

| Request ID | Vercel log time (UTC) | Region/runtime | Process marker | App duration (ms) |
| --- | --- | --- | --- | ---: |
| `2f119757-e4f3-4af8-bb07-95627c9dc989` | 2026-10-12 12:53:40.125 | `syd1` / `python3.12` | `3d9588c483474ca2b39c12e2349a7234` | 24.509 |
| `477b6eba-674d-44b0-84f5-07aa3eff84c0` | 2026-10-12 12:53:40.443 | `syd1` / `python3.12` | `519a420e79e34084bdaefd13edad7bfc` | 2.397 |
| `e8c6ad47-3669-4bb8-b7e6-8d11cbcc1fca` | 2026-10-12 12:53:40.366 | `syd1` / `python3.12` | `519a420e79e34084bdaefd13edad7bfc` | 28.184 |

## T15, T16 and operational notes

- T15: the owner confirms the reviewer was new to the app and completed the first-time sample/save/edit/save/compare flow in under one minute, below the two-minute target. The owner reports the app works in Chrome and Microsoft Edge and that each action takes under 10 seconds. The reviewer’s exact browser/device and assistance were not specified.
- The owner published the initial Vercel Firewall rule; Vercel reported success in 579 ms. Active status showed one active custom rule. Its conditions were `POST`, `/api/v1/optimize`, and `environment = preview`; it keyed on source IP, allowed 150 requests / 60 seconds, and logged over-limit events. Production-environment requests did not match this rule. A 24-hour traffic query found no over-limit events.
- The owner then published the stricter preview rule. Post-publication inspection confirms the active rule matches `POST /api/v1/optimize` and `environment = preview`, keyed by source IP, with a 30 requests / 60 seconds fixed window and the rate-limit action (HTTP 429) when exceeded. `OPTIONS` remains excluded. Firewall status shows one active custom rule and zero draft changes. The environment condition means production-environment requests do not match this rule.
- Vercel’s Hobby team status showed the OWASP managed rules are unavailable on the current plan. The active rate limit is a custom preview rule.
- The owner confirmed Hobby and usage within quota. The earlier usage reading is not a current snapshot; no new quota value is claimed here.
- No client secret was found in the tracked frontend or public preview configuration. The browser sends only the public API base URL; scenario records stay in browser storage.
- `pip-audit` found six Starlette advisory groups for pinned Starlette 0.48.0. Source review confirmed the corresponding framework APIs are not used in this app (`FileResponse`, `request.url`, `StaticFiles`, `HTTPEndpoint`, `request.form`); Vercel runs Linux for the Windows-only `StaticFiles` issue. The separate URL-hostname advisory also affects reconstruction of `request.url`, which the app does not use. On 12 October the owner approved recording these as reviewed/not reachable in the current API and continuing 5.3 without dependency upgrades. The pytest 8.4.2 test dependency has a temp-directory advisory fixed in 9.0.3; pytest is not in Vercel's runtime dependencies but may be installed in CI/test environments. This is separately recorded for dependency maintenance. These findings do not mean vulnerable packages are globally harmless.

| Package finding | Fixed version reported by audit | Applicability review |
| --- | --- | --- |
| Starlette GHSA-7f5h-v6xp-fcq8 / CVE-2025-62727 (`FileResponse` Range DoS) | 0.49.1 | App has no `FileResponse`/file-download route. |
| Starlette GHSA-86qp-5c8j-p5mr / CVE-2026-48710 (malformed Host affects reconstructed URL path) | 1.0.1 | App does not use `request.url` for path/security decisions. |
| Starlette GHSA-wqp7-x3pw-xc5r / CVE-2026-48818 (Windows `StaticFiles` UNC SSRF) | 1.1.0 | App does not mount `StaticFiles`; hosted runtime is Linux. |
| Starlette GHSA-x746-7m8f-x49c / CVE-2026-48817 (arbitrary method dispatch in `HTTPEndpoint`) | 1.1.0 | App uses function-based routes, no `HTTPEndpoint`. |
| Starlette GHSA-82w8-qh3p-5jfq / CVE-2026-54283 (`request.form` URL-encoded limits) | 1.3.1 | API accepts bounded JSON; it does not parse forms. |
| Starlette GHSA-jp82-jpqv-5vv3 / CVE-2026-54282 (malformed path affects reconstructed URL hostname) | 1.3.0 | App does not use `request.url`. |
| pytest PYSEC-2026-1845 / GHSA-6w46-j5rx-g56g / CVE-2025-71176 (temporary-directory handling) | 9.0.3 | Dev/test dependency only; Vercel runtime requirements exclude pytest. CI/test environment remains exposed until updated. |

Primary advisory records: [Starlette FileResponse](https://github.com/Kludex/starlette/security/advisories/GHSA-7f5h-v6xp-fcq8), [request URL path](https://github.com/Kludex/starlette/security/advisories/GHSA-86qp-5c8j-p5mr), [Windows StaticFiles](https://github.com/Kludex/starlette/security/advisories/GHSA-wqp7-x3pw-xc5r), [HTTPEndpoint dispatch](https://github.com/Kludex/starlette/security/advisories/GHSA-x746-7m8f-x49c), [form limits](https://github.com/Kludex/starlette/security/advisories/GHSA-82w8-qh3p-5jfq), [request URL hostname](https://github.com/Kludex/starlette/security/advisories/GHSA-jp82-jpqv-5vv3), and [pytest temporary-directory issue](https://github.com/advisories/GHSA-6w46-j5rx-g56g). The package audit did not change versions; this should be handled as a separate dependency upgrade with backend/CI verification and a new preview before release.
- No production preview promotion was performed. The projects are not linked to a GitHub repository; previews were built from a tracked-source snapshot. Firefox and physical-device/screen-reader checks remain outside this capability's completed evidence per owner-approved 5.2 scope.

## Remaining acceptance evidence

1. Walk through this evidence with the owner and obtain completion approval.
2. After approval, create the separate implementation and `progress.md` checkpoints.
