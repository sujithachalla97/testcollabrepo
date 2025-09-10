// src/pages/Login.jsx
import React, { useState } from "react";
import axios from "../api/axiosInstance";
import { useAuth } from "../context/AuthContext"; // ensure path matches your project
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post("/auth/login", { email, password }).then((r) => r.data);
      console.log("LOGIN response:", res);

      // server must return token and user
      const token = res.token || res.data?.token || res?.token;
      const user = res.user || res.data?.user || res?.user;

      if (!token || !user) {
        console.error("Login missing token/user:", { token, user, full: res });
        setError("Login succeeded but server did not return token/user. Check console.");
        setLoading(false);
        return;
      }

      // call context login to persist and set axios header
      try {
        // some AuthContexts expect (email, password) while yours expects an object — keep your working call
        login({ user, token });
      } catch (ctxErr) {
        // if login signature is different, still attempt to set localStorage as fallback
        console.warn("AuthContext.login threw, falling back to direct set:", ctxErr);
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("token", token);
        axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      }

      console.log("localStorage user:", localStorage.getItem("user"));
      console.log("localStorage token:", localStorage.getItem("token"));

      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      const msg = err?.response?.data?.msg || err?.response?.data?.error || err?.message || "Login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-indigo-100 p-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-block px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 font-bold">
              TIMS
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-gray-900">Sign in to your account</h1>
            <p className="mt-1 text-sm text-gray-500">Inventory management — use your admin/manager/staff credentials</p>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-100 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-200" />
                <span className="text-gray-600">Remember me</span>
              </label>
              <a href="#" className="text-indigo-600 hover:underline">Forgot password?</a>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 bg-indigo-600 text-white font-medium shadow hover:bg-indigo-700 disabled:opacity-60 transition"
              >
                {loading ? (
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                ) : null}
                <span>{loading ? "Signing in…" : "Sign in"}</span>
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            &copy; {new Date().getFullYear()} TIMS — Telecom Inventory Management
          </div>
        </div>
      </motion.div>
    </div>
  );
}
