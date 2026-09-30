"""
views/purchase_orders.py
------------------------
Purchase Orders — Full workflow spec: Pending → Approved → Ordered → Delivered → Completed / Cancelled.
Enforces the mandatory vendor acceptance rule before PO generation.
Deep Navy + Warm Ivory + Muted Gold theme. Zero emoji.

Performance notes (all bottlenecks fixed):
  • vendor_name_map    — cached 5 min (was uncached, 500-doc fetch every rerun)
  • PO stats / value   — cached 60s  (was 7 uncached DB calls every rerun)
  • Open PRs for PO   — cached 30s  (was 3 unbounded queries + N+1 loop every rerun)
  • Active POs        — cached 30s  (was 2 separate uncached queries every rerun)
  • All POs list      — limited to 50 documents, served from cache on filter change
  • Cache is invalidated after writes so next rerun sees fresh data
"""

import streamlit as st
from datetime import datetime, timezone

from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state
from auth.session import get_current_user, get_current_role
from auth.permissions import (
    has_action_permission,
    ACTION_CREATE_PO,
    ACTION_APPROVE_PO,
    ACTION_EDIT_PO,
    ACTION_VIEW_PO,
    ROLE_VENDOR,
)
from services.procurement_service import (
    get_purchase_orders,
    create_purchase_order_validated,
    update_po_status,
)
from services.cache_service import (
    get_cached_vendor_name_map,
    get_cached_po_stats,
    get_cached_total_po_value,
    get_cached_open_prs_for_po,
    get_cached_active_pos,
    invalidate_po_caches,
    invalidate_invoice_caches,
)
from config.settings import PO_STATUS_OPTIONS
from utils.helpers import format_currency


def _status_pill(status: str) -> str:
    COLORS = {
        "Pending":   ("#A67C32", "#FEF8E7"),
        "Approved":  ("#2D6A4A", "#EAF5F0"),
        "Ordered":   ("#2E4B7A", "#EAF1FC"),
        "Delivered": ("#2D6A4A", "#EAF5F0"),
        "Completed": ("#172033", "#E8EBF0"),
        "Cancelled": ("#8B3038", "#FDECEC"),
    }
    fg, bg = COLORS.get(status, ("#68707C", "#F1F3F5"))
    return (
        f'<span style="background:{bg};color:{fg};border:1px solid {fg}33;'
        f'border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:700;">{status}</span>'
    )


