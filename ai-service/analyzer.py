import os
from typing import Any, Dict, List, Optional

from transformers import Pipeline, pipeline

from rules import (
    ALL_CATEGORIES,
    CategoryResult,
    build_details_for_log,
    compute_priority,
    score_categories,
)
from summarizer import summarize


class Analyzer:
    """Runs: sentiment (HF model) -> category (rules + optional ZS)
             -> priority (combined signals) -> summary (extractive rules).

    Public signature of ``analyze()`` is unchanged from Phase 3 so the
    FastAPI layer in ``main.py`` and the TypeScript client in
    ``web/lib/aiClient.ts`` keep working without edits.
    """

    def __init__(self) -> None:
        self._pipe: Optional[Pipeline] = None
        self._zs_pipe: Optional[Pipeline] = None
        self._sentiment_model_id: str = ""
        self._zs_model_id: str = ""
        self._zero_shot_enabled: bool = False

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------
    def load(self) -> None:
        # --- Sentiment model ------------------------------------------------
        sent_model = (
            os.environ.get("SENTIMENT_MODEL")
            or "cardiffnlp/twitter-roberta-base-sentiment-latest"
        )
        self._pipe = pipeline(
            "text-classification",
            model=sent_model,
            tokenizer=sent_model,
            top_k=None,
            truncation=True,
            max_length=512,
            device=-1,  # CPU
        )
        self._sentiment_model_id = sent_model

        # --- Optional zero-shot category fallback --------------------------
        # OFF BY DEFAULT per the spec.  Only loads a second model when the
        # user explicitly opts in via ENABLE_ZERO_SHOT=true.
        zs_raw = (os.environ.get("ENABLE_ZERO_SHOT") or "false").lower()
        self._zero_shot_enabled = zs_raw in {"1", "true", "yes", "on"}
        if self._zero_shot_enabled:
            # Small-ish model designed for zero-shot classification on CPU.
            # Rough extra download: ~300 MB in the Hugging Face cache.
            zs_model = (
                os.environ.get("ZERO_SHOT_MODEL")
                or "MoritzLaurer/deberta-v3-base-zeroshot-v2.0"
            )
            self._zs_pipe = pipeline(
                "zero-shot-classification",
                model=zs_model,
                tokenizer=zs_model,
                truncation=True,
                max_length=512,
                device=-1,
            )
            self._zs_model_id = zs_model

    @property
    def is_loaded(self) -> bool:
        # We're "loaded enough" if the primary sentiment pipeline exists;
        # the zero-shot one is optional on top.
        return self._pipe is not None

    @property
    def model_id(self) -> str:
        return self._sentiment_model_id

    @property
    def zero_shot_enabled(self) -> bool:
        return self._zero_shot_enabled

    # ------------------------------------------------------------------
    # Analysis
    # ------------------------------------------------------------------
    def analyze(self, text: str) -> Dict[str, Any]:
        if self._pipe is None:
            raise RuntimeError("Analyzer.load() must be called before analyze()")

        text = text.strip()
        if not text:
            raise ValueError("text must not be empty")

        # 1. Sentiment (real model, unchanged from Phase 3) ------------------
        raw: List[List[Dict[str, Any]]] = self._pipe(text)
        scores = raw[0] if isinstance(raw, list) and raw and isinstance(raw[0], list) else raw
        sentiment, sentiment_confidence = self._extract_sentiment(scores)

        # 2. Category (keyword rules, optional zero-shot fallback) ----------
        cat_result = score_categories(text)
        category_confidence: Optional[float] = None

        if cat_result.category == "other" and self._zero_shot_enabled:
            zs_result = self._run_zero_shot(text)
            if zs_result is not None:
                cat_result = zs_result
                category_confidence = zs_result.score / 10.0 if zs_result.score > 0 else 0.0
                category_confidence = round(category_confidence, 4)
        else:
            # Convert keyword score to a rough confidence for non-zs callers
            # that may log it; stays null per contract unless ZS ran.
            category_confidence = None

        # 3. Priority (combined signals, deterministic) ---------------------
        prio_result = compute_priority(text, cat_result.category, sentiment)

        # 4. Summary (extractive, no model) ---------------------------------
        summary_text = summarize(text)

        # --- Assemble contract-shaped output -------------------------------
        zs_flag = "on" if self._zero_shot_enabled else "off"
        version = (
            f"sent={self._sentiment_model_id};rules=v1;zs={zs_flag}"
        )

        result: Dict[str, Any] = {
            "sentiment": sentiment,
            "sentiment_confidence": sentiment_confidence,
            "category": cat_result.category,
            "category_confidence": category_confidence,
            "priority": prio_result.priority,
            "summary": summary_text,
            "model_version": version,
        }

        # Debug details — attach to returned dict under the optional
        # "details" key.  Not part of the strict REST contract, but it
        # surfaces priority_reasons / matched_keywords to logs/tests.
        # aiClient.ts strips it because zod's strict object schema discards
        # unknown keys; REST contract is unaffected.
        try:
            result["details"] = build_details_for_log(cat_result, prio_result)
        except Exception:  # pragma: no cover - best-effort only
            pass
        return result

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _extract_sentiment(scores: Any) -> tuple[str, float]:
        """Map whatever label names the model emits to {positive, negative, neutral}
        and return the top label with its probability rounded to 4 decimals."""
        if not isinstance(scores, list) or not scores:
            return "neutral", 0.0

        def normalize(label: str) -> str:
            lbl = (label or "").strip().lower()
            if lbl in {"positive", "pos", "label_2", "2"}:
                return "positive"
            if lbl in {"negative", "neg", "label_0", "0"}:
                return "negative"
            if lbl in {"neutral", "neu", "label_1", "1"}:
                return "neutral"
            return lbl

        ranked: List[tuple[str, float]] = []
        for entry in scores:
            if not isinstance(entry, dict):
                continue
            label = normalize(str(entry.get("label", "")))
            score = float(entry.get("score", 0.0))
            ranked.append((label, score))

        if not ranked:
            return "neutral", 0.0

        ranked.sort(key=lambda item: item[1], reverse=True)
        top_label, top_score = ranked[0]
        return top_label, round(top_score, 4)

    def _run_zero_shot(self, text: str) -> Optional[CategoryResult]:
        if self._zs_pipe is None:
            return None
        # Candidate labels = ALL categories except "other", then "other" is
        # always the default if nothing reaches even 15% confidence.
        candidate_labels = [c for c in ALL_CATEGORIES if c != "other"]
        hypothesis_template = "This user feedback is about {}."
        try:
            out = self._zs_pipe(
                text,
                candidate_labels=candidate_labels,
                hypothesis_template=hypothesis_template,
                multi_label=False,
            )
        except Exception:  # pragma: no cover - defensive
            return None
        labels: List[str] = list(out.get("labels") or [])
        scores_list: List[float] = [float(s) for s in (out.get("scores") or [])]
        if not labels or not scores_list:
            return None

        best_label = labels[0]
        best_score_01 = float(scores_list[0])

        # Threshold: if even the top ZS label is very low-confidence, fall
        # back to "other" instead of forcing a random category.
        if best_score_01 < 0.15:
            best_label = "other"

        breakdown = {cat: 0.0 for cat in ALL_CATEGORIES}
        for label, score in zip(labels, scores_list):
            if label in breakdown:
                breakdown[label] = round(score * 10.0, 3)
        breakdown[best_label] = max(breakdown.get(best_label, 0.0), round(best_score_01 * 10.0, 3))

        return CategoryResult(
            category=best_label,
            score=round(best_score_01 * 10.0, 3),
            matched_keywords=[f"zero-shot:{best_label}"],
            score_breakdown=breakdown,
        )
