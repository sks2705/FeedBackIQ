import argparse
import json
import os
import sys
import time
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from sklearn.metrics import (
  accuracy_score,
  precision_recall_fscore_support,
  confusion_matrix,
  ConfusionMatrixDisplay,
)

# Ensure parent ai-service directory is on sys.path to import Analyzer directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from analyzer import Analyzer

PRIORITY_ORDER = {'low': 0, 'medium': 1, 'high': 2, 'critical': 3}

def evaluate_within_one_level(y_true, y_pred):
  true_idx = [PRIORITY_ORDER.get(str(y).lower(), 1) for y in y_true]
  pred_idx = [PRIORITY_ORDER.get(str(y).lower(), 1) for y in y_pred]
  correct = sum(abs(t - p) <= 1 for t, p in zip(true_idx, pred_idx))
  return correct / len(true_idx) if true_idx else 0.0

def compute_task_metrics(y_true, y_pred, labels, task_name, results_dir):
  acc = accuracy_score(y_true, y_pred)
  p_prec, p_rec, p_f1, p_supp = precision_recall_fscore_support(
    y_true, y_pred, labels=labels, zero_division=0
  )
  macro_p, macro_r, macro_f1, _ = precision_recall_fscore_support(
    y_true, y_pred, average='macro', zero_division=0
  )
  weight_p, weight_r, weight_f1, _ = precision_recall_fscore_support(
    y_true, y_pred, average='weighted', zero_division=0
  )

  per_class = {}
  for idx, label in enumerate(labels):
    per_class[label] = {
      'precision': float(p_prec[idx]),
      'recall': float(p_rec[idx]),
      'f1': float(p_f1[idx]),
      'support': int(p_supp[idx]),
    }

  # Plot and save confusion matrix PNG
  cm = confusion_matrix(y_true, y_pred, labels=labels)
  disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=labels)
  fig, ax = plt.subplots(figsize=(6, 5))
  disp.plot(ax=ax, cmap='Blues', values_format='d')
  plt.title(f'Confusion Matrix: {task_name.capitalize()}')
  plt.tight_layout()
  cm_path = os.path.join(results_dir, f'cm_{task_name}.png')
  plt.savefig(cm_path)
  plt.close()

  res = {
    'accuracy': float(acc),
    'macro_precision': float(macro_p),
    'macro_recall': float(macro_r),
    'macro_f1': float(macro_f1),
    'weighted_precision': float(weight_p),
    'weighted_recall': float(weight_r),
    'weighted_f1': float(weight_f1),
    'per_class': per_class,
  }

  if task_name == 'priority':
    res['within_one_level_accuracy'] = float(evaluate_within_one_level(y_true, y_pred))

  return res

