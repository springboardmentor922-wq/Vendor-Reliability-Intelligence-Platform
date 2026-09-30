"""
views/vendor_management.py
--------------------------
Main / Overall Vendor Management module for VendorPulse.

Combines in a single page (via tabs):
  1. Vendors           — Supplier directory with search, filter, sort, pagination
  2. Approval Queue    — Pending / Approved / Rejected workflow
  3. Vendor Categories — All 6 canonical categories with supplier density
  4. Overall Performance — Cross-vendor performance metrics for all 6 categories

Access:  Vendor Manager · Administrator · Supply Chain Manager · Auditor
Denied:  Procurement Manager (enforced in RBAC AND in this view guard)
         Vendor (individual) → must use vendor_portal page

Design: Deep Navy #172033 + Warm Ivory #F7F5F0 + Muted Gold #B08D57. Zero emoji.
"""

import streamlit as st

from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state
from components.tables import render_status_badge, render_risk_badge
from auth.session import get_current_user, get_current_role, navigate_to
from auth.permissions import (
    has_action_permission,
    ACTION_CREATE_VENDOR,
    ACTION_APPROVE_VENDOR,
    ACTION_EDIT_VENDOR,
    ACTION_DELETE_VENDOR,
    ROLE_VENDOR,
    ROLE_PROCUREMENT_MANAGER,
)
from services.vendor_service import (
    get_vendors_paginated,
    get_vendors_for_select,
    create_vendor,
    get_vendor_stats,
    update_vendor_status,
    approve_vendor,
    reject_vendor,
    delete_vendor,
)
from services.procurement_service import (
    assign_vendor_to_pr,
    vm_accept_vendor_assignment,
    vm_reject_vendor_assignment,
    get_all_prs_for_vendor_manager,
)
from services.cache_service import (
    get_cached_vendor_stats,
    get_cached_performance_summary,
    get_cached_risk_distribution,
    get_cached_delivery_trend,
)
from services.performance_service import (
    get_vendor_performance_ranked,
    get_risk_tier_color,
    get_overall_performance_by_category,
    get_vendors_list_for_filter,
)
from config.settings import (
    VENDOR_CATEGORIES,
    VENDOR_CATEGORY_LABELS,
    VENDOR_CATEGORY_COLORS,
    VENDOR_STATUS_OPTIONS,
    COLLECTION_VENDORS,
)
from database.connection import get_database

import plotly.graph_objects as go


# ── Small helpers ─────────────────────────────────────────────────────────────

def _pill(text: str, fg: str, bg: str, bold: bool = True) -> str:
    weight = "700" if bold else "500"
    return (
        f'<span style="background:{bg};color:{fg};border:1px solid {fg}33;'
        f'border-radius:5px;padding:2px 8px;font-size:0.7rem;font-weight:{weight};">'
        f'{text}</span>'
    )


def _risk_pill(risk: str) -> str:
    COLORS = {
        "Low":      ("#2D6A4A", "#E8F5EE"),
        "Moderate": ("#A67C32", "#FEF8E7"),
        "High":     ("#8B3038", "#FDECEC"),
        "Critical": ("#6B1C1C", "#FDECEC"),
        "Medium":   ("#B08D57", "#FDF6EC"),
    }
    fg, bg = COLORS.get(risk, ("#68707C", "#F1F3F5"))
    return _pill(f"{risk} Risk", fg, bg)


def _approval_pill(status: str) -> str:
    COLORS = {
        "Pending":  ("#A67C32", "#FEF8E7"),
        "Approved": ("#2D6A4A", "#EAF5F0"),
        "Rejected": ("#8B3038", "#FDECEC"),
    }
    fg, bg = COLORS.get(status, ("#68707C", "#F1F3F5"))
    return _pill(status, fg, bg)


def _format_date(dt) -> str:
    if not dt:
        return "N/A"
    if isinstance(dt, str):
        return dt[:10]
    try:
        return dt.strftime("%b %d, %Y")
    except Exception:
        return "N/A"


def _score_bar(score: float) -> str:
    color = get_risk_tier_color(
        "Low" if score >= 70 else "Medium" if score >= 40 else "High"
    )
    pct = min(max(score, 0), 100)
    return (
        f'<div style="display:flex;align-items:center;gap:6px;">'
        f'<div style="flex:1;background:#E5E2DC;border-radius:3px;height:6px;">'
        f'<div style="width:{pct}%;background:{color};height:6px;border-radius:3px;"></div>'
        f'</div>'
        f'<span style="font-size:0.8rem;font-weight:700;color:{color};white-space:nowrap;">{score:.1f}</span>'
        f'</div>'
    )


def _kpi_card(label: str, value: str, sub: str = "", color: str = "#172033") -> str:
    sub_html = (
        f'<div style="font-size:0.72rem;color:#68707C;margin-top:2px;">{sub}</div>'
        if sub else ""
    )
    return (
        f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {color};'
        f'border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
        f'<div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">{label}</div>'
        f'<div style="font-size:1.55rem;font-weight:800;color:{color};margin-top:2px;">{value}</div>'
        f'{sub_html}'
        f'</div>'
    )


def _risk_badge_html(tier: str) -> str:
    color = get_risk_tier_color(tier)
    bg_map = {"Low": "#E8F5EE", "Medium": "#FDF6EC", "High": "#FBE9E9"}
    bg = bg_map.get(tier, "#F0F0F0")
    return (
        f'<span style="background:{bg};color:{color};border:1px solid {color};'
        f'border-radius:4px;padding:2px 8px;font-size:0.72rem;font-weight:700;">{tier} Risk</span>'
    )


# ── Main Page ──────────────────────────────────────────────────────────────────

