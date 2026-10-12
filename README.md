# Production Planner

Production Planner is a portfolio demonstration that uses linear optimization to recommend daily quantities for three fictional juice blends. It maximizes entered profit contribution while respecting ingredient, processing-time, and blend-demand limits. The current application is a feasibility harness; the full editable dashboard and saved-scenario workflow are planned capabilities.

## Repository layout

| Path | Purpose |
| --- | --- |
| `frontend/` | Next.js browser application. |
| `backend/` | FastAPI service and SciPy HiGHS optimizer. |
| `contracts/sample-request.json` | Canonical example request shared by backend tests and local API checks. |
| `docs/Production_Planner_PRD.md` | Approved product requirements. |
| `docs/Production_Planner_TRD.md` | Approved technical design and API contract. |
| `progress.md` | Capability roadmap, evidence, decisions, and checkpoints. |

## Requirements

- Python 3.12
- Node.js 24 and npm

The backend runtime dependencies are pinned in `backend/requirements.txt`. Test and local-server tools are in `backend/requirements-dev.txt`, which includes the runtime file. Installing the development file is for local development; the Vercel backend installs only the runtime requirements.

## Run locally (PowerShell)

Open two PowerShell terminals at the repository root.

### Terminal 1: API

```powershell
python --version  # Use Python 3.12 for this project.
python -m venv backend/.venv
& backend/.venv/Scripts/Activate.ps1
python -m pip install -r backend/requirements-dev.txt
Set-Location backend
$env:ALLOWED_ORIGINS = '["http://localhost:3000"]'
python -m uvicorn app.main:app --reload --port 8000
```

The API listens on `http://localhost:8000`. Visit `http://localhost:8000/health` to check that it is running. The health route reports service and version identity; it does not run an optimization.

### Terminal 2: web app

```powershell
Set-Location frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. The development page defaults to the API at `http://localhost:8000`. For a different API address, set `NEXT_PUBLIC_BACKEND_URL` before starting Next.js. This is public browser configuration; never put credentials or secrets in a `NEXT_PUBLIC_` variable.

The backend's `ALLOWED_ORIGINS` setting is a JSON array of exact browser origins. Keep it paired with the frontend URL; do not use a wildcard. Local development defaults to `http://localhost:3000`.

## Checks

Run these from the repository root after installing the development dependencies:

```powershell
Push-Location backend
& .venv/Scripts/python.exe -m pytest
Pop-Location

Push-Location frontend
npm run typecheck
npm run build
Pop-Location
```

The backend test suite reads the shared fixture at `contracts/sample-request.json` and covers known sample results, validation, transport limits, CORS, version handling, shortages, and solver failure behavior. The frontend typecheck and production build verify the Next.js application.

## API and sample contract

The browser sends a JSON `POST /api/v1/optimize` request to the separate FastAPI service. The API checks the transport and version, validates the submitted model independently, checks whether minimum orders exceed available resources, then runs the bounded continuous optimization when feasible. A successful response is either an `optimal` plan or an `infeasible` shortage list; a failed calculation is returned as a safe error and is not presented as an optimal plan.

`contracts/sample-request.json` is the readable example of the version 1 request shape. It uses decimal strings for user-entered values, the fixed blend IDs, recipe percentages, ingredient limits, and processing capacity. Backend tests load this file rather than maintaining a separate copy. When intentionally changing the API contract, update the fixture, backend validation/tests, frontend request/response handling, and the version requirements in the TRD together. Do not change the fixture merely to make a test pass without checking the approved model and expected solution.

See [the TRD API contract](docs/Production_Planner_TRD.md#10-api-contracts) for normative request and response fields, numeric rules, error handling, and versioning. The API is anonymous and stateless; scenario names and saved scenarios stay in the browser in a later capability.

## Model and limitations

The optimizer uses SciPy `linprog` with the HiGHS method. It treats production quantities as continuous litres and maximizes the entered contribution per litre for one day. It assumes fixed recipes, one litre of input juice per litre of finished juice, no production waste, constant per-litre contribution and processing time, and saleable production up to each demand limit. Contribution is not a promise of overall business profit. Sample values are fictional teaching data, not actual producer costs or recipes.

The current public Vercel deployments are feasibility previews, not a production release. Hosting evidence and unresolved limits are recorded in [the hosting spike evidence](docs/hosting-spike-evidence.md). The full feature roadmap is in [progress.md](progress.md).
