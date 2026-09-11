def test_seeded_roles_login(client):
    # Login with seeded admin account
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "admin@vendoriq.com",
            "password": "admin123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "Administrator"
    assert data["email"] == "admin@vendoriq.com"
    assert data["token_type"] == "bearer"
    assert "access_token" in data

    # Login with seeded vendor account
    vendor_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "vendor@vendoriq.com",
            "password": "vendor123"
        }
    )
    assert vendor_response.status_code == 200
    v_data = vendor_response.json()
    assert v_data["role"] == "Vendor"

def test_register_user_without_role(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "testpassword",
            "full_name": "New User Without Role"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New User Without Role"
    assert data["role"] == "Procurement Manager"
    assert "id" in data

def test_register_duplicate_user(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "anotherpassword",
            "full_name": "Duplicate"
        }
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "The user with this email already exists in the system"

def test_login_success(client):
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "newuser@example.com",
            "password": "testpassword"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "Procurement Manager"
    assert data["email"] == "newuser@example.com"

def test_login_fail(client):
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "newuser@example.com",
            "password": "wrongpassword"
        }
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect email or password"

def test_get_me(client):
    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "newuser@example.com",
            "password": "testpassword"
        }
    )
    token = login_response.json()["access_token"]

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["role"] == "Procurement Manager"
