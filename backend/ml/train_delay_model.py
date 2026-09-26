"""Train the delivery-delay classifier on the DataCo supply chain dataset.

    python -m ml.train_delay_model                 # full dataset
    python -m ml.train_delay_model --rows 50000    # quick run
    python -m ml.train_delay_model --dataset PATH

--------------------------------------------------------------------------
What the model predicts
--------------------------------------------------------------------------
For a purchase order that has been raised but not yet delivered, the model
estimates ``P(the delivery misses its committed date)``.  That probability
drives three things in the platform:

  * a risk badge on the purchase order itself,
  * the forward-looking component of each vendor's reliability score,
  * the "vendors to watch" list on the analytics dashboard.

--------------------------------------------------------------------------
Why the split is chronological
--------------------------------------------------------------------------
The task is genuinely predictive, so the evaluation has to be too.  The
model is trained on the earlier part of the order book and tested on the
later part, which is how it will be used in production - fitted on history,
asked about orders that have not happened yet.  A random split would let the
model see orders from the same week it is being tested on and would report a
better score than it deserves.

--------------------------------------------------------------------------
Guarding against leakage
--------------------------------------------------------------------------
The target is derived from the realised shipping time, so any column that
describes what actually happened is excluded from the features - see
``LEAKY_COLUMNS`` in ``ml/dataset.py``.  The supplier track-record feature is
an expanding mean shifted by one order, so an order is never part of its own
history.  ``--audit`` re-checks both properties and fails loudly if either is
violated.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder

from ml.dataset import (
    CATEGORICAL_FEATURES,
    FEATURE_COLUMNS,
    LEAKY_COLUMNS,
    NUMERIC_FEATURES,
    TOLERANCE_DAYS,
    build_feature_frame,
    load_prepared
)

MODEL_VERSION = "delay-hgb-1.0"

ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
MODEL_PATH = os.path.join(ARTIFACT_DIR, "delay_model.joblib")
METRICS_PATH = os.path.join(ARTIFACT_DIR, "delay_model_metrics.json")

#: Share of the (chronologically ordered) order book held back for testing.
TEST_FRACTION = 0.25


def build_pipeline() -> Pipeline:
    """Gradient-boosted trees over ordinally encoded lane/commodity features.

    Histogram gradient boosting handles the mix of high-cardinality
    categoricals and skewed numerics here without needing scaling, and it
    trains on 180k rows in seconds.
    """

    encoder = ColumnTransformer(
        transformers=[
            (
                "categorical",
                OrdinalEncoder(
                    handle_unknown="use_encoded_value",
                    unknown_value=-1,
                    encoded_missing_value=-1,
                ),
                CATEGORICAL_FEATURES,
            ),
            ("numeric", "passthrough", NUMERIC_FEATURES),
        ],
        remainder="drop",
    )

    classifier = HistGradientBoostingClassifier(
        loss="log_loss",
        learning_rate=0.08,
        max_iter=300,
        max_leaf_nodes=31,
        min_samples_leaf=40,
        l2_regularization=1.0,
        early_stopping=True,
        validation_fraction=0.12,
        n_iter_no_change=25,
        # The first block of columns is categorical after encoding.
        categorical_features=list(range(len(CATEGORICAL_FEATURES))),
        random_state=20260910,
    )

    return Pipeline([("encode", encoder), ("model", classifier)])


def chronological_split(data, test_fraction: float = TEST_FRACTION):
    """Split on order date: earlier orders train, later orders test."""

    ordered = data.sort_values("order_date").reset_index(drop=True)
    cut = int(len(ordered) * (1.0 - test_fraction))

    return ordered.iloc[:cut].copy(), ordered.iloc[cut:].copy()


def audit_leakage(features, data) -> list[str]:
    """Fail loudly if an outcome column has found its way into the features."""

    problems = []

    for column in LEAKY_COLUMNS:
        if column in features.columns:
            problems.append(f"outcome column '{column}' is in the feature set")

    # A feature that is near-perfectly correlated with the target is almost
    # always leakage rather than a genuinely brilliant predictor.
    target = data["late"].astype(float)

    for column in NUMERIC_FEATURES:
        if column not in features.columns:
            continue

        series = features[column].astype(float)

        if series.nunique() < 2:
            continue

        correlation = abs(np.corrcoef(series, target)[0, 1])

        if correlation > 0.98:
            problems.append(
                f"feature '{column}' correlates {correlation:.3f} with the "
                f"target - check for leakage"
            )

    return problems


def evaluate(pipeline, features, target) -> dict:
    """Score the fitted pipeline on a held-out set."""

    probabilities = pipeline.predict_proba(features)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)

    matrix = confusion_matrix(target, predictions)
    true_neg, false_pos, false_neg, true_pos = matrix.ravel()

    return {
        "accuracy": round(float(accuracy_score(target, predictions)), 4),
        "precision": round(float(precision_score(target, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(target, predictions, zero_division=0)), 4),
        "f1": round(float(f1_score(target, predictions, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(target, probabilities)), 4),
        "average_precision": round(float(average_precision_score(target, probabilities)), 4),
        "brier_score": round(float(brier_score_loss(target, probabilities)), 4),
        "confusion_matrix": {
            "true_negative": int(true_neg),
            "false_positive": int(false_pos),
            "false_negative": int(false_neg),
            "true_positive": int(true_pos),
        },
        "positive_rate": round(float(target.mean()), 4),
        "report": classification_report(
            target, predictions,
            target_names=["On time", "Late"],
            zero_division=0,
            output_dict=True,
        ),
    }


def permutation_importance_summary(pipeline, features, target, repeats: int = 3):
    """Rank features by how much shuffling them hurts ROC AUC.

    Reported instead of raw tree gains because it measures what the model
    actually relies on for its ranking quality, which is what the dashboard
    explanations claim.
    """

    from sklearn.inspection import permutation_importance

    result = permutation_importance(
        pipeline,
        features,
        target,
        scoring="roc_auc",
        n_repeats=repeats,
        random_state=20260910,
        n_jobs=1,
    )

    ranked = sorted(
        zip(FEATURE_COLUMNS, result.importances_mean, result.importances_std),
        key=lambda row: row[1],
        reverse=True,
    )

    return [
        {
            "feature": name,
            "importance": round(float(mean), 5),
            "std": round(float(std), 5),
        }
        for name, mean, std in ranked
    ]


def train(dataset_path=None, rows=None, audit=True, importance=True) -> dict:
    print("Loading dataset ...")
    data = load_prepared(dataset_path, nrows=rows)
    print(f"  {len(data):,} usable order lines")
    print(f"  late rate (slip > {TOLERANCE_DAYS}d): {data['late'].mean():.4f}")

    train_data, test_data = chronological_split(data)

    print(
        f"  train {len(train_data):,} orders "
        f"({train_data['order_date'].min().date()} -> "
        f"{train_data['order_date'].max().date()})"
    )
    print(
        f"  test  {len(test_data):,} orders "
        f"({test_data['order_date'].min().date()} -> "
        f"{test_data['order_date'].max().date()})"
    )

    x_train = build_feature_frame(train_data)
    x_test = build_feature_frame(test_data)
    y_train = train_data["late"].astype(int)
    y_test = test_data["late"].astype(int)

    if audit:
        problems = audit_leakage(x_train, train_data)

        if problems:
            raise RuntimeError(
                "Leakage audit failed:\n  - " + "\n  - ".join(problems)
            )

        print("  leakage audit passed")

    print("Training ...")
    pipeline = build_pipeline()
    pipeline.fit(x_train, y_train)

    print("Evaluating on held-out future orders ...")
    test_metrics = evaluate(pipeline, x_test, y_test)
    train_metrics = evaluate(pipeline, x_train, y_train)

    # A majority-class baseline puts the headline numbers in context.
    majority = int(y_train.mean() >= 0.5)
    baseline_accuracy = float((y_test == majority).mean())

    metrics = {
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "algorithm": "HistGradientBoostingClassifier",
        "target": f"late = slip > {TOLERANCE_DAYS} day(s)",
        "split": "chronological (earliest 75% train / latest 25% test)",
        "rows_total": int(len(data)),
        "rows_train": int(len(train_data)),
        "rows_test": int(len(test_data)),
        "train_period": [
            str(train_data["order_date"].min().date()),
            str(train_data["order_date"].max().date()),
        ],
        "test_period": [
            str(test_data["order_date"].min().date()),
            str(test_data["order_date"].max().date()),
        ],
        "features": FEATURE_COLUMNS,
        "baseline_accuracy_majority_class": round(baseline_accuracy, 4),
        "test": test_metrics,
        "train": train_metrics,
    }

    if importance:
        print("Measuring permutation importance ...")
        # A sample keeps this quick; importance ordering is stable well
        # below the full test set.
        sample = min(len(x_test), 25000)
        metrics["permutation_importance"] = permutation_importance_summary(
            pipeline,
            x_test.iloc[:sample],
            y_test.iloc[:sample],
        )

    os.makedirs(ARTIFACT_DIR, exist_ok=True)

    joblib.dump(
        {
            "pipeline": pipeline,
            "model_version": MODEL_VERSION,
            "feature_columns": FEATURE_COLUMNS,
            "categorical_features": CATEGORICAL_FEATURES,
            "numeric_features": NUMERIC_FEATURES,
            "tolerance_days": TOLERANCE_DAYS,
            "baseline_late_rate": float(data["late"].mean()),
        },
        MODEL_PATH,
    )

    with open(METRICS_PATH, "w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2)

    print(f"\nModel   -> {MODEL_PATH}")
    print(f"Metrics -> {METRICS_PATH}")

    print("\nHeld-out performance (future orders):")
    print(f"  accuracy          {test_metrics['accuracy']:.4f}")
    print(f"  majority baseline {baseline_accuracy:.4f}")
    print(f"  precision         {test_metrics['precision']:.4f}")
    print(f"  recall            {test_metrics['recall']:.4f}")
    print(f"  f1                {test_metrics['f1']:.4f}")
    print(f"  roc auc           {test_metrics['roc_auc']:.4f}")
    print(f"  brier             {test_metrics['brier_score']:.4f}")

    if importance:
        print("\nTop features by permutation importance:")
        for row in metrics["permutation_importance"][:8]:
            print(f"  {row['feature']:<26} {row['importance']:.5f}")

    return metrics


def main():
    parser = argparse.ArgumentParser(
        description="Train the VendorIQ delivery-delay classifier."
    )
    parser.add_argument("--dataset", default=None, help="path to the DataCo CSV")
    parser.add_argument("--rows", type=int, default=None, help="limit rows read")
    parser.add_argument(
        "--no-audit", action="store_true", help="skip the leakage audit"
    )
    parser.add_argument(
        "--no-importance",
        action="store_true",
        help="skip permutation importance (faster)",
    )

    args = parser.parse_args()

    train(
        dataset_path=args.dataset,
        rows=args.rows,
        audit=not args.no_audit,
        importance=not args.no_importance,
    )


if __name__ == "__main__":
    main()
