// src/pages/Orders.jsx
import { useEffect, useState, useMemo } from "react";
import axios from "../api/axiosInstance";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * Orders page — search, filter, pagination, export, detail modal.
 * Expects backend:
 *  GET /orders?page=&limit=&q=&type=&status=  -> { page, limit, total, items }
 *  GET /orders/:id -> order (with supplierResolved or item.productSnapshot)
 */

const DEFAULT_LIMIT = 10;

const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const orderToCSV = (order) => {
  const headers = ["orderNumber", "type", "modelNumber", "productName", "qty", "unitCost", "totalCost", "supplierName"];
  const rows = [headers.join(",")];
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
  return rows.join("\n");
};

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

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const fetchOrders = async (p = page, l = limit, qparam = debouncedQ, type = typeFilter, status = statusFilter) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", p);
      params.set("limit", l);
      if (qparam) params.set("q", qparam);
      if (type && type !== "all") params.set("type", type);
      if (status && status !== "all") params.set("status", status);

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
  }, [page, limit, debouncedQ, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const supplierFor = (o) =>
    o.supplierResolved ||
    o.supplierName ||
    o.items?.[0]?.productSnapshot?.supplierName ||
    "-";

  const handleInvoice = async (order) => {
  if (!order?._id) return;
  try {
    const res = await axios.get(`/orders/${order._id}/invoice`, {
      responseType: "blob", // important for binary
    });
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


  const handleExportVisible = () => {
    if (!orders.length) return toast.info("No orders to export");
    // combine CSV rows of visible orders
    const combined = orders.map(orderToCSV).join("\n");
    exportCSV(`orders-page${page}-${Date.now()}.csv`, combined);
    toast.success("Visible orders exported");
  };

  // fetch fresh order details for modal
  const openDetail = async (order) => {
    if (!order?._id) { setDetailOrder(order); return; }
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

  // quick UI: reset filters
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
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-semibold text-gray-800">Orders</h2>
            <p className="text-sm text-gray-500">
              Purchase & restock orders — audit trail of stock changes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border rounded px-3 py-2 shadow-sm">
              <svg
                className="w-4 h-4 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M21 21l-4.35-4.35"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                placeholder="Search order number, model, product, notes..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="outline-none text-sm w-72"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  className="text-xs text-gray-500 ml-2"
                >
                  Clear
                </button>
              )}
            </div>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="border rounded px-3 py-2 bg-white text-sm"
            >
              <option value="all">All types</option>
              <option value="restock">Restock</option>
              <option value="purchase">Purchase</option>
              <option value="adjustment">Adjustment</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="border rounded px-3 py-2 bg-white text-sm"
            >
              <option value="all">All status</option>
              <option value="received">Received</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded px-2 py-2 bg-white text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportVisible}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm"
              >
                Export{" "}
              </button>
            </div>
          </div>
        </div>

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
                  <td colSpan={8} className="p-8 text-center">
                    Loading...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o._id ?? o.orderNumber}
                    className="border-t hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-medium">{o.orderNumber}</td>
                    <td className="px-4 py-3">{o.type}</td>
                    <td className="px-4 py-3">{o.items?.length || 0}</td>
                    <td className="px-4 py-3">{o.subtotal ?? 0}</td>
                    <td className="px-4 py-3">{supplierFor(o)}</td>
                    <td className="px-4 py-3">{o.status}</td>
                    <td className="px-4 py-3">
                      {o.createdAt
                        ? new Date(o.createdAt).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openDetail(o)}
                          className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleExportOrder(o)}
                          className="px-3 py-1 rounded border text-sm"
                        >
                          Export
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
            <button
              onClick={() => {
                setPage(1);
              }}
              disabled={page === 1}
              className="px-2 py-1 border rounded"
            >
              First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 border rounded"
            >
              Prev
            </button>

            <div className="px-2 py-1 border rounded flex items-center gap-2">
              Page
              <input
                type="number"
                min={1}
                max={totalPages}
                value={page}
                onChange={(e) =>
                  setPage(
                    Math.max(
                      1,
                      Math.min(totalPages, Number(e.target.value) || 1)
                    )
                  )
                }
                className="ml-2 w-16 text-sm"
              />
              / {totalPages}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 border rounded"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 border rounded"
            >
              Last
            </button>
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
                <h3 className="text-lg font-semibold">
                  {detailOrder.orderNumber || "Order"}
                </h3>
                <div className="text-sm text-gray-500">
                  {detailOrder.type} • {detailOrder.status}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Supplier: {detailOrder.supplierResolved || "-"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleInvoice(detailOrder)}
                  className="px-3 py-1 border rounded text-sm"
                >
                  Invoice
                </button>{" "}
                <button
                  onClick={closeDetail}
                  className="px-3 py-1 rounded bg-gray-100 text-sm"
                >
                  Close
                </button>
              </div>
            </header>

            <div className="mb-3 text-sm text-gray-700">
              Notes: {detailOrder.notes || "-"}
            </div>

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
                      <td className="px-4 py-2">
                        {it.totalCost ?? (it.qty || 0) * (it.unitCost || 0)}
                      </td>
                      <td className="px-4 py-2">
                        {it.productSnapshot?.supplierName || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Created:{" "}
                {detailOrder.createdAt
                  ? new Date(detailOrder.createdAt).toLocaleString()
                  : "-"}
              </div>
              <div className="text-sm font-medium">
                Subtotal: {detailOrder.subtotal ?? 0}
              </div>
            </div>

            {detailLoading && (
              <div className="text-xs text-gray-500 mt-2">
                Refreshing details…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
