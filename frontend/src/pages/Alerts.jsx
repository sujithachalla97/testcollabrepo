// src/pages/Alerts.jsx
import { useEffect, useState } from "react";
import axios from "../api/axiosInstance";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../context/AuthContext";

/**
 * Props:
 *  - onOpenRestock(items) optional callback to open restock modal in parent
 */
export default function Alerts({ onOpenRestock }) {
  const { user } = useAuth();
  const isStaff = user?.role === "staff";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [editingRp, setEditingRp] = useState({});
  const [savingRpFor, setSavingRpFor] = useState(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/alerts/low-stock").then((r) => r.data);
      setItems(res.items || []);
    } catch (err) {
      console.error("fetch alerts", err);
      toast.error("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const bulkAcknowledge = async () => {
    if (selected.size === 0) return toast.info("Select items to acknowledge");
    try {
      const ids = Array.from(selected);
      await axios.post("/alerts/acknowledge", { productIds: ids, user: "system" });
      toast.success("Acknowledged");
      setSelected(new Set());
      fetchAlerts();
    } catch (err) {
      console.error("ack", err);
      toast.error("Failed to acknowledge");
    }
  };

  const ackSingle = async (id) => {
    try {
      await axios.post("/alerts/acknowledge", { productIds: [id], user: "system" });
      toast.success("Acknowledged");
      fetchAlerts();
    } catch (err) {
      console.error("ack", err);
      toast.error("Failed to acknowledge");
    }
  };

  const saveReorderPoint = async (id) => {
    const rp = Number(editingRp[id]);
    if (Number.isNaN(rp)) return toast.error("Invalid reorder point");
    setSavingRpFor(id);
    try {
      await axios.patch(`/alerts/products/${id}/reorderPoint`, { reorderPoint: rp });
      toast.success("Updated reorder point");
      setEditingRp((s) => {
        const copy = { ...s };
        delete copy[id];
        return copy;
      });
      fetchAlerts();
    } catch (err) {
      console.error("save rp", err);
      toast.error("Failed to update");
    } finally {
      setSavingRpFor(null);
    }
  };

  const openRestockFor = (p) => {
    if (isStaff) {
      toast.error("You don't have permission to create restock orders");
      return;
    }
    if (onOpenRestock)
      return onOpenRestock([
        { modelNumber: p.modelNumber, qty: Math.max(1, Math.abs(p.lowBy) || 1), unitCost: 0 },
      ]);
    toast.info("Hook up onOpenRestock prop to open restock modal");
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <ToastContainer />
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Low Stock Alerts</h2>
          <div className="flex gap-3">
            <button
              onClick={fetchAlerts}
              className="px-4 py-2 border rounded-lg text-gray-700 bg-white hover:bg-gray-100 shadow-sm"
            >
              Refresh
            </button>
            {!isStaff && (
              <button
                onClick={bulkAcknowledge}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
              >
                Acknowledge Selected
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border">
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No low-stock products 🎉</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  {!isStaff && (
                    <th className="p-3 border w-12 text-center">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) setSelected(new Set(items.map((i) => i._id)));
                          else setSelected(new Set());
                        }}
                      />
                    </th>
                  )}
                  <th className="p-3 border text-left">Product</th>
                  <th className="p-3 border text-center">Stock</th>
                  <th className="p-3 border text-center">Reorder Point</th>
                  <th className="p-3 border text-center">Low By</th>
                  <th className="p-3 border text-center">Acknowledged</th>
                  <th className="p-3 border text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p, idx) => (
                  <tr
                    key={p._id}
                    className={`border-t ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } hover:bg-gray-100`}
                  >
                    {!isStaff && (
                      <td className="p-3 border text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(p._id)}
                          onChange={() => toggleSelect(p._id)}
                        />
                      </td>
                    )}
                    <td className="p-3 border">
                      <div className="font-medium text-gray-800">{p.productName || p.modelNumber}</div>
                      <div className="text-xs text-gray-500">{p.modelNumber}</div>
                    </td>
                    <td className="p-3 border text-center">{p.stockLevel}</td>
                    <td className="p-3 border text-center">
                      <div className="flex items-center justify-center gap-2">
                        <input
                          value={editingRp[p._id] ?? p.reorderPoint}
                          type="number"
                          className="w-20 border rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500"
                          onChange={(e) =>
                            setEditingRp((s) => ({ ...s, [p._id]: e.target.value }))
                          }
                        />
                        <button
                          disabled={savingRpFor === p._id}
                          onClick={() => saveReorderPoint(p._id)}
                          className="px-3 py-1 rounded-lg border text-gray-700 hover:bg-gray-200 text-xs"
                        >
                          {savingRpFor === p._id ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </td>
                    <td className="p-3 border text-center">{p.lowBy}</td>
                    <td className="p-3 border text-center">
                      {p.lowStockAcknowledgedAt ? (
                        <div>
                          <div className="text-gray-700">
                            {new Date(p.lowStockAcknowledgedAt).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">{p.lowStockAcknowledgedBy}</div>
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-red-600">Unacknowledged</span>
                      )}
                    </td>
                    <td className="p-3 border text-center">
                      {!isStaff ? (
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => ackSingle(p._id)}
                            className="px-3 py-1 rounded-lg border text-gray-700 hover:bg-gray-200 text-xs"
                          >
                            Acknowledge
                          </button>
                          <button
                            onClick={() => openRestockFor(p)}
                            className="px-3 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 text-xs"
                          >
                            Restock
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">No actions</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
