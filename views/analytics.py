"""
views/analytics.py
------------------
Procurement Analytics Dashboard — Milestone 3.

Four tabs:
  1. Procurement KPIs     — PR stats, PO volume, approval rates, cycle time
  2. Vendor Trends        — Reliability trend, top/bottom performers
  3. Delivery Analytics   — On-time vs late trend, carrier/mode, market breakdown
  4. Cost Analytics       — Total spend, monthly spend trend, vendor concentration

All data from MongoDB (existing collections). Heavy queries cached 5 min.
Deep Navy + Warm Ivory + Muted Gold theme. Zero emoji.
"""

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px

from components.navbar import render_page_header
from components.cards import render_section_header
from components.charts import _apply_theme
from services.cache_service import (
    get_cached_vendor_stats,
    get_cached_performance_summary,
    get_cached_po_spend_by_month,
    get_cached_total_po_value,
    get_cached_procurement_stats,
    get_cached_vendor_po_summary,
    get_cached_delivery_trend,
    get_cached_delivery_performance_by_month,
    get_cached_market_risk_summary,
    get_cached_risk_distribution,
    get_cached_bottom_vendors,
    get_cached_carrier_stats,
)
from services.performance_service import get_risk_tier_color


def _kpi_card(label: str, value: str, sub: str = "", color: str = "#172033") -> str:
    return (
        f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {color};'
        f'border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
        f'<div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">{label}</div>'
        f'<div style="font-size:1.55rem;font-weight:800;color:{color};margin-top:2px;">{value}</div>'
        f'{"<div style=font-size:0.75rem;color:#68707C;margin-top:1px;>" + sub + "</div>" if sub else ""}'
        f'</div>'
    )


def render_analytics_page() -> None:
    """Render the Procurement Analytics Dashboard."""
    render_page_header(
        "Analytics Dashboard",
        "Procurement KPIs, vendor trends, delivery intelligence, and cost analytics — all powered by DataCo and platform data.",
    )

    tabs = st.tabs(["Procurement KPIs", "Vendor Trends", "Delivery Analytics", "Cost Analytics"])

    with tabs[0]:
        _render_procurement_kpis()
    with tabs[1]:
        _render_vendor_trends()
    with tabs[2]:
        _render_delivery_analytics()
    with tabs[3]:
        _render_cost_analytics()


# ── Tab 1: Procurement KPIs ───────────────────────────────────────────────────

