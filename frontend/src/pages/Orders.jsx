// src/pages/Orders.jsx
import { useEffect, useState } from "react";
import axios from "../api/axiosInstance";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const DEFAULT_LIMIT = 10;
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);

  // confirm modal state
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState(null);

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const fetchOrders = async (
    p = page,
    l = limit,
    qparam = debouncedQ,
    type = typeFilter,
    status = statusFilter,
    deleted = showDeleted
  ) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", p);
      params.set("limit", l);
      if (qparam) params.set("q", qparam);
      if (type && type !== "all") params.set("type", type);
      if (status && status !== "all") params.set("status", status);
      if (deleted) params.set("deleted", "true");

      const res = await axios.get(`/orders?${params.toString()}`);
      const data = res.data ?? res;
      setOrders(data.items || []);
      setTotal(typeof data.total === "number" ? data.total : (data.items || []).length);
      setPage(data.page || p);
      setLimit(data.limit || l);
    } catch (err) {
      console.error("fetchOrders", err);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line
  }, [page, limit, debouncedQ, typeFilter, statusFilter, showDeleted]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // ---- CSV helpers ----
  const exportCSV = (filename, text) => {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const orderItemsRows = (order) => {
    const rows = [];
    for (const it of order.items || []) {
      const row = [
        esc(order.orderNumber),
        esc(order.type),
        esc(it.modelNumber),
        esc(it.productName),
        esc(it.qty),
        esc(it.unitCost),
        esc(it.totalCost ?? (it.qty || 0) * (it.unitCost || 0)),
        esc(it.productSnapshot?.supplierName || order.supplierResolved || order.supplierName || ""),
      ];
      rows.push(row.join(","));
    }
    return rows;
  };

  const handleExportVisible = () => {
    if (!orders || orders.length === 0) {
      toast.info("No orders to export");
      return;
    }
    const headers = ["orderNumber", "type", "modelNumber", "productName", "qty", "unitCost", "totalCost", "supplierName"];
    const lines = [headers.join(",")];
    for (const ord of orders) {
      const rows = orderItemsRows(ord);
      if (rows.length === 0) {
        const emptyRow = [
          esc(ord.orderNumber),
          esc(ord.type),
          "",
          "",
          0,
          0,
          0,
          esc(ord.supplierResolved || ord.supplierName || ""),
        ].join(",");
        lines.push(emptyRow);
      } else {
        lines.push(...rows);
      }
    }
    const scope = showDeleted ? "deleted" : "active";
    exportCSV(`orders-${scope}-page${page}-${Date.now()}.csv`, lines.join("\n"));
    toast.success("Visible orders exported");
  };
  // ---- end CSV helpers ----

  const supplierFor = (o) =>
    o.supplierResolved || o.supplierName || o.items?.[0]?.productSnapshot?.supplierName || "-";

  const handleInvoice = async (order) => {
    if (!order?._id) return;
    try {
      const res = await axios.get(`/orders/${order._id}/invoice`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${order.orderNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Invoice generated");
    } catch (err) {
      console.error("invoice error", err);
      toast.error("Failed to generate invoice");
    }
  };

  const confirmDelete = (order) => {
    setConfirmDeleteOrder(order);
  };

  const handleDelete = async () => {
    if (!confirmDeleteOrder?._id) return;
    try {
      setDeletingId(confirmDeleteOrder._id);
      await axios.delete(`/orders/${confirmDeleteOrder._id}`);
      setOrders((prev) => prev.filter((o) => o._id !== confirmDeleteOrder._id));
      setTotal((t) => Math.max(0, t - 1));
      if (detailOrder && detailOrder._id === confirmDeleteOrder._id) setDetailOrder(null);
      toast.success("Order deleted");
      fetchOrders(page, limit);
    } catch (err) {
      console.error("delete order", err);
      toast.error("Failed to delete order");
    } finally {
      setDeletingId(null);
      setConfirmDeleteOrder(null);
    }
  };

  const handleRestore = async (order) => {
    if (!order?._id) return toast.error("Missing id");
    try {
      setLoading(true);
      await axios.post(`/orders/${order._id}/restore`).catch(async () => {
        await axios.patch(`/orders/${order._id}`, { deleted: false });
      });
      toast.success("Order restored");
      fetchOrders(page, limit);
    } catch (err) {
      console.error("restore", err);
      toast.error("Failed to restore order");
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (order) => {
    if (!order?._id) {
      setDetailOrder(order);
      return;
    }
    try {
      setDetailLoading(true);
      const res = await axios.get(`/orders/${order._id}`);
      const data = res.data ?? res;
      const normalized = {
        ...data,
        supplierResolved:
          data.supplierResolved ||
          data.supplierName ||
          data.items?.[0]?.productSnapshot?.supplierName ||
          null,
      };
      setDetailOrder(normalized);
    } catch (err) {
      console.error("openDetail", err);
      toast.error("Could not load order details — showing cached row");
      setDetailOrder(order);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => setDetailOrder(null);

  const resetFilters = () => {
    setQ("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <ToastContainer position="top-right" />
      <div className="max-w-6xl mx-auto">
        {/* Header row */}
       {/* Header row — responsive so toggle won't get shoved into the action bar */}
<div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
  <div className="w-full md:w-auto">
    <h2 className="text-3xl font-semibold text-gray-800">Orders</h2>
    <p className="text-sm text-gray-500">Purchase & restock orders — audit trail of stock changes.</p>

  
  </div>

  {/* Action bar — stays on the right on medium+ screens, flows below on small screens */}
  {/* Action bar — right side controls */}
<div className="w-full md:w-auto flex flex-wrap items-center gap-3 justify-end">
  <div className="flex items-center gap-2 bg-white border rounded px-3 py-2 shadow-sm">
    <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none">
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <input
      placeholder="Search order number, model, product, notes..."
      value={q}
      onChange={(e) => { setQ(e.target.value); setPage(1); }}
      className="outline-none text-sm w-72"
    />
    {q && (<button onClick={() => setQ("")} className="text-xs text-gray-500 ml-2">Clear</button>)}
  </div>

  {/* filters */}
  <select value={typeFilter} onChange={(e)=>{ setTypeFilter(e.target.value); setPage(1); }} className="border rounded px-3 py-2 bg-white text-sm" disabled={showDeleted}>
    <option value="all">All types</option>
    <option value="restock">Restock</option>
    <option value="purchase">Purchase</option>
    <option value="adjustment">Adjustment</option>
  </select>

  <select value={statusFilter} onChange={(e)=>{ setStatusFilter(e.target.value); setPage(1); }} className="border rounded px-3 py-2 bg-white text-sm" disabled={showDeleted}>
    <option value="all">All status</option>
    <option value="received">Received</option>
    <option value="pending">Pending</option>
    <option value="cancelled">Cancelled</option>
  </select>

  <select value={limit} onChange={(e)=>{ setLimit(Number(e.target.value)); setPage(1); }} className="border rounded px-2 py-2 bg-white text-sm">
    <option value={10}>10</option>
    <option value={25}>25</option>
    <option value={50}>50</option>
    <option value={100}>100</option>
  </select>

  <button onClick={handleExportVisible} className="px-4 py-2 bg-green-600 text-white rounded text-sm">Export</button>

  {/* Deleted toggle now placed at far right */}
  <button
    type="button"
    role="switch"
    aria-checked={showDeleted}
    onClick={() => { setShowDeleted((v) => !v); setPage(1); }}
    className={`px-4 py-2 rounded text-sm font-medium shadow-sm transition ${
      showDeleted ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700"
    }`}
  >
    {showDeleted ? "Viewing Deleted" : "View Deleted"}
  </button>
</div>

</div>


        {/* Orders table */}
        <div className="bg-white shadow-sm rounded border overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-gray-700">Order #</th>
                <th className="text-left px-4 py-3 text-gray-700">Type</th>
                <th className="text-left px-4 py-3 text-gray-700">Items</th>
                <th className="text-left px-4 py-3 text-gray-700">Subtotal</th>
                <th className="text-left px-4 py-3 text-gray-700">Supplier</th>
                <th className="text-left px-4 py-3 text-gray-700">Status</th>
                <th className="text-left px-4 py-3 text-gray-700">Created</th>
                <th className="text-left px-4 py-3 text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">Loading...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">No orders found</td>
                </tr>
              ) : (
                orders.map((o) => {
                  const isDeleted = !!o.deleted || o.status === "deleted";
                  return (
                    <tr key={o._id ?? o.orderNumber} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{o.orderNumber}</td>
                      <td className="px-4 py-3">{o.type}</td>
                      <td className="px-4 py-3">{o.items?.length || 0}</td>
                      <td className="px-4 py-3">{o.subtotal ?? 0}</td>
                      <td className="px-4 py-3">
                        {supplierFor(o)}
                        {isDeleted && (
                          <span className="ml-2 inline-block bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">
                            Deleted
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{o.status}</td>
                      <td className="px-4 py-3">
                        {o.createdAt ? new Date(o.createdAt).toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openDetail(o)}
                            className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
                          >
                            View
                          </button>
                          {isDeleted ? (
                            <button
                              onClick={() => handleRestore(o)}
                              className="px-3 py-1 rounded border text-sm"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              onClick={() => confirmDelete(o)}
                              disabled={deletingId === o._id}
                              className={`px-3 py-1 rounded text-sm ${
                                deletingId === o._id ? "opacity-60 cursor-not-allowed border" : "bg-red-600 text-white"
                              }`}
                            >
                              {deletingId === o._id ? "Deleting…" : "Delete"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing page {page} of {totalPages} • {total} total
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 border rounded">First</button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 border rounded">Prev</button>

            <div className="px-2 py-1 border rounded flex items-center gap-2">
              Page
              <input
                type="number"
                min={1}
                max={totalPages}
                value={page}
                onChange={(e) => setPage(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))}
                className="ml-2 w-16 text-sm"
              />
              / {totalPages}
            </div>

            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 border rounded">Next</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 border rounded">Last</button>
          </div>
        </div>
      </div>

      {/* detail modal */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={closeDetail} />
          <div className="relative w-full max-w-3xl bg-white rounded-2xl p-6 z-10">
            <header className="flex items-start justify-between mb-4 gap-4">
              <div>
                <h3 className="text-lg font-semibold">{detailOrder.orderNumber || "Order"}</h3>
                <div className="text-sm text-gray-500">
                  {detailOrder.type} • {detailOrder.status}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Supplier: {detailOrder.supplierResolved || "-"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(!detailOrder.deleted && detailOrder.status !== "deleted") && (
                  <button onClick={() => handleInvoice(detailOrder)} className="px-3 py-1 border rounded text-sm">
                    Invoice
                  </button>
                )}
                {(detailOrder.deleted || detailOrder.status === "deleted") ? (
                  <button onClick={() => handleRestore(detailOrder)} className="px-3 py-1 rounded border text-sm">
                    Restore
                  </button>
                ) : (
                  <button
                    onClick={() => confirmDelete(detailOrder)}
                    disabled={deletingId === detailOrder._id}
                    className={`px-3 py-1 rounded text-sm ${deletingId === detailOrder._id ? "opacity-60 cursor-not-allowed border" : "bg-red-600 text-white"}`}
                  >
                    {deletingId === detailOrder._id ? "Deleting…" : "Delete"}
                  </button>
                )}
                <button onClick={closeDetail} className="px-3 py-1 rounded bg-gray-100 text-sm">Close</button>
              </div>
            </header>

            <div className="mb-3 text-sm text-gray-700">Notes: {detailOrder.notes || "-"}</div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2">Model</th>
                    <th className="text-left px-4 py-2">Name</th>
                    <th className="text-left px-4 py-2">Qty</th>
                    <th className="text-left px-4 py-2">Unit Cost</th>
                    <th className="text-left px-4 py-2">Total</th>
                    <th className="text-left px-4 py-2">Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailOrder.items || []).map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-2">{it.modelNumber}</td>
                      <td className="px-4 py-2">{it.productName}</td>
                      <td className="px-4 py-2">{it.qty}</td>
                      <td className="px-4 py-2">{it.unitCost ?? 0}</td>
                      <td className="px-4 py-2">{it.totalCost ?? (it.qty || 0) * (it.unitCost || 0)}</td>
                      <td className="px-4 py-2">{it.productSnapshot?.supplierName || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Created: {detailOrder.createdAt ? new Date(detailOrder.createdAt).toLocaleString() : "-"}
              </div>
              <div className="text-sm font-medium">Subtotal: {detailOrder.subtotal ?? 0}</div>
            </div>

            {detailLoading && <div className="text-xs text-gray-500 mt-2">Refreshing details…</div>}
          </div>
        </div>
      )}

      {/* confirmation modal */}
      {confirmDeleteOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeleteOrder(null)} />
          <div className="relative w-full max-w-md bg-white rounded-xl p-6 z-10 shadow-lg">
            <h4 className="text-lg font-semibold mb-2">Confirm delete</h4>
            <p className="text-sm text-gray-700 mb-4">
              Are you sure you want to delete{" "}
              <span className="font-medium">{confirmDeleteOrder.orderNumber || confirmDeleteOrder._id}</span>?
              This will mark the order as deleted and can be restored later.
            </p>

            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteOrder(null)} className="px-4 py-2 rounded border text-sm">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deletingId === confirmDeleteOrder._id}
                className="px-4 py-2 rounded bg-red-600 text-white text-sm"
              >
                {deletingId === confirmDeleteOrder._id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
