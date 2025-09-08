import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

const LS_USER_KEY = "authUser";
const LS_TOKEN_KEY = "authToken";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  });

  const [token, setToken] = useState(() => localStorage.getItem(LS_TOKEN_KEY) || null);

  // persist to localStorage whenever user or token changes
  useEffect(() => {
    if (user) localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(LS_USER_KEY);
  }, [user]);

  useEffect(() => {
    if (token) localStorage.setItem(LS_TOKEN_KEY, token);
    else localStorage.removeItem(LS_TOKEN_KEY);
  }, [token]);

  const login = async (username, password) => {
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || "Login failed");

    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    // localStorage cleared by the effects above
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
