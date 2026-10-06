import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database.connection import get_db
from app.database.base import Base

# Create in-memory SQLite database for unit tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_registration_success():
    payload = {
        "full_name": "Test Manager",
        "email": "manager@example.com",
        "password": "securepassword123",
        "role": "PROCUREMENT_MANAGER"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "manager@example.com"
    assert data["full_name"] == "Test Manager"
    assert data["role"] == "PROCUREMENT_MANAGER"
    assert data["is_active"] is True
    assert "password" not in data
    assert "password_hash" not in data


def test_duplicate_email_registration_fails():
    payload = {
        "full_name": "Test Manager",
        "email": "duplicate@example.com",
        "password": "securepassword123",
        "role": "PROCUREMENT_MANAGER"
    }
    res1 = client.post("/api/auth/register", json=payload)
    assert res1.status_code == 201

    # Attempt to register with same email
    res2 = client.post("/api/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"].lower()


def test_invalid_login_fails():
    # Attempt login for non-existent user
    res = client.post("/api/auth/login", json={"email": "nonexistent@example.com", "password": "wrongpassword"})
    assert res.status_code == 401

    # Register user then try wrong password
    client.post("/api/auth/register", json={
        "full_name": "Vendor User",
        "email": "vendor@example.com",
        "password": "correctpassword123",
        "role": "VENDOR"
    })

    res2 = client.post("/api/auth/login", json={"email": "vendor@example.com", "password": "wrongpassword"})
    assert res2.status_code == 401


def test_valid_login_returns_jwt():
    client.post("/api/auth/register", json={
        "full_name": "Supply Manager",
        "email": "supply@example.com",
        "password": "mypassword123",
        "role": "SUPPLY_CHAIN_MANAGER"
    })

    login_res = client.post("/api/auth/login", json={"email": "supply@example.com", "password": "mypassword123"})
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "supply@example.com"


def test_protected_me_endpoint():
    # Register and login
    client.post("/api/auth/register", json={
        "full_name": "Auditor User",
        "email": "auditor@example.com",
        "password": "auditorpassword123",
        "role": "AUDITOR"
    })

    login_res = client.post("/api/auth/login", json={"email": "auditor@example.com", "password": "auditorpassword123"})
    token = login_res.json()["access_token"]

    # Call /me without token -> should fail
    unauth_res = client.get("/api/auth/me")
    assert unauth_res.status_code == 401

    # Call /me with valid Bearer token -> should succeed
    auth_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert auth_res.status_code == 200
    me_data = auth_res.json()
    assert me_data["email"] == "auditor@example.com"
    assert me_data["role"] == "AUDITOR"
