import React, { useEffect, useState } from "react";
import axios from "../api/axiosInstance";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../context/AuthContext";
import { Plus, Download, X, PlusSquare, Trash2 } from "lucide-react";

export default function Transactions() {
  const { user: currentUser } = useAuth();
  const isStaff = currentUser?.role === "staff";

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  // UI helpers
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState("stockout");
  const [items, setItems] = useState([{ modelNumber: "", qty: 1, unitCost: 0 }]);
  const [notes, setNotes] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* ---------- fetch transactions ---------- */
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/transactions").then((r) => r.data);
      const list = res.items ?? (Array.isArray(res) ? res : []);
      setTransactions((list || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (err) {
      console.error("fetch tx", err);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  /* ---------- modal helpers ---------- */
  const openModal = (t) => {
    if (isStaff) {
      toast.info("No permission");
      return;
    }
    setType(t);
    setItems([{ modelNumber: "", qty: 1, unitCost: 0 }]);
    setNotes("");
    setAllowNegative(false);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addRow = () => setItems((prev) => [...prev, { modelNumber: "", qty: 1, unitCost: 0 }]);
  const removeRow = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  /* ---------- submit ---------- */
  const handleSubmit = async () => {
    if (isStaff) {
      toast.info("No permission");
      return;
    }
    if (!items.every((it) => it.modelNumber && it.qty > 0)) {
      return toast.error("Fill in all model numbers and valid qty");
    }
    setSubmitting(true);
    try {
      if (type === "stockout") {
        const res = await axios.post("/transactions/stockout", { items, notes, allowNegative });
        if (res.data?.ok) {
          toast.success("Stockout recorded");
        } else {
          throw new Error(res.data?.error || "Failed");
        }
      } else {
        const res = await axios.post("/transactions/restock", { items, notes });
        if (res.data?.ok) {
          toast.success("Restock recorded");
        } else {
          throw new Error(res.data?.error || "Failed");
        }
      }
      closeModal();
      fetchTransactions();
    } catch (err) {
      console.error("submit tx", err);
      toast.error(err.response?.data?.error || err.message || "Failed to save transaction");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- CSV export ---------- */
  const exportCSV = () => {
    if (!transactions || transactions.length === 0) return toast.info("No transactions");
    const headers = ["type", "date", "modelNumber", "productName", "qty", "unitCost", "totalCost", "notes"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [headers.join(",")];
    transactions.forEach((tx) => {
      const when = new Date(tx.createdAt || Date.now()).toISOString();
      (tx.items || []).forEach((it) => {
        lines.push([
          esc(tx.type),
          esc(when),
          esc(it.modelNumber),
          esc(it.productName),
          esc(it.qty),
          esc(it.unitCost),
          esc(it.totalCost),
          esc(tx.notes || "")
        ].join(","));
      });
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  /* ---------- filtering ---------- */
  const filtered = transactions.filter((tx) => {
    if (typeFilter !== "all" && tx.type !== typeFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    if ((tx.notes || "").toLowerCase().includes(q)) return true;
    if ((tx.items || []).some((it) => (it.modelNumber || "").toLowerCase().includes(q) || (it.productName || "").toLowerCase().includes(q))) return true;
    return false;
  });

  const totalItems = transactions.reduce((s, tx) => s + (tx.items ? tx.items.reduce((a, b) => a + (b.qty || 0), 0) : 0), 0);

  /* ---------- render ---------- */
  return (
    <div className="p-6 bg-gradient-to-br from-white to-gray-50 min-h-screen">
      <ToastContainer />
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900">Transactions</h2>
            <p className="text-sm text-gray-500 mt-1">Record stock movements, export reports, and review history.</p>
          </div>

          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2 border rounded-lg px-3 py-2 shadow-sm bg-white">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search model, product or notes..."
                className="outline-none text-sm placeholder-gray-400 w-64"
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-sm bg-transparent outline-none"
              >
                <option value="all">All</option>
                <option value="stockout">Stockouts</option>
                <option value="restock">Restocks</option>
              </select>
            </div>

            {!isStaff ? (
              <>
                <button onClick={() => openModal("stockout")} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg shadow">
                  <Plus />
                  New Stockout
                </button>
                <button onClick={() => openModal("restock")} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg shadow">
                  <PlusSquare />
                  New Restock
                </button>
              </>
            ) : (
              <div className="text-sm text-gray-500">Staff — view only</div>
            )}

            <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-white shadow-sm">
              <Download /> Export
            </button>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg border overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b">
            <div className="text-sm text-gray-600">
              Showing <span className="font-medium">{filtered.length}</span> of{" "}
              <span className="font-medium">{transactions.length}</span> transactions •{" "}
              <span className="font-medium">{totalItems}</span> units moved
            </div>
            <div className="text-sm text-gray-500">Latest first</div>
          </div>

          {loading ? (
            <div className="p-10 text-center">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No transactions found</div>
          ) : (
            <div className="p-4 overflow-x-auto">
              <table className="min-w-full border border-gray-200 text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Items</th>
                    <th className="px-4 py-2 text-left">Notes</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx) => (
                    <tr key={tx._id} className="border-t hover:bg-gray-50 transition">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 font-medium">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            tx.type === "stockout"
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {tx.type === "stockout" ? "Stockout" : "Restock"}
                        </span>
                      </td>
                      <td className="px-4 py-2 max-w-xs break-words">
                        {(tx.items || []).slice(0, 3).map((it, i) => (
                          <span
                            key={i}
                            className="inline-block mr-2 bg-gray-50 px-2 py-0.5 rounded"
                          >
                            {it.modelNumber} × {it.qty}
                            {it.productName ? ` (${it.productName})` : ""}
                          </span>
                        ))}
                        {(tx.items || []).length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{(tx.items || []).length - 3} more
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {tx.notes || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {(tx.items || []).reduce((s, it) => s + (it.qty || 0), 0)} pcs
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(JSON.stringify(tx, null, 2));
                            toast.success("Copied transaction JSON");
                          }}
                          className="px-3 py-1 border rounded text-sm hover:bg-gray-100"
                        >
                          Copy
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal}></div>
          <div className="relative w-full max-w-3xl bg-white rounded-2xl p-6 shadow-2xl z-10">
            <header className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold">
                  {type === "stockout" ? "Record Stockout" : "Record Restock"}
                </h3>
                <div className="text-sm text-gray-500">Add items moved and optional notes</div>
              </div>
              <button onClick={closeModal} className="p-2 rounded hover:bg-gray-100"><X /></button>
            </header>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="col-span-5 border rounded px-3 py-2 shadow-sm"
                    placeholder="Model Number"
                    value={it.modelNumber}
                    onChange={(e) => updateItem(idx, { modelNumber: e.target.value })}
                  />
                  <input
                    type="number"
                    className="col-span-2 border rounded px-3 py-2 shadow-sm"
                    placeholder="Qty"
                    value={it.qty}
                    onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    className="col-span-3 border rounded px-3 py-2 shadow-sm"
                    placeholder="Unit Cost"
                    value={it.unitCost}
                    onChange={(e) => updateItem(idx, { unitCost: Number(e.target.value) })}
                  />
                  <div className="col-span-2 flex gap-2 justify-end">
                    <button className="px-3 py-1 border rounded" onClick={() => removeRow(idx)}><Trash2 size={16} /></button>
                    {idx === items.length - 1 && (
                      <button className="px-3 py-1 border rounded bg-indigo-50" onClick={addRow}><Plus size={16} /></button>
                    )}
                  </div>
                </div>
              ))}

              <textarea
                className="w-full border rounded px-3 py-2 shadow-sm"
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              {type === "stockout" && (
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={allowNegative} onChange={(e) => setAllowNegative(e.target.checked)} />
                  Allow negative stock
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={closeModal} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow"
              >
                {submitting ? "Saving..." : "Save Transaction"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
