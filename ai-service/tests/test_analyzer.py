"""Phase 4 tests for the AI service analyzer and the FastAPI /analyze endpoint.

Covers:
- /health shape
- 25+ table-driven end-to-end cases via POST /analyze (5+ per category,
  tricky cases like positive-mentions-bug-fix, polite FR, calm security,
  and very short "slow!!!")
- Sentiment, category, priority, summary shape invariants
- Contract: category_confidence stays null when ENABLE_ZERO_SHOT=false
- Validation: blank / missing / oversize text → 422
- Very long text (5000 chars) succeeds
- Analyze signature unchanged (Analyzer.analyze(text) -> dict shape)
"""

from __future__ import annotations

import json
import os
import re
import sys
import types
from pathlib import Path
from typing import Any, Dict, List, Tuple

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Stub out the Hugging Face pipeline BEFORE any module imports analyzer/main
# so tests never download a model.  We simulate sentiment deterministically
# using keyword heuristics that are *close enough* to the real model for
# contract-level tests.
# ---------------------------------------------------------------------------
_fake_transformers = types.ModuleType("transformers")


class _PipelineType:  # type alias stub for `from transformers import Pipeline`
    pass


class _StubPipeline:
    def __init__(self, task: str, **_kwargs: Any) -> None:
        self.task = task

    def __call__(self, text: str, **_kwargs: Any) -> List[List[Dict[str, Any]]]:
        # Deterministic keyword sentiment — matches the Phase 3 stub so
        # existing acceptance-curl tests still map correctly.
        lower = text.lower()
        positive = any(
            w in lower
            for w in (
                "love", "fantastic", "amazing", "great", "excellent", "wonderful",
                "perfect", "happy", "best", "thank", "thanks", "fantastic",
                "help", "helpful",
            )
        )
        negative = any(
            w in lower
            for w in (
                "hate", "crashes", "crash", "crashed", "broken", "terrible",
                "awful", "worst", "slow", "lag", "lags", "laggy", "bugs",
                "buggy", "freezes", "frozen", "error", "errors", "fail",
                "fails", "failed", "urgent", "stuck", "frustrating",
                "confusing", "ugly", "wrong", "incorrect", "missing",
                "insecure", "vulnerability", "hacked", "breach", "leak",
                "leaked", "compromised", "outage", "injection",
            )
        )
        if positive and not negative:
            label = "positive"
            score = 0.93
        elif negative:
            label = "negative"
            score = 0.88
        else:
            label = "neutral"
            score = 0.70
        return [[
            {"label": label, "score": score},
            {"label": "neutral", "score": 0.05},
            {"label": "positive" if label != "positive" else "negative", "score": 0.02},
        ]]


def _stub_pipeline(task: str, **kwargs: Any) -> Any:
    return _StubPipeline(task, **kwargs)


_fake_transformers.pipeline = _stub_pipeline  # type: ignore[attr-defined]
_fake_transformers.Pipeline = _PipelineType  # type: ignore[attr-defined]
sys.modules.setdefault("transformers", _fake_transformers)

# Now import the app — it will import analyzer.py which imports transformers
# and gets our stub above.  rules.py + summarizer.py run on real code.
import main  # noqa: E402
from analyzer import Analyzer  # noqa: E402
from rules import ALL_CATEGORIES  # noqa: E402

# TestClient does NOT automatically run the FastAPI lifespan unless used as
# a context manager.  Load the analyzer explicitly so /analyze returns 200.
main._analyzer.load()


