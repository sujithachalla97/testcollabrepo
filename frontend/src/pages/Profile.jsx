import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "../api/axiosInstance";
import { toast } from "react-toastify";

export default function Profile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
  });

  // 🔹 Fetch latest user data on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userId = user._id || user.id;
        const { data } = await axios.get(`/users/${userId}`);
        setForm({
          username: data.username || "",
          email: data.email || "",
          password: "",
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          phone: data.phone || "",
        });
      } catch (err) {
        toast.error("Failed to load profile");
      }
    };
    fetchUser();
  }, [user]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const userId = user._id || user.id;
      const payload = { ...form };
      if (!payload.password) delete payload.password; // don’t send blank password

      const res = await axios.put(`/users/${userId}`, payload);

      if (res.status === 200) {
        setUser(res.data); // update context with fresh user
        toast.success("Profile updated successfully ✅");
        setTimeout(() => navigate("/dashboard"), 1200); // go back after toast
      } else {
        toast.error("Update failed ❌");
      }
    } catch (err) {
      console.error("Update error:", err.response?.data || err.message);
      toast.error("Update failed ❌");
    }
  };

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
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
