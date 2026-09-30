"""
tests/test_database.py
----------------------
Database connection and schema tests.

Run with: pytest tests/test_database.py -v
"""

import pytest
from unittest.mock import patch, MagicMock, call


class TestDatabaseConnection:
    """Tests for database/connection.py"""

    @patch("database.connection.MongoClient")
    def test_get_client_creates_singleton(self, mock_mongo):
        """get_client() should return the same instance on repeated calls."""
        import database.connection as db_module
        # Reset singleton for clean test
        db_module._client = None
        db_module._database = None

        mock_instance = MagicMock()
        mock_mongo.return_value = mock_instance
        mock_instance.admin.command.return_value = {"ok": 1}

        c1 = db_module.get_client()
        c2 = db_module.get_client()
        assert c1 is c2
        assert mock_mongo.call_count == 1

        # Cleanup
        db_module._client = None
        db_module._database = None

    @patch("database.connection.MongoClient")
    def test_get_database_returns_correct_db(self, mock_mongo):
        import database.connection as db_module
        from config.settings import MONGODB_DATABASE

        db_module._client = None
        db_module._database = None

        mock_client = MagicMock()
        mock_mongo.return_value = mock_client
        mock_client.admin.command.return_value = {"ok": 1}
        mock_db = MagicMock()
        mock_client.__getitem__.return_value = mock_db

        db = db_module.get_database()
        mock_client.__getitem__.assert_called_with(MONGODB_DATABASE)

        db_module._client = None
        db_module._database = None

    @patch("database.connection.MongoClient")
    def test_check_connection_connected(self, mock_mongo):
        import database.connection as db_module
        db_module._client = None
        db_module._database = None

        mock_client = MagicMock()
        mock_mongo.return_value = mock_client
        mock_client.admin.command.return_value = {"ok": 1}

        result = db_module.check_connection()
        assert result["status"] == "connected"

        db_module._client = None
        db_module._database = None

    @patch("database.connection.MongoClient")
    def test_check_connection_disconnected(self, mock_mongo):
        import database.connection as db_module
        from pymongo.errors import ServerSelectionTimeoutError

        db_module._client = None
        db_module._database = None

        mock_mongo.side_effect = ServerSelectionTimeoutError("Timeout")

        result = db_module.check_connection()
        assert result["status"] == "disconnected"
        assert "error" in result

        db_module._client = None
        db_module._database = None


class TestIndexCreation:
    """Tests for database/indexes.py"""

    def test_create_all_indexes_returns_dict(self):
        """create_all_indexes should return a dict with collection names as keys."""
        from database.indexes import create_all_indexes
        mock_db = MagicMock()

        # Each collection mock needs a create_index method
        mock_collection = MagicMock()
        mock_db.__getitem__.return_value = mock_collection

        result = create_all_indexes(mock_db)

        assert isinstance(result, dict)
        assert len(result) == 10  # 10 collections (including invoices)

    def test_create_all_indexes_covers_required_collections(self):
        """Verify all required collections get indexed."""
        from database.indexes import create_all_indexes
        from config.settings import (
            COLLECTION_USERS, COLLECTION_VENDORS, COLLECTION_PURCHASE_ORDERS,
            COLLECTION_CONTRACTS, COLLECTION_PROCUREMENT_REQUESTS
        )
        mock_db = MagicMock()
        mock_db.__getitem__.return_value = MagicMock()

        result = create_all_indexes(mock_db)

        assert COLLECTION_USERS in result
        assert COLLECTION_VENDORS in result
        assert COLLECTION_PURCHASE_ORDERS in result
        assert COLLECTION_CONTRACTS in result
        assert COLLECTION_PROCUREMENT_REQUESTS in result

    def test_users_email_index_is_unique(self):
        """users.email must have a unique index."""
        from database.indexes import create_all_indexes
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_db.__getitem__.return_value = mock_collection

        create_all_indexes(mock_db)

        # Check that create_index was called with unique=True on users collection
        calls = mock_collection.create_index.call_args_list
        unique_calls = [c for c in calls if c.kwargs.get("unique", False)]
        assert len(unique_calls) > 0


