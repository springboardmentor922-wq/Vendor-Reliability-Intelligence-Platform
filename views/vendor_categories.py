"""
views/vendor_categories.py
--------------------------
Vendor Categories Management view — exactly 6 canonical categories.
Theme: Enterprise Navy (#172033) & Blue (#1677E8). Zero emoji.
"""

import streamlit as st
from components.navbar import render_page_header
from components.cards import render_section_header
from config.settings import (
    VENDOR_CATEGORIES,
    VENDOR_CATEGORY_LABELS,
    VENDOR_CATEGORY_COLORS,
    COLLECTION_VENDORS,
)
from database.connection import get_database


def render_vendor_categories_page() -> None:
    """Render the Vendor Categories overview with exactly 6 canonical categories."""
    render_page_header(
        "Vendor Categories",
        "Domain categorization, supplier allocation density, and industry coverage — 6 canonical categories.",
    )

    try:
        db = get_database()
        col = db[COLLECTION_VENDORS]
        pipeline = [
            {"$match": {"category": {"$in": list(VENDOR_CATEGORIES)}}},
            {"$group": {
                "_id": "$category",
                "total":  {"$sum": 1},
                "active": {"$sum": {"$cond": [{"$eq": ["$status", "Active"]}, 1, 0]}},
                "avg_reliability": {"$avg": "$reliability_score"},
            }}
        ]
        agg_results = list(col.aggregate(pipeline))
    except Exception:
        agg_results = []

    cat_counts: dict = {}
    active_in_cat: dict = {}
    avg_rel_in_cat: dict = {}
    total_vendors = 0

    for r in agg_results:
        cat = r.get("_id") or "Other"
        cat_counts[cat]       = r.get("total", 0)
        active_in_cat[cat]    = r.get("active", 0)
        avg_rel_in_cat[cat]   = round(float(r.get("avg_reliability") or 0), 1)
        total_vendors        += r.get("total", 0)

    # Restrict to exactly the 6 canonical categories
    canonical_counts   = {c: cat_counts.get(c, 0) for c in VENDOR_CATEGORIES}
    canonical_active   = {c: active_in_cat.get(c, 0) for c in VENDOR_CATEGORIES}
    canonical_avg_rel  = {c: avg_rel_in_cat.get(c, 0.0) for c in VENDOR_CATEGORIES}

    active_categories_count = sum(1 for c in VENDOR_CATEGORIES if canonical_counts.get(c, 0) > 0)
    top_cat = max(VENDOR_CATEGORIES, key=lambda c: canonical_counts.get(c, 0))
    top_label = VENDOR_CATEGORY_LABELS.get(top_cat, top_cat)

    # ── KPI Row ───────────────────────────────────────────────────────────────
    c1, c2, c3, c4 = st.columns(4)
    kpis = [
        (c1, "#172033", "Total Categories",  str(len(VENDOR_CATEGORIES))),
        (c2, "#22A06B", "Active Sectors",    str(active_categories_count)),
        (c3, "#1677E8", "Total Suppliers",   f"{total_vendors:,}"),
        (c4, "#2687F5", "Largest Sector",    top_label),
    ]
    for col_w, color, label, value in kpis:
        with col_w:
            st.markdown(
                f"""
                <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-left:4px solid {color};border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                    <div style="font-size:0.7rem;color:#7B8794;font-weight:700;text-transform:uppercase;">{label}</div>
                    <div style="font-size:1.45rem;font-weight:800;color:{color};margin-top:2px;">{value}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    st.markdown("<div style='height:0.8rem;'></div>", unsafe_allow_html=True)

    render_section_header(
        "Canonical Category Directory",
        "Exactly 6 vendor categories — supplier volume, coverage, and average reliability",
    )

    search_q = st.text_input("Filter Categories", placeholder="Search category...", key="cat_search_input")
    filtered_cats = [
        c for c in VENDOR_CATEGORIES
        if not search_q
        or search_q.lower() in c.lower()
        or search_q.lower() in VENDOR_CATEGORY_LABELS.get(c, "").lower()
    ]

    cols = st.columns(2)
    for idx, cat_key in enumerate(filtered_cats):
        col_target = cols[idx % 2]
        count       = canonical_counts.get(cat_key, 0)
        active_c    = canonical_active.get(cat_key, 0)
        avg_rel     = canonical_avg_rel.get(cat_key, 0.0)
        pct         = f"{(count / total_vendors * 100):.1f}%" if total_vendors > 0 else "0.0%"
        color       = VENDOR_CATEGORY_COLORS.get(cat_key, "#1677E8")
        label       = VENDOR_CATEGORY_LABELS.get(cat_key, cat_key)

        with col_target:
            st.markdown(
                f"""
                <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-left:4px solid {color};border-radius:10px;padding:1rem 1.25rem;margin-bottom:0.75rem;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:1rem;font-weight:700;color:#172033;">{label}</div>
                            <div style="font-size:0.73rem;color:#526174;font-weight:600;margin-top:1px;">Key: {cat_key}</div>
                            <div style="font-size:0.78rem;color:#526174;margin-top:0.3rem;">
                                Active: <strong style="color:#22A06B;">{active_c:,}</strong>
                                &bull; Total: <strong>{count:,}</strong>
                                &bull; Avg Reliability: <strong style="color:{color};">{avg_rel:.1f}%</strong>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <span style="background:#EAF3FF;color:#1677E8;padding:4px 10px;border-radius:6px;font-size:0.75rem;font-weight:700;">{pct} Share</span>
                        </div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )
