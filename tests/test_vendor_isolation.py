"""
tests/test_vendor_isolation.py
------------------------------
Tests for:
1. Vendor Data Isolation (Backend / Service / Database queries)
2. Vendor Sidebar Navigation Structure (MY PORTAL only)
3. Role access restrictions (Individual Vendor vs Procurement Manager vs Vendor Manager)
"""

import pytest
from unittest.mock import MagicMock, patch

from auth.permissions import (
    ROLE_VENDOR,
    ROLE_PROCUREMENT_MANAGER,
    ROLE_VENDOR_MANAGER,
    ROLE_ADMINISTRATOR,
    PAGE_DASHBOARD,
    PAGE_VENDORS,
    PAGE_VENDOR_CATEGORIES,
    PAGE_APPROVAL_QUEUE,
    PAGE_PROCUREMENT,
    PAGE_PURCHASE_ORDERS,
    PAGE_PERFORMANCE,
    PAGE_VENDOR_PORTAL,
    PAGE_COMMUNICATION,
    PAGE_RISK_ANALYSIS,
    PAGE_ANALYTICS,
    PAGE_REPORTS,
    PAGE_ADMIN,
    ACTION_CREATE_VENDOR,
    ACTION_APPROVE_VENDOR,
    has_page_access,
    has_action_permission,
    get_navigation_items,
    get_allowed_pages,
)


class TestVendorSidebarAndPageAccess:
    """Verify Vendor role sidebar and page access constraints."""

    def test_vendor_has_no_vendor_management_pages(self):
        """Vendor must NOT have access to Vendors, Approval Queue, or Categories."""
        assert not has_page_access(ROLE_VENDOR, PAGE_VENDORS)
        assert not has_page_access(ROLE_VENDOR, PAGE_APPROVAL_QUEUE)
        assert not has_page_access(ROLE_VENDOR, PAGE_VENDOR_CATEGORIES)

    def test_vendor_has_no_global_performance(self):
        """Vendor must NOT have access to global performance, risk analysis, or analytics."""
        assert not has_page_access(ROLE_VENDOR, PAGE_PERFORMANCE)
        assert not has_page_access(ROLE_VENDOR, PAGE_RISK_ANALYSIS)
        assert not has_page_access(ROLE_VENDOR, PAGE_ANALYTICS)
        assert not has_page_access(ROLE_VENDOR, PAGE_REPORTS)
        assert not has_page_access(ROLE_VENDOR, PAGE_ADMIN)

    def test_vendor_has_no_procurement_page(self):
        """Vendor must NOT have access to global procurement pipeline page."""
        assert not has_page_access(ROLE_VENDOR, PAGE_PROCUREMENT)

    def test_vendor_has_portal_access(self):
        """Vendor must have access to their own portal and orders."""
        assert has_page_access(ROLE_VENDOR, PAGE_DASHBOARD)
        assert has_page_access(ROLE_VENDOR, PAGE_VENDOR_PORTAL)
        assert has_page_access(ROLE_VENDOR, PAGE_PURCHASE_ORDERS)
        assert has_page_access(ROLE_VENDOR, PAGE_COMMUNICATION)

    def test_vendor_sidebar_sections_and_items(self):
        """Sidebar for Vendor must have MY PORTAL with Dashboard, Orders, Communication, Performance."""
        nav_items = get_navigation_items(ROLE_VENDOR)
        keys = [item["key"] for item in nav_items]

        # Allowed keys for Vendor
        assert PAGE_DASHBOARD in keys
        assert PAGE_PURCHASE_ORDERS in keys
        assert PAGE_COMMUNICATION in keys
        assert PAGE_VENDOR_PORTAL in keys

        # Disallowed keys must NOT be present
        forbidden = [
            PAGE_VENDORS,
            PAGE_APPROVAL_QUEUE,
            PAGE_VENDOR_CATEGORIES,
            PAGE_PROCUREMENT,
            PAGE_PERFORMANCE,
            PAGE_RISK_ANALYSIS,
            PAGE_ANALYTICS,
            PAGE_REPORTS,
            PAGE_ADMIN,
        ]
        for key in forbidden:
            assert key not in keys, f"Key {key} should not be in Vendor sidebar"


