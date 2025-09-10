// src/lib/auth.js
import axios from "../api/axiosInstance";

const USER_KEY = "user";
const TOKEN_KEY = "token";

export function setAuth({ user, token }) {
  if (user !== undefined && user !== null) localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (token !== undefined && token !== null) localStorage.setItem(TOKEN_KEY, token);
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
}

export function clearAuth() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  delete axios.defaults.headers.common.Authorization;
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}
