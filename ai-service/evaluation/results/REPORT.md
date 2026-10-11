# FeedbackIQ AI Evaluation Report

- **Date of Evaluation**: 2026-10-11 00:04:49
- **Dataset Evaluated**: `evaluation/dataset_test.csv` (Dataset Size: **150** samples)
- **Model Version**: `sent=cardiffnlp/twitter-roberta-base-sentiment-latest;rules=v1;zs=off`
- **Test Set Status**: FROZEN (Unmodified ground-truth test split)
- **Latency (CPU)**: Median **68.58 ms** | 95th Percentile **102.26 ms**

---

## 1. Overall Performance Summary

| Task | Accuracy | Macro F1 | Weighted F1 | Special Metrics |
|---|---|---|---|---|
| **Sentiment** | 0.6000 | 0.4842 | 0.6386 | N/A |
| **Category** | 0.6133 | 0.5179 | 0.6532 | N/A |
| **Priority** | 0.4667 | 0.3211 | 0.4150 | Within 1-Level: **0.7533** |

---

## 2. Sentiment Analysis Breakdown

| Class | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
| **positive** | 0.8846 | 0.9200 | 0.9020 | 25 |
| **negative** | 1.0000 | 0.4608 | 0.6309 | 102 |
| **neutral** | 0.2597 | 0.9091 | 0.4040 | 22 |

---

## 3. Category Classification Breakdown

| Category | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
| **ui_ux** | 0.6250 | 0.6522 | 0.6383 | 23 |
| **performance** | 0.7895 | 0.5556 | 0.6522 | 27 |
| **bug** | 0.8000 | 0.6250 | 0.7018 | 32 |
| **feature_request** | 0.6923 | 0.6429 | 0.6667 | 28 |
| **security** | 0.9091 | 0.6897 | 0.7843 | 29 |
| **other** | 0.1176 | 0.4000 | 0.1818 | 10 |

---

## 4. Priority Rating Breakdown

| Priority Level | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
| **low** | 0.4792 | 0.9583 | 0.6389 | 48 |
| **medium** | 0.2500 | 0.1892 | 0.2154 | 37 |
| **high** | 0.6000 | 0.1765 | 0.2727 | 34 |
| **critical** | 0.6875 | 0.3667 | 0.4783 | 30 |

---

## 5. Confusion Matrices

- Sentiment Confusion Matrix: `results/cm_sentiment.png`
- Category Confusion Matrix: `results/cm_category.png`
- Priority Confusion Matrix: `results/cm_priority.png`