def _payment_pill(status: str) -> str:
    COLORS = {
        "Unpaid":               ("#A67C32", "#FEF8E7"),
        "Pending":              ("#A67C32", "#FEF8E7"),
        "Pending Verification": ("#2E4B7A", "#EAF1FC"),
        "Ready to Pay":         ("#2D6A4A", "#EAF5F0"),
        "Paid":                 ("#2D6A4A", "#EAF5F0"),
        "Settled":              ("#2D6A4A", "#EAF5F0"),
        "On Hold":              ("#8B3038", "#FDECEC"),
        "Payment Locked":       ("#8B3038", "#FDECEC"),
    }
    fg, bg = COLORS.get(status, ("#68707C", "#F1F3F5"))
    return (
        f'<span style="background:{bg};color:{fg};border:1px solid {fg}33;'
        f'border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:700;">PAY: {status.upper()}</span>'
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


# PO status transitions
ALLOWED_TRANSITIONS = {
    "Pending":   ["Approved", "Cancelled"],
    "Approved":  ["Ordered", "Cancelled"],
    "Ordered":   ["Delivered", "Cancelled"],
    "Delivered": ["Completed"],
    "Completed": [],
    "Cancelled": [],
}


@st.cache_data(ttl=30, show_spinner=False)
def _cached_get_purchase_orders(status, vendor_id):
    """
    Cache filtered PO list for 30s with database-level limit=50.
    Prevents fetching 65,000 documents over the wire.
    """
    return get_purchase_orders(status=status, vendor_id=vendor_id, limit=50)


def render_purchase_orders_page() -> None:
    """Render the Purchase Orders management page."""

    user = get_current_user() or {}
    role = get_current_role()
    user_id = str(user.get("_id", ""))

    # ── VENDOR ROLE: enforce data isolation ──────────────────────────────────
    # Extract vendor_id from session — NEVER from URL/request parameters.
    session_vendor_id = str(user.get("vendor_id", "")).strip()
    if session_vendor_id in ("", "None", "null"):
        session_vendor_id = None

    if role == ROLE_VENDOR:
        if not session_vendor_id:
            render_page_header("My Purchase Orders", "Purchase orders issued to your organization.")
            st.warning(
                "Your vendor account is not linked to a vendor organization. "
                "Contact your administrator to configure your account."
            )
            return
        render_page_header(
            "My Purchase Orders",
            "Purchase orders issued to your organization. Scoped to your account only.",
        )
    else:
        render_page_header(
            "Purchase Orders",
            "Issue, track, and manage purchase orders. PO creation is gated on supplier acceptance.",
        )

    # ── KPI Cards — data scoped to vendor if ROLE_VENDOR, else cached global stats ──
    if role == ROLE_VENDOR and session_vendor_id:
        from services.vendor_service import get_vendor_own_purchase_orders
        v_pos = get_vendor_own_purchase_orders(session_vendor_id, limit=500)
        stats = {
            "total": len(v_pos),
            "active": sum(1 for p in v_pos if p.get("status") in ("Approved", "Ordered")),
            "pending": sum(1 for p in v_pos if p.get("status") == "Pending"),
        }
        total_val = sum(float(p.get("total_amount") or p.get("grand_total") or p.get("total_cost") or 0.0) for p in v_pos)
    else:
        stats = get_cached_po_stats()
        total_val = get_cached_total_po_value()
    val_display = f"${total_val/1_000_000:.2f}M" if total_val >= 1_000_000 else f"${total_val:,.0f}"

    col1, col2, col3, col4 = st.columns(4)
    for col, label, val_str, accent in [
        (col1, "Total Orders",   f"{stats.get('total', 0):,}",   "#172033"),
        (col2, "Active Orders",  f"{stats.get('active', 0):,}",  "#2D6A4A"),
        (col3, "Pending Orders", f"{stats.get('pending', 0):,}", "#B08D57"),
        (col4, "Total Value",    val_display,                    "#3E4A61"),
    ]:
        with col:
            st.markdown(
                f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {accent};'
                f'border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
                f'<div style="font-size:0.7rem;color:#68707C;font-weight:700;text-transform:uppercase;">{label}</div>'
                f'<div style="font-size:1.65rem;font-weight:800;color:#20242A;margin-top:2px;">{val_str}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

    st.markdown("<div style='margin-bottom:0.8rem;'></div>", unsafe_allow_html=True)

    # ── Tabs ──────────────────────────────────────────────────────────────────
    tab_labels = ["All Purchase Orders"]
    if has_action_permission(role, ACTION_CREATE_PO):
        tab_labels.append("Create PO from Requisition")
    tab_labels.append("Active Orders")

    tabs = st.tabs(tab_labels)
    tab_idx = 0

    # Cached — does not hit the database on widget reruns
    vendor_names = get_cached_vendor_name_map()

    # ── Tab 1: All Purchase Orders ────────────────────────────────────────────
    with tabs[tab_idx]:
        tab_idx += 1
        col_f1, col_f2, col_f3 = st.columns([2, 1, 1])
        with col_f1:
            po_search = st.text_input(
                "Search by PO Number or Item",
                placeholder="e.g. DC-PO-12345 or Shoes...",
                key="po_search",
            )
        with col_f2:
            status_f = st.selectbox("Status Filter", ["All"] + PO_STATUS_OPTIONS, key="po_status_f")
        with col_f3:
            if role == ROLE_VENDOR:
                # Vendor: cannot choose supplier — scoped to their own vendor_id
                st.markdown(
                    '<div style="background:#EAF1FC;border-radius:6px;padding:0.4rem 0.7rem;'  # noqa
                    'font-size:0.8rem;color:#2E4B7A;font-weight:600;margin-top:1.5rem;">'  # noqa
                    'Scoped to your account</div>',  # noqa
                    unsafe_allow_html=True,
                )
            else:
                vendor_opts = {"All Suppliers": None}
                for v_id, v_name in vendor_names.items():
                    vendor_opts[v_name] = v_id
                sel_vendor = st.selectbox("Supplier", list(vendor_opts.keys())[:50], key="po_vendor_f")

        # Inject vendor_id from session for Vendor role (backend-enforced)
        effective_vendor_id = session_vendor_id if role == ROLE_VENDOR else vendor_opts.get(sel_vendor) if role != ROLE_VENDOR else None

        # Cached query — widget changes do not trigger a fresh DB call
        all_pos = _cached_get_purchase_orders(
            status=None if status_f == "All" else status_f,
            vendor_id=effective_vendor_id,
        )

        if po_search:
            s_low = po_search.lower()
            all_pos = [
                p for p in all_pos
                if s_low in str(p.get("po_number", "")).lower()
                or s_low in str(p.get("product_name", "")).lower()
                or s_low in str(p.get("vendor_name", "")).lower()
            ]

        if not all_pos:
            render_empty_state("No Purchase Orders", "No purchase orders match your filter criteria.")
        else:
            render_section_header(f"Purchase Orders ({len(all_pos)} records shown)")
            for idx, po in enumerate(all_pos):
                _render_po_detail_card(po, role, user_id, vendor_names, key_prefix=f"all_{idx}")

    # ── Tab 2: Create PO from Requisition ─────────────────────────────────────
    if has_action_permission(role, ACTION_CREATE_PO):
        with tabs[tab_idx]:
            tab_idx += 1
            render_section_header(
                "Create Purchase Order from Requisition",
                "Purchase Orders can ONLY be issued for approved requisitions where the assigned vendor has accepted.",
            )

            # Single cached query + bulk PO check — no N+1 loop
            open_prs = get_cached_open_prs_for_po()

            if not open_prs:
                render_empty_state(
                    "No Requisitions Pending PO",
                    "There are currently no requisitions awaiting Purchase Order generation.",
                )
            else:
                pr_options = {
                    f"{p.get('request_number', 'PR')} — {p.get('product_name', 'Item')} ({p.get('department', '')})": p
                    for p in open_prs
                }
                selected_label = st.selectbox("Select Requisition", list(pr_options.keys()), key="po_req_sel")
                selected_pr = pr_options.get(selected_label)

                if selected_pr:
                    pr_id = str(selected_pr.get("_id", ""))
                    v_id = selected_pr.get("vendor_id")
                    v_name = selected_pr.get("assigned_vendor_name") or "Unassigned"
                    v_resp = selected_pr.get("vendor_response_status")
                    prod_name = selected_pr.get("product_name") or selected_pr.get("title") or "Item"
                    qty = float(selected_pr.get("quantity") or 1.0)
                    cost = float(selected_pr.get("estimated_cost") or selected_pr.get("estimated_budget") or 0.0)
                    up = float(selected_pr.get("unit_price") or (cost / qty if qty and cost > 0 else 0.0))
                    req_date = selected_pr.get("required_by_date")

                    # Display Requisition Info
                    st.markdown(
                        f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:8px;'
                        f'padding:0.9rem 1.1rem;margin:0.75rem 0;">'
                        f'<div style="font-size:0.95rem;font-weight:700;color:#172033;">{selected_pr.get("request_number")} — {prod_name}</div>'
                        f'<div style="font-size:0.8rem;color:#68707C;margin-top:4px;">'
                        f'Department: <b>{selected_pr.get("department", "General")}</b> &bull; Quantity: <b>{qty}</b> &bull; '
                        f'Est. Unit Price: <b>USD {up:,.2f}</b> &bull; Total Value: <b>USD {cost:,.2f}</b>'
                        f'</div>'
                        f'<div style="font-size:0.8rem;color:#68707C;margin-top:4px;">'
                        f'Assigned Supplier: <b>{v_name}</b> (ID: `{v_id or "None"}`)'
                        f'</div>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )

                    # ── VENDOR ACCEPTANCE RULE CHECK ──────────────────────────
                    if not v_id:
                        st.error("Cannot create Purchase Order: No vendor has been assigned to this requisition yet.")
                    elif v_resp != "Accepted":
                        st.markdown(
                            f'<div style="background:#FDECEC;border:1px solid #8B303844;border-left:4px solid #8B3038;'
                            f'border-radius:6px;padding:0.8rem 1rem;font-size:0.88rem;color:#8B3038;font-weight:600;">'
                            f'Purchase Order cannot be created until the assigned vendor accepts the procurement request.'
                            f'</div>',
                            unsafe_allow_html=True,
                        )
                        st.caption(f"Current vendor response status: **{v_resp or 'Pending'}**")
                    else:
                        # VENDOR HAS ACCEPTED: Show PO Form
                        st.markdown(
                            f'<div style="background:#EAF5F0;border:1px solid #2D6A4A44;border-left:4px solid #2D6A4A;'
                            f'border-radius:6px;padding:0.7rem 1rem;font-size:0.85rem;color:#2D6A4A;font-weight:600;margin-bottom:0.75rem;">'
                            f'Supplier has accepted the requisition. Fill in the confirmed financial details to issue the Purchase Order.'
                            f'</div>',
                            unsafe_allow_html=True,
                        )

                        # Resolve default delivery date safely
                        default_date = datetime.now(timezone.utc).date()
                        if req_date:
                            if hasattr(req_date, "date"):
                                default_date = req_date.date()
                            elif isinstance(req_date, str):
                                try:
                                    default_date = datetime.fromisoformat(req_date.replace("Z", "+00:00")).date()
                                except Exception:
                                    pass

                        # Resolve safe confirmed unit price (must be >= 0.01)
                        safe_up = max(float(up), 0.01) if up > 0 else (cost / qty if qty and cost > 0 else 100.0)
                        safe_up = max(round(safe_up, 2), 0.01)

                        with st.form("create_po_from_pr_form"):
                            st.markdown(
                                '<div style="font-size:0.85rem;font-weight:700;color:#172033;margin-bottom:0.5rem;">'
                                'Product & Delivery</div>',
                                unsafe_allow_html=True,
                            )
                            c1, c2 = st.columns(2)
                            with c1:
                                exp_date = st.date_input(
                                    "Expected Delivery Date *",
                                    value=default_date,
                                    key="po_exp_deliv",
                                )
                                unit_price_input = st.number_input(
                                    "Confirmed Unit Price (USD) *",
                                    value=safe_up,
                                    min_value=0.01,
                                    step=5.0,
                                    key="po_conf_up",
                                )
                            with c2:
                                notes = st.text_input(
                                    "Order Notes / Reference",
                                    value=f"Generated from {selected_pr.get('request_number')}",
                                    key="po_notes_in",
                                )
                                qty_display = st.number_input(
                                    "Quantity",
                                    value=float(qty),
                                    min_value=0.01,
                                    step=1.0,
                                    key="po_qty_display",
                                    disabled=True,
                                )

                            st.markdown(
                                '<hr style="margin:0.6rem 0;border:none;border-top:1px solid #E5E2DC;">'
                                '<div style="font-size:0.85rem;font-weight:700;color:#172033;margin-bottom:0.5rem;">'
                                'Financial Breakdown (Agreed PO Values — used for Finance Verification)</div>',
                                unsafe_allow_html=True,
                            )
                            fc1, fc2, fc3, fc4 = st.columns(4)
                            with fc1:
                                tax_input = st.number_input(
                                    "Tax (USD)",
                                    value=float(selected_pr.get("expected_tax") or 0.0),
                                    min_value=0.0, step=10.0, key="po_tax_in",
                                )
                            with fc2:
                                discount_input = st.number_input(
                                    "Discount (USD)",
                                    value=float(selected_pr.get("expected_discount") or 0.0),
                                    min_value=0.0, step=10.0, key="po_disc_in",
                                )
                            with fc3:
                                shipping_input = st.number_input(
                                    "Shipping / Freight (USD)",
                                    value=float(selected_pr.get("expected_shipping") or 0.0),
                                    min_value=0.0, step=10.0, key="po_ship_in",
                                )
                            with fc4:
                                other_input = st.number_input(
                                    "Other Charges (USD)",
                                    value=float(selected_pr.get("expected_other_charges") or 0.0),
                                    min_value=0.0, step=10.0, key="po_other_in",
                                )

                            # Live grand total preview
                            subtotal_preview = round(qty * unit_price_input, 2)
                            grand_total_preview = round(
                                subtotal_preview + tax_input - discount_input + shipping_input + other_input, 2
                            )
                            st.markdown(
                                f'<div style="background:#F7F5F0;border:1px solid #D9D6CF;border-radius:8px;'
                                f'padding:0.75rem 1rem;margin:0.5rem 0;">'
                                f'<div style="display:flex;gap:2rem;flex-wrap:wrap;font-size:0.85rem;color:#526174;">'
                                f'<span>Subtotal: <b style="color:#172033;">USD {subtotal_preview:,.2f}</b></span>'
                                f'<span>+ Tax: <b>USD {tax_input:,.2f}</b></span>'
                                f'<span>- Discount: <b>USD {discount_input:,.2f}</b></span>'
                                f'<span>+ Shipping: <b>USD {shipping_input:,.2f}</b></span>'
                                f'<span>+ Other: <b>USD {other_input:,.2f}</b></span>'
                                f'</div>'
                                f'<div style="font-size:1.05rem;font-weight:800;color:#2D6A4A;margin-top:4px;">'
                                f'Grand Total: USD {grand_total_preview:,.2f}</div>'
                                f'</div>',
                                unsafe_allow_html=True,
                            )

                            if st.form_submit_button("GENERATE & ISSUE PURCHASE ORDER", type="primary", use_container_width=True):
                                if exp_date and hasattr(exp_date, "year"):
                                    exp_dt = datetime.combine(exp_date, datetime.min.time()).replace(tzinfo=timezone.utc)
                                else:
                                    exp_dt = datetime.now(timezone.utc)
                                ok, msg, po_doc = create_purchase_order_validated(
                                    pr_id=pr_id,
                                    created_by=user_id,
                                    expected_delivery_date=exp_dt,
                                    notes=notes,
                                    unit_price=unit_price_input,
                                    tax_amount=tax_input,
                                    discount_amount=discount_input,
                                    shipping_freight=shipping_input,
                                    other_charges=other_input,
                                )
                                if ok:
                                    st.success(f"Success! {msg}")
                                    # Invalidate caches so the new PO is visible immediately
                                    invalidate_po_caches()
                                    _cached_get_purchase_orders.clear()
                                    st.rerun()
                                else:
                                    st.error(msg)

    # ── Tab 3: Active Orders ──────────────────────────────────────────────────
    with tabs[tab_idx]:
        render_section_header("Active Purchase Orders", "Orders in Approved or Ordered status")
        # Single cached $in query replaces two separate uncached calls
        active_pos = get_cached_active_pos()
        if role == ROLE_VENDOR and session_vendor_id:
            active_pos = [p for p in active_pos if str(p.get("vendor_id")) == session_vendor_id]
        if not active_pos:
            render_empty_state("No Active Orders", "No purchase orders currently in progress.")
        else:
            for idx, po in enumerate(active_pos):
                _render_po_detail_card(po, role, user_id, vendor_names, key_prefix=f"act_{idx}")


def _render_po_detail_card(po: dict, role: str, user_id: str, vendor_names: dict, key_prefix: str = "po") -> None:
    """Renders a single Purchase Order card according to section 7 spec."""
    po_id = str(po.get("_id", ""))
    po_num = po.get("po_number", "DC-PO-N/A")
    v_id = po.get("vendor_id", "N/A")
    v_name = po.get("vendor_name") or vendor_names.get(v_id, "Supplier")
    pr_id = po.get("procurement_request_number") or po.get("request_id") or "Direct Order"
    prod_name = po.get("product_name") or (po.get("items", [{}])[0].get("description") if po.get("items") else "General Supplies")
    qty = po.get("quantity") or (po.get("items", [{}])[0].get("quantity") if po.get("items") else 1)
    up = po.get("unit_price") or (po.get("items", [{}])[0].get("unit_price") if po.get("items") else 0.0)
    total = po.get("total_amount", 0.0)
    status = po.get("status", "Pending")
    acceptance_status = po.get("vendor_acceptance_status", "Accepted")
    order_date = _date_str(po.get("order_date") or po.get("created_at"))
    expected_delivery = _date_str(po.get("expected_delivery_date"))

    with st.expander(f"{po_num}  |  {v_name}  |  {prod_name}  |  {format_currency(total)}"):
        st.markdown(
            f'<div style="display:flex;gap:8px;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap;">'
            f'{_status_pill(status)} '
            f'{_payment_pill(po.get("payment_status", "Pending"))} '
            f'<span style="background:#EAF5F0;color:#2D6A4A;border:1px solid #2D6A4A44;border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:700;">SUPPLIER {acceptance_status.upper()}</span>'
            f'</div>',
            unsafe_allow_html=True,
        )

        c1, c2 = st.columns(2)
        with c1:
            st.markdown(f"**PO Number:** `{po_num}`")
            st.markdown(f"**Procurement Request ID:** `{pr_id}`")
            st.markdown(f"**Vendor ID:** `{str(v_id)[:12]}...`")
            st.markdown(f"**Vendor Name:** {v_name}")
            st.markdown(f"**Product / Item:** {prod_name}")
        with c2:
            st.markdown(f"**Quantity:** {qty}")
            st.markdown(f"**Unit Price:** USD {up:,.2f}")
            st.markdown(f"**Total Amount:** {format_currency(total)}")
            st.markdown(f"**Order Date:** {order_date}")
            st.markdown(f"**Expected Delivery Date:** {expected_delivery}")
            if po.get("payment_status") == "Paid":
                st.markdown(f"**Payment ID:** `{po.get('payment_id')}`")
                if po.get("payment_date"):
                    st.markdown(f"**Payment Date:** {_date_str(po.get('payment_date'))}")
            elif po.get("payment_status") == "On Hold":
                st.markdown(f"**Payment:** <span style='color:#8B3038;font-weight:700;'>ON HOLD</span>", unsafe_allow_html=True)


        # Advance status control
        transitions = ALLOWED_TRANSITIONS.get(status, [])
        if transitions and has_action_permission(role, ACTION_EDIT_PO):
            st.markdown("<hr style='margin:0.5rem 0;border:none;border-top:1px solid #E5E2DC;'>", unsafe_allow_html=True)
            col_sel, col_btn = st.columns([2, 1])
            with col_sel:
                new_status = st.selectbox("Update Order Status", transitions, key=f"adv_stat_{key_prefix}_{po_id}")
            with col_btn:
                st.markdown("<div style='height:1.7rem;'></div>", unsafe_allow_html=True)
                if st.button("UPDATE STATUS", key=f"btn_upd_{key_prefix}_{po_id}", use_container_width=True):
                    ok, msg = update_po_status(po_id, new_status, user_id)
                    if ok:
                        st.success(msg)
                        # Invalidate PO caches so updated status is visible immediately.
                        # Also invalidate Finance caches: delivery status change directly
                        # affects payment eligibility in the Finance payment ledger.
                        invalidate_po_caches()
                        invalidate_invoice_caches()
                        _cached_get_purchase_orders.clear()
                        st.rerun()
                    else:
                        st.error(msg)
