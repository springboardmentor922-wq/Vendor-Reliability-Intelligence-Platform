from typing import List
from app.models.performance import PerformanceRecord


def calculate_reliability_score(records: List[PerformanceRecord]) -> dict:
    """
    Computes a 0-100 reliability score from a vendor's performance records.

    Weighting:
      - On-time delivery rate: 40%
      - Quality rating (1-5 -> 0-100): 30%
      - Communication rating (1-5 -> 0-100): 20%
      - Response time (faster = better, capped at 48h): 10%
    """
    if not records:
        return {
            "reliability_score": 0.0,
            "total_records": 0,
            "on_time_delivery_rate": None,
            "avg_quality_rating": None,
            "avg_communication_rating": None,
            "avg_response_time_hours": None,
        }

    # On-time delivery rate
    delivery_records = [r for r in records if r.on_time_delivery is not None]
    on_time_rate = (
        sum(1 for r in delivery_records if r.on_time_delivery) / len(delivery_records)
        if delivery_records else None
    )

    # Average quality rating (1-5)
    quality_records = [r.quality_rating for r in records if r.quality_rating is not None]
    avg_quality = sum(quality_records) / len(quality_records) if quality_records else None

    # Average communication rating (1-5)
    comm_records = [r.communication_rating for r in records if r.communication_rating is not None]
    avg_comm = sum(comm_records) / len(comm_records) if comm_records else None

    # Average response time (hours) - lower is better
    response_records = [r.response_time_hours for r in records if r.response_time_hours is not None]
    avg_response = sum(response_records) / len(response_records) if response_records else None

    # --- Convert each metric to a 0-100 sub-score ---
    delivery_score = (on_time_rate * 100) if on_time_rate is not None else 0
    quality_score = (avg_quality / 5 * 100) if avg_quality is not None else 0
    comm_score = (avg_comm / 5 * 100) if avg_comm is not None else 0

    # Response time: 0h = 100 score, 48h+ = 0 score, linear in between
    if avg_response is not None:
        response_score = max(0, 100 - (avg_response / 48 * 100))
    else:
        response_score = 0

    # --- Weighted final score ---
    final_score = (
        delivery_score * 0.40
        + quality_score * 0.30
        + comm_score * 0.20
        + response_score * 0.10
    )

    return {
        "reliability_score": round(final_score, 2),
        "total_records": len(records),
        "on_time_delivery_rate": round(on_time_rate * 100, 2) if on_time_rate is not None else None,
        "avg_quality_rating": round(avg_quality, 2) if avg_quality is not None else None,
        "avg_communication_rating": round(avg_comm, 2) if avg_comm is not None else None,
        "avg_response_time_hours": round(avg_response, 2) if avg_response is not None else None,
    }