def main():
  parser = argparse.ArgumentParser(description='Evaluate FeedbackIQ AI Models')
  parser.add_argument('--data', required=True, help='Path to evaluation CSV file')
  args = parser.parse_args()

  csv_path = args.data
  if not os.path.exists(csv_path):
    print(f'Error: File {csv_path} not found.')
    sys.exit(1)

  df = pd.read_csv(csv_path)
  required_cols = {'id', 'text', 'sentiment', 'category', 'priority'}
  if not required_cols.issubset(df.columns):
    print(f'Error: CSV missing required columns: {required_cols - set(df.columns)}')
    sys.exit(1)

  results_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'results')
  os.makedirs(results_dir, exist_ok=True)

  print("Initializing AI Analyzer...", flush=True)
  analyzer = Analyzer()
  analyzer.load()

  # Warm-up run for latency measurement
  analyzer.analyze("Warmup request text")

  pred_sentiments = []
  pred_categories = []
  pred_priorities = []
  pred_summaries = []
  latencies = []

  print(f"Running evaluation over {len(df)} records...", flush=True)
  for idx, text in enumerate(df["text"], 1):
    start_t = time.perf_counter()
    res = analyzer.analyze(str(text))
    lat = (time.perf_counter() - start_t) * 1000.0  # ms
    latencies.append(lat)

    pred_sentiments.append(res["sentiment"].lower())
    pred_categories.append(res["category"].lower())
    pred_priorities.append(res["priority"].lower())
    pred_summaries.append(res["summary"])
    if idx % 10 == 0 or idx == len(df):
      print(f"[{idx}/{len(df)}] Processed feedback samples...", flush=True)

  y_true_sent = df['sentiment'].astype(str).str.lower().tolist()
  y_true_cat = df['category'].astype(str).str.lower().tolist()
  y_true_pri = df['priority'].astype(str).str.lower().tolist()

  sent_labels = ['positive', 'negative', 'neutral']
  cat_labels = ['ui_ux', 'performance', 'bug', 'feature_request', 'security', 'other']
  pri_labels = ['low', 'medium', 'high', 'critical']

  sent_metrics = compute_task_metrics(y_true_sent, pred_sentiments, sent_labels, 'sentiment', results_dir)
  cat_metrics = compute_task_metrics(y_true_cat, pred_categories, cat_labels, 'category', results_dir)
  pri_metrics = compute_task_metrics(y_true_pri, pred_priorities, pri_labels, 'priority', results_dir)

  latency_median = float(np.median(latencies))
  latency_p95 = float(np.percentile(latencies, 95))

  modelVersion = analyzer.analyze("sample")['model_version']

  metrics_all = {
    'evaluation_date': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
    'data_file': csv_path,
    'dataset_size': len(df),
    'model_version': modelVersion,
    'latency_ms': {
      'median': round(latency_median, 2),
      'p95': round(latency_p95, 2),
    },
    'sentiment': sent_metrics,
    'category': cat_metrics,
    'priority': pri_metrics,
  }

  safe_version = modelVersion.replace(';', '_').replace('=', '-').replace('/', '_')
  metrics_json_path = os.path.join(results_dir, f"metrics_{safe_version}.json")
  with open(metrics_json_path, 'w') as f:
    json.dump(metrics_all, f, indent=2)

  # Generate summary review CSV for manual 1-5 rating review
  sample_20 = df.sample(n=min(20, len(df)), random_state=42).copy()
  sample_20['generated_summary'] = [pred_summaries[idx] for idx in sample_20.index]
  sample_20['rating_1_to_5'] = ''
  review_csv_path = os.path.join(results_dir, 'summary_review.csv')
  sample_20[['id', 'text', 'generated_summary', 'rating_1_to_5']].to_csv(review_csv_path, index=False)

  # Generate Markdown REPORT.md
  report_md = f"""# FeedbackIQ AI Evaluation Report

- **Date of Evaluation**: {metrics_all['evaluation_date']}
- **Dataset Evaluated**: `{csv_path}` (Dataset Size: **{len(df)}** samples)
- **Model Version**: `{modelVersion}`
- **Test Set Status**: FROZEN (Unmodified ground-truth test split)
- **Latency (CPU)**: Median **{latency_median:.2f} ms** | 95th Percentile **{latency_p95:.2f} ms**

---

## 1. Overall Performance Summary

| Task | Accuracy | Macro F1 | Weighted F1 | Special Metrics |
|---|---|---|---|---|
| **Sentiment** | {sent_metrics['accuracy']:.4f} | {sent_metrics['macro_f1']:.4f} | {sent_metrics['weighted_f1']:.4f} | N/A |
| **Category** | {cat_metrics['accuracy']:.4f} | {cat_metrics['macro_f1']:.4f} | {cat_metrics['weighted_f1']:.4f} | N/A |
| **Priority** | {pri_metrics['accuracy']:.4f} | {pri_metrics['macro_f1']:.4f} | {pri_metrics['weighted_f1']:.4f} | Within 1-Level: **{pri_metrics['within_one_level_accuracy']:.4f}** |

---

## 2. Sentiment Analysis Breakdown

| Class | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
"""
  for cls, vals in sent_metrics['per_class'].items():
    report_md += f"| **{cls}** | {vals['precision']:.4f} | {vals['recall']:.4f} | {vals['f1']:.4f} | {vals['support']} |\n"

  report_md += """
---

## 3. Category Classification Breakdown

| Category | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
"""
  for cls, vals in cat_metrics['per_class'].items():
    report_md += f"| **{cls}** | {vals['precision']:.4f} | {vals['recall']:.4f} | {vals['f1']:.4f} | {vals['support']} |\n"

  report_md += """
---

## 4. Priority Rating Breakdown

| Priority Level | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
"""
  for cls, vals in pri_metrics['per_class'].items():
    report_md += f"| **{cls}** | {vals['precision']:.4f} | {vals['recall']:.4f} | {vals['f1']:.4f} | {vals['support']} |\n"

  report_md += """
---

## 5. Confusion Matrices

- Sentiment Confusion Matrix: `results/cm_sentiment.png`
- Category Confusion Matrix: `results/cm_category.png`
- Priority Confusion Matrix: `results/cm_priority.png`
"""

  report_path = os.path.join(results_dir, 'REPORT.md')
  with open(report_path, 'w') as f:
    f.write(report_md)

  print(f"\nEvaluation complete!")
  print(f"Metrics JSON saved to: {metrics_json_path}")
  print(f"Summary review CSV saved to: {review_csv_path}")
  print(f"Markdown Report saved to: {report_path}")

if __name__ == '__main__':
  main()
