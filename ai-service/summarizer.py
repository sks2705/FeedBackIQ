"""Extractive text summarizer for Phase 4.

Lightweight: no NLTK, no downloads, pure-Python regex-based sentence splitter.

Strategy:
1. Split the input into clean sentences with a regex splitter.
2. Score each sentence by:
     a. Category-keyword hits (words/phrases drawn from rules.CATEGORY_KEYWORDS).
     b. Negative-sentiment signal words (rules.NEGATIVE_WORDS).
     c. Position bonus — first sentence gets a head-start because real users
        usually lead with the key complaint/request.
     d. Length penality — sentences shorter than 6 words or longer than 60
        words are discouraged; we prefer compact but meaningful sentences.
3. Return the highest-scoring sentence, cleaned of extra whitespace, ending
   in a period, truncated at a WORD boundary to ≤ 200 chars with an
   ellipsis ("...") only if it was actually truncated.
4. One-sentence inputs return that sentence cleaned.
5. Edge-case guard: never return an empty string.
"""

from __future__ import annotations

import re
from typing import Iterable, List, Sequence, Tuple

from rules import CATEGORY_KEYWORDS, NEGATIVE_WORDS

# ---------------------------------------------------------------------------
# Sentence splitter
# ---------------------------------------------------------------------------
# Splits on sentence-ending punctuation followed by whitespace or EOS.
# Handles common abbreviations reasonably well by not splitting when the
# preceding token is a single capital letter (e.g. "Mr. ", "U. S. A. ").
_SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[^\sa-z])")
# Fallback: split on newlines which users often use to separate ideas.
_LINE_SPLIT_RE = re.compile(r"\s*\n+\s*")
# Trim stray trailing punctuation/symbols that are sentence-internal when
# a segment got cut off.
_STRIP_CHARS = " \t\r\n,;:|-"


def split_sentences(text: str) -> List[str]:
    """Split *text* into sentences.

    The splitter is intentionally forgiving: even if the user's grammar is
    bad, we still end up with sensible, ordered chunks.
    """
    if not text:
        return []
    normalized = " ".join(_LINE_SPLIT_RE.split(text.strip()))
    if not normalized:
        return []
    parts = _SENT_SPLIT_RE.split(normalized)
    sentences: List[str] = []
    for part in parts:
        cleaned = part.strip(_STRIP_CHARS).strip()
        if cleaned:
            sentences.append(cleaned)
    if not sentences:
        # Nothing looked like a sentence — keep the whole thing as one.
        fallback = normalized.strip(_STRIP_CHARS).strip()
        if fallback:
            sentences.append(fallback)
    return sentences


# ---------------------------------------------------------------------------
# Keyword / signal helpers
# ---------------------------------------------------------------------------
def _count_word_hits(sentence_lower: str, words: Iterable[str]) -> int:
    hits = 0
    for w in words:
        if not w or " " in w:
            continue
        # Whole-word search, case-insensitive (sentence is already lowered).
        pattern = re.compile(r"\b" + re.escape(w) + r"\b", re.IGNORECASE)
        if pattern.search(sentence_lower):
            hits += 1
    return hits


def _count_phrase_hits(sentence_lower: str, phrases: Iterable[str]) -> int:
    hits = 0
    for p in phrases:
        if not p or " " not in p:
            continue
        pattern = re.compile(
            r"\b" + r"\s+".join(re.escape(w) for w in p.split()) + r"\b",
            re.IGNORECASE,
        )
        if pattern.search(sentence_lower):
            hits += 1
    return hits


def _build_keyword_lists() -> Tuple[List[str], List[str]]:
    """Return (single_words, phrases) for all category tables combined."""
    words: List[str] = []
    phrases: List[str] = []
    for entries in CATEGORY_KEYWORDS.values():
        for term, weight in entries:
            if weight <= 0.0 or not term:
                continue
            if " " in term:
                phrases.append(term)
            else:
                words.append(term)
    # Deduplicate while preserving order
    seen: set[str] = set()
    words = [w for w in words if not (w in seen or seen.add(w))]
    seen.clear()
    phrases = [p for p in phrases if not (p in seen or seen.add(p))]
    return words, phrases


