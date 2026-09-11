const API_URL = '/api/v1';

// Save JWT Token to local storage
function setToken(token) {
    localStorage.setItem('token', token);
}

// Get JWT Token from local storage
function getToken() {
    return localStorage.getItem('token');
}

// Remove JWT Token from local storage (Logout)
function removeToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_fullname');
}

// Perform login request
async function login(email, password) {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed. Please check your username/email and password.');
    }

    const data = await response.json();
    setToken(data.access_token);
    localStorage.setItem('user_role', data.role);
    localStorage.setItem('user_email', data.email);
    if (data.full_name) {
        localStorage.setItem('user_fullname', data.full_name);
    }
    
    return data;
}

// Perform registration request (No role parameter needed - assigned by backend)
async function register(email, password, fullName) {
    const payload = {
        email: email,
        password: password,
        full_name: fullName
    };

    const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed.');
    }

    return await response.json();
}

// Fetch user profile info
async function fetchUserProfile() {
    const token = getToken();
    if (!token) return null;

    const response = await fetch(`${API_URL}/auth/me`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        removeToken();
        return null;
    }

    const userData = await response.json();
    localStorage.setItem('user_role', userData.role);
    localStorage.setItem('user_email', userData.email);
    if (userData.full_name) {
        localStorage.setItem('user_fullname', userData.full_name);
    }
    return userData;
}

// Check if user is authenticated (used for route guards)
async function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = 'index.html';
        return null;
    }
    const user = await fetchUserProfile();
    if (!user) {
        window.location.href = 'index.html';
        return null;
    }
    return user;
}

// Redirect authenticated users away from login/register pages
async function redirectIfAuthenticated() {
    const token = getToken();
    if (token) {
        const user = await fetchUserProfile();
        if (user) {
            window.location.href = 'dashboard.html';
        }
    }
}

// Perform Logout
function logout() {
    removeToken();
    window.location.href = 'index.html';
}
