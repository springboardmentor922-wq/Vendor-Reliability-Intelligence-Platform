import React from "react";
import { Navigate } from "react-router-dom";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

function decodeToken(token) {
  try {
    const payload = token.split(".")[1];

    const decoded = JSON.parse(
      atob(
        payload
          .replace(/-/g, "+")
          .replace(/_/g, "/")
      )
    );

    return decoded;
  } catch (error) {
    console.error(
      "Unable to decode token:",
      error
    );

    return null;
  }
}

function ProtectedRoute({
  children,
  allowedRole,
}) {
  const token = getToken();

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  const payload = decodeToken(token);

  if (!payload) {
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access_token");

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  const userRole =
    payload.role;

  if (!userRole) {
    return (
      <Navigate
        to="/unauthorized"
        replace
      />
    );
  }

  if (userRole !== allowedRole) {
    console.warn(
      "Role mismatch:",
      {
        userRole,
        allowedRole,
      }
    );

    return (
      <Navigate
        to="/unauthorized"
        replace
      />
    );
  }

  return children;
}

export default ProtectedRoute;