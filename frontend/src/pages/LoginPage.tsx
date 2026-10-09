import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Shield,
  Sparkles,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";

import { landingPathFor, useAuth } from "../lib/auth";

type Mode = "login" | "register" | "reset" | "reset-confirm";

const DEMO_PASSWORD = "VendorIQ@2026";

const demo = [
  ["admin@vendoriq.local", "Administrator"],
  ["procurement@vendoriq.local", "Procurement Manager"],
  ["scm@vendoriq.local", "Supply Chain Manager"],
  ["vendor@vendoriq.local", "Vendor"],
  ["finance@vendoriq.local", "Finance Officer"],
  ["auditor@vendoriq.local", "Auditor"],
] as const;

export default function LoginPage() {
  const { user, login, register, requestReset, confirmReset } = useAuth();

  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("login");

  const [name, setName] = useState("");

  const [email, setEmail] = useState("admin@vendoriq.local");

  const [password, setPassword] = useState(DEMO_PASSWORD);

  const [role, setRole] = useState("vendor");

  const [token, setToken] = useState("");

  const [newPassword, setNewPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={landingPathFor(user.role)} replace />;
  }

  const clearFeedback = () => {
    setError("");
    setMessage("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    setBusy(true);
    clearFeedback();

    try {
      if (mode === "login") {
        const profile = await login(email.trim(), password);

        navigate(landingPathFor(profile.role), {
          replace: true,
        });

        return;
      }

      if (mode === "register") {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        });

        setMode("login");
        setPassword("");
        setMessage("Account created. You can sign in now.");

        return;
      }

      if (mode === "reset") {
        const result = await requestReset(email.trim());

        if (result?.dev_reset_token) {
          setToken(result.dev_reset_token);

          setMode("reset-confirm");

          setMessage(
            "A development reset token was issued. Set a new password below.",
          );
        } else {
          setMode("login");

          setMessage("If the account exists, a reset link has been prepared.");
        }
      }
    } catch (err: any) {
      setError(
        err?.detail ||
          err?.message ||
          "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmReset = async () => {
    setBusy(true);
    clearFeedback();

    try {
      await confirmReset(token.trim(), newPassword);

      setMode("login");
      setPassword("");
      setToken("");
      setNewPassword("");

      setMessage("Password updated. Sign in with your new password.");
    } catch (err: any) {
      setError(err?.detail || err?.message || "Reset failed.");
    } finally {
      setBusy(false);
    }
  };

  const useDemo = (demoEmail: string) => {
    setMode("login");
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    clearFeedback();
  };

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    clearFeedback();
  };

  return (
    <div className="auth-screen">
      <div className="auth-visual">
        <div className="auth-brand">
          <div className="brand-mark large">
            <Sparkles size={19} />
          </div>

          <div>
            <strong>
              Vendor<span>IQ</span>
            </strong>

            <small>Reliability intelligence</small>
          </div>
        </div>

        <div className="visual-copy">
          <span className="eyebrow light">PROCUREMENT CONTROL PLANE</span>

          <h1>One clear view of every supplier signal.</h1>

          <p>
            Unify vendor performance, purchasing, contracts, finance and risk
            signals in one quiet, decision-ready workspace.
          </p>

          <div className="visual-points">
            {[
              "Trace supplier health before the next order",
              "Keep operational records separate from historical intelligence",
              "Make approvals, contracts and finance auditable",
            ].map((point) => (
              <div key={point}>
                <span className="point-icon">
                  <Check size={14} />
                </span>

                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="visual-foot">
          <span>
            <Shield size={14} />
            Secure role-aware workspace
          </span>

          <span>
            Vendor Reliability Intelligence &amp; Procurement Risk Management
          </span>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <div className="auth-topline">
            <span className="tiny-label">
              {mode === "login"
                ? "WELCOME BACK"
                : mode === "register"
                  ? "CREATE ACCOUNT"
                  : "ACCOUNT RECOVERY"}
            </span>

            <span className="secure-pill">
              <span />
              Encrypted
            </span>
          </div>

          <h2>
            {mode === "login"
              ? "Sign in to VendorIQ"
              : mode === "register"
                ? "Join the workspace"
                : mode === "reset"
                  ? "Recover your account"
                  : "Choose a new password"}
          </h2>

          <p className="auth-subtitle">
            {mode === "login"
              ? "Use your enterprise account to continue."
              : mode === "register"
                ? "Create a vendor or auditor account for the demo environment."
                : mode === "reset"
                  ? "Request a reset token for the development environment."
                  : "Paste the reset token and set a new password."}
          </p>

          {mode === "reset-confirm" ? (
            <div className="form-stack">
              <Field label="Reset token">
                <input
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Paste the development token"
                  autoComplete="off"
                />
              </Field>

              <Field label="New password">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>

              <button
                type="button"
                className="button primary full"
                onClick={handleConfirmReset}
                disabled={
                  busy || token.trim().length === 0 || newPassword.length < 8
                }
              >
                {busy ? "Updating…" : "Update password"}

                <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <form className="form-stack" onSubmit={submit}>
              {mode === "register" && (
                <Field label="Full name">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </Field>
              )}

              <Field label="Work email">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="username"
                  placeholder="name@company.com"
                />
              </Field>

              {(mode === "login" || mode === "register") && (
                <Field label="Password">
                  <div className="input-with-action">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={8}
                      required
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      placeholder="Minimum 8 characters"
                    />

                    <button
                      type="button"
                      className="field-action"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </Field>
              )}

              {mode === "register" && (
                <Field label="Account role">
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                  >
                    <option value="vendor">Vendor</option>
                    <option value="auditor">Auditor</option>
                  </select>
                </Field>
              )}

              <button className="button primary full" disabled={busy}>
                {busy
                  ? "Working…"
                  : mode === "login"
                    ? "Sign in"
                    : mode === "register"
                      ? "Create account"
                      : "Send reset request"}

                <ArrowRight size={15} />
              </button>
            </form>
          )}

          {(message || error) && (
            <div
              className={`auth-message ${error ? "error" : "success"}`}
              role="status"
            >
              {error || message}
            </div>
          )}

          <div className="auth-links">
            {mode === "login" ? (
              <>
                <button type="button" onClick={() => changeMode("register")}>
                  Create account
                </button>

                <button type="button" onClick={() => changeMode("reset")}>
                  Forgot password?
                </button>
              </>
            ) : (
              <button type="button" onClick={() => changeMode("login")}>
                Back to sign in
              </button>
            )}
          </div>

          {mode === "login" && (
            <div className="demo-panel">
              <div className="demo-head">
                <div>
                  <strong>Demo access</strong>

                  <span>Shared password</span>
                </div>

                <KeyRound size={16} />
              </div>

              <div className="demo-grid">
                {demo.map(([demoEmail, label]) => (
                  <button
                    type="button"
                    key={demoEmail}
                    onClick={() => useDemo(demoEmail)}
                  >
                    <span>{label}</span>

                    <small>{demoEmail}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
