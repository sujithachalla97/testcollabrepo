// src/pages/Alerts.jsx
import { useEffect, useState } from "react";
import axios from "../api/axiosInstance";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * Props:
 *  - onOpenRestock(items) optional callback to open restock modal in parent
 */
export default function Alerts({ onOpenRestock }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [editingRp, setEditingRp] = useState({}); // id -> new rp
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
      setEditingRp((s) => { const copy = {...s}; delete copy[id]; return copy; });
      fetchAlerts();
    } catch (err) {
      console.error("save rp", err);
      toast.error("Failed to update");
    } finally {
      setSavingRpFor(null);
    }
  };

  const openRestockFor = (p) => {
    if (onOpenRestock) return onOpenRestock([{ modelNumber: p.modelNumber, qty: Math.max(1, Math.abs(p.lowBy) || 1), unitCost: 0 }]);
    // fallback: call restock endpoint directly (optional)
    toast.info("Hook up onOpenRestock prop to open restock modal");
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <ToastContainer />
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Low Stock Alerts</h2>
          <div className="flex gap-3">
            <button onClick={fetchAlerts} className="px-3 py-2 border rounded">Refresh</button>
            <button onClick={bulkAcknowledge} className="px-3 py-2 bg-indigo-600 text-white rounded">Acknowledge Selected</button>
          </div>
        </div>

        <div className="bg-white shadow rounded border overflow-hidden">
          {loading ? (
            <div className="p-6 text-center">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center">No low-stock products</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 border w-12"><input type="checkbox" onChange={(e)=> {
                    if (e.target.checked) setSelected(new Set(items.map(i=>i._id)));
                    else setSelected(new Set());
                  }} /></th>
                  <th className="p-2 border">Product</th>
                  <th className="p-2 border">Stock</th>
                  <th className="p-2 border">Reorder Point</th>
                  <th className="p-2 border">Low By</th>
                  <th className="p-2 border">Acknowledged</th>
                  <th className="p-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p._id} className="border-t">
                    <td className="p-2 border text-center">
                      <input type="checkbox" checked={selected.has(p._id)} onChange={()=>toggleSelect(p._id)} />
                    </td>
                    <td className="p-2 border">
                      <div className="font-medium">{p.productName || p.modelNumber}</div>
                      <div className="text-xs text-gray-500">{p.modelNumber}</div>
                    </td>
                    <td className="p-2 border">{p.stockLevel}</td>
                    <td className="p-2 border">
                      <div className="flex items-center gap-2">
                        <input
                          value={editingRp[p._id] ?? p.reorderPoint}
                          type="number"
                          className="w-24 border rounded px-2 py-1 text-sm"
                          onChange={(e)=> setEditingRp((s)=>({...s, [p._id]: e.target.value}))}
                        />
                        <button disabled={savingRpFor===p._id} onClick={()=>saveReorderPoint(p._id)} className="px-2 py-1 border rounded text-sm">Save</button>
                      </div>
                    </td>
                    <td className="p-2 border">{p.lowBy}</td>
                    <td className="p-2 border text-sm">
                      {p.lowStockAcknowledgedAt ? (
                        <div>
                          <div>Ack at {new Date(p.lowStockAcknowledgedAt).toLocaleString()}</div>
                          <div className="text-xs text-gray-500">{p.lowStockAcknowledgedBy}</div>
                        </div>
                      ) : (
                        <div className="text-sm text-red-600">Unacknowledged</div>
                      )}
                    </td>
                    <td className="p-2 border">
                      <div className="flex gap-2">
                        <button onClick={()=>ackSingle(p._id)} className="px-2 py-1 border rounded text-sm">Acknowledge</button>
                        <button onClick={()=>openRestockFor(p)} className="px-2 py-1 bg-green-600 text-white rounded text-sm">Restock</button>
                      </div>
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
