"""
components/cards.py
-------------------
Reusable KPI metric cards and information cards — enterprise navy & blue theme.
Zero emoji.
"""

import streamlit as st
from typing import Optional


def render_kpi_card(
    title: str,
    value: str,
    delta: Optional[str] = None,
    icon: str = "",
    color: str = "#1677E8",
    delta_positive: bool = True,
) -> None:
    """
    Render a single KPI metric card inspired by enterprise SaaS design.
    """
    delta_color = "#22A06B" if delta_positive else "#D64545"
    delta_html = ""
    if delta:
        arrow = "+" if delta_positive else ""
        delta_html = (
            f'<span style="font-size:0.72rem;color:{delta_color};font-weight:600;'
            f'display:block;margin-top:0.25rem;">{arrow}{delta}</span>'
        )

    # Clean icon container (light tinted background with primary color)
    icon_container = ""
    if icon:
        icon_container = (
            f'<div style="width:36px;height:36px;border-radius:8px;'
            f'background:{color}14;display:flex;align-items:center;'
            f'justify-content:center;color:{color};flex-shrink:0;">'
            f'{icon}'
            f'</div>'
        )

    card_html = (
        f'<div style="background:#FFFFFF;'
        f'border:1px solid #E2E8F0;border-left:4px solid {color};'
        f'border-radius:10px;padding:0.9rem 1.1rem;'
        f'box-shadow:0 1px 3px rgba(0,0,0,0.04);min-height:90px;'
        f'display:flex;flex-direction:column;justify-content:space-between;">'
        f'<div style="display:flex;justify-content:space-between;align-items:flex-start;">'
        f'<div>'
        f'<span style="font-size:0.7rem;color:#7B8794;font-weight:700;'
        f'letter-spacing:0.5px;text-transform:uppercase;display:block;">{title}</span>'
        f'<span style="font-size:1.65rem;font-weight:800;color:#0B1B33;'
        f'display:block;margin-top:0.25rem;line-height:1.1;letter-spacing:-0.4px;">{value}</span>'
        f'</div>'
        f'{icon_container}'
        f'</div>'
        f'{delta_html}'
        f'</div>'
    )

    st.markdown(card_html, unsafe_allow_html=True)


def render_kpi_row(metrics: list) -> None:
    """Render a row of KPI cards."""
    cols = st.columns(len(metrics))
    for col, metric in zip(cols, metrics):
        with col:
            render_kpi_card(**metric)
    st.markdown("<div style='margin-bottom:0.6rem;'></div>", unsafe_allow_html=True)


def render_info_card(title: str, content: str, icon: str = "") -> None:
    """Render a simple informational card."""
    card_html = (
        f'<div style="background:#FFFFFF;border:1px solid #E2E8F0;'
        f'border-radius:8px;padding:0.85rem 1rem;margin-bottom:0.6rem;'
        f'box-shadow:0 1px 3px rgba(0,0,0,0.04);">'
        f'<p style="font-weight:600;color:#0B1B33;margin:0 0 0.35rem 0;">{title}</p>'
        f'<p style="color:#526174;font-size:0.85rem;margin:0;">{content}</p>'
        f'</div>'
    )
    st.markdown(card_html, unsafe_allow_html=True)


def render_section_header(title: str, subtitle: str = "") -> None:
    """Section divider with title and clean blue accent line."""
    sub = f'<p style="font-size:0.78rem;color:#7B8794;margin:0.15rem 0 0 0;">{subtitle}</p>' if subtitle else ""
    st.markdown(
        f'<div style="margin:1.1rem 0 0.75rem;">'
        f'<p style="font-size:1.05rem;font-weight:700;color:#0B1B33;margin:0;letter-spacing:-0.2px;">{title}</p>'
        f'{sub}'
        f'<div style="height:2px;background:linear-gradient(90deg,#1677E8 0%, rgba(22,119,232,0.1) 80%, transparent 100%);'
        f'margin-top:0.35rem;border-radius:1px;"></div>'
        f'</div>',
        unsafe_allow_html=True,
    )


def render_empty_state(
    title: str = "No data found",
    message: str = "Nothing to display here yet.",
    icon: str = "",
) -> None:
    """Render a friendly empty state component without emojis."""
    st.markdown(
        f'<div style="text-align:center;padding:2.5rem 1.5rem;background:#FFFFFF;'
        f'border:1px dashed #E2E8F0;border-radius:10px;margin:0.75rem 0;">'
        f'<div style="width:44px;height:44px;margin:0 auto 0.75rem;background:#EAF3FF;'
        f'border-radius:10px;display:flex;align-items:center;justify-content:center;'
        f'color:#1677E8;">'
        f'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        f'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>'
        f'<line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>'
        f'<p style="font-size:1rem;font-weight:700;color:#0B1B33;margin:0;">{title}</p>'
        f'<p style="color:#7B8794;font-size:0.82rem;margin:0.35rem 0 0 0;">{message}</p>'
        f'</div>',
        unsafe_allow_html=True,
    )