def render_vendor_management_page() -> None:
    """
    Render the Overall Vendor Management module.

    Contains 4 tabs: Vendors | Approval Queue | Vendor Categories | Overall Performance.
    Explicitly blocked for Procurement Manager and Vendor (individual) roles.
    """
    user = get_current_user() or {}
    role = get_current_role()
    user_id = str(user.get("_id", ""))

    # ── Hard security guard (belt-and-suspenders with RBAC) ──────────────────
    if role == ROLE_VENDOR:
        st.error(
            "Individual vendor accounts cannot access Vendor Management. "
            "Use My Vendor Portal to view your own data."
        )
        if st.button("Go to My Portal", key="vm_vendor_redirect"):
            navigate_to("vendor_portal")
            st.rerun()
        return

    if role == ROLE_PROCUREMENT_MANAGER:
        st.error(
            "Procurement Manager role does not have access to Vendor Management. "
            "This module is restricted to Vendor Manager, Administrator, "
            "Supply Chain Manager, and Auditor roles."
        )
        if st.button("Return to Dashboard", key="vm_pm_redirect"):
            navigate_to("dashboard")
            st.rerun()
        return

    render_page_header(
        "Vendor Management",
        "Supplier directory, approval workflows, category intelligence, "
        "and overall performance across all 6 vendor categories.",
    )

    # ── Global KPI Strip ──────────────────────────────────────────────────────
    stats = get_cached_vendor_stats()
    k1, k2, k3, k4 = st.columns(4)
    kpi_data = [
        (k1, "Total Suppliers",    f"{stats.get('total', 0):,}",            "", "#172033"),
        (k2, "Active / Verified",  f"{stats.get('active', 0):,}",           "", "#2D6A4A"),
        (k3, "Pending Approval",   f"{stats.get('pending_approval', 0):,}", "", "#B08D57"),
        (k4, "High / Critical Risk", f"{stats.get('high_risk', 0):,}",      "", "#8B3038"),
    ]
    for col, label, val, sub, color in kpi_data:
        with col:
            st.markdown(_kpi_card(label, val, sub, color), unsafe_allow_html=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # ── Main Tabs ─────────────────────────────────────────────────────────────
    tabs = st.tabs([
        "Supplier Directory",
        "Vendor Assignments",
        "Approval Queue",
        "Vendor Categories",
        "Overall Performance",
    ])

    with tabs[0]:
        _render_suppliers_tab(role, user_id)

    with tabs[1]:
        _render_vendor_assignments_tab(role, user_id)

    with tabs[2]:
        _render_approval_tab(role, user_id)

    with tabs[3]:
        _render_categories_tab()

    with tabs[4]:
        _render_overall_performance_tab()

    # ── Register vendor form (if permitted) ───────────────────────────────────
    if has_action_permission(role, ACTION_CREATE_VENDOR):
        st.markdown("<div style='height:1rem;'></div>", unsafe_allow_html=True)
        render_section_header("Register New Vendor", "Add a new vendor or external partner to the procurement system")
        _render_register_form(role, user_id)



# ── Tab 2: Vendor Assignments (Vendor Manager Workflow) ───────────────────────

def _render_vendor_assignments_tab(role: str, user_id: str) -> None:
    """
    Vendor Assignments — the core Vendor Manager workflow view.

    Layout:
      For each of the 6 canonical categories:
        - Show all PRs in that category (Approved / Vendor Assigned / Vendor Accepted / Vendor Rejected)
        - If PR is 'Approved'  → show vendor selector + Assign button
        - If PR is 'Vendor Assigned' → show who is assigned + awaiting response badge
        - If PR is 'Vendor Accepted' → show green confirmation + proceed-to-PO note
        - If PR is 'Vendor Rejected' → show rejection + reassign selector

    Only vendors from the matching canonical category appear in the assignment dropdown.
    """
    from auth.permissions import ACTION_ASSIGN_VENDOR_PR

    can_assign = has_action_permission(role, ACTION_ASSIGN_VENDOR_PR)

    render_section_header(
        "Vendor Assignments by Category",
        "Procurement requests grouped by vendor category. "
        "Assign an approved vendor to each request, then track acceptance.",
    )

    # ── Status pill helper ────────────────────────────────────────────────────
    STATUS_COLORS = {
        "Approved":        ("#1D4E8F", "#EBF3FF"),
        "Vendor Assigned": ("#A67C32", "#FEF8E7"),
        "Vendor Accepted": ("#2D6A4A", "#EAF5F0"),
        "Vendor Rejected": ("#8B3038", "#FDECEC"),
    }

    def _status_pill(s: str) -> str:
        fg, bg = STATUS_COLORS.get(s, ("#526174", "#F1F3F5"))
        return (
            f'<span style="background:{bg};color:{fg};border:1px solid {fg}44;'
            f'border-radius:5px;padding:2px 9px;font-size:0.72rem;font-weight:700;">{s}</span>'
        )

    # ── Load all PRs grouped by category ──────────────────────────────────────
    grouped_prs = get_all_prs_for_vendor_manager()

    # ── Summary KPIs ──────────────────────────────────────────────────────────
    total_prs       = sum(len(v) for v in grouped_prs.values())
    need_assignment = sum(1 for prs in grouped_prs.values()
                          for pr in prs if pr.get("status") == "Approved")
    awaiting        = sum(1 for prs in grouped_prs.values()
                          for pr in prs if pr.get("status") == "Vendor Assigned")
    accepted        = sum(1 for prs in grouped_prs.values()
                          for pr in prs if pr.get("status") == "Vendor Accepted")

    k1, k2, k3, k4 = st.columns(4)
    for col, label, val, color in [
        (k1, "Total Requests (VM scope)", f"{total_prs}",       "#172033"),
        (k2, "Need Assignment",           f"{need_assignment}", "#1D4E8F"),
        (k3, "Awaiting Vendor Response",  f"{awaiting}",        "#A67C32"),
        (k4, "Vendor Accepted",           f"{accepted}",        "#2D6A4A"),
    ]:
        with col:
            st.markdown(_kpi_card(label, val, color=color), unsafe_allow_html=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    if total_prs == 0:
        render_empty_state(
            "No Requests in Vendor Manager Scope",
            "No Approved, Vendor Assigned, Vendor Accepted, or Vendor Rejected "
            "procurement requests exist for the 6 canonical categories yet. "
            "Once a Procurement Manager raises a request with one of the 6 vendor "
            "categories and it is approved, it will appear here for assignment.",
        )
        return

    # ── Category sections ─────────────────────────────────────────────────────
    for cat in VENDOR_CATEGORIES:
        prs = grouped_prs.get(cat, [])
        cat_color = VENDOR_CATEGORY_COLORS.get(cat, "#172033")
        cat_label = VENDOR_CATEGORY_LABELS.get(cat, cat)

        pr_count     = len(prs)
        need_assign  = sum(1 for p in prs if p.get("status") == "Approved")
        accepted_cnt = sum(1 for p in prs if p.get("status") == "Vendor Accepted")

        # ── Category header row ───────────────────────────────────────────────
        st.markdown(
            f'<div style="background:{cat_color}11;border:1px solid {cat_color}33;'
            f'border-left:4px solid {cat_color};border-radius:10px;'
            f'padding:0.65rem 1rem;margin:0.6rem 0 0.3rem;">'
            f'<div style="display:flex;justify-content:space-between;align-items:center;">'
            f'<div style="font-size:0.92rem;font-weight:800;color:{cat_color};">{cat_label}</div>'
            f'<div style="display:flex;gap:0.5rem;align-items:center;">'
            f'<span style="font-size:0.78rem;color:#526174;">{pr_count} request{"s" if pr_count != 1 else ""}</span>'
            + (f' &bull; <span style="color:#1D4E8F;font-weight:700;font-size:0.78rem;">'
               f'{need_assign} need assignment</span>' if need_assign else '')
            + (f' &bull; <span style="color:#2D6A4A;font-weight:700;font-size:0.78rem;">'
               f'{accepted_cnt} accepted</span>' if accepted_cnt else '')
            + f'</div></div></div>',
            unsafe_allow_html=True,
        )

        if not prs:
            st.markdown(
                f'<div style="color:#8C93A0;font-size:0.8rem;padding:0.4rem 1rem 0.6rem;">'
                f'No active procurement requests in this category.</div>',
                unsafe_allow_html=True,
            )
            continue

        # ── Vendor selector options for this category ─────────────────────────
        vendor_options = get_vendors_for_select(active_only=True, category=cat)
        vendor_map = {v["_id"]: v["company_name"] for v in vendor_options}
        vendor_names = ["— Select vendor —"] + [v["company_name"] for v in vendor_options]
        vendor_ids   = [None] + [v["_id"] for v in vendor_options]

        # ── PR rows ───────────────────────────────────────────────────────────
        for pr in prs:
            pr_id       = str(pr.get("_id", ""))
            pr_num      = pr.get("request_number", pr_id[:8])
            pr_title    = pr.get("title") or pr.get("description") or pr_num
            pr_status   = pr.get("status", "")
            pr_dept     = pr.get("department", "")
            pr_budget   = pr.get("estimated_budget")
            pr_priority = pr.get("priority", "")
            pr_created  = _format_date(pr.get("created_at"))
            assigned_vn = pr.get("assigned_vendor_name") or "—"
            vendor_resp = pr.get("vendor_response_status") or "—"

            with st.expander(
                f"{pr_num}  |  {pr_title[:60]}  |  {pr_status}",
                expanded=(pr_status in ("Approved", "Vendor Assigned")),
            ):
                col_info, col_action = st.columns([2.5, 1.5])

                with col_info:
                    # Status + priority badges
                    st.markdown(
                        f'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:0.5rem;">'
                        f'{_status_pill(pr_status)}'
                        + (f' <span style="background:#F1F3F5;color:#526174;border:1px solid #D9D6CF;'
                           f'border-radius:5px;padding:2px 8px;font-size:0.7rem;">'
                           f'{pr_priority} Priority</span>' if pr_priority else '')
                        + f'</div>',
                        unsafe_allow_html=True,
                    )

                    # Core fields — always visible
                    st.markdown(f"**Procurement Request ID:** `{pr_num}`")
                    st.markdown(f"**Vendor Category:** {cat_label}")
                    st.markdown(
                        f"**Assigned Vendor:** "
                        + (f'<b style="color:#172033;">{assigned_vn}</b>'
                           if pr_status != "Approved"
                           else '<span style="color:#8C93A0;">Not yet assigned</span>'),
                        unsafe_allow_html=True,
                    )

                    # Assignment Status line
                    _assign_status_colors = {
                        "Approved":        ("#1D4E8F", "#EBF3FF", "Ready for Assignment"),
                        "Vendor Assigned": ("#A67C32", "#FEF8E7", "Pending VM Acceptance"),
                        "Vendor Accepted": ("#2D6A4A", "#EAF5F0", "Accepted — PO Ready"),
                        "Vendor Rejected": ("#8B3038", "#FDECEC", "Rejected — Reassign Needed"),
                    }
                    _fg, _bg, _label = _assign_status_colors.get(
                        pr_status, ("#526174", "#F1F3F5", pr_status)
                    )
                    st.markdown(
                        f'**Assignment Status:** '
                        f'<span style="background:{_bg};color:{_fg};border:1px solid {_fg}44;'
                        f'border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:700;">'
                        f'{_label}</span>',
                        unsafe_allow_html=True,
                    )

                    # Secondary details
                    if pr_dept:
                        st.markdown(f"**Department:** {pr_dept}")
                    if pr_budget:
                        st.markdown(f"**Budget:** ${float(pr_budget):,.0f}")
                    st.markdown(f"**Raised:** {pr_created}")

                    # VM rejection reason (if rejected/reassigned)
                    if pr.get("vm_rejection_reason"):
                        st.markdown(
                            f'<div style="background:#FFF3CD;border-radius:6px;'
                            f'padding:0.3rem 0.6rem;font-size:0.78rem;color:#856404;margin-top:0.3rem;">'
                            f'Previous rejection reason: {pr["vm_rejection_reason"]}</div>',
                            unsafe_allow_html=True,
                        )


                with col_action:
                    # ── Assignment controls ───────────────────────────────────
                    if pr_status in ("Approved", "Vendor Rejected") and can_assign:
                        if not vendor_options:
                            st.warning(
                                f"No approved vendors in **{cat_label}**. "
                                f"Register and approve a vendor first."
                            )
                        else:
                            sel_idx = st.selectbox(
                                "Assign Vendor",
                                range(len(vendor_names)),
                                format_func=lambda i: vendor_names[i],
                                key=f"vm_assign_sel_{pr_id}",
                            )
                            if st.button(
                                "Assign Vendor",
                                key=f"vm_assign_btn_{pr_id}",
                                type="primary",
                                use_container_width=True,
                                disabled=(sel_idx == 0),
                            ):
                                chosen_vid  = vendor_ids[sel_idx]
                                chosen_name = vendor_names[sel_idx]
                                ok, msg = assign_vendor_to_pr(
                                    pr_id=pr_id,
                                    vendor_id=chosen_vid,
                                    assigned_by=user_id,
                                    vendor_name=chosen_name,
                                )
                                if ok:
                                    st.success(f"Assigned **{chosen_name}** to {pr_num}.")
                                    st.rerun()
                                else:
                                    st.error(msg)

                    elif pr_status == "Vendor Assigned" and can_assign:
                        # ── Assigned — Vendor Manager must Accept or Reject ────
                        st.markdown(
                            f'<div style="background:#EBF3FF;border:1px solid #1D4E8F33;'
                            f'border-radius:8px;padding:0.55rem 0.8rem;'
                            f'font-size:0.8rem;margin-bottom:0.5rem;">'
                            f'<b style="color:#1D4E8F;">Pending VM Acceptance</b><br>'
                            f'<span style="color:#68707C;">'
                            f'{assigned_vn} has been assigned. '
                            f'Confirm this assignment to enable PO creation.</span>'
                            f'</div>',
                            unsafe_allow_html=True,
                        )

                        # ── ACCEPT VENDOR ASSIGNMENT ──────────────────────────
                        if st.button(
                            "ACCEPT VENDOR ASSIGNMENT",
                            key=f"vm_accept_btn_{pr_id}",
                            type="primary",
                            use_container_width=True,
                        ):
                            ok, msg = vm_accept_vendor_assignment(
                                pr_id=pr_id,
                                accepted_by=user_id,
                            )
                            if ok:
                                st.success(msg)
                                st.rerun()
                            else:
                                st.error(msg)

                        # ── REJECT / REASSIGN ─────────────────────────────────
                        with st.expander("Reject / Reassign to Different Vendor", expanded=False):
                            reject_reason = st.text_input(
                                "Reason for rejection (optional)",
                                placeholder="e.g. Vendor unavailable, pricing issue...",
                                key=f"vm_rej_reason_{pr_id}",
                            )
                            st.markdown(
                                '<div style="font-size:0.75rem;color:#8B3038;margin:0.3rem 0;">'
                                'Rejecting will clear this assignment and allow re-assignment '
                                'to another vendor in the same category.</div>',
                                unsafe_allow_html=True,
                            )
                            col_rej, col_rea = st.columns(2)
                            with col_rej:
                                if st.button(
                                    "Reject Assignment",
                                    key=f"vm_reject_btn_{pr_id}",
                                    use_container_width=True,
                                ):
                                    ok, msg = vm_reject_vendor_assignment(
                                        pr_id=pr_id,
                                        rejected_by=user_id,
                                        reason=reject_reason,
                                    )
                                    if ok:
                                        st.success(msg)
                                        st.rerun()
                                    else:
                                        st.error(msg)

                            with col_rea:
                                if vendor_options:
                                    sel_idx2 = st.selectbox(
                                        "Reassign to",
                                        range(len(vendor_names)),
                                        format_func=lambda i: vendor_names[i],
                                        key=f"vm_reassign_sel_{pr_id}",
                                    )
                                    if st.button(
                                        "Reassign Vendor",
                                        key=f"vm_reassign_btn_{pr_id}",
                                        use_container_width=True,
                                        disabled=(sel_idx2 == 0),
                                    ):
                                        chosen_vid2  = vendor_ids[sel_idx2]
                                        chosen_name2 = vendor_names[sel_idx2]
                                        ok, msg = assign_vendor_to_pr(
                                            pr_id=pr_id,
                                            vendor_id=chosen_vid2,
                                            assigned_by=user_id,
                                            vendor_name=chosen_name2,
                                        )
                                        if ok:
                                            st.success(f"Reassigned to {chosen_name2}.")
                                            st.rerun()
                                        else:
                                            st.error(msg)

                    elif pr_status == "Vendor Assigned" and not can_assign:
                        st.markdown(
                            f'<div style="background:#FEF8E7;border:1px solid #D4A017;'
                            f'border-radius:8px;padding:0.6rem 0.8rem;font-size:0.82rem;">'
                            f'<b style="color:#A67C32;">Pending VM Acceptance</b><br>'
                            f'<span style="color:#68707C;">{assigned_vn} assigned.</span>'
                            f'</div>',
                            unsafe_allow_html=True,
                        )

                    elif pr_status == "Vendor Accepted":
                        st.markdown(
                            f'<div style="background:#EAF5F0;border:1px solid #2D6A4A;'
                            f'border-radius:8px;padding:0.6rem 0.8rem;font-size:0.82rem;">'
                            f'<b style="color:#2D6A4A;">Vendor Accepted</b><br>'
                            f'<span style="color:#68707C;">{assigned_vn} has accepted. '
                            f'Procurement Manager can now raise a Purchase Order.</span>'
                            f'</div>',
                            unsafe_allow_html=True,
                        )

                    elif not can_assign:
                        st.caption("Read-only — vendor assignment requires Vendor Manager role.")


# ── Tab 1: Supplier Directory ─────────────────────────────────────────────────


def _render_suppliers_tab(role: str, user_id: str) -> None:
    """Paginated, filterable supplier directory."""
    col_search, col_cat, col_risk, col_status, col_sort = st.columns([1.8, 1.2, 1.1, 1.0, 1.2])

    with col_search:
        search_query = st.text_input(
            "Search",
            placeholder="Supplier ID or company...",
            key="vm_search",
        )
    with col_cat:
        category_filter = st.selectbox(
            "Category",
            ["All"] + VENDOR_CATEGORIES,
            key="vm_cat",
        )
    with col_risk:
        risk_filter = st.selectbox(
            "Risk Level",
            ["All", "Low", "Moderate", "High", "Critical"],
            key="vm_risk",
        )
    with col_status:
        status_filter = st.selectbox(
            "Status",
            ["All"] + VENDOR_STATUS_OPTIONS,
            key="vm_status",
        )
    with col_sort:
        sort_choice = st.selectbox(
            "Sort By",
            [
                ("Reliability (High to Low)", "reliability_score", -1),
                ("Total Orders (Most)",        "total_orders",       -1),
                ("Late Delivery Rate (Lowest)", "late_delivery_rate", 1),
                ("Company Name (A-Z)",          "company_name",       1),
            ],
            format_func=lambda x: x[0],
            key="vm_sort",
        )

    if "vm_page" not in st.session_state:
        st.session_state["vm_page"] = 1

    col_size, col_page_ctrl = st.columns([1, 4])
    with col_size:
        page_size = st.selectbox("Per page", [20, 50, 100], index=0, key="vm_page_size")

    paged = get_vendors_paginated(
        page=st.session_state["vm_page"],
        page_size=page_size,
        status=status_filter if status_filter != "All" else None,
        category=category_filter if category_filter != "All" else None,
        risk_label=risk_filter if risk_filter != "All" else None,
        search=search_query,
        sort_by=sort_choice[1],
        sort_order=sort_choice[2],
        canonical_only=True,
    )

    vendors = paged["items"]
    total_count = paged["total"]
    current_page = paged["page"]
    total_pages = paged["total_pages"]

    with col_page_ctrl:
        p_prev, p_info, p_next = st.columns([1, 2, 1])
        with p_prev:
            if st.button("Previous", disabled=(current_page <= 1), key="vm_prev", use_container_width=True):
                st.session_state["vm_page"] = max(1, current_page - 1)
                st.rerun()
        with p_info:
            st.markdown(
                f'<div style="text-align:center;padding-top:6px;font-size:0.85rem;color:#526174;">'
                f'Page <b>{current_page}</b> of <b>{total_pages:,}</b> ({total_count:,} suppliers)'
                f'</div>',
                unsafe_allow_html=True,
            )
        with p_next:
            if st.button("Next", disabled=(current_page >= total_pages), key="vm_next", use_container_width=True):
                st.session_state["vm_page"] = min(total_pages, current_page + 1)
                st.rerun()

    st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)

    if not vendors:
        render_empty_state("No Suppliers Found", "No suppliers match your current search and filter criteria.")
        return

    for v in vendors:
        v_id  = str(v.get("_id", ""))
        sup_id = v.get("supplier_id") or v.get("vendor_code", "N/A")
        c_name = v.get("company_name", f"Supplier {sup_id}")
        cat    = v.get("category", "General")
        stat   = v.get("status", "Active")
        risk   = v.get("risk_label", "Low")
        rel    = float(v.get("reliability_score") or 85.0)
        addr   = v.get("address", {})
        loc    = f"{addr.get('city', '')}, {addr.get('country', '')}".strip(", ") or "Global"

        with st.expander(f"{sup_id}  |  {c_name}  |  {cat}  |  Reliability: {rel:.1f}%  |  {risk} Risk"):
            top_c1, top_c2, top_c3 = st.columns([2, 2, 1])

            with top_c1:
                st.markdown(
                    f'<div style="display:flex;gap:8px;align-items:center;margin-bottom:0.6rem;">'
                    f'{render_status_badge(stat)} {render_risk_badge(risk)}'
                    f'</div>',
                    unsafe_allow_html=True,
                )
                st.markdown(f"**Supplier ID:** `{sup_id}`")
                st.markdown(f"**Category:** {cat}")
                st.markdown(f"**Location:** {loc}")
                if v.get("description"):
                    st.markdown(f"**Overview:** {v['description']}")

            with top_c2:
                contact = v.get("contact_information", {})
                st.markdown(f"**Contact:** {contact.get('primary_contact_name', 'Operations Team')}")
                st.markdown(f"**Email:** `{contact.get('primary_email', 'procurement@supplier.com')}`")
                st.markdown(f"**Phone:** {contact.get('primary_phone', '')}")
                st.markdown(f"**Payment Terms:** {v.get('payment_terms', 'Net 30')}")

            with top_c3:
                if has_action_permission(role, ACTION_EDIT_VENDOR):
                    new_stat = st.selectbox(
                        "Change Status",
                        VENDOR_STATUS_OPTIONS,
                        index=VENDOR_STATUS_OPTIONS.index(stat) if stat in VENDOR_STATUS_OPTIONS else 0,
                        key=f"vm_stat_sel_{v_id}",
                    )
                    if st.button("Update", key=f"vm_btn_stat_{v_id}", type="primary", use_container_width=True):
                        ok, msg = update_vendor_status(v_id, new_stat, user_id)
                        if ok:
                            st.success(msg)
                            st.rerun()
                        else:
                            st.error(msg)

                    if has_action_permission(role, ACTION_DELETE_VENDOR) and stat != "Inactive":
                        if st.button("Deactivate", key=f"vm_btn_deact_{v_id}", use_container_width=True):
                            ok, msg = delete_vendor(v_id, user_id)
                            if ok:
                                st.warning(msg)
                                st.rerun()

            # Performance metrics row
            st.markdown(
                "<hr style='margin:0.6rem 0;border:none;border-top:1px solid #E2E8F0;'>",
                unsafe_allow_html=True,
            )
            st.markdown(
                "<div style='font-size:0.78rem;font-weight:700;color:#172033;margin-bottom:0.4rem;'>"
                "PERFORMANCE METRICS</div>",
                unsafe_allow_html=True,
            )
            m1, m2, m3, m4, m5, m6 = st.columns(6)
            with m1:
                st.metric("On-Time Deliveries", f"{int(v.get('on_time_count') or 0):,}")
            with m2:
                st.metric("Delayed Deliveries", f"{int(v.get('late_delivery_count') or 0):,}")
            with m3:
                qi = max(0.0, 1.0 - float(v.get('late_delivery_rate') or 0.0)) * 100
                st.metric("Quality Rating", f"{qi:.1f}%")
            with m4:
                avg_real  = float(v.get('avg_shipping_days_real') or 5.0)
                avg_sched = float(v.get('avg_shipping_days_scheduled') or 5.0)
                rs = max(0.0, min(1.0, 2.0 - avg_real / avg_sched if avg_sched > 0 else 0.5)) * 100
                st.metric("Response Time Score", f"{rs:.1f}%")
            with m5:
                total_ord = int(v.get('total_orders') or 0)
                on_time   = int(v.get('on_time_count') or 0)
                late_cnt  = int(v.get('late_delivery_count') or 0)
                irt = rs  # proxy same as response score
                st.metric("Issue Resolution Time", f"{irt:.1f}%")
            with m6:
                cr = min(((on_time + late_cnt) / total_ord * 100) if total_ord > 0 else 0.0, 100.0)
                st.metric("Order Completion Rate", f"{cr:.1f}%")

            # Reliability + extra details
            st.markdown(
                f'<div style="display:flex;gap:1.5rem;font-size:0.78rem;color:#526174;margin-top:0.4rem;">'
                f'<span><b>Reliability:</b> {rel:.1f}%</span>'
                f'<span><b>Total Orders:</b> {total_ord:,}</span>'
                f'<span><b>Avg Transit:</b> {float(v.get("avg_shipping_days_real") or 0):.1f} days</span>'
                f'<span><b>Risk:</b> {risk}</span>'
                f'</div>',
                unsafe_allow_html=True,
            )


# ── Tab 2: Approval Queue ─────────────────────────────────────────────────────

def _render_approval_tab(role: str, user_id: str) -> None:
    """Approval queue with Pending / Approved / Rejected sub-tabs."""
    can_approve = has_action_permission(role, ACTION_APPROVE_VENDOR)

    aq_tabs = st.tabs(["Pending Approval", "Recently Approved", "Recently Rejected"])

    with aq_tabs[0]:
        pending_data = get_vendors_paginated(approval_status="Pending", page_size=50, canonical_only=True)
        pending = pending_data["items"]

        if not pending:
            render_empty_state(
                "Approval Queue Clear",
                "All vendor registrations have been reviewed. No pending approvals remain.",
            )
        else:
            render_section_header(
                f"Pending Vendor Approvals ({len(pending)} records)",
                "Review each vendor before approving or rejecting their registration",
            )
            for v in pending:
                v_id   = str(v.get("_id", ""))
                sup_id = v.get("supplier_id") or v.get("vendor_code", "N/A")
                c_name = v.get("company_name", f"Supplier {sup_id}")
                cat    = v.get("category", "General")
                rel    = float(v.get("reliability_score") or 80.0)
                tot    = int(v.get("total_orders") or 0)
                late_rate = (float(v.get("late_delivery_rate") or 0.0)) * 100
                created = v.get("created_at")

                with st.expander(f"{sup_id}  |  {c_name}  |  {cat}"):
                    col_info, col_metrics, col_actions = st.columns([2.5, 2, 1.2])

                    with col_info:
                        st.markdown(
                            f'<div style="display:flex;gap:8px;margin-bottom:0.5rem;">'
                            f'{_risk_pill("Moderate")} {_approval_pill("Pending")}'
                            f'</div>',
                            unsafe_allow_html=True,
                        )
                        st.markdown(f"**Supplier ID:** `{sup_id}`")
                        st.markdown(f"**Category:** {cat}")
                        contact = v.get("contact_information", {})
                        if contact.get("primary_email"):
                            st.markdown(f"**Email:** {contact['primary_email']}")
                        if contact.get("primary_contact_name"):
                            st.markdown(f"**Contact:** {contact['primary_contact_name']}")
                        addr = v.get("address", {})
                        loc = f"{addr.get('city', '')}, {addr.get('country', '')}".strip(", ")
                        if loc:
                            st.markdown(f"**Location:** {loc}")
                        st.markdown(f"**Submitted:** {_format_date(created)}")

                    with col_metrics:
                        st.markdown(
                            '<div style="font-size:0.75rem;font-weight:700;color:#68707C;'
                            'text-transform:uppercase;margin-bottom:0.4rem;">Performance Metrics</div>',
                            unsafe_allow_html=True,
                        )
                        ma, mb = st.columns(2)
                        with ma:
                            st.metric("Reliability", f"{rel:.1f}%")
                            st.metric("Total Orders", f"{tot:,}")
                        with mb:
                            st.metric("Late Delivery Rate", f"{late_rate:.1f}%")
                            avg_days = float(v.get("avg_shipping_days_real") or 0.0)
                            st.metric("Avg Transit", f"{avg_days:.1f}d")

                    with col_actions:
                        if can_approve:
                            if st.button(
                                "Approve Vendor",
                                key=f"vm_appr_{v_id}",
                                type="primary",
                                use_container_width=True,
                            ):
                                ok, msg = approve_vendor(v_id, user_id)
                                if ok:
                                    st.success(msg)
                                    st.rerun()
                                else:
                                    st.error(msg)

                            reason = st.text_input(
                                "Rejection Reason",
                                placeholder="State reason...",
                                key=f"vm_rej_reason_{v_id}",
                                label_visibility="collapsed",
                            )
                            st.caption("Enter rejection reason above")
                            if st.button(
                                "Reject Application",
                                key=f"vm_rej_{v_id}",
                                use_container_width=True,
                            ):
                                ok, msg = reject_vendor(v_id, user_id, reason)
                                if ok:
                                    st.warning(msg)
                                    st.rerun()
                                else:
                                    st.error(msg)
                        else:
                            st.info("Read-only access. Contact an administrator to approve vendors.")

    with aq_tabs[1]:
        approved_data = get_vendors_paginated(approval_status="Approved", page_size=30, canonical_only=True)
        approved = approved_data["items"]
        render_section_header(f"Recently Approved Vendors ({approved_data['total']:,} total)")

        if not approved:
            render_empty_state("No Approved Vendors", "No vendors have been approved yet.")
        else:
            for v in approved:
                sup_id = v.get("supplier_id") or v.get("vendor_code", "N/A")
                c_name = v.get("company_name", f"Supplier {sup_id}")
                cat    = v.get("category", "General")
                risk   = v.get("risk_label", "Low")
                approved_by = v.get("approved_by", "System")
                st.markdown(
                    f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid #2D6A4A;'
                    f'border-radius:8px;padding:0.7rem 1rem;margin-bottom:0.4rem;'
                    f'display:flex;justify-content:space-between;align-items:center;">'
                    f'<div>'
                    f'<div style="font-size:0.87rem;font-weight:700;color:#20242A;">{c_name}</div>'
                    f'<div style="font-size:0.75rem;color:#68707C;">{sup_id} &bull; {cat} &bull; Approved by: {approved_by}</div>'
                    f'</div>'
                    f'<div style="display:flex;align-items:center;gap:0.5rem;">'
                    f'{_risk_pill(risk)} {_approval_pill("Approved")}'
                    f'</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

    with aq_tabs[2]:
        rejected_data = get_vendors_paginated(approval_status="Rejected", page_size=30, canonical_only=True)
        rejected = rejected_data["items"]
        render_section_header(f"Rejected Applications ({rejected_data['total']:,} total)")

        if not rejected:
            render_empty_state("No Rejected Applications", "No vendor applications have been rejected.")
        else:
            for v in rejected:
                sup_id = v.get("supplier_id") or v.get("vendor_code", "N/A")
                c_name = v.get("company_name", f"Supplier {sup_id}")
                cat    = v.get("category", "General")
                rejected_by = v.get("rejected_by", "System")
                reason = v.get("rejection_reason", "Not specified")
                st.markdown(
                    f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid #8B3038;'
                    f'border-radius:8px;padding:0.7rem 1rem;margin-bottom:0.4rem;">'
                    f'<div style="display:flex;justify-content:space-between;align-items:center;">'
                    f'<div>'
                    f'<div style="font-size:0.87rem;font-weight:700;color:#20242A;">{c_name}</div>'
                    f'<div style="font-size:0.75rem;color:#68707C;">{sup_id} &bull; {cat} &bull; Rejected by: {rejected_by}</div>'
                    f'</div>'
                    f'{_approval_pill("Rejected")}'
                    f'</div>'
                    f'<div style="font-size:0.78rem;color:#8B3038;margin-top:0.35rem;background:#FDECEC;'
                    f'border-radius:5px;padding:0.3rem 0.6rem;">Reason: {reason}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )


# ── Tab 3: Vendor Categories ──────────────────────────────────────────────────

def _render_categories_tab() -> None:
    """Display all 6 canonical vendor categories with supplier density stats."""
    render_section_header(
        "Vendor Category Directory",
        "Exactly 6 canonical vendor categories — supplier allocation and active coverage",
    )

    try:
        db = get_database()
        col = db[COLLECTION_VENDORS]
        pipeline = [
            {"$group": {
                "_id": "$category",
                "total":  {"$sum": 1},
                "active": {"$sum": {"$cond": [{"$eq": ["$status", "Active"]}, 1, 0]}},
                "approved": {"$sum": {"$cond": [{"$eq": ["$approval_status", "Approved"]}, 1, 0]}},
                "avg_reliability": {"$avg": "$reliability_score"},
            }},
        ]
        agg = list(col.aggregate(pipeline))
    except Exception:
        agg = []

    cat_data: dict = {c: {"total": 0, "active": 0, "approved": 0, "avg_reliability": 0.0}
                      for c in VENDOR_CATEGORIES}
    total_all = 0
    for r in agg:
        cat = r.get("_id") or ""
        if cat in cat_data:
            cat_data[cat] = {
                "total":  r.get("total", 0),
                "active": r.get("active", 0),
                "approved": r.get("approved", 0),
                "avg_reliability": round(float(r.get("avg_reliability") or 0), 1),
            }
            total_all += r.get("total", 0)

    # KPI row
    kp1, kp2, kp3, kp4 = st.columns(4)
    with kp1:
        st.markdown(_kpi_card("Total Categories", "6", "Canonical categories", "#172033"), unsafe_allow_html=True)
    with kp2:
        active_cats = sum(1 for c in cat_data if cat_data[c]["total"] > 0)
        st.markdown(_kpi_card("Active Sectors", str(active_cats), "Have suppliers", "#2D6A4A"), unsafe_allow_html=True)
    with kp3:
        st.markdown(_kpi_card("Total Suppliers", f"{total_all:,}", "Across all categories", "#2E4B7A"), unsafe_allow_html=True)
    with kp4:
        top_cat = max(cat_data, key=lambda c: cat_data[c]["total"]) if total_all > 0 else "—"
        st.markdown(_kpi_card("Largest Category", VENDOR_CATEGORY_LABELS.get(top_cat, top_cat), "By supplier count", "#1677E8"), unsafe_allow_html=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    search_q = st.text_input("Filter Categories", placeholder="Search category...", key="vm_cat_search")
    filtered_cats = [c for c in VENDOR_CATEGORIES if not search_q or search_q.lower() in c.lower()
                     or search_q.lower() in VENDOR_CATEGORY_LABELS.get(c, "").lower()]

    cols = st.columns(2)
    for idx, cat_key in enumerate(filtered_cats):
        col_target = cols[idx % 2]
        info  = cat_data.get(cat_key, {"total": 0, "active": 0, "approved": 0, "avg_reliability": 0.0})
        count = info["total"]
        active_count = info["active"]
        pct   = f"{(count / total_all * 100):.1f}%" if total_all > 0 else "0.0%"
        color = VENDOR_CATEGORY_COLORS.get(cat_key, "#1677E8")
        label = VENDOR_CATEGORY_LABELS.get(cat_key, cat_key)
        avg_rel = info["avg_reliability"]

        with col_target:
            st.markdown(
                f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {color};'
                f'border-radius:10px;padding:1rem 1.25rem;margin-bottom:0.75rem;'
                f'box-shadow:0 1px 3px rgba(0,0,0,0.03);">'
                f'<div style="display:flex;justify-content:space-between;align-items:center;">'
                f'<div>'
                f'<div style="font-size:1rem;font-weight:700;color:#172033;">{label}</div>'
                f'<div style="font-size:0.75rem;color:#68707C;font-weight:600;margin-top:1px;">Key: {cat_key}</div>'
                f'<div style="font-size:0.78rem;color:#526174;margin-top:0.3rem;">'
                f'Active: <strong style="color:#2D6A4A;">{active_count:,}</strong>'
                f' &bull; Total: <strong>{count:,}</strong>'
                f' &bull; Avg Reliability: <strong style="color:{color};">{avg_rel:.1f}%</strong>'
                f'</div>'
                f'</div>'
                f'<div style="text-align:right;">'
                f'<span style="background:#EAF3FF;color:#1677E8;padding:4px 10px;'
                f'border-radius:6px;font-size:0.75rem;font-weight:700;">{pct} Share</span>'
                f'</div>'
                f'</div>'
                f'</div>',
                unsafe_allow_html=True,
            )


# ── Tab 4: Overall Performance ────────────────────────────────────────────────

def _render_overall_performance_tab() -> None:
    """
    Cross-vendor performance view — Vendor Manager ONLY.
    Shows combined performance metrics across ALL 6 vendor categories.
    Includes interactive Plotly graphs for all 8 required metrics with
    filters by Vendor Category, Individual Vendor, and Date Range.

    IMPORTANT: Individual vendor portals (ROLE_VENDOR) must NOT use this
    function.  Individual vendors see only their own data via
    get_vendor_own_performance() in views/vendor_portal.py.
    """
    from datetime import datetime, date, timedelta

    render_section_header(
        "Overall Vendor Performance",
        "Combined performance graphs across all 6 vendor categories — Vendor Manager view only",
    )

    # ── Global KPIs ───────────────────────────────────────────────────────────
    summary = get_cached_performance_summary()
    c1, c2, c3, c4, c5, c6 = st.columns(6)
    perf_kpis = [
        (c1, "Overall On-Time Rate",  f"{summary.get('overall_on_time_pct', 0.0):.1f}%",  "On-Time Deliveries",   "#2D6A4A"),
        (c2, "Delay Rate",            f"{summary.get('overall_late_pct', 0.0):.1f}%",     "Delayed Deliveries",   "#8B3038"),
        (c3, "Avg Transit Days",      f"{summary.get('avg_transit_days', 0.0):.1f}d",     "Response Time proxy",  "#B08D57"),
        (c4, "Avg Reliability Score", f"{summary.get('avg_reliability', 0.0):.1f}",       "Composite score",      "#172033"),
        (c5, "High Risk Vendors",     f"{summary.get('high_risk_count', 0):,}",           "Score < 40",           "#8B3038"),
        (c6, "Active Suppliers",      f"{summary.get('total_vendors', 0):,}",             "All categories",       "#2E4B7A"),
    ]
    for col, label, val, sub, color in perf_kpis:
        with col:
            st.markdown(_kpi_card(label, val, sub, color), unsafe_allow_html=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # ── FILTERS ───────────────────────────────────────────────────────────────
    st.markdown(
        '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;'
        'padding:0.9rem 1.2rem;margin-bottom:1rem;'
        'box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
        '<div style="font-size:0.78rem;font-weight:700;color:#172033;'
        'text-transform:uppercase;margin-bottom:0.65rem;letter-spacing:0.5px;">'
        'Performance Filters</div>',
        unsafe_allow_html=True,
    )
    f1, f2, f3, f4 = st.columns([1.3, 1.6, 1.2, 1.2])

    with f1:
        cat_filter = st.selectbox(
            "Vendor Category",
            ["All"] + VENDOR_CATEGORIES,
            format_func=lambda k: "All Categories" if k == "All" else VENDOR_CATEGORY_LABELS.get(k, k),
            key="op_cat_filter",
        )

    # Load vendors for individual vendor filter (dynamic based on category)
    vendor_list = get_vendors_list_for_filter(
        category=cat_filter if cat_filter != "All" else None
    )
    vendor_options = [{"_id": "All", "company_name": "All Vendors", "vendor_code": ""}] + vendor_list
    vendor_display = [
        "All Vendors" if v["_id"] == "All"
        else f"{v['company_name']} ({v['vendor_code']})"
        for v in vendor_options
    ]

    with f2:
        vendor_sel_idx = st.selectbox(
            "Individual Vendor",
            range(len(vendor_options)),
            format_func=lambda i: vendor_display[i],
            key="op_vendor_filter",
        )
    selected_vendor_id = vendor_options[vendor_sel_idx]["_id"]

    # Date range defaults: last 24 months
    default_end   = date.today()
    default_start = (default_end.replace(day=1) - timedelta(days=365*2)).replace(day=1)

    with f3:
        date_from = st.date_input("From Date", value=default_start, key="op_date_from")
    with f4:
        date_to = st.date_input("To Date", value=default_end, key="op_date_to")

    st.markdown("</div>", unsafe_allow_html=True)
    st.markdown("<div style='height:0.4rem;'></div>", unsafe_allow_html=True)

    # ── Fetch live data from MongoDB ──────────────────────────────────────────
    from_dt = datetime(date_from.year, date_from.month, date_from.day) if date_from else None
    to_dt   = datetime(date_to.year, date_to.month, date_to.day, 23, 59, 59) if date_to else None

    cat_data = get_overall_performance_by_category(
        category=cat_filter if cat_filter != "All" else None,
        vendor_id=selected_vendor_id if selected_vendor_id != "All" else None,
        date_from=from_dt,
        date_to=to_dt,
    )

    if not cat_data:
        render_empty_state(
            "No Performance Data",
            "No vendor data found for the selected filters. "
            "Try broadening the category, vendor, or date range filters.",
        )
        return

    # ── Build chart-ready arrays ──────────────────────────────────────────────
    cat_labels    = [d["category_label"] for d in cat_data]
    cat_colors    = [VENDOR_CATEGORY_COLORS.get(d["category"], "#172033") for d in cat_data]
    on_time_vals  = [d["on_time_deliveries"]    for d in cat_data]
    delayed_vals  = [d["delayed_deliveries"]     for d in cat_data]
    quality_vals  = [d["quality_rating"]         for d in cat_data]
    response_vals = [d["response_time"]          for d in cat_data]
    issue_vals    = [d["issue_resolution_time"]  for d in cat_data]
    completion_vals = [d["order_completion_rate"] for d in cat_data]
    reliability_vals = [d["reliability_score"]   for d in cat_data]
    on_time_rate_vals = [d["on_time_rate"]        for d in cat_data]

    _CHART_BG   = "rgba(0,0,0,0)"
    _GRID_COLOR = "#E5E2DC"
    _TITLE_FONT = dict(color="#172033", size=13, family="Inter, system-ui")

    def _base_layout(title_text: str, yaxis_title: str = "") -> dict:
        return dict(
            title=dict(text=title_text, font=_TITLE_FONT, x=0),
            paper_bgcolor=_CHART_BG,
            plot_bgcolor=_CHART_BG,
            margin=dict(l=10, r=10, t=45, b=10),
            xaxis=dict(showgrid=False, tickfont=dict(size=10, color="#526174")),
            yaxis=dict(
                gridcolor=_GRID_COLOR,
                title=yaxis_title,
                tickfont=dict(size=10, color="#526174"),
            ),
            showlegend=False,
            hoverlabel=dict(bgcolor="#FFFFFF", font_size=12),
        )

    # ── Row 1: On-Time Deliveries + Delayed Deliveries ────────────────────────
    render_section_header(
        "Delivery Performance",
        "On-Time and Delayed delivery counts across all 6 vendor categories",
    )
    row1_c1, row1_c2 = st.columns(2, gap="medium")

    with row1_c1:
        fig1 = go.Figure(go.Bar(
            x=cat_labels, y=on_time_vals,
            marker=dict(color=cat_colors, opacity=0.88),
            text=[f"{v:,}" for v in on_time_vals],
            textposition="outside",
            hovertemplate="<b>%{x}</b><br>On-Time: %{y:,}<extra></extra>",
        ))
        fig1.update_layout(**_base_layout("On-Time Deliveries", "Count"), height=320)
        st.plotly_chart(fig1, use_container_width=True)

    with row1_c2:
        fig2 = go.Figure(go.Bar(
            x=cat_labels, y=delayed_vals,
            marker=dict(
                color=["#8B3038"] * len(delayed_vals),
                opacity=[max(0.3, min(1.0, v / max(delayed_vals, default=[1]))) for v in delayed_vals],
            ),
            text=[f"{v:,}" for v in delayed_vals],
            textposition="outside",
            hovertemplate="<b>%{x}</b><br>Delayed: %{y:,}<extra></extra>",
        ))
        fig2.update_layout(**_base_layout("Delayed Deliveries", "Count"), height=320)
        st.plotly_chart(fig2, use_container_width=True)

    # ── Row 2: Quality Rating + Response Time ─────────────────────────────────
    render_section_header(
        "Quality & Response Metrics",
        "Quality Rating and Response Time Score per vendor category (%)",
    )
    row2_c1, row2_c2 = st.columns(2, gap="medium")

    with row2_c1:
        fig3 = go.Figure()
        fig3.add_trace(go.Bar(
            x=cat_labels, y=quality_vals,
            marker=dict(color="#B08D57", opacity=0.85),
            text=[f"{v:.1f}%" for v in quality_vals],
            textposition="outside",
            hovertemplate="<b>%{x}</b><br>Quality Rating: %{y:.1f}%<extra></extra>",
        ))
        # Threshold line at 80%
        fig3.add_hline(y=80, line_dash="dot", line_color="#2D6A4A", line_width=1.5,
                       annotation_text="80% target", annotation_position="right")
        fig3.update_layout(**_base_layout("Quality Rating (%)", "%"), height=320, yaxis_range=[0, 110])
        st.plotly_chart(fig3, use_container_width=True)

    with row2_c2:
        fig4 = go.Figure()
        fig4.add_trace(go.Bar(
            x=cat_labels, y=response_vals,
            marker=dict(color="#2E4B7A", opacity=0.85),
            text=[f"{v:.1f}%" for v in response_vals],
            textposition="outside",
            hovertemplate="<b>%{x}</b><br>Response Time Score: %{y:.1f}%<extra></extra>",
        ))
        fig4.update_layout(**_base_layout("Response Time Score (%)", "%"), height=320, yaxis_range=[0, 110])
        st.plotly_chart(fig4, use_container_width=True)

    # ── Row 3: Issue Resolution Time + Order Completion Rate ──────────────────
    render_section_header(
        "Issue Resolution & Completion",
        "Issue Resolution Score and Order Completion Rate per vendor category (%)",
    )
    row3_c1, row3_c2 = st.columns(2, gap="medium")

    with row3_c1:
        fig5 = go.Figure(go.Bar(
            x=cat_labels, y=issue_vals,
            marker=dict(color="#68707C", opacity=0.85),
            text=[f"{v:.1f}%" for v in issue_vals],
            textposition="outside",
            hovertemplate="<b>%{x}</b><br>Issue Resolution: %{y:.1f}%<extra></extra>",
        ))
        fig5.update_layout(**_base_layout("Issue Resolution Time Score (%)", "%"), height=320, yaxis_range=[0, 110])
        st.plotly_chart(fig5, use_container_width=True)

    with row3_c2:
        fig6 = go.Figure(go.Bar(
            x=cat_labels, y=completion_vals,
            marker=dict(color="#2D6A4A", opacity=0.85),
            text=[f"{v:.1f}%" for v in completion_vals],
            textposition="outside",
            hovertemplate="<b>%{x}</b><br>Order Completion Rate: %{y:.1f}%<extra></extra>",
        ))
        fig6.add_hline(y=90, line_dash="dot", line_color="#B08D57", line_width=1.5,
                       annotation_text="90% target", annotation_position="right")
        fig6.update_layout(**_base_layout("Order Completion Rate (%)", "%"), height=320, yaxis_range=[0, 110])
        st.plotly_chart(fig6, use_container_width=True)

    # ── Row 4: Reliability Score (radar + bar) ────────────────────────────────
    render_section_header(
        "Reliability Score",
        "Composite reliability score (0-100) for each vendor category",
    )
    row4_c1, row4_c2 = st.columns(2, gap="medium")

    with row4_c1:
        # Horizontal bar sorted descending for easy comparison
        sorted_data = sorted(zip(cat_labels, reliability_vals, cat_colors), key=lambda x: x[1])
        s_labels, s_vals, s_colors = zip(*sorted_data) if sorted_data else ([], [], [])
        fig7 = go.Figure(go.Bar(
            x=list(s_vals), y=list(s_labels),
            orientation="h",
            marker=dict(color=list(s_colors), opacity=0.88),
            text=[f"{v:.1f}" for v in s_vals],
            textposition="outside",
            hovertemplate="<b>%{y}</b><br>Reliability Score: %{x:.1f}<extra></extra>",
        ))
        fig7.add_vline(x=70, line_dash="dot", line_color="#2D6A4A", line_width=1.5,
                       annotation_text="Low Risk (70)", annotation_position="top right")
        fig7.add_vline(x=40, line_dash="dot", line_color="#8B3038", line_width=1.5,
                       annotation_text="High Risk (<40)", annotation_position="bottom right")
        fig7.update_layout(
            **{**_base_layout("Reliability Score by Category"), "xaxis_range": [0, 105]},
            height=320,
            yaxis=dict(showgrid=False, tickfont=dict(size=10, color="#526174")),
            xaxis=dict(gridcolor=_GRID_COLOR, tickfont=dict(size=10, color="#526174")),
        )
        st.plotly_chart(fig7, use_container_width=True)

    with row4_c2:
        # Radar chart — all categories on one view
        if len(cat_labels) >= 3:
            radar_vals = reliability_vals + [reliability_vals[0]]
            radar_cats = cat_labels + [cat_labels[0]]
            fig_radar = go.Figure(go.Scatterpolar(
                r=radar_vals, theta=radar_cats,
                fill="toself",
                fillcolor="rgba(176,141,87,0.12)",
                line=dict(color="#B08D57", width=2),
                marker=dict(size=6, color="#B08D57"),
                hovertemplate="<b>%{theta}</b><br>Reliability: %{r:.1f}<extra></extra>",
            ))
            fig_radar.update_layout(
                title=dict(text="Reliability Radar — All Categories", font=_TITLE_FONT, x=0),
                polar=dict(radialaxis=dict(visible=True, range=[0, 100], tickfont=dict(size=9))),
                paper_bgcolor=_CHART_BG,
                margin=dict(l=30, r=30, t=45, b=20),
                height=320,
                showlegend=False,
            )
            st.plotly_chart(fig_radar, use_container_width=True)
        else:
            st.info("Select at least 3 categories to view the radar chart.")

    # ── Row 5: Performance Trends ─────────────────────────────────────────────
    render_section_header(
        "Performance Trends",
        "Monthly on-time vs delayed delivery trend across selected categories",
    )

    # Collect trend lines for all returned categories
    all_months: list = []
    for d in cat_data:
        trend = d.get("monthly_trend", {})
        for m in trend.get("months", []):
            if m not in all_months:
                all_months.append(m)

    if not all_months:
        st.info("No monthly delivery trend data available for the selected filters.")
    else:
        # Overall stacked trend (aggregate)
        col_trend1, col_trend2 = st.columns([1.6, 1], gap="medium")

        with col_trend1:
            fig_trend = go.Figure()
            # Aggregate across all categories
            monthly_agg: dict = {m: {"on_time": 0, "late": 0} for m in all_months}
            for d in cat_data:
                trend = d.get("monthly_trend", {})
                months_t = trend.get("months", [])
                on_t     = trend.get("on_time", [])
                late_t   = trend.get("late", [])
                for m, ot, lt in zip(months_t, on_t, late_t):
                    if m in monthly_agg:
                        monthly_agg[m]["on_time"] += ot
                        monthly_agg[m]["late"]    += lt

            agg_ot   = [monthly_agg[m]["on_time"] for m in all_months]
            agg_late = [monthly_agg[m]["late"]    for m in all_months]

            fig_trend.add_trace(go.Bar(
                name="On-Time", x=all_months, y=agg_ot,
                marker_color="#2D6A4A",
                hovertemplate="<b>%{x}</b><br>On-Time: %{y:,}<extra></extra>",
            ))
            fig_trend.add_trace(go.Bar(
                name="Delayed", x=all_months, y=agg_late,
                marker_color="#8B3038",
                hovertemplate="<b>%{x}</b><br>Delayed: %{y:,}<extra></extra>",
            ))
            fig_trend.update_layout(
                barmode="stack",
                title=dict(text="Monthly Delivery Performance (All Selected Categories)", font=_TITLE_FONT, x=0),
                paper_bgcolor=_CHART_BG, plot_bgcolor=_CHART_BG,
                margin=dict(l=10, r=10, t=45, b=10),
                legend=dict(orientation="h", yanchor="bottom", y=1.02),
                xaxis=dict(showgrid=False),
                yaxis=dict(gridcolor=_GRID_COLOR),
                height=340,
            )
            st.plotly_chart(fig_trend, use_container_width=True)

        with col_trend2:
            # On-time rate line per category (multi-line, last 6 months)
            fig_lines = go.Figure()
            for d in cat_data:
                trend = d.get("monthly_trend", {})
                months_t = trend.get("months", [])[-12:]
                on_t     = trend.get("on_time", [])[-12:]
                late_t   = trend.get("late", [])[-12:]
                ot_rates = [
                    round(ot / max(ot + lt, 1) * 100, 1)
                    for ot, lt in zip(on_t, late_t)
                ]
                if months_t:
                    fig_lines.add_trace(go.Scatter(
                        name=d["category_label"],
                        x=months_t, y=ot_rates,
                        mode="lines+markers",
                        line=dict(color=VENDOR_CATEGORY_COLORS.get(d["category"], "#172033"), width=2),
                        marker=dict(size=5),
                        hovertemplate="<b>" + d["category_label"] + "</b><br>%{x}: %{y:.1f}%<extra></extra>",
                    ))

            fig_lines.update_layout(
                title=dict(text="On-Time Rate Trend by Category (%)", font=_TITLE_FONT, x=0),
                paper_bgcolor=_CHART_BG, plot_bgcolor=_CHART_BG,
                margin=dict(l=10, r=10, t=45, b=10),
                legend=dict(orientation="v", font=dict(size=9)),
                xaxis=dict(showgrid=False),
                yaxis=dict(gridcolor=_GRID_COLOR, range=[0, 105]),
                height=340,
            )
            st.plotly_chart(fig_lines, use_container_width=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # ── Per-Category Performance Summary Table ────────────────────────────────
    render_section_header(
        "Performance by Vendor Category",
        "All 8 required metrics per category across all 6 vendor categories",
    )

    rows_html = []
    for d in cat_data:
        cat_key   = d["category"]
        label     = d["category_label"]
        color     = VENDOR_CATEGORY_COLORS.get(cat_key, "#172033")
        avg_rel   = d["reliability_score"]
        tier      = "Low" if avg_rel >= 70 else "Medium" if avg_rel >= 40 else "High"

        rows_html.append(
            f'<tr style="border-bottom:1px solid #E5E2DC;">'
            f'<td style="padding:0.6rem 0.75rem;">'
            f'<span style="border-left:3px solid {color};padding-left:6px;'
            f'font-weight:700;color:#172033;">{label}</span>'
            f'</td>'
            f'<td style="padding:0.6rem 0.75rem;text-align:center;font-size:0.82rem;">{d["vendor_count"]}</td>'
            f'<td style="padding:0.6rem 0.75rem;text-align:center;color:#2D6A4A;font-weight:700;">'
            f'{d["on_time_deliveries"]:,} ({d["on_time_rate"]:.1f}%)</td>'
            f'<td style="padding:0.6rem 0.75rem;text-align:center;color:#8B3038;font-weight:700;">'
            f'{d["delayed_deliveries"]:,} ({d["delay_rate"]:.1f}%)</td>'
            f'<td style="padding:0.6rem 0.75rem;text-align:center;color:#B08D57;">{d["quality_rating"]:.1f}%</td>'
            f'<td style="padding:0.6rem 0.75rem;text-align:center;color:#2E4B7A;">{d["response_time"]:.1f}%</td>'
            f'<td style="padding:0.6rem 0.75rem;text-align:center;color:#68707C;">{d["issue_resolution_time"]:.1f}%</td>'
            f'<td style="padding:0.6rem 0.75rem;text-align:center;color:#2D6A4A;">{d["order_completion_rate"]:.1f}%</td>'
            f'<td style="padding:0.6rem 0.75rem;min-width:120px;">{_score_bar(avg_rel)}</td>'
            f'<td style="padding:0.6rem 0.75rem;text-align:center;">{_risk_badge_html(tier)}</td>'
            f'</tr>'
        )

    table_html = (
        '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;overflow:auto;'
        'box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
        '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">'
        '<thead><tr style="background:#172033;color:#FFFFFF;text-align:left;">'
        '<th style="padding:0.65rem 0.75rem;">Category</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:center;">Vendors</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:center;">On-Time Deliveries</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:center;">Delayed Deliveries</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:center;">Quality Rating</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:center;">Response Time</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:center;">Issue Resolution</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:center;">Order Completion</th>'
        '<th style="padding:0.65rem 0.75rem;">Reliability Score</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:center;">Risk Tier</th>'
        '</tr></thead>'
        f'<tbody>{"".join(rows_html)}</tbody>'
        '</table></div>'
    )
    st.markdown(table_html, unsafe_allow_html=True)

    st.markdown("<div style='height:1rem;'></div>", unsafe_allow_html=True)

    # ── Risk Distribution + Vendor Ranking ────────────────────────────────────
    rd_col, rk_col = st.columns([1, 1], gap="medium")

    with rd_col:
        risk_dist = get_cached_risk_distribution()
        if any(risk_dist.values()):
            labels  = list(risk_dist.keys())
            values  = list(risk_dist.values())
            colors  = [get_risk_tier_color(t) for t in labels]
            fig_pie = go.Figure(go.Pie(
                labels=labels, values=values, hole=0.58,
                marker=dict(colors=colors),
                textinfo="label+percent",
            ))
            fig_pie.update_layout(
                title=dict(text="Vendor Risk Tier Distribution", font=_TITLE_FONT),
                paper_bgcolor=_CHART_BG,
                margin=dict(l=10, r=10, t=45, b=10),
                height=320,
            )
            st.plotly_chart(fig_pie, use_container_width=True)

    with rk_col:
        render_section_header("Top Vendors by Reliability", "Highest-scoring vendors across all categories")
        if "vm_perf_page" not in st.session_state:
            st.session_state["vm_perf_page"] = 1

        pf1, pf2 = st.columns([1, 3])
        with pf1:
            cat_filter_perf = st.selectbox(
                "Filter by Category",
                ["All"] + VENDOR_CATEGORIES,
                key="vm_perf_cat",
            )

        ranked = get_vendor_performance_ranked(
            page=st.session_state["vm_perf_page"],
            page_size=20,
        )
        items = ranked.get("items", [])
        if cat_filter_perf != "All":
            items = [v for v in items if v.get("category") == cat_filter_perf]

        if not items:
            render_empty_state("No Vendors Found", "Adjust filters.")
        else:
            r_rows = []
            for i, v in enumerate(items[:10]):
                rank_num = (st.session_state["vm_perf_page"] - 1) * 20 + i + 1
                tier  = v["risk_tier"]
                cat_k = v.get("category", "")
                cat_label = VENDOR_CATEGORY_LABELS.get(cat_k, cat_k) or cat_k
                r_rows.append(
                    f'<tr style="border-bottom:1px solid #E5E2DC;">'
                    f'<td style="padding:0.5rem 0.65rem;font-weight:700;color:#172033;text-align:center;">{rank_num}</td>'
                    f'<td style="padding:0.5rem 0.65rem;color:#20242A;">{v["company_name"][:22]}</td>'
                    f'<td style="padding:0.5rem 0.65rem;color:#68707C;font-size:0.78rem;">{cat_label[:16]}</td>'
                    f'<td style="padding:0.5rem 0.65rem;min-width:100px;">{_score_bar(v["reliability_score"])}</td>'
                    f'<td style="padding:0.5rem 0.65rem;">{_risk_badge_html(tier)}</td>'
                    f'</tr>'
                )
            t_html = (
                '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;overflow:auto;max-height:320px;">'
                '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">'
                '<thead><tr style="background:#172033;color:#FFFFFF;text-align:left;position:sticky;top:0;">'
                '<th style="padding:0.55rem 0.65rem;text-align:center;">#</th>'
                '<th style="padding:0.55rem 0.65rem;">Company</th>'
                '<th style="padding:0.55rem 0.65rem;">Category</th>'
                '<th style="padding:0.55rem 0.65rem;">Reliability Score</th>'
                '<th style="padding:0.55rem 0.65rem;text-align:center;">Risk</th>'
                '</tr></thead>'
                f'<tbody>{"".join(r_rows)}</tbody>'
                '</table></div>'
            )
            st.markdown(t_html, unsafe_allow_html=True)



# ── Register Vendor Form ──────────────────────────────────────────────────────

def _render_register_form(role: str, user_id: str) -> None:
    """Vendor registration form (only shown if ACTION_CREATE_VENDOR is permitted)."""
    with st.form("vm_new_vendor_form"):
        c1, c2 = st.columns(2)
        with c1:
            new_name    = st.text_input("Company / Supplier Name *", key="vm_nv_name")
            new_cat     = st.selectbox(
                "Vendor Category *",
                VENDOR_CATEGORIES,
                format_func=lambda k: VENDOR_CATEGORY_LABELS.get(k, k),
                key="vm_nv_cat",
            )
            new_contact = st.text_input("Primary Contact Person *", key="vm_nv_contact")
            new_email   = st.text_input("Contact Email *", key="vm_nv_email")
        with c2:
            new_phone   = st.text_input("Phone Number", key="vm_nv_phone")
            new_tax_id  = st.text_input("Tax ID / VAT Registration", key="vm_nv_tax")
            new_payment = st.selectbox("Payment Terms", ["Net 30", "Net 45", "Net 60", "Net 90", "Immediate"], key="vm_nv_pay")
            new_website = st.text_input("Website URL", placeholder="https://...", key="vm_nv_web")

        st.markdown("#### Facility / Headquarters Address")
        a1, a2, a3 = st.columns(3)
        with a1:
            new_street  = st.text_input("Street Address", key="vm_nv_street")
        with a2:
            new_city    = st.text_input("City", key="vm_nv_city")
        with a3:
            new_country = st.text_input("Country", value="United States", key="vm_nv_country")

        new_desc = st.text_area("Operational Scope / Notes", key="vm_nv_desc", height=70)

        submitted = st.form_submit_button(
            "Register & Submit for Approval", type="primary", use_container_width=True
        )
        if submitted:
            if not new_name.strip() or not new_contact.strip() or not new_email.strip():
                st.error("Please fill in all required fields (*).")
            else:
                ok, msg, _ = create_vendor(
                    company_name=new_name.strip(),
                    category=new_cat,
                    contact_information={
                        "primary_contact_name": new_contact.strip(),
                        "primary_email":        new_email.strip().lower(),
                        "primary_phone":        new_phone.strip(),
                        "website":              new_website.strip(),
                    },
                    address={
                        "street":  new_street.strip(),
                        "city":    new_city.strip(),
                        "country": new_country.strip(),
                    },
                    created_by=user_id,
                    tax_id=new_tax_id.strip(),
                    payment_terms=new_payment,
                    description=new_desc.strip(),
                )
                if ok:
                    st.success(msg)
                    st.rerun()
                else:
                    st.error(msg)
