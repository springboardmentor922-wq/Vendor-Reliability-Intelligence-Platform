import { useState } from "react";
import { Link } from "react-router-dom";
import "./ForgotPassword.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Something went wrong.");
        return;
      }

      setMessage(
        "If an account exists with this email, a password reset link has been sent."
      );
    } catch (err) {
      setError(
        "Unable to connect to the server. Please make sure the backend is running."
      );
    }
  };

  return (
    <div className="forgot-page">

      <div className="forgot-card">

        {/* LEFT SIDE */}

        <div className="forgot-form-section">

          <div className="forgot-brand">

            <div className="forgot-logo">
              V
            </div>

            <div>
              <h2>VRIPRM</h2>

              <p>
                Vendor Reliability Intelligence
              </p>
            </div>

          </div>


          <div className="forgot-content">

            <div className="forgot-icon">
              🔐
            </div>

            <h1>Forgot Password?</h1>

            <p className="forgot-subtitle">
              No worries. Enter your registered email address
              and we'll help you reset your password.
            </p>


            <form onSubmit={handleSubmit}>

              <label>Email Address</label>

              <div className="forgot-input">

                <span>✉</span>

                <input
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

              </div>


              {error && (
                <div className="forgot-error">
                  ⚠ {error}
                </div>
              )}


              {message && (
                <div className="forgot-success">
                  ✓ {message}
                </div>
              )}


              <button
                type="submit"
                className="forgot-button"
              >
                Send Reset Link
                <span>→</span>
              </button>

            </form>


            <Link
              to="/login"
              className="forgot-back"
            >
              ← Back to Login
            </Link>

          </div>

        </div>


        {/* RIGHT SIDE */}

        <div className="forgot-info">

          <div className="forgot-info-content">

            <div className="forgot-big-v">
              V
            </div>

            <h1>
              Secure Your
              <br />
              Account.
            </h1>

            <p>
              Protect your VRIPRM account with a secure
              password recovery process.
            </p>


            <div className="forgot-points">

              <div>
                <span>✓</span>
                <p>Secure password recovery</p>
              </div>

              <div>
                <span>✓</span>
                <p>Email-based verification</p>
              </div>

              <div>
                <span>✓</span>
                <p>Protected account access</p>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default ForgotPassword;