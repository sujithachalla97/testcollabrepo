// src/pages/Products.jsx
import { useEffect, useState, useRef, useMemo } from "react";
import axios from "../api/axiosInstance";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* ---------- small UI bits (icons + skeleton) ---------- */
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
  if (name === "download")
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 11l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 21H3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (name === "upload")
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 21V9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 13l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 21H3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return null;
};

function SkeletonRow() {
  return (
    <div className="animate-pulse flex gap-4 items-center py-3 border-b border-gray-200">
      <div className="w-1/3 h-4 bg-gray-200 rounded" />
      <div className="w-1/6 h-4 bg-gray-200 rounded" />
      <div className="w-1/6 h-4 bg-gray-200 rounded" />
      <div className="w-12 h-4 bg-gray-200 rounded ml-auto" />
    </div>
  );
}

/* ----------------- Component ----------------- */
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
  });

  // CSV import
  const fileInputRef = useRef(null);

  // Search / filter / pagination state
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [pageSize, setPageSize] = useState(25); // default 25
  const [page, setPage] = useState(1);

  /* ---------- fetch helpers ---------- */

  // Primary fetch: tries to fetch all if `all=true` or limit param provided
  const fetchProductsRaw = async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const url = query ? `/products?${query}` : "/products";
    return axios.get(url).then((r) => r.data.items ?? r.data ?? []);
  };

  // Fetch everything robustly:
  // 1) try limit=0 (many APIs return all)
  // 2) if that fails or returns not array, fallback to batched paging
  const fetchAllProducts = async () => {
    try {
      // try server-supported all fetch first
      const tryAll = await axios.get("/products?limit=0").then((r) => r.data.items ?? r.data ?? []);
      if (Array.isArray(tryAll)) {
        return tryAll;
      }
    } catch (err) {
      // ignore: fall back to batching
    }

    // batching fallback
    const batchSize = 200;
    const gathered = [];
    let pageNo = 1;
    const maxBatches = 50; // safety: 50 * 200 = 10k limit
    for (let i = 0; i < maxBatches; i++) {
      try {
        const resp = await axios.get(`/products?page=${pageNo}&limit=${batchSize}`).then((r) => r.data.items ?? r.data ?? []);
        if (!Array.isArray(resp)) break;
        if (resp.length === 0) break;
        gathered.push(...resp);
        if (resp.length < batchSize) break; // last page
        pageNo++;
      } catch (err) {
        // server may not support paging query params → stop and throw
        console.error("Batch fetch failed at page", pageNo, err);
        throw err;
      }
    }
    return gathered;
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // If pageSize === total (we treat 'all' by pageSize === totalPages later),
      // decide to fetch all. Here, a user flow sets pageSize === 'all' by UI,
      // but internally we keep pageSize numeric. We'll trigger fetchAll when user selects All.
      if (pageSize === "all" || pageSize === 0) {
        const all = await fetchAllProducts();
        setProducts(all);
        setPage(1);
      } else {
        // server-side paging disabled? we request all then slice client-side if needed
        // Try server-side limit & page if your backend supports it:
        try {
          const res = await axios.get(`/products?page=${page}&limit=${pageSize}`).then((r) => r.data.items ?? r.data ?? []);
          if (Array.isArray(res)) {
            // If API returned a paged list (just items), set products to the full set of received items.
            setProducts(res);
          } else {
            // fallback: fetch all and slice
            const all = await fetchAllProducts();
            setProducts(all);
          }
        } catch (err) {
          // fallback to fetching all when single-page request fails
          console.warn("Paged fetch failed; falling back to fetchAll", err?.message || err);
          const all = await fetchAllProducts();
          setProducts(all);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    const onKey = (e) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  /* debounce search */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [q]);

  /* modal/form helpers (unchanged) */
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
      });
    } else {
      setFormData({
        productName: "",
        modelNumber: "",
        productCategoryName: "",
        stockLevel: 0,
        reorderPoint: 0,
        status: "active",
      });
    }
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
  };
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.productName || !formData.modelNumber) {
      toast.warning("Product name and model number are required.");
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
      toast.error(err.response?.data?.error || "Something went wrong");
    }
  };

  const handleDelete = async (modelNumber) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await axios.delete(`/products/${modelNumber}`);
      toast.success("Deleted");
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete");
    }
  };

  /* CSV export/import (unchanged) */
  function parseCSV(text) {
    const rows = [];
    const lines = text.split(/\r\n|\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const row = [];
      let cur = "";
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === '"' && line[j + 1] === '"') {
          cur += '"';
          j++;
          continue;
        }
        if (ch === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        if (ch === "," && !inQuotes) {
          row.push(cur);
          cur = "";
          continue;
        }
        cur += ch;
      }
      row.push(cur);
      rows.push(row);
    }
    return rows;
  }
  function toCSV(items) {
    const headers = [
      "productName",
      "modelNumber",
      "productCategoryName",
      "stockLevel",
      "reorderPoint",
      "status",
    ];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [headers.join(",")];
    for (const it of items) {
      const vals = headers.map((h) => esc(it[h] ?? ""));
      lines.push(vals.join(","));
    }
    return lines.join("\n");
  }

  const handleExportCSV = () => {
    if (!products || products.length === 0) {
      toast.info("No products to export");
      return;
    }
    const csv = toCSV(products);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const now = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `tims-products-${now}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };
  const handleImportClick = () => fileInputRef.current?.click();

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      toast.error("CSV contains no data");
      return;
    }
    const headers = rows[0].map((h) => h.trim());
    const required = [
      "productName",
      "modelNumber",
      "productCategoryName",
      "stockLevel",
      "reorderPoint",
      "status",
    ];
    const headerIdx = {};
    headers.forEach((h, i) => (headerIdx[h] = i));
    const canonical = {};
    headers.forEach((h, i) => {
      const key = h.toLowerCase().replace(/\s+/g, "");
      if (key.includes("name") && key.includes("product")) canonical["productName"] = i;
      else if (key.includes("model")) canonical["modelNumber"] = i;
      else if (key.includes("category")) canonical["productCategoryName"] = i;
      else if (key === "stock" || key.includes("stock")) canonical["stockLevel"] = i;
      else if (key.includes("reorder")) canonical["reorderPoint"] = i;
      else if (key.includes("status")) canonical["status"] = i;
      else if (required.includes(h)) canonical[h] = i;
    });
    const idx = {};
    for (const req of required) idx[req] = headerIdx[req] ?? canonical[req];

    if (idx.productName === undefined || idx.modelNumber === undefined) {
      toast.error("CSV missing required columns. Required: productName, modelNumber (or similar).");
      return;
    }

    const parsed = [];
    const errors = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length === 0) continue;
      const item = {};
      try {
        item.productName = row[idx.productName]?.trim() ?? "";
        item.modelNumber = row[idx.modelNumber]?.trim() ?? "";
        item.productCategoryName =
          row[idx.productCategoryName]?.trim() ?? row[headerIdx["productCategory"]] ?? "";
        item.stockLevel = Number(row[idx.stockLevel] ?? 0) || 0;
        item.reorderPoint = Number(row[idx.reorderPoint] ?? 0) || 0;
        item.status = (row[idx.status]?.trim() || "active").toLowerCase();

        if (!item.productName || !item.modelNumber) {
          errors.push({ row: r + 1, reason: "Missing productName or modelNumber" });
          continue;
        }
        parsed.push(item);
      } catch (ex) {
        errors.push({ row: r + 1, reason: "Parse error" });
      }
    }

    if (parsed.length === 0) {
      toast.error("No valid rows found in CSV");
      return;
    }

    try {
      const bulkRes = await axios.post("/products/bulk", { items: parsed }).catch(() => null);
      if (bulkRes && (bulkRes.status === 200 || bulkRes.status === 201)) {
        toast.success(`Imported ${parsed.length} rows (bulk)`);
      } else {
        let successCount = 0;
        for (const p of parsed) {
          try {
            await axios.post("/products", p);
            successCount++;
          } catch (err) {
            console.error("row error", p, err);
          }
        }
        toast.success(`Imported ${successCount} / ${parsed.length} rows`);
      }
      if (errors.length) {
        toast.info(`${errors.length} rows skipped due to issues (see console).`);
        console.warn("CSV import skipped rows:", errors);
      }
      await fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error("CSV import failed");
    }
  };

  /* ----------------- SEARCH / FILTER / PAGINATION (client-side) ----------------- */
  const categories = useMemo(() => {
    const s = new Set();
    products.forEach((p) => {
      if (p.productCategoryName) s.add(p.productCategoryName);
    });
    return ["all", ...Array.from(s).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const term = debouncedQ;
    let list = products;
    if (term) {
      list = list.filter((p) => {
        const hay = `${p.productName ?? ""} ${p.modelNumber ?? ""} ${p.productCategoryName ?? ""}`.toLowerCase();
        return hay.includes(term);
      });
    }
    if (categoryFilter !== "all") {
      list = list.filter((p) => (p.productCategoryName ?? "").toLowerCase() === categoryFilter.toLowerCase());
    }
    return list;
  }, [products, debouncedQ, categoryFilter]);

  const total = filtered.length;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pageItems = useMemo(() => {
    // if pageSize === 'all' we collected everything already into products
    if (pageSize === "all" || pageSize === 0) return filtered;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  /* ---------- render ---------- */
  if (loading)
    return (
      <div className="p-6 bg-white min-h-[200px]">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <div className="h-6 w-48 bg-gray-200 rounded mb-3 animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="space-y-2 bg-white rounded shadow-sm p-4">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </div>
      </div>
    );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto bg-white">
      {/* Header + actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Products</h2>
          <p className="text-xs text-gray-600 mt-1">{total} total</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* search */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              <Icon name="search" />
            </div>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search product, model or category..."
              className="pl-10 pr-10 py-2 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none w-72 bg-white"
            />
            {q && (
              <button
                onClick={() => {
                  setQ("");
                  setPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded bg-gray-100 text-gray-600"
                aria-label="Clear"
              >
                ×
              </button>
            )}
          </div>

          {/* category select */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 bg-white"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All categories" : c}
              </option>
            ))}
          </select>

          {/* page size selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Rows:</label>
            <select
              value={pageSize === "all" ? "all" : pageSize}
              onChange={async (e) => {
                const v = e.target.value === "all" ? "all" : Number(e.target.value);
                setPageSize(v);
                setPage(1);
                // if user selected All, fetch everything immediately
                if (v === "all") {
                  setLoading(true);
                  try {
                    const all = await fetchAllProducts();
                    setProducts(all);
                  } catch (err) {
                    console.error("Failed to fetch all products", err);
                    toast.error("Failed to fetch all products");
                  } finally {
                    setLoading(false);
                  }
                } else {
                  // normal fetch (will run due to pageSize dependency)
                  // fetchProducts(); // not needed because effect depends on pageSize
                }
              }}
              className="px-2 py-1 rounded border border-gray-200 bg-white text-gray-700"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
              title="Export CSV"
            >
              <Icon name="download" />
              <span className="hidden sm:inline text-sm">Export</span>
            </button>

            <button
              onClick={handleImportClick}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
              title="Import CSV"
            >
              <Icon name="upload" />
              <span className="hidden sm:inline text-sm">Import</span>
            </button>

            <button
              onClick={() => openModal()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-md hover:brightness-95 transition"
            >
              <Icon name="plus" colorClass="text-white" />
              <span>Add</span>
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFilePicked} className="hidden" />
        </div>
      </div>

      {/* content */}
      <div className="rounded-xl bg-gray-50 p-3 border border-gray-100">
        {/* empty state */}
        {pageItems.length === 0 && (
          <div className="py-16 flex flex-col items-center justify-center gap-4">
            <svg width="160" height="100" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-40">
              <rect x="8" y="18" width="120" height="70" rx="8" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 22h112" stroke="currentColor" strokeWidth="1" />
            </svg>
            <div className="text-gray-500">No products found</div>
            <div className="text-sm text-gray-500">Try removing filters, or <button className="underline text-gray-600" onClick={() => { setCategoryFilter("all"); setQ(""); }}>reset search</button>.</div>
          </div>
        )}

        {/* table for md+ */}
        <div className="hidden md:block overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-gray-700">Name</th>
                <th className="text-left px-4 py-3 text-gray-700">Model</th>
                <th className="text-left px-4 py-3 text-gray-700">Category</th>
                <th className="text-left px-4 py-3 text-gray-700">Stock</th>
                <th className="text-left px-4 py-3 text-gray-700">Reorder</th>
                <th className="text-left px-4 py-3 text-gray-700">Status</th>
                <th className="text-left px-4 py-3 text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p, i) => {
                const lowStock = p.stockLevel <= p.reorderPoint;
                const k = p.modelNumber ?? `product-${page}-${i}`;
                return (
                  <tr key={k} className={`border-b border-gray-100 hover:bg-gray-50 transition ${lowStock ? "bg-red-50" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.productName}</div>
                      <div className="text-xs text-gray-500">{p.description ? `${p.description}` : ""}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-800">{p.modelNumber}</td>
                    <td className="px-4 py-3 text-gray-800">{p.productCategoryName}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`px-2 py-0.5 rounded text-sm font-medium ${lowStock ? "bg-red-500 text-white" : "bg-gray-100 text-gray-800"}`}>
                          {p.stockLevel}
                        </div>
                        {lowStock && <div className="text-xs text-red-600">Low</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-800">{p.reorderPoint}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        p.status === "active"
                          ? "bg-green-100 text-green-800"
                          : p.status === "draft"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-200 text-gray-700"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openModal(p)} className="px-3 py-1 rounded-md bg-yellow-400 text-gray-900 hover:brightness-95 transition">Edit</button>
                        <button onClick={() => handleDelete(p.modelNumber)} className="px-3 py-1 rounded-md bg-red-600 text-white hover:brightness-95 transition">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* responsive cards for small screens */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 md:hidden">
          {pageItems.map((p, i) => {
            const lowStock = p.stockLevel <= p.reorderPoint;
            const k = p.modelNumber ?? `product-${page}-${i}`;
            return (
              <article key={k} className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{p.productName}</h3>
                    <p className="text-xs text-gray-500">Model: {p.modelNumber}</p>
                    <p className="text-xs text-gray-500 mt-2">Category: {p.productCategoryName}</p>
                  </div>
                  <div className="text-right">
                    <div className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${p.status === "active" ? "bg-green-100 text-green-800" : p.status === "draft" ? "bg-yellow-100 text-yellow-800" : "bg-gray-200 text-gray-700"}`}>
                      {p.status}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm text-gray-700">
                  <div>
                    <div>Stock: <span className={lowStock ? "text-red-600 font-semibold" : "text-gray-900"}>{p.stockLevel}</span></div>
                    <div>Reorder: {p.reorderPoint}</div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <button onClick={() => openModal(p)} className="px-3 py-1 rounded-md bg-yellow-400 text-gray-900 text-xs">Edit</button>
                    <button onClick={() => handleDelete(p.modelNumber)} className="px-3 py-1 rounded-md bg-red-600 text-white text-xs">Delete</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* pagination controls */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{(page - 1) * (pageSize === "all" ? total : pageSize) + (pageItems.length ? 1 : 0)}</span> - <span className="font-medium">{(page - 1) * (pageSize === "all" ? total : pageSize) + pageItems.length}</span> of <span className="font-medium">{total}</span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 rounded border border-gray-200 bg-white text-gray-700">First</button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 rounded border border-gray-200 bg-white text-gray-700">Prev</button>

          <div className="px-2 py-1 rounded border border-gray-200 bg-white flex items-center gap-2">
            <span className="text-sm text-gray-700">Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={page}
              onChange={(e) => {
                let v = Number(e.target.value) || 1;
                if (v < 1) v = 1;
                if (v > totalPages) v = totalPages;
                setPage(v);
              }}
              className="ml-2 w-16 bg-white text-gray-900 outline-none border-none"
            />
            <span className="ml-2 text-sm text-gray-700">/ {totalPages}</span>
          </div>

          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 rounded border border-gray-200 bg-white text-gray-700">Next</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 rounded border border-gray-200 bg-white text-gray-700">Last</button>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30" onClick={closeModal} aria-hidden />
          <div className="relative w-full max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl p-6 shadow-xl z-10">
            <header className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{editingProduct ? "Edit Product" : "Add Product"}</h3>
              <button onClick={closeModal} aria-label="Close" className="text-gray-500 hover:text-gray-700">✕</button>
            </header>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Name</label>
                <input type="text" name="productName" value={formData.productName} onChange={handleChange} className="w-full rounded-lg px-3 py-2 border border-gray-300 text-gray-900 placeholder-gray-400" placeholder="Product name" required />
              </div>

              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Model Number</label>
                <input type="text" name="modelNumber" value={formData.modelNumber} onChange={handleChange} className="w-full rounded-lg px-3 py-2 border border-gray-300 text-gray-900 placeholder-gray-400" placeholder="Model number" required disabled={Boolean(editingProduct)} />
              </div>

              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Category</label>
                <input type="text" name="productCategoryName" value={formData.productCategoryName} onChange={handleChange} className="w-full rounded-lg px-3 py-2 border border-gray-300 text-gray-900 placeholder-gray-400" placeholder="Category" />
              </div>

              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className="w-full rounded-lg px-3 py-2 border border-gray-300 text-gray-900 bg-white">
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Stock Level</label>
                <input type="number" name="stockLevel" value={formData.stockLevel} onChange={handleChange} min={0} className="w-full rounded-lg px-3 py-2 border border-gray-300 text-gray-900" />
              </div>

              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1">Reorder Point</label>
                <input type="number" name="reorderPoint" value={formData.reorderPoint} onChange={handleChange} min={0} className="w-full rounded-lg px-3 py-2 border border-gray-300 text-gray-900" />
              </div>

              <div className="col-span-full flex justify-end gap-2 mt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded-md border border-gray-200 text-gray-700 bg-white">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 text-white">{editingProduct ? "Save" : "Add"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}
