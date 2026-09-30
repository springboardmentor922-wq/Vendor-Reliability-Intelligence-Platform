"""
views/dashboard.py
------------------
Executive Dashboard for VendorPulse.
Deep Navy + Warm Ivory + Muted Gold theme. Real MongoDB data sourced ONLY from DataCo dataset.
Role-specific panels for Vendor, Finance Officer, Auditor, and Procurement Manager.
"""

import streamlit as st
from datetime import datetime, timezone
from components.navbar import render_page_header, render_dynamic_greeting
from components.cards import render_section_header
from components.charts import (
    render_vendor_reliability_trend,
    render_risk_distribution_donut,
    render_procurement_trend_line,
    render_po_status_bar,
)
from auth.session import get_current_user, get_current_role, navigate_to
from auth.permissions import (
    ROLE_VENDOR,
    ROLE_VENDOR_MANAGER,
    ROLE_FINANCE_OFFICER,
    ROLE_AUDITOR,
    ROLE_PROCUREMENT_MANAGER,
    ROLE_ADMINISTRATOR,
)
from services.vendor_service import (
    get_vendor_stats,
    get_delivery_performance_distribution,
    get_vendor_name_map,
)
from services.procurement_service import (
    get_po_stats,
    get_procurement_stats,
    get_po_spend_by_month,
    get_po_status_distribution,
    get_total_po_value,
    get_recent_procurement_requests,
    get_recent_purchase_orders,
    get_prs_awaiting_vendor_response,
)
from services.invoice_service import get_invoices, get_invoice_stats
from services.contract_service import (
    get_contract_stats,
    get_total_contract_value,
    get_upcoming_expiries,
    expire_overdue_contracts,
)


def _fmt_currency(value: float) -> str:
    """Format large currency values compactly."""
    if value >= 1_000_000:
        return f"${value / 1_000_000:.2f}M"
    elif value >= 1_000:
        return f"${value / 1_000:.1f}K"
    return f"${value:,.0f}"


def _kpi_card(label: str, value: str, accent: str = "#172033", sub: str = "") -> str:
    sub_html = f'<div style="font-size:0.72rem;color:{accent};font-weight:600;margin-top:2px;">{sub}</div>' if sub else ""
    return (
        f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {accent};'
        f'border-radius:10px;padding:0.9rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.05);">'
        f'<div style="font-size:0.7rem;font-weight:700;color:#68707C;text-transform:uppercase;letter-spacing:0.5px;">{label}</div>'
        f'<div style="font-size:1.75rem;font-weight:800;color:#20242A;margin-top:0.2rem;letter-spacing:-0.5px;">{value}</div>'
        f'{sub_html}'
        f'</div>'
    )


def _status_pill(status: str) -> str:
    COLORS = {
        "Pending": ("#A67C32", "#FEF8E7"),
        "Approved": ("#2D6A4A", "#EAF5F0"),
        "Ordered": ("#2E4B7A", "#EAF1FC"),
        "Delivered": ("#2D6A4A", "#EAF5F0"),
        "Completed": ("#172033", "#E8EBF0"),
        "Cancelled": ("#8B3038", "#FDECEC"),
        "Verified": ("#2D6A4A", "#EAF5F0"),
        "Discrepancy": ("#8B3038", "#FDECEC"),
        "Vendor Assigned": ("#2E4B7A", "#EAF1FC"),
        "Vendor Accepted": ("#2D6A4A", "#EAF5F0"),
        "Active": ("#2D6A4A", "#EAF5F0"),
    }
    fg, bg = COLORS.get(status, ("#68707C", "#F1F3F5"))
    return (
        f'<span style="background:{bg};color:{fg};border:1px solid {fg}33;'
        f'border-radius:5px;padding:2px 8px;font-size:0.7rem;font-weight:700;">{status}</span>'
    )


