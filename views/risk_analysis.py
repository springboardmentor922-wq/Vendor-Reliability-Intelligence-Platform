"""
views/risk_analysis.py
----------------------
DataCo Supply Chain Risk & Delivery Intelligence — Milestone 3 upgrade.

Added over M2:
  - Risk tier (Low / Medium / High) badges on vendor table
  - High-Risk Vendors section with filtered table
  - Market-level risk heatmap / bar chart
  - Cached delivery status aggregation

All data from existing MongoDB vendors + deliveries collections.
Deep Navy + Warm Ivory + Muted Gold theme. Zero emoji.
"""

import streamlit as st
import plotly.graph_objects as go

from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state
from components.charts import _apply_theme
from services.cache_service import (
    get_cached_performance_summary,
    get_cached_market_risk_summary,
    get_cached_risk_distribution,
    get_cached_delivery_trend,
)
from services.performance_service import get_risk_tier_color, get_risk_tier
from database.connection import get_database
from config.settings import COLLECTION_DELIVERIES, COLLECTION_VENDORS


def _risk_badge(tier: str) -> str:
    color = get_risk_tier_color(tier)
    bg_map = {"Low": "#E8F5EE", "Medium": "#FDF6EC", "High": "#FBE9E9"}
    bg = bg_map.get(tier, "#F0F0F0")
    return (
        f'<span style="background:{bg};color:{color};border:1px solid {color};'
        f'border-radius:4px;padding:2px 8px;font-size:0.7rem;font-weight:700;">{tier} Risk</span>'
    )


