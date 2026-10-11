import os
import sys
import pandas as pd

def main():
  csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'results', 'summary_review.csv')
  if not os.path.exists(csv_path):
    print(f"Error: File {csv_path} not found. Run evaluate.py first.")
    sys.exit(1)

  df = pd.read_csv(csv_path)
  valid_ratings = pd.to_numeric(df['rating_1_to_5'], errors='coerce').dropna()

  if len(valid_ratings) == 0:
    print("No numerical ratings found in summary_review.csv.")
    print("Please open results/summary_review.csv and fill the 'rating_1_to_5' column with values 1 to 5.")
    sys.exit(0)

  avg = valid_ratings.mean()
  print(f"\n==========================================")
  print(f" SUMMARY QUALITY RATING SCORE ")
  print(f"==========================================")
  print(f"Total Reviewed Summaries: {len(valid_ratings)} / {len(df)}")
  print(f"Average Quality Score (1-5 scale): {avg:.2f} / 5.00\n")

if __name__ == '__main__':
  main()
