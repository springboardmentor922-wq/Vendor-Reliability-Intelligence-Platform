import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Register.css";

const ROLES = [
  { value: "vendor", label: "Vendor" },
  { value: "procurement_manager", label: "Procurement Manager" },
  { value: "supply_chain_manager", label: "Supply Chain Manager" },
  { value: "finance_officer", label: "Finance Officer" },
  { value: "auditor", label: "Auditor" },
  { value: "administrator", label: "Administrator" },
];

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "vendor",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!formData.name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!formData.email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "http://127.0.0.1:8000/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: formData.name.trim(),
            email: formData.email.trim(),
            password: formData.password,
            role: formData.role,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Registration failed. Please try again."
        );
      }

      setSuccess(
        "Registration successful! Redirecting to login..."
      );

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (err) {
      console.error("Registration error:", err);
      setError(
        err.message || "Unable to register. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-left">
        <div className="register-brand">
          <div className="brand-logo">V</div>

          <div>
            <h2>VRIPRM</h2>
            <span>Vendor Intelligence Platform</span>
          </div>
        </div>

        <div className="register-hero">
          <span className="register-tag">
            PROCUREMENT INTELLIGENCE
          </span>

          <h1>
            Build stronger
            <br />
            vendor relationships.
          </h1>

          <p>
            Join the VRIPRM platform to manage vendors,
            procurement operations and supplier reliability
            from one intelligent workspace.
          </p>

          <div className="register-points">
            <div>
              <span>✓</span>
              Secure role-based access
            </div>

            <div>
              <span>✓</span>
              Vendor reliability monitoring
            </div>

            <div>
              <span>✓</span>
              Procurement intelligence
            </div>
          </div>
        </div>

        <div className="register-left-footer">
          © 2026 VRIPRM. Procurement Intelligence Platform.
        </div>
      </div>

      <div className="register-right">
        <div className="register-card">
          <div className="mobile-brand">
            <div className="brand-logo">V</div>
            <strong>VRIPRM</strong>
          </div>

          <div className="register-heading">
            <span>Create Account</span>

            <h1>Join VRIPRM</h1>

            <p>
              Create your account to access the platform.
            </p>
          </div>

          {error && (
            <div className="register-message error">
              ⚠ {error}
            </div>
          )}

          {success && (
            <div className="register-message success">
              ✓ {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name</label>

              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                autoComplete="name"
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>

              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@company.com"
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label>Role</label>

              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
              >
                {ROLES.map((role) => (
                  <option
                    key={role.value}
                    value={role.value}
                  >
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="password-row">
              <div className="form-group">
                <label>Password</label>

                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label>Confirm Password</label>

                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              className="register-button"
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <div className="login-link">
            Already have an account?
            <Link to="/login"> Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;