def render_dashboard() -> None:
    """Render the main enterprise executive dashboard."""
    user = get_current_user() or {}
    role = get_current_role()
    user_id = str(user.get("_id", ""))
    user_vendor_id = str(user.get("vendor_id", ""))

    # Auto-expire overdue contracts on dashboard load
    try:
        expire_overdue_contracts()
    except Exception:
        pass

    # Dynamic Greeting & Live Clock
    render_dynamic_greeting(user, role)

    render_page_header(
        "Procurement & Supply Chain Overview",
        "Real-time vendor intelligence, procurement pipeline, contract portfolio, and spend analytics.",
    )

    # ── ROLE-SPECIFIC PANELS ──────────────────────────────────────────────────

    # 1. Vendor: Completely isolated personal vendor dashboard
    if role == ROLE_VENDOR:
        user_vendor_id = str(user.get("vendor_id", "")).strip()
        _render_vendor_dashboard(user, user_id, user_vendor_id)
        return

    # 2. Vendor Manager Panel: vendor management overview
    elif role == ROLE_VENDOR_MANAGER:
        v_stats = get_vendor_stats()
        st.markdown(
            f'<div style="background:#EAF5F0;border:1px solid #2D6A4A44;border-left:4px solid #2D6A4A;'
            f'border-radius:8px;padding:0.9rem 1.1rem;margin-bottom:1rem;">'
            f'<div style="font-weight:800;color:#172033;font-size:0.95rem;">Vendor Management Overview</div>'
            f'<div style="font-size:0.8rem;color:#40526B;margin-top:2px;">'
            f'Total Vendors: <b>{v_stats.get("total", 0)}</b> · '
            f'Active: <b>{v_stats.get("active", 0)}</b> · '
            f'Pending Approval: <b>{v_stats.get("pending_approval", 0)}</b> · '
            f'High Risk: <b>{v_stats.get("high_risk", 0)}</b>'
            f'</div>'
            f'</div>',
            unsafe_allow_html=True,
        )
        vm1, vm2, vm3 = st.columns(3)
        with vm1:
            if st.button("Vendor Management", key="vm_goto_vendors", type="primary"):
                navigate_to("vendors")
                st.rerun()
        with vm2:
            if st.button("Approval Queue", key="vm_goto_approval"):
                navigate_to("approval_queue")
                st.rerun()
        with vm3:
            if st.button("Overall Performance", key="vm_goto_perf"):
                navigate_to("performance")
                st.rerun()
        st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # 3. Finance Officer Panel: Pending Invoices
    elif role == ROLE_FINANCE_OFFICER:
        inv_stats = get_invoice_stats()
        st.markdown(
            f'<div style="background:#FEF8E7;border:1px solid #A67C3244;border-left:4px solid #B08D57;'
            f'border-radius:8px;padding:0.9rem 1.1rem;margin-bottom:1rem;">'
            f'<div style="font-weight:800;color:#172033;font-size:0.95rem;">Finance Action Center: Invoice Reconciliation</div>'
            f'<div style="font-size:0.8rem;color:#68707C;margin-top:2px;">'
            f'Pending Verification: <b>{inv_stats.get("pending", 0)}</b> invoices &bull; '
            f'Flagged Discrepancies: <b>{inv_stats.get("discrepancy", 0)}</b> &bull; '
            f'Verified: <b>{inv_stats.get("verified", 0)}</b>'
            f'</div>'
            f'</div>',
            unsafe_allow_html=True,
        )
        if st.button("Open Invoice Management", key="fin_goto_inv", type="primary"):
            navigate_to("invoices")
            st.rerun()
        st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # 3. Auditor Panel: Transaction Audit
    elif role == ROLE_AUDITOR:
        st.markdown(
            '<div style="background:#F7F5F0;border:1px solid #D9D6CF;border-left:4px solid #172033;'
            'border-radius:8px;padding:0.9rem 1.1rem;margin-bottom:1rem;">'
            '<div style="font-weight:800;color:#172033;font-size:0.95rem;">Auditor Read-Only Oversight</div>'
            '<div style="font-size:0.8rem;color:#68707C;margin-top:2px;">'
            'Full end-to-end visibility: Requisitions &rarr; Vendor Assignments &rarr; Supplier Acceptance &rarr; Purchase Orders &rarr; Invoices.'
            '</div>'
            '</div>',
            unsafe_allow_html=True,
        )

    # ── Live MongoDB Stats ───────────────────────────────────────────────────
    v_stats = get_vendor_stats()
    po_stats = get_po_stats()
    pr_stats = get_procurement_stats()
    c_stats = get_contract_stats()
    delivery_dist = get_delivery_performance_distribution()

    # ── Row 1: 5 Primary KPI Cards ────────────────────────────────────────────
    col1, col2, col3, col4, col5 = st.columns(5)
    kpis = [
        (col1, "DataCo Vendors", f"{v_stats.get('total', 0):,}", "#172033", "Active suppliers"),
        (col2, "Procurement Reqs", f"{pr_stats.get('total', 0):,}", "#B08D57", "Active pipeline"),
        (col3, "Total PO Orders", f"{po_stats.get('total', 0):,}", "#2E4B7A", "DataCo dataset orders"),
        (col4, "Active Orders", f"{po_stats.get('active', 0):,}", "#2D6A4A", "In transit/open"),
        (col5, "Active Contracts", f"{c_stats.get('active', 0):,}", "#8B3038", "Live agreements"),
    ]
    for col, label, val, accent, sub in kpis:
        with col:
            st.markdown(_kpi_card(label, val, accent, sub), unsafe_allow_html=True)

    st.markdown("<div style='height:0.6rem;'></div>", unsafe_allow_html=True)

    # ── Row 2: Secondary KPIs ─────────────────────────────────────────────────
    col6, col7, col8, col9 = st.columns(4)
    total_po_val = get_total_po_value()
    total_con_val = get_total_contract_value()
    with col6:
        st.markdown(_kpi_card("Total PO Value", _fmt_currency(total_po_val), "#172033", "DataCo total spend"), unsafe_allow_html=True)
    with col7:
        st.markdown(_kpi_card("Contract Portfolio", _fmt_currency(total_con_val), "#B08D57", "Active contracts"), unsafe_allow_html=True)
    with col8:
        late_rate = v_stats.get("avg_late_delivery_rate", 0.0)
        st.markdown(_kpi_card("Late Delivery Risk", f"{late_rate:.1f}%", "#A67C32", "DataCo benchmark"), unsafe_allow_html=True)
    with col9:
        st.markdown(_kpi_card("Expiring Contracts", f"{c_stats.get('expiring_soon', 0)}", "#8B3038", "Within 60 days"), unsafe_allow_html=True)

    st.markdown("<div style='height:1rem;'></div>", unsafe_allow_html=True)

    # ── Charts Row ───────────────────────────────────────────────────────────
    render_section_header("DataCo Supply Chain Analytics", "Performance & delivery intelligence from DataCo dataset")

    chart_col1, chart_col2 = st.columns([1.3, 1.0], gap="medium")
    with chart_col1:
        render_vendor_reliability_trend(title="Vendor On-Time Reliability Performance")
    with chart_col2:
        labels = list(delivery_dist.keys()) if delivery_dist else ["Delivered", "Pending", "Partially Delivered"]
        values = list(delivery_dist.values()) if delivery_dist else [50000, 10000, 2800]
        render_risk_distribution_donut(labels=labels, values=values, title="Delivery Status Breakdown (DataCo)")

    st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)

    c3, c4 = st.columns(2, gap="medium")
    with c3:
        spend_data = get_po_spend_by_month()
        months = spend_data.get("months", [])
        spend = spend_data.get("values", [])
        render_procurement_trend_line(months=months, spend=spend)
    with c4:
        status_data = get_po_status_distribution()
        statuses = list(status_data.keys())
        counts = list(status_data.values())
        render_po_status_bar(statuses=statuses, counts=counts)

    st.markdown("<div style='height:1rem;'></div>", unsafe_allow_html=True)

    # ── Recent Activity Section ───────────────────────────────────────────────
    left_col, right_col = st.columns(2, gap="medium")

    with left_col:
        render_section_header("Recent Procurement Requests")
        recent_prs = get_recent_procurement_requests(limit=5)
        if not recent_prs:
            st.markdown(
                '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:8px;padding:1rem;text-align:center;color:#68707C;font-size:0.85rem;">No procurement requests yet.</div>',
                unsafe_allow_html=True,
            )
        else:
            for pr in recent_prs:
                pr_num = pr.get("request_number", "N/A")
                dept = pr.get("department", "")
                cost = pr.get("estimated_cost", 0)
                status = pr.get("status", "Pending")
                created = pr.get("created_at")
                date_str = created.strftime("%b %d") if hasattr(created, "strftime") else str(created)[:10]
                st.markdown(
                    f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:8px;'
                    f'padding:0.65rem 0.9rem;margin-bottom:0.4rem;display:flex;justify-content:space-between;align-items:center;">'
                    f'<div>'
                    f'<div style="font-size:0.85rem;font-weight:700;color:#20242A;">{pr_num}</div>'
                    f'<div style="font-size:0.75rem;color:#68707C;">{dept} &bull; {date_str}</div>'
                    f'</div>'
                    f'<div style="display:flex;align-items:center;gap:0.5rem;">'
                    f'{_status_pill(status)}'
                    f'<span style="font-size:0.8rem;font-weight:700;color:#20242A;">${cost:,.0f}</span>'
                    f'</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

    with right_col:
        render_section_header("Recent Purchase Orders")
        vendor_names = get_vendor_name_map()
        recent_pos = get_recent_purchase_orders(limit=5)
        if not recent_pos:
            st.markdown(
                '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:8px;padding:1rem;text-align:center;color:#68707C;font-size:0.85rem;">No purchase orders yet.</div>',
                unsafe_allow_html=True,
            )
        else:
            for po in recent_pos:
                po_num = po.get("po_number", "N/A")
                v_id = po.get("vendor_id", "")
                v_name = po.get("vendor_name") or vendor_names.get(v_id, "Supplier")
                amount = po.get("total_amount", 0)
                status = po.get("status", "Pending")
                created = po.get("created_at")
                date_str = created.strftime("%b %d") if hasattr(created, "strftime") else str(created)[:10]
                st.markdown(
                    f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:8px;'
                    f'padding:0.65rem 0.9rem;margin-bottom:0.4rem;display:flex;justify-content:space-between;align-items:center;">'
                    f'<div>'
                    f'<div style="font-size:0.85rem;font-weight:700;color:#20242A;">{po_num}</div>'
                    f'<div style="font-size:0.75rem;color:#68707C;">{v_name[:30]} &bull; {date_str}</div>'
                    f'</div>'
                    f'<div style="display:flex;align-items:center;gap:0.5rem;">'
                    f'{_status_pill(status)}'
                    f'<span style="font-size:0.8rem;font-weight:700;color:#20242A;">${amount:,.0f}</span>'
                    f'</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )


def _render_vendor_dashboard(user: dict, user_id: str, user_vendor_id: str) -> None:
    """Render the isolated personal dashboard for an individual vendor account."""
    from services.vendor_service import (
        get_vendor_own_record,
        get_vendor_own_purchase_orders,
        get_vendor_own_contracts,
        get_vendor_own_communications,
    )
    from services.performance_service import (
        get_vendor_own_performance,
        get_risk_tier_color,
    )

    if not user_vendor_id or user_vendor_id in ("None", "null"):
        st.warning(
            "Your vendor account is not yet linked to a vendor entity. "
            "Please contact an administrator to complete your organization setup."
        )
        return

    perf = get_vendor_own_performance(user_vendor_id) or {}
    vendor_rec = get_vendor_own_record(user_vendor_id) or {}
    company_name = perf.get("company_name") or vendor_rec.get("company_name", "Vendor Organization")
    category = perf.get("category") or vendor_rec.get("category", user.get("vendor_category", ""))
    reliability_score = perf.get("reliability_score", 0.0)
    risk_tier = perf.get("risk_tier", "Medium")
    tier_color = get_risk_tier_color(risk_tier)

    # Vendor Identity Banner
    st.markdown(
        f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:5px solid {tier_color};'
        f'border-radius:10px;padding:1.1rem 1.4rem;margin-bottom:1.2rem;'
        f'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">'
        f'<div>'
        f'<div style="font-size:0.7rem;color:#68707C;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Vendor Dashboard</div>'
        f'<div style="font-size:1.45rem;font-weight:800;color:#172033;margin-top:2px;">{company_name}</div>'
        f'<div style="font-size:0.83rem;color:#526174;margin-top:3px;">'
        f'Category: <b style="color:#172033;">{category}</b> &bull; Code: <b>{perf.get("vendor_code", "N/A")}</b> &bull; Department: <b>{perf.get("department", "General")}</b>'
        f'</div>'
        f'</div>'
        f'<div style="display:flex;align-items:center;gap:1.5rem;">'
        f'<div style="text-align:right;">'
        f'<div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">Reliability Score</div>'
        f'<div style="font-size:2rem;font-weight:800;color:{tier_color};line-height:1.1;">{reliability_score:.1f}</div>'
        f'<div style="font-size:0.75rem;font-weight:700;color:{tier_color};">{risk_tier} Risk</div>'
        f'</div>'
        f'</div>'
        f'</div>',
        unsafe_allow_html=True,
    )

    # 4 Primary KPI cards for the vendor
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.markdown(_kpi_card("On-Time Deliveries", f"{perf.get('on_time_deliveries', 0):,}", "#2D6A4A", f"{perf.get('on_time_rate', 0.0):.1f}% on-time rate"), unsafe_allow_html=True)
    with col2:
        st.markdown(_kpi_card("Delayed Deliveries", f"{perf.get('delayed_deliveries', 0):,}", "#8B3038", f"{perf.get('delay_rate', 0.0):.1f}% delay rate"), unsafe_allow_html=True)
    with col3:
        st.markdown(_kpi_card("Quality Rating", f"{perf.get('quality_rating', 0.0):.1f}%", "#2E4B7A", "Quality benchmark"), unsafe_allow_html=True)
    with col4:
        st.markdown(_kpi_card("Order Completion", f"{perf.get('order_completion_rate', 0.0):.1f}%", "#172033", "Fulfillment rate"), unsafe_allow_html=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # Secondary KPI cards
    own_pos = get_vendor_own_purchase_orders(user_vendor_id, limit=50)
    total_spend = sum(float(p.get("total_amount") or p.get("grand_total") or p.get("total_cost") or 0.0) for p in own_pos)
    active_orders = sum(1 for p in own_pos if p.get("status") in ("Approved", "Ordered"))
    own_contracts = get_vendor_own_contracts(user_vendor_id, limit=20)

    col5, col6, col7, col8 = st.columns(4)
    with col5:
        st.markdown(_kpi_card("Total Orders", f"{len(own_pos):,}", "#172033", "All orders to date"), unsafe_allow_html=True)
    with col6:
        st.markdown(_kpi_card("Active Orders", f"{active_orders:,}", "#2D6A4A", "In transit / approved"), unsafe_allow_html=True)
    with col7:
        st.markdown(_kpi_card("Order Value", _fmt_currency(total_spend), "#B08D57", "Confirmed order total"), unsafe_allow_html=True)
    with col8:
        st.markdown(_kpi_card("Active Contracts", f"{len(own_contracts):,}", "#3E4A61", "Active agreements"), unsafe_allow_html=True)

    st.markdown("<div style='height:1.2rem;'></div>", unsafe_allow_html=True)

    # Two columns: Recent Orders & Recent Communications
    col_left, col_right = st.columns(2, gap="medium")
    with col_left:
        render_section_header("Recent Purchase Orders", "Your latest purchase orders")
        if not own_pos:
            st.markdown(
                '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:8px;'
                'padding:1.5rem;text-align:center;color:#68707C;font-size:0.85rem;">'
                'No purchase orders issued yet.</div>',
                unsafe_allow_html=True,
            )
        else:
            for po in own_pos[:5]:
                po_num = po.get("po_number", "PO-N/A")
                prod = po.get("product_name") or "Order Items"
                amt = float(po.get("total_amount") or po.get("grand_total") or 0.0)
                status = po.get("status", "Pending")
                created = po.get("created_at")
                date_str = created.strftime("%b %d, %Y") if hasattr(created, "strftime") else str(created)[:10]
                st.markdown(
                    f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:8px;'
                    f'padding:0.75rem 1rem;margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center;">'
                    f'<div>'
                    f'<div style="font-size:0.88rem;font-weight:700;color:#172033;">{po_num} &bull; <span style="font-weight:500;color:#526174;">{prod[:24]}</span></div>'
                    f'<div style="font-size:0.75rem;color:#68707C;margin-top:2px;">Issued: {date_str}</div>'
                    f'</div>'
                    f'<div style="display:flex;align-items:center;gap:0.7rem;">'
                    f'{_status_pill(status)}'
                    f'<span style="font-size:0.85rem;font-weight:800;color:#20242A;">${amt:,.2f}</span>'
                    f'</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
            if st.button("View All Orders", key="dash_view_all_pos", use_container_width=True):
                navigate_to("purchase_orders")
                st.rerun()

    with col_right:
        render_section_header("Recent Communication", "Messages and discussion threads")
        own_comms = get_vendor_own_communications(user_vendor_id, user_id, limit=5)
        if not own_comms:
            st.markdown(
                '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:8px;'
                'padding:1.5rem;text-align:center;color:#68707C;font-size:0.85rem;">'
                'No message threads yet.</div>',
                unsafe_allow_html=True,
            )
        else:
            for thread in own_comms[:5]:
                subject = thread.get("subject", "General Discussion")
                last_msg = thread.get("last_message", "")
                lm_date = thread.get("last_message_at")
                date_str = lm_date.strftime("%b %d") if hasattr(lm_date, "strftime") else str(lm_date)[:10] if lm_date else ""
                st.markdown(
                    f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:8px;'
                    f'padding:0.75rem 1rem;margin-bottom:0.5rem;">'
                    f'<div style="display:flex;justify-content:space-between;align-items:center;">'
                    f'<span style="font-size:0.88rem;font-weight:700;color:#172033;">{subject}</span>'
                    f'<span style="font-size:0.75rem;color:#68707C;">{date_str}</span>'
                    f'</div>'
                    f'<div style="font-size:0.78rem;color:#526174;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
                    f'{last_msg[:80] if last_msg else "No message preview"}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
            if st.button("Open Messages", key="dash_open_messages", use_container_width=True):
                navigate_to("communication")
                st.rerun()
