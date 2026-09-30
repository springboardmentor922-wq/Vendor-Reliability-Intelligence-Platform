"""
views/procurement.py
--------------------
Procurement Management — Full end-to-end workflow implementation.

Workflow:
  Procurement Manager raises Procurement Request (Status: PENDING)
        ↓
  Procurement Approval (Status: APPROVED)
        ↓
  Vendor Assignment (Status: APPROVED / VENDOR ASSIGNED, Vendor Response: PENDING)
        ↓
  Vendor responds:
    • ACCEPT REQUEST → Vendor Response: ACCEPTED → Enables [ CREATE PURCHASE ORDER ]
    • REJECT REQUEST → Vendor Response: REJECTED → Shows rejection reason, allow reassigning vendor
        ↓
  Purchase Order Created (enforced backend & frontend: vendor_response_status == 'Accepted')
        ↓
  Invoice auto-generated for Finance Officer

Deep Navy + Warm Ivory + Muted Gold theme. Zero emoji.
"""

import streamlit as st
from datetime import datetime, timezone

from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state
from auth.session import get_current_user, get_current_role
from auth.permissions import (
    has_action_permission,
    ACTION_CREATE_PR,
    ACTION_APPROVE_PR,
    ACTION_ASSIGN_VENDOR_PR,
    ACTION_CREATE_PO,
    ACTION_ACCEPT_VENDOR_REQUEST,
    ACTION_REJECT_VENDOR_REQUEST,
    ROLE_VENDOR,
    ROLE_PROCUREMENT_MANAGER,
    ROLE_ADMINISTRATOR,
    ROLE_FINANCE_OFFICER,
    ROLE_AUDITOR,
)
from services.procurement_service import (
    get_procurement_requests,
    get_procurement_requests_paginated,
    get_procurement_stats,
    create_procurement_request,
    approve_procurement_request,
    reject_procurement_request,
    assign_vendor_to_pr,
    vendor_accept_pr,
    vendor_reject_pr,
    create_purchase_order_validated,
    get_po_by_request_id,
    get_prs_awaiting_vendor_response,
    get_prs_by_vendor,
)
from services.vendor_service import get_vendors_for_select, get_vendor_by_id, get_all_vendors
from config.settings import PROCUREMENT_STATUS_OPTIONS
from utils.helpers import format_currency

# The six canonical vendor categories used in procurement.
# Selecting one here restricts vendor assignment to only vendors
# registered in that category within the Vendor Manager system.
VENDOR_CATEGORIES = [
    "Raw Material Suppliers",
    "Equipment Vendors",
    "IT Vendors",
    "Service Providers",
    "Logistics Partners",
    "Maintenance Vendors",
]


def _status_pill(status: str) -> str:
    COLORS = {
        "Pending": ("#A67C32", "#FEF8E7"),
        "Approved": ("#2D6A4A", "#EAF5F0"),
        "Vendor Assigned": ("#2E4B7A", "#EAF1FC"),
        "Vendor Accepted": ("#2D6A4A", "#EAF5F0"),
        "Vendor Rejected": ("#8B3038", "#FDECEC"),
        "Ordered": ("#2E4B7A", "#EAF1FC"),
        "Delivered": ("#2D6A4A", "#EAF5F0"),
        "Completed": ("#172033", "#E8EBF0"),
        "Cancelled": ("#8B3038", "#FDECEC"),
        "Rejected": ("#8B3038", "#FDECEC"),
    }
    fg, bg = COLORS.get(status, ("#68707C", "#F1F3F5"))
    return (
        f'<span style="background:{bg};color:{fg};border:1px solid {fg}33;'
        f'border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:700;">{status}</span>'
    )


def _vendor_response_pill(resp_status: str) -> str:
    if resp_status == "Accepted":
        return '<span style="background:#EAF5F0;color:#2D6A4A;border:1px solid #2D6A4A44;border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:700;">VENDOR ACCEPTED</span>'
    elif resp_status == "Rejected":
        return '<span style="background:#FDECEC;color:#8B3038;border:1px solid #8B303844;border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:700;">VENDOR REJECTED</span>'
    elif resp_status == "Pending":
        return '<span style="background:#FEF8E7;color:#A67C32;border:1px solid #A67C3244;border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:700;">VENDOR RESPONSE PENDING</span>'
    return '<span style="background:#F1F3F5;color:#68707C;border:1px solid #68707C33;border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:600;">AWAITING ASSIGNMENT</span>'


