import logging
import time
from contextlib import asynccontextmanager
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from analyzer import Analyzer

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai-service")

_analyzer = Analyzer()


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001 - app required by signature
    logger.info("Loading sentiment model on startup...")
    start = time.perf_counter()
    try:
        _analyzer.load()
    except Exception as exc:  # pragma: no cover - startup path, surfaced via /health
        logger.exception("Failed to load model: %s", exc)
    elapsed = time.perf_counter() - start
    logger.info(
        "Model load complete in %.2fs. loaded=%s model=%s",
        elapsed,
        _analyzer.is_loaded,
        _analyzer.model_id,
    )
    yield
    logger.info("AI service shutting down.")


app = FastAPI(title="FeedbackIQ AI Service", version="0.4.0", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Feedback text to analyze")

    @field_validator("text", mode="after")
    @classmethod
    def reject_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text must not be blank")
        return value


class AnalyzeResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    sentiment: str
    sentiment_confidence: float
    category: str
    category_confidence: float | None
    priority: str
    summary: str
    model_version: str


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    model: str | None


# ---------------------------------------------------------------------------
# Middleware: request timing + consistent JSON errors
# ---------------------------------------------------------------------------
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Unhandled error in %s %s", request.method, request.url.path)
        response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred in the AI service",
                }
            },
        )
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    logger.info(
        "%s %s -> %s (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    code = {
        status.HTTP_422_UNPROCESSABLE_ENTITY: "VALIDATION_ERROR",
        status.HTTP_404_NOT_FOUND: "NOT_FOUND",
        status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
        status.HTTP_500_INTERNAL_SERVER_ERROR: "INTERNAL_ERROR",
    }.get(exc.status_code, f"HTTP_{exc.status_code}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": code, "message": exc.detail}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    """Return a consistent {error: {code, message, details}} body for 422s."""
    details = []
    for err in exc.errors():
        loc = ".".join(str(p) for p in err.get("loc", []) if p != "body") or "body"
        details.append({"field": loc, "message": err.get("msg", "Invalid value")})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": details,
            }
        },
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse)
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "models_loaded": _analyzer.is_loaded,
        "model": _analyzer.model_id or None,
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(payload: AnalyzeRequest) -> Dict[str, Any]:
    if not _analyzer.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sentiment model is not loaded yet",
        )
    try:
        return _analyzer.analyze(payload.text)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Analyzer failed for text of length %d", len(payload.text))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Analysis failed",
        ) from exc
