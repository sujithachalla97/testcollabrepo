import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const handleChange = (e) => {
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.email || !form.password) {
      setError("Please fill in both email and password.");
      return;
    }

    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Login failed. Check credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md bg-white shadow-lg rounded-2xl p-8 sm:p-10"
      >
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-indigo-600">Telecom Inventory Management System</h1>
          <p className="text-sm text-gray-500 mt-1">Please login to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md p-3">
              {error}
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-md border-gray-200 shadow-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 p-3"
              placeholder="you@company.com"
              aria-label="Email"
            />
          </label>

          <label className="block">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Password</span>
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="text-xs text-indigo-600 hover:underline"
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>

            <input
              name="password"
              type={showPwd ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-md border-gray-200 shadow-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 p-3"
              placeholder="••••••••"
              aria-label="Password"
            />
          </label>

          

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 bg-indigo-600 text-white font-medium shadow hover:brightness-105 disabled:opacity-60"
          >
            {loading ? (
              <svg
                className="w-5 h-5 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}