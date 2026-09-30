"""
tests/test_permissions.py
--------------------------
RBAC permission matrix tests.

Verifies each role's access rights — both allowed and denied.
Run with: pytest tests/test_permissions.py -v
"""

import pytest
from auth.permissions import (
    ROLE_ADMINISTRATOR, ROLE_PROCUREMENT_MANAGER, ROLE_SUPPLY_CHAIN_MANAGER,
    ROLE_VENDOR_MANAGER, ROLE_VENDOR, ROLE_FINANCE_OFFICER, ROLE_AUDITOR,
    PAGE_DASHBOARD, PAGE_VENDORS, PAGE_PROCUREMENT, PAGE_PURCHASE_ORDERS,
    PAGE_PERFORMANCE, PAGE_ANALYTICS, PAGE_REPORTS, PAGE_NOTIFICATIONS,
    PAGE_PROFILE, PAGE_ADMIN,
    ACTION_CREATE_VENDOR, ACTION_EDIT_VENDOR, ACTION_DELETE_VENDOR,
    ACTION_APPROVE_VENDOR, ACTION_VIEW_VENDORS,
    ACTION_CREATE_PR, ACTION_APPROVE_PR, ACTION_VIEW_PR,
    ACTION_CREATE_PO, ACTION_VIEW_PO, ACTION_APPROVE_PO,
    ACTION_VIEW_REPORTS, ACTION_EXPORT_REPORTS, ACTION_VIEW_ANALYTICS,
    ACTION_MANAGE_USERS, ACTION_VIEW_AUDIT_LOGS, ACTION_SYSTEM_CONFIG,
    ALL_ROLES,
    has_page_access, has_action_permission, get_allowed_pages,
    get_allowed_actions, get_navigation_items,
)


class TestAllRolesDefined:
    """All 7 required roles must exist."""

    def test_seven_roles_defined(self):
        assert len(ALL_ROLES) == 7

    def test_administrator_defined(self):
        assert ROLE_ADMINISTRATOR in ALL_ROLES

    def test_procurement_manager_defined(self):
        assert ROLE_PROCUREMENT_MANAGER in ALL_ROLES

    def test_supply_chain_manager_defined(self):
        assert ROLE_SUPPLY_CHAIN_MANAGER in ALL_ROLES

    def test_vendor_manager_defined(self):
        assert ROLE_VENDOR_MANAGER in ALL_ROLES

    def test_vendor_defined(self):
        assert ROLE_VENDOR in ALL_ROLES

    def test_finance_officer_defined(self):
        assert ROLE_FINANCE_OFFICER in ALL_ROLES

    def test_auditor_defined(self):
        assert ROLE_AUDITOR in ALL_ROLES


class TestAdministratorPermissions:
    """Administrator has full access."""

    def test_admin_access_dashboard(self):
        assert has_page_access(ROLE_ADMINISTRATOR, PAGE_DASHBOARD)

    def test_admin_access_vendors(self):
        assert has_page_access(ROLE_ADMINISTRATOR, PAGE_VENDORS)

    def test_admin_access_admin_page(self):
        assert has_page_access(ROLE_ADMINISTRATOR, PAGE_ADMIN)

    def test_admin_can_create_vendor(self):
        assert has_action_permission(ROLE_ADMINISTRATOR, ACTION_CREATE_VENDOR)

    def test_admin_can_delete_vendor(self):
        assert has_action_permission(ROLE_ADMINISTRATOR, ACTION_DELETE_VENDOR)

    def test_admin_can_manage_users(self):
        assert has_action_permission(ROLE_ADMINISTRATOR, ACTION_MANAGE_USERS)

    def test_admin_can_view_audit_logs(self):
        assert has_action_permission(ROLE_ADMINISTRATOR, ACTION_VIEW_AUDIT_LOGS)

    def test_admin_can_access_all_pages(self):
        pages = get_allowed_pages(ROLE_ADMINISTRATOR)
        required = {PAGE_DASHBOARD, PAGE_VENDORS, PAGE_PROCUREMENT, PAGE_PURCHASE_ORDERS,
                    PAGE_PERFORMANCE, PAGE_ANALYTICS, PAGE_REPORTS, PAGE_NOTIFICATIONS, PAGE_PROFILE}
        assert required.issubset(pages)


class TestVendorPermissions:
    """Vendor role has restricted access."""

    def test_vendor_cannot_access_admin(self):
        assert not has_page_access(ROLE_VENDOR, PAGE_ADMIN)

    def test_vendor_cannot_access_analytics(self):
        assert not has_page_access(ROLE_VENDOR, PAGE_ANALYTICS)

    def test_vendor_cannot_access_reports(self):
        assert not has_page_access(ROLE_VENDOR, PAGE_REPORTS)

    def test_vendor_cannot_access_procurement(self):
        assert not has_page_access(ROLE_VENDOR, PAGE_PROCUREMENT)

    def test_vendor_can_access_vendor_portal(self):
        from auth.permissions import PAGE_VENDOR_PORTAL
        assert has_page_access(ROLE_VENDOR, PAGE_VENDOR_PORTAL)

    def test_vendor_cannot_create_po(self):
        assert not has_action_permission(ROLE_VENDOR, ACTION_CREATE_PO)

    def test_vendor_cannot_approve_vendor(self):
        assert not has_action_permission(ROLE_VENDOR, ACTION_APPROVE_VENDOR)

    def test_vendor_cannot_delete_vendor(self):
        assert not has_action_permission(ROLE_VENDOR, ACTION_DELETE_VENDOR)

    def test_vendor_cannot_manage_users(self):
        assert not has_action_permission(ROLE_VENDOR, ACTION_MANAGE_USERS)

    def test_vendor_can_view_dashboard(self):
        assert has_page_access(ROLE_VENDOR, PAGE_DASHBOARD)

    def test_vendor_can_view_own_pos(self):
        assert has_action_permission(ROLE_VENDOR, ACTION_VIEW_PO)

    def test_vendor_can_access_profile(self):
        assert has_page_access(ROLE_VENDOR, PAGE_PROFILE)


