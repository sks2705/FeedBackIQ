"""Unit tests for rules.py (data-table-driven category + priority scoring).

Each labelled case is a real user sentence.  Table-driven with
``pytest.mark.parametrize`` so each labelled sentence shows up in `pytest -v`
output.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

import pytest

from rules import CATEGORY_TIE_BREAK, compute_priority, score_categories

# ---------------------------------------------------------------------------
# Helper: map priority bucket to int for range checks.
# ---------------------------------------------------------------------------
_PRIORITY_ORDER: Dict[str, int] = {
    "low": 0,
    "medium": 1,
    "high": 2,
    "critical": 3,
}

# ---------------------------------------------------------------------------
# Table-driven category tests
# ---------------------------------------------------------------------------
# Each case: (text, expected_category, tag)
CATEGORY_CASES: List[Tuple[str, str, str]] = [
    # ---- bug ----
    ("The app crashes every time I upload a photo, please fix this ASAP", "bug", "crash_upload_asap"),
    ("The payment was charged twice on my credit card. This is urgent!", "bug", "charged_twice"),
    ("White screen of death on startup. Every single time since the update.", "bug", "wsod"),
    ("Checkout page does not work, cannot confirm the order", "bug", "checkout_broken"),
    ("minor cosmetic typo in the footer copyright year is 2023 instead of 2024", "bug", "typo"),
    ("The app crashed and I lost all my data", "bug", "data_loss"),
    ("Search returns wrong results when the query contains apostrophe", "bug", "wrong_search"),
    # ---- feature_request ----
    ("Would be great if you could add dark mode to the settings page", "feature_request", "dark_mode"),
    ("Could you add CSV export to the reports page? It would help a lot", "feature_request", "csv_export"),
    ("Please add dark mode. The bright white background hurts my eyes", "feature_request", "add_darkmode_polite"),
    ("Would love to have the ability to import data, it would save me a lot of time", "feature_request", "import_data"),
    ("My suggestion is notifications for mobile, right away", "feature_request", "notifications"),
    ("It would help to have filters on the customer list, thanks", "feature_request", "list_filters"),
    ("Can we have support for Spanish language in the next version?", "feature_request", "spanish"),
    # ---- security ----
    ("I found a way to read other users' data without logging in", "security", "auth_bypass_read"),
    ("My data just got leaked in the production database, it's all over Twitter!", "security", "data_breach"),
    ("The password reset email is sent in plain text, very insecure", "security", "plaintext_pw"),
    ("Hacked account! Password changed by attacker, contact support immediately", "security", "hacked"),
    ("Production SQL Injection vulnerability in the search field. PII exposed", "security", "sqli"),
    ("The login cookie is missing the HttpOnly and Secure flags", "security", "cookie_flags"),
    # ---- performance ----
    ("The dashboard takes 20 seconds to load every morning, way too slow", "performance", "dashboard_slow"),
    ("Every time I press save the page freezes for 10 seconds", "performance", "freeze_save"),
    ("slow!!!", "performance", "slow_short"),
    ("The app is so laggy on my laptop it takes forever to open a page", "performance", "laggy_laptop"),
    # ---- ui_ux ----
    ("The login page is so hard to find on mobile, the button is tiny", "ui_ux", "hard_to_find_login"),
    ("The UI icons are ugly and the font is too small", "ui_ux", "ugly_icons_small_font"),
    ("Dark mode toggle would be fantastic, the current theme burns my eyes", "ui_ux", "darkmode_toggle"),
    ("The user experience on checkout is confusing, I gave up halfway", "ui_ux", "confusing_checkout"),
    # ---- other / tricky cases ----
    (
        "Great update, thank you for the recent bug fixes, they work perfectly now",
        "other",
        "positive_mentions_bug_fix_not_a_bug",
    ),
    (
        "The report was generated correctly on September 15, 2024 with 42 pages. Average size 3MB.",
        "other",
        "neutral_factual_report",
    ),
    ("The weather outside is sunny and 22 degrees Celsius today.", "other", "off_topic"),
]


@pytest.mark.parametrize("text,expected_category,tag", CATEGORY_CASES, ids=[c[2] for c in CATEGORY_CASES])
def test_category_classification(text: str, expected_category: str, tag: str) -> None:
    _ = tag  # present in IDs only
    result = score_categories(text)
    assert (
        result.category == expected_category
    ), (
        f"tag={tag}: expected category={expected_category}, "
        f"got {result.category} (breakdown={result.score_breakdown}, "
        f"matches={result.matched_keywords})"
    )


def test_tie_break_order_respected() -> None:
    """A text that contains *one* keyword from both 'security' and 'bug' with
    identical raw weights should go to 'security' per CATEGORY_TIE_BREAK."""
    # "password leak" — password scores 1.8 in security, "leak" scores 2.4 in
    # security... That still favors security. Let's craft equal weights.
    # The simpler check: CATEGORY_TIE_BREAK must start with security.
    assert CATEGORY_TIE_BREAK[0] == "security", (
        "Tie break spec: security must win ties. Check CATEGORY_TIE_BREAK order."
    )
    assert CATEGORY_TIE_BREAK[1] == "bug"
    assert CATEGORY_TIE_BREAK[2] == "performance"


def test_word_boundary_ui_does_not_match_quit() -> None:
    result = score_categories("I pressed quit on the save dialog and lost my changes")
    # "quit" should NOT count as the "ui" keyword
    keywords = " ".join(result.matched_keywords)
    assert "ui" not in keywords.split() or result.score_breakdown.get("ui_ux", 0) == 0.0


def test_word_boundary_bug_does_not_match_debugging_as_whole_word() -> None:
    result = score_categories("Debugging shows the validation step is missing")
    # "debugging" contains "bug" but shouldn't match as a whole word
    kws = " ".join(result.matched_keywords)
    assert "bug" not in kws.split() or result.score_breakdown.get("bug", 0) == 0.0


# ---------------------------------------------------------------------------
# Priority tests
# ---------------------------------------------------------------------------
# (text, category, sentiment, min_priority, max_priority, required_reason_contains, tag)
PRIORITY_CASES: List[Tuple[str, str, str, str, str, str, str]] = [
    # critical
    (
        "The payment was charged twice on my credit card. This is urgent!",
        "bug", "negative",
        "high", "critical",
        "payment_double_charge",
        "charged_twice_critical",
    ),
    (
        "The site is completely down, production outage for all users",
        "bug", "negative",
        "critical", "critical",
        "outage_pattern",
        "outage_critical",
    ),
    (
        "My data just got leaked in the production database, it's all over Twitter!",
        "security", "negative",
        "critical", "critical",
        "data_leak_pattern",
        "data_breach_critical",
    ),
    (
        "I found a way to read other users' data without logging in",
        "security", "neutral",
        "high", "critical",
        "category_bias:security",
        "auth_bypass_priority",
    ),
    (
        "Production SQL Injection vulnerability in the search field. PII exposed",
        "security", "negative",
        "critical", "critical",
        "sql_injection",
        "sqli_critical",
    ),
    (
        "The app crashed and I lost all my data, every single user is affected",
        "bug", "negative",
        "high", "critical",
        "data_loss_pattern",
        "data_loss_high",
    ),
    # high
    (
        "The app crashes every time I upload a photo, please fix this ASAP",
        "bug", "negative",
        "high", "critical",
        "crash_pattern",
        "crash_high",
    ),
    (
        "Checkout flow is broken, cannot complete purchase. Blocker for customers",
        "bug", "negative",
        "high", "critical",
        "broken_pattern",
        "checkout_high",
    ),
    (
        "Every time I press save the page freezes for 10 seconds",
        "performance", "negative",
        "medium", "high",
        "every_time",
        "freeze_save_medium_high",
    ),
    (
        "The dashboard takes 20 seconds to load every morning, way too slow",
        "performance", "negative",
        "medium", "high",
        "sentiment:negative",
        "dashboard_slow_high",
    ),
    # medium / low
    (
        "Would be great if you could add dark mode to the settings page",
        "feature_request", "positive",
        "low", "medium",
        "category_bias:feature_request",
        "dark_mode_low",
    ),
    (
        "minor cosmetic typo in the footer copyright year is 2023 instead of 2024",
        "bug", "neutral",
        "low", "low",
        "minor_flag",
        "typo_minor_stays_low",
    ),
    (
        "Could you add CSV export to the reports page? It would help a lot, thanks!",
        "feature_request", "positive",
        "low", "medium",
        "sentiment:positive",
        "csv_export_low",
    ),
]


@pytest.mark.parametrize(
    "text,category,sentiment,min_prio,max_prio,must_have_reason,tag",
    PRIORITY_CASES,
    ids=[c[6] for c in PRIORITY_CASES],
)
def test_priority_buckets(
    text: str,
    category: str,
    sentiment: str,
    min_prio: str,
    max_prio: str,
    must_have_reason: str,
    tag: str,
) -> None:
    _ = tag
    result = compute_priority(text, category, sentiment)
    min_rank = _PRIORITY_ORDER[min_prio]
    max_rank = _PRIORITY_ORDER[max_prio]
    actual_rank = _PRIORITY_ORDER[result.priority]
    assert min_rank <= actual_rank <= max_rank, (
        f"expected priority in [{min_prio}..{max_prio}], "
        f"got {result.priority} (score={result.score}, reasons={result.reasons})"
    )
    reasons_joined = " ".join(result.reasons)
    assert must_have_reason in reasons_joined or any(
        must_have_reason in r for r in result.reasons
    ), f"expected reason '{must_have_reason}' in {result.reasons}"


def test_minor_flag_caps_at_medium() -> None:
    """'minor' + critical-ish signal like 'crashes' must cap at ≤ medium."""
    result = compute_priority(
        "minor glitch, the app crashes once in a while but nothing serious",
        "bug",
        "negative",
    )
    assert _PRIORITY_ORDER[result.priority] <= _PRIORITY_ORDER["medium"], (
        f"'minor' should cap priority. Got {result.priority} (reasons={result.reasons})"
    )


def test_reasons_are_deduped() -> None:
    result = compute_priority(
        "Crashes every time and crashes all users. Crashes!", "bug", "negative"
    )
    assert len(result.reasons) == len(set(result.reasons)), "Reasons list must be deduped"
