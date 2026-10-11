"""Tests for the extractive summarizer (summarizer.py)."""

from __future__ import annotations

import re
from typing import List, Tuple

import pytest

from summarizer import split_sentences, summarize

# ---------------------------------------------------------------------------
# split_sentences
# ---------------------------------------------------------------------------
def test_split_sentences_splits_on_punctuation() -> None:
    s = split_sentences("Hello world. How are you! I'm fine? Great.")
    assert len(s) == 4
    # The lookbehind splitter keeps the sentence-ending punctuation on each
    # segment (we do not strip it — summarizer handles punctuation itself).
    assert s[0].startswith("Hello world")
    assert s[-1].startswith("Great")
    for part in s:
        assert part


def test_split_sentences_preserves_order() -> None:
    s = split_sentences("First sentence. Second sentence. Third sentence.")
    joined = " ".join(s).lower()
    assert joined.index("first") < joined.index("second") < joined.index("third")


def test_split_sentences_handles_leading_trailing_whitespace() -> None:
    s = split_sentences("   \nHi. Bye.\n\n")
    assert len(s) == 2
    assert all(tok == tok.strip() for tok in s)


def test_split_sentences_empty_input() -> None:
    assert split_sentences("") == []
    assert split_sentences("     ") == []


# ---------------------------------------------------------------------------
# summarize core contract
# ---------------------------------------------------------------------------
def test_summarize_never_empty() -> None:
    for t in ["Hi.", "x " * 2000, "Just one sentence here"]:
        result = summarize(t)
        assert isinstance(result, str)
        assert len(result) > 0, f"Empty summary for {t!r}"


def test_summarize_single_sentence_returns_itself_cleaned() -> None:
    text = "The login button is too small on mobile phones"
    out = summarize(text)
    assert out == text + "."  # ensured ending punct + cleaned
    assert out.endswith(".")


def test_summarize_truncates_at_most_200_chars() -> None:
    long_sent = (
        "The dashboard loads very slowly in the morning hours when "
        "most of my team logs in around the same time and we all try to "
        "pull the analytics report for the previous day together causing "
        "contention on the database that backs the charts rendering each "
        "widget serially which makes the wait even longer than necessary sometimes up to 40 seconds."
    )
    # Two sentences so the scorer picks one.
    text = long_sent + " Also I love the new colour scheme."
    out = summarize(text)
    assert len(out) <= 200, f"Expected ≤ 200 chars, got {len(out)}"


def test_summarize_truncation_appends_ellipsis_only_when_needed() -> None:
    short = "Dark mode please."
    out_short = summarize(short)
    assert not out_short.endswith("..."), "No ellipsis when not truncated"

    long = (
        "The extremely long sentence about UI fonts icons layout buttons colours "
        "and everything else that one can possibly say about a design system "
        "that doesn't work for the user on smaller mobile screens should be cut "
        "off before exceeding the character limit in the summary output field."
    )
    text = long + " Second sentence. " * 3
    out_long = summarize(text)
    assert out_long.endswith("..."), f"Expected ellipsis, got {out_long[-20:]!r}"


def test_summarize_ends_with_punct_or_ellipsis() -> None:
    samples = [
        "No trailing punct here",
        "One. Two. Three four five six seven eight.",
        "Please add CSV export to the reports",
    ]
    for s in samples:
        out = summarize(s)
        assert out.endswith(".") or out.endswith("!") or out.endswith("?") or out.endswith("...")


def test_summarize_truncates_at_word_boundary() -> None:
    long_text = " ".join(
        [f"word{i}" for i in range(120)]
    ) + ". And another unrelated sentence here."
    out = summarize(long_text)
    if out.endswith("..."):
        base = out[:-3]
    else:
        base = out
    # The character before '...' or end-punct should NOT be mid-word truncation:
    # i.e. last char should be alphanumeric or end of a word (no dangling space),
    # and no word should be cut.  Simplest check: no single-letter dangling remnant.
    tokens = re.findall(r"[\w']+", base)
    # If the last token is 1 letter and wasn't the original last token, it was cut.
    original_words = set(re.findall(r"[\w']+", long_text))
    last = tokens[-1]
    # Forgive real 1-letter words (digits, i, a). All our tokens are word{N}, so len≥5.
    if len(last) == 1 and last not in {"a", "i"} and last.isalpha():
        pytest.fail(f"Truncated mid-word: last token {last!r} in {out!r}")
    assert last in original_words or last in {"a", "i"}, (
        f"Word boundary violation: {last!r} not in original text (out={out!r})"
    )


# ---------------------------------------------------------------------------
# Scoring behaviour — pick the "information-rich" sentence
# ---------------------------------------------------------------------------
def test_summarize_prefers_keyword_sentence_over_empty_ones() -> None:
    text = (
        "Hi there."  # empty of signal
        "The app crashes every time I upload a photo and it is very frustrating for me."  # loaded
        "Thanks in advance for your support."  # empty
    )
    out = summarize(text)
    lower = out.lower()
    # Must contain the crash keyword (our scorer should pick sentence #2)
    assert "crashes" in lower or "crash" in lower or "frustrat" in lower, (
        f"Expected key complaint sentence picked, got {out!r}"
    )


def test_summarize_prefers_first_on_tie() -> None:
    # Two equal sentences (no keywords at all).  The first one should win
    # (deterministic, stable).
    text = "Alpha beta gamma delta epsilon. Zeta eta theta iota kappa."
    out = summarize(text)
    # Best sentence is the first — position bonus wins.
    assert "Alpha" in out or "alpha" in out.lower()


def test_summarize_collapses_internal_whitespace() -> None:
    out = summarize("The   app\tis\n\n  very slow.")
    assert "  " not in out
    assert "\t" not in out
    assert "\n" not in out


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------
def test_summarize_type_error_on_non_string() -> None:
    with pytest.raises(TypeError):
        summarize(None)  # type: ignore[arg-type]
    with pytest.raises(TypeError):
        summarize(123)  # type: ignore[arg-type]


def test_summarize_weird_whitespace_only_has_fallback() -> None:
    out = summarize("        ")
    assert isinstance(out, str)
    assert len(out) > 0


def test_summarize_emoji_and_unicode_still_works() -> None:
    out = summarize("Crashes every time!!! 😭 Very frustrating 💥💥💥 please fix ASAP.")
    assert len(out) > 0
    assert len(out) <= 200
