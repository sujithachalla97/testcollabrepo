// src/pages/Managers.jsx
import { useEffect, useState } from "react";
import axios from "../api/axiosInstance";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Managers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // create form
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
  });

  // edit modal
  const [editing, setEditing] = useState(null); // manager object being edited
  const [editForm, setEditForm] = useState({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
  });

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();
  const token = localStorage.getItem("token") || currentUser?.token || null;

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }
  }, [token]);

  if (!currentUser || !["admin", "manager"].includes(currentUser.role)) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h2 className="text-2xl font-semibold mb-2">Access denied</h2>
          <p className="text-gray-600">You must be logged in as a manager or admin to view this page.</p>
        </div>
      </div>
    );
  }

  const fetchManagers = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/managers").then((r) => r.data);
      setItems((res.items || []).filter((u) => u.role === "manager"));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load managers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagers();
  }, []);

  const createManager = async () => {
    if (!form.username || !form.email || !form.password || !form.firstName || !form.lastName) {
      return toast.error("Fill all required fields");
    }
    try {
      await axios.post("/managers", { ...form, role: "manager" });
      toast.success("Manager created");
      setForm({ username: "", email: "", password: "", firstName: "", lastName: "", phone: "" });
      setShowNew(false);
      fetchManagers();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create");
    }
  };

  const openEdit = (mgr) => {
    setEditing(mgr);
    setEditForm({
      username: mgr.username || "",
      email: mgr.email || "",
      password: "",
      firstName: mgr.firstName || "",
      lastName: mgr.lastName || "",
      phone: mgr.phone || "",
    });
  };

  const saveEdit = async () => {
    try {
      const payload = { ...editForm };
      if (!payload.password) delete payload.password; // don’t send empty password
      await axios.patch(`/managers/${editing.id}`, payload);
      toast.success("Manager updated");
      setEditing(null);
      fetchManagers();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update");
    }
  };

  const toggleDisable = async (id, disabled) => {
    try {
      await axios.patch(`/managers/${id}/${disabled ? "enable" : "disable"}`);
      toast.success(disabled ? "Enabled" : "Disabled");
      fetchManagers();
    } catch {
      toast.error("Failed");
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete manager? This is permanent.")) return;
    try {
      await axios.delete(`/managers/${id}`);
      toast.success("Deleted");
      fetchManagers();
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <ToastContainer />
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Managers</h2>
          {currentUser.role === "admin" && (
            <button onClick={() => setShowNew((s) => !s)} className="px-3 py-2 border rounded">
              {showNew ? "Cancel" : "New Manager"}
            </button>
          )}
        </div>

        {showNew && currentUser.role === "admin" && (
          <div className="bg-white p-4 rounded shadow mb-4">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="p-2 border rounded" />
              <input placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="p-2 border rounded" />
              <input placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="p-2 border rounded" />
              <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="p-2 border rounded" />
              <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="p-2 border rounded" />
              <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="p-2 border rounded" />
            </div>
            <div className="mt-3">
              <button onClick={createManager} className="px-3 py-2 bg-indigo-600 text-white rounded">Create</button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white shadow rounded border overflow-hidden">
          {loading ? (
            <div className="p-6 text-center">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center">No managers</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 border">Username</th>
                  <th className="p-2 border">Name</th>
                  <th className="p-2 border">Email</th>
                  <th className="p-2 border">Phone</th>
                  <th className="p-2 border">Disabled</th>
                  <th className="p-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2 border">{u.username}</td>
                    <td className="p-2 border">{u.firstName} {u.lastName}</td>
                    <td className="p-2 border">{u.email}</td>
                    <td className="p-2 border">{u.phone}</td>
                    <td className="p-2 border">{u.disabled ? "Yes" : "No"}</td>
                    <td className="p-2 border">
                      <div className="flex gap-2">
                        {currentUser.role === "admin" && (
                          <>
                            <button onClick={() => openEdit(u)} className="px-2 py-1 border rounded text-sm">Edit</button>
                            <button onClick={() => toggleDisable(u.id, u.disabled)} className="px-2 py-1 border rounded text-sm">{u.disabled ? "Enable" : "Disable"}</button>
                            <button onClick={() => remove(u.id)} className="px-2 py-1 border rounded text-sm">Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4">Edit Manager</h3>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Username" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} className="p-2 border rounded" />
              <input placeholder="First name" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} className="p-2 border rounded" />
              <input placeholder="Last name" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} className="p-2 border rounded" />
              <input placeholder="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="p-2 border rounded" />
              <input placeholder="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="p-2 border rounded" />
              <input placeholder="Password (leave blank to keep)" type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} className="p-2 border rounded" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditing(null)} className="px-3 py-2 border rounded">Cancel</button>
              <button onClick={saveEdit} className="px-3 py-2 bg-indigo-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
