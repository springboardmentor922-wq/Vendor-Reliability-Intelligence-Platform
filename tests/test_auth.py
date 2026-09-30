"""
tests/test_auth.py
------------------
Authentication tests for the Vendor Reliability Intelligence Platform.
Tests: registration, login, JWT, password hashing, RBAC.

Run with: pytest tests/test_auth.py -v
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta


# ── Password Handler Tests ────────────────────────────────────────────────────

class TestPasswordHandler:
    """Tests for auth/password_handler.py"""

    def test_hash_password_produces_hash(self):
        from auth.password_handler import hash_password
        result = hash_password("SecurePass1!")
        assert result is not None
        assert result != "SecurePass1!"
        assert len(result) > 20

    def test_hash_password_never_stores_plaintext(self):
        from auth.password_handler import hash_password
        hashed = hash_password("MyPassword1@")
        assert "MyPassword1@" not in hashed

    def test_verify_password_correct(self):
        from auth.password_handler import hash_password, verify_password
        hashed = hash_password("TestPass1!")
        assert verify_password("TestPass1!", hashed) is True

    def test_verify_password_wrong(self):
        from auth.password_handler import hash_password, verify_password
        hashed = hash_password("CorrectPass1!")
        assert verify_password("WrongPass1!", hashed) is False

    def test_verify_password_empty(self):
        from auth.password_handler import hash_password, verify_password
        hashed = hash_password("RealPass1!")
        assert verify_password("", hashed) is False

    def test_password_strength_valid(self):
        from auth.password_handler import validate_password_strength
        ok, msg = validate_password_strength("StrongPass1!")
        assert ok is True

    def test_password_strength_too_short(self):
        from auth.password_handler import validate_password_strength
        ok, msg = validate_password_strength("Ab1!")
        assert ok is False
        assert "characters" in msg.lower()

    def test_password_strength_no_uppercase(self):
        from auth.password_handler import validate_password_strength
        ok, msg = validate_password_strength("weakpass1!")
        assert ok is False
        assert "uppercase" in msg.lower()

    def test_password_strength_no_digit(self):
        from auth.password_handler import validate_password_strength
        ok, msg = validate_password_strength("NoDigitPass!")
        assert ok is False
        assert "digit" in msg.lower()

    def test_password_strength_no_special(self):
        from auth.password_handler import validate_password_strength
        ok, msg = validate_password_strength("NoSpecialChar1")
        assert ok is False
        assert "special" in msg.lower()

    def test_different_hashes_for_same_password(self):
        """bcrypt should produce different salts each time."""
        from auth.password_handler import hash_password
        h1 = hash_password("SamePassword1!")
        h2 = hash_password("SamePassword1!")
        assert h1 != h2  # Different salts


# ── JWT Handler Tests ─────────────────────────────────────────────────────────

class TestJWTHandler:
    """Tests for auth/jwt_handler.py"""

    def test_create_token_returns_string(self):
        from auth.jwt_handler import create_access_token
        token = create_access_token("user123", "test@example.com", "Administrator")
        assert isinstance(token, str)
        assert len(token) > 10

    def test_decode_valid_token(self):
        from auth.jwt_handler import create_access_token, decode_access_token
        token = create_access_token("user123", "admin@test.com", "Administrator")
        payload = decode_access_token(token)
        assert payload["sub"] == "user123"
        assert payload["email"] == "admin@test.com"
        assert payload["role"] == "Administrator"

    def test_token_does_not_contain_password(self):
        from auth.jwt_handler import create_access_token
        token = create_access_token("user999", "user@test.com", "Vendor")
        # JWT is base64 — split and check no password claim
        import base64
        parts = token.split(".")
        # Payload is the second part
        padded = parts[1] + "=="
        import json
        decoded = json.loads(base64.urlsafe_b64decode(padded).decode())
        assert "password" not in decoded
        assert "password_hash" not in decoded

    def test_token_type_is_access(self):
        from auth.jwt_handler import create_access_token, decode_access_token
        token = create_access_token("u1", "x@x.com", "Auditor")
        payload = decode_access_token(token)
        assert payload["type"] == "access"

    def test_expired_token_raises_error(self):
        from auth.jwt_handler import create_access_token, decode_access_token, TokenExpiredError
        token = create_access_token(
            "u1", "x@x.com", "Vendor",
            expires_delta=timedelta(seconds=-1)  # Already expired
        )
        with pytest.raises(TokenExpiredError):
            decode_access_token(token)

    def test_invalid_token_raises_error(self):
        from auth.jwt_handler import decode_access_token, TokenInvalidError
        with pytest.raises(TokenInvalidError):
            decode_access_token("not.a.valid.jwt.token")

    def test_get_token_claims_returns_none_on_invalid(self):
        from auth.jwt_handler import get_token_claims
        result = get_token_claims("invalid-token")
        assert result is None

    def test_is_token_valid_true(self):
        from auth.jwt_handler import create_access_token, is_token_valid
        token = create_access_token("u1", "x@x.com", "Finance Officer")
        assert is_token_valid(token) is True

    def test_is_token_valid_false_for_garbage(self):
        from auth.jwt_handler import is_token_valid
        assert is_token_valid("garbage") is False

    def test_all_roles_in_token(self):
        """Each of the 6 roles should work in token creation/decoding."""
        from auth.jwt_handler import create_access_token, decode_access_token
        from auth.permissions import ALL_ROLES
        for role in ALL_ROLES:
            token = create_access_token("uid", f"{role}@test.com", role)
            payload = decode_access_token(token)
            assert payload["role"] == role


# ── Auth Service Tests (mocked MongoDB) ──────────────────────────────────────

class TestAuthService:
    """Tests for services/auth_service.py with mocked database."""

    @patch("services.auth_service.get_database")
    def test_register_user_success(self, mock_get_db):
        from services.auth_service import register_user
        mock_collection = MagicMock()
        mock_collection.find_one.return_value = None  # No existing user
        mock_collection.insert_one.return_value = MagicMock(inserted_id="fake_id_123")
        mock_get_db.return_value = {"users": mock_collection}

        ok, msg, user = register_user(
            name="Jane Doe",
            email="jane@example.com",
            password="SecurePass1!",
            confirm_password="SecurePass1!",
            role="Procurement Manager",
        )
        assert ok is True
        assert "success" in msg.lower()
        assert user is not None
        assert "password_hash" not in user

    @patch("services.auth_service.get_database")
    def test_register_duplicate_email(self, mock_get_db):
        from services.auth_service import register_user
        mock_collection = MagicMock()
        mock_collection.find_one.return_value = {"email": "jane@example.com"}
        mock_get_db.return_value = {"users": mock_collection}

        ok, msg, user = register_user(
            name="Jane Doe",
            email="jane@example.com",
            password="SecurePass1!",
            confirm_password="SecurePass1!",
            role="Vendor",
        )
        assert ok is False
        assert "already exists" in msg.lower()

    def test_register_invalid_email(self):
        from services.auth_service import register_user
        ok, msg, user = register_user(
            name="Test User",
            email="not-an-email",
            password="SecurePass1!",
            confirm_password="SecurePass1!",
            role="Auditor",
        )
        assert ok is False
        assert "email" in msg.lower()

    def test_register_password_mismatch(self):
        from services.auth_service import register_user
        ok, msg, user = register_user(
            name="Test User",
            email="test@example.com",
            password="SecurePass1!",
            confirm_password="DifferentPass1!",
            role="Auditor",
        )
        assert ok is False
        assert "match" in msg.lower()

    def test_register_weak_password(self):
        from services.auth_service import register_user
        ok, msg, user = register_user(
            name="Test User",
            email="test@example.com",
            password="weak",
            confirm_password="weak",
            role="Vendor",
        )
        assert ok is False

    def test_register_missing_fields(self):
        from services.auth_service import register_user
        ok, msg, user = register_user("", "", "", "", "")
        assert ok is False
        assert "required" in msg.lower()

    @patch("services.auth_service.get_database")
    def test_login_success(self, mock_get_db):
        from auth.password_handler import hash_password
        from services.auth_service import login_user
        from bson import ObjectId

        hashed = hash_password("SecurePass1!")
        fake_user = {
            "_id": ObjectId(),
            "email": "user@example.com",
            "name": "Test User",
            "role": "Finance Officer",
            "status": "Active",
            "password_hash": hashed,
        }
        mock_collection = MagicMock()
        mock_collection.find_one.return_value = fake_user
        mock_collection.update_one.return_value = MagicMock()
        mock_get_db.return_value = {"users": mock_collection}

        ok, msg, token, user = login_user("user@example.com", "SecurePass1!")
        assert ok is True
        assert token is not None
        assert user is not None
        assert "password_hash" not in user

    @patch("services.auth_service.get_database")
    def test_login_wrong_password(self, mock_get_db):
        from auth.password_handler import hash_password
        from services.auth_service import login_user
        from bson import ObjectId

        hashed = hash_password("CorrectPass1!")
        fake_user = {
            "_id": ObjectId(),
            "email": "user@example.com",
            "name": "Test User",
            "role": "Vendor",
            "status": "Active",
            "password_hash": hashed,
        }
        mock_collection = MagicMock()
        mock_collection.find_one.return_value = fake_user
        mock_get_db.return_value = {"users": mock_collection}

        ok, msg, token, user = login_user("user@example.com", "WrongPass1!")
        assert ok is False
        assert token is None

    @patch("services.auth_service.get_database")
    def test_login_user_not_found(self, mock_get_db):
        from services.auth_service import login_user
        mock_collection = MagicMock()
        mock_collection.find_one.return_value = None
        mock_get_db.return_value = {"users": mock_collection}

        ok, msg, token, user = login_user("nobody@example.com", "SomePass1!")
        assert ok is False
        assert token is None

    @patch("services.auth_service.get_database")
    def test_login_inactive_account(self, mock_get_db):
        from auth.password_handler import hash_password
        from services.auth_service import login_user
        from bson import ObjectId

        hashed = hash_password("SecurePass1!")
        fake_user = {
            "_id": ObjectId(),
            "email": "suspended@example.com",
            "name": "Suspended User",
            "role": "Vendor",
            "status": "Suspended",
            "password_hash": hashed,
        }
        mock_collection = MagicMock()
        mock_collection.find_one.return_value = fake_user
        mock_get_db.return_value = {"users": mock_collection}

        ok, msg, token, user = login_user("suspended@example.com", "SecurePass1!")
        assert ok is False
        assert "not active" in msg.lower()
