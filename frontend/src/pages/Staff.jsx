// src/pages/Staff.jsx
import { useEffect, useState } from "react";
import axios from "../api/axiosInstance";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Staff() {
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
  const [editing, setEditing] = useState(null);
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
    if (token) axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete axios.defaults.headers.common.Authorization;
  }, [token]);

  // authorization: viewable by admin and manager
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

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/staff").then((r) => r.data);
      setItems(res.items || []);
    } catch (err) {
      console.error("fetch staff", err);
      toast.error(err.response?.data?.error || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStaff(); }, []);

  const createStaff = async () => {
    if (!form.username || !form.email || !form.password || !form.firstName || !form.lastName) {
      return toast.error("Fill required fields");
    }
    try {
      await axios.post("/staff", { ...form }); // server forces role to staff
      toast.success("Staff created");
      setForm({ username: "", email: "", password: "", firstName: "", lastName: "", phone: "" });
      setShowNew(false);
      fetchStaff();
    } catch (err) {
      console.error("create staff", err);
      toast.error(err.response?.data?.error || "Failed to create staff");
    }
  };

  const openEdit = (s) => {
    setEditing(s);
    setEditForm({
      username: s.username || "",
      email: s.email || "",
      password: "",
      firstName: s.firstName || "",
      lastName: s.lastName || "",
      phone: s.phone || "",
    });
  };

  const saveEdit = async () => {
    try {
      const payload = { ...editForm };
      if (!payload.password) delete payload.password;
      await axios.patch(`/staff/${editing.id}`, payload);
      toast.success("Staff updated");
      setEditing(null);
      fetchStaff();
    } catch (err) {
      console.error("save edit", err);
      toast.error(err.response?.data?.error || "Failed to save");
    }
  };

  const toggleDisable = async (id, disabled) => {
    try {
      await axios.patch(`/staff/${id}/${disabled ? "enable" : "disable"}`);
      toast.success(disabled ? "Enabled" : "Disabled");
      fetchStaff();
    } catch (err) {
      console.error("toggle disable", err);
      toast.error("Failed");
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete staff? This is permanent.")) return;
    try {
      await axios.delete(`/staff/${id}`);
      toast.success("Deleted");
      fetchStaff();
    } catch (err) {
      console.error("delete staff", err);
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <ToastContainer />
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Staff</h2>
          <div>
            {/* both admin and manager can create staff */}
            {["admin", "manager"].includes(currentUser.role) && (
              <button onClick={() => setShowNew((s) => !s)} className="px-3 py-2 border rounded">
                {showNew ? "Cancel" : "New Staff"}
              </button>
            )}
          </div>
        </div>

        {showNew && (["admin", "manager"].includes(currentUser.role)) && (
          <div className="bg-white p-4 rounded shadow mb-4">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Username" value={form.username} onChange={(e)=>setForm({...form, username:e.target.value})} className="p-2 border rounded" />
              <input placeholder="First name" value={form.firstName} onChange={(e)=>setForm({...form, firstName:e.target.value})} className="p-2 border rounded" />
              <input placeholder="Last name" value={form.lastName} onChange={(e)=>setForm({...form, lastName:e.target.value})} className="p-2 border rounded" />
              <input placeholder="Email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} className="p-2 border rounded" />
              <input placeholder="Phone" value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})} className="p-2 border rounded" />
              <input placeholder="Password" type="password" value={form.password} onChange={(e)=>setForm({...form, password:e.target.value})} className="p-2 border rounded" />
            </div>
            <div className="mt-3">
              <button onClick={createStaff} className="px-3 py-2 bg-indigo-600 text-white rounded">Create</button>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded border overflow-hidden">
          {loading ? (
            <div className="p-6 text-center">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center">No staff</div>
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
                {items.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-2 border">{s.username}</td>
                    <td className="p-2 border">{s.firstName} {s.lastName}</td>
                    <td className="p-2 border">{s.email}</td>
                    <td className="p-2 border">{s.phone}</td>
                    <td className="p-2 border">{s.disabled ? "Yes" : "No"}</td>
                    <td className="p-2 border">
                      <div className="flex gap-2">
                        {["admin", "manager"].includes(currentUser.role) && (
                          <>
                            <button onClick={()=>openEdit(s)} className="px-2 py-1 border rounded text-sm">Edit</button>
                            {/* disable/enable and delete visible only to admin */}
                            {currentUser.role === "admin" ? (
                              <>
                                <button onClick={()=>toggleDisable(s.id, s.disabled)} className="px-2 py-1 border rounded text-sm">{s.disabled ? "Enable" : "Disable"}</button>
                                <button onClick={()=>remove(s.id)} className="px-2 py-1 border rounded text-sm">Delete</button>
                              </>
                            ) : null}
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
            <h3 className="text-lg font-semibold mb-4">Edit Staff</h3>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Username" value={editForm.username} onChange={(e)=>setEditForm({...editForm, username:e.target.value})} className="p-2 border rounded" />
              <input placeholder="First name" value={editForm.firstName} onChange={(e)=>setEditForm({...editForm, firstName:e.target.value})} className="p-2 border rounded" />
              <input placeholder="Last name" value={editForm.lastName} onChange={(e)=>setEditForm({...editForm, lastName:e.target.value})} className="p-2 border rounded" />
              <input placeholder="Email" value={editForm.email} onChange={(e)=>setEditForm({...editForm, email:e.target.value})} className="p-2 border rounded" />
              <input placeholder="Phone" value={editForm.phone} onChange={(e)=>setEditForm({...editForm, phone:e.target.value})} className="p-2 border rounded" />
              <input placeholder="Password (leave blank to keep)" type="password" value={editForm.password} onChange={(e)=>setEditForm({...editForm, password:e.target.value})} className="p-2 border rounded" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={()=>setEditing(null)} className="px-3 py-2 border rounded">Cancel</button>
              <button onClick={saveEdit} className="px-3 py-2 bg-indigo-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