def _priority_pill(priority: str) -> str:
    COLORS = {
        "Urgent": ("#8B3038", "#FDECEC"),
        "High": ("#B85C38", "#FFF2EC"),
        "Medium": ("#A67C32", "#FEF8E7"),
        "Low": ("#2D6A4A", "#EAF5F0"),
    }
    fg, bg = COLORS.get(priority, ("#68707C", "#F1F3F5"))
    return (
        f'<span style="background:{bg};color:{fg};border:1px solid {fg}33;'
        f'border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:700;">{priority}</span>'
    )


def _date_str(dt) -> str:
    if not dt:
        return "N/A"
    if isinstance(dt, str):
        return dt[:10]
    try:
        return dt.strftime("%b %d, %Y")
    except Exception:
        return "N/A"


def render_procurement_page() -> None:
    """Render the full Procurement Management page."""
    render_page_header(
        "Procurement Workflow",
        "Requisitions, approvals, vendor assignments, supplier acceptances, and purchase order creation.",
    )

    user = get_current_user() or {}
    role = get_current_role()
    user_id = str(user.get("_id", ""))
    user_vendor_id = str(user.get("vendor_id", ""))

    # ── KPI Cards ─────────────────────────────────────────────────────────────
    stats = get_procurement_stats()
    col1, col2, col3, col4 = st.columns(4)
    kpis = [
        (col1, "Total Requests", stats.get("total", 0), "#172033"),
        (col2, "Pending Approval", stats.get("pending", 0), "#B08D57"),
        (col3, "Vendor Assigned", stats.get("vendor_assigned", 0), "#2E4B7A"),
        (col4, "Ready for PO", stats.get("vendor_accepted", 0), "#2D6A4A"),
    ]
    for col, label, val, accent in kpis:
        with col:
            st.markdown(
                f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {accent};'
                f'border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
                f'<div style="font-size:0.7rem;color:#68707C;font-weight:700;text-transform:uppercase;">{label}</div>'
                f'<div style="font-size:1.65rem;font-weight:800;color:#20242A;margin-top:2px;">{val:,}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

    st.markdown("<div style='margin-bottom:0.8rem;'></div>", unsafe_allow_html=True)

    # ── Tab Navigation by Role ────────────────────────────────────────────────
    tab_labels = ["All Requests"]

    # Vendor specific tab
    if role == ROLE_VENDOR:
        tab_labels = ["My Assigned Requests", "Request History"]
    else:
        if has_action_permission(role, ACTION_APPROVE_PR):
            tab_labels.append("Pending Approval")
            tab_labels.append("Vendor Assignment & PO")
        if has_action_permission(role, ACTION_CREATE_PR):
            tab_labels.append("New Procurement Request")
        tab_labels.append("My Requests")

    active_tabs = st.tabs(tab_labels)
    tab_idx = 0

    # ── VENDOR VIEW: Assigned Requests Tab ────────────────────────────────────
    if role == ROLE_VENDOR:
        with active_tabs[0]:
            render_section_header(
                "New Procurement Requests",
                "Procurement requests assigned to your company. Accept or reject each request before a Purchase Order can be issued.",
            )

            # Get PRs awaiting vendor response
            awaiting = get_prs_awaiting_vendor_response(user_vendor_id) if user_vendor_id else []
            # Fallback if vendor_id not linked directly to user, fetch all assigned with Pending response
            if not awaiting and not user_vendor_id:
                # View all assigned for testing/demo
                db_prs = get_procurement_requests(status="Vendor Assigned")
                awaiting = [p for p in db_prs if p.get("vendor_response_status") in (None, "Pending")]

            if not awaiting:
                render_empty_state("No New Requests", "You have no pending procurement requests awaiting acceptance.")
            else:
                for pr in awaiting:
                    _render_vendor_request_card(pr, user_id, user_vendor_id)

        with active_tabs[1]:
            render_section_header("Request History", "All procurement requests routed to your organization")
            history = get_prs_by_vendor(user_vendor_id) if user_vendor_id else get_procurement_requests()
            if not history:
                render_empty_state("No History", "No prior procurement requests found.")
            else:
                for pr in history:
                    _render_pr_summary_card(pr)
        return

    # ── NON-VENDOR VIEWS ──────────────────────────────────────────────────────

    # ── Tab 1: All Requests ───────────────────────────────────────────────────
    with active_tabs[tab_idx]:
        tab_idx += 1
        col_f1, col_f2, col_f3, col_f4 = st.columns([1.5, 1, 1, 1.5])
        with col_f1:
            pr_search = st.text_input("Search", placeholder="Request #, product, or department...", key="pr_s_all")
        with col_f2:
            status_f = st.selectbox("Status", ["All"] + PROCUREMENT_STATUS_OPTIONS, key="pr_stat_f")
        with col_f3:
            priority_f = st.selectbox("Priority", ["All", "Urgent", "High", "Medium", "Low"], key="pr_prio_f")
        with col_f4:
            page_size = st.selectbox("Per page", [20, 50], index=0, key="pr_pg_sz")

        if "pr_page" not in st.session_state:
            st.session_state["pr_page"] = 1

        paginated = get_procurement_requests_paginated(
            page=st.session_state["pr_page"],
            page_size=page_size,
            status=None if status_f == "All" else status_f,
            search=pr_search or None,
        )
        requests = paginated["items"]
        if priority_f != "All":
            requests = [r for r in requests if r.get("priority") == priority_f]

        # Pagination controls
        p_prev, p_info, p_next = st.columns([1, 2, 1])
        with p_prev:
            if st.button("Previous", disabled=(paginated["page"] <= 1), key="pr_pg_prev", use_container_width=True):
                st.session_state["pr_page"] = max(1, paginated["page"] - 1)
                st.rerun()
        with p_info:
            st.markdown(
                f'<div style="text-align:center;padding-top:6px;font-size:0.83rem;color:#68707C;">'
                f'Page <b>{paginated["page"]}</b> of <b>{paginated["total_pages"]}</b> '
                f'({paginated["total"]:,} requests)</div>',
                unsafe_allow_html=True,
            )
        with p_next:
            if st.button("Next", disabled=(not paginated["has_next"]), key="pr_pg_next", use_container_width=True):
                st.session_state["pr_page"] = paginated["page"] + 1
                st.rerun()

        st.markdown("<div style='height:0.4rem;'></div>", unsafe_allow_html=True)

        if not requests:
            render_empty_state("No Procurement Requests", "No requests match your current filters.")
        else:
            for pr in requests:
                _render_pr_full_card(pr, role, user_id)

    # ── Tab 2: Pending Approval ───────────────────────────────────────────────
    if has_action_permission(role, ACTION_APPROVE_PR):
        with active_tabs[tab_idx]:
            tab_idx += 1
            render_section_header(
                "Requests Awaiting Procurement Approval",
                "Review pending requisitions. Approving unlocks vendor assignment.",
            )
            pending_prs = get_procurement_requests(status="Pending")
            if not pending_prs:
                render_empty_state("No Pending Requests", "All procurement requisitions have been approved or processed.")
            else:
                for pr in pending_prs:
                    _render_approval_card(pr, user_id)

    # ── Tab 3: Vendor Assignment & PO ─────────────────────────────────────────
    if has_action_permission(role, ACTION_APPROVE_PR):
        with active_tabs[tab_idx]:
            tab_idx += 1
            render_section_header(
                "Vendor Assignment & PO Generation",
                "Assign approved suppliers to approved requests. Track vendor response and generate Purchase Orders once accepted.",
            )

            # Show approved, vendor assigned, and vendor rejected PRs
            work_prs = (
                get_procurement_requests(status="Approved") +
                get_procurement_requests(status="Vendor Assigned") +
                get_procurement_requests(status="Vendor Rejected")
            )

            if not work_prs:
                render_empty_state("No Active Assignments", "No approved requests currently pending vendor assignment or acceptance.")
            else:
                for pr in work_prs:
                    _render_vendor_assignment_and_po_card(pr, role, user_id)

    # ── Tab 4: New Request (Procurement Manager only) ─────────────────────────
    if has_action_permission(role, ACTION_CREATE_PR):
        with active_tabs[tab_idx]:
            tab_idx += 1
            render_section_header(
                "Raise Procurement Request",
                "Create a professional procurement requisition. Initial status is PENDING.",
            )

            # Auto-generated preview ID
            import time
            preview_id = f"PR-{datetime.now().strftime('%Y%m%d')}-{int(time.time()*1000)%10000:04d}"

            with st.form("new_procurement_request_form", clear_on_submit=True):
                st.markdown(
                    f'<div style="background:#F7F5F0;border:1px solid #D9D6CF;border-radius:6px;'
                    f'padding:0.5rem 0.8rem;margin-bottom:0.8rem;font-size:0.82rem;color:#172033;">'
                    f'Requisition ID: <b>{preview_id}</b> &bull; Initial Status: <b>PENDING</b>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

                c1, c2 = st.columns(2)
                with c1:
                    product_name = st.text_input("Product / Item *", placeholder="e.g. Industrial Conveyor Belts", key="pr_prod")
                    category = st.selectbox(
                        "Vendor Category *",
                        VENDOR_CATEGORIES,
                        help="Select the vendor category. Only vendors in this category will be available for assignment.",
                        key="pr_cat",
                    )
                    department = st.text_input("Requesting Department *", value="Operations", key="pr_dept_in")
                    priority = st.selectbox("Priority *", ["Low", "Medium", "High", "Urgent"], index=1, key="pr_prio_in")
                with c2:
                    quantity = st.number_input("Quantity *", min_value=1.0, value=10.0, step=1.0, key="pr_qty")
                    unit_price = st.number_input("Expected Unit Price (USD) *", min_value=0.01, value=150.0, step=10.0, key="pr_up")
                    estimated_cost = quantity * unit_price
                    st.markdown(
                        f'<div style="padding-top:0.5rem;font-size:0.85rem;color:#172033;">'
                        f'Subtotal: <b style="color:#2D6A4A;">USD {estimated_cost:,.2f}</b>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )
                    required_by = st.date_input("Required Delivery Date *", value=None, key="pr_req_date")

                description = st.text_area(
                    "Description / Purpose *",
                    placeholder="Describe specific business need, usage specifications, and required technical parameters...",
                    height=80,
                    key="pr_desc",
                )

                # ── Expected Budget Breakdown ─────────────────────────────────
                st.markdown(
                    '<hr style="margin:0.6rem 0;border:none;border-top:1px solid #E5E2DC;">'
                    '<div style="font-size:0.85rem;font-weight:700;color:#172033;margin-bottom:0.4rem;">'
                    'Expected Budget Breakdown (preserved for Finance Verification)</div>'
                    '<div style="font-size:0.77rem;color:#68707C;margin-bottom:0.6rem;">'
                    'These approved budget figures will be compared against the final PO and Vendor Invoice during Finance verification.</div>',
                    unsafe_allow_html=True,
                )
                bf1, bf2, bf3, bf4 = st.columns(4)
                with bf1:
                    exp_tax = st.number_input("Expected Tax (USD)", min_value=0.0, value=0.0, step=5.0, key="pr_exp_tax")
                with bf2:
                    exp_discount = st.number_input("Expected Discount (USD)", min_value=0.0, value=0.0, step=5.0, key="pr_exp_disc")
                with bf3:
                    exp_shipping = st.number_input("Expected Shipping (USD)", min_value=0.0, value=0.0, step=5.0, key="pr_exp_ship")
                with bf4:
                    exp_other = st.number_input("Other Approved Charges (USD)", min_value=0.0, value=0.0, step=5.0, key="pr_exp_other")

                exp_grand_total = round(estimated_cost + exp_tax - exp_discount + exp_shipping + exp_other, 2)
                st.markdown(
                    f'<div style="background:#F7F5F0;border:1px solid #D9D6CF;border-radius:8px;'
                    f'padding:0.65rem 1rem;margin:0.4rem 0;">'
                    f'<div style="display:flex;gap:2rem;flex-wrap:wrap;font-size:0.82rem;color:#526174;">'
                    f'<span>Subtotal: <b style="color:#172033;">USD {estimated_cost:,.2f}</b></span>'
                    f'<span>+ Tax: <b>USD {exp_tax:,.2f}</b></span>'
                    f'<span>- Discount: <b>USD {exp_discount:,.2f}</b></span>'
                    f'<span>+ Shipping: <b>USD {exp_shipping:,.2f}</b></span>'
                    f'<span>+ Other: <b>USD {exp_other:,.2f}</b></span>'
                    f'</div>'
                    f'<div style="font-size:1.05rem;font-weight:800;color:#2D6A4A;margin-top:4px;">'
                    f'Expected Grand Total: USD {exp_grand_total:,.2f}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

                submit_btn = st.form_submit_button("SUBMIT PROCUREMENT REQUEST", type="primary", use_container_width=True)
                if submit_btn:
                    if not product_name.strip() or not department.strip() or not description.strip():
                        st.error("Product name, department, and description are required.")
                    else:
                        req_dt = None
                        if required_by:
                            req_dt = datetime.combine(required_by, datetime.min.time()).replace(tzinfo=timezone.utc)

                        items_list = [{
                            "description": product_name.strip(),
                            "quantity": quantity,
                            "unit": "units",
                            "unit_price": unit_price,
                            "total_price": estimated_cost,
                        }]

                        ok, msg, created_doc = create_procurement_request(
                            requested_by=user_id,
                            department=department.strip(),
                            items=items_list,
                            estimated_cost=estimated_cost,
                            priority=priority,
                            justification=description.strip(),
                            required_by_date=req_dt,
                            product_name=product_name.strip(),
                            category=category,
                            quantity=quantity,
                            unit_price=unit_price,
                            expected_unit_price=unit_price,
                            expected_quantity=quantity,
                            expected_subtotal=round(estimated_cost, 2),
                            expected_tax=round(exp_tax, 2),
                            expected_discount=round(exp_discount, 2),
                            expected_shipping=round(exp_shipping, 2),
                            expected_other_charges=round(exp_other, 2),
                            expected_grand_total=round(exp_grand_total, 2),
                        )
                        if ok:
                            st.success(f"{msg} Status: PENDING.")
                            st.rerun()
                        else:
                            st.error(msg)

    # ── Tab 5: My Requests ───────────────────────────────────────────────────
    with active_tabs[tab_idx]:
        render_section_header("My Submitted Requests", "Requisitions initiated by your account")
        my_reqs = get_procurement_requests(requested_by=user_id)
        if not my_reqs:
            render_empty_state("No Requisitions", "You have not submitted any procurement requests yet.")
        else:
            for pr in my_reqs:
                _render_pr_summary_card(pr)


# ── Card Rendering Functions ──────────────────────────────────────────────────

def _render_vendor_request_card(pr: dict, user_id: str, vendor_id: str) -> None:
    """Card shown on Vendor dashboard: [ ACCEPT REQUEST ] and [ REJECT REQUEST ]."""
    pr_id = str(pr.get("_id", ""))
    pr_num = pr.get("request_number", "PR-N/A")
    prod = pr.get("product_name") or (pr.get("items", [{}])[0].get("description") if pr.get("items") else "General Supplies")
    qty = pr.get("quantity") or (pr.get("items", [{}])[0].get("quantity") if pr.get("items") else 1)
    cost = pr.get("estimated_cost", 0.0)
    req_date = _date_str(pr.get("required_by_date"))
    dept = pr.get("department", "Procurement")
    desc = pr.get("justification") or "No description provided."

    with st.expander(f"NEW REQUEST: {pr_num} — {prod} (USD {cost:,.2f})", expanded=True):
        st.markdown(
            '<div style="background:#EAF1FC;border:1px solid #2E4B7A33;border-left:4px solid #2E4B7A;'
            'border-radius:6px;padding:0.6rem 0.8rem;margin-bottom:0.75rem;font-size:0.83rem;color:#172033;">'
            '<b>New Procurement Request Assigned:</b> Review requisition parameters below and submit your acceptance response.'
            '</div>',
            unsafe_allow_html=True,
        )

        c1, c2 = st.columns(2)
        with c1:
            st.markdown(f"**Request ID:** `{pr_num}`")
            st.markdown(f"**Product / Item:** {prod}")
            st.markdown(f"**Quantity:** {qty}")
            st.markdown(f"**Department:** {dept}")
        with c2:
            st.markdown(f"**Required Delivery Date:** {req_date}")
            st.markdown(f"**Estimated Value:** USD {cost:,.2f}")
            st.markdown(f"**Description:** {desc}")

        st.markdown("<hr style='margin:0.6rem 0;border:none;border-top:1px solid #E5E2DC;'>", unsafe_allow_html=True)

        col_accept, col_reject = st.columns(2)
        with col_accept:
            if st.button("ACCEPT REQUEST", key=f"v_accept_{pr_id}", type="primary", use_container_width=True):
                ok, msg = vendor_accept_pr(pr_id, pr.get("vendor_id") or vendor_id, user_id)
                if ok:
                    st.success(msg)
                    st.rerun()
                else:
                    st.error(msg)

        with col_reject:
            with st.popover("REJECT REQUEST", use_container_width=True):
                st.markdown("**Specify Rejection Reason:**")
                reason = st.text_area("Reason for Rejection", placeholder="e.g. Capacity constraints, material unavailability...", key=f"rej_txt_{pr_id}")
                if st.button("Confirm Rejection", key=f"v_reject_btn_{pr_id}", use_container_width=True):
                    if not reason.strip():
                        st.error("Please provide a rejection reason.")
                    else:
                        ok, msg = vendor_reject_pr(pr_id, pr.get("vendor_id") or vendor_id, user_id, reason.strip())
                        if ok:
                            st.warning(msg)
                            st.rerun()
                        else:
                            st.error(msg)


def _render_approval_card(pr: dict, user_id: str) -> None:
    """Card for Procurement Approval step (Status: Pending → Approved)."""
    pr_id = str(pr.get("_id", ""))
    pr_num = pr.get("request_number", "PR-N/A")
    dept = pr.get("department", "Procurement")
    cost = pr.get("estimated_cost", 0.0)
    priority = pr.get("priority", "Medium")
    prod = pr.get("product_name") or "Requisition Items"
    qty = pr.get("quantity") or 1

    with st.expander(f"{pr_num} | {dept} | {prod} | USD {cost:,.2f}", expanded=True):
        c1, c2 = st.columns([3, 1.2])
        with c1:
            st.markdown(f"**Product / Item:** {prod} &bull; **Qty:** {qty}")
            st.markdown(f"**Department:** {dept} &bull; **Estimated Cost:** USD {cost:,.2f}")
            if pr.get("justification"):
                st.markdown(f"**Description / Purpose:** {pr.get('justification')}")
            if pr.get("required_by_date"):
                st.markdown(f"**Required By:** {_date_str(pr.get('required_by_date'))}")

        with c2:
            st.markdown(f"Priority: {_priority_pill(priority)}", unsafe_allow_html=True)
            if st.button("APPROVE REQUISITION", key=f"appr_{pr_id}", type="primary", use_container_width=True):
                ok, msg = approve_procurement_request(pr_id, user_id)
                if ok:
                    st.success("Requisition approved. Ready for vendor assignment.")
                    st.rerun()
                else:
                    st.error(msg)

            with st.popover("Reject Requisition", use_container_width=True):
                rej_reason = st.text_input("Reason", placeholder="Required...", key=f"appr_r_{pr_id}")
                if st.button("Confirm Rejection", key=f"appr_rej_{pr_id}", use_container_width=True):
                    ok, msg = reject_procurement_request(pr_id, user_id, rej_reason)
                    if ok:
                        st.warning(msg)
                        st.rerun()
                    else:
                        st.error(msg)


def _render_vendor_assignment_and_po_card(pr: dict, role: str, user_id: str) -> None:
    """Card for Vendor Assignment and PO creation steps."""
    pr_id = str(pr.get("_id", ""))
    pr_num = pr.get("request_number", "PR-N/A")
    status = pr.get("status", "Approved")
    v_resp = pr.get("vendor_response_status")
    v_id = pr.get("vendor_id")
    v_name = pr.get("assigned_vendor_name") or "Unassigned"
    prod = pr.get("product_name") or "Supplies"
    cost = pr.get("estimated_cost", 0.0)

    title_status = "READY FOR PO" if v_resp == "Accepted" else status
    with st.expander(f"{pr_num}  |  {title_status}  |  Vendor: {v_name}  |  USD {cost:,.2f}", expanded=(v_resp == "Accepted" or status == "Approved")):
        st.markdown(
            f'<div style="display:flex;gap:8px;align-items:center;margin-bottom:0.75rem;">'
            f'{_status_pill(status)} {_vendor_response_pill(v_resp)}'
            f'</div>',
            unsafe_allow_html=True,
        )

        c1, c2 = st.columns(2)
        with c1:
            st.markdown(f"**Request ID:** `{pr_num}`")
            st.markdown(f"**Product / Item:** {prod}")
            st.markdown(f"**Category:** {pr.get('category', 'General')}")
            st.markdown(f"**Estimated Cost:** USD {cost:,.2f}")
        with c2:
            st.markdown(f"**Assigned Vendor:** {v_name}")
            if pr.get("vendor_response_date"):
                st.markdown(f"**Vendor Response Date:** {_date_str(pr.get('vendor_response_date'))}")
            if pr.get("vendor_rejection_reason"):
                st.markdown(
                    f'<div style="background:#FDECEC;border:1px solid #8B303844;border-radius:5px;'
                    f'padding:0.4rem 0.6rem;font-size:0.8rem;color:#8B3038;">'
                    f'<b>Rejection Reason:</b> {pr.get("vendor_rejection_reason")}</div>',
                    unsafe_allow_html=True,
                )

        st.markdown("<hr style='margin:0.6rem 0;border:none;border-top:1px solid #E5E2DC;'>", unsafe_allow_html=True)

        # ── VENDOR ASSIGNMENT SECTION ─────────────────────────────────────────
        # Show assignment if not assigned, or if vendor rejected
        # CATEGORY ISOLATION: only vendors matching the PR category are shown.
        if not v_id or v_resp == "Rejected":
            st.markdown("**Assign Approved Vendor:**")
            if v_resp == "Rejected":
                st.warning("Vendor rejected this procurement request. Please assign another approved vendor.")

            # Get the PR category and filter vendors accordingly
            pr_category = pr.get("category", "")
            approved_vendors = get_vendors_for_select(
                active_only=True,
                category=pr_category if pr_category else None,
            )

            if pr_category:
                st.markdown(
                    f'<div style="background:#EAF1FC;border:1px solid #2E4B7A33;border-left:4px solid #2E4B7A;'
                    f'border-radius:5px;padding:0.4rem 0.75rem;font-size:0.82rem;color:#172033;margin-bottom:0.4rem;">'
                    f'<b>Category Filter Active:</b> Showing only <b>{pr_category}</b> vendors. '
                    f'Cross-category assignment is not permitted.</div>',
                    unsafe_allow_html=True,
                )

            if not approved_vendors:
                st.warning(
                    f"No active approved vendors found for category: **{pr_category or 'All'}**. "
                    "Please add a vendor of the matching category in the Vendor Management section first."
                )
            else:
                v_choices = {
                    f"{v['company_name']} ({v.get('vendor_code', '')}) — {v.get('category', '')}": v
                    for v in approved_vendors
                }
                sel_label = st.selectbox(
                    f"Select Vendor ({len(v_choices)} matching vendor(s))",
                    list(v_choices.keys()),
                    key=f"sel_v_{pr_id}",
                )
                sel_vendor_obj = v_choices.get(sel_label)

                if sel_vendor_obj:
                    # Show vendor details
                    v_detail = get_vendor_by_id(sel_vendor_obj["_id"]) or {}
                    rel_score = float(v_detail.get("reliability_score") or 0)
                    late_rate = float(v_detail.get("late_delivery_rate") or 0) * 100
                    tot_orders = int(v_detail.get("total_orders") or 0)
                    # Cross-category guard (belt-and-suspenders: DB already filtered)
                    v_cat = sel_vendor_obj.get("category", "")
                    category_ok = (not pr_category) or (v_cat.strip().lower() == pr_category.strip().lower())
                    st.caption(
                        f"Vendor ID: {sel_vendor_obj['_id'][:8]}... | Category: {v_cat} | "
                        f"On-Time Reliability: {rel_score:.1f}% | "
                        f"Historical Orders: {tot_orders:,} | Late Rate: {late_rate:.1f}%"
                    )
                    if not category_ok:
                        st.error(
                            f"⛔ Category mismatch: This PR requires a **{pr_category}** vendor, "
                            f"but the selected vendor is in **{v_cat}**. Assignment blocked."
                        )
                    elif st.button("CONFIRM VENDOR ASSIGNMENT", key=f"btn_assign_{pr_id}", type="primary", use_container_width=True):
                        ok, msg = assign_vendor_to_pr(
                            pr_id,
                            vendor_id=sel_vendor_obj["_id"],
                            assigned_by=user_id,
                            vendor_name=sel_vendor_obj["company_name"],
                        )
                        if ok:
                            st.success(msg)
                            st.rerun()
                        else:
                            st.error(msg)

        # ── PURCHASE ORDER CREATION GATE ──────────────────────────────────────
        linked_po = get_po_by_request_id(pr_id)
        if linked_po:
            st.markdown(
                f'<div style="background:#EAF5F0;border:1px solid #2D6A4A44;border-left:4px solid #2D6A4A;'
                f'border-radius:6px;padding:0.6rem 0.8rem;margin-top:0.5rem;font-size:0.83rem;color:#172033;">'
                f'Purchase Order already created: <b>{linked_po.get("po_number")}</b> &bull; Status: <b>{linked_po.get("status")}</b>'
                f'</div>',
                unsafe_allow_html=True,
            )
        elif v_resp == "Accepted":
            st.markdown(
                '<div style="background:#EAF5F0;border:1px solid #2D6A4A44;border-left:4px solid #2D6A4A;'
                'border-radius:6px;padding:0.55rem 0.8rem;margin-bottom:0.6rem;font-size:0.82rem;color:#2D6A4A;">'
                '<b>Vendor Accepted:</b> The assigned vendor has formally accepted this requisition. You may now create the Purchase Order.'
                '</div>',
                unsafe_allow_html=True,
            )
            if has_action_permission(role, ACTION_CREATE_PO):
                if st.button("CREATE PURCHASE ORDER", key=f"btn_create_po_{pr_id}", type="primary", use_container_width=True):
                    ok, msg, po_doc = create_purchase_order_validated(pr_id=pr_id, created_by=user_id)
                    if ok:
                        st.success(f"{msg} PO Number: {po_doc.get('po_number', 'N/A')}. Invoice auto-created for Finance Officer.")
                        st.rerun()
                    else:
                        st.error(msg)
        else:
            # Vendor has NOT accepted
            st.markdown(
                '<div style="background:#F7F5F0;border:1px solid #D9D6CF;border-left:4px solid #A67C32;'
                'border-radius:6px;padding:0.55rem 0.8rem;margin-top:0.4rem;font-size:0.82rem;color:#68707C;">'
                '<b>Purchase Order Rule:</b> Purchase Order cannot be created until the assigned vendor accepts the procurement request.'
                '</div>',
                unsafe_allow_html=True,
            )


def _render_pr_full_card(pr: dict, role: str, user_id: str) -> None:
    """Card for All Requests tab."""
    pr_id = str(pr.get("_id", ""))
    pr_num = pr.get("request_number", "PR-N/A")
    dept = pr.get("department", "Procurement")
    cost = pr.get("estimated_cost", 0.0)
    status = pr.get("status", "Pending")
    priority = pr.get("priority", "Medium")
    v_resp = pr.get("vendor_response_status")
    v_name = pr.get("assigned_vendor_name")
    prod = pr.get("product_name") or "Requisition"

    with st.expander(f"{pr_num}  |  {dept}  |  {prod}  |  USD {cost:,.2f}"):
        st.markdown(
            f'<div style="display:flex;gap:8px;align-items:center;margin-bottom:0.75rem;">'
            f'{_status_pill(status)} {_priority_pill(priority)} '
            f'{_vendor_response_pill(v_resp) if v_resp else ""}'
            f'</div>',
            unsafe_allow_html=True,
        )

        c1, c2 = st.columns(2)
        with c1:
            st.markdown(f"**Request ID:** `{pr_num}`")
            st.markdown(f"**Product / Item:** {prod}")
            st.markdown(f"**Department:** {dept}")
            st.markdown(f"**Estimated Cost:** USD {cost:,.2f}")
        with c2:
            st.markdown(f"**Assigned Vendor:** {v_name or 'Not assigned'}")
            st.markdown(f"**Created On:** {_date_str(pr.get('created_at'))}")
            if pr.get("required_by_date"):
                st.markdown(f"**Required By:** {_date_str(pr.get('required_by_date'))}")

        if pr.get("justification"):
            st.markdown(f"**Description:** {pr.get('justification')}")

        linked_po = get_po_by_request_id(pr_id)
        if linked_po:
            st.markdown(f"**Linked Purchase Order:** `{linked_po.get('po_number')}` ({linked_po.get('status')})")


def _render_pr_summary_card(pr: dict) -> None:
    """Compact summary card."""
    pr_num = pr.get("request_number", "PR-N/A")
    dept = pr.get("department", "Procurement")
    cost = pr.get("estimated_cost", 0.0)
    status = pr.get("status", "Pending")
    priority = pr.get("priority", "Medium")
    prod = pr.get("product_name") or "Items"

    st.markdown(
        f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:8px;'
        f'padding:0.75rem 1rem;margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center;">'
        f'<div>'
        f'<div style="font-weight:700;color:#172033;font-size:0.9rem;">{pr_num} — {prod}</div>'
        f'<div style="font-size:0.75rem;color:#68707C;">{dept} &bull; {_date_str(pr.get("created_at"))}</div>'
        f'</div>'
        f'<div style="display:flex;gap:8px;align-items:center;">'
        f'{_status_pill(status)} {_priority_pill(priority)}'
        f'<span style="font-weight:700;color:#172033;font-size:0.9rem;">USD {cost:,.2f}</span>'
        f'</div>'
        f'</div>',
        unsafe_allow_html=True,
    )
