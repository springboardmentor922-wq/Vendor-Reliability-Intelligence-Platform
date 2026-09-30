"""
views/vendor_portal.py
----------------------
Individual Vendor Self-Service Portal — VendorPulse.

Data-isolated: shows ONLY the authenticated vendor's own records.
vendor_id is sourced exclusively from the authenticated JWT session (never from the URL/frontend).

Displays:
  - Vendor Performance (all 6 required metrics)
  - Reliability Score
  - Contract Status
  - Order History (own POs only)
  - Communication Activity (own threads only)

Roles permitted: ROLE_VENDOR only.
Deep Navy + Warm Ivory + Muted Gold design system. Zero emoji.
"""

import streamlit as st
import plotly.graph_objects as go

from auth.session import get_current_user, get_current_role, navigate_to
from auth.permissions import ROLE_VENDOR
from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state

from services.performance_service import get_vendor_own_performance, get_vendor_performance_trend, get_risk_tier_color
from services.vendor_service import (
    get_vendor_own_record,
    get_vendor_own_purchase_orders,
    get_vendor_own_contracts,
    get_vendor_own_communications,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _risk_badge(tier: str) -> str:
    color = get_risk_tier_color(tier)
    bg = {"Low": "#E8F5EE", "Medium": "#FDF6EC", "High": "#FBE9E9"}.get(tier, "#F0F0F0")
    return (
        f'<span style="background:{bg};color:{color};border:1px solid {color};'
        f'border-radius:4px;padding:2px 10px;font-size:0.75rem;font-weight:700;">'
        f'{tier} Risk</span>'
    )


def _status_pill(status: str, colors: dict = None) -> str:
    default_colors = {
        "Pending":   ("#A67C32", "#FEF8E7"),
        "Approved":  ("#2D6A4A", "#EAF5F0"),
        "Active":    ("#2D6A4A", "#EAF5F0"),
        "Ordered":   ("#2E4B7A", "#EAF1FC"),
        "Delivered": ("#2D6A4A", "#EAF5F0"),
        "Completed": ("#172033", "#E8EBF0"),
        "Cancelled": ("#8B3038", "#FDECEC"),
        "Expired":   ("#8B3038", "#FDECEC"),
        "Draft":     ("#68707C", "#F1F3F5"),
    }
    c = (colors or default_colors).get(status, ("#68707C", "#F1F3F5"))
    return (
        f'<span style="background:{c[1]};color:{c[0]};border:1px solid {c[0]}33;'
        f'border-radius:5px;padding:2px 8px;font-size:0.7rem;font-weight:700;">{status}</span>'
    )


def _kpi_card(label: str, value: str, sub: str = "", color: str = "#172033") -> str:
    sub_html = f'<div style="font-size:0.72rem;color:#68707C;margin-top:2px;">{sub}</div>' if sub else ""
    return (
        f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {color};'
        f'border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
        f'<div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">{label}</div>'
        f'<div style="font-size:1.5rem;font-weight:800;color:{color};margin-top:2px;">{value}</div>'
        f'{sub_html}'
        f'</div>'
    )


def _score_bar(score: float) -> str:
    color = get_risk_tier_color("Low" if score >= 70 else "Medium" if score >= 40 else "High")
    pct = min(max(score, 0), 100)
    return (
        f'<div style="display:flex;align-items:center;gap:8px;">'
        f'<div style="flex:1;background:#E5E2DC;border-radius:4px;height:8px;">'
        f'<div style="width:{pct}%;background:{color};height:8px;border-radius:4px;"></div>'
        f'</div>'
        f'<span style="font-size:0.9rem;font-weight:800;color:{color};white-space:nowrap;">{score:.1f}</span>'
        f'</div>'
    )


def _metric_row(label: str, value: str, color: str = "#20242A") -> str:
    return (
        f'<div style="display:flex;justify-content:space-between;padding:0.5rem 0;'
        f'border-bottom:1px solid #E5E2DC;">'
        f'<span style="color:#68707C;font-size:0.83rem;">{label}</span>'
        f'<span style="font-weight:700;color:{color};font-size:0.88rem;">{value}</span>'
        f'</div>'
    )


# ── Main Page ─────────────────────────────────────────────────────────────────

def render_vendor_portal_page() -> None:
    """
    Render the individual vendor self-service portal.
    All data is scoped to the authenticated vendor's own vendor_id from session.
    """
    user = get_current_user() or {}
    role = get_current_role()
    user_id = str(user.get("_id", ""))

    # ── Security guard: only ROLE_VENDOR can access this page ────────────────
    if role != ROLE_VENDOR:
        st.error("Access denied. This portal is exclusively for individual vendor accounts.")
        if st.button("Return to Dashboard", key="vp_back_dash"):
            navigate_to("dashboard")
            st.rerun()
        return

    # ── Extract vendor_id from authenticated session — NEVER from URL/frontend
    vendor_id = str(user.get("vendor_id", "")).strip()
    vendor_category = user.get("vendor_category", "")

    if not vendor_id or vendor_id in ("", "None", "null"):
        st.warning(
            "Your vendor account has not been linked to a vendor organization yet. "
            "Please contact your system administrator to complete the account setup."
        )
        render_page_header("My Vendor Portal", "Account setup pending — contact your administrator.")
        st.markdown(
            '<div style="background:#FEF8E7;border:1px solid #B08D57;border-radius:10px;'
            'padding:1.5rem;text-align:center;">'
            '<div style="font-weight:700;color:#172033;font-size:1rem;">Vendor Account Not Yet Configured</div>'
            '<div style="color:#68707C;font-size:0.85rem;margin-top:0.5rem;">'
            'An administrator needs to link your user account to a vendor record. '
            'Once linked, all your performance metrics, orders, contracts, and communications will appear here.'
            '</div>'
            '</div>',
            unsafe_allow_html=True,
        )
        return

    # ── Fetch this vendor's own data (isolated at service level) ─────────────
    perf = get_vendor_own_performance(vendor_id)
    vendor_rec = get_vendor_own_record(vendor_id)

    if not perf or not vendor_rec:
        render_page_header("My Vendor Portal", "Unable to load vendor data.")
        st.error(
            "Could not load your vendor profile. The vendor record may not exist or may have been removed. "
            "Contact your administrator."
        )
        return

    company_name = perf.get("company_name", "My Company")
    category = perf.get("category", vendor_category or "")
    tier = perf.get("risk_tier", "Medium")
    tier_color = get_risk_tier_color(tier)
    reliability_score = perf.get("reliability_score", 0.0)

    render_page_header(
        f"{company_name}",
        f"Vendor Portal · {category} · Your own performance, orders, contracts, and communications.",
    )

    # ── Vendor Identity Header ────────────────────────────────────────────────
    vendor_status = vendor_rec.get("status", "")
    approval_status = vendor_rec.get("approval_status", "")
    st.markdown(
        f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:12px;'
        f'padding:1rem 1.5rem;margin-bottom:1rem;'
        f'display:flex;justify-content:space-between;align-items:center;">'
        f'<div>'
        f'<div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">Vendor Organization</div>'
        f'<div style="font-size:1.3rem;font-weight:800;color:#172033;">{company_name}</div>'
        f'<div style="font-size:0.82rem;color:#68707C;margin-top:2px;">'
        f'{perf.get("vendor_code", "")} · {category} · {perf.get("market", "")}'
        f'</div>'
        f'</div>'
        f'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">'
        f'<div style="display:flex;gap:6px;">'
        f'{_status_pill(vendor_status)}'
        f'{_status_pill(approval_status)}'
        f'</div>'
        f'<div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">Reliability Score</div>'
        f'<div style="font-size:2.2rem;font-weight:800;color:{tier_color};line-height:1;">{reliability_score:.1f}</div>'
        f'{_risk_badge(tier)}'
        f'</div>'
        f'</div>',
        unsafe_allow_html=True,
    )

    # ── Tabs ──────────────────────────────────────────────────────────────────
    tabs = st.tabs(["Performance", "Orders", "Contracts", "Communication", "Profile"])

    # ── Tab 1: Performance ────────────────────────────────────────────────────
    with tabs[0]:
        _render_performance_tab(perf, vendor_id)

    # ── Tab 2: Orders ─────────────────────────────────────────────────────────
    with tabs[1]:
        _render_orders_tab(vendor_id)

    # ── Tab 3: Contracts ──────────────────────────────────────────────────────
    with tabs[2]:
        _render_contracts_tab(vendor_id)

    # ── Tab 4: Communication ──────────────────────────────────────────────────
    with tabs[3]:
        _render_communication_tab(vendor_id, user_id)

    # ── Tab 5: Profile ────────────────────────────────────────────────────────
    with tabs[4]:
        _render_profile_tab(vendor_rec, perf)


# ── Tab 1: Performance ────────────────────────────────────────────────────────

def _render_performance_tab(perf: dict, vendor_id: str) -> None:
    render_section_header("Performance Overview", "Your vendor performance metrics — scoped to your account only")

    # ── KPI Cards: 6 required metrics ─────────────────────────────────────────
    c1, c2, c3 = st.columns(3)
    with c1:
        st.markdown(_kpi_card(
            "On-Time Deliveries",
            f"{perf.get('on_time_deliveries', 0):,}",
            f"{perf.get('on_time_rate', 0.0):.1f}% on-time rate",
            "#2D6A4A",
        ), unsafe_allow_html=True)
    with c2:
        st.markdown(_kpi_card(
            "Delayed Deliveries",
            f"{perf.get('delayed_deliveries', 0):,}",
            f"{perf.get('delay_rate', 0.0):.1f}% delay rate",
            "#8B3038",
        ), unsafe_allow_html=True)
    with c3:
        st.markdown(_kpi_card(
            "Total Orders",
            f"{perf.get('total_orders', 0):,}",
            "All tracked orders",
            "#172033",
        ), unsafe_allow_html=True)

    st.markdown("<div style='height:0.6rem;'></div>", unsafe_allow_html=True)

    c4, c5, c6 = st.columns(3)
    with c4:
        st.markdown(_kpi_card(
            "Quality Rating",
            f"{perf.get('quality_rating', 0.0):.1f}%",
            "Based on delivery accuracy",
            "#B08D57",
        ), unsafe_allow_html=True)
    with c5:
        st.markdown(_kpi_card(
            "Response Time Score",
            f"{perf.get('response_time_score', 0.0):.1f}%",
            f"Actual {perf.get('avg_shipping_days_real', 0):.1f}d vs Scheduled {perf.get('avg_shipping_days_scheduled', 0):.1f}d",
            "#2E4B7A",
        ), unsafe_allow_html=True)
    with c6:
        st.markdown(_kpi_card(
            "Order Completion Rate",
            f"{perf.get('order_completion_rate', 0.0):.1f}%",
            "Orders fulfilled",
            "#2D6A4A",
        ), unsafe_allow_html=True)

    st.markdown("<div style='height:1rem;'></div>", unsafe_allow_html=True)

    # ── Reliability Score + Score Breakdown ──────────────────────────────────
    sc_col, rd_col = st.columns([1, 1], gap="medium")

    with sc_col:
        render_section_header("Reliability Score", "Composite 0–100 score based on 4 components")
        tier = perf.get("risk_tier", "Medium")
        tier_color = get_risk_tier_color(tier)
        reliability_score = perf.get("reliability_score", 0.0)

        # Big score display
        st.markdown(
            f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;'
            f'padding:1.2rem 1.5rem;text-align:center;margin-bottom:0.75rem;">'
            f'<div style="font-size:3rem;font-weight:800;color:{tier_color};">{reliability_score:.1f}</div>'
            f'<div style="margin:6px 0;">{_risk_badge(tier)}</div>'
            f'<div style="margin-top:0.6rem;">{_score_bar(reliability_score)}</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

        # Score breakdown
        breakdown = perf.get("score_breakdown", {})
        st.markdown(
            '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;padding:1rem 1.25rem;">',
            unsafe_allow_html=True,
        )
        render_section_header("Score Breakdown")
        component_labels = {
            "Delivery Accuracy (40pct)": "Delivery Accuracy (40%)",
            "Completion Rate (30pct)": "Completion Rate (30%)",
            "Quality Index (20pct)": "Quality Index (20%)",
            "Response Score (10pct)": "Response Score (10%)",
        }
        for key, display_label in component_labels.items():
            contrib = breakdown.get(key, 0.0)
            try:
                max_val = float(display_label.split("(")[1].split("%")[0])
            except Exception:
                max_val = 100.0
            pct_of_max = (contrib / max_val * 100) if max_val > 0 else 0
            st.markdown(
                f'<div style="margin-bottom:0.6rem;">'
                f'<div style="display:flex;justify-content:space-between;margin-bottom:3px;">'
                f'<span style="font-size:0.82rem;color:#20242A;font-weight:600;">{display_label}</span>'
                f'<span style="font-size:0.82rem;font-weight:700;color:#172033;">{contrib:.1f} pts</span>'
                f'</div>'
                f'<div style="background:#E5E2DC;border-radius:4px;height:8px;">'
                f'<div style="width:{pct_of_max:.1f}%;background:#172033;height:8px;border-radius:4px;"></div>'
                f'</div>'
                f'</div>',
                unsafe_allow_html=True,
            )
        st.markdown("</div>", unsafe_allow_html=True)

    with rd_col:
        render_section_header("Performance Radar", "Visual breakdown of your 4 performance components")
        categories_radar = ["Delivery\nAccuracy", "Completion\nRate", "Quality\nRating", "Response\nTime"]
        values_radar = [
            perf.get("on_time_rate", 0.0),
            perf.get("order_completion_rate", 0.0),
            perf.get("quality_rating", 0.0),
            perf.get("response_time_score", 0.0),
        ]
        tier_color = get_risk_tier_color(perf.get("risk_tier", "Medium"))
        try:
            r, g, b = (int(tier_color.lstrip("#")[i:i+2], 16) for i in (0, 2, 4))
            fill_color = f"rgba({r},{g},{b},0.15)"
        except Exception:
            fill_color = "rgba(176,141,87,0.15)"

        fig_radar = go.Figure(go.Scatterpolar(
            r=values_radar + [values_radar[0]],
            theta=categories_radar + [categories_radar[0]],
            fill="toself",
            fillcolor=fill_color,
            line=dict(color=tier_color, width=2),
            name="Your Performance",
        ))
        fig_radar.update_layout(
            polar=dict(radialaxis=dict(visible=True, range=[0, 100])),
            paper_bgcolor="rgba(0,0,0,0)",
            margin=dict(l=40, r=40, t=20, b=20),
            height=280,
            showlegend=False,
        )
        st.plotly_chart(fig_radar, use_container_width=True)

        # Issue resolution separately
        render_section_header("Additional Metrics")
        st.markdown(
            _metric_row("Issue Resolution Score", f"{perf.get('issue_resolution_score', 0.0):.1f}%", "#2E4B7A") +
            _metric_row("Avg Real Transit Days", f"{perf.get('avg_shipping_days_real', 0):.1f} days", "#B08D57") +
            _metric_row("Avg Scheduled Transit", f"{perf.get('avg_shipping_days_scheduled', 0):.1f} days", "#68707C"),
            unsafe_allow_html=True,
        )

    # ── Monthly Delivery Trend ────────────────────────────────────────────────
    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)
    render_section_header("Delivery Trend", "Monthly on-time vs delayed deliveries for your account")
    trend = get_vendor_performance_trend(vendor_id)
    months = trend.get("months", [])
    if months:
        fig_trend = go.Figure()
        fig_trend.add_trace(go.Bar(name="On-Time", x=months, y=trend.get("on_time", []), marker_color="#2D6A4A"))
        fig_trend.add_trace(go.Bar(name="Delayed", x=months, y=trend.get("late", []), marker_color="#8B3038"))
        fig_trend.update_layout(
            barmode="stack",
            title=dict(text="Monthly Delivery Performance", font=dict(color="#172033", size=13, weight=700)),
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            margin=dict(l=10, r=10, t=40, b=10),
            legend=dict(orientation="h", yanchor="bottom", y=1.02),
            xaxis=dict(showgrid=False), yaxis=dict(gridcolor="#E5E2DC"),
        )
        st.plotly_chart(fig_trend, use_container_width=True)
    else:
        st.info("No monthly delivery trend data found for your account yet.")


# ── Tab 2: Orders ─────────────────────────────────────────────────────────────

def _render_orders_tab(vendor_id: str) -> None:
    render_section_header("My Purchase Orders", "Orders issued to your organization only")

    pos = get_vendor_own_purchase_orders(vendor_id, limit=100)
    if not pos:
        render_empty_state("No Purchase Orders", "No purchase orders have been issued to your organization yet.")
        return

    # Summary counts
    status_counts: dict = {}
    for po in pos:
        s = po.get("status", "Unknown")
        status_counts[s] = status_counts.get(s, 0) + 1

    # KPI bar
    kpi_cols = st.columns(len(status_counts) + 1)
    with kpi_cols[0]:
        st.markdown(_kpi_card("Total Orders", str(len(pos)), "All statuses", "#172033"), unsafe_allow_html=True)
    for i, (status, count) in enumerate(status_counts.items()):
        with kpi_cols[i + 1]:
            color_map = {
                "Delivered": "#2D6A4A", "Completed": "#2D6A4A",
                "Ordered": "#2E4B7A", "Approved": "#2E4B7A",
                "Pending": "#B08D57", "Cancelled": "#8B3038",
            }
            c = color_map.get(status, "#68707C")
            st.markdown(_kpi_card(status, str(count), "orders", c), unsafe_allow_html=True)

    st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)

    # Status filter
    status_filter = st.selectbox("Filter by Status", ["All"] + list(status_counts.keys()), key="vp_po_filter")
    filtered = pos if status_filter == "All" else [p for p in pos if p.get("status") == status_filter]

    if not filtered:
        st.info("No orders match the selected filter.")
        return

    rows_html = []
    for po in filtered:
        po_num = po.get("po_number", "N/A")
        status = po.get("status", "")
        amount = po.get("total_amount", 0) or 0
        created = po.get("created_at")
        date_str = created.strftime("%b %d, %Y") if hasattr(created, "strftime") else str(created)[:10]
        payment = po.get("payment_status", "")
        rows_html.append(
            f'<tr style="border-bottom:1px solid #E5E2DC;">'
            f'<td style="padding:0.6rem 0.75rem;font-weight:700;color:#172033;">{po_num}</td>'
            f'<td style="padding:0.6rem 0.75rem;">{_status_pill(status)}</td>'
            f'<td style="padding:0.6rem 0.75rem;color:#68707C;font-size:0.82rem;">{date_str}</td>'
            f'<td style="padding:0.6rem 0.75rem;font-weight:700;color:#20242A;">USD {amount:,.2f}</td>'
            f'<td style="padding:0.6rem 0.75rem;color:#68707C;font-size:0.82rem;">{payment}</td>'
            f'</tr>'
        )

    table_html = (
        '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;overflow:auto;">'
        '<table style="width:100%;border-collapse:collapse;font-size:0.83rem;">'
        '<thead><tr style="background:#172033;color:#FFFFFF;">'
        '<th style="padding:0.65rem 0.75rem;text-align:left;">PO Number</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:left;">Status</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:left;">Date</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:left;">Amount</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:left;">Payment</th>'
        '</tr></thead>'
        f'<tbody>{"".join(rows_html)}</tbody>'
        '</table></div>'
    )
    st.markdown(table_html, unsafe_allow_html=True)


