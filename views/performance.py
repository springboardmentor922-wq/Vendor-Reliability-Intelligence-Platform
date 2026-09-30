"""
views/performance.py
--------------------
Vendor Performance Intelligence — Milestone 3.

Three tabs:
  1. Overview       — KPI strip + paginated ranking table + risk donut
  2. Reliability    — Transparent score formula + risk tier filter table
  3. Vendor Detail  — Single vendor drill-down + score component bars

All heavy queries served from cache_service (cached 5 min).
DataCo-backed MongoDB collections only. Zero emoji. Deep Navy + Warm Ivory + Muted Gold theme.
"""

import streamlit as st
import plotly.graph_objects as go

from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state
from auth.session import get_current_role, navigate_to
from auth.permissions import ROLE_VENDOR
from services.cache_service import (
    get_cached_performance_summary,
    get_cached_risk_distribution,
    get_cached_market_risk_summary,
    get_cached_delivery_trend,
)
from services.performance_service import (
    get_vendor_performance_ranked,
    get_vendor_performance_detail,
    get_risk_tier_color,
    SCORE_WEIGHTS,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _risk_badge(tier: str) -> str:
    color = get_risk_tier_color(tier)
    bg_map = {"Low": "#E8F5EE", "Medium": "#FDF6EC", "High": "#FBE9E9"}
    bg = bg_map.get(tier, "#F0F0F0")
    return (
        f'<span style="background:{bg};color:{color};border:1px solid {color};'
        f'border-radius:4px;padding:2px 8px;font-size:0.72rem;font-weight:700;">{tier} Risk</span>'
    )


def _score_bar(score: float, width: int = 100) -> str:
    """Inline progress bar for reliability score."""
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
    return (
        f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {color};'
        f'border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
        f'<div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">{label}</div>'
        f'<div style="font-size:1.55rem;font-weight:800;color:{color};margin-top:2px;">{value}</div>'
        f'{"<div style=font-size:0.75rem;color:#68707C;margin-top:1px;>" + sub + "</div>" if sub else ""}'
        f'</div>'
    )


# ── Main Page ─────────────────────────────────────────────────────────────────

def render_performance_page() -> None:
    """Render the Overall Vendor Performance Intelligence page."""

    # ── Security guard: ROLE_VENDOR must use their own portal, not this page ─
    # This page shows ALL vendor data and is only for Vendor Manager / Admin.
    role = get_current_role()
    if role == ROLE_VENDOR:
        st.error(
            "Individual vendor accounts do not have access to the global performance view. "
            "Please use My Vendor Portal to view your own performance metrics."
        )
        if st.button("Go to My Vendor Portal", key="perf_vendor_redirect", type="primary"):
            navigate_to("vendor_portal")
            st.rerun()
        return

    render_page_header(
        "Overall Vendor Performance Intelligence",
        "Delivery accuracy, delay analysis, reliability scoring and risk classification "
        "across all 6 vendor categories — powered by DataCo dataset.",
    )

    tabs = st.tabs(["Overview", "Reliability Scoring", "Vendor Detail"])

    # ── Tab 1: Overview ───────────────────────────────────────────────────────
    with tabs[0]:
        _render_overview_tab()

    # ── Tab 2: Reliability Scoring ────────────────────────────────────────────
    with tabs[1]:
        _render_reliability_tab()

    # ── Tab 3: Vendor Detail ──────────────────────────────────────────────────
    with tabs[2]:
        _render_detail_tab()


# ── Tab 1: Overview ───────────────────────────────────────────────────────────

def _render_overview_tab() -> None:
    summary = get_cached_performance_summary()

    # KPI strip
    c1, c2, c3, c4, c5, c6 = st.columns(6)
    kpis = [
        (c1, "Overall On-Time Rate", f"{summary['overall_on_time_pct']:.1f}%", "Delivery accuracy", "#2D6A4A"),
        (c2, "Delay Rate", f"{summary['overall_late_pct']:.1f}%", "Late deliveries", "#8B3038"),
        (c3, "Avg Transit Days", f"{summary['avg_transit_days']:.1f}d", "Avg real transit", "#B08D57"),
        (c4, "Avg Reliability", f"{summary['avg_reliability']:.1f}", "Composite score", "#172033"),
        (c5, "High Risk Vendors", f"{summary['high_risk_count']:,}", "Score < 40", "#8B3038"),
        (c6, "Active Suppliers", f"{summary['total_vendors']:,}", "DataCo vendors", "#2E4B7A"),
    ]
    for col, label, val, sub, color in kpis:
        with col:
            st.markdown(_kpi_card(label, val, sub, color), unsafe_allow_html=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # Charts row
    render_section_header("Delivery Trend & Risk Distribution", "Monthly on-time vs late; vendor risk tier breakdown")
    ch1, ch2 = st.columns(2, gap="medium")

    with ch1:
        trend = get_cached_delivery_trend()
        months = trend.get("months", [])
        on_time = trend.get("on_time", [])
        late = trend.get("late", [])
        if months:
            fig = go.Figure()
            fig.add_trace(go.Bar(name="On-Time", x=months, y=on_time, marker_color="#2D6A4A"))
            fig.add_trace(go.Bar(name="Late / Delayed", x=months, y=late, marker_color="#8B3038"))
            fig.update_layout(
                barmode="stack",
                title=dict(text="Monthly Delivery Performance", font=dict(color="#172033", size=14, weight=700), x=0),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                margin=dict(l=10, r=10, t=40, b=10),
                legend=dict(orientation="h", yanchor="bottom", y=1.02),
                xaxis=dict(showgrid=False), yaxis=dict(gridcolor="#E5E2DC"),
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No monthly delivery data available.")

    with ch2:
        risk_dist = get_cached_risk_distribution()
        if any(risk_dist.values()):
            labels = list(risk_dist.keys())
            values = list(risk_dist.values())
            colors = [get_risk_tier_color(t) for t in labels]
            fig2 = go.Figure(go.Pie(
                labels=labels, values=values, hole=0.58,
                marker=dict(colors=colors),
                textinfo="label+percent",
            ))
            fig2.update_layout(
                title=dict(text="Vendor Risk Tier Distribution", font=dict(color="#172033", size=14, weight=700)),
                paper_bgcolor="rgba(0,0,0,0)",
                margin=dict(l=10, r=10, t=40, b=10),
            )
            st.plotly_chart(fig2, use_container_width=True)

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    # Ranking table (paginated)
    render_section_header("Vendor Performance Ranking", "Sorted by composite reliability score — paginated (20/page)")

    if "perf_page" not in st.session_state:
        st.session_state["perf_page"] = 1

    # Filters row
    f1, f2, f3, f4 = st.columns([2, 1, 1, 1])
    with f1:
        search = st.text_input("Search vendor / department", key="perf_search", placeholder="Type to filter...")
    with f2:
        from config.settings import DATACO_MARKETS
        market = st.selectbox("Market", ["All"] + DATACO_MARKETS, key="perf_market")
    with f3:
        risk_f = st.selectbox("Risk Tier", ["All", "Low", "Medium", "High"], key="perf_risk")
    with f4:
        st.markdown("<div style='height:1.6rem;'></div>", unsafe_allow_html=True)
        if st.button("Reset Filters", key="perf_reset"):
            st.session_state["perf_page"] = 1
            st.rerun()

    ranked = get_vendor_performance_ranked(
        page=st.session_state["perf_page"],
        page_size=20,
        risk_filter=risk_f if risk_f != "All" else None,
        market_filter=market if market != "All" else None,
        search=search.strip() if search else None,
    )

    items = ranked.get("items", [])
    total = ranked.get("total", 0)
    total_pages = ranked.get("total_pages", 1)

    if not items:
        render_empty_state("No Vendors Found", "Adjust search/filter criteria.")
    else:
        # Build HTML table
        rows_html = []
        for i, v in enumerate(items):
            rank_num = (st.session_state["perf_page"] - 1) * 20 + i + 1
            rows_html.append(
                f'<tr style="border-bottom:1px solid #E5E2DC;">'
                f'<td style="padding:0.6rem 0.75rem;font-weight:700;color:#172033;text-align:center;">{rank_num}</td>'
                f'<td style="padding:0.6rem 0.75rem;font-weight:600;color:#172033;">{v["vendor_code"]}</td>'
                f'<td style="padding:0.6rem 0.75rem;color:#20242A;">{v["company_name"][:28]}</td>'
                f'<td style="padding:0.6rem 0.75rem;color:#68707C;font-size:0.8rem;">{v["market"]}</td>'
                f'<td style="padding:0.6rem 0.75rem;text-align:center;color:#2D6A4A;font-weight:700;">{v["delivery_accuracy_pct"]}%</td>'
                f'<td style="padding:0.6rem 0.75rem;text-align:center;color:#8B3038;">{v["delay_rate_pct"]}%</td>'
                f'<td style="padding:0.6rem 0.75rem;text-align:center;color:#20242A;">{v["quality_index"]}%</td>'
                f'<td style="padding:0.6rem 0.75rem;text-align:center;color:#20242A;">{v["completion_rate"]}%</td>'
                f'<td style="padding:0.6rem 0.75rem;min-width:130px;">{_score_bar(v["reliability_score"])}</td>'
                f'<td style="padding:0.6rem 0.75rem;text-align:center;">{_risk_badge(v["risk_tier"])}</td>'
                f'</tr>'
            )

        table_html = (
            '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;overflow:auto;'
            'box-shadow:0 1px 3px rgba(23,32,51,0.04);max-height:520px;">'
            '<table style="width:100%;border-collapse:collapse;font-size:0.83rem;">'
            '<thead><tr style="background:#172033;color:#FFFFFF;text-align:left;position:sticky;top:0;">'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">#</th>'
            '<th style="padding:0.65rem 0.75rem;">Code</th>'
            '<th style="padding:0.65rem 0.75rem;">Company</th>'
            '<th style="padding:0.65rem 0.75rem;">Market</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">Accuracy</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">Delay Rate</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">Quality</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">Completion</th>'
            '<th style="padding:0.65rem 0.75rem;">Reliability Score</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">Risk Tier</th>'
            '</tr></thead>'
            f'<tbody>{"".join(rows_html)}</tbody>'
            '</table></div>'
        )
        st.markdown(table_html, unsafe_allow_html=True)

        # Pagination controls
        st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)
        pc1, pc2, pc3 = st.columns([1, 3, 1])
        with pc1:
            if st.session_state["perf_page"] > 1:
                if st.button("Previous", key="perf_prev"):
                    st.session_state["perf_page"] -= 1
                    st.rerun()
        with pc2:
            st.markdown(
                f'<div style="text-align:center;color:#68707C;font-size:0.82rem;padding-top:0.5rem;">'
                f'Page {st.session_state["perf_page"]} of {total_pages} — {total:,} vendors total</div>',
                unsafe_allow_html=True,
            )
        with pc3:
            if st.session_state["perf_page"] < total_pages:
                if st.button("Next", key="perf_next"):
                    st.session_state["perf_page"] += 1
                    st.rerun()


# ── Tab 2: Reliability Scoring ────────────────────────────────────────────────

def _render_reliability_tab() -> None:
    render_section_header(
        "Reliability Score Methodology",
        "Transparent composite scoring formula — each component is independently verifiable",
    )

    # Formula explanation card
    st.markdown(
        """
        <div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;padding:1.2rem 1.5rem;margin-bottom:1rem;">
            <div style="font-weight:700;color:#172033;font-size:1rem;margin-bottom:0.6rem;">Composite Reliability Score (0 – 100)</div>
            <div style="font-family:monospace;background:#F7F5F0;border-radius:6px;padding:0.75rem;font-size:0.88rem;color:#20242A;margin-bottom:0.75rem;">
                Score = Delivery Accuracy × 40 + Completion Rate × 30 + Quality Index × 20 + Response Score × 10
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.75rem;">
                <div style="border:1px solid #D9D6CF;border-radius:8px;padding:0.6rem;background:#F7F5F0;">
                    <div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">Delivery Accuracy (40%)</div>
                    <div style="font-size:0.8rem;color:#20242A;margin-top:3px;">On-time orders ÷ Total orders</div>
                </div>
                <div style="border:1px solid #D9D6CF;border-radius:8px;padding:0.6rem;background:#F7F5F0;">
                    <div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">Completion Rate (30%)</div>
                    <div style="font-size:0.8rem;color:#20242A;margin-top:3px;">(On-time + Late) ÷ Total orders</div>
                </div>
                <div style="border:1px solid #D9D6CF;border-radius:8px;padding:0.6rem;background:#F7F5F0;">
                    <div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">Quality Index (20%)</div>
                    <div style="font-size:0.8rem;color:#20242A;margin-top:3px;">1 − Late delivery rate</div>
                </div>
                <div style="border:1px solid #D9D6CF;border-radius:8px;padding:0.6rem;background:#F7F5F0;">
                    <div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">Response Score (10%)</div>
                    <div style="font-size:0.8rem;color:#20242A;margin-top:3px;">Actual vs Scheduled transit ratio</div>
                </div>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;margin-bottom:1rem;">
            <div style="background:#E8F5EE;border:1px solid #2D6A4A;border-radius:8px;padding:0.6rem 1rem;">
                <div style="font-weight:700;color:#2D6A4A;">Low Risk</div>
                <div style="color:#2D6A4A;font-size:0.82rem;">Score ≥ 70 — Reliable supplier</div>
            </div>
            <div style="background:#FDF6EC;border:1px solid #B08D57;border-radius:8px;padding:0.6rem 1rem;">
                <div style="font-weight:700;color:#B08D57;">Medium Risk</div>
                <div style="color:#B08D57;font-size:0.82rem;">40 ≤ Score &lt; 70 — Monitor closely</div>
            </div>
            <div style="background:#FBE9E9;border:1px solid #8B3038;border-radius:8px;padding:0.6rem 1rem;">
                <div style="font-weight:700;color:#8B3038;">High Risk</div>
                <div style="color:#8B3038;font-size:0.82rem;">Score &lt; 40 — Immediate action required</div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    render_section_header("Risk-Classified Vendor Table")

    # Filter
    rt_col, mk_col, _ = st.columns([1, 1, 2])
    with rt_col:
        risk_filter2 = st.selectbox("Filter by Risk", ["All", "High", "Medium", "Low"], key="rel_risk_f")
    with mk_col:
        from config.settings import DATACO_MARKETS
        market2 = st.selectbox("Filter by Market", ["All"] + DATACO_MARKETS, key="rel_mkt_f")

    if "rel_page" not in st.session_state:
        st.session_state["rel_page"] = 1

    rel_data = get_vendor_performance_ranked(
        page=st.session_state["rel_page"],
        page_size=25,
        risk_filter=risk_filter2 if risk_filter2 != "All" else None,
        market_filter=market2 if market2 != "All" else None,
    )

    rel_items = rel_data.get("items", [])
    rel_total = rel_data.get("total", 0)
    rel_pages = rel_data.get("total_pages", 1)

    if not rel_items:
        render_empty_state("No Vendors Match", "Adjust the risk or market filter.")
    else:
        rows_html = []
        for v in rel_items:
            # Individual score components
            ot = v["delivery_accuracy_pct"]
            cr = v["completion_rate"]
            qi = v["quality_index"]
            rs = v["response_score"]
            score = v["reliability_score"]
            tier = v["risk_tier"]
            color = get_risk_tier_color(tier)

            comp_bar = (
                f'<div style="display:flex;height:8px;border-radius:4px;overflow:hidden;gap:1px;">'
                f'<div title="Accuracy {ot}%" style="width:{min(ot * 0.4, 40):.1f}%;background:#2D6A4A;"></div>'
                f'<div title="Completion {cr}%" style="width:{min(cr * 0.3, 30):.1f}%;background:#2E4B7A;"></div>'
                f'<div title="Quality {qi}%" style="width:{min(qi * 0.2, 20):.1f}%;background:#B08D57;"></div>'
                f'<div title="Response {rs}%" style="width:{min(rs * 0.1, 10):.1f}%;background:#68707C;"></div>'
                f'</div>'
            )

            rows_html.append(
                f'<tr style="border-bottom:1px solid #E5E2DC;">'
                f'<td style="padding:0.6rem 0.75rem;font-weight:700;color:#172033;">{v["vendor_code"]}</td>'
                f'<td style="padding:0.6rem 0.75rem;color:#20242A;">{v["company_name"][:26]}</td>'
                f'<td style="padding:0.6rem 0.75rem;color:#68707C;font-size:0.8rem;">{v["market"]}</td>'
                f'<td style="padding:0.6rem 0.75rem;text-align:center;">{ot}%</td>'
                f'<td style="padding:0.6rem 0.75rem;text-align:center;">{cr}%</td>'
                f'<td style="padding:0.6rem 0.75rem;text-align:center;">{qi}%</td>'
                f'<td style="padding:0.6rem 0.75rem;text-align:center;">{rs}%</td>'
                f'<td style="padding:0.6rem 0.75rem;min-width:180px;">{comp_bar}<div style="margin-top:2px;">{_score_bar(score)}</div></td>'
                f'<td style="padding:0.6rem 0.75rem;text-align:center;">{_risk_badge(tier)}</td>'
                f'</tr>'
            )

        tbl = (
            '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;overflow:auto;'
            'box-shadow:0 1px 3px rgba(23,32,51,0.04);max-height:480px;">'
            '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">'
            '<thead><tr style="background:#172033;color:#FFFFFF;text-align:left;position:sticky;top:0;">'
            '<th style="padding:0.65rem 0.75rem;">Code</th>'
            '<th style="padding:0.65rem 0.75rem;">Company</th>'
            '<th style="padding:0.65rem 0.75rem;">Market</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">Accuracy</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">Completion</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">Quality</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">Response</th>'
            '<th style="padding:0.65rem 0.75rem;">Score Breakdown</th>'
            '<th style="padding:0.65rem 0.75rem;text-align:center;">Risk Tier</th>'
            '</tr></thead>'
            f'<tbody>{"".join(rows_html)}</tbody>'
            '</table></div>'
        )
        st.markdown(tbl, unsafe_allow_html=True)

        # Pagination
        st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)
        rp1, rp2, rp3 = st.columns([1, 3, 1])
        with rp1:
            if st.session_state["rel_page"] > 1:
                if st.button("Previous", key="rel_prev"):
                    st.session_state["rel_page"] -= 1
                    st.rerun()
        with rp2:
            st.markdown(
                f'<div style="text-align:center;color:#68707C;font-size:0.82rem;padding-top:0.5rem;">'
                f'Page {st.session_state["rel_page"]} of {rel_pages} — {rel_total:,} vendors</div>',
                unsafe_allow_html=True,
            )
        with rp3:
            if st.session_state["rel_page"] < rel_pages:
                if st.button("Next", key="rel_next"):
                    st.session_state["rel_page"] += 1
                    st.rerun()


# ── Tab 3: Vendor Detail ──────────────────────────────────────────────────────

def _render_detail_tab() -> None:
    render_section_header("Individual Vendor Drill-Down", "Select a vendor to view full performance breakdown")

    from services.vendor_service import get_all_vendors
    vendors = get_all_vendors(limit=500)
    if not vendors:
        render_empty_state("No Vendors", "No vendors found in database.")
        return

    v_options = {
        f"{v.get('vendor_code', '')} — {v.get('company_name', 'Unknown')} ({v.get('market', '')})": str(v.get("_id", ""))
        for v in vendors
    }
    sel_label = st.selectbox("Select Vendor", list(v_options.keys()), key="perf_detail_sel")
    sel_id = v_options.get(sel_label, "")

    if not sel_id:
        return

    detail = get_vendor_performance_detail(sel_id)
    if not detail:
        st.error("Could not load vendor detail.")
        return

    st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)

    # Header info
    tier = detail["risk_tier"]
    tier_color = get_risk_tier_color(tier)
    st.markdown(
        f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;padding:1rem 1.5rem;'
        f'margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;">'
        f'<div>'
        f'<div style="font-size:0.7rem;color:#68707C;font-weight:700;text-transform:uppercase;">Vendor</div>'
        f'<div style="font-size:1.2rem;font-weight:800;color:#172033;">{detail["company_name"]}</div>'
        f'<div style="font-size:0.82rem;color:#68707C;">{detail["vendor_code"]} · {detail["market"]} · {detail["department"]}</div>'
        f'</div>'
        f'<div style="text-align:right;">'
        f'<div style="font-size:0.7rem;color:#68707C;font-weight:700;text-transform:uppercase;">Reliability Score</div>'
        f'<div style="font-size:2rem;font-weight:800;color:{tier_color};">{detail["reliability_score"]:.1f}</div>'
        f'{_risk_badge(tier)}'
        f'</div>'
        f'</div>',
        unsafe_allow_html=True,
    )

    # Score component bars
    breakdown = detail.get("score_breakdown", {})
    d1, d2 = st.columns(2)

    with d1:
        render_section_header("Score Components")
        for component, contrib in breakdown.items():
            max_val = float(component.split("(")[1].split("%")[0])
            pct_of_max = (contrib / max_val * 100) if max_val > 0 else 0
            st.markdown(
                f'<div style="margin-bottom:0.6rem;">'
                f'<div style="display:flex;justify-content:space-between;margin-bottom:3px;">'
                f'<span style="font-size:0.82rem;color:#20242A;font-weight:600;">{component}</span>'
                f'<span style="font-size:0.82rem;font-weight:700;color:#172033;">{contrib:.1f} pts</span>'
                f'</div>'
                f'<div style="background:#E5E2DC;border-radius:4px;height:10px;">'
                f'<div style="width:{pct_of_max:.1f}%;background:#172033;height:10px;border-radius:4px;"></div>'
                f'</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

    with d2:
        render_section_header("Key Metrics")
        metrics = [
            ("Total Orders", f"{detail['total_orders']:,}", "#172033"),
            ("On-Time Orders", f"{detail['on_time_count']:,}", "#2D6A4A"),
            ("Late Orders", f"{detail['late_delivery_count']:,}", "#8B3038"),
            ("Delivery Accuracy", f"{detail['delivery_accuracy']:.1f}%", "#2D6A4A"),
            ("Avg Real Transit", f"{detail['avg_shipping_days_real']:.1f} days", "#B08D57"),
            ("Avg Scheduled Transit", f"{detail['avg_shipping_days_scheduled']:.1f} days", "#68707C"),
        ]
        for label, val, color in metrics:
            st.markdown(
                f'<div style="display:flex;justify-content:space-between;padding:0.45rem 0;'
                f'border-bottom:1px solid #E5E2DC;">'
                f'<span style="color:#68707C;font-size:0.83rem;">{label}</span>'
                f'<span style="font-weight:700;color:{color};font-size:0.88rem;">{val}</span>'
                f'</div>',
                unsafe_allow_html=True,
            )

    # Radar chart of score components
    st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)
    categories = ["Delivery Accuracy", "Completion Rate", "Quality Index", "Response Score"]
    values = [
        detail["delivery_accuracy"],
        detail["completion_rate"],
        detail["quality_index"],
        detail["response_score"],
    ]
    fig_radar = go.Figure(go.Scatterpolar(
        r=values + [values[0]],
        theta=categories + [categories[0]],
        fill="toself",
        fillcolor=f"rgba({','.join(str(int(tier_color.lstrip('#')[i:i+2], 16)) for i in (0,2,4))},0.15)",
        line=dict(color=tier_color, width=2),
        name="Score Profile",
    ))
    fig_radar.update_layout(
        polar=dict(radialaxis=dict(visible=True, range=[0, 100])),
        title=dict(text="Performance Radar", font=dict(color="#172033", size=14, weight=700)),
        paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=30, r=30, t=50, b=30),
        height=350,
    )
    st.plotly_chart(fig_radar, use_container_width=True)
