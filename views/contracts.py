"""
views/contracts.py
------------------
Contract Management page — full MongoDB-backed CRUD for Milestone 2.
Deep Navy #172033 + Muted Gold #B08D57 theme. Expiring Soon status. Zero emoji.
"""

import streamlit as st
from datetime import datetime, date, timezone
from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state
from components.tables import render_status_badge
from auth.session import get_current_user, get_current_role
from auth.permissions import (
    has_action_permission,
    ACTION_CREATE_CONTRACT,
    ACTION_EDIT_CONTRACT,
)
from services.contract_service import (
    create_contract, get_all_contracts, get_contract_stats,
    get_total_contract_value, update_contract_status,
    delete_contract, expire_overdue_contracts,
)
from services.vendor_service import get_all_vendors, get_vendor_name_map
from config.settings import (
    CONTRACT_STATUS_OPTIONS, CONTRACT_TYPE_OPTIONS, CONTRACT_COMPLIANCE_STATUS,
)
from utils.helpers import format_currency


def _days_until(dt) -> str:
    """Days until a future datetime."""
    if not dt:
        return "N/A"
    try:
        if isinstance(dt, datetime):
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            delta = (dt - datetime.now(timezone.utc)).days
        else:
            delta = (dt - date.today()).days
        if delta < 0:
            return f"Expired {abs(delta)}d ago"
        if delta == 0:
            return "Expires today"
        return f"{delta} days"
    except Exception:
        return "N/A"