# ── Tab 3: Contracts ──────────────────────────────────────────────────────────

def _render_contracts_tab(vendor_id: str) -> None:
    render_section_header("My Contracts", "Active and historical contracts for your organization")

    contracts = get_vendor_own_contracts(vendor_id, limit=50)
    if not contracts:
        render_empty_state("No Contracts", "No contracts are associated with your vendor account yet.")
        return

    rows_html = []
    for c in contracts:
        title = c.get("contract_title", c.get("title", "N/A"))
        status = c.get("status", "")
        c_type = c.get("contract_type", "")
        start = c.get("start_date", "")
        end = c.get("end_date", c.get("expiry_date", ""))
        value = c.get("contract_value", c.get("value", 0)) or 0

        if hasattr(start, "strftime"):
            start = start.strftime("%b %d, %Y")
        elif isinstance(start, str):
            start = start[:10]

        if hasattr(end, "strftime"):
            end = end.strftime("%b %d, %Y")
        elif isinstance(end, str):
            end = end[:10]

        rows_html.append(
            f'<tr style="border-bottom:1px solid #E5E2DC;">'
            f'<td style="padding:0.6rem 0.75rem;font-weight:600;color:#172033;">{title[:40]}</td>'
            f'<td style="padding:0.6rem 0.75rem;">{_status_pill(status)}</td>'
            f'<td style="padding:0.6rem 0.75rem;color:#68707C;font-size:0.82rem;">{c_type}</td>'
            f'<td style="padding:0.6rem 0.75rem;color:#68707C;font-size:0.82rem;">{start}</td>'
            f'<td style="padding:0.6rem 0.75rem;color:#68707C;font-size:0.82rem;">{end}</td>'
            f'<td style="padding:0.6rem 0.75rem;font-weight:700;color:#20242A;">USD {float(value):,.0f}</td>'
            f'</tr>'
        )

    table_html = (
        '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;overflow:auto;">'
        '<table style="width:100%;border-collapse:collapse;font-size:0.83rem;">'
        '<thead><tr style="background:#172033;color:#FFFFFF;">'
        '<th style="padding:0.65rem 0.75rem;text-align:left;">Contract Title</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:left;">Status</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:left;">Type</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:left;">Start Date</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:left;">End Date</th>'
        '<th style="padding:0.65rem 0.75rem;text-align:left;">Value</th>'
        '</tr></thead>'
        f'<tbody>{"".join(rows_html)}</tbody>'
        '</table></div>'
    )
    st.markdown(table_html, unsafe_allow_html=True)