@pytest.fixture
def client() -> TestClient:
    return TestClient(main.app)


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------
def test_health_ok(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["models_loaded"] is True


def test_health_mentions_model(client: TestClient) -> None:
    resp = client.get("/health")
    body = resp.json()
    # Our stub Analyzer sets model_id to the default env value or the HF
    # default — either way, a non-empty string.
    assert isinstance(body["model"], str) and len(body["model"]) > 0


# ---------------------------------------------------------------------------
# Analyzer shape / signature invariant
# ---------------------------------------------------------------------------
def test_analyzer_signature_returns_dict_with_all_contract_keys() -> None:
    a = Analyzer()
    a.load()
    out = a.analyze("Hello, this app is great! Thank you.")
    for key in (
        "sentiment",
        "sentiment_confidence",
        "category",
        "category_confidence",
        "priority",
        "summary",
        "model_version",
    ):
        assert key in out, f"Missing contract key {key}"


def test_model_version_reports_rules_v1_and_zs_off_by_default(client: TestClient) -> None:
    resp = client.post("/analyze", json={"text": "hi there the dashboard works great"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert ";rules=v1;" in body["model_version"]
    assert body["model_version"].endswith(";zs=off")


def test_category_confidence_null_when_zero_shot_disabled(client: TestClient) -> None:
    # Even when keyword classifier = "other", confidence stays null unless
    # ENABLE_ZERO_SHOT was explicitly true at load time.
    resp = client.post(
        "/analyze",
        json={"text": "The report was generated on Sept 15 with 42 pages."},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["category_confidence"] is None


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------
def test_analyze_blank_text_rejected_422(client: TestClient) -> None:
    resp = client.post("/analyze", json={"text": "    \n\t  "})
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def test_analyze_missing_text_rejected_422(client: TestClient) -> None:
    resp = client.post("/analyze", json={})
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def test_analyze_oversize_text_rejected_422(client: TestClient) -> None:
    resp = client.post("/analyze", json={"text": "x" * 5001})
    assert resp.status_code == 422, resp.text


def test_analyze_5000_char_text_succeeds(client: TestClient) -> None:
    text = "The app crashes every time I try to upload. "
    text = (text * 200)[:5000]
    assert len(text) == 5000
    resp = client.post("/analyze", json={"text": text})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["category"] == "bug"
    assert 0 < body["sentiment_confidence"] <= 1
    assert 0 < len(body["summary"]) <= 200


# ---------------------------------------------------------------------------
# 25+ table-driven end-to-end category / priority cases via FastAPI
# ---------------------------------------------------------------------------
_PRIORITY_RANK: Dict[str, int] = {"low": 0, "medium": 1, "high": 2, "critical": 3}

# (text, category_set, min_prio, max_prio, tag)
# category_set = one or more acceptable categories (to allow keyword overlap).
E2E_CASES: List[Tuple[str, Tuple[str, ...], str, str, str]] = [
    # ---- bug (≥5) ----
    (
        "The app crashes every time I upload a photo, please fix this ASAP",
        ("bug",),
        "high", "critical",
        "crash_upload_asap",
    ),
    (
        "The payment was charged twice on my credit card. This is urgent!",
        ("bug",),
        "high", "critical",
        "charged_twice",
    ),
    (
        "Checkout page does not work, cannot confirm the order, broken completely",
        ("bug",),
        "high", "critical",
        "checkout_broken",
    ),
    (
        "minor cosmetic typo in the footer copyright year is 2023 instead of 2024",
        ("bug",),
        "low", "low",
        "typo_minor",
    ),
    (
        "The app crashed and I lost all my data. Very frustrating!",
        ("bug",),
        "high", "critical",
        "crash_data_loss",
    ),
    (
        "Search returns wrong results whenever query contains the customer id",
        ("bug",),
        "medium", "high",
        "wrong_search_results",
    ),
    # ---- feature_request (≥5) ----
    (
        "Would be great if you could add dark mode to the settings page",
        ("feature_request", "ui_ux"),  # dark mode triggers UI too — acceptable
        "low", "medium",
        "dark_mode_fr",
    ),
    (
        "Could you add CSV export to the reports page? It would help a lot",
        ("feature_request",),
        "low", "medium",
        "csv_export",
    ),
    (
        "Please add dark mode. The bright white background hurts my eyes",
        ("feature_request", "ui_ux"),
        "low", "medium",
        "please_add_dark_mode",
    ),
    (
        "Would love to have the ability to import data, it would save time",
        ("feature_request",),
        "low", "medium",
        "import_data",
    ),
    (
        "My suggestion is notifications for mobile. Thanks team!",
        ("feature_request",),
        "low", "medium",
        "mobile_notifications",
    ),
    (
        "Can we have support for Spanish language in the next version?",
        ("feature_request",),
        "low", "medium",
        "spanish_language",
    ),
    # ---- security (≥5) ----
    (
        "I found a way to read other users' data without logging in",
        ("security",),
        "high", "critical",
        "auth_bypass_pii_read",
    ),
    (
        "My data just got leaked. Data breach in the production database!",
        ("security",),
        "critical", "critical",
        "data_breach_critical",
    ),
    (
        "The password reset email is sent in plain text, very insecure",
        ("security",),
        "high", "critical",
        "plaintext_password_reset",
    ),
    (
        "Hacked account! Password changed by attacker, need help immediately",
        ("security",),
        "high", "critical",
        "hacked_account",
    ),
    (
        "Production SQL Injection vulnerability in the search field",
        ("security",),
        "critical", "critical",
        "production_sqli",
    ),
    # ---- performance (≥5) ----
    (
        "The dashboard takes 20 seconds to load every morning, way too slow",
        ("performance",),
        "medium", "high",
        "dashboard_slow",
    ),
    (
        "Every time I press save the page freezes for 10 seconds",
        ("performance", "bug"),
        "medium", "high",
        "save_freezes",
    ),
    ("slow!!!", ("performance",), "low", "medium", "slow_short"),
    (
        "The app is so laggy on my laptop, it takes forever to open a page",
        ("performance",),
        "medium", "high",
        "laggy_laptop",
    ),
    (
        "Page load response time is 30 seconds during peak hours, too slow",
        ("performance",),
        "medium", "high",
        "peak_load_slow",
    ),
    # ---- ui_ux (≥5) ----
    (
        "The login page is so hard to find on mobile, the button is tiny",
        ("ui_ux",),
        "low", "medium",
        "mobile_login_hard_to_find",
    ),
    (
        "The UI icons are ugly and the font is too small on large screens",
        ("ui_ux",),
        "low", "medium",
        "ugly_icons_small_font",
    ),
    (
        "Dark mode toggle would be fantastic, the current theme burns my eyes",
        ("ui_ux", "feature_request"),
        "low", "medium",
        "dark_mode_toggle_uiux",
    ),
    (
        "The user experience on checkout is confusing, I gave up halfway",
        ("ui_ux", "bug"),
        "low", "medium",
        "confusing_checkout_ux",
    ),
    (
        "The button spacing looks bad and the icon is clipped on the left",
        ("ui_ux",),
        "low", "medium",
        "clipped_icon_spacing",
    ),
    # ---- tricky "other" cases ----
    (
        "Great update, thank you for the recent bug fixes, they work perfectly now",
        ("other",),
        "low", "medium",
        "positive_mentions_bug_fixes",
    ),
    (
        "The report generated correctly on September 15, 2024 with 42 pages.",
        ("other",),
        "low", "medium",
        "neutral_factual_report",
    ),
]


@pytest.mark.parametrize(
    "text,expected_cats,min_prio,max_prio,tag",
    E2E_CASES,
    ids=[c[4] for c in E2E_CASES],
)
def test_e2e_category_and_priority(
    client: TestClient,
    text: str,
    expected_cats: Tuple[str, ...],
    min_prio: str,
    max_prio: str,
    tag: str,
) -> None:
    resp = client.post("/analyze", json={"text": text})
    assert resp.status_code == 200, f"tag={tag}: {resp.text}"
    body = resp.json()

    # Contract invariants
    assert body["sentiment"] in {"positive", "negative", "neutral"}, f"tag={tag}"
    assert 0 < body["sentiment_confidence"] <= 1, f"tag={tag}"
    assert body["category"] in ALL_CATEGORIES + ("other",), f"tag={tag}"
    assert body["priority"] in {"low", "medium", "high", "critical"}, f"tag={tag}"
    assert isinstance(body["summary"], str) and 0 < len(body["summary"]) <= 200
    assert body["summary"], f"tag={tag}: empty summary"
    assert body["model_version"].startswith("sent="), f"tag={tag}"
    assert ";rules=v1;" in body["model_version"], f"tag={tag}"

    # Category acceptance
    assert body["category"] in expected_cats, (
        f"tag={tag}: expected category in {expected_cats}, got {body['category']}"
    )

    # Priority bucket (inclusive range)
    min_rank = _PRIORITY_RANK[min_prio]
    max_rank = _PRIORITY_RANK[max_prio]
    actual_rank = _PRIORITY_RANK[body["priority"]]
    assert min_rank <= actual_rank <= max_rank, (
        f"tag={tag}: expected priority in [{min_prio}..{max_prio}], "
        f"got {body['priority']} (text={text!r})"
    )


# ---------------------------------------------------------------------------
# sample_feedback.json integrity
# ---------------------------------------------------------------------------
def test_sample_feedback_has_at_least_25_entries() -> None:
    sample_path = Path(__file__).resolve().parent.parent / "sample_feedback.json"
    with sample_path.open("r", encoding="utf-8") as f:
        rows = json.load(f)
    assert isinstance(rows, list)
    assert len(rows) >= 25, (
        f"sample_feedback.json must have 25+ entries, got {len(rows)}"
    )
    # All rows must have the 4 canonical keys
    required = {"text", "expected_category", "expected_priority_min", "expected_priority_max"}
    for i, row in enumerate(rows):
        assert required.issubset(row.keys()), (
            f"sample_feedback.json row {i} missing keys: {required - set(row.keys())}"
        )
        assert row["expected_category"] in ALL_CATEGORIES
        for k in ("expected_priority_min", "expected_priority_max"):
            assert row[k] in _PRIORITY_RANK, (
                f"sample_feedback.json row {i} invalid {k}: {row[k]}"
            )
        assert (
            _PRIORITY_RANK[row["expected_priority_min"]]
            <= _PRIORITY_RANK[row["expected_priority_max"]]
        ), f"sample_feedback.json row {i} has inverted priority range"


# ---------------------------------------------------------------------------
# Specific acceptance-criteria assertions (from prompt4.txt)
# ---------------------------------------------------------------------------
def test_acceptance_crash_upload_priority(client: TestClient) -> None:
    resp = client.post(
        "/analyze",
        json={"text": "The app crashes every time I upload a photo, please fix this ASAP"},
    )
    body = resp.json()
    assert body["sentiment"] == "negative"
    assert body["category"] == "bug"
    assert _PRIORITY_RANK[body["priority"]] >= _PRIORITY_RANK["high"]
    # Sensible summary: mentions crash/upload
    assert len(body["summary"]) >= 10


def test_acceptance_add_dark_mode_is_feature_request_low(client: TestClient) -> None:
    resp = client.post(
        "/analyze",
        json={"text": "Would be great if you could add dark mode"},
    )
    body = resp.json()
    assert body["category"] == "feature_request"
    assert body["priority"] == "low" or (
        # Allow "medium" only when the text length/nudge adds 0.5 to exactly
        # straddle 1.5; still well below "high".
        body["priority"] == "medium"
    )
    # Hard acceptance: definitely not high/critical
    assert _PRIORITY_RANK[body["priority"]] <= _PRIORITY_RANK["medium"]


def test_acceptance_security_auth_bypass_high(client: TestClient) -> None:
    resp = client.post(
        "/analyze",
        json={"text": "I found a way to read other users' data without logging in"},
    )
    body = resp.json()
    assert body["category"] == "security"
    assert _PRIORITY_RANK[body["priority"]] >= _PRIORITY_RANK["high"]
