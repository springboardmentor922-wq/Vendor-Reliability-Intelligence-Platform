"""
components/charts.py
--------------------
Plotly chart wrappers for the VendorPulse dashboard and analytics pages.
Theme: Enterprise Navy (#061426) & Blue (#1677E8). Zero emoji.
"""

import plotly.graph_objects as go
import plotly.express as px
import streamlit as st
from typing import List, Optional
import pandas as pd

CHART_BG = "rgba(0,0,0,0)"
CHART_PAPER_BG = "rgba(0,0,0,0)"
GRID_COLOR = "#E8E4DC"
TEXT_COLOR = "#68707C"
TITLE_COLOR = "#172033"
FONT_FAMILY = "Inter, system-ui, -apple-system, sans-serif"

PALETTE = [
    "#B08D57", "#172033", "#3E4A61", "#2D6A4A",
    "#8B3038", "#A67C32", "#68707C", "#B85C38",
]


def _apply_theme(fig: go.Figure) -> go.Figure:
    """Apply consistent enterprise theme to any Plotly figure."""
    fig.update_layout(
        paper_bgcolor=CHART_PAPER_BG,
        plot_bgcolor=CHART_BG,
        font=dict(family=FONT_FAMILY, color=TEXT_COLOR, size=12),
        margin=dict(l=20, r=20, t=40, b=20),
        legend=dict(
            bgcolor="rgba(0,0,0,0)",
            bordercolor="#E2E8F0",
            borderwidth=1,
            font=dict(size=11, color=TEXT_COLOR),
        ),
    )
    fig.update_xaxes(
        gridcolor=GRID_COLOR,
        zerolinecolor=GRID_COLOR,
        tickfont=dict(color=TEXT_COLOR, size=11),
    )
    fig.update_yaxes(
        gridcolor=GRID_COLOR,
        zerolinecolor=GRID_COLOR,
        tickfont=dict(color=TEXT_COLOR, size=11),
    )
    return fig


def render_risk_distribution_donut(
    labels: List[str],
    values: List[int],
    title: str = "Risk Distribution (by Supplier Segment)",
) -> None:
    """Donut chart matching the reference image."""
    risk_color_map = {
        "Low": "#2D6A4A",
        "Moderate": "#B08D57",
        "High": "#B85C38",
        "Critical": "#8B3038",
    }
    colors = [risk_color_map.get(lbl, "#1677E8") for lbl in labels]

    fig = go.Figure(
        go.Pie(
            labels=labels,
            values=values,
            hole=0.68,
            marker=dict(colors=colors, line=dict(color="#FFFFFF", width=2)),
            textinfo="percent",
            hoverinfo="label+value+percent",
            textfont=dict(family=FONT_FAMILY, size=12),
        )
    )
    fig.update_layout(
        title=dict(text=title, font=dict(family=FONT_FAMILY, color=TITLE_COLOR, size=14, weight=700), x=0),
        paper_bgcolor=CHART_PAPER_BG,
        font=dict(family=FONT_FAMILY, color=TEXT_COLOR),
        margin=dict(l=10, r=10, t=40, b=10),
        legend=dict(bgcolor="rgba(0,0,0,0)", font=dict(color=TEXT_COLOR, size=11)),
        showlegend=True,
    )
    st.plotly_chart(fig, use_container_width=True)


def render_vendor_status_donut(
    labels: List[str],
    values: List[int],
    title: str = "Vendor Status Distribution",
) -> None:
    """Donut chart for vendor status breakdown."""
    fig = go.Figure(
        go.Pie(
            labels=labels,
            values=values,
            hole=0.65,
            marker=dict(colors=PALETTE, line=dict(color="#FFFFFF", width=2)),
            textfont=dict(color=TEXT_COLOR),
        )
    )
    fig.update_layout(
        title=dict(text=title, font=dict(family=FONT_FAMILY, color=TITLE_COLOR, size=14, weight=700), x=0),
        paper_bgcolor=CHART_PAPER_BG,
        font=dict(family=FONT_FAMILY, color=TEXT_COLOR),
        margin=dict(l=10, r=10, t=40, b=10),
        legend=dict(bgcolor="rgba(0,0,0,0)", font=dict(color=TEXT_COLOR)),
        showlegend=True,
    )
    st.plotly_chart(fig, use_container_width=True)


def render_po_status_bar(
    statuses: List[str],
    counts: List[int],
    title: str = "Purchase Order Status",
) -> None:
    """Horizontal bar chart for PO status distribution."""
    fig = go.Figure(
        go.Bar(
            x=counts,
            y=statuses,
            orientation="h",
            marker=dict(
                color=["#1677E8", "#22A06B", "#F2A900", "#526174", "#D64545"][:len(statuses)],
                line=dict(color="#E2E8F0", width=1),
            ),
        )
    )
    fig.update_layout(
        title=dict(text=title, font=dict(family=FONT_FAMILY, color=TITLE_COLOR, size=14, weight=700), x=0),
    )
    st.plotly_chart(_apply_theme(fig), use_container_width=True)


def render_procurement_trend_line(
    months: List[str],
    spend: List[float],
    title: str = "Procurement Spend Trend (USD)",
) -> None:
    """Area/line chart for monthly procurement spend."""
    fig = go.Figure(
        go.Scatter(
            x=months,
            y=spend,
            mode="lines+markers",
            line=dict(color="#B08D57", width=3),
            marker=dict(size=6, color="#172033"),
            fill="tozeroy",
            fillcolor="rgba(176,141,87,0.08)",
        )
    )
    fig.update_layout(
        title=dict(text=title, font=dict(family=FONT_FAMILY, color=TITLE_COLOR, size=14, weight=700), x=0),
    )
    st.plotly_chart(_apply_theme(fig), use_container_width=True)


def render_vendor_reliability_trend(
    months: List[str] = None,
    scores: List[float] = None,
    title: str = "Vendor Reliability Trend",
) -> None:
    """Clean reliability trend matching reference image."""
    if not months:
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"]
    if not scores:
        scores = [78.2, 80.5, 82.1, 84.6, 86.3, 87.8, 89.1, 91.4, 94.0]

    fig = go.Figure(
        go.Scatter(
            x=months,
            y=scores,
            mode="lines+markers",
            line=dict(color="#172033", width=3, shape="spline"),
            marker=dict(size=7, color="#B08D57", line=dict(color="#FFFFFF", width=2)),
            fill="tozeroy",
            fillcolor="rgba(23,32,51,0.06)",
            name="Reliability Score (%)",
        )
    )
    fig.update_layout(
        title=dict(text=f"{title} (Current: 94.0%)", font=dict(family=FONT_FAMILY, color=TITLE_COLOR, size=14, weight=700), x=0),
        yaxis=dict(range=[60, 100]),
    )
    st.plotly_chart(_apply_theme(fig), use_container_width=True)


def render_delivery_performance_bar(
    months: List[str],
    on_time_rates: List[float],
    title: str = "On-Time Delivery Performance (%)",
) -> None:
    """Bar chart for delivery performance."""
    fig = go.Figure(
        go.Bar(
            x=months,
            y=on_time_rates,
            marker=dict(
                color="#1677E8",
                line=dict(color="#E2E8F0", width=1),
            ),
        )
    )
    fig.update_layout(
        title=dict(text=title, font=dict(family=FONT_FAMILY, color=TITLE_COLOR, size=14, weight=700), x=0),
        yaxis=dict(range=[0, 105]),
    )
    st.plotly_chart(_apply_theme(fig), use_container_width=True)
