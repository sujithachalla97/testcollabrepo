// src/pages/Profile.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "../api/axiosInstance";
import { toast } from "react-toastify";

export default function Profile() {
  const auth = useAuth();
  const ctxUser = auth?.user ?? null;
  const setCtxUser = typeof auth?.setUser === "function" ? auth.setUser : null;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
  });

  // normalize various API response shapes to return the user object
  const normalizeUser = (payload) => {
    if (!payload) return null;
    if (payload.user) return payload.user;
    if (payload.data) return payload.data;
    if (payload.success && payload.data) return payload.data;
    return payload;
  };

  // fetch canonical current user (backend: GET /auth/me)
  useEffect(() => {
    let mounted = true;
    const fetchMe = async () => {
      setLoading(true);
      try {
        const res = await axios.get("/auth/me");
        const user = normalizeUser(res.data);
        if (!mounted) return;
        if (user) {
          setForm((f) => ({
            ...f,
            username: user.username || "",
            email: user.email || "",
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            phone: user.phone || "",
            password: "",
          }));
          if (setCtxUser) setCtxUser(user);
        } else if (ctxUser) {
          // fallback to context if backend didn't return user object
          setForm((f) => ({
            ...f,
            username: ctxUser.username || "",
            email: ctxUser.email || "",
            firstName: ctxUser.firstName || "",
            lastName: ctxUser.lastName || "",
            phone: ctxUser.phone || "",
            password: "",
          }));
        }
      } catch (err) {
        console.error("fetch profile", err);
        toast.error("Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMe();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password; // don't send blank password

      // PATCH canonical endpoint (backend has router.patch('/me', protect, updateMe))
      const res = await axios.patch("/auth/me", payload);
      const updated = normalizeUser(res.data);

      if (updated) {
        // update context (so dashboard header updates)
        if (setCtxUser) setCtxUser(updated);
        toast.success("Profile updated ✅");
        setForm((s) => ({ ...s, password: "" })); // clear pw field
        setTimeout(() => navigate("/dashboard"), 800);
        return;
      }

      // fallback: if server didn't return user, re-fetch canonical user
      const ref = await axios.get("/auth/me");
      const refUser = normalizeUser(ref.data);
      if (refUser && setCtxUser) setCtxUser(refUser);
      toast.success("Profile updated");
      setTimeout(() => navigate("/dashboard"), 800);
    } catch (err) {
      console.error("Update error:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Update failed ❌");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4">Loading profile...</div>;

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-6">Edit Profile</h2>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">First Name</label>
          <input
            type="text"
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            className="mt-1 block w-full border rounded-md p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Last Name</label>
          <input
            type="text"
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            className="mt-1 block w-full border rounded-md p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Username</label>
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            className="mt-1 block w-full border rounded-md p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="mt-1 block w-full border rounded-md p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Phone</label>
          <input
            type="text"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            className="mt-1 block w-full border rounded-md p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">New Password</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            className="mt-1 block w-full border rounded-md p-2"
            placeholder="Leave blank if unchanged"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
