"""
views/invoices.py
-----------------
VendorPulse — Finance Verification & PO-Wise Payment Settlement Hub.

Tabs (role-gated):
  1. Finance Dashboard       — 7 KPIs, multi-field filters, PO-wise payment overview
  2. PO Payment Settlement   — Individual PO payment workflow, delivery gating, mismatch decision, PAY NOW
  3. All Invoices            — Search, filter, status overview, PDF download
  4. Submit Invoice          — Vendor fills in invoice details & attachments
  5. Pending Verification    — Finance Officer 4-way comparison (PR vs PO vs Inv vs Del)
  6. Verified / History      — Historical settlements & verification reports (PDF/Excel)

Performance:
  - Cursor-limited queries (.limit(50)) — never scans 65k POs or deliveries
  - KPIs: cached via get_cached_finance_dashboard_stats()
  - Zero DataCo CSV reloading
  - Lazy PDF generation with persistent session state downloads
"""

import streamlit as st
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state
from auth.session import get_current_user, get_current_role
from auth.permissions import (
    has_action_permission,
    ACTION_VIEW_INVOICES,
    ACTION_FINANCE_VERIFY,
    ACTION_SUBMIT_INVOICE,
    ACTION_DOWNLOAD_VERIFICATION_REPORT,
    ACTION_SETTLE_PAYMENT,
    ROLE_VENDOR,
    ROLE_FINANCE_OFFICER,
    ROLE_ADMINISTRATOR,
    ROLE_AUDITOR,
)
from services.invoice_service import (
    get_invoices,
    get_invoice_by_id,
    get_invoice_by_po_id,
    submit_vendor_invoice,
    finance_verify_invoice,
    get_finance_verification_report_data,
    get_settlement_preflight,
    get_po_payment_preflight,
    execute_po_payment,
    hold_po_payment,
    get_finance_dashboard_stats,
    generate_invoice_pdf,
    generate_verification_pdf,
    generate_verification_excel,
    MATCH,
    MISMATCH,
    CRITICAL_MISMATCH,
    NA_STATUS,
)
from services.procurement_service import (
    get_purchase_orders,
    get_purchase_order_by_id,
)
from services.cache_service import (
    get_cached_invoice_stats,
    get_cached_finance_dashboard_stats,
    invalidate_invoice_caches,
    get_cached_vendor_name_map,
)
from config.settings import INVOICE_STATUS_OPTIONS, PO_STATUS_OPTIONS
from utils.helpers import format_currency


# ─────────────────────────────────────────────────────────────────────────────
# Status pill / badge helpers
# ─────────────────────────────────────────────────────────────────────────────

def _status_pill(status: str) -> str:
    COLORS = {
        "Pending":             ("#A67C32", "#FEF8E7"),
        "Submitted":           ("#2E4B7A", "#EAF1FC"),
        "Approved":            ("#2D6A4A", "#EAF5F0"),
        "Rejected":            ("#8B3038", "#FDECEC"),
        "Correction Required": ("#B85C38", "#FFF2EC"),
        "Verified":            ("#2D6A4A", "#EAF5F0"),
        "Paid":                ("#172033", "#E8EBF0"),
        "Delivered":           ("#2D6A4A", "#EAF5F0"),
        "Completed":           ("#172033", "#E8EBF0"),
        "Ordered":             ("#2E4B7A", "#EAF1FC"),
        "Cancelled":           ("#8B3038", "#FDECEC"),
    }
    fg, bg = COLORS.get(status, ("#68707C", "#F1F3F5"))
    return (f'<span style="background:{bg};color:{fg};border:1px solid {fg}33;'
            f'border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:700;">{status}</span>')


def _payment_pill(status: str) -> str:
    COLORS = {
        "Unpaid":               ("#A67C32", "#FEF8E7"),
        "Pending":              ("#A67C32", "#FEF8E7"),
        "Pending Verification": ("#2E4B7A", "#EAF1FC"),
        "Approved for Payment": ("#2E4B7A", "#EAF1FC"),
        "Ready to Pay":         ("#2D6A4A", "#EAF5F0"),
        "Settled":              ("#2D6A4A", "#EAF5F0"),
        "Paid":                 ("#2D6A4A", "#EAF5F0"),
        "On Hold":              ("#8B3038", "#FDECEC"),
        "Payment Locked":       ("#8B3038", "#FDECEC"),
        "Mismatch Detected":    ("#A67C32", "#FEF8E7"),
    }
    fg, bg = COLORS.get(status, ("#68707C", "#F1F3F5"))
    return (f'<span style="background:{bg};color:{fg};border:1px solid {fg}33;'
            f'border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:700;">{status}</span>')


def _match_badge(result: str) -> str:
    res = str(result or "").strip()
    if "CRITICAL" in res:
        fg, bg, label = "#8B3038", "#FDECEC", "✕ CRITICAL MISMATCH"
    elif "MISMATCH" in res:
        fg, bg, label = "#A67C32", "#FEF8E7", "⚠ MISMATCH"
    elif "MATCH" in res:
        fg, bg, label = "#2D6A4A", "#EAF5F0", "✓ MATCH"
    else:
        fg, bg, label = "#68707C", "#F1F3F5", res or "N/A"
    return (f'<span style="background:{bg};color:{fg};border:1px solid {fg}44;'
            f'border-radius:5px;padding:3px 10px;font-size:0.74rem;font-weight:800;">{label}</span>')


def _date_str(dt) -> str:
    if not dt:
        return "N/A"
    if isinstance(dt, str):
        return dt[:10]
    try:
        return dt.strftime("%b %d, %Y")
    except Exception:
        return "N/A"


def _f(val, default="0.00") -> str:
    try:
        return f"{float(val):,.2f}"
    except Exception:
        return default


def _safe_float(val, default: float = 0.0) -> float:
    """Safely convert any value to float, returning default on failure."""
    try:
        if val is None:
            return default
        return float(val)
    except (TypeError, ValueError):
        return default


