
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.vendor import Vendor
from app.api.reliability import calculate_vendor_reliability


router = APIRouter(
    prefix="/api/risk-alerts",
    tags=["Risk Alerts"],
)


def normalize_role(role) -> str:
    """Normalize the UserRole enum or a string role."""
    if isinstance(role, UserRole):
        role = role.value
    elif hasattr(role, "value"):
        role = role.value

    return str(role or "").strip().upper().replace(" ", "_").replace("-", "_")


def empty_risk_response(message: str) -> dict:
    return {
        "total": 0,
        "high_risk_count": 0,
        "medium_risk_count": 0,
        "unassessed_count": 0,
        "alerts": [],
        "message": message,
    }


@router.get("")
def get_risk_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return vendor risk alerts to authorized management users."""

    management_roles = {
        normalize_role(UserRole.ADMINISTRATOR),
        normalize_role(UserRole.PROCUREMENT_MANAGER),
        normalize_role(UserRole.SUPPLY_CHAIN_MANAGER),
    }

    user_role = normalize_role(current_user.role)

    # Temporary diagnostic output: check the backend terminal.
    print("===== RISK ALERT ACCESS CHECK =====")
    print("Authenticated user ID:", current_user.id)
    print("Authenticated user email:", current_user.email)
    print("Authenticated role:", repr(current_user.role))
    print("Normalized role:", repr(user_role))
    print("Allowed roles:", management_roles)
    print("Has management access:", user_role in management_roles)
    print("===================================")

    if user_role not in management_roles:
        return empty_risk_response(
            "Risk alerts are available to management roles."
        )

    vendors = (
        db.query(Vendor)
        .order_by(Vendor.name.asc())
        .all()
    )

    alerts = []
    high_risk_count = 0
    medium_risk_count = 0
    unassessed_count = 0

    for vendor in vendors:
        reliability = calculate_vendor_reliability(vendor, db)

        available_factor_count = reliability.available_factor_count
        reliability_score = float(reliability.reliability_score)

        if available_factor_count == 0:
            risk_level = "UNASSESSED"
            unassessed_count += 1
        elif reliability_score < 50:
            risk_level = "HIGH"
            high_risk_count += 1
        elif reliability_score < 75:
            risk_level = "MEDIUM"
            medium_risk_count += 1
        else:
            risk_level = "LOW"

        factors = [
            {
                "name": factor.name,
                "score": (
                    float(factor.score)
                    if factor.score is not None
                    else None
                ),
                "status": factor.status,
                "description": factor.description,
            }
            for factor in reliability.factors
        ]

        alerts.append({
            "vendor_id": vendor.id,
            "vendor_name": vendor.name,
            "risk_level": risk_level,
            "reliability_score": reliability_score,
            "data_completeness": float(
                reliability.data_completeness
            ),
            "available_factor_count": available_factor_count,
            "total_factor_count": reliability.total_factor_count,
            "factors": factors,
            "risk_explanation": (
                "Vendor reliability could not be fully assessed."
                if risk_level == "UNASSESSED"
                else (
                    f"Vendor reliability score is "
                    f"{reliability_score:.2f}/100. "
                    f"Risk level: {risk_level}."
                )
            ),
        })

    return {
        "total": len(vendors),
        "high_risk_count": high_risk_count,
        "medium_risk_count": medium_risk_count,
        "unassessed_count": unassessed_count,
        "alerts": alerts,
    }