def render_risk_analysis_page() -> None:
    """Render the DataCo Delivery Risk Intelligence page."""
    render_page_header(
        "Supply Chain & Delivery Risk",
        "Delivery performance surveillance, on-time shipment compliance, risk tier classification and transit analytics.",
    )

    perf = get_cached_performance_summary()
    total_deliveries = perf.get("total_orders", 0)
    on_time_pct = perf.get("overall_on_time_pct", 0.0)
    late_pct = perf.get("overall_late_pct", 0.0)

    # Try to get raw counts from deliveries collection
    try:
        db = get_database()
        del_col = db[COLLECTION_DELIVERIES]
        total_del_count = del_col.count_documents({})
        delivered_ontime = del_col.count_documents({"status": "Delivered"})
        late_deliveries = del_col.count_documents({"status": "Pending"})
        partially_delivered = del_col.count_documents({"status": "Partially Delivered"})
        on_time_pct_del = (delivered_ontime / total_del_count * 100) if total_del_count > 0 else on_time_pct
        late_pct_del = (late_deliveries / total_del_count * 100) if total_del_count > 0 else late_pct
    except Exception:
        total_del_count = total_deliveries
        delivered_ontime = 0
        late_deliveries = 0
        partially_delivered = 0
        on_time_pct_del = on_time_pct
        late_pct_del = late_pct

    # ── KPI Cards ─────────────────────────────────────────────────────────────
    c1, c2, c3, c4, c5 = st.columns(5)
    kpis = [
        (c1, "On-Time Shipments", f"{delivered_ontime:,}", f"{on_time_pct_del:.1f}% fulfillment", "#2D6A4A"),
        (c2, "Late Delivery Risk", f"{late_deliveries:,}", f"{late_pct_del:.1f}% late rate", "#8B3038"),
        (c3, "Partial / Disrupted", f"{partially_delivered:,}", "Route disruptions", "#B08D57"),
        (c4, "Tracked Shipments", f"{total_del_count:,}", "DataCo verified", "#172033"),
        (c5, "High Risk Vendors", f"{perf.get('high_risk_count', 0):,}", "Score < 40", "#8B3038"),
    ]
    for col, label, val, sub, color in kpis:
        with col:
            st.markdown(
                f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {color};'
                f'border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
                f'<div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">{label}</div>'
                f'<div style="font-size:1.55rem;font-weight:800;color:{color};margin-top:2px;">{val}</div>'
                f'<div style="font-size:0.72rem;color:#68707C;">{sub}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # ── Delivery Status Charts ─────────────────────────────────────────────────
    render_section_header("Delivery Status & Risk Distribution", "Based on real DataCo supply chain records")
    col_chart1, col_chart2 = st.columns(2, gap="medium")

    with col_chart1:
        try:
            db = get_database()
            status_pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
            status_res = list(db[COLLECTION_DELIVERIES].aggregate(status_pipeline))
            labels = [r["_id"] or "Unknown" for r in status_res]
            values = [r["count"] for r in status_res]
            fig_pie = go.Figure(go.Pie(
                labels=labels, values=values, hole=0.6,
                marker=dict(colors=["#2D6A4A", "#8B3038", "#B08D57", "#2E4B7A"]),
                textinfo="label+percent",
            ))
            fig_pie.update_layout(
                title=dict(text="Shipment Fulfillment Breakdown", font=dict(color="#172033", size=14, weight=700)),
                paper_bgcolor="rgba(0,0,0,0)", margin=dict(l=10, r=10, t=40, b=10),
            )
            st.plotly_chart(fig_pie, use_container_width=True)
        except Exception:
            st.info("Delivery status chart not available.")

    with col_chart2:
        risk_dist = get_cached_risk_distribution()
        if any(risk_dist.values()):
            tiers = ["Low", "Medium", "High"]
            counts = [risk_dist.get(t, 0) for t in tiers]
            colors = [get_risk_tier_color(t) for t in tiers]
            fig_risk = go.Figure(go.Bar(
                x=tiers, y=counts, marker_color=colors,
                text=[f"{c:,}" for c in counts], textposition="outside",
            ))
            fig_risk.update_layout(
                title=dict(text="Vendor Risk Tier Distribution", font=dict(color="#172033", size=14, weight=700), x=0),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                margin=dict(l=10, r=10, t=40, b=10),
                yaxis=dict(gridcolor="#E5E2DC"),
                xaxis=dict(showgrid=False),
            )
            st.plotly_chart(fig_risk, use_container_width=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # ── Market Risk Heatmap ───────────────────────────────────────────────────
    render_section_header("Market-Level Risk Overview")
    market_data = get_cached_market_risk_summary()
    if market_data:
        markets = [m["market"] for m in market_data]
        scores = [m["avg_score"] for m in market_data]
        hr_vendors = [m["high_risk_vendors"] for m in market_data]
        colors = [get_risk_tier_color(m["risk_tier"]) for m in market_data]

        fig_mkt = go.Figure()
        fig_mkt.add_trace(go.Bar(
            name="Avg Reliability Score", x=markets, y=scores,
            marker_color=colors,
            text=[f"{s:.1f}" for s in scores], textposition="outside",
        ))
        fig_mkt.add_trace(go.Scatter(
            name="High Risk Vendors", x=markets, y=hr_vendors,
            mode="lines+markers",
            line=dict(color="#8B3038", width=2.5),
            marker=dict(size=8, color="#8B3038"),
            yaxis="y2",
        ))
        fig_mkt.update_layout(
            title=dict(text="Market Reliability Score vs High Risk Vendor Count", font=dict(color="#172033", size=14, weight=700), x=0),
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            margin=dict(l=10, r=60, t=40, b=10),
            yaxis=dict(title="Avg Score", range=[0, 100], gridcolor="#E5E2DC"),
            yaxis2=dict(title="High Risk Count", overlaying="y", side="right", showgrid=False),
            legend=dict(orientation="h", yanchor="bottom", y=1.02),
        )
        st.plotly_chart(fig_mkt, use_container_width=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # ── High Risk Vendors Section ─────────────────────────────────────────────
    render_section_header("High Risk Vendors", "Suppliers with reliability score below 40 — immediate action recommended")
    try:
        db = get_database()
        v_col = db[COLLECTION_VENDORS]
        high_risk_docs = list(
            v_col.find({"reliability_score": {"$lt": 40, "$exists": True}, "total_orders": {"$gt": 0}})
            .sort("reliability_score", 1)
            .limit(50)
        )
        if not high_risk_docs:
            render_empty_state("No High Risk Vendors", "All vendors currently meet minimum reliability thresholds.")
        else:
            rows = []
            for v in high_risk_docs:
                score = float(v.get("reliability_score") or 0)
                late_rate = float(v.get("late_delivery_rate") or 0) * 100
                rows.append(
                    f'<tr style="border-bottom:1px solid #E5E2DC;">'
                    f'<td style="padding:0.55rem 0.75rem;font-weight:700;color:#172033;">{v.get("vendor_code","")}</td>'
                    f'<td style="padding:0.55rem 0.75rem;color:#20242A;">{v.get("company_name","")[:24]}</td>'
                    f'<td style="padding:0.55rem 0.75rem;color:#68707C;font-size:0.8rem;">{v.get("market","")}</td>'
                    f'<td style="padding:0.55rem 0.75rem;text-align:center;">{v.get("total_orders",0):,}</td>'
                    f'<td style="padding:0.55rem 0.75rem;text-align:center;color:#8B3038;font-weight:700;">{late_rate:.1f}%</td>'
                    f'<td style="padding:0.55rem 0.75rem;text-align:center;font-weight:700;color:#8B3038;">{score:.1f}</td>'
                    f'<td style="padding:0.55rem 0.75rem;text-align:center;">{_risk_badge("High")}</td>'
                    f'</tr>'
                )
            tbl = (
                '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid #8B3038;'
                'border-radius:10px;overflow:auto;max-height:420px;">'
                '<table style="width:100%;border-collapse:collapse;font-size:0.83rem;">'
                '<thead><tr style="background:#8B3038;color:#FFFFFF;position:sticky;top:0;">'
                '<th style="padding:0.65rem 0.75rem;">Code</th>'
                '<th style="padding:0.65rem 0.75rem;">Company</th>'
                '<th style="padding:0.65rem 0.75rem;">Market</th>'
                '<th style="padding:0.65rem 0.75rem;text-align:center;">Total Orders</th>'
                '<th style="padding:0.65rem 0.75rem;text-align:center;">Late Rate</th>'
                '<th style="padding:0.65rem 0.75rem;text-align:center;">Score</th>'
                '<th style="padding:0.65rem 0.75rem;text-align:center;">Risk</th>'
                '</tr></thead>'
                f'<tbody>{"".join(rows)}</tbody>'
                '</table></div>'
            )
            st.markdown(tbl, unsafe_allow_html=True)
    except Exception as exc:
        st.error(f"Could not load high risk vendor data: {exc}")

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # ── Full Supplier Delivery Performance Table ───────────────────────────────
    render_section_header("All Supplier Delivery Performance", "Ranked by reliability from DataCo dataset — top 50")
    try:
        db = get_database()
        v_col = db[COLLECTION_VENDORS]
        v_docs = list(
            v_col.find({"source": "dataco"}).sort("reliability_score", -1).limit(50)
        )
        if not v_docs:
            # Fall back to all vendors with reliability_score
            v_docs = list(
                v_col.find({"reliability_score": {"$exists": True}})
                .sort("reliability_score", -1).limit(50)
            )

        if v_docs:
            table_rows = []
            for v in v_docs:
                score = float(v.get("reliability_score") or 0)
                tier = get_risk_tier(score)
                table_rows.append({
                    "Vendor": v.get("company_name", "N/A"),
                    "Market": v.get("market", ""),
                    "Category": v.get("category", ""),
                    "Total Orders": f"{v.get('total_orders', 0):,}",
                    "On-Time": f"{v.get('on_time_count', 0):,}",
                    "Late Orders": f"{v.get('late_delivery_count', 0):,}",
                    "Reliability": f"{score:.1f}",
                    "Avg Transit": f"{v.get('avg_shipping_days_real', 0) or 0:.1f}d",
                    "Risk Tier": tier,
                })
            import pandas as pd
            df = pd.DataFrame(table_rows)
            st.dataframe(df, use_container_width=True, hide_index=True)
        else:
            render_empty_state("No DataCo Vendors", "No suppliers found with DataCo performance data.")
    except Exception as exc:
        st.error(f"Could not load supplier data: {exc}")