class TestUserModel:
    """Tests for models/user.py"""

    def test_user_to_mongo_doc_includes_required_fields(self):
        from models.user import User
        user = User(
            name="Test User",
            email="test@example.com",
            password_hash="$2b$12$fakehash",
            role="Auditor",
        )
        doc = user.to_mongo_doc()
        assert "name" in doc
        assert "email" in doc
        assert "password_hash" in doc
        assert "role" in doc
        assert "status" in doc
        assert "created_at" in doc

    def test_user_to_safe_dict_excludes_password_hash(self):
        from models.user import User
        user = User(
            name="Safe User",
            email="safe@example.com",
            password_hash="$2b$12$supersecret",
            role="Vendor",
        )
        safe = user.to_safe_dict()
        assert "password_hash" not in safe
        assert "name" in safe
        assert "email" in safe

    def test_user_from_mongo_converts_objectid(self):
        from models.user import user_from_mongo
        from bson import ObjectId

        doc = {
            "_id": ObjectId(),
            "name": "John",
            "email": "john@test.com",
            "role": "Administrator",
            "password_hash": "hashed",
        }
        result = user_from_mongo(doc)
        assert isinstance(result["_id"], str)
        assert "password_hash" not in result


class TestVendorModel:
    """Tests for models/vendor.py"""

    def test_vendor_default_status_is_pending(self):
        from models.vendor import Vendor
        v = Vendor(
            vendor_code="VND-2024-TEST",
            company_name="Test Corp",
            category="IT & Technology",
        )
        assert v.status == "Pending"
        assert v.approval_status == "Pending"

    def test_vendor_to_mongo_doc_has_timestamps(self):
        from models.vendor import Vendor
        v = Vendor(
            vendor_code="VND-2024-T001",
            company_name="Test Corp",
            category="Manufacturing",
        )
        doc = v.to_mongo_doc()
        assert "created_at" in doc
        assert "updated_at" in doc


class TestHelpers:
    """Tests for utils/helpers.py"""

    def test_generate_vendor_code_format(self):
        from utils.helpers import generate_vendor_code
        import re
        code = generate_vendor_code()
        assert re.match(r"VND-\d{4}-[A-Z0-9]{4}", code)

    def test_generate_po_number_format(self):
        from utils.helpers import generate_po_number
        import re
        po = generate_po_number()
        assert po.startswith("PO-")
        assert len(po) > 10

    def test_generate_request_number_format(self):
        from utils.helpers import generate_request_number
        pr = generate_request_number()
        assert pr.startswith("PR-")

    def test_format_currency(self):
        from utils.helpers import format_currency
        result = format_currency(1234567.89, "USD")
        assert "USD" in result
        assert "1,234,567.89" in result

    def test_get_status_color_returns_string(self):
        from utils.helpers import get_status_color
        assert get_status_color("Active") == "#3F6B4F"
        assert get_status_color("Suspended") == "#8B3038"
        assert get_status_color("Unknown Status") == "#68707C"


class TestValidators:
    """Tests for utils/validators.py"""

    def test_valid_email(self):
        from utils.validators import validate_email_format
        assert validate_email_format("user@example.com") is True
        assert validate_email_format("user.name+tag@company.org") is True

    def test_invalid_email(self):
        from utils.validators import validate_email_format
        assert validate_email_format("not-an-email") is False
        assert validate_email_format("@nodomain") is False
        assert validate_email_format("") is False
        assert validate_email_format(None) is False

    def test_validate_required_passes(self):
        from utils.validators import validate_required
        ok, msg = validate_required("some value", "Field")
        assert ok is True

    def test_validate_required_fails_empty(self):
        from utils.validators import validate_required
        ok, msg = validate_required("", "Name")
        assert ok is False
        assert "Name" in msg

    def test_validate_positive_number(self):
        from utils.validators import validate_positive_number
        ok, _ = validate_positive_number(10.5)
        assert ok is True
        ok, _ = validate_positive_number(0)
        assert ok is False
        ok, _ = validate_positive_number(-5)
        assert ok is False
