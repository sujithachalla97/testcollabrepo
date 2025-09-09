// src/pages/Products.jsx
import { useEffect, useState, useRef, useMemo } from "react";
import axios from "../api/axiosInstance";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* small UI icons */
const Icon = ({ name, className = "w-4 h-4", colorClass = "text-gray-600" }) => {
  const common = `${className} ${colorClass}`;
  if (name === "search")
    return (
      <svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8.75 15.5a6.75 6.75 0 1 1 4.78-11.53 6.75 6.75 0 0 1-4.78 11.53z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 17l-3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (name === "plus")
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return null;
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // modal & form
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    productName: "",
    modelNumber: "",
    productCategoryName: "",
    stockLevel: 0,
    reorderPoint: 0,
    status: "active",
    supplierName: "",
    supplierMail: "",
    supplierContact: "",
  });

  const fileInputRef = useRef(null);

  // search/filter/pagination
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [stockFilter, setStockFilter] = useState("all"); // all | in | low | out

  const [selected, setSelected] = useState({}); // selected modelNumbers map

  /* ---------- fetch helpers ---------- */
  const fetchAllProducts = async () => {
    try {
      const tryAll = await axios.get("/products?limit=0").then((r) => r.data.items ?? r.data ?? []);
      if (Array.isArray(tryAll)) return tryAll;
    } catch (e) {}
    const gathered = [];
    const batchSize = 200;
    let p = 1;
    while (true) {
      const resp = await axios.get(`/products?page=${p}&limit=${batchSize}`).then((r) => r.data.items ?? r.data ?? []);
      if (!Array.isArray(resp) || resp.length === 0) break;
      gathered.push(...resp);
      if (resp.length < batchSize) break;
      p++;
      if (p > 50) break;
    }
    return gathered;
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      if (pageSize === "all" || pageSize === 0) {
        const all = await fetchAllProducts();
        setProducts(all);
        setPage(1);
      } else {
        try {
          const res = await axios.get(`/products?page=${page}&limit=${pageSize}`).then((r) => r.data.items ?? r.data ?? []);
          if (Array.isArray(res)) setProducts(res);
          else {
            const all = await fetchAllProducts();
            setProducts(all);
          }
        } catch (err) {
          const all = await fetchAllProducts();
          setProducts(all);
        }
      }
    } catch (err) {
      toast.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [q]);

  /* ---------- client-side filtering/pagination ---------- */
  const categories = useMemo(() => {
    const s = new Set();
    products.forEach((p) => p.productCategoryName && s.add(p.productCategoryName));
    return ["all", ...Array.from(s).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const term = debouncedQ;
    let list = products;
    if (term) {
      list = list.filter((p) => `${p.productName ?? ""} ${p.modelNumber ?? ""} ${p.productCategoryName ?? ""} ${p.supplierName ?? ""}`.toLowerCase().includes(term));
    }
    if (categoryFilter !== "all") list = list.filter((p) => (p.productCategoryName ?? "").toLowerCase() === categoryFilter.toLowerCase());
    if (stockFilter === "in") list = list.filter((p) => (p.stockLevel ?? 0) > (p.reorderPoint ?? 0));
    if (stockFilter === "low") list = list.filter((p) => (p.stockLevel ?? 0) <= (p.reorderPoint ?? 0) && (p.stockLevel ?? 0) > 0);
    if (stockFilter === "out") list = list.filter((p) => (p.stockLevel ?? 0) === 0);
    return list;
  }, [products, debouncedQ, categoryFilter, stockFilter]);

  const total = filtered.length;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pageItems = useMemo(() => {
    if (pageSize === "all" || pageSize === 0) return filtered;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const selectAll = useMemo(() => {
    if (!pageItems || pageItems.length === 0) return false;
    const keys = pageItems.map((p) => p.modelNumber).filter(Boolean);
    return keys.length > 0 && keys.every((k) => !!selected[k]);
  }, [pageItems, selected]);

  /* ---------- selection helpers ---------- */
  const toggleSelect = (model) => setSelected((s) => ({ ...s, [model]: !s[model] ? true : undefined }));
  const toggleSelectAll = () => {
    const keys = pageItems.map((p) => p.modelNumber).filter(Boolean);
    const allSelected = keys.length > 0 && keys.every((k) => selected[k]);
    if (allSelected) {
      setSelected((s) => {
        const copy = { ...s };
        keys.forEach((k) => delete copy[k]);
        return copy;
      });
    } else {
      setSelected((s) => {
        const copy = { ...s };
        keys.forEach((k) => (copy[k] = true));
        return copy;
      });
    }
  };

  /* ---------- BULK RESTOCK — now calls server endpoint that creates an Order ---------- */
  const handleBulkRestock = async () => {
    const models = Object.keys(selected).filter(Boolean);
    if (models.length === 0) {
      toast.info("No products selected");
      return;
    }
    const qtyStr = window.prompt(`Enter quantity to add to ${models.length} selected product(s):`, "10");
    if (!qtyStr) return;
    const qty = Number(qtyStr);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid positive number");
      return;
    }

    // build payload: items: [{ modelNumber, qty }]
    const items = models.map((m) => ({ modelNumber: m, qty }));

    try {
      setLoading(true);
      const res = await axios.post("/products/bulk-restock-order", { items, notes: "Bulk restock from UI" });
      const order = res.data?.order ?? res.data;
      toast.success(order?.orderNumber ? `Restocked — Order ${order.orderNumber}` : "Restocked (order created)");
      setSelected({});
      await fetchProducts();
    } catch (err) {
      console.error("bulk restock error", err);
      toast.error(err.response?.data?.error || "Bulk restock failed");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- product create/update/delete (same as before) ---------- */
  const openModal = (product = null) => {
    setEditingProduct(product);
    if (product) {
      setFormData({
        productName: product.productName || "",
        modelNumber: product.modelNumber || "",
        productCategoryName: product.productCategoryName || "",
        stockLevel: product.stockLevel ?? 0,
        reorderPoint: product.reorderPoint ?? 0,
        status: product.status || "active",
        supplierName: product.supplierName || "",
        supplierMail: product.supplierMail || "",
        supplierContact: product.supplierContact || "",
      });
    } else {
      setFormData({ productName: "", modelNumber: "", productCategoryName: "", stockLevel: 0, reorderPoint: 0, status: "active", supplierName: "", supplierMail: "", supplierContact: "" });
    }
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.productName || !formData.modelNumber) {
      toast.warning("Name and Model required");
      return;
    }
    try {
      if (editingProduct) {
        await axios.patch(`/products/${editingProduct.modelNumber}`, formData);
        toast.success("Product updated");
      } else {
        await axios.post("/products", formData);
        toast.success("Product added");
      }
      await fetchProducts();
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error("Save failed");
    }
  };

  const handleDelete = async (model) => {
    if (!window.confirm("Delete product?")) return;
    try {
      await axios.delete(`/products/${model}`);
      toast.success("Deleted");
      await fetchProducts();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  /* CSV export (includes supplierName) */
  const toCSV = (items) => {
    const headers = ["productName", "modelNumber", "productCategoryName", "stockLevel", "reorderPoint", "supplierName", "status"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [headers.join(",")];
    for (const it of items) lines.push(headers.map((h) => esc(it[h] ?? "")).join(","));
    return lines.join("\n");
  };
  const handleExportCSV = () => {
    if (!products || products.length === 0) return toast.info("No products to export");
    const csv = toCSV(products);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${Date.now()}.csv`;
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
          <div>
            <h2 className="text-3xl font-semibold text-gray-800">Products</h2>
            <p className="text-sm text-gray-500">Manage products, stock and restock orders.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border rounded p-2 shadow-sm">
              <Icon name="search" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search..." className="outline-none text-sm" />
            </div>

            <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="border rounded px-3 py-2 bg-white text-sm">
              {categories.map((c) => <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>)}
            </select>

            <select value={stockFilter} onChange={(e) => { setStockFilter(e.target.value); setPage(1); }} className="border rounded px-3 py-2 bg-white text-sm">
              <option value="all">All stock</option>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>

            <select value={pageSize === "all" ? "all" : pageSize} onChange={async (e) => {
              const v = e.target.value === "all" ? "all" : Number(e.target.value);
              setPageSize(v); setPage(1);
              if (v === "all") {
                setLoading(true);
                try { const all = await fetchAllProducts(); setProducts(all); } catch (err) { toast.error("Failed"); } finally { setLoading(false); }
              }
            }} className="border rounded px-2 py-2 bg-white text-sm">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">All</option>
            </select>

            <button onClick={() => openModal()} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded shadow">
              <Icon name="plus" colorClass="text-white" /> Add
            </button>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded border overflow-hidden">
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={Object.keys(selected).length > 0} readOnly /> <span className="text-sm">Selected {Object.keys(selected).length}</span>
              </label>
              <button onClick={handleBulkRestock} className="px-3 py-1 rounded bg-green-600 text-white">Restock selected</button>
              <button onClick={() => setSelected({})} className="px-3 py-1 rounded border">Clear selection</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExportCSV} className="px-3 py-1 rounded border">Export CSV</button>
            </div>
          </div>

          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-3 py-2"><input type="checkbox" onChange={toggleSelectAll} checked={selectAll} /></th>
                <th className="border px-4 py-2 text-left">Name</th>
                <th className="border px-4 py-2 text-left">Model</th>
                <th className="border px-4 py-2 text-left">Category</th>
                <th className="border px-4 py-2 text-left">Supplier</th>
                <th className="border px-4 py-2 text-left">Stock</th>
                <th className="border px-4 py-2 text-left">Reorder</th>
                <th className="border px-4 py-2 text-left">Status</th>
                <th className="border px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" className="p-8 text-center">Loading...</td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan="9" className="p-8 text-center">No products</td></tr>
              ) : pageItems.map((p) => {
                const out = (p.stockLevel ?? 0) === 0;
                const low = (p.stockLevel ?? 0) <= (p.reorderPoint ?? 0) && !out;
                return (
                  <tr key={p.modelNumber} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-3"><input type="checkbox" checked={!!selected[p.modelNumber]} onChange={() => toggleSelect(p.modelNumber)} /></td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.productName}</div>
                    </td>
                    <td className="px-4 py-3">{p.modelNumber}</td>
                    <td className="px-4 py-3">{p.productCategoryName}</td>
                    <td className="px-4 py-3">{p.supplierName || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2">
                        <div className={`px-2 py-0.5 rounded text-sm font-medium ${out ? "bg-red-700 text-white" : low ? "bg-red-500 text-white" : "bg-gray-100 text-gray-800"}`}>{p.stockLevel}</div>
                        {out ? <div className="text-xs text-red-700 font-semibold">Out</div> : low ? <div className="text-xs text-red-600">Low</div> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">{p.reorderPoint}</td>
                    <td className="px-4 py-3"><span className="inline-block px-2 py-1 rounded-full text-xs">{p.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openModal(p)} className="px-3 py-1 rounded bg-yellow-400">Edit</button>
                        <button onClick={() => handleDelete(p.modelNumber)} className="px-3 py-1 rounded bg-red-600 text-white">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-600">Showing page {page} of {totalPages} • {total} total</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 border rounded">First</button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 border rounded">Prev</button>
            <div className="px-2 py-1 border rounded flex items-center gap-2">
              Page <input type="number" min={1} max={totalPages} value={page} onChange={(e) => setPage(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))} className="ml-2 w-16" />
              <span>/ {totalPages}</span>
            </div>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 border rounded">Next</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 border rounded">Last</button>
          </div>
        </div>
      </div>

      {/* modal for add/edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={closeModal} />
          <div className="relative w-full max-w-xl bg-white rounded-2xl p-6 shadow-lg z-10">
            <header className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingProduct ? "Edit Product" : "Add Product"}</h3>
              <button onClick={closeModal} className="text-gray-600">✕</button>
            </header>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-xs text-gray-600">Name</label>
                <input name="productName" value={formData.productName} onChange={(e) => setFormData({ ...formData, productName: e.target.value })} className="w-full border rounded px-3 py-2" required />
              </div>
              <div>
                <label className="text-xs text-gray-600">Model Number</label>
                <input name="modelNumber" value={formData.modelNumber} onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })} className="w-full border rounded px-3 py-2" required disabled={!!editingProduct} />
              </div>
              <div>
                <label className="text-xs text-gray-600">Category</label>
                <input name="productCategoryName" value={formData.productCategoryName} onChange={(e) => setFormData({ ...formData, productCategoryName: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Status</label>
                <select name="status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full border rounded px-3 py-2">
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Stock Level</label>
                <input type="number" name="stockLevel" value={formData.stockLevel} onChange={(e) => setFormData({ ...formData, stockLevel: Number(e.target.value) })} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Reorder Point</label>
                <input type="number" name="reorderPoint" value={formData.reorderPoint} onChange={(e) => setFormData({ ...formData, reorderPoint: Number(e.target.value) })} className="w-full border rounded px-3 py-2" />
              </div>

              {/* Supplier snapshot fields */}
              <div>
                <label className="text-xs text-gray-600">Supplier Name</label>
                <input name="supplierName" value={formData.supplierName} onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Supplier Email</label>
                <input name="supplierMail" type="email" value={formData.supplierMail} onChange={(e) => setFormData({ ...formData, supplierMail: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Supplier Contact</label>
                <input name="supplierContact" value={formData.supplierContact} onChange={(e) => setFormData({ ...formData, supplierContact: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>

              <div className="col-span-full flex justify-end gap-2 mt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">{editingProduct ? "Save" : "Add"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
