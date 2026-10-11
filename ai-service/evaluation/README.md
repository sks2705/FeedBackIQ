# Evaluation Dataset README & Methodology

## Dataset Discipline & Rules

To maintain strict scientific evaluation standards:

1. **Development Set (`dataset_dev.csv`)**:
   - Used for rule exploration, keyword expansion, prompt tuning, and threshold calibration.
   - You may iterate on keyword tables in `rules.py` using this dataset as many times as needed.

2. **Test Set (`dataset_test.csv`)**:
   - **FROZEN DATASET**: This dataset MUST NOT be used for rule tuning or training.
   - Evaluate against the test set **only once** per version milestone.
   - Record the evaluated `model_version` alongside performance metrics in `results/REPORT.md`.

---

## Instructions for the User

1. Open `evaluation/dataset_dev.csv` and `evaluation/dataset_test.csv`.
2. Inspect the ground truth labels (`sentiment`, `category`, `priority`).
3. Remove the `[DRAFT LABELS]` header note once you have validated the ground truth.
4. Run `python evaluation/evaluate.py --data evaluation/dataset_test.csv` to generate your genuine evaluation report.