class TestProcurementManagerIsolation:
    """Verify Procurement Manager cannot access vendor management or overall performance."""

    def test_pm_cannot_access_vendor_management(self):
        assert not has_page_access(ROLE_PROCUREMENT_MANAGER, PAGE_VENDORS)
        assert not has_page_access(ROLE_PROCUREMENT_MANAGER, PAGE_APPROVAL_QUEUE)
        assert not has_page_access(ROLE_PROCUREMENT_MANAGER, PAGE_VENDOR_CATEGORIES)

    def test_pm_cannot_access_overall_performance(self):
        assert not has_page_access(ROLE_PROCUREMENT_MANAGER, PAGE_PERFORMANCE)

    def test_pm_cannot_create_or_approve_vendors(self):
        assert not has_action_permission(ROLE_PROCUREMENT_MANAGER, ACTION_CREATE_VENDOR)
        assert not has_action_permission(ROLE_PROCUREMENT_MANAGER, ACTION_APPROVE_VENDOR)

    def test_pm_can_access_procurement(self):
        assert has_page_access(ROLE_PROCUREMENT_MANAGER, PAGE_PROCUREMENT)
        assert has_page_access(ROLE_PROCUREMENT_MANAGER, PAGE_PURCHASE_ORDERS)


class TestVendorManagerAccess:
    """Verify Vendor Manager has vendor management & overall performance access."""

    def test_vendor_manager_has_vendor_management(self):
        assert has_page_access(ROLE_VENDOR_MANAGER, PAGE_VENDORS)
        assert has_page_access(ROLE_VENDOR_MANAGER, PAGE_APPROVAL_QUEUE)
        assert has_page_access(ROLE_VENDOR_MANAGER, PAGE_VENDOR_CATEGORIES)

    def test_vendor_manager_has_overall_performance(self):
        assert has_page_access(ROLE_VENDOR_MANAGER, PAGE_PERFORMANCE)

    def test_vendor_manager_can_create_and_approve_vendors(self):
        assert has_action_permission(ROLE_VENDOR_MANAGER, ACTION_CREATE_VENDOR)
        assert has_action_permission(ROLE_VENDOR_MANAGER, ACTION_APPROVE_VENDOR)


class TestVendorServiceDataIsolation:
    """Verify database-level isolation queries in vendor_service."""

    @patch("services.vendor_service.get_database")
    def test_get_vendor_own_purchase_orders_filters_by_vendor_id(self, mock_get_db):
        from services.vendor_service import get_vendor_own_purchase_orders

        mock_db = MagicMock()
        mock_col = MagicMock()
        mock_db.__getitem__.return_value = mock_col
        mock_get_db.return_value = mock_db
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value.limit.return_value = [{"_id": "po1", "vendor_id": "v123"}]
        mock_col.find.return_value = mock_cursor

        result = get_vendor_own_purchase_orders("v123")
        mock_col.find.assert_called_once_with({"vendor_id": "v123"})
        assert len(result) == 1

    def test_get_vendor_own_purchase_orders_empty_on_invalid_vendor_id(self):
        from services.vendor_service import get_vendor_own_purchase_orders
        assert get_vendor_own_purchase_orders("") == []
        assert get_vendor_own_purchase_orders("None") == []
        assert get_vendor_own_purchase_orders(None) == []

    @patch("services.vendor_service.get_database")
    def test_get_vendor_own_contracts_filters_by_vendor_id(self, mock_get_db):
        from services.vendor_service import get_vendor_own_contracts

        mock_db = MagicMock()
        mock_col = MagicMock()
        mock_db.__getitem__.return_value = mock_col
        mock_get_db.return_value = mock_db
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value.limit.return_value = [{"_id": "c1", "vendor_id": "v123"}]
        mock_col.find.return_value = mock_cursor

        result = get_vendor_own_contracts("v123")
        mock_col.find.assert_called_once_with({"vendor_id": "v123"})
        assert len(result) == 1

    @patch("services.vendor_service.get_database")
    def test_get_vendor_own_communications_filters_by_vendor_id(self, mock_get_db):
        from services.vendor_service import get_vendor_own_communications

        mock_db = MagicMock()
        mock_col = MagicMock()
        mock_db.__getitem__.return_value = mock_col
        mock_get_db.return_value = mock_db
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value.limit.return_value = [{"_id": "comm1", "vendor_id": "v123"}]
        mock_col.find.return_value = mock_cursor

        result = get_vendor_own_communications("v123", "u456")
        mock_col.find.assert_called_once_with({
            "$or": [
                {"vendor_id": "v123"},
                {"participants": "u456"},
            ]
        })
        assert len(result) == 1
