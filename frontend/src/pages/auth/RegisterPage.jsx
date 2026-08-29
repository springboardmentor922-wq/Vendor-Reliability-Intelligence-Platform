import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "../../api/authApi";

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrator" },
  { value: "procurement_manager", label: "Procurement Manager" },
  { value: "supply_chain_manager", label: "Supply Chain Manager" },
  { value: "vendor", label: "Vendor" },
  { value: "finance_officer", label: "Finance Officer" },
  { value: "auditor", label: "Auditor" },
];

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "vendor",
    phone: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await registerUser(formData);
      navigate("/login");
    } catch (err) {
      const detail = err.response?.data?.detail || "Registration failed.";
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Create Account</h1>

        {errorMessage && <p className="error-text">{errorMessage}</p>}

        <label htmlFor="full_name">Full Name</label>
        <input
          id="full_name"
          name="full_name"
          value={formData.full_name}
          onChange={handleChange}
          required
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          required
        />

        <label htmlFor="phone">Phone</label>
        <input
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
        />

        <label htmlFor="role">Role</label>
        <select id="role" name="role" value={formData.role} onChange={handleChange}>
          {ROLE_OPTIONS.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Register"}
        </button>

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
