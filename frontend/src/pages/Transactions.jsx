// src/pages/Transactions.jsx
import { useEffect, useState } from "react";
import axios from "../api/axiosInstance";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

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
      setTransactions(list);
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
      const when = new Date(tx.createdAt || tx.createdAt || tx.createdAt).toISOString();
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

  /* ---------- render ---------- */
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <ToastContainer />
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Transactions</h2>
          <div className="flex gap-3">
            <button onClick={() => openModal("stockout")} className="px-3 py-2 bg-red-600 text-white rounded">New Stockout</button>
            <button onClick={() => openModal("restock")} className="px-3 py-2 bg-green-600 text-white rounded">New Restock</button>
            <button onClick={exportCSV} className="px-3 py-2 border rounded">Export CSV</button>
          </div>
        </div>

        <div className="bg-white shadow rounded border overflow-hidden">
          {loading ? (
            <div className="p-6 text-center">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="p-6 text-center">No transactions</div>
          ) : (
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 border">Type</th>
                  <th className="p-2 border">Date</th>
                  <th className="p-2 border">Items</th>
                  <th className="p-2 border">Notes</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx._id} className="border-t">
                    <td className="p-2 border">
                      <span className={`px-2 py-1 rounded text-xs ${tx.type === "stockout" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="p-2 border">{new Date(tx.createdAt).toLocaleString()}</td>
                    <td className="p-2 border">
                      {(tx.items || []).map((it, i) => (
                        <div key={i} className="text-sm">
                          {it.modelNumber} – {it.qty} pcs {it.productName ? `(${it.productName})` : ""}
                        </div>
                      ))}
                    </td>
                    <td className="p-2 border text-sm">{tx.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */ }
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={closeModal}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-2xl p-6 shadow-lg z-10">
            <header className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{type === "stockout" ? "New Stockout" : "New Restock"}</h3>
              <button onClick={closeModal}>✕</button>
            </header>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="col-span-5 border rounded px-2 py-2"
                    placeholder="Model Number"
                    value={it.modelNumber}
                    onChange={(e) => updateItem(idx, { modelNumber: e.target.value })}
                  />
                  <input
                    type="number"
                    className="col-span-3 border rounded px-2 py-2"
                    placeholder="Qty"
                    value={it.qty}
                    onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    className="col-span-3 border rounded px-2 py-2"
                    placeholder="Unit Cost"
                    value={it.unitCost}
                    onChange={(e) => updateItem(idx, { unitCost: Number(e.target.value) })}
                  />
                  <button className="col-span-1 px-2 py-1 border rounded" onClick={() => removeRow(idx)}>✕</button>
                </div>
              ))}
              <button className="px-3 py-2 border rounded" onClick={addRow}>Add Row</button>

              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Notes"
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

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={closeModal} className="px-3 py-2 border rounded">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-3 py-2 bg-indigo-600 text-white rounded"
              >
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
