import { createContext, useContext, useState, useEffect } from "react";
import { loginUser, getCurrentUser } from "../api/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    getCurrentUser()
      .then((res) => setCurrentUser(res.data))
      .catch(() => localStorage.removeItem("access_token"))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await loginUser(email, password);
    localStorage.setItem("access_token", res.data.access_token);
    const meRes = await getCurrentUser();
    setCurrentUser(meRes.data);
    return meRes.data;
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    setCurrentUser(null);
  };

  const value = { currentUser, isLoading, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
