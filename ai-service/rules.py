"""Data tables + deterministic rules for category and priority classification.

All tables are plain Python constants so you can add a keyword, phrase, or
pattern in ONE place and see behaviour change immediately.  No scattered
``if`` trees.

Category matching
-----------------
``CATEGORY_KEYWORDS`` maps each category to a list of *words* and
*phrases*.  Each match contributes the keyword's weight to the category
score (phrases weigh more than single words, per the spec).  Scores are
normalised by word count so a long text doesn't blow up the scale.

Tie-break order (highest first) when two categories reach the same score:
    security > bug > performance > feature_request > ui_ux > other

Word boundaries: ``\b…\b`` ensures "ui" does NOT match inside "quit",
"bug" does NOT match inside "debugging" in the middle of a word, etc.
Phrases are matched on substring with token-boundary at both ends when
possible; very short phrases use a word-window check to avoid false
substrings.

Priority detection
------------------
Priority is driven by *combined signals*, never by sentiment alone:

1. CRITICAL_PATTERNS   → data loss, breach, hacked, outage, charged twice…
2. HIGH_PATTERNS       → crash, broken, error, fails, blocker, unusable…
3. URGENCY_PATTERNS    → every time, all users, immediately, asap, urgent…
4. Category severity bias (security/bug raise, feature/ui/other lower)
5. Sentiment modifier  → negative nudges up, positive nudges down
6. Explicit modifiers: "minor" / "tiny" / "cosmetic" force ≤ medium.

Resulting buckets:  critical | high | medium | low
``priority_reasons`` lists every signal that fired so debugging is easy.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Sequence, Tuple


# ---------------------------------------------------------------------------
# 1. CATEGORY KEYWORDS
# ---------------------------------------------------------------------------
# Each entry is (term, weight).  Phrases (contain a space) get a higher
# default weight than single words because they express a stronger intent.

CATEGORY_KEYWORDS: Dict[str, List[Tuple[str, float]]] = {
    "ui_ux": [
        # single words
        ("ui", 1.0),
        ("ux", 1.0),
        ("design", 1.0),
        ("layout", 1.0),
        ("colour", 0.8),
        ("color", 0.8),
        ("font", 0.8),
        ("button", 0.7),
        ("icon", 0.7),
        ("responsive", 0.8),
        ("mobile", 0.6),
        ("theme", 0.8),
        ("ugly", 1.2),
        ("clunky", 1.2),
        ("confusing", 1.2),
        ("aesthetic", 0.7),
        ("spacing", 0.6),
        # phrases
        ("dark mode", 2.5),
        ("light mode", 2.2),
        ("hard to find", 2.8),
        ("hard to use", 2.8),
        ("easy to use", 2.5),
        ("difficult to navigate", 3.0),
        ("user interface", 2.5),
        ("user experience", 2.5),
        ("looks bad", 2.2),
        ("looks great", 2.2),
        ("font size", 2.0),
        ("log in", 1.5),
        ("login page", 2.0),
        ("sign in", 1.5),
    ],
    "performance": [
        # single words
        ("slow", 1.8),
        ("fast", 1.4),
        ("lag", 1.6),
        ("lags", 1.6),
        ("laggy", 1.7),
        ("performance", 1.6),
        ("speed", 1.2),
        ("freeze", 1.6),
        ("freezes", 1.6),
        ("frozen", 1.6),
        ("stuck", 1.4),
        ("hang", 1.4),
        ("hangs", 1.4),
        ("load", 0.8),
        ("loading", 1.2),
        ("loaded", 0.8),
        ("cpu", 1.2),
        ("memory", 1.2),
        ("ram", 1.2),
        ("battery", 1.4),
        # phrases
        ("too slow", 3.0),
        ("very slow", 2.8),
        ("takes forever", 2.8),
        ("takes ages", 2.6),
        ("page load", 2.2),
        ("page loads", 2.2),
        ("loading time", 2.4),
        ("response time", 2.4),
        ("high cpu", 2.4),
        ("uses too much memory", 2.8),
        ("drains battery", 2.8),
        ("runs slow", 2.6),
    ],
    "bug": [
        # single words
        ("bug", 1.8),
        ("bugs", 1.6),
        ("buggy", 1.8),
        ("error", 1.6),
        ("errors", 1.4),
        ("fail", 1.4),
        ("fails", 1.6),
        ("failed", 1.4),
        ("failure", 1.5),
        ("break", 1.2),
        ("broken", 2.0),
        ("breaks", 1.5),
        ("crash", 2.2),
        ("crashes", 2.2),
        ("crashed", 2.0),
        ("glitch", 1.6),
        ("glitches", 1.4),
        ("issue", 0.9),
        ("issues", 0.9),
        ("wrong", 1.2),
        ("incorrect", 1.3),
        ("missing", 1.3),
        ("duplicate", 1.4),
        ("typo", 1.0),
        ("regression", 1.8),
        ("defect", 1.8),
        ("unexpected", 1.2),
        # phrases
        ("does not work", 3.0),
        ("doesn't work", 3.0),
        ("does nothing", 2.8),
        ("nothing happens", 2.8),
        ("please fix", 2.4),
        ("need to fix", 2.4),
        ("fix this", 2.3),
        ("keeps crashing", 3.0),
        ("keeps breaking", 2.8),
        ("white screen", 2.6),
        ("blank screen", 2.6),
        ("500 error", 2.6),
        ("404 error", 2.3),
        ("error message", 2.2),
        ("not working", 2.8),
        ("stops working", 2.6),
        ("charged twice", 3.0),
        ("double charge", 3.0),
        ("double charged", 3.0),
    ],
    "feature_request": [
        # single words
        ("feature", 1.6),
        ("features", 1.2),
        ("add", 1.4),
        ("adding", 1.2),
        ("support", 1.1),
        ("wish", 1.6),
        ("wanted", 1.2),
        ("want", 1.3),
        ("needs", 1.2),
        ("need", 1.2),
        ("request", 1.6),
        ("requested", 1.4),
        ("suggest", 1.3),
        ("suggestion", 1.5),
        ("suggestions", 1.3),
        ("idea", 1.2),
        ("improvement", 1.2),
        ("roadmap", 1.4),
        ("api", 0.9),
        ("export", 1.1),
        ("import", 1.1),
        ("notifications", 1.1),
        ("notification", 1.0),
        # phrases
        ("would be great if", 3.2),
        ("would love to", 3.0),
        ("would be nice if", 3.0),
        ("please add", 3.0),
        ("can we have", 2.8),
        ("could you add", 2.9),
        ("it would help to", 2.8),
        ("i wish it had", 3.0),
        ("i suggest", 2.6),
        ("my suggestion is", 2.8),
        ("need the ability to", 2.8),
        ("looking for a way to", 2.8),
        ("ability to", 2.2),
        ("option to", 2.2),
        ("dark mode", 0.0),  # handled by ui_ux; prevents double-weight
    ],
    "security": [
        # single words
        ("security", 2.0),
        ("password", 1.8),
        ("passwords", 1.6),
        ("authentication", 1.8),
        ("auth", 1.2),
        ("login", 1.2),
        ("vulnerability", 2.2),
        ("vulnerabilities", 2.0),
        ("exploit", 2.4),
        ("hacked", 2.6),
        ("hacker", 2.4),
        ("hack", 2.2),
        ("breach", 2.6),
        ("leak", 2.4),
        ("leaked", 2.4),
        ("leaks", 2.2),
        ("data leak", 0.0),  # handled as phrase
        ("privacy", 1.8),
        ("gdpr", 1.6),
        ("encryption", 1.8),
        ("encrypted", 1.6),
        ("2fa", 1.8),
        ("mfa", 1.8),
        ("otp", 1.5),
        ("token", 1.3),
        ("session", 1.2),
        ("cookie", 1.8),
        ("cookies", 1.6),
        ("httponly", 2.0),
        ("samesite", 1.8),
        ("csrf", 2.2),
        ("xss", 2.2),
        ("sql", 1.5),
        ("injection", 2.2),
        ("pii", 2.2),
        # phrases
        ("data leak", 3.5),
        ("data breach", 3.5),
        ("data loss", 3.3),
        ("credit card", 2.6),
        ("without logging in", 3.0),
        ("without login", 2.8),
        ("bypasses auth", 3.0),
        ("bypass authentication", 3.0),
        ("other users data", 3.2),
        ("other users' data", 3.2),
        ("someone else's account", 3.2),
        ("stolen password", 3.0),
        ("plain text password", 3.2),
        ("weak password", 2.4),
        ("reset password", 1.8),
        ("phishing", 2.6),
        ("malware", 2.6),
        ("sql injection", 3.5),
        ("pii exposed", 3.5),
        ("pii leak", 3.5),
        ("without logging in", 3.2),
        ("without login", 3.0),
        ("bypasses auth", 3.0),
        ("bypass authentication", 3.0),
    ],
}

# Categories that are NOT "other", ordered by descending tie-break priority.
CATEGORY_TIE_BREAK: Tuple[str, ...] = (
    "security",
    "bug",
    "performance",
    "feature_request",
    "ui_ux",
)
ALL_CATEGORIES: Tuple[str, ...] = CATEGORY_TIE_BREAK + ("other",)

# Contextual cancellation: when one of these phrases appears in the text,
# the matching single-word signal for that category is cancelled out
# (the phrase implies the opposite / a resolved state).
# E.g. "bug fix" / "bug fixes" should NOT classify as a bug report — it's
# usually praise or a request.  Phrases matched here subtract a fixed
# penalty from that category's score.
CATEGORY_CANCELLATION_PHRASES: Dict[str, List[Tuple[str, float]]] = {
    "bug": [
        ("bug fix", 4.0),
        ("bug fixes", 4.0),
        ("fixed the bug", 4.5),
        ("fixed a bug", 4.5),
        ("fixed the bugs", 4.5),
        ("bug was fixed", 4.5),
        ("resolved the bug", 4.5),
        ("no bugs", 3.5),
        ("no bug", 3.0),
    ],
}


# ---------------------------------------------------------------------------
# 2. PRIORITY PATTERNS
# ---------------------------------------------------------------------------
# (regex_or_phrase, reason_label, score)
# All regexes are compiled with re.IGNORECASE once at import time.

CRITICAL_PATTERNS: Sequence[Tuple[str, str, float]] = (
    (r"\bdata\s+loss\b", "data_loss_pattern", 10.0),
    (r"\blost\s+(?:all\s+)?(?:my\s+)?data\b", "data_loss_pattern", 10.0),
    (r"\bdata\s+breach\b", "breach_pattern", 12.0),
    (r"\bdata\s+leak(?:ed)?\b", "data_leak_pattern", 12.0),
    (r"\bleaked\s+data\b", "data_leak_pattern", 12.0),
    (r"\bhack(?:ed)?\b", "hacked_pattern", 11.0),
    (r"\bcompromised\b", "hacked_pattern", 10.0),
    (r"\bpayment\s+charged\s+twice\b", "payment_double_charge", 11.0),
    (r"\bcharged\s+twice\b", "payment_double_charge", 11.0),
    (r"\b(?:cannot|can't|can not)\s+access\s+(?:at\s+all|anything|the\s+system)\b", "cannot_access_at_all", 11.0),
    (r"\bcompletely\s+(?:unusable|down|broken|inaccessible)\b", "fully_unusable", 10.0),
    (r"\boutage\b", "outage_pattern", 11.0),
    (r"\bproduction\s+down\b", "outage_pattern", 12.0),
    (r"\bsite\s+is\s+down\b", "outage_pattern", 11.0),
    (r"\bserv(?:er|ice)\s+is\s+down\b", "outage_pattern", 11.0),
    (r"\bproduction\s+incident\b", "outage_pattern", 10.0),
    (r"\b(unauthorized|unauthorised)\s+access\b", "security_critical", 11.0),
    (r"\bdata\s+(?:just\s+)?(?:got|been)\s+leaked\b", "data_leak_pattern", 12.0),
    (r"\bleaked\s+data\b", "data_leak_pattern", 11.0),
    (r"\bsql\s+injection\b", "sql_injection", 11.0),
    (r"\bpii\b", "pii_exposure", 5.0),
    (r"\bpii\s+(?:exposed|leaked|breached)\b", "pii_exposure", 11.0),
    (r"\bread\s+(?:other|someone\s+else'?s)\s+users'?\s+data\b", "auth_bypass_read", 11.0),
    (r"\bwithout\s+logging\s+in\b", "auth_bypass", 8.0),
    (r"\bwithout\s+login\b", "auth_bypass", 7.0),
    (r"\bbypass(?:es|ed)?\s+(?:auth|authentication)\b", "auth_bypass", 9.0),
    (r"\bvulnerabilit(?:y|ies)\b", "vulnerability", 3.0),
    (r"\bexploit(?:ed|s)?\b", "exploit", 4.0),
    (r"\bplain\s+text\s+(?:password|credential|token|secret)\b", "plaintext_credential", 8.0),
    (r"\binsecure\b", "insecure", 4.0),
)

HIGH_PATTERNS: Sequence[Tuple[str, str, float]] = (
    (r"\bcrash(?:es|ed)?\b", "crash_pattern", 6.0),
    (r"\bbroken\b", "broken_pattern", 5.5),
    (r"\bfail(?:s|ed|ure)?\b", "fails_pattern", 4.5),
    (r"\berror(?:s|ed)?\b", "error_pattern", 4.0),
    (r"\b(?:cannot|can't|can not)\b", "cannot_pattern", 3.0),
    (r"\bblocker\b", "blocker_pattern", 6.0),
    (r"\bblocking\b", "blocker_pattern", 5.0),
    (r"\bunusable\b", "unusable_pattern", 5.5),
    (r"\burgent\b", "urgency_explicit", 3.5),
    (r"\basap\b", "urgency_asap", 3.0),
    (r"\bas\s+soon\s+as\s+possible\b", "urgency_asap", 3.0),
    (r"\bglitch(?:es)?\b", "glitch_pattern", 3.0),
    (r"\bwrong\b", "wrong_pattern", 2.5),
    (r"\bincorrect\b", "wrong_pattern", 2.5),
    (r"\bnot\s+working\b", "not_working", 5.0),
    (r"\bstops\s+working\b", "not_working", 5.0),
    (r"\bdoesn't\s+work\b", "not_working", 5.0),
    (r"\bdoes\s+not\s+work\b", "not_working", 5.0),
    (r"\brequires\s+reboot\b", "requires_reboot", 4.0),
    (r"\bworkaround\b", "workaround_mentioned", 1.0),  # soft: implies issue
    (r"\bdefect\b", "defect_pattern", 4.0),
    (r"\bregression\b", "regression_pattern", 5.0),
)

URGENCY_AMPLIFIERS: Sequence[Tuple[str, str, float]] = (
    (r"\bevery\s+time\b", "every_time", 2.0),
    (r"\bevery\s+single\s+time\b", "every_time", 2.5),
    (r"\ball\s+users\b", "all_users", 2.5),
    (r"\beveryone\b", "all_users", 1.5),
    (r"\bfor\s+everyone\b", "all_users", 1.8),
    (r"\bimmediately\b", "immediately", 2.5),
    (r"\bright\s+now\b", "immediately", 1.5),
    (r"\bthis\s+morning\b", "recent_incident", 0.8),
    (r"\btoday\b", "recent_incident", 0.5),
    (r"\bhappening\s+now\b", "recent_incident", 1.2),
    (r"\bcritical\b", "explicit_critical_label", 3.5),
    (r"\b(?:production|prod)\s+environment\b", "prod_impact", 2.0),
    (r"\bon\s+production\b", "prod_impact", 2.0),
    (r"\baffecting\s+customers\b", "customer_impact", 2.0),
    (r"\bmoney\s+lost\b", "monetary_impact", 2.5),
    (r"\blosing\s+money\b", "monetary_impact", 2.5),
)

# Force cap to ≤ medium (cosmetic/non-urgent language)
LOWERS: Sequence[Tuple[str, str, float]] = (
    (r"\bminor\b", "minor_flag", -3.0),
    (r"\btiny\b", "minor_flag", -2.5),
    (r"\bcosmetic\b", "minor_flag", -3.0),
    (r"\bnice\s+to\s+have\b", "nice_to_have", -2.5),
    (r"\bwhen\s+you\s+get\s+time\b", "not_urgent", -2.0),
    (r"\bno\s+rush\b", "not_urgent", -2.0),
    (r"\bwhenever\b", "not_urgent", -1.0),
    (r"\boptional\b", "not_urgent", -1.5),
)

# ---------------------------------------------------------------------------
# Scoring thresholds for priority
# ---------------------------------------------------------------------------
PRIORITY_BUCKETS: Tuple[Tuple[float, str], ...] = (
    (9.0, "critical"),
    (4.5, "high"),
    (1.5, "medium"),
    (-999.0, "low"),
)

# Numeric rank for comparing priority buckets.
_PRIORITY_RANK: Dict[str, int] = {"low": 0, "medium": 1, "high": 2, "critical": 3}

# Severity bias added to priority score based on category.
CATEGORY_PRIORITY_BIAS: Dict[str, float] = {
    "security": 3.0,
    "bug": 1.0,
    "performance": 0.5,
    "feature_request": -1.0,
    "ui_ux": -0.5,
    "other": 0.0,
}

# Nudge direction based on sentiment label.
SENTIMENT_PRIORITY_NUDGE: Dict[str, float] = {
    "negative": 1.2,
    "neutral": 0.0,
    "positive": -1.0,
}

# Negative signal words used by both summarizer *and* priority scoring.
NEGATIVE_WORDS: Tuple[str, ...] = (
    "hate", "crashes", "crash", "crashed", "broken", "terrible", "awful", "worst",
    "bug", "bugs", "buggy", "slow", "lag", "lags", "laggy", "freeze", "freezes",
    "frozen", "error", "errors", "fail", "fails", "failed", "glitch", "glitches",
    "missing", "wrong", "incorrect", "unusable", "urgent", "stuck", "hangs",
    "hang", "frustrating", "confusing", "ugly", "clunky", "danger", "bad",
)

# ---------------------------------------------------------------------------
# Compiled regex cache
# ---------------------------------------------------------------------------
_WORD_BOUNDARY_SUFFIXES = ".,!?;:'\"()[]{} \t\n\r"


def _contains_word(text_lower: str, word: str) -> bool:
    """Case-insensitive whole-word search. Safe for short tokens like 'ui'."""
    if not word:
        return False
    idx = 0
    wl = len(word)
    while True:
        idx = text_lower.find(word, idx)
        if idx < 0:
            return False
        # Left boundary: BOS or non-word-char
        left_ok = idx == 0 or not (
            text_lower[idx - 1].isalnum() or text_lower[idx - 1] == "_"
        )
        right_pos = idx + wl
        right_ok = right_pos >= len(text_lower) or not (
            text_lower[right_pos].isalnum() or text_lower[right_pos] == "_"
        )
        if left_ok and right_ok:
            return True
        idx += 1


def _contains_phrase(text_lower: str, phrase: str) -> bool:
    """Phrase matcher: phrase words must appear in order with word boundaries
    at the start/end of the entire phrase. Internal spaces can be 1+ ws chars.
    """
    if not phrase:
        return False
    pattern = r"\b" + r"\s+".join(re.escape(w) for w in phrase.split()) + r"\b"
    return re.search(pattern, text_lower) is not None


# ---------------------------------------------------------------------------
# Public dataclasses
# ---------------------------------------------------------------------------
@dataclass
class CategoryResult:
    category: str
    score: float
    matched_keywords: List[str] = field(default_factory=list)
    score_breakdown: Dict[str, float] = field(default_factory=dict)


@dataclass
class PriorityResult:
    priority: str
    reasons: List[str] = field(default_factory=list)
    score: float = 0.0


# ---------------------------------------------------------------------------
# Category scoring
# ---------------------------------------------------------------------------
def score_categories(text: str) -> CategoryResult:
    """Return the highest-scoring category + details for *text*."""
    text_lower = text.lower()
    breakdown: Dict[str, float] = {cat: 0.0 for cat in ALL_CATEGORIES}
    matched: Dict[str, List[str]] = {cat: [] for cat in ALL_CATEGORIES}

    for category, entries in CATEGORY_KEYWORDS.items():
        for term, weight in entries:
            if weight <= 0.0:
                # Sentinel (e.g. "dark mode" in feature_request to avoid double
                # counting). Still count it as a match for "matched_keywords"
                # only if the phrase does not appear in any other category we
                # already matched.  Keeping it simple: skip zero-weight items.
                continue
            is_phrase = " " in term
            if is_phrase:
                found = _contains_phrase(text_lower, term)
            else:
                found = _contains_word(text_lower, term)
            if found:
                # Automatic extra weight for phrases (multi-word).
                effective_weight = weight * (1.6 if is_phrase else 1.0)
                breakdown[category] += effective_weight
                matched[category].append(term)

    # Contextual cancellation: phrases like "bug fix" should NOT pull a
    # text into the bug category.  Apply BEFORE normalisation so the
    # penalty scales with the raw keyword weight.
    for category, cancel_entries in CATEGORY_CANCELLATION_PHRASES.items():
        for phrase, penalty in cancel_entries:
            if _contains_phrase(text_lower, phrase):
                breakdown[category] -= penalty

    # Normalise to roughly a 0..10 scale.  Scores would otherwise grow with
    # text length.  Using the max observed category score as the denominator
    # preserves relative ordering without shrinking everything to tiny floats.
    max_raw = max(breakdown.values()) if breakdown else 0.0
    if max_raw > 0.0:
        # Rescale the top to 10, keeping proportions.
        factor = 10.0 / max_raw
        breakdown = {cat: s * factor for cat, s in breakdown.items()}

    # Winner = highest score, tie-break via CATEGORY_TIE_BREAK order.
    ordered_cats = list(CATEGORY_TIE_BREAK) + ["other"]
    best_cat = "other"
    best_score = 0.0
    for cat in ordered_cats:
        s = breakdown[cat]
        if s > best_score + 1e-9:
            best_score = s
            best_cat = cat

    # Also pull in the flat "matched_keywords" list from the winning cat.
    matched_kw = list(dict.fromkeys(matched.get(best_cat, [])))

    # If nothing scored, category = other with empty match list.
    if best_score <= 0.0:
        best_cat = "other"

    return CategoryResult(
        category=best_cat,
        score=round(best_score, 3),
        matched_keywords=matched_kw,
        score_breakdown={cat: round(s, 3) for cat, s in breakdown.items()},
    )


# ---------------------------------------------------------------------------
# Priority scoring
# ---------------------------------------------------------------------------
def _match_all(
    patterns: Sequence[Tuple[str, str, float]], text_lower: str
) -> Tuple[float, List[str]]:
    score = 0.0
    reasons: List[str] = []
    seen_reasons: set[str] = set()
    for regex_src, label, weight in patterns:
        if re.search(regex_src, text_lower, flags=re.IGNORECASE):
            score += weight
            if label not in seen_reasons:
                reasons.append(label)
                seen_reasons.add(label)
    return score, reasons


def compute_priority(
    text: str,
    category: str,
    sentiment: str,
) -> PriorityResult:
    """Compute priority bucket + reasons from text, category, and sentiment."""
    text_lower = text.lower()

    score = 0.0
    reasons: List[str] = []

    # (a) Critical patterns
    s, r = _match_all(CRITICAL_PATTERNS, text_lower)
    score += s
    reasons.extend(r)

    # (b) High patterns
    s, r = _match_all(HIGH_PATTERNS, text_lower)
    score += s
    reasons.extend(r)

    # (c) Urgency amplifiers + customer/prod impact
    s, r = _match_all(URGENCY_AMPLIFIERS, text_lower)
    score += s
    reasons.extend(r)

    # (c.2) Cosmetic / "minor" language — lowers the score
    lower_score, lower_reasons = _match_all(LOWERS, text_lower)
    score += lower_score
    reasons.extend(lower_reasons)
    capped_by_minor = len(lower_reasons) > 0

    # (d) Category bias
    cat_bias = CATEGORY_PRIORITY_BIAS.get(category, 0.0)
    if abs(cat_bias) > 1e-9:
        score += cat_bias
        reasons.append(f"category_bias:{category}")

    # (e) Sentiment modifier
    sent_nudge = SENTIMENT_PRIORITY_NUDGE.get(sentiment, 0.0)
    if abs(sent_nudge) > 1e-9:
        score += sent_nudge
        reasons.append(f"sentiment:{sentiment}")

    # Pick bucket
    priority = "low"
    for threshold, bucket in PRIORITY_BUCKETS:
        if score >= threshold:
            priority = bucket
            break

    # Hard cap: explicit "minor" / "tiny" / "cosmetic" / "nice to have"
    # language forces the priority no higher than medium, regardless of
    # crash/error signals that may also be present.
    if capped_by_minor and _PRIORITY_RANK[priority] > _PRIORITY_RANK["medium"]:
        priority = "medium"
        reasons.append("capped:minor_flag")

    reasons = list(dict.fromkeys(reasons))  # preserve order, dedupe
    return PriorityResult(priority=priority, reasons=reasons, score=round(score, 3))


# ---------------------------------------------------------------------------
# Convenience: expose a compact details dict the caller can use for logging
# ---------------------------------------------------------------------------
def build_details_for_log(
    category_result: CategoryResult, priority_result: PriorityResult
) -> Dict[str, object]:
    return {
        "matched_keywords": category_result.matched_keywords,
        "score_breakdown": category_result.score_breakdown,
        "priority_reasons": priority_result.reasons,
        "priority_raw_score": priority_result.score,
    }