# ── Tab 4: Communication ──────────────────────────────────────────────────────

def _render_communication_tab(vendor_id: str, user_id: str) -> None:
    render_section_header("Communication Activity", "Your message threads and activity")

    threads = get_vendor_own_communications(vendor_id, user_id, limit=50)
    if not threads:
        render_empty_state(
            "No Communications",
            "No communication threads found for your account. "
            "Use the Messages module to start a conversation.",
        )
        if st.button("Open Messages", key="vp_go_messages"):
            navigate_to("communication")
            st.rerun()
        return

    for thread in threads:
        subject = thread.get("subject", thread.get("thread_subject", "Message Thread"))
        last_msg = thread.get("last_message", "")
        last_at = thread.get("last_message_at", thread.get("updated_at", ""))
        msg_count = thread.get("message_count", 0)
        status_t = thread.get("status", "Active")

        if hasattr(last_at, "strftime"):
            last_at_str = last_at.strftime("%b %d, %Y %H:%M")
        elif isinstance(last_at, str):
            last_at_str = last_at[:16]
        else:
            last_at_str = "—"

        st.markdown(
            f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:8px;'
            f'padding:0.75rem 1rem;margin-bottom:0.4rem;">'
            f'<div style="display:flex;justify-content:space-between;align-items:flex-start;">'
            f'<div>'
            f'<div style="font-size:0.88rem;font-weight:700;color:#172033;">{subject[:60]}</div>'
            f'<div style="font-size:0.78rem;color:#68707C;margin-top:2px;">{last_msg[:80]}{"..." if len(str(last_msg)) > 80 else ""}</div>'
            f'</div>'
            f'<div style="text-align:right;flex-shrink:0;margin-left:1rem;">'
            f'<div style="font-size:0.72rem;color:#68707C;">{last_at_str}</div>'
            f'<div style="font-size:0.72rem;color:#68707C;">{msg_count} messages</div>'
            f'{_status_pill(status_t)}'
            f'</div>'
            f'</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

    if st.button("Go to Messages", key="vp_goto_messages_btn"):
        navigate_to("communication")
        st.rerun()


# ── Tab 5: Profile ────────────────────────────────────────────────────────────

def _render_profile_tab(vendor_rec: dict, perf: dict) -> None:
    render_section_header("Vendor Profile", "Your organization's registered information")

    col_a, col_b = st.columns(2)

    with col_a:
        st.markdown(
            '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;padding:1.1rem 1.4rem;">',
            unsafe_allow_html=True,
        )
        render_section_header("Organization Details")
        fields = [
            ("Company Name", vendor_rec.get("company_name", "")),
            ("Vendor Code", vendor_rec.get("vendor_code", "")),
            ("Category", vendor_rec.get("category", "")),
            ("Status", vendor_rec.get("status", "")),
            ("Approval Status", vendor_rec.get("approval_status", "")),
            ("Payment Terms", vendor_rec.get("payment_terms", "")),
            ("Tax ID", vendor_rec.get("tax_id", "")),
        ]
        for label, val in fields:
            if val:
                st.markdown(_metric_row(label, str(val)), unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)

    with col_b:
        st.markdown(
            '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;padding:1.1rem 1.4rem;">',
            unsafe_allow_html=True,
        )
        render_section_header("Contact Information")
        contact = vendor_rec.get("contact_information", {})
        if isinstance(contact, dict):
            contact_fields = [
                ("Primary Contact", contact.get("primary_contact_name", "")),
                ("Primary Email", contact.get("primary_email", "")),
                ("Primary Phone", contact.get("primary_phone", "")),
                ("Website", contact.get("website", "")),
            ]
            for label, val in contact_fields:
                if val:
                    st.markdown(_metric_row(label, str(val)), unsafe_allow_html=True)

        address = vendor_rec.get("address", {})
        if isinstance(address, dict) and any(address.values()):
            st.markdown("<div style='height:0.4rem;'></div>", unsafe_allow_html=True)
            render_section_header("Address")
            addr_str = ", ".join(v for v in [
                address.get("street", ""),
                address.get("city", ""),
                address.get("state", ""),
                address.get("country", ""),
                address.get("postal_code", ""),
            ] if v)
            if addr_str:
                st.markdown(_metric_row("Address", addr_str), unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)
