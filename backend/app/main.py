"""Public FastAPI entry point for the hosting feasibility spike."""

import json
import logging
import os
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .optimizer import CalculationError, CalculationTimeout, optimize
from .validation import InputError, validate_inputs

API_VERSION = 1
MODEL_VERSION = "juice-day-v1"
MAX_REQUEST_BYTES = 16384


def allowed_origins() -> list[str]:
    raw = os.environ.get("ALLOWED_ORIGINS", '["http://localhost:3000"]')
    value = json.loads(raw)
    if not isinstance(value, list) or not value or any(
        not isinstance(origin, str) or not origin.startswith(("https://", "http://localhost:"))
        or "*" in origin for origin in value
    ):
        raise RuntimeError("ALLOWED_ORIGINS must be a nonempty JSON array of exact origins")
    return value


app = FastAPI(title="Production Planner API", docs_url=None, redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins(),
                   allow_credentials=False, allow_methods=["GET", "POST"],
                   allow_headers=["Content-Type"])
logger = logging.getLogger("production_planner")
PROCESS_INSTANCE_ID = uuid4().hex


def error_response(status: int, code: str, message: str, request_id: str,
                   fields: list[dict[str, str]] | None = None) -> JSONResponse:
    error = {"code": code, "message": message}
    if fields:
        error["fields"] = fields
    return JSONResponse(status_code=status,
        content={"request_id": request_id, "error": error},
        headers={"Cache-Control": "no-store"})


@app.get("/health")
def health() -> dict:
    return {"status": "ready", "api_version": API_VERSION,
            "model_version": MODEL_VERSION,
            "build_id": (os.environ.get("VERCEL_DEPLOYMENT_ID")
                         or os.environ.get("VERCEL_GIT_COMMIT_SHA")
                         or os.environ.get("VERCEL_URL") or "local")}


@app.post("/api/v1/optimize")
async def calculate(request: Request) -> JSONResponse:
    request_id = str(uuid4())
    started = perf_counter()
    outcome = "error"
    error_code = None
    error_class = None
    try:
        media_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
        if media_type != "application/json" or request.headers.get("content-encoding", "identity") != "identity":
            error_code = "UNSUPPORTED_MEDIA_TYPE"
            return error_response(415, error_code, "Send an uncompressed JSON request.", request_id)
        content_length = request.headers.get("content-length")
        if content_length:
            count = content_length.lstrip("0") or "0"
            if not count.isascii() or not count.isdecimal() or len(count) > 5 or int(count) > MAX_REQUEST_BYTES:
                error_code = "PAYLOAD_TOO_LARGE"
                return error_response(413, error_code, "The request exceeds 16 KiB.", request_id)
        body = bytearray()
        async for chunk in request.stream():
            if len(body) + len(chunk) > MAX_REQUEST_BYTES:
                error_code = "PAYLOAD_TOO_LARGE"
                return error_response(413, error_code, "The request exceeds 16 KiB.", request_id)
            body.extend(chunk)
        try:
            payload = json.loads(body)
        except (UnicodeDecodeError, json.JSONDecodeError):
            error_code = "INVALID_JSON"
            return error_response(400, error_code, "The JSON request could not be read.", request_id)
        if isinstance(payload, dict) and "model_version" in payload and payload["model_version"] != MODEL_VERSION:
            error_code = "MODEL_VERSION_MISMATCH"
            return error_response(409, error_code, "Refresh for the current model version.", request_id)
        try:
            model = validate_inputs(payload)
        except InputError as exc:
            error_code = "VALIDATION_ERROR"
            return error_response(422, error_code, "Correct the highlighted fields.",
                                  request_id, exc.fields)
        try:
            result = optimize(model)
        except CalculationTimeout:
            error_code = "CALCULATION_TIMEOUT"
            return error_response(503, error_code, "Calculation timed out. Please retry.", request_id)
        except CalculationError:
            error_code = "CALCULATION_ERROR"
            return error_response(500, error_code, "Calculation failed. Please retry.", request_id)
        outcome = result["status"]
        return JSONResponse(content={"api_version": API_VERSION,
            "model_version": MODEL_VERSION, "request_id": request_id,
            "duration_ms": round((perf_counter() - started) * 1000, 3), **result},
            headers={"Cache-Control": "no-store"})
    except Exception as exc:
        error_code = "INTERNAL_ERROR"
        error_class = type(exc).__name__
        return error_response(500, error_code, "Calculation is unavailable. Please retry.", request_id)
    finally:
        logger.info(json.dumps({"event": "calculation", "request_id": request_id,
            "outcome": outcome, "error_code": error_code, "error_class": error_class,
            "process_instance_id": PROCESS_INSTANCE_ID,
            "duration_ms": round((perf_counter() - started) * 1000, 3)}))