class TestAuditorPermissions:
    """Auditor has read-only access."""

    def test_auditor_can_view_vendors(self):
        assert has_action_permission(ROLE_AUDITOR, ACTION_VIEW_VENDORS)

    def test_auditor_can_view_reports(self):
        assert has_action_permission(ROLE_AUDITOR, ACTION_VIEW_REPORTS)

    def test_auditor_can_export_reports(self):
        assert has_action_permission(ROLE_AUDITOR, ACTION_EXPORT_REPORTS)

    def test_auditor_can_view_audit_logs(self):
        assert has_action_permission(ROLE_AUDITOR, ACTION_VIEW_AUDIT_LOGS)

    def test_auditor_cannot_create_vendor(self):
        assert not has_action_permission(ROLE_AUDITOR, ACTION_CREATE_VENDOR)

    def test_auditor_cannot_approve_pr(self):
        assert not has_action_permission(ROLE_AUDITOR, ACTION_APPROVE_PR)

    def test_auditor_cannot_create_po(self):
        assert not has_action_permission(ROLE_AUDITOR, ACTION_CREATE_PO)

    def test_auditor_cannot_manage_users(self):
        assert not has_action_permission(ROLE_AUDITOR, ACTION_MANAGE_USERS)

    def test_auditor_cannot_access_admin(self):
        assert not has_page_access(ROLE_AUDITOR, PAGE_ADMIN)


class TestFinanceOfficerPermissions:
    """Finance Officer can view procurement and financial data."""

    def test_finance_can_view_po(self):
        assert has_action_permission(ROLE_FINANCE_OFFICER, ACTION_VIEW_PO)

    def test_finance_can_view_reports(self):
        assert has_action_permission(ROLE_FINANCE_OFFICER, ACTION_VIEW_REPORTS)

    def test_finance_can_export_reports(self):
        assert has_action_permission(ROLE_FINANCE_OFFICER, ACTION_EXPORT_REPORTS)

    def test_finance_cannot_create_vendor(self):
        assert not has_action_permission(ROLE_FINANCE_OFFICER, ACTION_CREATE_VENDOR)

    def test_finance_cannot_approve_vendor(self):
        assert not has_action_permission(ROLE_FINANCE_OFFICER, ACTION_APPROVE_VENDOR)

    def test_finance_cannot_manage_users(self):
        assert not has_action_permission(ROLE_FINANCE_OFFICER, ACTION_MANAGE_USERS)


class TestProcurementManagerPermissions:
    """Procurement Manager has procurement access but no vendor management."""

    def test_pm_cannot_create_vendor(self):
        assert not has_action_permission(ROLE_PROCUREMENT_MANAGER, ACTION_CREATE_VENDOR)

    def test_pm_cannot_approve_vendor(self):
        assert not has_action_permission(ROLE_PROCUREMENT_MANAGER, ACTION_APPROVE_VENDOR)

    def test_pm_can_create_po(self):
        assert has_action_permission(ROLE_PROCUREMENT_MANAGER, ACTION_CREATE_PO)

    def test_pm_can_approve_pr(self):
        assert has_action_permission(ROLE_PROCUREMENT_MANAGER, ACTION_APPROVE_PR)

    def test_pm_cannot_manage_users(self):
        assert not has_action_permission(ROLE_PROCUREMENT_MANAGER, ACTION_MANAGE_USERS)

    def test_pm_cannot_access_admin(self):
        assert not has_page_access(ROLE_PROCUREMENT_MANAGER, PAGE_ADMIN)


class TestNavigationItems:
    """Navigation menu should reflect role permissions."""

    def test_nav_items_only_include_allowed_pages(self):
        for role in ALL_ROLES:
            nav = get_navigation_items(role)
            allowed = get_allowed_pages(role)
            for item in nav:
                assert item["key"] in allowed, (
                    f"Role {role}: nav item '{item['key']}' not in allowed pages"
                )

    def test_admin_sees_most_nav_items(self):
        nav = get_navigation_items(ROLE_ADMINISTRATOR)
        assert len(nav) >= 8

    def test_vendor_sees_fewer_nav_items(self):
        nav_vendor = get_navigation_items(ROLE_VENDOR)
        nav_admin = get_navigation_items(ROLE_ADMINISTRATOR)
        assert len(nav_vendor) < len(nav_admin)

    def test_each_nav_item_has_required_keys(self):
        for role in ALL_ROLES:
            nav = get_navigation_items(role)
            for item in nav:
                assert "key" in item
                assert "label" in item
                assert "icon" in item

    def test_unknown_role_returns_empty_pages(self):
        pages = get_allowed_pages("NonExistentRole")
        assert len(pages) == 0

    def test_has_page_access_false_for_unknown_role(self):
        assert not has_page_access("FakeRole", PAGE_DASHBOARD)

    def test_has_action_permission_false_for_unknown_role(self):
        assert not has_action_permission("FakeRole", ACTION_CREATE_VENDOR)
