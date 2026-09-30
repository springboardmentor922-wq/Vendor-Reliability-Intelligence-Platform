"""
components/tables.py
--------------------
Styled enterprise data table components and badge renderers.
Uses enterprise Navy & Blue theme (#061426, #1677E8) and zero emoji.
"""

import streamlit as st
import pandas as pd
from typing import List, Optional


def render_status_badge(status: str) -> str:
    """Return HTML badge for vendor and workflow statuses."""
    colors = {
        "Active": ("#22A06B", "#EAF8F1"),
        "Approved": ("#22A06B", "#EAF8F1"),
        "Delivered": ("#22A06B", "#EAF8F1"),
        "Compliant": ("#22A06B", "#EAF8F1"),
        "Pending": ("#F2A900", "#FEF8E7"),
        "Under Review": ("#F2A900", "#FEF8E7"),
        "In Transit": ("#1677E8", "#EAF3FF"),
        "Confirmed": ("#1677E8", "#EAF3FF"),
        "Issued": ("#1677E8", "#EAF3FF"),
        "Draft": ("#526174", "#F1F5F9"),
        "Inactive": ("#7B8794", "#F1F5F9"),
        "Partially Delivered": ("#F47C48", "#FFF2EC"),
        "Suspended": ("#D64545", "#FDECEC"),
        "Rejected": ("#D64545", "#FDECEC"),
        "Cancelled": ("#7B8794", "#F1F5F9"),
        "Expired": ("#D64545", "#FDECEC"),
        "Terminated": ("#D64545", "#FDECEC"),
        "Non-Compliant": ("#D64545", "#FDECEC"),
    }
    fg, bg = colors.get(status, ("#526174", "#F1F5F9"))
    return (
        f'<span style="background:{bg};color:{fg};border:1px solid {fg}33;'
        f'border-radius:6px;padding:3px 9px;font-size:0.75rem;font-weight:600;'
        f'display:inline-block;white-space:nowrap;">{status}</span>'
    )


def render_risk_badge(risk_label: str) -> str:
    """Return HTML badge for supplier risk level."""
    colors = {
        "Low": ("#22A06B", "#EAF8F1"),
        "Moderate": ("#F2A900", "#FEF8E7"),
        "High": ("#F47C48", "#FFF2EC"),
        "Critical": ("#D64545", "#FDECEC"),
    }
    fg, bg = colors.get(risk_label, ("#526174", "#F1F5F9"))
    return (
        f'<span style="background:{bg};color:{fg};border:1px solid {fg}40;'
        f'border-radius:6px;padding:3px 9px;font-size:0.75rem;font-weight:700;'
        f'display:inline-block;white-space:nowrap;">{risk_label}</span>'
    )


def render_data_table(
    data: List[dict],
    columns: Optional[List[str]] = None,
    title: str = "",
    search_key: str = "table_search",
) -> None:
    """Render a styled, searchable data table."""
    if not data:
        from components.cards import render_empty_state
        render_empty_state("No records found", "No data matches your current filters.")
        return

    df = pd.DataFrame(data)

    if columns:
        existing_cols = [c for c in columns if c in df.columns]
        df = df[existing_cols]

    if "_id" not in (columns or []) and "_id" in df.columns:
        df = df.drop(columns=["_id"])

    if title:
        st.markdown(
            f'<div style="font-weight:700;color:#0B1B33;margin-bottom:0.5rem;font-size:0.95rem;">{title}</div>',
            unsafe_allow_html=True,
        )

    search = st.text_input(
        "Search",
        key=search_key,
        placeholder="Filter records...",
        label_visibility="collapsed",
    )
    if search:
        mask = df.apply(
            lambda col: col.astype(str).str.contains(search, case=False, na=False)
        ).any(axis=1)
        df = df[mask]

    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
    )
    st.caption(f"{len(df):,} record{'s' if len(df) != 1 else ''} shown")


def render_simple_table(data: List[dict], columns: Optional[List[str]] = None) -> None:
    """Render a simple table without search."""
    if not data:
        st.info("No records to display.")
        return
    df = pd.DataFrame(data)
    if columns:
        existing = [c for c in columns if c in df.columns]
        df = df[existing]
    if "_id" not in (columns or []) and "_id" in df.columns:
        df = df.drop(columns=["_id"])
    st.dataframe(df, use_container_width=True, hide_index=True)