def render_contracts_page() -> None:
    """Render the Contracts & Compliance Management page."""
    render_page_header(
        "Contracts & Agreements",
        "Repository of active master service agreements, renewals, compliance certifications, and legal documentation.",
    )

    user = get_current_user() or {}
    role = get_current_role()
    user_id = str(user.get("_id", ""))

    try:
        expire_overdue_contracts()
    except Exception:
        pass

    # ── KPI Cards ─────────────────────────────────────────────────────────────
    stats = get_contract_stats()
    total_val = get_total_contract_value()

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.markdown(
            f'''
            <div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid #172033;border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">
                <div style="font-size:0.7rem;color:#68707C;font-weight:700;text-transform:uppercase;">Active Contracts</div>
                <div style="font-size:1.65rem;font-weight:800;color:#20242A;margin-top:2px;">{stats.get('active', 0)}</div>
            </div>
            ''',
            unsafe_allow_html=True,
        )
    with col2:
        st.markdown(
            f'''
            <div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid #B08D57;border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">
                <div style="font-size:0.7rem;color:#68707C;font-weight:700;text-transform:uppercase;">Total Portfolio Value</div>
                <div style="font-size:1.65rem;font-weight:800;color:#B08D57;margin-top:2px;">{format_currency(total_val)}</div>
            </div>
            ''',
            unsafe_allow_html=True,
        )
    with col3:
        st.markdown(
            f'''
            <div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid #A67C32;border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">
                <div style="font-size:0.7rem;color:#68707C;font-weight:700;text-transform:uppercase;">Expiring in 60 Days</div>
                <div style="font-size:1.65rem;font-weight:800;color:#20242A;margin-top:2px;">{stats.get('expiring_soon', 0)}</div>
            </div>
            ''',
            unsafe_allow_html=True,
        )
    with col4:
        st.markdown(
            f'''
            <div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid #8B3038;border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">
                <div style="font-size:0.7rem;color:#68707C;font-weight:700;text-transform:uppercase;">Non-Compliant</div>
                <div style="font-size:1.65rem;font-weight:800;color:#20242A;margin-top:2px;">{stats.get('non_compliant', 0)}</div>
            </div>
            ''',
            unsafe_allow_html=True,
        )

    st.markdown("<div style='margin-bottom:0.8rem;'></div>", unsafe_allow_html=True)

    # ── Tabs ──────────────────────────────────────────────────────────────────
    tab_labels = ["All Contracts", "Expiring Soon"]
    if has_action_permission(role, ACTION_CREATE_CONTRACT):
        tab_labels.append("New Contract")

    tabs = st.tabs(tab_labels)
    vendor_names = get_vendor_name_map()
    vendors_list = get_all_vendors(limit=100)

    # ── Tab 1: All Contracts ──────────────────────────────────────────────────
    with tabs[0]:
        col_f1, col_f2, col_f3 = st.columns(3)
        with col_f1:
            status_f = st.selectbox("Status", ["All"] + CONTRACT_STATUS_OPTIONS, key="contracts_status_filter")
        with col_f2:
            vendor_opts = {"All Suppliers": None}
            for v in vendors_list:
                v_lbl = v.get("company_name") or v.get("supplier_id") or "Unknown"
                vendor_opts[v_lbl] = str(v.get("_id", ""))
            selected_vendor = st.selectbox("Supplier", list(vendor_opts.keys()), key="contracts_vendor_filter")
        with col_f3:
            compliance_f = st.selectbox("Compliance", ["All"] + CONTRACT_COMPLIANCE_STATUS, key="contracts_compliance_filter")

        contracts = get_all_contracts(
            status=None if status_f == "All" else status_f,
            vendor_id=vendor_opts.get(selected_vendor),
            compliance_status=None if compliance_f == "All" else compliance_f,
        )

        if not contracts:
            render_empty_state("No Contracts Found", "No contracts match your current filter criteria.")
        else:
            render_section_header(f"Contract Agreements ({len(contracts)} records)")

            for c in contracts:
                c_id = str(c.get("_id", ""))
                c_num = c.get("contract_number", "N/A")
                vendor_id = c.get("vendor_id", "")
                v_name = vendor_names.get(vendor_id, "Supplier")
                c_title = c.get("title", "Untitled Agreement")
                c_status = c.get("status", "Draft")
                c_compliance = c.get("compliance_status", "Compliant")
                c_value = c.get("contract_value", 0)
                c_type = c.get("contract_type", "Agreement")
                end_date = c.get("end_date")
                expiry_str = _days_until(end_date)

                with st.expander(f"{c_num}  |  {v_name}  |  {c_title}  |  USD {c_value:,.2f}"):
                    col_main, col_actions = st.columns([3, 1])

                    with col_main:
                        st.markdown(
                            f'<div style="display:flex;gap:8px;margin-bottom:0.5rem;">'
                            f'{render_status_badge(c_status)} {render_status_badge(c_compliance)}'
                            f'</div>',
                            unsafe_allow_html=True,
                        )
                        r1, r2 = st.columns(2)
                        with r1:
                            st.markdown(f"**Contract Title:** {c_title}")
                            st.markdown(f"**Supplier:** {v_name}")
                            st.markdown(f"**Agreement Type:** {c_type}")
                        with r2:
                            st.markdown(f"**Total Valuation:** {format_currency(c_value)}")
                            st.markdown(f"**Expiry Countdown:** `{expiry_str}`")

                        if c.get("description"):
                            st.markdown(f"**Scope / Notes:** {c['description']}")

                    if has_action_permission(role, ACTION_EDIT_CONTRACT):
                        with col_actions:
                            new_status = st.selectbox(
                                "Status Update",
                                CONTRACT_STATUS_OPTIONS,
                                index=CONTRACT_STATUS_OPTIONS.index(c_status) if c_status in CONTRACT_STATUS_OPTIONS else 0,
                                key=f"c_status_{c_id}",
                            )
                            if st.button("Save", key=f"c_btn_{c_id}", type="primary", use_container_width=True):
                                ok, msg = update_contract_status(c_id, new_status, user_id)
                                if ok:
                                    st.success(msg)
                                    st.rerun()

                            if st.button("Terminate", key=f"c_del_{c_id}", use_container_width=True):
                                ok, msg = delete_contract(c_id, user_id)
                                if ok:
                                    st.warning(msg)
                                    st.rerun()

    # ── Tab 2: Expiring Soon ──────────────────────────────────────────────────
    with tabs[1]:
        render_section_header("Agreements Expiring Within 60 Days", "Action required for renewals and negotiations")
        expiring = get_all_contracts(expiring_within_days=60)
        if not expiring:
            render_empty_state("No Contracts Expiring Soon", "All active contracts have safe validity windows exceeding 60 days.")
        else:
            for c in expiring:
                v_name = vendor_names.get(c.get("vendor_id", ""), "Supplier")
                c_num = c.get("contract_number", "N/A")
                c_title = c.get("title", "Untitled Agreement")
                expiry = _days_until(c.get("end_date"))

                st.markdown(
                    f'''
                    <div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid #B08D57;border-radius:8px;padding:0.75rem 1rem;margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:0.88rem;font-weight:700;color:#20242A;">{c_num} &bull; {c_title}</div>
                            <div style="font-size:0.78rem;color:#68707C;margin-top:2px;">Supplier: {v_name}</div>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:0.88rem;font-weight:700;color:#B08D57;">{expiry}</span>
                        </div>
                    </div>
                    ''',
                    unsafe_allow_html=True,
                )

    # ── Tab 3: New Contract ───────────────────────────────────────────────────
    if has_action_permission(role, ACTION_CREATE_CONTRACT) and len(tabs) > 2:
        with tabs[2]:
            render_section_header("Create New Contract Agreement")

            if not vendors_list:
                st.warning("No suppliers available to link agreements.")
            else:
                with st.form("new_contract_form"):
                    v_options = {
                        f"{v.get('company_name') or v.get('supplier_id')} ({v.get('vendor_code', '')})": str(v.get("_id", ""))
                        for v in vendors_list
                    }

                    c1, c2 = st.columns(2)
                    with c1:
                        sel_v = st.selectbox("Designated Supplier *", list(v_options.keys()), key="c_v_sel")
                        title = st.text_input("Contract Title *", placeholder="Master Services Agreement 2026", key="c_title_input")
                        c_type = st.selectbox("Contract Type", CONTRACT_TYPE_OPTIONS, key="c_type_input")
                    with c2:
                        val = st.number_input("Total Contract Value (USD) *", min_value=0.0, step=1000.0, key="c_val_input")
                        comp = st.selectbox("Initial Compliance Status", CONTRACT_COMPLIANCE_STATUS, key="c_comp_input")
                        auto_ren = st.checkbox("Auto-Renew Agreement", key="c_auto_ren")

                    c3, c4 = st.columns(2)
                    with c3:
                        s_date = st.date_input("Start Date", value=date.today(), key="c_sdate")
                    with c4:
                        e_date = st.date_input("End Date", value=date.today().replace(year=date.today().year + 1), key="c_edate")

                    desc = st.text_area("Scope of Work / Deliverables", key="c_desc", height=70)

                    submitted = st.form_submit_button("Create & Register Contract", type="primary", use_container_width=True)
                    if submitted:
                        if not title.strip():
                            st.error("Contract title is required.")
                        elif e_date <= s_date:
                            st.error("End date must be after start date.")
                        else:
                            s_dt = datetime.combine(s_date, datetime.min.time()).replace(tzinfo=timezone.utc)
                            e_dt = datetime.combine(e_date, datetime.min.time()).replace(tzinfo=timezone.utc)
                            ok, msg, _ = create_contract(
                                vendor_id=v_options[sel_v],
                                title=title.strip(),
                                start_date=s_dt,
                                end_date=e_dt,
                                contract_value=val,
                                created_by=user_id,
                                compliance_status=comp,
                                contract_type=c_type,
                                description=desc.strip(),
                                auto_renew=auto_ren,
                            )
                            if ok:
                                st.success(msg)
                                st.rerun()
                            else:
                                st.error(msg)
