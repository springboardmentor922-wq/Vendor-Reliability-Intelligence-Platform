import React from "react";
import { Link } from "react-router-dom";

function Unauthorized() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f7fb",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "45px",
          borderRadius: "15px",
          textAlign: "center",
          boxShadow: "0 5px 20px rgba(0,0,0,0.1)",
        }}
      >
        <h1>403</h1>

        <h2>Access Denied</h2>

        <p style={{ color: "#666" }}>
          You do not have permission to access this dashboard.
        </p>

        <Link to="/login">
          <button
            style={{
              padding: "12px 25px",
              border: "none",
              borderRadius: "8px",
              background: "#17152f",
              color: "white",
              cursor: "pointer",
            }}
          >
            Back to Login
          </button>
        </Link>
      </div>
    </div>
  );
}

export default Unauthorized;