// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "../api/axiosInstance";
import { getStoredUser, getStoredToken, setAuth, clearAuth } from "../lib/auth";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  // initialize on app start
  useEffect(() => {
    let mounted = true;
    const token = getStoredToken();
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      // fetch canonical user from server to ensure up-to-date data
      (async () => {
        try {
          const res = await axios.get("/auth/me").then(r => r.data);
          if (!mounted) return;
          if (res?.ok && res.user) {
            setUser(res.user);
            setAuth({ user: res.user, token }); // ensure storage/header synced
          } else {
            // fallback to stored user if server returned not-ok
            const stored = getStoredUser();
            setUser(stored);
          }
        } catch (err) {
          // couldn't reach server (offline or token invalid); fallback to stored
          setUser(getStoredUser());
        } finally {
          if (mounted) setLoading(false);
        }
      })();
    } else {
      // no token, ensure cleared state
      clearAuth();
      setUser(null);
      setLoading(false);
    }
    return () => { mounted = false; };
  }, []);

  // login helper: store and set header + context
  const login = ({ user: newUser, token }) => {
    setAuth({ user: newUser, token });
    setUser(newUser);
  };

  // logout helper
  const logout = () => {
    clearAuth();
    setUser(null);
  };

  // update user in context + localStorage (used after profile edit)
  const updateUser = (updatedUser) => {
    const token = getStoredToken();
    setAuth({ user: updatedUser, token });
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, setUser: updateUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
