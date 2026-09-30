"""
views/register_vendor.py
------------------------
Standalone "Register Vendor" page for the Vendor Manager role.

Workflow:
  1. Vendor Manager fills form → vendor created with approval_status = "Pending"
  2. Vendor appears in the Approve Vendor queue
  3. Vendor Manager reviews and APPROVES or REJECTS
  4. Only approved vendors become active and receive login credentials

Access:  Vendor Manager · Administrator
Denied:  All other roles (enforced in view + RBAC)

Categories:  Exactly the 6 canonical categories (human-readable labels shown,
             canonical keys stored in DB for RBAC isolation).
"""

import streamlit as st
from components.navbar import render_page_header
from components.cards import render_section_header
from auth.session import get_current_user, get_current_role
from auth.permissions import (
    has_action_permission,
    ACTION_CREATE_VENDOR,
    ROLE_VENDOR,
    ROLE_PROCUREMENT_MANAGER,
)
from services.vendor_service import (
    create_vendor,
    get_vendor_stats,
)
from config.settings import (
    VENDOR_CATEGORIES,
    VENDOR_CATEGORY_LABELS,
    VENDOR_CATEGORY_COLORS,
)


# ── Category display options (show human-readable labels in form) ─────────────
_CAT_OPTIONS = [(k, VENDOR_CATEGORY_LABELS.get(k, k)) for k in VENDOR_CATEGORIES]
_CAT_KEYS    = [k for k, _ in _CAT_OPTIONS]
_CAT_LABELS  = [v for _, v in _CAT_OPTIONS]


