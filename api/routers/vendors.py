"""
api/routers/vendors.py
----------------------
FastAPI endpoints for Vendor Management & Supplier Risk Dataset.
Supports pagination, sorting, search, filtering, and approval workflows.

Security:
  - JWT auth is enforced at the middleware level (api/main.py)
  - Vendor role (role=Vendor) can ONLY access /vendors/me — never the list or other vendors
  - Approval/rejection/creation endpoints require Vendor Manager or Admin role
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from services.vendor_service import (
    get_vendors_paginated,
    get_vendor_by_id,
    get_supplier_by_id_or_code,
    get_vendor_stats,
    get_risk_distribution,
    approve_vendor,
    reject_vendor,
    create_vendor,
    update_vendor,
    get_vendor_own_record,
)
from services.performance_service import get_vendor_own_performance

router = APIRouter(prefix="/vendors", tags=["Vendors"])


# ── RBAC helpers ──────────────────────────────────────────────────────────────

def _require_not_vendor(request: Request) -> None:
    """Raise 403 if the authenticated user is a Vendor role."""
    role = getattr(request.state, "user_role", None)
    if role == "Vendor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Vendor accounts cannot access the vendor list. "
                "Use /vendors/me to access your own profile."
            ),
        )


def _require_manager_or_admin(request: Request) -> None:
    """Raise 403 if the user is not Vendor Manager or Administrator."""
    role = getattr(request.state, "user_role", None)
    if role not in ("Vendor Manager", "Administrator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Vendor Managers and Administrators can perform this action.",
        )


# ── Pydantic Models ───────────────────────────────────────────────────────────

class VendorCreateRequest(BaseModel):
    company_name: str
    category: str
    contact_information: dict = Field(default_factory=dict)
    address: dict = Field(default_factory=dict)
    created_by: str = "api_user"
    tax_id: Optional[str] = None
    payment_terms: Optional[str] = "Net 30"
    description: Optional[str] = None


class VendorUpdateRequest(BaseModel):
    updates: dict
    updated_by: str = "api_user"


class VendorApprovalRequest(BaseModel):
    approved_by: str = "api_admin"


class VendorRejectionRequest(BaseModel):
    rejected_by: str = "api_admin"
    reason: Optional[str] = "Application declined"


# ── Vendor-Scoped Endpoint (ROLE_VENDOR only) ─────────────────────────────────

@router.get("/me")
def get_own_vendor_profile(request: Request):
    """
    Return the authenticated vendor's own profile and performance metrics.

    Security: vendor_id is sourced EXCLUSIVELY from the JWT token claims
    (request.state.vendor_id set by JWT middleware). The client cannot
    supply or override the vendor_id — it is injected server-side.
    """
    vendor_id = getattr(request.state, "vendor_id", None)
    role = getattr(request.state, "user_role", None)

    # Vendors must have a vendor_id in their JWT claims
    if role == "Vendor" and not vendor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not linked to a vendor organization. Contact your administrator.",
        )

    # Non-vendor roles use the standard list/detail endpoints
    if role not in (None, "Vendor"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The /me endpoint is only for Vendor role accounts.",
        )

    vendor_rec = get_vendor_own_record(vendor_id)
    perf = get_vendor_own_performance(vendor_id)

    if not vendor_rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor record not found. Your account may not be configured correctly.",
        )

    return {
        "vendor": vendor_rec,
        "performance": perf,
    }


# ── Vendor Manager / Admin Endpoints ─────────────────────────────────────────

@router.get("")
def list_vendors(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    status: Optional[str] = Query(None, description="Active, Inactive, Suspended, Pending"),
    approval_status: Optional[str] = Query(None, description="Pending, Approved, Rejected"),
    category: Optional[str] = Query(None, description="Vendor category"),
    market: Optional[str] = Query(None, description="DataCo Market (Pacific Asia, Europe, etc.)"),
    department: Optional[str] = Query(None, description="DataCo Department"),
    search: Optional[str] = Query(None, description="Search term for company name, department, or market"),
    sort_by: str = Query("reliability_score", description="Field to sort by"),
    sort_order: int = Query(-1, description="-1 for descending, 1 for ascending"),
):
    """Retrieve paginated vendor list with filtering and search. Vendor role is blocked."""
    _require_not_vendor(request)
    result = get_vendors_paginated(
        page=page,
        page_size=page_size,
        status=status,
        approval_status=approval_status,
        category=category,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return result


@router.get("/stats")
def vendor_stats(request: Request):
    """Retrieve aggregated supplier metrics and risk distribution. Vendor role is blocked."""
    _require_not_vendor(request)
    stats = get_vendor_stats()
    risk_dist = get_risk_distribution()
    return {"stats": stats, "risk_distribution": risk_dist}


@router.get("/search")
def search_vendors(
    request: Request,
    q: str = Query(..., min_length=1, description="Search term"),
    limit: int = Query(20, ge=1, le=100),
):
    """Quick search for vendors by Supplier ID or company name. Vendor role is blocked."""
    _require_not_vendor(request)
    result = get_vendors_paginated(search=q, page=1, page_size=limit)
    return result


@router.get("/filter")
def filter_vendors(
    request: Request,
    category: Optional[str] = None,
    status: Optional[str] = None,
    risk_label: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """Filter vendors by multiple criteria. Vendor role is blocked."""
    _require_not_vendor(request)
    return get_vendors_paginated(
        page=page,
        page_size=page_size,
        category=category,
        status=status,
        risk_label=risk_label,
    )


@router.get("/{supplier_id}")
def get_vendor(request: Request, supplier_id: str):
    """
    Retrieve single vendor/supplier details by Supplier_ID or Mongo ObjectId.

    Security:
      - Vendor role accounts: can ONLY access their own vendor_id (not arbitrary IDs)
      - Other roles: unrestricted access (Vendor Manager, Admin, Procurement, etc.)
    """
    role = getattr(request.state, "user_role", None)
    session_vendor_id = getattr(request.state, "vendor_id", None)

    # Vendor role: enforce that they can only access their own record
    if role == "Vendor":
        if not session_vendor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is not linked to a vendor organization.",
            )
        # If the requested supplier_id is not their own, deny access
        vendor = get_vendor_own_record(session_vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Your vendor record was not found.")
        # Check if the requested ID matches their record
        rec_id = str(vendor.get("_id", ""))
        rec_code = str(vendor.get("vendor_code", ""))
        if supplier_id not in (rec_id, rec_code, session_vendor_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only access your own vendor profile. Use /vendors/me instead.",
            )
        return vendor

    # Non-vendor roles: standard lookup
    vendor = get_supplier_by_id_or_code(supplier_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    return vendor


@router.post("")
def register_vendor(request: Request, payload: VendorCreateRequest):
    """Register a new vendor. Requires Vendor Manager or Administrator role."""
    _require_manager_or_admin(request)
    success, msg, doc = create_vendor(
        company_name=payload.company_name,
        category=payload.category,
        contact_information=payload.contact_information,
        address=payload.address,
        created_by=payload.created_by,
        tax_id=payload.tax_id,
        payment_terms=payload.payment_terms,
        description=payload.description,
    )
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg, "vendor": doc}


@router.put("/{supplier_id}/approve")
def approve_vendor_endpoint(request: Request, supplier_id: str, payload: VendorApprovalRequest):
    """Approve a vendor by Supplier_ID or Mongo ObjectId. Requires Vendor Manager or Administrator."""
    _require_manager_or_admin(request)
    vendor = get_supplier_by_id_or_code(supplier_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    vid = str(vendor.get("_id"))
    success, msg = approve_vendor(vid, payload.approved_by)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}


@router.put("/{supplier_id}/reject")
def reject_vendor_endpoint(request: Request, supplier_id: str, payload: VendorRejectionRequest):
    """Reject a vendor application. Requires Vendor Manager or Administrator."""
    _require_manager_or_admin(request)
    vendor = get_supplier_by_id_or_code(supplier_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    vid = str(vendor.get("_id"))
    success, msg = reject_vendor(vid, payload.rejected_by, payload.reason)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}