def _render_procurement_kpis() -> None:
    pr_stats = get_cached_procurement_stats()
    po_total = get_cached_total_po_value()

    total_pr = pr_stats.get("total", 0)
    approved_pr = pr_stats.get("approved", 0) + pr_stats.get("completed", 0)
    pending_pr = pr_stats.get("pending", 0)
    approval_rate = round(approved_pr / total_pr * 100, 1) if total_pr > 0 else 0.0

    # KPI row
    c1, c2, c3, c4, c5 = st.columns(5)
    with c1:
        st.markdown(_kpi_card("Total Requisitions", f"{total_pr:,}", "All PRs", "#172033"), unsafe_allow_html=True)
    with c2:
        st.markdown(_kpi_card("PR Approval Rate", f"{approval_rate:.1f}%", "Approved / total", "#2D6A4A"), unsafe_allow_html=True)
    with c3:
        st.markdown(_kpi_card("Pending Approval", f"{pending_pr:,}", "Awaiting decision", "#B08D57"), unsafe_allow_html=True)
    with c4:
        st.markdown(_kpi_card("Total PO Value", f"${po_total:,.0f}", "All purchase orders", "#2E4B7A"), unsafe_allow_html=True)
    with c5:
        st.markdown(_kpi_card("Completed PRs", f"{pr_stats.get('completed', 0):,}", "Fully fulfilled", "#2D6A4A"), unsafe_allow_html=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # PR status breakdown + Monthly PO volume
    render_section_header("Requisition Status Breakdown & PO Volume Trend")
    ch1, ch2 = st.columns(2, gap="medium")

    with ch1:
        status_data = {k: v for k, v in pr_stats.items() if k not in ("total",) and isinstance(v, int) and v > 0}
        if status_data:
            status_colors = {
                "pending": "#B08D57", "approved": "#2D6A4A", "completed": "#172033",
                "rejected": "#8B3038", "cancelled": "#68707C",
                "vendor_assigned": "#2E4B7A", "vendor_accepted": "#2D6A4A",
                "ordered": "#2E4B7A", "delivered": "#2D6A4A",
            }
            labels = [k.replace("_", " ").title() for k in status_data]
            values = list(status_data.values())
            colors = [status_colors.get(k, "#68707C") for k in status_data]
            fig = go.Figure(go.Pie(
                labels=labels, values=values, hole=0.55,
                marker=dict(colors=colors), textinfo="label+percent",
            ))
            fig.update_layout(
                title=dict(text="PR Status Distribution", font=dict(color="#172033", size=14, weight=700)),
                paper_bgcolor="rgba(0,0,0,0)",
                margin=dict(l=10, r=10, t=40, b=10),
            )
            st.plotly_chart(fig, use_container_width=True)

    with ch2:
        spend_data = get_cached_po_spend_by_month()
        months = spend_data.get("months", [])
        spend = spend_data.get("values", [])
        if months:
            fig2 = go.Figure(go.Scatter(
                x=months, y=spend,
                mode="lines+markers",
                line=dict(color="#172033", width=2.5),
                marker=dict(size=6, color="#B08D57"),
                fill="tozeroy",
                fillcolor="rgba(23,32,51,0.07)",
                name="PO Spend",
            ))
            fig2.update_layout(
                title=dict(text="Monthly PO Spend (USD)", font=dict(color="#172033", size=14, weight=700), x=0),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                margin=dict(l=10, r=10, t=40, b=10),
                yaxis=dict(gridcolor="#E5E2DC"),
                xaxis=dict(showgrid=False),
            )
            st.plotly_chart(fig2, use_container_width=True)

    # Top vendors by PO volume
    st.markdown("<div style='height:0.4rem;'></div>", unsafe_allow_html=True)
    render_section_header("Top Vendors by PO Activity")
    po_summary = get_cached_vendor_po_summary()
    if po_summary[:10]:
        from services.vendor_service import get_vendor_name_map
        v_names = get_vendor_name_map()
        rows = []
        for i, ps in enumerate(po_summary[:10]):
            v_id = str(ps.get("_id", ""))
            v_name = v_names.get(v_id, v_id[:12] or "Unknown")
            total_pos = ps.get("total_pos", 0)
            delivered = ps.get("delivered", 0)
            cancelled = ps.get("cancelled", 0)
            amount = ps.get("total_amount", 0) or 0
            fulfillment = round(delivered / total_pos * 100, 1) if total_pos > 0 else 0
            rows.append(
                f'<tr style="border-bottom:1px solid #E5E2DC;">'
                f'<td style="padding:0.55rem 0.75rem;font-weight:700;color:#172033;text-align:center;">{i+1}</td>'
                f'<td style="padding:0.55rem 0.75rem;color:#20242A;">{v_name[:24]}</td>'
                f'<td style="padding:0.55rem 0.75rem;text-align:center;">{total_pos:,}</td>'
                f'<td style="padding:0.55rem 0.75rem;text-align:center;color:#2D6A4A;">{delivered:,}</td>'
                f'<td style="padding:0.55rem 0.75rem;text-align:center;color:#8B3038;">{cancelled:,}</td>'
                f'<td style="padding:0.55rem 0.75rem;text-align:right;color:#2E4B7A;font-weight:700;">${amount:,.0f}</td>'
                f'<td style="padding:0.55rem 0.75rem;text-align:center;color:#2D6A4A;font-weight:700;">{fulfillment}%</td>'
                f'</tr>'
            )
        tbl = (
            '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;overflow:hidden;">'
            '<table style="width:100%;border-collapse:collapse;font-size:0.83rem;">'
            '<thead><tr style="background:#172033;color:#FFFFFF;">'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">#</th>'
            '<th style="padding:0.65rem 0.75rem;">Vendor</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">Total POs</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">Delivered</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">Cancelled</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:right;">Total Value</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">Fulfillment</th>'
            '</tr></thead>'
            f'<tbody>{"".join(rows)}</tbody>'
            '</table></div>'
        )
        st.markdown(tbl, unsafe_allow_html=True)


# ── Tab 2: Vendor Trends ──────────────────────────────────────────────────────

def _render_vendor_trends() -> None:
    perf = get_cached_performance_summary()
    v_stats = get_cached_vendor_stats()

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.markdown(_kpi_card("Total Vendors", f"{v_stats.get('total', 0):,}", "All registered", "#172033"), unsafe_allow_html=True)
    with c2:
        st.markdown(_kpi_card("Active Vendors", f"{v_stats.get('active', 0):,}", "Currently active", "#2D6A4A"), unsafe_allow_html=True)
    with c3:
        st.markdown(_kpi_card("Avg Reliability", f"{perf.get('avg_reliability', 0):.1f}", "Composite score", "#2E4B7A"), unsafe_allow_html=True)
    with c4:
        st.markdown(_kpi_card("High Risk Vendors", f"{perf.get('high_risk_count', 0):,}", "Score < 40", "#8B3038"), unsafe_allow_html=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)
    render_section_header("Market Risk Profile & Top Performers")

    ch1, ch2 = st.columns(2, gap="medium")

    with ch1:
        market_data = get_cached_market_risk_summary()
        if market_data:
            markets = [m["market"] for m in market_data]
            scores = [m["avg_score"] for m in market_data]
            colors = [get_risk_tier_color(m["risk_tier"]) for m in market_data]
            fig = go.Figure(go.Bar(
                x=scores, y=markets, orientation="h",
                marker=dict(color=colors),
                text=[f"{s:.1f}" for s in scores],
                textposition="outside",
            ))
            fig.update_layout(
                title=dict(text="Avg Reliability Score by Market", font=dict(color="#172033", size=14, weight=700), x=0),
                xaxis=dict(range=[0, 100], gridcolor="#E5E2DC"),
                yaxis=dict(showgrid=False),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                margin=dict(l=10, r=30, t=40, b=10),
            )
            st.plotly_chart(fig, use_container_width=True)

    with ch2:
        risk_dist = get_cached_risk_distribution()
        if any(risk_dist.values()):
            labels = ["Low Risk", "Medium Risk", "High Risk"]
            values = [risk_dist.get("Low", 0), risk_dist.get("Medium", 0), risk_dist.get("High", 0)]
            colors = ["#2D6A4A", "#B08D57", "#8B3038"]
            fig2 = go.Figure(go.Bar(
                x=labels, y=values, marker_color=colors,
                text=[f"{v:,}" for v in values], textposition="outside",
            ))
            fig2.update_layout(
                title=dict(text="Vendor Risk Tier Count", font=dict(color="#172033", size=14, weight=700), x=0),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                yaxis=dict(gridcolor="#E5E2DC"),
                xaxis=dict(showgrid=False),
                margin=dict(l=10, r=10, t=40, b=10),
            )
            st.plotly_chart(fig2, use_container_width=True)

    # Top 10 and Bottom 10 vendors
    st.markdown("<div style='height:0.4rem;'></div>", unsafe_allow_html=True)
    t1, t2 = st.columns(2, gap="medium")

    from services.performance_service import get_vendor_performance_ranked

    with t1:
        render_section_header("Top 10 Performers")
        top = get_vendor_performance_ranked(page=1, page_size=10)["items"]
        if top:
            rows = []
            for i, v in enumerate(top):
                color = get_risk_tier_color(v["risk_tier"])
                rows.append(
                    f'<tr style="border-bottom:1px solid #E5E2DC;">'
                    f'<td style="padding:0.5rem 0.65rem;font-weight:700;color:#172033;">{i+1}</td>'
                    f'<td style="padding:0.5rem 0.65rem;color:#20242A;font-size:0.82rem;">{v["company_name"][:22]}</td>'
                    f'<td style="padding:0.5rem 0.65rem;color:#68707C;font-size:0.78rem;">{v["market"]}</td>'
                    f'<td style="padding:0.5rem 0.65rem;text-align:right;font-weight:700;color:{color};">{v["reliability_score"]:.1f}</td>'
                    f'</tr>'
                )
            t = (
                '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;background:#FFFFFF;'
                'border:1px solid #D9D6CF;border-radius:8px;overflow:hidden;">'
                '<thead><tr style="background:#2D6A4A;color:#FFFFFF;">'
                '<th style="padding:0.55rem 0.65rem;">#</th>'
                '<th style="padding:0.55rem 0.65rem;">Vendor</th>'
                '<th style="padding:0.55rem 0.65rem;">Market</th>'
                '<th style="padding:0.55rem 0.65rem;text-align:right;">Score</th>'
                '</tr></thead>'
                f'<tbody>{"".join(rows)}</tbody></table>'
            )
            st.markdown(t, unsafe_allow_html=True)

    with t2:
        render_section_header("Bottom 10 (Highest Risk)")
        bottom_docs = get_cached_bottom_vendors(limit=10)
        if bottom_docs:
            rows2 = []
            for i, v in enumerate(bottom_docs):
                score = v["reliability_score"]
                color = get_risk_tier_color("High" if score < 40 else "Medium" if score < 70 else "Low")
                rows2.append(
                    f'<tr style="border-bottom:1px solid #E5E2DC;">'
                    f'<td style="padding:0.5rem 0.65rem;font-weight:700;color:#172033;">{i+1}</td>'
                    f'<td style="padding:0.5rem 0.65rem;color:#20242A;font-size:0.82rem;">{v["company_name"][:22]}</td>'
                    f'<td style="padding:0.5rem 0.65rem;color:#68707C;font-size:0.78rem;">{v["market"]}</td>'
                    f'<td style="padding:0.5rem 0.65rem;text-align:right;font-weight:700;color:{color};">{score:.1f}</td>'
                    f'</tr>'
                )
            t2_tbl = (
                '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;background:#FFFFFF;'
                'border:1px solid #D9D6CF;border-radius:8px;overflow:hidden;">'
                '<thead><tr style="background:#8B3038;color:#FFFFFF;">'
                '<th style="padding:0.55rem 0.65rem;">#</th>'
                '<th style="padding:0.55rem 0.65rem;">Vendor</th>'
                '<th style="padding:0.55rem 0.65rem;">Market</th>'
                '<th style="padding:0.55rem 0.65rem;text-align:right;">Score</th>'
                '</tr></thead>'
                f'<tbody>{"".join(rows2)}</tbody></table>'
            )
            st.markdown(t2_tbl, unsafe_allow_html=True)
        else:
            st.info("Could not load bottom performers data.")


# ── Tab 3: Delivery Analytics ─────────────────────────────────────────────────

def _render_delivery_analytics() -> None:
    perf = get_cached_performance_summary()

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.markdown(_kpi_card("On-Time Rate", f"{perf['overall_on_time_pct']:.1f}%", "DataCo dataset", "#2D6A4A"), unsafe_allow_html=True)
    with c2:
        st.markdown(_kpi_card("Delay Rate", f"{perf['overall_late_pct']:.1f}%", "Late deliveries", "#8B3038"), unsafe_allow_html=True)
    with c3:
        st.markdown(_kpi_card("Avg Transit Days", f"{perf['avg_transit_days']:.1f}d", "Real transit time", "#B08D57"), unsafe_allow_html=True)
    with c4:
        st.markdown(_kpi_card("Total Orders Tracked", f"{perf['total_orders']:,}", "DataCo verified", "#172033"), unsafe_allow_html=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)
    render_section_header("Monthly Delivery Trend & Status Distribution")

    ch1, ch2 = st.columns(2, gap="medium")

    with ch1:
        trend = get_cached_delivery_trend()
        months = trend.get("months", [])
        on_time = trend.get("on_time", [])
        late = trend.get("late", [])
        if months:
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=months, y=on_time, name="On-Time",
                mode="lines+markers", line=dict(color="#2D6A4A", width=2.5),
                marker=dict(size=5),
            ))
            fig.add_trace(go.Scatter(
                x=months, y=late, name="Late / Delayed",
                mode="lines+markers", line=dict(color="#8B3038", width=2.5),
                marker=dict(size=5),
            ))
            fig.update_layout(
                title=dict(text="On-Time vs Late Deliveries (Monthly)", font=dict(color="#172033", size=14, weight=700), x=0),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                margin=dict(l=10, r=10, t=40, b=10),
                yaxis=dict(gridcolor="#E5E2DC"),
                xaxis=dict(showgrid=False),
                legend=dict(orientation="h", yanchor="bottom", y=1.02),
            )
            st.plotly_chart(fig, use_container_width=True)

    with ch2:
        carriers = get_cached_carrier_stats()
        if carriers:
            c_names = [r["_id"] for r in carriers]
            c_total = [r["total"] for r in carriers]
            c_late = [r["late"] for r in carriers]
            fig2 = go.Figure()
            fig2.add_trace(go.Bar(name="Total", x=c_names, y=c_total, marker_color="#172033"))
            fig2.add_trace(go.Bar(name="Late", x=c_names, y=c_late, marker_color="#8B3038"))
            fig2.update_layout(
                barmode="overlay",
                title=dict(text="Deliveries by Carrier Mode", font=dict(color="#172033", size=14, weight=700), x=0),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                margin=dict(l=10, r=10, t=40, b=10),
                yaxis=dict(gridcolor="#E5E2DC"),
                xaxis=dict(showgrid=False),
            )
            st.plotly_chart(fig2, use_container_width=True)

    # Market-level delivery breakdown
    st.markdown("<div style='height:0.4rem;'></div>", unsafe_allow_html=True)
    render_section_header("Market-Level Delivery Performance")

    market_data = get_cached_market_risk_summary()
    if market_data:
        markets = [m["market"] for m in market_data]
        scores = [m["avg_score"] for m in market_data]
        orders = [m["total_orders"] for m in market_data]
        high_risk = [m["high_risk_vendors"] for m in market_data]

        fig3 = go.Figure()
        fig3.add_trace(go.Bar(name="Avg Reliability", x=markets, y=scores, marker_color="#172033", yaxis="y"))
        fig3.add_trace(go.Scatter(name="High Risk Vendors", x=markets, y=high_risk,
                                  mode="lines+markers", line=dict(color="#8B3038", width=2),
                                  marker=dict(size=8), yaxis="y2"))
        fig3.update_layout(
            title=dict(text="Market Performance vs High Risk Vendor Count", font=dict(color="#172033", size=14, weight=700), x=0),
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            margin=dict(l=10, r=60, t=40, b=10),
            yaxis=dict(title="Avg Reliability Score", gridcolor="#E5E2DC", range=[0, 100]),
            yaxis2=dict(title="High Risk Vendors", overlaying="y", side="right", showgrid=False),
            legend=dict(orientation="h", yanchor="bottom", y=1.02),
        )
        st.plotly_chart(fig3, use_container_width=True)


