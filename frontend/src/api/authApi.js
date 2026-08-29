import apiClient from "./apiClient";

export const registerUser = (payload) => {
  // payload: { email, password, full_name, role, phone }
  return apiClient.post("/auth/register", payload);
};

export const loginUser = (email, password) => {
  // backend expects OAuth2PasswordRequestForm -> form-urlencoded, field name "username"
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);

  return apiClient.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
};

export const getCurrentUser = () => {
  return apiClient.get("/auth/me");
};
