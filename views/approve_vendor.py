"""
views/approve_vendor.py
-----------------------
Vendor Manager — Procurement Request Approval page.

Two major sections:
  1. PROCUREMENT REQUESTS  (primary, top)
     All PRs carrying a canonical vendor category displayed in a
     2-column side-by-side grid (3 rows × 2 columns).
     Vendor Manager can:
       • Assign a registered vendor  (Pending / Approved PRs)
       • Accept the assignment       (Vendor Assigned PRs)
       • Reject / Reassign           (Vendor Assigned PRs)
       • View accepted state         (Vendor Accepted PRs — read-only)

  2. VENDOR REGISTRATION APPROVALS  (tabs below)
     Original pending/approved/rejected vendor-registration queue.

Access:  Vendor Manager · Administrator · Supply Chain Manager
Denied:  Procurement Manager · Vendor · Finance Officer

Theme: Deep Navy #172033 + Warm Ivory #F7F5F0 + Muted Gold #B08D57. Zero emoji.
"""

import streamlit as st
from datetime import datetime

from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state
from auth.session import get_current_user, get_current_role
from auth.permissions import (
    has_action_permission,
    ACTION_APPROVE_VENDOR,
    ACTION_ASSIGN_VENDOR_PR,
    ROLE_VENDOR,
    ROLE_PROCUREMENT_MANAGER,
)
from services.vendor_service import (
    get_vendors_paginated,
    get_vendors_for_select,
    approve_vendor,
    reject_vendor,
    get_vendor_stats,
)
from services.procurement_service import (
    get_all_prs_for_vendor_manager,
    assign_vendor_to_pr,
    vm_accept_vendor_assignment,
    vm_reject_vendor_assignment,
)
from config.settings import (
    VENDOR_CATEGORIES,
    VENDOR_CATEGORY_LABELS,
    VENDOR_CATEGORY_COLORS,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _pill(text: str, fg: str, bg: str, bold: bool = True) -> str:
    w = "700" if bold else "500"
    return (
        f'<span style="background:{bg};color:{fg};border:1px solid {fg}33;'
        f'border-radius:5px;padding:2px 9px;font-size:0.7rem;font-weight:{w};">'
        f'{text}</span>'
    )


def _approval_pill(status: str) -> str:
    MAP = {
        "Pending":  ("#A67C32", "#FEF8E7"),
        "Approved": ("#2D6A4A", "#EAF5F0"),
        "Rejected": ("#8B3038", "#FDECEC"),
    }
    fg, bg = MAP.get(status, ("#68707C", "#F1F3F5"))
    return _pill(status, fg, bg)


def _pr_status_pill(status: str) -> str:
    MAP = {
        "Pending":         ("#526174", "#F1F3F5"),
        "Approved":        ("#1D4E8F", "#EBF3FF"),
        "Vendor Assigned": ("#A67C32", "#FEF8E7"),
        "Vendor Accepted": ("#2D6A4A", "#EAF5F0"),
        "Vendor Rejected": ("#8B3038", "#FDECEC"),
    }
    fg, bg = MAP.get(status, ("#526174", "#F1F3F5"))
    return _pill(status, fg, bg)


def _fmt_date(dt) -> str:
    if not dt:
        return "N/A"
    if isinstance(dt, str):
        return dt[:10]
    try:
        return dt.strftime("%b %d, %Y")
    except Exception:
        return "N/A"


def _kpi(label: str, value: str, color: str) -> str:
    return (
        f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {color};'
        f'border-radius:10px;padding:0.8rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
        f'<div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">{label}</div>'
        f'<div style="font-size:1.5rem;font-weight:800;color:{color};margin-top:2px;">{value}</div>'
        f'</div>'
    )


# STATUS label mapping used throughout
_STATUS_LABELS = {
    "Pending":         "Pending Vendor Assignment",
    "Approved":        "Ready for Assignment",
    "Vendor Assigned": "Awaiting Vendor Acceptance",
    "Vendor Accepted": "ACCEPTED — PO Ready",
    "Vendor Rejected": "Rejected — Reassign Needed",
}

_STATUS_FG = {
    "Pending":         "#526174",
    "Approved":        "#1D4E8F",
    "Vendor Assigned": "#A67C32",
    "Vendor Accepted": "#2D6A4A",
    "Vendor Rejected": "#8B3038",
}
_STATUS_BG = {
    "Pending":         "#F1F3F5",
    "Approved":        "#EBF3FF",
    "Vendor Assigned": "#FEF8E7",
    "Vendor Accepted": "#EAF5F0",
    "Vendor Rejected": "#FDECEC",
}


# ── Single PR card renderer ───────────────────────────────────────────────────

def _render_pr_card(
    pr: dict,
    cat_label: str,
    vendor_opts: list,
    v_names: list,
    v_ids: list,
    user_id: str,
    can_assign: bool,
    key_prefix: str,          # unique per category to avoid widget key collisions
) -> None:
    """
    Render one Procurement Request as an expander card with left/right columns.
    All Streamlit widget keys are scoped by key_prefix + pr_id to guarantee
    global uniqueness even if the same PR appears in multiple contexts.
    """
    pr_id       = str(pr.get("_id", ""))
    safe_id     = pr_id[-8:]                # last 8 chars — safe short unique fragment
    pr_num      = pr.get("request_number", pr_id[:8])
    pr_title    = pr.get("title") or pr.get("product_name") or pr.get("description") or pr_num
    pr_status   = pr.get("status", "")
    pr_product  = pr.get("product_name") or pr.get("title") or "—"
    pr_qty      = pr.get("quantity")
    pr_budget   = pr.get("estimated_budget")
    pr_dept     = pr.get("department", "")
    pr_priority = pr.get("priority", "")
    pr_created  = _fmt_date(pr.get("created_at"))
    assigned_vn = pr.get("assigned_vendor_name") or "—"
    vm_rej_rsn  = pr.get("vm_rejection_reason")

    status_label   = _STATUS_LABELS.get(pr_status, pr_status)
    status_fg      = _STATUS_FG.get(pr_status, "#526174")
    status_bg      = _STATUS_BG.get(pr_status, "#F1F3F5")
    is_actionable  = pr_status in ("Pending", "Approved", "Vendor Assigned", "Vendor Rejected")

    with st.expander(
        f"{pr_num}  |  {pr_title[:45]}  |  {status_label}",
        expanded=is_actionable,
    ):
        col_info, col_action = st.columns([1.4, 1])

        # ── LEFT: details ─────────────────────────────────────────────────────
        with col_info:
            badge_html = _pr_status_pill(pr_status)
            if pr_priority:
                badge_html += (
                    f' <span style="background:#F1F3F5;color:#526174;border:1px solid #D9D6CF;'
                    f'border-radius:5px;padding:2px 7px;font-size:0.7rem;">'
                    f'{pr_priority} Priority</span>'
                )
            st.markdown(
                f'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:0.4rem;">'
                f'{badge_html}</div>',
                unsafe_allow_html=True,
            )

            rows = [
                ("Vendor Category",   cat_label),
                ("Request ID",        f"`{pr_num}`"),
                ("Product / Service", pr_product),
                ("Quantity",          str(int(pr_qty)) if pr_qty is not None else "—"),
                ("Requested Date",    pr_created),
            ]
            if pr_dept:
                rows.append(("Department", pr_dept))
            if pr_budget:
                rows.append(("Budget", f"USD {float(pr_budget):,.0f}"))

            for lbl, val in rows:
                st.markdown(f"**{lbl}:** {val}")

            # Status badge
            st.markdown(
                f'**Status:** <span style="background:{status_bg};color:{status_fg};'
                f'border:1px solid {status_fg}44;border-radius:5px;'
                f'padding:2px 9px;font-size:0.72rem;font-weight:700;">'
                f'{status_label}</span>',
                unsafe_allow_html=True,
            )

            if pr_status not in ("Approved", "Pending"):
                st.markdown(f"**Assigned Vendor:** **{assigned_vn}**")

            if vm_rej_rsn:
                st.markdown(
                    f'<div style="background:#FFF3CD;border-radius:6px;'
                    f'padding:0.3rem 0.6rem;font-size:0.78rem;color:#856404;margin-top:0.3rem;">'
                    f'Previous rejection: {vm_rej_rsn}</div>',
                    unsafe_allow_html=True,
                )

        # ── RIGHT: actions ────────────────────────────────────────────────────
        with col_action:

            # ASSIGN VENDOR — for Pending / Approved / Vendor Rejected
            if pr_status in ("Pending", "Approved", "Vendor Rejected") and can_assign:
                if pr_status == "Pending":
                    st.markdown(
                        '<div style="background:#F1F3F5;border-radius:8px;padding:0.45rem 0.6rem;'
                        'font-size:0.75rem;color:#526174;margin-bottom:0.4rem;">'
                        'Still <b>Pending PM approval</b>. You can pre-assign now.</div>',
                        unsafe_allow_html=True,
                    )

                if not vendor_opts:
                    st.warning(
                        f"No approved vendors in **{cat_label}**.\n\n"
                        "Register and approve a vendor in this category first."
                    )
                else:
                    # Build index list separately — avoids lambda closure bug
                    idx_list = list(range(len(v_names)))
                    sel_idx = st.selectbox(
                        "Select Vendor",
                        idx_list,
                        format_func=lambda i, _vn=v_names: _vn[i],
                        key=f"{key_prefix}_asel_{safe_id}",
                    )
                    if st.button(
                        "ASSIGN VENDOR",
                        key=f"{key_prefix}_abtn_{safe_id}",
                        type="primary",
                        use_container_width=True,
                        disabled=(sel_idx == 0),
                    ):
                        ok, msg = assign_vendor_to_pr(
                            pr_id=pr_id,
                            vendor_id=v_ids[sel_idx],
                            assigned_by=user_id,
                            vendor_name=v_names[sel_idx],
                        )
                        if ok:
                            st.success(f"Assigned **{v_names[sel_idx]}** to {pr_num}.")
                            st.rerun()
                        else:
                            st.error(msg)

            # ACCEPT + REJECT — for Vendor Assigned
            elif pr_status == "Vendor Assigned" and can_assign:
                st.markdown(
                    f'<div style="background:#EBF3FF;border:1px solid #1D4E8F25;'
                    f'border-radius:8px;padding:0.5rem 0.7rem;font-size:0.8rem;margin-bottom:0.45rem;">'
                    f'<b style="color:#1D4E8F;">Pending VM Acceptance</b><br>'
                    f'<span style="color:#68707C;">{assigned_vn} is assigned.<br>'
                    f'Click Accept to confirm and enable PO creation.</span></div>',
                    unsafe_allow_html=True,
                )

                if st.button(
                    "ACCEPT VENDOR ASSIGNMENT",
                    key=f"{key_prefix}_accbtn_{safe_id}",
                    type="primary",
                    use_container_width=True,
                ):
                    ok, msg = vm_accept_vendor_assignment(pr_id=pr_id, accepted_by=user_id)
                    if ok:
                        st.success(msg)
                        st.rerun()
                    else:
                        st.error(msg)

                show_reject = st.checkbox(
                    "⚠️ Reject / Reassign",
                    key=f"{key_prefix}_showrej_{safe_id}",
                )
                if show_reject:
                    st.markdown(
                        '<div style="background:#FFF8F8;border:1px solid #FBDCDC;'
                        'border-radius:8px;padding:0.6rem 0.8rem;margin-top:0.3rem;">',
                        unsafe_allow_html=True,
                    )
                    rej_reason = st.text_input(
                        "Reason for rejection (optional)",
                        placeholder="e.g. Vendor unavailable...",
                        key=f"{key_prefix}_rejrsn_{safe_id}",
                    )
                    col_rej, col_rea = st.columns(2)
                    with col_rej:
                        if st.button(
                            "Reject",
                            key=f"{key_prefix}_rejbtn_{safe_id}",
                            use_container_width=True,
                        ):
                            ok, msg = vm_reject_vendor_assignment(
                                pr_id=pr_id,
                                rejected_by=user_id,
                                reason=rej_reason,
                            )
                            if ok:
                                st.success(msg)
                                st.rerun()
                            else:
                                st.error(msg)

                    with col_rea:
                        if vendor_opts:
                            idx_list2 = list(range(len(v_names)))
                            sel2 = st.selectbox(
                                "Reassign to",
                                idx_list2,
                                format_func=lambda i, _vn=v_names: _vn[i],
                                key=f"{key_prefix}_reasels_{safe_id}",
                            )
                            if st.button(
                                "Reassign",
                                key=f"{key_prefix}_reabtn_{safe_id}",
                                use_container_width=True,
                                disabled=(sel2 == 0),
                            ):
                                ok, msg = assign_vendor_to_pr(
                                    pr_id=pr_id,
                                    vendor_id=v_ids[sel2],
                                    assigned_by=user_id,
                                    vendor_name=v_names[sel2],
                                )
                                if ok:
                                    st.success(f"Reassigned to {v_names[sel2]}.")
                                    st.rerun()
                                else:
                                    st.error(msg)
                    st.markdown("</div>", unsafe_allow_html=True)

            # ACCEPTED — read-only
            elif pr_status == "Vendor Accepted":
                st.markdown(
                    f'<div style="background:#EAF5F0;border:1px solid #2D6A4A;'
                    f'border-radius:8px;padding:0.65rem 0.85rem;font-size:0.82rem;">'
                    f'<b style="color:#2D6A4A;font-size:0.9rem;">ACCEPTED</b><br>'
                    f'<span style="color:#68707C;">Vendor: <b>{assigned_vn}</b><br>'
                    f'Procurement Manager can now create a Purchase Order.</span></div>',
                    unsafe_allow_html=True,
                )

            elif not can_assign:
                st.caption("Read-only — vendor assignment requires Vendor Manager role.")


# ── Section 1: Procurement Requests — 2-column grid ──────────────────────────

def _render_procurement_requests_section(user_id: str, can_assign: bool) -> None:
    """
    Render Procurement Requests in a 2-column side-by-side layout.

    Layout (all 6 canonical categories):
      Raw Material Suppliers  |  Equipment Vendors
      IT Vendors              |  Service Providers
      Logistics Partners      |  Maintenance Vendors
    """
    render_section_header(
        "Pending Procurement Requests",
        "Grouped by vendor category. Assign a registered vendor, then accept to enable PO creation.",
    )

    # Category filter (still useful when many categories have requests)
    filter_opts = ["All"] + list(VENDOR_CATEGORIES)
    cat_filter = st.selectbox(
        "Filter by Vendor Category",
        filter_opts,
        key="pra_cat_filter",
        label_visibility="visible",
    )

    # Load all PRs from DB — single call for KPIs
    all_grouped = get_all_prs_for_vendor_manager()

    # KPI strip
    need_assign = sum(
        1 for prs in all_grouped.values()
        for pr in prs if pr.get("status") in ("Pending", "Approved")
    )
    awaiting = sum(
        1 for prs in all_grouped.values()
        for pr in prs if pr.get("status") == "Vendor Assigned"
    )
    accepted = sum(
        1 for prs in all_grouped.values()
        for pr in prs if pr.get("status") == "Vendor Accepted"
    )
    total_scope = sum(len(v) for v in all_grouped.values())

    k1, k2, k3, k4 = st.columns(4)
    for col, label, val, color in [
        (k1, "Total (VM scope)",    str(total_scope),  "#172033"),
        (k2, "Need Assignment",     str(need_assign),  "#1D4E8F"),
        (k3, "Awaiting Acceptance", str(awaiting),     "#A67C32"),
        (k4, "Accepted / PO Ready", str(accepted),     "#2D6A4A"),
    ]:
        with col:
            st.markdown(_kpi(label, val, color), unsafe_allow_html=True)

    st.markdown("<div style='height:0.75rem;'></div>", unsafe_allow_html=True)

    # Empty state when no PRs in scope at all
    if total_scope == 0:
        render_empty_state(
            "No Procurement Requests in Vendor Manager Scope",
            "Requests appear here the moment a Procurement Manager raises one with any of the "
            "6 canonical categories (Raw Material Suppliers, Equipment Vendors, IT Vendors, "
            "Service Providers, Logistics Partners, Maintenance Vendors).",
        )
        return

    # ── 2-column grid — 3 rows × 2 categories each ───────────────────────────
    cat_list = list(VENDOR_CATEGORIES)       # exactly 6, ordered
    # When a filter is active, only render matching categories but still in pairs
    if cat_filter != "All":
        cat_list = [c for c in cat_list if c == cat_filter]

    # Pad to even length so zip works cleanly
    if len(cat_list) % 2 != 0:
        cat_list = cat_list + [None]         # None = empty right-hand column

    for left_cat, right_cat in zip(cat_list[::2], cat_list[1::2]):
        col_left, col_right = st.columns(2, gap="medium")

        for column, cat in [(col_left, left_cat), (col_right, right_cat)]:
            if cat is None:
                continue

            with column:
                prs       = all_grouped.get(cat, [])
                cat_color = VENDOR_CATEGORY_COLORS.get(cat, "#172033")
                cat_label = VENDOR_CATEGORY_LABELS.get(cat, cat)

                # Category stats for the badge row
                need_cnt     = sum(1 for p in prs if p.get("status") in ("Pending", "Approved"))
                awaiting_cnt = sum(1 for p in prs if p.get("status") == "Vendor Assigned")
                accepted_cnt = sum(1 for p in prs if p.get("status") == "Vendor Accepted")

                badge_parts = []
                if need_cnt:
                    badge_parts.append(
                        f'<span style="color:#1D4E8F;font-weight:700;">{need_cnt} need assignment</span>'
                    )
                if awaiting_cnt:
                    badge_parts.append(
                        f'<span style="color:#A67C32;font-weight:700;">{awaiting_cnt} awaiting</span>'
                    )
                if accepted_cnt:
                    badge_parts.append(
                        f'<span style="color:#2D6A4A;font-weight:700;">{accepted_cnt} accepted</span>'
                    )
                badge_str = " &bull; ".join(badge_parts) if badge_parts else (
                    '<span style="color:#8C93A0;font-size:0.75rem;">No active requests</span>'
                )

                # Category header card
                st.markdown(
                    f'<div style="background:{cat_color}0E;border:1px solid {cat_color}2A;'
                    f'border-left:4px solid {cat_color};border-radius:10px;'
                    f'padding:0.6rem 0.9rem;margin-bottom:0.4rem;">'
                    f'<div style="font-size:0.92rem;font-weight:800;color:{cat_color};">'
                    f'{cat_label}</div>'
                    f'<div style="font-size:0.75rem;margin-top:0.15rem;">{badge_str}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

                if not prs:
                    st.markdown(
                        '<div style="color:#9AA0AB;font-size:0.79rem;'
                        'padding:0.2rem 0.5rem 0.6rem;">'
                        'No active procurement requests.</div>',
                        unsafe_allow_html=True,
                    )
                    continue

                # Vendor options for this category — loaded once per category
                vendor_opts = get_vendors_for_select(active_only=True, category=cat)
                v_names = ["— Select vendor —"] + [v["company_name"] for v in vendor_opts]
                v_ids   = [None]                + [v["_id"]          for v in vendor_opts]

                # Unique key prefix: safe short slug of category name
                key_prefix = cat.replace(" ", "_").lower()[:20]

                for pr in prs:
                    _render_pr_card(
                        pr=pr,
                        cat_label=cat_label,
                        vendor_opts=vendor_opts,
                        v_names=v_names,
                        v_ids=v_ids,
                        user_id=user_id,
                        can_assign=can_assign,
                        key_prefix=key_prefix,
                    )


# ── Main Page ─────────────────────────────────────────────────────────────────

def render_approve_vendor_page() -> None:
    """Render the Procurement Request Approval page."""
    user    = get_current_user() or {}
    role    = get_current_role()
    user_id = str(user.get("_id", ""))

    # Hard access guard
    if role in (ROLE_VENDOR, ROLE_PROCUREMENT_MANAGER):
        st.error("You do not have permission to access this page.")
        return

    can_approve = has_action_permission(role, ACTION_APPROVE_VENDOR)
    can_assign  = has_action_permission(role, ACTION_ASSIGN_VENDOR_PR)

    render_page_header(
        "Procurement Request Approval",
        "Assign vendors to procurement requests, confirm assignments, "
        "and manage vendor registration approvals.",
    )

    # ── Global KPI strip (vendor stats) ───────────────────────────────────────
    try:
        stats = get_vendor_stats()
    except Exception:
        stats = {}

    k1, k2, k3, k4 = st.columns(4)
    for col, label, val, color in [
        (k1, "Pending Vendor Review", f"{stats.get('pending_approval', 0):,}", "#B08D57"),
        (k2, "Active Vendors",        f"{stats.get('active', 0):,}",           "#2D6A4A"),
        (k3, "Suspended",             f"{stats.get('suspended', 0):,}",        "#8B3038"),
        (k4, "Total Suppliers",       f"{stats.get('total', 0):,}",            "#172033"),
    ]:
        with col:
            st.markdown(_kpi(label, val, color), unsafe_allow_html=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 1 — PROCUREMENT REQUESTS  (2-column grid)
    # ═══════════════════════════════════════════════════════════════════════════
    _render_procurement_requests_section(user_id, can_assign)

    st.markdown(
        "<hr style='margin:2rem 0 1.5rem;border:none;border-top:1px solid #D9D6CF;'>",
        unsafe_allow_html=True,
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 2 — VENDOR REGISTRATION APPROVALS  (original queue — unchanged)
    # ═══════════════════════════════════════════════════════════════════════════
    render_section_header(
        "Vendor Registration Approvals",
        "Review pending vendor registrations — approve qualified suppliers or reject with a reason.",
    )

    tabs = st.tabs(["Pending Approval", "Recently Approved", "Recently Rejected"])

    # ── Tab 1: Pending registrations ──────────────────────────────────────────
    with tabs[0]:
        pending_data = get_vendors_paginated(
            approval_status="Pending", page_size=50, canonical_only=True
        )
        pending = pending_data["items"]

        if not pending:
            render_empty_state(
                "Approval Queue Clear",
                "All vendor registrations have been reviewed.",
            )
        else:
            render_section_header(
                f"Pending Vendor Approvals ({len(pending)})",
                "Review and approve or reject each vendor registration.",
            )
            for v in pending:
                v_id    = str(v.get("_id", ""))
                sup_id  = v.get("supplier_id") or v.get("vendor_code", "N/A")
                c_name  = v.get("company_name", f"Supplier {sup_id}")
                cat_key = v.get("category", "")
                cat_lbl = VENDOR_CATEGORY_LABELS.get(cat_key, cat_key) or "General"
                rel     = float(v.get("reliability_score") or 0.0)
                tot     = int(v.get("total_orders") or 0)
                late_rt = float(v.get("late_delivery_rate") or 0.0) * 100
                created = v.get("created_at")
                contact = v.get("contact_information") or {}
                addr    = v.get("address") or {}
                loc     = f"{addr.get('city','')}, {addr.get('country','')}".strip(", ")

                with st.expander(
                    f"{sup_id}  |  {c_name}  |  {cat_lbl}  |  Submitted: {_fmt_date(created)}"
                ):
                    ci, cm, ca = st.columns([2.4, 2, 1.4])

                    with ci:
                        st.markdown(
                            f'<div style="margin-bottom:0.4rem;">'
                            f'{_approval_pill("Pending")}</div>',
                            unsafe_allow_html=True,
                        )
                        st.markdown(f"**Supplier Code:** `{sup_id}`")
                        st.markdown(f"**Category:** {cat_lbl}")
                        if loc:
                            st.markdown(f"**Location:** {loc}")
                        if contact.get("primary_email"):
                            st.markdown(f"**Email:** {contact['primary_email']}")
                        if contact.get("primary_contact_name"):
                            st.markdown(f"**Contact:** {contact['primary_contact_name']}")
                        if contact.get("primary_phone"):
                            st.markdown(f"**Phone:** {contact['primary_phone']}")
                        st.markdown(f"**Submitted:** {_fmt_date(created)}")
                        if v.get("description"):
                            st.markdown(f"**Scope:** {v['description']}")

                    with cm:
                        st.markdown(
                            '<div style="font-size:0.75rem;font-weight:700;color:#68707C;'
                            'text-transform:uppercase;margin-bottom:0.4rem;">Performance Snapshot</div>',
                            unsafe_allow_html=True,
                        )
                        ma, mb = st.columns(2)
                        with ma:
                            st.metric("Reliability Score", f"{rel:.1f}%")
                            st.metric("Total Orders", f"{tot:,}")
                        with mb:
                            st.metric("Late Delivery Rate", f"{late_rt:.1f}%")
                            avg_days = float(v.get("avg_shipping_days_real") or 0.0)
                            st.metric("Avg Transit", f"{avg_days:.1f} d")

                    with ca:
                        if can_approve:
                            if st.button(
                                "Approve Vendor",
                                key=f"vra_appr_{v_id}",
                                type="primary",
                                use_container_width=True,
                            ):
                                ok, msg = approve_vendor(v_id, user_id)
                                if ok:
                                    st.success(f"Approved: {c_name}")
                                    try:
                                        from services.cache_service import get_cached_vendor_stats
                                        get_cached_vendor_stats.clear()
                                    except Exception:
                                        pass
                                    st.rerun()
                                else:
                                    st.error(msg)

                            st.markdown(
                                '<div style="font-size:0.7rem;color:#68707C;margin:0.3rem 0 0.1rem;">'
                                'Rejection reason (optional):</div>',
                                unsafe_allow_html=True,
                            )
                            reason = st.text_input(
                                "Reason",
                                placeholder="State reason...",
                                key=f"vra_reason_{v_id}",
                                label_visibility="collapsed",
                            )
                            if st.button(
                                "Reject Application",
                                key=f"vra_rej_{v_id}",
                                use_container_width=True,
                            ):
                                ok, msg = reject_vendor(v_id, user_id, reason)
                                if ok:
                                    st.warning(f"Rejected: {c_name}")
                                    try:
                                        from services.cache_service import get_cached_vendor_stats
                                        get_cached_vendor_stats.clear()
                                    except Exception:
                                        pass
                                    st.rerun()
                                else:
                                    st.error(msg)
                        else:
                            st.info("Read-only. Contact a Vendor Manager to approve/reject.")

    # ── Tab 2: Approved vendors ───────────────────────────────────────────────
    with tabs[1]:
        approved_data = get_vendors_paginated(
            approval_status="Approved", page_size=40, canonical_only=True
        )
        approved = approved_data["items"]
        render_section_header(
            f"Approved Vendors ({approved_data['total']:,} total)",
            "Vendors with active approval status.",
        )
        if not approved:
            render_empty_state("No Approved Vendors", "No vendors have been approved yet.")
        else:
            for v in approved:
                sup_id  = v.get("supplier_id") or v.get("vendor_code", "N/A")
                c_name  = v.get("company_name", f"Supplier {sup_id}")
                cat_key = v.get("category", "")
                cat_lbl = VENDOR_CATEGORY_LABELS.get(cat_key, cat_key) or "General"
                appr_by = v.get("approved_by", "System")
                st.markdown(
                    f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;'
                    f'border-left:4px solid #2D6A4A;border-radius:8px;'
                    f'padding:0.65rem 1rem;margin-bottom:0.35rem;">'
                    f'<div style="display:flex;justify-content:space-between;align-items:center;">'
                    f'<div>'
                    f'<div style="font-size:0.87rem;font-weight:700;color:#20242A;">{c_name}</div>'
                    f'<div style="font-size:0.75rem;color:#68707C;">'
                    f'{sup_id} &bull; {cat_lbl} &bull; Approved by: {appr_by}'
                    f'</div></div>'
                    f'{_approval_pill("Approved")}'
                    f'</div></div>',
                    unsafe_allow_html=True,
                )

    # ── Tab 3: Rejected ───────────────────────────────────────────────────────
    with tabs[2]:
        rejected_data = get_vendors_paginated(
            approval_status="Rejected", page_size=40, canonical_only=True
        )
        rejected = rejected_data["items"]
        render_section_header(
            f"Rejected Applications ({rejected_data['total']:,} total)",
            "Vendor applications that have been declined.",
        )
        if not rejected:
            render_empty_state("No Rejected Applications", "No applications have been rejected.")
        else:
            for v in rejected:
                sup_id      = v.get("supplier_id") or v.get("vendor_code", "N/A")
                c_name      = v.get("company_name", f"Supplier {sup_id}")
                cat_key     = v.get("category", "")
                cat_lbl     = VENDOR_CATEGORY_LABELS.get(cat_key, cat_key) or "General"
                rejected_by = v.get("rejected_by", "System")
                rej_reason  = v.get("rejection_reason") or "Not specified"
                st.markdown(
                    f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;'
                    f'border-left:4px solid #8B3038;border-radius:8px;'
                    f'padding:0.7rem 1rem;margin-bottom:0.4rem;">'
                    f'<div style="display:flex;justify-content:space-between;align-items:center;">'
                    f'<div>'
                    f'<div style="font-size:0.87rem;font-weight:700;color:#20242A;">{c_name}</div>'
                    f'<div style="font-size:0.75rem;color:#68707C;">'
                    f'{sup_id} &bull; {cat_lbl} &bull; Rejected by: {rejected_by}'
                    f'</div></div>'
                    f'{_approval_pill("Rejected")}'
                    f'</div>'
                    f'<div style="font-size:0.78rem;color:#8B3038;margin-top:0.35rem;'
                    f'background:#FDECEC;border-radius:5px;padding:0.3rem 0.6rem;">'
                    f'Reason: {rej_reason}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