# ── Tab 4: Cost Analytics ─────────────────────────────────────────────────────

def _render_cost_analytics() -> None:
    total_spend = get_cached_total_po_value()
    po_summary = get_cached_vendor_po_summary()

    c1, c2, c3 = st.columns(3)
    with c1:
        st.markdown(_kpi_card("Total PO Spend", f"${total_spend:,.0f}", "All purchase orders", "#172033"), unsafe_allow_html=True)
    with c2:
        top_vendor_spend = po_summary[0].get("total_amount", 0) if po_summary else 0
        conc = round(top_vendor_spend / total_spend * 100, 1) if total_spend > 0 else 0
        st.markdown(_kpi_card("Top Vendor Concentration", f"{conc:.1f}%", "Largest vendor share", "#B08D57"), unsafe_allow_html=True)
    with c3:
        active_vendors_with_pos = len([p for p in po_summary if p.get("total_pos", 0) > 0])
        st.markdown(_kpi_card("Vendors with Active POs", f"{active_vendors_with_pos:,}", "Vendors in PO ledger", "#2E4B7A"), unsafe_allow_html=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)
    render_section_header("Spend Trend & Vendor Concentration")

    ch1, ch2 = st.columns(2, gap="medium")

    with ch1:
        spend_data = get_cached_po_spend_by_month()
        months = spend_data.get("months", [])
        spend = spend_data.get("values", [])
        if months:
            fig = go.Figure(go.Scatter(
                x=months, y=spend,
                mode="lines+markers",
                line=dict(color="#172033", width=2.5),
                marker=dict(size=6, color="#B08D57"),
                fill="tozeroy",
                fillcolor="rgba(23,32,51,0.07)",
            ))
            fig.update_layout(
                title=dict(text="Monthly PO Spend (USD)", font=dict(color="#172033", size=14, weight=700), x=0),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                margin=dict(l=10, r=10, t=40, b=10),
                yaxis=dict(gridcolor="#E5E2DC"),
                xaxis=dict(showgrid=False),
            )
            st.plotly_chart(fig, use_container_width=True)

    with ch2:
        if po_summary:
            from services.vendor_service import get_vendor_name_map
            v_names = get_vendor_name_map()
            top10 = sorted(po_summary, key=lambda x: x.get("total_amount", 0), reverse=True)[:10]
            v_labels = [v_names.get(str(v.get("_id", "")), "Unknown")[:18] for v in top10]
            v_amounts = [v.get("total_amount", 0) for v in top10]

            fig2 = go.Figure(go.Bar(
                x=v_amounts, y=v_labels, orientation="h",
                marker=dict(color="#2E4B7A"),
                text=[f"${a:,.0f}" for a in v_amounts],
                textposition="outside",
            ))
            fig2.update_layout(
                title=dict(text="Top 10 Vendors by PO Spend", font=dict(color="#172033", size=14, weight=700), x=0),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                margin=dict(l=10, r=60, t=40, b=10),
                xaxis=dict(gridcolor="#E5E2DC"),
                yaxis=dict(showgrid=False),
                height=380,
            )
            st.plotly_chart(fig2, use_container_width=True)

    # PO Value distribution
    st.markdown("<div style='height:0.4rem;'></div>", unsafe_allow_html=True)
    render_section_header("PO Value Distribution by Status")
    try:
        from database.connection import get_database
        from config.settings import COLLECTION_PURCHASE_ORDERS
        db = get_database()
        po_col = db[COLLECTION_PURCHASE_ORDERS]
        status_spend_pipeline = [
            {"$group": {"_id": "$status", "total": {"$sum": "$total_amount"}, "count": {"$sum": 1}}},
            {"$sort": {"total": -1}},
        ]
        status_spend = list(po_col.aggregate(status_spend_pipeline))
        if status_spend:
            s_labels = [r["_id"] or "Unknown" for r in status_spend]
            s_values = [r["total"] for r in status_spend]
            s_counts = [r["count"] for r in status_spend]
            status_colors = {
                "Delivered": "#2D6A4A", "Completed": "#2D6A4A",
                "Approved": "#2E4B7A", "Ordered": "#2E4B7A",
                "Pending": "#B08D57", "Cancelled": "#8B3038",
            }
            colors = [status_colors.get(l, "#68707C") for l in s_labels]

            col_a, col_b = st.columns(2, gap="medium")
            with col_a:
                fig3 = go.Figure(go.Pie(
                    labels=s_labels, values=s_values, hole=0.5,
                    marker=dict(colors=colors), textinfo="label+percent",
                ))
                fig3.update_layout(
                    title=dict(text="PO Value by Status", font=dict(color="#172033", size=14, weight=700)),
                    paper_bgcolor="rgba(0,0,0,0)", margin=dict(l=10, r=10, t=40, b=10),
                )
                st.plotly_chart(fig3, use_container_width=True)
            with col_b:
                fig4 = go.Figure(go.Bar(
                    x=s_labels, y=s_counts, marker_color=colors,
                    text=s_counts, textposition="outside",
                ))
                fig4.update_layout(
                    title=dict(text="PO Count by Status", font=dict(color="#172033", size=14, weight=700), x=0),
                    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                    margin=dict(l=10, r=10, t=40, b=10),
                    yaxis=dict(gridcolor="#E5E2DC"),
                    xaxis=dict(showgrid=False),
                )
                st.plotly_chart(fig4, use_container_width=True)
    except Exception:
        st.info("PO status breakdown not available.")
