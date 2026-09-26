"""Runtime inference for the delivery-delay classifier.

The trained artifact is loaded once, lazily, on the first prediction and
cached for the life of the process.  If the artifact is missing - a fresh
checkout that has not run the trainer yet - the platform falls back to a
transparent heuristic rather than failing, and says so in ``model_version``
so the UI can label the number honestly.
"""

from __future__ import annotations

import json
import os
import threading
from typing import Optional

import pandas as pd

from config import settings
from ml.dataset import CATEGORICAL_FEATURES, FEATURE_COLUMNS, NUMERIC_FEATURES

MODEL_FILENAME = "delay_model.joblib"
METRICS_FILENAME = "delay_model_metrics.json"

HEURISTIC_VERSION = "heuristic-fallback"

#: The purchase order has no customer, so the two customer-facing columns the
#: model was trained on are held at the dataset's most common values. Both
#: score near-zero on permutation importance, so pinning them does not move
#: the prediction.
DEFAULT_CUSTOMER_SEGMENT = "Consumer"
DEFAULT_PAYMENT_TYPE = "DEBIT"

#: Committed lead time implied by each lane, used when a purchase order does
#: not carry an explicit shipping mode.
_MODE_SCHEDULED_DAYS = {
    "Standard Class": 4,
    "Second Class": 2,
    "First Class": 1,
    "Same Day": 0,
}

#: Observed late rates per lane in the training corpus. Only used by the
#: fallback heuristic when no trained model is present.
_HEURISTIC_MODE_RISK = {
    "Standard Class": 0.20,
    "Second Class": 0.60,
    "First Class": 0.02,
    "Same Day": 0.02,
}

_lock = threading.Lock()
_bundle = None
_metrics = None
_load_attempted = False


def _model_path() -> str:
    return os.path.join(settings.MODEL_DIR, MODEL_FILENAME)


def _metrics_path() -> str:
    return os.path.join(settings.MODEL_DIR, METRICS_FILENAME)


def load_bundle():
    """Load and cache the trained artifact, or ``None`` if unavailable."""

    global _bundle, _load_attempted

    if _bundle is not None or _load_attempted:
        return _bundle

    with _lock:
        if _bundle is not None or _load_attempted:
            return _bundle

        _load_attempted = True
        path = _model_path()

        if not os.path.isfile(path):
            return None

        try:
            import joblib

            _bundle = joblib.load(path)
        except Exception as exc:  # pragma: no cover - defensive
            print(f"[predictor] could not load {path}: {exc}")
            _bundle = None

        return _bundle


def load_metrics() -> Optional[dict]:
    """Training metrics written alongside the model, if present."""

    global _metrics

    if _metrics is not None:
        return _metrics

    path = _metrics_path()

    if not os.path.isfile(path):
        return None

    try:
        with open(path, "r", encoding="utf-8") as handle:
            _metrics = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None

    return _metrics


def is_ready() -> bool:
    return load_bundle() is not None


def model_version() -> str:
    bundle = load_bundle()

    if not bundle:
        return HEURISTIC_VERSION

    return bundle.get("model_version", "unknown")


def risk_band(probability: float) -> str:
    """Turn a probability into the band the dashboards colour-code on."""

    if probability >= settings.DELAY_RISK_HIGH:
        return "Critical" if probability >= 0.75 else "High"

    if probability >= settings.DELAY_RISK_MEDIUM:
        return "Medium"

    return "Low"


def build_feature_row(
    *,
    shipping_mode: Optional[str] = None,
    market: Optional[str] = None,
    order_region: Optional[str] = None,
    procurement_category: Optional[str] = None,
    quantity: float = 1.0,
    order_value: float = 0.0,
    unit_price: float = 0.0,
    discount_rate: float = 0.0,
    order_month: int = 1,
    order_quarter: int = 1,
    order_weekday: int = 0,
    vendor_prior_late_rate: float = 0.0,
    vendor_prior_orders: float = 0.0,
    scheduled_days: Optional[float] = None,
) -> dict:
    """Assemble one model input row from purchase-order attributes."""

    mode = shipping_mode or "Standard Class"

    if scheduled_days is None:
        scheduled_days = _MODE_SCHEDULED_DAYS.get(mode, 4)

    return {
        "shipping_mode": mode,
        "market": market or "Europe",
        "order_region": order_region or "Western Europe",
        "procurement_category": procurement_category or "Raw Material Suppliers",
        "customer_segment": DEFAULT_CUSTOMER_SEGMENT,
        "payment_type": DEFAULT_PAYMENT_TYPE,
        "scheduled_days": float(scheduled_days),
        "quantity": float(quantity or 0),
        "order_value": float(order_value or 0),
        "unit_price": float(unit_price or 0),
        "discount_rate": float(discount_rate or 0),
        "order_month": int(order_month),
        "order_quarter": int(order_quarter),
        "order_weekday": int(order_weekday),
        "vendor_prior_late_rate": float(vendor_prior_late_rate or 0),
        "vendor_prior_orders": float(vendor_prior_orders or 0),
    }


def _heuristic(rows: list[dict]) -> list[float]:
    """Explainable stand-in used when no trained model is available.

    Blends the lane's historical late rate with the supplier's own track
    record, weighted by how much history that supplier has.
    """

    probabilities = []

    for row in rows:
        lane_risk = _HEURISTIC_MODE_RISK.get(row["shipping_mode"], 0.25)
        vendor_risk = row.get("vendor_prior_late_rate", lane_risk)
        history = row.get("vendor_prior_orders", 0)

        # Confidence in the supplier's own rate grows with its order count.
        weight = min(history / 20.0, 1.0) * 0.5
        probability = (1 - weight) * lane_risk + weight * vendor_risk

        probabilities.append(round(min(max(probability, 0.0), 1.0), 4))

    return probabilities


def predict_many(rows: list[dict]) -> list[dict]:
    """Score a batch of feature rows.

    Returns one dict per row with the probability, the 0.5-threshold label,
    the risk band and the model version that produced it.
    """

    if not rows:
        return []

    bundle = load_bundle()

    if bundle is None:
        probabilities = _heuristic(rows)
        version = HEURISTIC_VERSION
    else:
        frame = pd.DataFrame(rows)

        for column in CATEGORICAL_FEATURES:
            frame[column] = frame[column].astype(str)

        for column in NUMERIC_FEATURES:
            frame[column] = pd.to_numeric(
                frame[column], errors="coerce"
            ).fillna(0.0)

        raw = bundle["pipeline"].predict_proba(frame[FEATURE_COLUMNS])[:, 1]
        probabilities = [round(float(p), 4) for p in raw]
        version = bundle.get("model_version", "unknown")

    return [
        {
            "delay_probability": probability,
            "predicted_late": probability >= 0.5,
            "risk_band": risk_band(probability),
            "model_version": version,
        }
        for probability in probabilities
    ]


def predict_one(**kwargs) -> dict:
    """Score a single purchase order from keyword attributes."""

    row = build_feature_row(**kwargs)
    result = predict_many([row])[0]
    result["features"] = row

    return result


def reset_cache() -> None:
    """Drop the cached artifact so a freshly trained model is picked up."""

    global _bundle, _metrics, _load_attempted

    with _lock:
        _bundle = None
        _metrics = None
        _load_attempted = False