_CATEGORY_WORDS, _CATEGORY_PHRASES = _build_keyword_lists()


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
_POSITION_BONUS_FIRST = 1.3
_POSITION_BONUS_SECOND = 0.5
_KEYWORD_WORD_WEIGHT = 1.0
_KEYWORD_PHRASE_WEIGHT = 2.2  # phrases are more specific
_NEGATIVE_WORD_WEIGHT = 0.9


def _score_sentence(sentence: str, index: int, total: int) -> float:
    del total  # reserved for future positional curves
    lower = sentence.lower()

    score = 0.0
    score += _count_word_hits(lower, _CATEGORY_WORDS) * _KEYWORD_WORD_WEIGHT
    score += _count_phrase_hits(lower, _CATEGORY_PHRASES) * _KEYWORD_PHRASE_WEIGHT
    score += _count_word_hits(lower, NEGATIVE_WORDS) * _NEGATIVE_WORD_WEIGHT

    # Position: first sentence gets a solid bonus, second a small one.
    if index == 0:
        score += _POSITION_BONUS_FIRST
    elif index == 1:
        score += _POSITION_BONUS_SECOND

    # Length shaping (word count).  Good length: 6..60 words.
    words = re.findall(r"[\w']+", lower)
    n = len(words)
    if n < 3:
        score -= 2.0  # too short — probably a fragment
    elif n < 6:
        score -= 0.5
    elif n > 60:
        score -= max(0.0, (n - 60) * 0.05)
    return score


# ---------------------------------------------------------------------------
# Cleanup / length shaping helpers
# ---------------------------------------------------------------------------
_END_PUNCT = {".", "!", "?"}


def _ensure_ending_punct(sentence: str) -> str:
    s = sentence.rstrip()
    if not s:
        return ""
    if s[-1] in _END_PUNCT:
        return s
    # Avoid doubling if someone ended with e.g. ".)" or "Hi!)"
    if len(s) >= 2 and s[-2] in _END_PUNCT:
        return s
    return s + "."


def _truncate_at_word(sentence: str, limit: int = 200) -> str:
    """Truncate to at most `limit` chars, at a word boundary.  Append "..."
    only when truncation actually happens."""
    if len(sentence) <= limit:
        return sentence
    # Cut at `limit` and walk back to the last space.
    cut = sentence[:limit]
    last_space = cut.rfind(" ")
    if last_space <= 0:
        # No space found — hard cut at limit-3 to leave room for "...".
        trimmed = sentence[: max(1, limit - 3)].rstrip()
    else:
        trimmed = cut[:last_space].rstrip()
    # Remove any trailing punctuation added by _ensure_ending_punct — the
    # ellipsis replaces it.
    trimmed = trimmed.rstrip("".join(_END_PUNCT)).rstrip()
    if not trimmed:
        trimmed = sentence[: max(1, limit - 3)].rstrip()
    return trimmed + "..."


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def summarize(text: str) -> str:
    """Pick the most-informative sentence from *text* and format it."""
    if not isinstance(text, str):
        raise TypeError("summarize() expects a string")

    sentences = split_sentences(text)
    if not sentences:
        # Absolute last-resort fallback — should almost never fire.
        return "No summary available."

    if len(sentences) == 1:
        best = sentences[0]
    else:
        scored: List[Tuple[float, int]] = []
        for idx, s in enumerate(sentences):
            scored.append((_score_sentence(s, idx, len(sentences)), idx))
        # Highest score first; stable secondary sort by position ascending
        # so earlier sentences win ties (deterministic).
        scored.sort(key=lambda x: (-x[0], x[1]))
        best = sentences[scored[0][1]]

    cleaned = " ".join(best.split())  # collapse internal multi-space
    cleaned = _ensure_ending_punct(cleaned)
    cleaned = _truncate_at_word(cleaned, 200)

    # Contract guard: never return an empty string.
    if not cleaned:
        cleaned = "No summary available."
    return cleaned
