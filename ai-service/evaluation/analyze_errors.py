import argparse
import os
import sys
import pandas as pd

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from analyzer import Analyzer

def main():
  parser = argparse.ArgumentParser(description="FeedbackIQ Error Analysis Script")
  parser.add_argument("--data", required=True, help="Path to evaluation CSV file")
  args = parser.parse_args()

  if not os.path.exists(args.data):
    print(f"Error: File {args.data} not found.")
    sys.exit(1)

  df = pd.read_csv(args.data)

  print("Loading AI Analyzer...")
  analyzer = Analyzer()
  analyzer.load()

  errors = []
  for idx, row in df.iterrows():
    res = analyzer.analyze(str(row['text']))
    pred_sent = res['sentiment'].lower()
    pred_cat = res['category'].lower()
    pred_pri = res['priority'].lower()

    true_sent = str(row['sentiment']).lower()
    true_cat = str(row['category']).lower()
    true_pri = str(row['priority']).lower()

    if pred_sent != true_sent or pred_cat != true_cat or pred_pri != true_pri:
      errors.append({
        'id': row['id'],
        'text': row['text'],
        'true_sent': true_sent,
        'pred_sent': pred_sent,
        'true_cat': true_cat,
        'pred_cat': pred_cat,
        'true_pri': true_pri,
        'pred_pri': pred_pri,
        'details': res.get('details', {}),
      })

  print(f"\n==========================================")
  print(f" ERROR ANALYSIS REPORT ({len(errors)} misclassified items out of {len(df)})")
  print(f"==========================================\n")

  for err in errors:
    print(f"ID {err['id']}: \"{err['text']}\"")
    if err['true_sent'] != err['pred_sent']:
      print(f"  [Sentiment] True: {err['true_sent']} | Pred: {err['pred_sent']}")
    if err['true_cat'] != err['pred_cat']:
      print(f"  [Category]  True: {err['true_cat']} | Pred: {err['pred_cat']}")
    if err['true_pri'] != err['pred_pri']:
      print(f"  [Priority]  True: {err['true_pri']} | Pred: {err['pred_pri']}")
    matched = err['details'].get('category_details', {}).get('matched_keywords', [])
    reasons = err['details'].get('priority_details', {}).get('reasons', [])
    print(f"  [Details]   Matched Keywords: {matched} | Priority Rules: {reasons}\n")

if __name__ == '__main__':
  main()
