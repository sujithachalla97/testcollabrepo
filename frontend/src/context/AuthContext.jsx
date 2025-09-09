import { createContext, useContext, useState, useEffect } from "react";
import axiosInstance from "../api/axiosInstance";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(localStorage.getItem("token") || null);

  // 🔑 Login
  const login = async (email, password) => {
    try {
      const res = await axiosInstance.post("/auth/login", { email, password });

      // Save token + user in localStorage
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.user.role);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      setUser(res.data.user);
      setToken(res.data.token);

      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.msg || "Login failed");
    }
  };

  // 🔑 Register
  const register = async (data) => {
    try {
      const res = await axiosInstance.post("/auth/register", data);
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.msg || "Registration failed");
    }
  };

  // 🔑 Logout
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
  };

  // 🔑 Keep user logged in on refresh
  useEffect(() => {
    if (token && !user) {
      axiosInstance
        .get("/auth/me")
        .then((res) => {
          setUser(res.data.user || res.data);
          localStorage.setItem("user", JSON.stringify(res.data.user || res.data));
        })
        .catch(() => {
          logout();
        });
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