def _render_pdf_download_button(inv_id: str, po_id: Optional[str], inv_num: str, key_prefix: str) -> None:
    """
    Renders a persistent download button stored in session_state so clicking never causes it to disappear.
    """
    state_key = f"pdf_bytes_{inv_id}_{po_id}_{key_prefix}"

    if state_key not in st.session_state:
        if st.button("Download Invoice PDF", key=f"gen_{state_key}", use_container_width=True):
            with st.spinner("Generating PDF from database..."):
                pdf_bytes = generate_invoice_pdf(invoice_id=inv_id or "", po_id=po_id)
            if pdf_bytes:
                st.session_state[state_key] = pdf_bytes
                st.rerun()
            else:
                st.error("Could not generate PDF.")
    else:
        st.download_button(
            label=f"⬇ Save Invoice PDF ({inv_num or po_id})",
            data=st.session_state[state_key],
            file_name=f"Invoice_{inv_num or po_id}.pdf",
            mime="application/pdf",
            key=f"dl_{state_key}",
            use_container_width=True,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Main Page Entry
# ─────────────────────────────────────────────────────────────────────────────

def render_invoices_page() -> None:
    render_page_header(
        "Finance Verification & Payment Hub",
        "Individual PO Payment Settlement · 4-Way Reconciliation · Delivery Gating · Audit & PDF",
    )

    user = get_current_user() or {}
    role = get_current_role()
    user_id   = str(user.get("_id", ""))
    user_name = user.get("full_name") or user.get("username") or user_id
    user_vendor_id = str(user.get("vendor_id", ""))

    if not has_action_permission(role, ACTION_VIEW_INVOICES):
        st.error("You do not have permission to access the Finance module.")
        return

    # ── 7 KPI Cards (Requirement 6) ──────────────────────────────────────────
    dash_stats = get_cached_finance_dashboard_stats()

    c1, c2, c3, c4, c5, c6, c7 = st.columns(7)
    kpis = [
        (c1, "Pending Verif.", dash_stats.get("pending_verification", 0), "#2E4B7A", False),
        (c2, "Mismatch Det.", dash_stats.get("mismatch_detected", 0),    "#A67C32", False),
        (c3, "On Hold",        dash_stats.get("payment_on_hold", 0),      "#8B3038", False),
        (c4, "Ready to Pay",   dash_stats.get("ready_to_pay", 0),         "#2D6A4A", False),
        (c5, "Paid Orders",    dash_stats.get("paid", 0),                 "#172033", False),
        (c6, "Total Payable",  dash_stats.get("total_payable", 0.0),      "#B08D57", True),
        (c7, "Total Paid",     dash_stats.get("total_paid", 0.0),         "#2D6A4A", True),
    ]
    for col, label, val, accent, is_curr in kpis:
        with col:
            val_str = f"USD {val:,.0f}" if is_curr else f"{int(val):,}"
            st.markdown(
                f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {accent};'
                f'border-radius:8px;padding:0.65rem 0.75rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
                f'<div style="font-size:0.63rem;color:#68707C;font-weight:700;text-transform:uppercase;">{label}</div>'
                f'<div style="font-size:1.25rem;font-weight:800;color:#20242A;margin-top:2px;">{val_str}</div>'
                f'</div>', unsafe_allow_html=True)

    st.markdown("<div style='margin-bottom:0.8rem;'></div>", unsafe_allow_html=True)

    # ── Tabs ──────────────────────────────────────────────────────────────────
    tab_labels = ["Finance Dashboard", "PO Payment Settlement", "All Invoices"]

    if has_action_permission(role, ACTION_SUBMIT_INVOICE):
        tab_labels.append("Submit Invoice")

    if has_action_permission(role, ACTION_FINANCE_VERIFY):
        tab_labels.append("Pending Verification")

    if has_action_permission(role, ACTION_FINANCE_VERIFY) or has_action_permission(role, ACTION_DOWNLOAD_VERIFICATION_REPORT):
        tab_labels.append("Verified / History")

    tabs = st.tabs(tab_labels)
    tab_idx = 0

    # Tab 1: Finance Dashboard (Requirements 5 & 6)
    with tabs[tab_idx]:
        tab_idx += 1
        _render_finance_dashboard_tab(role, user_id)

    # Tab 2: PO Payment Settlement (Requirements 1, 2, 3, 4, 5)
    with tabs[tab_idx]:
        tab_idx += 1
        _render_po_payment_settlement_tab(role, user_id, user_name)

    # Tab 3: All Invoices (Requirement 7)
    with tabs[tab_idx]:
        tab_idx += 1
        _render_all_invoices_tab(role, user_id, user_vendor_id)

    # Tab 4: Submit Invoice (Vendor)
    if has_action_permission(role, ACTION_SUBMIT_INVOICE):
        with tabs[tab_idx]:
            tab_idx += 1
            _render_submit_invoice_tab(role, user_id, user_vendor_id)

    # Tab 5: Pending Verification (Finance Officer)
    if has_action_permission(role, ACTION_FINANCE_VERIFY):
        with tabs[tab_idx]:
            tab_idx += 1
            _render_pending_verification_tab(role, user_id, user_name)

    # Tab 6: Verified / History
    if has_action_permission(role, ACTION_FINANCE_VERIFY) or has_action_permission(role, ACTION_DOWNLOAD_VERIFICATION_REPORT):
        with tabs[tab_idx]:
            tab_idx += 1
            _render_history_tab(role, user_id)


# ─────────────────────────────────────────────────────────────────────────────
# Tab 1: Finance Dashboard (Filters & PO-Wise Table)
# ─────────────────────────────────────────────────────────────────────────────

def _render_finance_dashboard_tab(role: str, user_id: str) -> None:
    render_section_header("Finance Payment Dashboard", "Track and filter individual PO financial workflows.")

    vendor_names = get_cached_vendor_name_map()

    # ── Filters (Vendor | PO | Invoice | Payment Status | Delivery Status | Date) ──
    fc1, fc2, fc3 = st.columns(3)
    with fc1:
        vendor_opts = {"All Vendors": None}
        for vid, vname in vendor_names.items():
            vendor_opts[vname] = vid
        sel_vendor = st.selectbox("Vendor Filter", list(vendor_opts.keys())[:50], key="dash_vf")
    with fc2:
        po_filter = st.text_input("PO # Search", placeholder="e.g. DC-PO-...", key="dash_pof")
    with fc3:
        inv_filter = st.text_input("Invoice # Search", placeholder="e.g. INV-...", key="dash_invf")

    fc4, fc5, fc6 = st.columns(3)
    with fc4:
        pay_status_f = st.selectbox(
            "Payment Status",
            ["All", "Ready to Pay", "Mismatch Detected", "On Hold", "Payment Locked", "Paid", "Pending"],
            key="dash_psf"
        )
    with fc5:
        del_status_f = st.selectbox(
            "Delivery Status",
            ["All", "Delivered", "Completed", "Pending", "Ordered", "Not Dispatched"],
            key="dash_dsf"
        )
    with fc6:
        limit_f = st.selectbox("Records per view", [20, 50, 100], key="dash_lim")

    # Fetch POs with limit
    v_id_arg = vendor_opts.get(sel_vendor)
    pos = get_purchase_orders(
        vendor_id=v_id_arg,
        limit=limit_f,
    )

    if po_filter:
        pos = [p for p in pos if po_filter.strip().lower() in str(p.get("po_number", "")).lower()]

    if not pos:
        render_empty_state("No Purchase Orders Found", "No orders match the current filter criteria.")
        return

    # Render summary table of individual POs
    st.markdown("<div style='margin-top:0.6rem;'></div>", unsafe_allow_html=True)
    render_section_header(f"Purchase Order Payment Ledger ({len(pos)} orders listed)")

    for idx, po in enumerate(pos):
        po_id = str(po.get("_id", ""))
        preflight = get_po_payment_preflight(po_id)
        if preflight.get("error"):
            continue

        inv = preflight.get("invoice", {})
        po_num = po.get("po_number", "N/A")
        inv_num = inv.get("invoice_number", "None")
        vname = po.get("vendor_name") or vendor_names.get(po.get("vendor_id"), "Supplier")
        del_stat = preflight.get("delivery_status", "N/A")
        curr_pay_stat = preflight.get("payment_status", "Pending")
        payable = preflight.get("payable_amount", 0.0)
        overall_match = preflight.get("overall_match", MATCH)

        # Apply in-memory filters for statuses
        if pay_status_f != "All" and curr_pay_stat != pay_status_f:
            continue
        if del_status_f != "All" and del_stat != del_status_f:
            continue
        if inv_filter and inv_filter.strip().lower() not in str(inv_num).lower():
            continue

        with st.expander(f"{po_num}  |  {vname}  |  Delivery: {del_stat}  |  Payment: {curr_pay_stat}  |  USD {payable:,.2f}"):
            c_a, c_b, c_c = st.columns(3)
            with c_a:
                st.markdown(f"**PO ID:** `{po_id}`")
                st.markdown(f"**PO Number:** `{po_num}`")
                st.markdown(f"**Vendor:** {vname}")
                st.markdown(f"**Delivery Status:** {_status_pill(del_stat)}", unsafe_allow_html=True)
            with c_b:
                st.markdown(f"**Invoice Number:** `{inv_num}`")
                st.markdown(f"**Payable Amount:** USD {payable:,.2f}")
                st.markdown(f"**Reconciliation:** {_match_badge(overall_match)}", unsafe_allow_html=True)
                st.markdown(f"**Payment Status:** {_payment_pill(curr_pay_stat)}", unsafe_allow_html=True)
            with c_c:
                if preflight.get("is_paid"):
                    st.markdown(f"**Payment Reference:** `{po.get('payment_id') or inv.get('payment_id')}`")
                    st.markdown(f"**Settled On:** {_date_str(po.get('payment_date') or inv.get('payment_date'))}")
                    st.markdown(f"**Settled By:** {po.get('paid_by') or inv.get('payment_settled_by_name') or 'Finance'}")
                else:
                    if preflight.get("blockers"):
                        st.caption(f"Status note: {preflight['blockers'][0]}")

            # Quick action button to load this PO in settlement tab
            st.markdown("<hr style='margin:0.4rem 0;border:none;border-top:1px solid #E5E2DC;'>", unsafe_allow_html=True)
            if st.button("Open Detailed Settlement Card", key=f"open_po_{po_id}_{idx}", use_container_width=True):
                st.session_state["active_settle_po_id"] = po_id
                st.session_state["active_settle_po_num"] = po_num
                st.rerun()


# ─────────────────────────────────────────────────────────────────────────────
# Tab 2: PO Payment Settlement (Requirements 1, 2, 3, 4, 5)
# ─────────────────────────────────────────────────────────────────────────────

def _render_po_payment_settlement_tab(role: str, user_id: str, user_name: str) -> None:
    render_section_header(
        "Individual Purchase Order Payment Settlement",
        "Payment is tracked and executed independently for every PO. "
        "Requisition → PO reconciliation is shown before any payment action."
    )

    # Fetch recent POs
    recent_pos = get_purchase_orders(limit=50)
    if not recent_pos:
        render_empty_state("No Purchase Orders", "No purchase orders available for settlement.")
        return

    po_options = {}
    default_index = 0
    active_id = st.session_state.get("active_settle_po_id")

    for idx, p in enumerate(recent_pos):
        pid   = str(p.get("_id", ""))
        pnum  = p.get("po_number", "PO")
        vname = p.get("vendor_name", "Vendor")
        amt   = float(p.get("grand_total") or p.get("total_amount") or 0)
        pstat = p.get("payment_status", "Pending")
        label = f"{pnum} — {vname} — USD {amt:,.2f} — [{pstat}]"
        po_options[label] = pid
        if active_id and pid == active_id:
            default_index = idx

    selected_label = st.selectbox(
        f"Select Purchase Order to Settle ({len(po_options)} orders)",
        list(po_options.keys()),
        index=default_index,
        key="po_settle_selector"
    )
    selected_po_id = po_options.get(selected_label)
    if not selected_po_id:
        return

    # ── Load PO Preflight ─────────────────────────────────────────────────────
    with st.spinner("Loading PO data..."):
        preflight = get_po_payment_preflight(selected_po_id)

    if preflight.get("error"):
        st.error(preflight["error"])
        return

    po          = preflight["po"]
    inv         = preflight["invoice"]
    pr          = preflight["pr"]
    comp        = preflight["comparison"]
    del_stat    = preflight["delivery_status"]
    is_deliv    = preflight["is_delivered"]
    is_paid     = preflight["is_paid"]
    is_hold     = preflight["is_on_hold"]
    can_pay     = preflight["can_pay"]
    has_mismatch= preflight["has_mismatch"]
    overall_match = preflight["overall_match"]
    payable_amt = preflight["payable_amount"]

    po_num  = po.get("po_number", "N/A")
    vendor  = po.get("vendor_name", "Supplier")
    pr_num  = pr.get("request_number") or po.get("procurement_request_number", "N/A")
    inv_num = inv.get("invoice_number", "Not Submitted") if inv else "Not Submitted"
    inv_id  = str(inv.get("_id", "")) if inv else None

    # ── PO Header Card ────────────────────────────────────────────────────────
    st.markdown(
        f'<div style="background:#172033;border-radius:10px;padding:1rem 1.25rem;margin-bottom:0.9rem;">'
        f'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">'
        f'<div>'
        f'<div style="font-size:1.15rem;font-weight:800;color:#FFFFFF;">PO Payment Card: {po_num}</div>'
        f'<div style="font-size:0.83rem;color:#A6B4C9;margin-top:2px;">'
        f'Vendor: <b>{vendor}</b> · PR: <b>{pr_num}</b> · Invoice: <b>{inv_num}</b>'
        f'</div></div>'
        f'<div style="display:flex;gap:6px;align-items:center;">'
        f'{_status_pill(del_stat)} {_payment_pill(preflight["payment_status"])}'
        f'</div></div></div>',
        unsafe_allow_html=True
    )

    # Core PO details
    sc1, sc2, sc3 = st.columns(3)
    with sc1:
        st.markdown(f"**PO ID:** `{selected_po_id}`")
        st.markdown(f"**Vendor Name:** {vendor}")
        st.markdown(f"**Procurement Request:** `{pr_num}`")
        st.markdown(f"**Invoice:** `{inv_num}`")
        st.markdown(f"**Delivery Status:** {_status_pill(del_stat)}", unsafe_allow_html=True)
    with sc2:
        prod_name  = po.get("product_name") or "Supplies"
        qty        = _safe_float(po.get("quantity") or 1)
        up         = _safe_float(po.get("unit_price") or 0)
        line_total = round(qty * up, 2)
        st.markdown(f"**Product / Item:** {prod_name}")
        st.markdown(f"**Quantity:** {qty}")
        st.markdown(f"**Unit Price:** USD {up:,.2f}")
        st.markdown(f"**Line Total:** USD {line_total:,.2f}")
    with sc3:
        inv_safe = inv if inv else {}
        tax   = _safe_float(po.get("tax_amount")        or inv_safe.get("tax_amount"))
        disc  = _safe_float(po.get("discount_amount")   or inv_safe.get("discount_amount"))
        ship  = _safe_float(po.get("shipping_freight")  or inv_safe.get("shipping_freight"))
        other = _safe_float(po.get("other_charges")     or inv_safe.get("other_charges"))
        st.markdown(f"**Tax:** USD {tax:,.2f}")
        st.markdown(f"**Discount:** - USD {disc:,.2f}")
        st.markdown(f"**Shipping / Freight:** USD {ship:,.2f}")
        st.markdown(f"**Other Charges:** USD {other:,.2f}")

    # Payable Amount Banner
    st.markdown(
        f'<div style="background:#EAF5F0;border:1px solid #2D6A4A44;border-left:5px solid #2D6A4A;'
        f'border-radius:8px;padding:0.9rem 1.2rem;margin:0.8rem 0;">'
        f'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">'
        f'<div><div style="font-size:0.8rem;color:#526174;font-weight:700;text-transform:uppercase;">Final Payable Amount (PO-Wise)</div>'
        f'<div style="font-size:1.8rem;font-weight:800;color:#2D6A4A;margin-top:2px;">USD {payable_amt:,.2f}</div></div>'
        f'<div>{_match_badge(overall_match)}</div>'
        f'</div></div>',
        unsafe_allow_html=True
    )

    # Delivery locked notice
    if not is_deliv:
        st.markdown(
            f'<div style="background:#FDECEC;border:1px solid #8B303844;border-left:5px solid #8B3038;'
            f'border-radius:8px;padding:0.85rem 1.1rem;margin-bottom:1rem;">'
            f'<div style="font-size:0.95rem;font-weight:800;color:#8B3038;">&#9940; PAYMENT LOCKED — DELIVERY PENDING</div>'
            f'<div style="font-size:0.83rem;color:#20242A;margin-top:3px;">'
            f'Payment can only be settled after delivery for <b>{po_num}</b> is completed. '
            f'Current status: <b>{del_stat}</b>.'
            f'</div></div>',
            unsafe_allow_html=True
        )

    # ── Requisition → PO Reconciliation ──────────────────────────────────────
    render_section_header(
        "Requisition → PO",
        "Comparison of the original approved requisition values against the agreed Purchase Order."
    )
    _render_comparison_grid(comp, comparison_type="pr_to_po")

    st.markdown("<div style='margin-top:1.2rem;'></div>", unsafe_allow_html=True)

    # ── ALREADY PAID ──────────────────────────────────────────────────────────
    if is_paid:
        pay_ref  = po.get("payment_id") or (inv.get("payment_id") if inv else None) or "PAY-REF-N/A"
        pdate    = _date_str(po.get("payment_date") or (inv.get("payment_date") if inv else None))
        pofficer = po.get("paid_by") or (inv.get("payment_settled_by_name") if inv else None) or "Finance Officer"
        st.markdown(
            f'<div style="background:#EAF5F0;border:1px solid #2D6A4A44;border-left:5px solid #2D6A4A;'
            f'border-radius:8px;padding:1rem 1.2rem;margin:0.5rem 0;">'
            f'<div style="font-size:1.05rem;font-weight:800;color:#2D6A4A;">&#10003; PAYMENT SETTLED</div>'
            f'<div style="font-size:0.88rem;color:#20242A;margin-top:4px;">'
            f'Payment ID: <b>{pay_ref}</b> &bull; Settled Amount: <b>USD {payable_amt:,.2f}</b><br>'
            f'Finance Officer: <b>{pofficer}</b> &bull; Date: <b>{pdate}</b>'
            f'</div></div>',
            unsafe_allow_html=True
        )
        _render_pdf_download_button(inv_id or "", selected_po_id, inv_num, "paid_screen")
        return

    # ── DELIVERY LOCKED — no payment controls ─────────────────────────────────
    if not is_deliv:
        st.markdown(
            f'<div style="background:#F7F5F0;border:1px solid #D9D6CF;border-left:4px solid #8B3038;'
            f'border-radius:6px;padding:0.75rem 1rem;font-size:0.88rem;color:#8B3038;font-weight:600;">'
            f'&#9940; Payment Action Locked: Delivery must be marked Delivered before issuing payment.'
            f'</div>',
            unsafe_allow_html=True
        )
        return

    # ── Payment Decision ──────────────────────────────────────────────────────
    st.markdown(
        '<div style="background:#172033;border-radius:8px;padding:0.7rem 1.1rem;margin:1rem 0 0.6rem;">'
        '<div style="font-size:1rem;font-weight:800;color:#FFFFFF;">Payment Decision</div>'
        '<div style="font-size:0.8rem;color:#A6B4C9;margin-top:2px;">'
        'Delivery is confirmed. Select an action below to settle or hold this payment.'
        '</div></div>',
        unsafe_allow_html=True
    )

    pay_col, hold_col = st.columns(2)

    # ── PAY NOW ───────────────────────────────────────────────────────────────
    with pay_col:
        st.markdown(
            '<div style="background:#FFFFFF;border:1px solid #2D6A4A44;border-top:3px solid #2D6A4A;'
            'border-radius:8px;padding:0.9rem 1rem;height:100%;">'
            '<div style="font-size:0.88rem;font-weight:700;color:#2D6A4A;margin-bottom:4px;">PAY NOW</div>'
            '<div style="font-size:0.78rem;color:#526174;">Execute real payment transaction against the database.</div>'
            '</div>',
            unsafe_allow_html=True
        )
        with st.expander("Open Payment Confirmation", expanded=False):
            st.markdown(
                f'<div style="font-size:0.9rem;font-weight:700;color:#172033;margin-bottom:6px;">'
                f'Confirm payment for this PO?<br>'
                f'<span style="color:#2D6A4A;">USD {payable_amt:,.2f}</span> to <b>{vendor}</b>'
                f'</div>',
                unsafe_allow_html=True
            )
            pay_remarks = st.text_input(
                "Remarks / Reference (optional)",
                placeholder="e.g. Wire ref, Cheque #...",
                key=f"pay_rem_{selected_po_id}"
            )
            btn_yes, btn_no = st.columns(2)
            with btn_yes:
                if st.button("YES — PAY", key=f"btn_pay_yes_{selected_po_id}",
                             type="primary", use_container_width=True):
                    ok, msg, pay_id = execute_po_payment(
                        po_id=selected_po_id,
                        invoice_id=inv_id,
                        finance_officer_id=user_id,
                        finance_officer_name=user_name,
                        payment_amount=payable_amt,
                        remarks=pay_remarks or None,
                        is_mismatch_approved=has_mismatch,
                    )
                    if ok:
                        st.success(f"Payment executed! Reference: {pay_id}")
                        invalidate_invoice_caches()
                        st.rerun()
                    else:
                        st.error(msg)
            with btn_no:
                if st.button("NO — CANCEL", key=f"btn_pay_no_{selected_po_id}",
                             use_container_width=True):
                    st.info("Payment cancelled.")

    # ── HOLD PAYMENT ──────────────────────────────────────────────────────────
    with hold_col:
        st.markdown(
            '<div style="background:#FFFFFF;border:1px solid #A67C3244;border-top:3px solid #A67C32;'
            'border-radius:8px;padding:0.9rem 1rem;height:100%;">'
            '<div style="font-size:0.88rem;font-weight:700;color:#A67C32;margin-bottom:4px;">HOLD PAYMENT</div>'
            '<div style="font-size:0.78rem;color:#526174;">Place payment on hold. Status set to ON HOLD. Audit logged.</div>'
            '</div>',
            unsafe_allow_html=True
        )
        with st.expander("Open Hold Confirmation", expanded=False):
            hold_reason = st.text_area(
                "Reason for holding payment (required)",
                placeholder="Specify discrepancy, pending credit note, or corrective action...",
                key=f"hold_rem_{selected_po_id}"
            )
            if st.button("CONFIRM HOLD", key=f"btn_hold_{selected_po_id}",
                         type="secondary", use_container_width=True):
                if not hold_reason.strip():
                    st.error("A reason is required to place payment on hold.")
                else:
                    ok, msg = hold_po_payment(
                        po_id=selected_po_id,
                        invoice_id=inv_id,
                        reason=hold_reason.strip(),
                        finance_officer_id=user_id,
                        finance_officer_name=user_name,
                    )
                    if ok:
                        st.warning(msg)
                        invalidate_invoice_caches()
                        st.rerun()
                    else:
                        st.error(msg)




# ─────────────────────────────────────────────────────────────────────────────
# Tab 3: All Invoices (Requirement 7)
# ─────────────────────────────────────────────────────────────────────────────

def _render_all_invoices_tab(role: str, user_id: str, user_vendor_id: str) -> None:
    col_s1, col_s2, col_s3 = st.columns([2, 1, 1])
    with col_s1:
        search_q = st.text_input("Search Invoices", placeholder="Invoice #, PO #, Vendor...", key="inv_search")
    with col_s2:
        status_f = st.selectbox("Status", ["All"] + INVOICE_STATUS_OPTIONS + ["Paid"], key="inv_stat_f")
    with col_s3:
        limit_v = st.selectbox("Display Limit", [25, 50, 100], key="inv_lim")

    # Vendor isolation: empty string must become None so MongoDB does not filter by ""
    vendor_filter = (user_vendor_id if user_vendor_id else None) if role == ROLE_VENDOR else None
    invoices = get_invoices(
        status=None if status_f == "All" else status_f,
        vendor_id=vendor_filter,
        limit=limit_v,
    )

    if search_q:
        sq = search_q.strip().lower()
        invoices = [i for i in invoices
                    if sq in str(i.get("invoice_number", "")).lower()
                    or sq in str(i.get("po_number", "")).lower()
                    or sq in str(i.get("vendor_name", "")).lower()]

    if not invoices:
        render_empty_state("No Invoices Found", "No invoices match the selected criteria.")
        return

    render_section_header(f"Invoices ({len(invoices)} records)")
    for inv in invoices:
        _render_invoice_card(inv, role, user_id)


def _render_invoice_card(inv: dict, role: str, user_id: str) -> None:
    """Invoice card with reliable PDF download."""
    inv_id   = str(inv.get("_id", ""))
    inv_num  = inv.get("invoice_number", "N/A")
    po_num   = inv.get("po_number", "N/A")
    po_id    = inv.get("po_id")
    vendor   = inv.get("vendor_name", "N/A")
    amount   = float(inv.get("grand_total") or inv.get("invoice_amount", 0))
    status   = inv.get("invoice_status", "Pending")
    payment  = inv.get("payment_status", "Unpaid")
    match_r  = inv.get("match_result")
    inv_date = _date_str(inv.get("submitted_at") or inv.get("invoice_date") or inv.get("created_at"))

    with st.expander(f"{inv_num}  |  PO: {po_num}  |  {vendor}  |  USD {amount:,.2f}", expanded=False):
        st.markdown(
            f'<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem;">'
            f'{_status_pill(status)} {_payment_pill(payment)} '
            + (_match_badge(match_r) if match_r else '') +
            f'</div>', unsafe_allow_html=True)

        c1, c2, c3 = st.columns(3)
        with c1:
            st.markdown(f"**Invoice:** `{inv_num}`")
            st.markdown(f"**PO:** `{po_num}`")
            st.markdown(f"**Vendor:** {vendor}")
        with c2:
            st.markdown(f"**Grand Total:** USD {amount:,.2f}")
            diff = amount - float(inv.get("po_amount") or 0)
            dc = "#2D6A4A" if abs(diff) < 0.01 else "#8B3038"
            st.markdown(f"**Variance:** <span style='color:{dc};font-weight:700;'>USD {diff:+,.2f}</span>",
                        unsafe_allow_html=True)
        with c3:
            st.markdown(f"**Date:** {inv_date}")
            if inv.get("verification_id"):
                st.markdown(f"**Verification ID:** `{inv.get('verification_id')}`")
            if inv.get("payment_id"):
                st.markdown(f"**Payment ID:** `{inv.get('payment_id')}`")

        st.markdown("<hr style='margin:0.4rem 0;border:none;border-top:1px solid #E5E2DC;'>", unsafe_allow_html=True)
        _render_pdf_download_button(inv_id, po_id, inv_num, f"inv_card_{inv_id}")


# ─────────────────────────────────────────────────────────────────────────────
# Tab 4: Submit Invoice (Vendor)
# ─────────────────────────────────────────────────────────────────────────────

def _render_submit_invoice_tab(role: str, user_id: str, user_vendor_id: str) -> None:
    render_section_header(
        "Submit Vendor Invoice",
        "Fill in complete invoice details for your Purchase Order. Finance will verify against approved values."
    )

    pending  = get_invoices(vendor_id=user_vendor_id or None, status="Pending", limit=50)
    correct  = get_invoices(vendor_id=user_vendor_id or None, status="Correction Required", limit=20)
    submittable = pending + correct

    if not submittable:
        render_empty_state("No Invoices Awaiting Submission", "All invoices submitted or no active POs yet.")
        return

    opts = {f"{i.get('invoice_number','INV')} — PO: {i.get('po_number','N/A')} — {i.get('vendor_name','')}": i
            for i in submittable}
    sel_label = st.selectbox("Select Invoice", list(opts.keys()), key="inv_sel_sub")
    sel_inv   = opts.get(sel_label)
    if not sel_inv:
        return

    inv_id = str(sel_inv.get("_id", ""))
    po_qty = float(sel_inv.get("po_quantity") or sel_inv.get("quantity") or 1.0)
    po_up  = float(sel_inv.get("po_unit_price") or sel_inv.get("unit_price") or 0.0)
    prod   = sel_inv.get("product_name") or "Item"

    st.markdown(
        f'<div style="background:#EAF1FC;border:1px solid #2E4B7A33;border-left:4px solid #2E4B7A;'
        f'border-radius:6px;padding:0.7rem 1rem;margin:0.6rem 0;font-size:0.85rem;">'
        f'<b>PO:</b> {sel_inv.get("po_number","N/A")} · <b>Product:</b> {prod} · '
        f'<b>PO Qty:</b> {po_qty} · <b>PO Unit Price:</b> USD {po_up:,.2f}</div>',
        unsafe_allow_html=True)

    if sel_inv.get("invoice_status") == "Correction Required":
        reason = sel_inv.get("rejection_reason") or sel_inv.get("verification_remarks") or ""
        st.markdown(
            f'<div style="background:#FFF2EC;border:1px solid #B85C3844;border-left:4px solid #B85C38;'
            f'border-radius:6px;padding:0.7rem 1rem;margin-bottom:0.6rem;font-size:0.85rem;color:#B85C38;">'
            f'<b>Correction Required.</b> {reason or "Please correct and resubmit."}</div>',
            unsafe_allow_html=True)

    with st.form("submit_invoice_form"):
        st.markdown('<div style="font-size:0.88rem;font-weight:700;color:#172033;margin-bottom:0.4rem;">'
                    'Invoice Line Items</div>', unsafe_allow_html=True)

        n_items = st.number_input("Number of Line Items", min_value=1, max_value=20, value=1, step=1, key="inv_n_items")
        line_items = []
        for i in range(int(n_items)):
            st.markdown(f'<div style="background:#F7F5F0;border-radius:5px;padding:0.4rem 0.7rem;'
                        f'margin:0.3rem 0;font-size:0.8rem;font-weight:700;color:#3E4A61;">'
                        f'Line Item {i+1}</div>', unsafe_allow_html=True)
            lc1, lc2, lc3, lc4 = st.columns(4)
            with lc1:
                li_prod = st.text_input("Product", value=prod if i == 0 else "", key=f"li_p_{i}")
            with lc2:
                li_qty = st.number_input("Qty", value=po_qty if i == 0 else 1.0, min_value=0.01, step=1.0, key=f"li_q_{i}")
            with lc3:
                li_up = st.number_input("Unit Price", value=po_up if i == 0 else 0.0, min_value=0.0, step=1.0, key=f"li_u_{i}")
            with lc4:
                li_total = round(li_qty * li_up, 2)
                st.markdown(f'<div style="padding-top:1.5rem;font-size:0.85rem;font-weight:600;color:#172033;">'
                            f'USD {li_total:,.2f}</div>', unsafe_allow_html=True)
            line_items.append({"product_name": li_prod, "quantity": li_qty, "unit_price": li_up,
                               "line_total": li_total, "unit": "units", "notes": ""})

        st.markdown('<hr style="margin:0.5rem 0;border:none;border-top:1px solid #E5E2DC;">'
                    '<div style="font-size:0.88rem;font-weight:700;color:#172033;margin-bottom:0.4rem;">'
                    'Financial Summary</div>', unsafe_allow_html=True)

        computed_sub = sum(it["line_total"] for it in line_items)
        fc1, fc2, fc3, fc4 = st.columns(4)
        with fc1:
            inv_tax  = st.number_input("Tax (USD)", value=float(sel_inv.get("po_tax") or 0.0), min_value=0.0, step=5.0, key="inv_tax")
        with fc2:
            inv_disc = st.number_input("Discount (USD)", value=float(sel_inv.get("po_discount") or 0.0), min_value=0.0, step=5.0, key="inv_disc")
        with fc3:
            inv_ship = st.number_input("Shipping (USD)", value=float(sel_inv.get("po_shipping") or 0.0), min_value=0.0, step=5.0, key="inv_ship")
        with fc4:
            inv_other = st.number_input("Other Charges (USD)", value=float(sel_inv.get("po_other_charges") or 0.0), min_value=0.0, step=5.0, key="inv_other")

        computed_grand = round(computed_sub + inv_tax - inv_disc + inv_ship + inv_other, 2)
        st.markdown(
            f'<div style="background:#F7F5F0;border:1px solid #D9D6CF;border-radius:8px;padding:0.65rem 1rem;margin:0.4rem 0;">'
            f'<div style="display:flex;gap:1.5rem;flex-wrap:wrap;font-size:0.8rem;color:#526174;">'
            f'<span>Subtotal: <b style="color:#172033;">USD {computed_sub:,.2f}</b></span>'
            f'<span>+ Tax: <b>USD {inv_tax:,.2f}</b></span>'
            f'<span>- Discount: <b>USD {inv_disc:,.2f}</b></span>'
            f'<span>+ Shipping: <b>USD {inv_ship:,.2f}</b></span>'
            f'<span>+ Other: <b>USD {inv_other:,.2f}</b></span></div>'
            f'<div style="font-size:1.05rem;font-weight:800;color:#2D6A4A;margin-top:3px;">'
            f'Invoice Grand Total: USD {computed_grand:,.2f}</div></div>', unsafe_allow_html=True)

        st.markdown('<hr style="margin:0.5rem 0;border:none;border-top:1px solid #E5E2DC;">'
                    '<div style="font-size:0.88rem;font-weight:700;color:#172033;">Supporting Document</div>',
                    unsafe_allow_html=True)
        dc1, dc2 = st.columns(2)
        with dc1:
            doc_name = st.text_input("Document Name / Ref", placeholder="e.g. INV-2026-001.pdf", key="inv_dn")
        with dc2:
            doc_note = st.text_input("Note (optional)", placeholder="e.g. Sent via email", key="inv_dnote")

        if st.form_submit_button("SUBMIT INVOICE FOR VERIFICATION", type="primary", use_container_width=True):
            if not any(it["product_name"].strip() for it in line_items):
                st.error("At least one product name is required.")
            else:
                ok, msg = submit_vendor_invoice(
                    invoice_id=inv_id, line_items=line_items, tax_amount=inv_tax,
                    discount_amount=inv_disc, shipping_freight=inv_ship,
                    other_charges=inv_other, grand_total=computed_grand,
                    support_doc_name=doc_name or None, support_doc_note=doc_note or None,
                    submitted_by=user_id)
                if ok:
                    st.success(msg)
                    invalidate_invoice_caches()
                    st.rerun()
                else:
                    st.error(msg)


# ─────────────────────────────────────────────────────────────────────────────
# Tab 5: Pending Verification (Finance Officer)
# ─────────────────────────────────────────────────────────────────────────────

def _render_pending_verification_tab(role: str, user_id: str, user_name: str) -> None:
    render_section_header("Invoices Awaiting Finance Verification",
        "Submitted invoices ready for 4-way comparison: Request vs PO vs Invoice vs Delivery.")

    pending = get_invoices(status="Submitted", limit=50)
    if not pending:
        render_empty_state("All Clear", "No invoices awaiting verification.")
        return

    opts = {f"{i.get('invoice_number','INV')} — {i.get('vendor_name','')} — PO: {i.get('po_number','N/A')} — USD {_f(i.get('grand_total') or i.get('invoice_amount'))}": str(i.get("_id",""))
            for i in pending}
    sel_label = st.selectbox(f"Select Invoice ({len(pending)} pending)", list(opts.keys()), key="inv_vsel")
    sel_id    = opts.get(sel_label)
    if not sel_id:
        return

    st.markdown("<div style='margin-top:0.5rem;'></div>", unsafe_allow_html=True)
    _render_verification_detail(sel_id, role, user_id, user_name)


def _render_verification_detail(invoice_id: str, role: str, user_id: str, user_name: str) -> None:
    with st.spinner("Loading verification data..."):
        data = get_finance_verification_report_data(invoice_id)
    if not data:
        st.error("Could not load invoice verification data.")
        return

    inv  = data["invoice"]
    po   = data["po"]
    pr   = data["pr"]
    comp = data["comparison"]
    overall = comp.get("overall", MISMATCH)

    inv_num = inv.get("invoice_number", "N/A")
    po_num  = inv.get("po_number", "N/A")
    vendor  = inv.get("vendor_name", "N/A")
    pr_num  = pr.get("request_number") or inv.get("procurement_request_number", "N/A")

    st.markdown(
        f'<div style="background:#172033;border-radius:10px;padding:1rem 1.2rem;margin-bottom:0.8rem;">'
        f'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">'
        f'<div><div style="font-size:1rem;font-weight:700;color:#FFFFFF;">Finance Verification: {inv_num}</div>'
        f'<div style="font-size:0.8rem;color:#8A95A3;margin-top:2px;">'
        f'PO: {po_num} · PR: {pr_num} · Vendor: {vendor}</div></div>'
        f'<div>{_match_badge(overall)}</div>'
        f'</div></div>', unsafe_allow_html=True)

    render_section_header("Request vs PO vs Invoice vs Delivery Comparison")
    _render_comparison_grid(comp, show_delivery=True)

    line_items = inv.get("line_items", [])
    if line_items:
        render_section_header("Invoice Line Items")
        li_md = "| Product | Qty | Unit Price | Line Total |\n|---|---|---|---|\n"
        li_md += "\n".join(
            f"| {it.get('product_name','')} | {it.get('quantity','')} | USD {_f(it.get('unit_price'))} | USD {_f(it.get('line_total'))} |"
            for it in line_items)
        st.markdown(li_md)

    can_verify = has_action_permission(role, ACTION_FINANCE_VERIFY)
    curr_status = inv.get("invoice_status", "Pending")

    if curr_status in ("Approved", "Rejected", "Paid", "Verified"):
        _render_verification_result_banner(inv)
        return

    if not can_verify:
        st.info("Finance verification is restricted to Finance Officers. You have read-only access.")
        return

    render_section_header("Finance Officer Decision")
    remarks = st.text_area("Verification Remarks", placeholder="Notes or instructions...", height=80, key=f"verif_rem_{invoice_id}")

    bc1, bc2, bc3 = st.columns(3)
    with bc1:
        if st.button("VERIFY & APPROVE", key=f"btn_app_{invoice_id}", type="primary", use_container_width=True):
            ok, msg, _ = finance_verify_invoice(invoice_id, "approve", remarks, user_id, user_name)
            if ok:
                st.success(msg)
                invalidate_invoice_caches()
                st.rerun()
            else:
                st.error(msg)
    with bc2:
        if st.button("REQUIRE CORRECTION", key=f"btn_corr_{invoice_id}", use_container_width=True):
            if not remarks.strip():
                st.error("Provide correction instructions.")
            else:
                ok, msg, _ = finance_verify_invoice(invoice_id, "require_correction", remarks, user_id, user_name)
                if ok:
                    st.warning(msg)
                    invalidate_invoice_caches()
                    st.rerun()
                else:
                    st.error(msg)
    with bc3:
        if st.button("REJECT INVOICE", key=f"btn_rej_{invoice_id}", use_container_width=True):
            if not remarks.strip():
                st.error("Rejection reason is mandatory.")
            else:
                ok, msg, _ = finance_verify_invoice(invoice_id, "reject", remarks, user_id, user_name)
                if ok:
                    st.error(msg)
                    invalidate_invoice_caches()
                    st.rerun()
                else:
                    st.error(msg)


# ─────────────────────────────────────────────────────────────────────────────
# Tab 6: Verified / History
# ─────────────────────────────────────────────────────────────────────────────

def _render_history_tab(role: str, user_id: str) -> None:
    render_section_header("Verification & Settlement History", "Historical audit records and report downloads.")

    cf1, cf2 = st.columns([2, 1])
    with cf1:
        h_search = st.text_input("Search History", placeholder="Invoice # or Vendor...", key="hist_s")
    with cf2:
        h_status = st.selectbox("Status", ["All", "Approved", "Paid", "Rejected", "Correction Required"], key="hist_st")

    verified = get_invoices(status=None if h_status == "All" else h_status, limit=50)
    verified = [i for i in verified if i.get("invoice_status") in
                ("Approved", "Rejected", "Correction Required", "Verified", "Paid")]

    if h_search:
        sq = h_search.strip().lower()
        verified = [i for i in verified if sq in str(i.get("invoice_number","")).lower()
                    or sq in str(i.get("vendor_name","")).lower()]

    if not verified:
        render_empty_state("No History Records", "No verified or settled invoices found.")
        return

    for inv in verified:
        _render_history_card(inv, role)


def _render_history_card(inv: dict, role: str) -> None:
    """History card with persistent download buttons."""
    inv_id   = str(inv.get("_id", ""))
    po_id    = inv.get("po_id")
    inv_num  = inv.get("invoice_number", "N/A")
    po_num   = inv.get("po_number", "N/A")
    vendor   = inv.get("vendor_name", "N/A")
    amount   = float(inv.get("grand_total") or inv.get("invoice_amount", 0))
    status   = inv.get("invoice_status", "Unknown")
    payment  = inv.get("payment_status", "Unpaid")
    verif_id = inv.get("verification_id", "N/A")
    match_r  = inv.get("match_result")
    pay_id   = inv.get("payment_id")
    officer  = inv.get("verified_by_name", "")
    verif_at = _date_str(inv.get("verified_at"))
    remarks  = inv.get("verification_remarks") or inv.get("rejection_reason") or ""

    with st.expander(f"{inv_num}  |  {vendor}  |  {status}  |  USD {amount:,.2f}"):
        st.markdown(
            f'<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem;">'
            f'{_status_pill(status)} {_payment_pill(payment)} '
            + (_match_badge(match_r) if match_r else '') +
            f'</div>', unsafe_allow_html=True)

        c1, c2 = st.columns(2)
        with c1:
            st.markdown(f"**Invoice:** `{inv_num}`")
            st.markdown(f"**PO:** `{po_num}`")
            st.markdown(f"**Grand Total:** USD {amount:,.2f}")
            st.markdown(f"**Verification ID:** `{verif_id}`")
            if pay_id:
                st.markdown(f"**Payment ID:** `{pay_id}`")
        with c2:
            st.markdown(f"**Finance Officer:** {officer}")
            st.markdown(f"**Verified On:** {verif_at}")
            st.markdown(f"**Payment Status:** {payment}")
            if inv.get("payment_date"):
                st.markdown(f"**Settlement Date:** {_date_str(inv.get('payment_date'))}")
            if remarks:
                st.markdown(f"**Remarks:** {remarks}")

        if has_action_permission(role, ACTION_DOWNLOAD_VERIFICATION_REPORT):
            st.markdown('<hr style="margin:0.4rem 0;border:none;border-top:1px solid #E5E2DC;">', unsafe_allow_html=True)
            d1, d2 = st.columns(2)
            with d1:
                _render_pdf_download_button(inv_id, po_id, inv_num, f"hist_inv_{inv_id}")
            with d2:
                # Excel report
                state_xl = f"xl_{inv_id}"
                if state_xl not in st.session_state:
                    if st.button("Download Excel Report", key=f"btn_xl_{inv_id}", use_container_width=True):
                        with st.spinner("Generating Excel..."):
                            xl_bytes = generate_verification_excel(inv_id)
                        if xl_bytes:
                            st.session_state[state_xl] = xl_bytes
                            st.rerun()
                        else:
                            st.error("Excel generation failed.")
                else:
                    st.download_button(
                        label=f"⬇ Save Excel ({inv_num})",
                        data=st.session_state[state_xl],
                        file_name=f"Verification_{inv_num}.xlsx",
                        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        key=f"dl_xl_{state_xl}",
                        use_container_width=True,
                    )


# ─────────────────────────────────────────────────────────────────────────────
# Grid & Banner UI Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _render_comparison_grid(comp: dict, comparison_type: str = "all", show_delivery: bool = False) -> None:
    """
    Renders comparison tables:
      - comparison_type == "pr_to_po": Requisition snapshot vs Final PO values
      - comparison_type == "po_to_inv": Agreed PO values vs Vendor invoice values
      - comparison_type == "delivery": Delivery quantity & fulfillment vs Invoiced
      - comparison_type == "all": Comprehensive 4-way comparison matrix
    """
    if comparison_type == "pr_to_po":
        sub = comp.get("pr_po_comparison") or {}
        if sub.get("skipped"):
            st.markdown(
                '<div style="background:#F7F5F0;border:1px solid #D9D6CF;border-radius:6px;'
                'padding:0.6rem 0.9rem;font-size:0.83rem;color:#68707C;">'
                'ℹ️ <b>Requisition Baseline Not Available:</b> This order is a direct order or imported order '
                'without an initial requisition snapshot. Requisition → PO comparison is skipped.'
                '</div>',
                unsafe_allow_html=True,
            )
            return

        cols = "1.5fr 1fr 1fr 1fr 1fr"
        hdrs = ["Field", "Requisition (Original)", "PO (Agreed)", "Variance", "Status"]
        hdr_html = "".join(
            f'<div style="background:#172033;color:#FFFFFF;font-size:0.72rem;font-weight:700;'
            f'padding:6px 8px;border-radius:3px;text-align:center;">{h}</div>' for h in hdrs
        )
        st.markdown(f'<div style="display:grid;grid-template-columns:{cols};gap:3px;margin-bottom:4px;">{hdr_html}</div>', unsafe_allow_html=True)

        for row in sub.get("rows", []):
            st_val = row.get("status", MATCH)
            diff_val = float(row.get("diff", 0) or 0)
            diff_col = "#8B3038" if abs(diff_val) > 0.001 else "#2D6A4A"
            diff_str = f"+{_f(diff_val)}" if diff_val > 0 else _f(diff_val)
            is_qty = (row.get("label") == "Quantity")
            pfx = "" if is_qty else "USD "

            cells = [
                f'<div style="background:#F7F5F0;padding:6px 8px;font-size:0.8rem;font-weight:700;color:#172033;border-radius:3px;">{row.get("label","")}</div>',
                f'<div style="background:#FFF;padding:6px 8px;font-size:0.8rem;color:#526174;border-radius:3px;text-align:right;">{pfx}{_f(row.get("pr_value"))}</div>',
                f'<div style="background:#FFF;padding:6px 8px;font-size:0.8rem;font-weight:700;color:#172033;border-radius:3px;text-align:right;">{pfx}{_f(row.get("po_value"))}</div>',
                f'<div style="background:#FFF;padding:6px 8px;font-size:0.8rem;color:{diff_col};font-weight:700;border-radius:3px;text-align:right;">{pfx}{diff_str}</div>',
                f'<div style="background:#FFF;padding:4px 6px;text-align:center;border-radius:3px;">{_match_badge(st_val)}</div>',
            ]
            st.markdown(f'<div style="display:grid;grid-template-columns:{cols};gap:3px;margin-bottom:2px;">{"".join(cells)}</div>', unsafe_allow_html=True)
        return

    elif comparison_type == "po_to_inv":
        sub = comp.get("po_inv_comparison") or {}
        cols = "1.5fr 1fr 1fr 1fr 1fr"
        hdrs = ["Field", "PO (Agreed)", "Invoice (Billed)", "Variance", "Status"]
        hdr_html = "".join(
            f'<div style="background:#172033;color:#FFFFFF;font-size:0.72rem;font-weight:700;'
            f'padding:6px 8px;border-radius:3px;text-align:center;">{h}</div>' for h in hdrs
        )
        st.markdown(f'<div style="display:grid;grid-template-columns:{cols};gap:3px;margin-bottom:4px;">{hdr_html}</div>', unsafe_allow_html=True)

        for row in sub.get("rows", []):
            st_val = row.get("status", MATCH)
            diff_val = float(row.get("diff", 0) or 0)
            diff_col = "#8B3038" if abs(diff_val) > 0.001 else "#2D6A4A"
            diff_str = f"+{_f(diff_val)}" if diff_val > 0 else _f(diff_val)
            is_qty = (row.get("label") == "Quantity")
            pfx = "" if is_qty else "USD "

            cells = [
                f'<div style="background:#F7F5F0;padding:6px 8px;font-size:0.8rem;font-weight:700;color:#172033;border-radius:3px;">{row.get("label","")}</div>',
                f'<div style="background:#FFF;padding:6px 8px;font-size:0.8rem;color:#526174;border-radius:3px;text-align:right;">{pfx}{_f(row.get("po_value"))}</div>',
                f'<div style="background:#FFF;padding:6px 8px;font-size:0.8rem;font-weight:700;color:#172033;border-radius:3px;text-align:right;">{pfx}{_f(row.get("inv_value"))}</div>',
                f'<div style="background:#FFF;padding:6px 8px;font-size:0.8rem;color:{diff_col};font-weight:700;border-radius:3px;text-align:right;">{pfx}{diff_str}</div>',
                f'<div style="background:#FFF;padding:4px 6px;text-align:center;border-radius:3px;">{_match_badge(st_val)}</div>',
            ]
            st.markdown(f'<div style="display:grid;grid-template-columns:{cols};gap:3px;margin-bottom:2px;">{"".join(cells)}</div>', unsafe_allow_html=True)

        added = sub.get("added_products", [])
        removed = sub.get("removed_products", [])
        if added:
            st.markdown(f'<div style="background:#FDECEC;border-left:3px solid #8B3038;border-radius:4px;'
                        f'padding:0.45rem 0.75rem;font-size:0.82rem;color:#8B3038;margin-top:4px;">'
                        f'<b>Added in Invoice (not in PO):</b> {", ".join(added)}</div>', unsafe_allow_html=True)
        if removed:
            st.markdown(f'<div style="background:#FFF2EC;border-left:3px solid #B85C38;border-radius:4px;'
                        f'padding:0.45rem 0.75rem;font-size:0.82rem;color:#B85C38;">'
                        f'<b>In PO but not in Invoice:</b> {", ".join(removed)}</div>', unsafe_allow_html=True)
        return

    elif comparison_type == "delivery":
        sub = comp.get("del_comparison") or {}
        if sub.get("skipped") or not sub.get("rows"):
            st.markdown(
                '<div style="background:#F7F5F0;border:1px solid #D9D6CF;border-radius:6px;'
                'padding:0.6rem 0.9rem;font-size:0.83rem;color:#68707C;">'
                'ℹ️ <b>Delivery Pending:</b> No fulfillment record logged for this PO yet.'
                '</div>',
                unsafe_allow_html=True,
            )
            return

        cols = "1.5fr 1fr 1fr 1fr 1fr"
        hdrs = ["Metric / Item", "Invoiced / Ordered", "Delivered Actual", "Variance", "Status"]
        hdr_html = "".join(
            f'<div style="background:#172033;color:#FFFFFF;font-size:0.72rem;font-weight:700;'
            f'padding:6px 8px;border-radius:3px;text-align:center;">{h}</div>' for h in hdrs
        )
        st.markdown(f'<div style="display:grid;grid-template-columns:{cols};gap:3px;margin-bottom:4px;">{hdr_html}</div>', unsafe_allow_html=True)

        for row in sub.get("rows", []):
            st_val = row.get("status", MATCH)
            diff_val = row.get("diff")
            if diff_val is not None:
                diff_col = "#8B3038" if abs(diff_val) > 0.001 else "#2D6A4A"
                diff_str = f"+{_f(diff_val)}" if diff_val > 0 else _f(diff_val)
            else:
                diff_col = "#526174"
                diff_str = "—"

            inv_v = row.get("inv_value", "—")
            del_v = row.get("del_value", "—")

            cells = [
                f'<div style="background:#F7F5F0;padding:6px 8px;font-size:0.8rem;font-weight:700;color:#172033;border-radius:3px;">{row.get("label","")}</div>',
                f'<div style="background:#FFF;padding:6px 8px;font-size:0.8rem;color:#526174;border-radius:3px;text-align:right;">{inv_v}</div>',
                f'<div style="background:#FFF;padding:6px 8px;font-size:0.8rem;font-weight:700;color:#172033;border-radius:3px;text-align:right;">{del_v}</div>',
                f'<div style="background:#FFF;padding:6px 8px;font-size:0.8rem;color:{diff_col};font-weight:700;border-radius:3px;text-align:right;">{diff_str}</div>',
                f'<div style="background:#FFF;padding:4px 6px;text-align:center;border-radius:3px;">{_match_badge(st_val)}</div>',
            ]
            st.markdown(f'<div style="display:grid;grid-template-columns:{cols};gap:3px;margin-bottom:2px;">{"".join(cells)}</div>', unsafe_allow_html=True)
        return

    # Default / legacy "all" 4-way grid
    cols = "1fr 1fr 1fr 1fr 1fr 1fr"
    hdrs = ["Field", "Request", "PO (Agreed)", "Invoice", "Diff (PO vs Inv)", "Status"]
    if show_delivery:
        cols = "1.2fr 1fr 1fr 1fr 1fr 1fr 1.3fr"
        hdrs = ["Field", "Request", "PO", "Invoice", "Delivered", "Variance", "Reconciliation"]

    hdr_html = "".join(
        f'<div style="background:#172033;color:#FFFFFF;font-size:0.7rem;font-weight:700;'
        f'padding:6px 8px;border-radius:3px;text-align:center;">{h}</div>' for h in hdrs)
    st.markdown(f'<div style="display:grid;grid-template-columns:{cols};gap:3px;margin-bottom:4px;">{hdr_html}</div>',
                unsafe_allow_html=True)

    for row in comp.get("rows", []):
        status = row.get("status", MATCH)
        diff_val = float(row.get("po_inv_diff", 0) or 0)
        diff_col = "#8B3038" if abs(diff_val) > 0.001 else "#2D6A4A"
        diff_str = f"+{_f(diff_val)}" if diff_val > 0 else _f(diff_val)

        cells = [
            f'<div style="background:#F7F5F0;padding:6px 8px;font-size:0.8rem;font-weight:700;color:#172033;border-radius:3px;">{row.get("label","")}</div>',
            f'<div style="background:#FFF;padding:6px 8px;font-size:0.8rem;color:#526174;border-radius:3px;text-align:right;">USD {_f(row.get("pr_value"))}</div>',
            f'<div style="background:#FFF;padding:6px 8px;font-size:0.8rem;color:#526174;border-radius:3px;text-align:right;">USD {_f(row.get("po_value"))}</div>',
            f'<div style="background:#FFF;padding:6px 8px;font-size:0.8rem;font-weight:700;color:#172033;border-radius:3px;text-align:right;">USD {_f(row.get("inv_value"))}</div>',
        ]
        if show_delivery:
            del_v = row.get("del_value")
            cells.append(f'<div style="background:#FFF;padding:6px 8px;font-size:0.8rem;color:#526174;border-radius:3px;text-align:right;">{("USD " + _f(del_v)) if del_v is not None else "—"}</div>')

        cells.append(f'<div style="background:#FFF;padding:6px 8px;font-size:0.8rem;color:{diff_col};font-weight:700;border-radius:3px;text-align:right;">USD {diff_str}</div>')
        cells.append(f'<div style="background:#FFF;padding:4px 6px;text-align:center;border-radius:3px;">{_match_badge(status)}</div>')

        st.markdown(f'<div style="display:grid;grid-template-columns:{cols};gap:3px;margin-bottom:2px;">{"".join(cells)}</div>',
                    unsafe_allow_html=True)

    added   = comp.get("added_products", [])
    removed = comp.get("removed_products", [])
    if added:
        st.markdown(f'<div style="background:#FDECEC;border-left:3px solid #8B3038;border-radius:4px;'
                    f'padding:0.45rem 0.75rem;font-size:0.82rem;color:#8B3038;margin-top:4px;">'
                    f'<b>Added in Invoice (not in PO):</b> {", ".join(added)}</div>', unsafe_allow_html=True)
    if removed:
        st.markdown(f'<div style="background:#FFF2EC;border-left:3px solid #B85C38;border-radius:4px;'
                    f'padding:0.45rem 0.75rem;font-size:0.82rem;color:#B85C38;">'
                    f'<b>In PO but not in Invoice:</b> {", ".join(removed)}</div>', unsafe_allow_html=True)


def _render_verification_result_banner(inv: dict) -> None:
    """Read-only summary of verification."""
    status   = inv.get("verification_status") or inv.get("invoice_status")
    verif_id = inv.get("verification_id", "N/A")
    officer  = inv.get("verified_by_name", "N/A")
    verif_at = _date_str(inv.get("verified_at"))
    payment  = inv.get("payment_status", "Unpaid")
    pay_id   = inv.get("payment_id")
    remarks  = inv.get("verification_remarks") or inv.get("rejection_reason") or ""

    color = "#2D6A4A" if status in ("Approved","Verified") else "#8B3038"
    st.markdown(
        f'<div style="background:{color}11;border:1px solid {color}33;border-left:4px solid {color};'
        f'border-radius:8px;padding:0.85rem 1rem;margin-top:0.5rem;">'
        f'<div style="font-size:0.95rem;font-weight:700;color:{color};">Verification {status}</div>'
        f'<div style="font-size:0.82rem;color:#526174;margin-top:3px;">'
        f'ID: <b>{verif_id}</b> · Officer: <b>{officer}</b> · Date: <b>{verif_at}</b></div>'
        f'<div style="font-size:0.82rem;color:#526174;margin-top:2px;">'
        f'Payment: {_payment_pill(payment)}'
        + (f' · Payment ID: <b>{pay_id}</b>' if pay_id else '') +
        (f' · Remarks: {remarks}' if remarks else '') +
        f'</div></div>', unsafe_allow_html=True)
