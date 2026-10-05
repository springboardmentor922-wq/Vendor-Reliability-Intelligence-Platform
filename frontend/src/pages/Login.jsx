import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

const API_URL = "http://127.0.0.1:8000";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      // ============================================================
      // LOGIN
      // ============================================================

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error("Invalid response received from the server.");
      }

      if (!response.ok) {
        throw new Error(
          data?.detail || "Invalid email or password."
        );
      }

      const token = data?.access_token;

      if (!token) {
        throw new Error(
          "Login successful, but authentication token was not received."
        );
      }

      console.log("Login successful.");

      // ============================================================
      // CLEAR OLD AUTH DATA
      // ============================================================

      localStorage.removeItem("access_token");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("currentUser");

      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("currentUser");

      // ============================================================
      // SAVE TOKEN
      // ============================================================

      if (rememberMe) {
        localStorage.setItem("access_token", token);
        localStorage.setItem("token", token);
      } else {
        sessionStorage.setItem("access_token", token);
        sessionStorage.setItem("token", token);
      }

      // ============================================================
      // GET CURRENT USER
      // ============================================================

      const meResponse = await fetch(`${API_URL}/me`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      let userData;

      try {
        userData = await meResponse.json();
      } catch {
        throw new Error(
          "Unable to read the logged-in user information."
        );
      }

      if (!meResponse.ok) {
        throw new Error(
          userData?.detail ||
            "Unable to identify the logged-in user."
        );
      }

      console.log("Logged in user:", userData);
      console.log("Logged in role:", userData.role);

      // ============================================================
      // CHECK ACTIVE STATUS
      // ============================================================

      if (userData.is_active === false) {
        // Remove authentication if inactive
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("token");

        throw new Error(
          "Your account is inactive. Please contact the administrator."
        );
      }

      // ============================================================
      // SAVE USER
      // ============================================================

      const user = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        is_active: userData.is_active,
      };

      const userString = JSON.stringify(user);

      if (rememberMe) {
        localStorage.setItem("user", userString);
        localStorage.setItem("currentUser", userString);

        sessionStorage.removeItem("user");
        sessionStorage.removeItem("currentUser");
      } else {
        sessionStorage.setItem("user", userString);
        sessionStorage.setItem("currentUser", userString);

        localStorage.removeItem("user");
        localStorage.removeItem("currentUser");
      }

      // ============================================================
      // REDIRECT BASED ON ROLE
      // ============================================================

      switch (userData.role) {
        case "administrator":
          navigate("/admin-dashboard", { replace: true });
          break;

        case "procurement_manager":
          navigate("/procurement-dashboard", { replace: true });
          break;

        case "supply_chain_manager":
          navigate("/supply-chain-dashboard", {
            replace: true,
          });
          break;

        case "vendor":
          navigate("/vendor-dashboard", { replace: true });
          break;

        case "finance_officer":
          navigate("/finance-dashboard", { replace: true });
          break;

        case "auditor":
          navigate("/auditor-dashboard", { replace: true });
          break;

        default:
          throw new Error(
            `Invalid user role: ${userData.role}`
          );
      }
    } catch (err) {
      console.error("Login error:", err);

      setError(
        err?.message ||
          "Unable to connect to the server. Please make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* ============================================================
          LEFT BRAND PANEL
          ============================================================ */}

      <div className="login-brand-panel">
        <div className="brand-top">
          <div className="brand-logo">V</div>

          <div>
            <h2>VRIPRM</h2>
            <span>Enterprise Procurement Intelligence</span>
          </div>
        </div>

        <div className="brand-main">
          <div className="eyebrow">
            VENDOR & PROCUREMENT INTELLIGENCE
          </div>

          <h1>
            Smarter procurement.
            <br />
            <span>Stronger decisions.</span>
          </h1>

          <p>
            Manage vendors, monitor reliability, streamline
            procurement, and reduce supply chain risk from one
            intelligent platform.
          </p>

          <div className="brand-features">

            <div className="brand-feature">
              <div className="feature-circle">✓</div>

              <div>
                <strong>Vendor Reliability</strong>
                <small>
                  Monitor vendor performance and risk
                </small>
              </div>
            </div>

            <div className="brand-feature">
              <div className="feature-circle">↗</div>

              <div>
                <strong>Procurement Intelligence</strong>
                <small>
                  Make faster and smarter purchasing decisions
                </small>
              </div>
            </div>

            <div className="brand-feature">
              <div className="feature-circle">◆</div>

              <div>
                <strong>Secure Enterprise Access</strong>
                <small>
                  Role-based access for every user
                </small>
              </div>
            </div>

          </div>
        </div>

        <div className="brand-footer">
          <span>VRIPRM Platform</span>
          <span>•</span>
          <span>Secure Business Management</span>
        </div>
      </div>

      {/* ============================================================
          RIGHT LOGIN PANEL
          ============================================================ */}

      <div className="login-form-panel">
        <div className="login-card">

          {/* MOBILE LOGO */}

          <div className="mobile-logo">
            <div className="brand-logo">V</div>
            <strong>VRIPRM</strong>
          </div>

          {/* LOGIN HEADING */}

          <div className="login-heading">
            <div className="login-badge">
              SECURE SIGN IN
            </div>

            <h1>Welcome back</h1>

            <p>
              Sign in to access your procurement intelligence
              workspace.
            </p>
          </div>

          {/* LOGIN FORM */}

          <form onSubmit={handleLogin}>

            {/* EMAIL */}

            <div className="form-field">
              <label>Work Email</label>

              <div className="input-wrapper">
                <span className="input-symbol">@</span>

                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* PASSWORD */}

            <div className="form-field">
              <label>Password</label>

              <div className="input-wrapper">
                <span className="input-symbol">
                  ••
                </span>

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword((previous) => !previous)
                  }
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* OPTIONS */}

            <div className="login-options">
              <label className="remember-option">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) =>
                    setRememberMe(e.target.checked)
                  }
                />

                <span>Remember me</span>
              </label>

              <Link to="/forgot-password">
                Forgot password?
              </Link>
            </div>

            {/* ERROR */}

            {error && (
              <div className="login-error">
                <span>!</span>
                <div>{error}</div>
              </div>
            )}

            {/* LOGIN BUTTON */}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <span className="arrow">→</span>
                </>
              )}
            </button>

          </form>

          {/* DIVIDER */}

          <div className="login-divider">
            <span></span>
            <p>New to VRIPRM?</p>
            <span></span>
          </div>

          {/* REGISTER */}

          <Link
            to="/register"
            className="create-account"
          >
            Create an account
          </Link>

          {/* SECURITY */}

          <div className="security-note">
            <span>🔒</span>

            <div>
              <strong>Secure access</strong>

              <p>
                Your credentials are protected with secure
                authentication.
              </p>
            </div>
          </div>

        </div>

        {/* FOOTER */}

        <div className="form-footer">
          © 2026 VRIPRM • Vendor Reliability Intelligence &
          Procurement Risk Management
        </div>
      </div>

    </div>
  );
}

export default Login;