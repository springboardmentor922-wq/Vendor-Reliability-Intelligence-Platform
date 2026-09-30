"""
views/vendors.py
----------------
Vendor Manager — Vendor Directory for VendorPulse.

Shows ONLY vendors in the 6 canonical categories:
  Raw Material Suppliers | Equipment Vendors | IT Vendors |
  Service Providers | Logistics Partners | Maintenance Vendors

DataCo legacy vendor entries (Packaging, Manufacturing, etc.) are NOT shown here.
This page is scoped to Vendor Manager / Administrator.

Access enforced in RBAC (permissions.py) AND in this view's guard.
Procurement Manager is blocked — they do not manage vendors.

Theme: Deep Navy #172033 + Warm Ivory #F7F5F0 + Muted Gold #B08D57. Zero emoji.
"""

import streamlit as st

from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state
from components.tables import render_status_badge, render_risk_badge
from auth.session import get_current_user, get_current_role, navigate_to
from auth.permissions import (
    has_action_permission,
    ACTION_EDIT_VENDOR,
    ACTION_DELETE_VENDOR,
    ROLE_VENDOR,
    ROLE_PROCUREMENT_MANAGER,
)
from services.vendor_service import (
    get_vendors_paginated,
    update_vendor_status,
    delete_vendor,
)
from config.settings import (
    VENDOR_CATEGORIES,
    VENDOR_CATEGORY_COLORS,
    VENDOR_STATUS_OPTIONS,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _kpi(label: str, value: str, color: str) -> str:
    return (
        f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {color};'
        f'border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
        f'<div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">{label}</div>'
        f'<div style="font-size:1.55rem;font-weight:800;color:{color};margin-top:2px;">{value}</div>'
        f'</div>'
    )


# ── Main Page ─────────────────────────────────────────────────────────────────

def render_vendors_page() -> None:
    """
    Render the Vendor Manager — Vendors directory.
    Only shows vendors in the 6 canonical categories.
    """
    user = get_current_user() or {}
    role = get_current_role()
    user_id = str(user.get("_id", ""))

    # ── Hard access guard ─────────────────────────────────────────────────────
    if role == ROLE_VENDOR:
        st.error("Individual vendor accounts cannot access this page. Use My Vendor Portal.")
        if st.button("Go to My Portal", key="vd_vendor_redirect"):
            navigate_to("vendor_portal")
            st.rerun()
        return

    if role == ROLE_PROCUREMENT_MANAGER:
        st.error(
            "Procurement Manager does not have access to Vendor Directory. "
            "This is managed by the Vendor Manager role."
        )
        if st.button("Return to Dashboard", key="vd_pm_redirect"):
            navigate_to("dashboard")
            st.rerun()
        return

    render_page_header(
        "Vendors",
        "Supplier directory scoped to the 6 canonical vendor categories. "
        "Use Register Vendor to add new suppliers.",
    )

    # ── Category quick-counts ─────────────────────────────────────────────────
    try:
        from database.connection import get_database
        from config.settings import COLLECTION_VENDORS
        db = get_database()
        total_canonical = db[COLLECTION_VENDORS].count_documents(
            {"category": {"$in": list(VENDOR_CATEGORIES)}}
        )
        active_canonical = db[COLLECTION_VENDORS].count_documents(
            {"category": {"$in": list(VENDOR_CATEGORIES)}, "status": "Active"}
        )
        pending_canonical = db[COLLECTION_VENDORS].count_documents(
            {"category": {"$in": list(VENDOR_CATEGORIES)}, "approval_status": "Pending"}
        )
    except Exception:
        total_canonical = active_canonical = pending_canonical = 0

    k1, k2, k3, k4 = st.columns(4)
    for col_w, label, val, color in [
        (k1, "Total Vendors",       f"{total_canonical:,}",  "#172033"),
        (k2, "Active / Approved",   f"{active_canonical:,}", "#2D6A4A"),
        (k3, "Pending Approval",    f"{pending_canonical:,}","#B08D57"),
        (k4, "Categories Managed",  "6",                     "#2E4B7A"),
    ]:
        with col_w:
            st.markdown(_kpi(label, val, color), unsafe_allow_html=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # ── Quick category switcher ───────────────────────────────────────────────
    st.markdown(
        '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem;">',
        unsafe_allow_html=True,
    )

    # ── Filters ───────────────────────────────────────────────────────────────
    col_search, col_cat, col_status, col_sort = st.columns([2.0, 1.5, 1.2, 1.3])

    with col_search:
        search_query = st.text_input(
            "Search",
            placeholder="Vendor name, code, or contact...",
            key="vd_search",
        )
    with col_cat:
        category_filter = st.selectbox(
            "Vendor Category",
            ["All Categories"] + list(VENDOR_CATEGORIES),
            key="vd_cat",
        )
    with col_status:
        status_filter = st.selectbox(
            "Status",
            ["All"] + VENDOR_STATUS_OPTIONS,
            key="vd_status",
        )
    with col_sort:
        sort_choice = st.selectbox(
            "Sort By",
            [
                ("Company Name (A-Z)", "company_name", 1),
                ("Reliability (High-Low)", "reliability_score", -1),
                ("Newest First", "created_at", -1),
            ],
            format_func=lambda x: x[0],
            key="vd_sort",
        )

    if "vd_page" not in st.session_state:
        st.session_state["vd_page"] = 1

    col_sz, col_pg = st.columns([1, 4])
    with col_sz:
        page_size = st.selectbox("Per page", [10, 20, 50], index=1, key="vd_pg_size")

    # Query — canonical_only=True ensures ONLY 6-category vendors are returned
    paged = get_vendors_paginated(
        page=st.session_state["vd_page"],
        page_size=page_size,
        status=status_filter if status_filter != "All" else None,
        category=category_filter if category_filter != "All Categories" else None,
        search=search_query or None,
        sort_by=sort_choice[1],
        sort_order=sort_choice[2],
        canonical_only=True,
    )

    vendors   = paged["items"]
    total     = paged["total"]
    cur_page  = paged["page"]
    tot_pages = paged["total_pages"]

    # Pagination controls
    with col_pg:
        pc1, pc2, pc3 = st.columns([1, 3, 1])
        with pc1:
            if st.button("Previous", disabled=(cur_page <= 1), key="vd_prev", use_container_width=True):
                st.session_state["vd_page"] = max(1, cur_page - 1)
                st.rerun()
        with pc2:
            st.markdown(
                f'<div style="text-align:center;padding-top:6px;font-size:0.85rem;color:#526174;">'
                f'Page <b>{cur_page}</b> of <b>{tot_pages}</b> ({total:,} vendors)</div>',
                unsafe_allow_html=True,
            )
        with pc3:
            if st.button("Next", disabled=(cur_page >= tot_pages), key="vd_next", use_container_width=True):
                st.session_state["vd_page"] = min(tot_pages, cur_page + 1)
                st.rerun()

    st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)

    # ── Vendor list ───────────────────────────────────────────────────────────
    if not vendors:
        if category_filter != "All Categories":
            render_empty_state(
                f"No Vendors in {category_filter}",
                "No vendors have been registered under this category yet. "
                "Use Register Vendor to add one.",
            )
        else:
            render_empty_state(
                "No Vendors Found",
                "No vendors match your search criteria. Use Register Vendor to add suppliers.",
            )
        return

    for v in vendors:
        v_id   = str(v.get("_id", ""))
        sup_id = v.get("supplier_id") or v.get("vendor_code", "N/A")
        c_name = v.get("company_name", f"Vendor {sup_id}")
        cat    = v.get("category", "Unknown")
        stat   = v.get("status", "Pending")
        appr   = v.get("approval_status", "Pending")
        risk   = v.get("risk_label", "Low")
        rel    = float(v.get("reliability_score") or 0.0)
        addr   = v.get("address", {})
        loc    = f"{addr.get('city', '')}, {addr.get('country', '')}".strip(", ") or "—"
        cat_color = VENDOR_CATEGORY_COLORS.get(cat, "#172033")

        with st.expander(
            f"{c_name}  |  {cat}  |  {stat}  |  {appr}",
            expanded=False,
        ):
            col_info, col_contact, col_actions = st.columns([2.5, 2, 1.5])

            with col_info:
                st.markdown(
                    f'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:0.6rem;">'
                    f'{render_status_badge(stat)} {render_risk_badge(risk)}'
                    f'<span style="background:{cat_color}22;color:{cat_color};border:1px solid {cat_color}44;'
                    f'border-radius:5px;padding:2px 8px;font-size:0.7rem;font-weight:700;">{cat}</span>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
                st.markdown(f"**Vendor Code:** `{sup_id}`")
                st.markdown(f"**Approval Status:** {appr}")
                st.markdown(f"**Location:** {loc}")
                if v.get("description"):
                    st.markdown(f"**Scope:** {v['description']}")

            with col_contact:
                contact = v.get("contact_information", {})
                st.markdown(f"**Contact:** {contact.get('primary_contact_name', '—')}")
                st.markdown(f"**Email:** `{contact.get('primary_email', '—')}`")
                st.markdown(f"**Phone:** {contact.get('primary_phone', '—')}")
                st.markdown(f"**Payment Terms:** {v.get('payment_terms', 'Net 30')}")
                if v.get("tax_id"):
                    st.markdown(f"**Tax ID:** {v['tax_id']}")

            with col_actions:
                if has_action_permission(role, ACTION_EDIT_VENDOR):
                    avail_statuses = [s for s in VENDOR_STATUS_OPTIONS]
                    cur_idx = avail_statuses.index(stat) if stat in avail_statuses else 0
                    new_stat = st.selectbox(
                        "Change Status",
                        avail_statuses,
                        index=cur_idx,
                        key=f"vd_stat_{v_id}",
                    )
                    if st.button("Update Status", key=f"vd_upd_{v_id}", type="primary", use_container_width=True):
                        ok, msg = update_vendor_status(v_id, new_stat, user_id)
                        if ok:
                            st.success(msg)
                            st.rerun()
                        else:
                            st.error(msg)

                    if has_action_permission(role, ACTION_DELETE_VENDOR) and stat != "Inactive":
                        if st.button("Deactivate", key=f"vd_deact_{v_id}", use_container_width=True):
                            ok, msg = delete_vendor(v_id, user_id)
                            if ok:
                                st.warning(msg)
                                st.rerun()
                else:
                    st.caption("Read-only access")

            # Performance metrics
            st.markdown(
                "<hr style='margin:0.6rem 0;border:none;border-top:1px solid #E5E2DC;'>",
                unsafe_allow_html=True,
            )
            st.markdown(
                '<div style="font-size:0.75rem;font-weight:700;color:#172033;margin-bottom:0.4rem;">PERFORMANCE METRICS</div>',
                unsafe_allow_html=True,
            )
            total_ord = int(v.get("total_orders") or 0)
            on_time   = int(v.get("on_time_count") or 0)
            late_cnt  = int(v.get("late_delivery_count") or 0)
            avg_real  = float(v.get("avg_shipping_days_real") or 5.0)
            avg_sched = float(v.get("avg_shipping_days_scheduled") or 5.0)
            qi   = max(0.0, 1.0 - float(v.get("late_delivery_rate") or 0.0)) * 100
            rs   = max(0.0, min(1.0, 2.0 - avg_real / avg_sched if avg_sched > 0 else 0.5)) * 100
            cr   = min(((on_time + late_cnt) / total_ord * 100) if total_ord > 0 else 0.0, 100.0)

            m1, m2, m3, m4, m5, m6 = st.columns(6)
            with m1:
                st.metric("On-Time", f"{on_time:,}")
            with m2:
                st.metric("Delayed", f"{late_cnt:,}")
            with m3:
                st.metric("Quality Rating", f"{qi:.1f}%")
            with m4:
                st.metric("Response Time", f"{rs:.1f}%")
            with m5:
                st.metric("Issue Resolution", f"{rs:.1f}%")
            with m6:
                st.metric("Completion Rate", f"{cr:.1f}%")

            st.markdown(
                f'<div style="font-size:0.77rem;color:#526174;margin-top:0.4rem;">'
                f'Reliability Score: <b style="color:{cat_color};">{rel:.1f}%</b>'
                f' &bull; Total Orders: <b>{total_ord:,}</b>'
                f' &bull; Avg Transit: <b>{avg_real:.1f}d</b>'
                f'</div>',
                unsafe_allow_html=True,
            )
