# Production Planner

Production Planner is a browser based demonstration for planning daily output across three fictional juice blends. It finds the combination with the highest entered profit contribution while respecting shared ingredient, processing time, minimum order, and demand limits.

The dashboard, optimizer API, scenario saving, and comparison flow are available on both the public Preview pair and the Production pair. Production is live; its deployment and rollback evidence is recorded in the [release record](docs/release-candidate.md).

| Service | Production | Preview |
| --- | --- | --- |
| Planner | [Open Production planner](https://production-planner-web-tan.vercel.app) | [Open Preview planner](https://production-planner-web-spike-20261012.vercel.app) |
| Optimizer API | [Check Production API health](https://production-planner-api.vercel.app/health) | [Check Preview API health](https://production-planner-api-spike-20261012.vercel.app/health) |

The recorded deployment IDs, paired origins, security review, and performance results are in [the Phase 5.3 evidence](docs/phase53-evidence.md) and [Phase 6.2 evidence](docs/phase62-evidence.md). [GitHub Actions Checks run #3](https://github.com/A11en-coder/production-planner/actions/runs/38269613193) passed for `59a4d5a`, the source snapshot reviewed for this closeout; see [the release record](docs/release-candidate.md) for both environments and accepted limitations.

## Try the sample

1. Open the planner and select **Optimize** for the preloaded sample.
2. Save the sample as a named scenario.
3. Change orange availability to 30 L and calculate again.
4. Save the edited inputs and result as another scenario.
5. Select the two saved scenarios in the comparison section and read the B-minus-A changes.

The owner reports that a first time reviewer completed this flow in under one minute. The app is anonymous; it does not require an account.

## What the model calculates

The decision variables are continuous daily production quantities, in litres, for three fixed blends. For each blend, the app accepts a recipe, contribution per litre (AUD/L), processing time per litre (minutes/L), minimum order (L), and maximum demand (L). It also accepts available litres for orange, apple, and pineapple and shared processing capacity in hours.

The optimizer maximizes the sum of each blend's entered contribution per litre multiplied by its production quantity. Ingredient limits are checked using the recipe percentages; total processing use must fit the available hours; and each quantity must stay between its minimum order and maximum demand. The backend independently validates the request and checks minimum order feasibility before solving the bounded linear program with SciPy HiGHS.

Quantities can be fractional. Negative contribution values are valid, and minimum orders can require production with a negative total contribution. Results are optimal only under the submitted values and assumptions. “Contribution” is not guaranteed business profit: fixed costs and other business effects are outside the model.

The sample fixture is [`contracts/sample-request.json`](contracts/sample-request.json). Its baseline public preview calculation returned AUD 219.333333 contribution; the tested scenario with orange availability reduced to 30 L returned AUD 211.00.

### Assumptions and limitations

- One litre of the recipe ingredients produces one litre of finished juice; production waste is not modelled.
- Recipes, contribution rates, and processing rates stay constant per litre.
- Demand limits represent quantities that can be sold that day.
- The model covers one day, three fixed blends, and three ingredients. It does not handle inventory across days, integer bottle sizes, purchasing, uncertainty, recipe optimization, or forecasting.
- This is a bounded demonstration. No commercial throughput, uptime, or concurrent-user guarantee is specified.

## Saved scenarios and privacy

Named scenarios are saved only in the current browser's `localStorage`, under the versioned key `production-planner:scenarios:v1`. The collection supports up to 20 scenarios. A saved record may contain its inputs and an optimal or infeasible result with the input snapshot used for that result. The browser checks result freshness and API/model compatibility before comparison.

There is no account, server database, cloud backup, or cross-device synchronization. Browser profile, origin, or site-data changes can make locally saved scenarios unavailable. Do not store confidential business data in this public demonstration. The API is stateless and does not receive scenario names or saved collections.

## Run locally on Windows

### Requirements

- Python 3.12
- Node.js 24 and npm
- PowerShell

### Start the API

From the repository root, open a PowerShell terminal and run:

```powershell
python --version
python -m venv backend/.venv
& backend/.venv/Scripts/Activate.ps1
python -m pip install -r backend/requirements-dev.txt
Set-Location backend
$env:ALLOWED_ORIGINS = '["http://localhost:3000"]'
python -m uvicorn app.main:app --reload --port 8000
```

The API is available at `http://localhost:8000`. Check `http://localhost:8000/health` for service, API, and model identity.

### Start the web app

Open a second PowerShell terminal at the repository root:

```powershell
Set-Location frontend
npm ci
$env:NEXT_PUBLIC_BACKEND_URL = "http://localhost:8000"
npm run dev
```

Open `http://localhost:3000`. The frontend sends requests to the configured API base URL. `NEXT_PUBLIC_BACKEND_URL` is public browser configuration; never put a credential or secret in it. The backend's `ALLOWED_ORIGINS` must be a JSON array containing the exact frontend origin. Do not use a wildcard.

## Checks

Run backend tests from the repository root after installing the development requirements:

```powershell
Push-Location backend
& .venv/Scripts/python.exe -m pytest -q
Pop-Location
```

Run frontend checks from `frontend/`:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Run the browser workflow after installing its supported browsers:

```powershell
npx playwright install chromium webkit
npm run test:e2e
```

Playwright starts the locally built frontend and API using [`playwright.config.ts`](frontend/playwright.config.ts). The checked browser engines are Chromium and WebKit; Firefox is deferred. CI uses the same supported engine set. Live Vercel performance tests are manual and paced; ordinary CI does not send repeated traffic to the public service.

The [`checks` GitHub Actions workflow](.github/workflows/checks.yml) runs on pushes and pull requests. It installs pinned frontend dependencies and backend development requirements, then runs backend tests, frontend lint/typecheck/unit tests/build, and browser end-to-end tests. GitHub Actions [Checks #3](https://github.com/A11en-coder/production-planner/actions/runs/38269613193) passed on 13 October 2026 for commit `59a4d5a`: backend passed; all 19 frontend unit tests and all 12 Chromium/WebKit browser tests passed. GitHub reported runner/action deprecation notices; see the [release record](docs/release-candidate.md).

## Configuration and deployment

The frontend and backend are separate Vercel projects. Set these environment variables for each matching environment:

| Project | Variable | Purpose |
| --- | --- | --- |
| Frontend | `NEXT_PUBLIC_BACKEND_URL` | Public base URL of the matching optimizer API deployment. |
| Backend | `ALLOWED_ORIGINS` | JSON array of exact allowed frontend origins, for example `["https://planner.example"]`. |

Each pair has environment-specific frontend and API values. The Preview API allows the exact Preview frontend origin; the Production API allows the exact Production frontend origin. No secret is required by the browser or optimizer API. Keep the values separate; a Preview-built frontend must not be promoted as a Production build unless its embedded API URL is correct. The Production endpoint has no custom Vercel rate-limit rule under the current Hobby plan; the owner accepted this limitation for the current release. See [Phase 6.2 evidence](docs/phase62-evidence.md).

The API runs Python 3.12 and the frontend uses Node.js 24. Backend runtime packages are pinned in [`backend/requirements.txt`](backend/requirements.txt); test tools are in [`backend/requirements-dev.txt`](backend/requirements-dev.txt). Frontend versions are pinned in [`frontend/package-lock.json`](frontend/package-lock.json).

Production is live at the aliases above. The API-first deployment, smoke checks, and rollback rehearsal are recorded in the [release record](docs/release-candidate.md), [Phase 6.2 evidence](docs/phase62-evidence.md), and [TRD deployment and rollback instructions](docs/Production_Planner_TRD.md#16-deployment-and-rollout). The deployed source has not changed since its approved application checkpoint; later commits update documentation.

## Repository map

| Path | Purpose |
| --- | --- |
| `frontend/` | Next.js dashboard, API client, validation, saved scenarios, and comparisons. |
| `backend/` | FastAPI contract and SciPy HiGHS optimizer. |
| `contracts/` | Shared API request fixture. |
| `docs/Production_Planner_PRD.md` | Product requirements and acceptance criteria. |
| `docs/Production_Planner_TRD.md` | Approved architecture, API, test plan, release and rollback instructions. |
| `docs/phase53-evidence.md` | Public preview safeguards, browser performance, and reviewer evidence. |
| `docs/phase62-evidence.md` | Production deployment, smoke checks, accepted firewall limitation, and rollback runbook. |
| `docs/phase71-acceptance.md` | Requirement-to-evidence closeout matrix and known limitations. |
| `docs/reviewer-walkthrough.md` | Short Production sample, edit, save, and comparison walkthrough. |
| `docs/release-candidate.md` | Current Preview and Production configuration, CI, and release evidence. |
| `progress.md` | Capability status, decisions, evidence, and Git checkpoints. |

## Known verification limits

Firefox was explicitly deferred by the owner; a physical mobile device and a screen reader were not tested. The Linux Chromium and WebKit Playwright matrix is not a substitute for physical-device or screen-reader testing. The current plan is Vercel Hobby; the owner confirmed usage was within quota on 12 October 2026, but that is not a current usage snapshot. The Production endpoint has no custom Vercel rate-limit rule under this plan, an accepted limitation for the current release. Security audit findings and reviewed applicability are recorded in [the Phase 5.3 evidence](docs/phase53-evidence.md); dependency upgrades remain separate maintenance work. See the [acceptance matrix](docs/phase71-acceptance.md) for gate status and the [reviewer walkthrough](docs/reviewer-walkthrough.md).