def render_register_vendor_page() -> None:
    """Render the standalone vendor registration form."""
    user = get_current_user() or {}
    role = get_current_role()
    user_id = str(user.get("_id", ""))

    # ── Hard access guard ─────────────────────────────────────────────────────
    if role in (ROLE_VENDOR, ROLE_PROCUREMENT_MANAGER):
        st.error("You do not have permission to register vendors.")
        return
    if not has_action_permission(role, ACTION_CREATE_VENDOR):
        st.error("Your role does not have vendor creation permissions.")
        return

    render_page_header(
        "Register Vendor",
        "Onboard a new vendor. The vendor will be placed in Pending status and "
        "must be approved before gaining system access.",
    )

    # ── KPI strip ─────────────────────────────────────────────────────────────
    try:
        stats = get_vendor_stats()
    except Exception:
        stats = {}

    c1, c2, c3 = st.columns(3)
    for col, label, val, color in [
        (c1, "Total Vendors",    f"{stats.get('total', 0):,}",            "#172033"),
        (c2, "Pending Approval", f"{stats.get('pending_approval', 0):,}", "#B08D57"),
        (c3, "Active Vendors",   f"{stats.get('active', 0):,}",           "#2D6A4A"),
    ]:
        with col:
            st.markdown(
                f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {color};'
                f'border-radius:10px;padding:0.8rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
                f'<div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">{label}</div>'
                f'<div style="font-size:1.5rem;font-weight:800;color:{color};margin-top:2px;">{val}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

    st.markdown("<div style='height:1rem;'></div>", unsafe_allow_html=True)

    # ── Workflow banner ───────────────────────────────────────────────────────
    st.markdown(
        """
        <div style="background:#F0F7FF;border:1px solid #BDD7F7;border-radius:10px;
                    padding:0.8rem 1.2rem;margin-bottom:1.2rem;display:flex;gap:1rem;align-items:center;">
            <div style="font-size:0.82rem;color:#1D4E8F;line-height:1.6;">
                <strong>Registration Workflow:</strong>&nbsp;
                Fill form &rarr; Vendor created (Status: <strong>Pending Approval</strong>)
                &rarr; Review in <strong>Approve Vendor</strong>
                &rarr; Approve / Reject &rarr; Approved vendors become Active.
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    render_section_header(
        "New Vendor Registration Form",
        "All fields marked * are required. Category determines RBAC isolation for the vendor portal.",
    )

    # ── Registration form ─────────────────────────────────────────────────────
    with st.form("register_vendor_form", clear_on_submit=True):

        # Row 1: Company + Category
        fc1, fc2 = st.columns(2)
        with fc1:
            vendor_name = st.text_input(
                "Vendor / Company Name *",
                placeholder="e.g. AlphaSteel Supplies Ltd.",
                key="rv_name",
            )
        with fc2:
            cat_idx = st.selectbox(
                "Vendor Category *",
                options=list(range(len(_CAT_LABELS))),
                format_func=lambda i: _CAT_LABELS[i],
                key="rv_cat",
            )

        # Row 2: Contact name + email
        fc3, fc4 = st.columns(2)
        with fc3:
            contact_name = st.text_input(
                "Primary Contact Name *",
                placeholder="e.g. Rajesh Kumar",
                key="rv_contact",
            )
        with fc4:
            contact_email = st.text_input(
                "Contact Email *",
                placeholder="e.g. contact@alphasteel.com",
                key="rv_email",
            )

        # Row 3: Phone + Payment terms
        fc5, fc6 = st.columns(2)
        with fc5:
            contact_phone = st.text_input(
                "Contact Phone",
                placeholder="e.g. +91 98765 43210",
                key="rv_phone",
            )
        with fc6:
            payment_terms = st.selectbox(
                "Payment Terms",
                ["Net 30", "Net 45", "Net 60", "Net 90", "Immediate"],
                key="rv_payment",
            )

        # Row 4: Tax ID + Website
        fc7, fc8 = st.columns(2)
        with fc7:
            tax_id = st.text_input(
                "Tax ID / GST / VAT Number",
                placeholder="e.g. GSTIN27AABCU9603R1ZX",
                key="rv_tax",
            )
        with fc8:
            website = st.text_input(
                "Website",
                placeholder="https://www.example.com",
                key="rv_web",
            )

        # Row 5: Address
        st.markdown(
            "<div style='font-size:0.82rem;font-weight:700;color:#172033;margin:0.5rem 0 0.3rem;'>"
            "Registered Address</div>",
            unsafe_allow_html=True,
        )
        fa1, fa2, fa3 = st.columns(3)
        with fa1:
            street = st.text_input("Street / Area", placeholder="e.g. 42 Industrial Zone", key="rv_street")
        with fa2:
            city = st.text_input("City *", placeholder="e.g. Mumbai", key="rv_city")
        with fa3:
            country = st.text_input("Country", value="India", key="rv_country")

        # Description
        description = st.text_area(
            "Operational Scope / Notes",
            placeholder="Briefly describe the vendor's products, services, or specialisation...",
            height=80,
            key="rv_desc",
        )

        # Duplicate guard info
        st.markdown(
            "<div style='font-size:0.72rem;color:#68707C;margin-top:0.3rem;'>"
            "The system checks for duplicate email addresses before creating the vendor record.</div>",
            unsafe_allow_html=True,
        )

        submitted = st.form_submit_button(
            "Register Vendor (Pending Approval)",
            type="primary",
            use_container_width=True,
        )

    # ── Handle submission ─────────────────────────────────────────────────────
    if submitted:
        # Basic validation
        errors = []
        if not vendor_name.strip():
            errors.append("Vendor / Company Name is required.")
        if not contact_name.strip():
            errors.append("Primary Contact Name is required.")
        if not contact_email.strip() or "@" not in contact_email:
            errors.append("A valid Contact Email is required.")
        if not city.strip():
            errors.append("City is required.")

        if errors:
            for e in errors:
                st.error(e)
        else:
            selected_cat_key = _CAT_KEYS[cat_idx]

            ok, msg, doc = create_vendor(
                company_name=vendor_name.strip(),
                category=selected_cat_key,
                contact_information={
                    "primary_contact_name": contact_name.strip(),
                    "primary_email":        contact_email.strip().lower(),
                    "primary_phone":        contact_phone.strip(),
                    "website":              website.strip(),
                },
                address={
                    "street":  street.strip(),
                    "city":    city.strip(),
                    "country": country.strip(),
                },
                created_by=user_id,
                tax_id=tax_id.strip() or None,
                payment_terms=payment_terms,
                description=description.strip(),
                # Ensure new vendors start as Pending — never auto-activate
                approval_status="Pending",
                status="Pending",
            )

            if ok:
                cat_label = VENDOR_CATEGORY_LABELS.get(selected_cat_key, selected_cat_key)
                st.success(
                    f"✓ Vendor **{vendor_name.strip()}** registered successfully under "
                    f"**{cat_label}**. Status: **Pending Approval**. "
                    f"Go to **Approve Vendor** to review and activate."
                )
                # Invalidate vendor stats cache so KPIs reflect the new record
                try:
                    from services.cache_service import get_cached_vendor_stats
                    get_cached_vendor_stats.clear()
                except Exception:
                    pass
            else:
                st.error(f"Registration failed: {msg}")
