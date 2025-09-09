// src/pages/Suppliers.jsx
import { useEffect, useState, useRef, useMemo } from "react";
import axios from "../api/axiosInstance";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* small UI bits */
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

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    supplierName: "",
    supplierMail: "",
    supplierContact: "",
    notes: "",
    active: true,
  });

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState(null);

  // CSV import
  const fileInputRef = useRef(null);

  // Search / filter / pagination state
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  /* ---------- fetch helpers ---------- */
  const fetchAllSuppliers = async () => {
    try {
      const all = await axios.get("/suppliers?limit=0").then((r) => r.data.items ?? r.data ?? []);
      if (Array.isArray(all)) return all;
    } catch (err) { /* fallback batching */ }
    const batchSize = 200;
    const gathered = [];
    let pageNo = 1;
    const maxBatches = 50;
    for (let i = 0; i < maxBatches; i++) {
      try {
        const resp = await axios.get(`/suppliers?page=${pageNo}&limit=${batchSize}`).then((r) => r.data.items ?? r.data ?? []);
        if (!Array.isArray(resp) || resp.length === 0) break;
        gathered.push(...resp);
        if (resp.length < batchSize) break;
        pageNo++;
      } catch (err) { break; }
    }
    return gathered;
  };

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      if (pageSize === "all" || pageSize === 0) {
        const all = await fetchAllSuppliers();
        setSuppliers(all);
        setPage(1);
      } else {
        try {
          const res = await axios.get(`/suppliers?page=${page}&limit=${pageSize}`).then((r) => r.data.items ?? r.data ?? []);
          setSuppliers(Array.isArray(res) ? res : await fetchAllSuppliers());
        } catch { setSuppliers(await fetchAllSuppliers()); }
      }
    } catch (err) {
      toast.error("Failed to fetch suppliers");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchSuppliers();
    const onKey = (e) => { if (e.key === "Escape") setModalOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, pageSize]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [q]);

  /* ---------- modal/form helpers ---------- */
  const openModal = (supplier = null) => {
    setEditingSupplier(supplier);
    setFormData({
      supplierName: supplier?.supplierName || "",
      supplierMail: supplier?.supplierMail || "",
      supplierContact: supplier?.supplierContact || "",
      notes: supplier?.notes || "",
      active: supplier?.active ?? true,
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditingSupplier(null); };
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplierName || !formData.supplierMail || !formData.supplierContact) {
      toast.warning("Name, email and contact are required.");
      return;
    }
    try {
      if (editingSupplier) await axios.patch(`/suppliers/${editingSupplier._id}`, formData);
      else await axios.post("/suppliers", formData);
      toast.success(editingSupplier ? "Supplier updated" : "Supplier added");
      await fetchSuppliers();
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Something went wrong");
    }
  };

  /* ---------- Delete handlers ---------- */
  const handleDeleteClick = (supplier) => {
    setDeletingSupplier(supplier);
    setDeleteModalOpen(true);
  };
  const confirmDelete = async () => {
    if (!deletingSupplier) return;
    try {
      await axios.delete(`/suppliers/${deletingSupplier._id}`);
      toast.success("Deleted");
      await fetchSuppliers();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete");
    } finally {
      setDeletingSupplier(null);
      setDeleteModalOpen(false);
    }
  };
  const cancelDelete = () => { setDeletingSupplier(null); setDeleteModalOpen(false); };

  /* ---------- CSV helpers ---------- */
  const parseCSV = (text) => {
    const rows = [];
    const lines = text.split(/\r\n|\n/);
    for (let line of lines) {
      line = line.trim(); if (!line) continue;
      const row = []; let cur = "", inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === '"' && line[j + 1] === '"') { cur += '"'; j++; continue; }
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === "," && !inQuotes) { row.push(cur); cur = ""; continue; }
        cur += ch;
      }
      row.push(cur); rows.push(row);
    }
    return rows;
  };
  const toCSV = (items) => {
    const headers = ["supplierName", "supplierMail", "supplierContact", "notes", "active"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [headers.join(",")];
    for (const it of items) { lines.push(headers.map(h => esc(it[h] ?? "")).join(",")); }
    return lines.join("\n");
  };
  const handleExportCSV = () => {
    if (!suppliers || suppliers.length === 0) { toast.info("No suppliers to export"); return; }
    const csv = toCSV(suppliers);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `suppliers-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };
  const handleImportClick = () => fileInputRef.current?.click();
  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !file.name.toLowerCase().endsWith(".csv")) { toast.error("Please upload a .csv file"); return; }
    const rows = parseCSV(await file.text());
    if (rows.length < 2) { toast.error("CSV contains no data"); return; }
    const headers = rows[0].map(h => h.trim());
    const required = ["supplierName", "supplierMail", "supplierContact"];
    const headerIdx = {}; headers.forEach((h, i) => headerIdx[h] = i);
    const canonical = {};
    headers.forEach((h, i) => {
      const key = h.toLowerCase().replace(/\s+/g, "");
      if (key.includes("name") && key.includes("supplier")) canonical["supplierName"] = i;
      else if (key.includes("mail") || key.includes("email")) canonical["supplierMail"] = i;
      else if (key.includes("contact") || key.includes("phone")) canonical["supplierContact"] = i;
      else if (key.includes("note")) canonical["notes"] = i;
      else if (key === "active") canonical["active"] = i;
      else if (required.includes(h)) canonical[h] = i;
    });
    const idx = {}; for (const req of required) idx[req] = headerIdx[req] ?? canonical[req];
    if (idx.supplierName === undefined || idx.supplierMail === undefined || idx.supplierContact === undefined) {
      toast.error("CSV missing required columns: supplierName, supplierMail, supplierContact (or similar)."); return;
    }
    const parsed = [], errors = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]; if (row.length === 0) continue;
      const item = {};
      try {
        item.supplierName = row[idx.supplierName]?.trim() ?? "";
        item.supplierMail = row[idx.supplierMail]?.trim() ?? "";
        item.supplierContact = row[idx.supplierContact]?.trim() ?? "";
        item.notes = row[canonical.notes]?.trim() ?? "";
        item.active = (row[canonical.active]?.trim() || "true").toLowerCase() === "true";
        if (!item.supplierName || !item.supplierMail || !item.supplierContact) {
          errors.push({ row: r + 1, reason: "Missing required fields" }); continue;
        }
        parsed.push(item);
      } catch { errors.push({ row: r + 1, reason: "Parse error" }); }
    }
    if (parsed.length === 0) { toast.error("No valid rows found in CSV"); return; }
    try {
      const bulkRes = await axios.post("/suppliers/bulk", { items: parsed }).catch(() => null);
      if (bulkRes && (bulkRes.status === 200 || bulkRes.status === 201)) toast.success(`Imported ${parsed.length} rows (bulk)`);
      else {
        let successCount = 0;
        for (const s of parsed) { try { await axios.post("/suppliers", s); successCount++; } catch {} }
        toast.success(`Imported ${successCount} / ${parsed.length} rows`);
      }
      if (errors.length) toast.info(`${errors.length} rows skipped (see console).`);
      await fetchSuppliers();
    } catch { toast.error("CSV import failed"); }
  };

  /* ---------- search & pagination ---------- */
  const filtered = useMemo(() => {
    const term = debouncedQ; let list = suppliers;
    if (term) list = list.filter(s => `${s.supplierName} ${s.supplierMail} ${s.supplierContact}`.toLowerCase().includes(term));
    return list;
  }, [suppliers, debouncedQ]);
  const total = filtered.length;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  const pageItems = useMemo(() => {
    if (pageSize === "all" || pageSize === 0) return filtered;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  /* ---------- render ---------- */
  if (loading) return (
    <div className="p-6 bg-white min-h-[200px]">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6"><div className="h-6 w-48 bg-gray-200 rounded mb-3 animate-pulse" /><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></div>
        <div className="space-y-2 bg-white rounded shadow-sm p-4"><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto bg-white">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Suppliers</h2>
          <p className="text-xs text-gray-600 mt-1">{total} total</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><Icon name="search" /></div>
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search name, email or contact..." className="pl-10 pr-10 py-2 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none w-72 bg-white" />
            {q && <button onClick={() => { setQ(""); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded bg-gray-100 text-gray-600" aria-label="Clear">×</button>}
          </div>

          {/* page size */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Rows:</label>
            <select value={pageSize === "all" ? "all" : pageSize} onChange={async e => {
              const v = e.target.value === "all" ? "all" : Number(e.target.value);
              setPageSize(v); setPage(1);
              if (v === "all") { setLoading(true); try { setSuppliers(await fetchAllSuppliers()); } catch { toast.error("Failed to fetch all suppliers"); } finally { setLoading(false); } }
            }} className="px-2 py-1 rounded border border-gray-200 bg-white text-gray-700">
              <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value="all">All</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleExportCSV} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition" title="Export CSV"><span className="hidden sm:inline text-sm">Export</span></button>
            <button onClick={handleImportClick} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition" title="Import CSV"><span className="hidden sm:inline text-sm">Import</span></button>
            <button onClick={() => openModal()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-md hover:brightness-95 transition"><Icon name="plus" colorClass="text-white" /><span>Add</span></button>
          </div>

          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFilePicked} className="hidden" />
        </div>
      </div>

      {/* content */}
      <div className="rounded-xl bg-gray-50 p-3 border border-gray-100">
        {pageItems.length === 0 && (
          <div className="py-16 flex flex-col items-center justify-center gap-4">
            <div className="text-gray-500">No suppliers found</div>
            <div className="text-sm text-gray-500">Try resetting search or filters.</div>
          </div>
        )}

        <div className="hidden md:block overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr><th className="text-left px-4 py-3 text-gray-700">Name</th><th className="text-left px-4 py-3 text-gray-700">Email</th><th className="text-left px-4 py-3 text-gray-700">Contact</th><th className="text-left px-4 py-3 text-gray-700">Notes</th><th className="text-left px-4 py-3 text-gray-700">Actions</th></tr>
            </thead>
            <tbody>
              {pageItems.map((s, i) => {
                const k = s._id ?? `supplier-${page}-${i}`;
                return (
                  <tr key={k} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-4 py-3"><div className="font-medium text-gray-900">{s.supplierName}</div><div className="text-xs text-gray-500">Added: {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "-"}</div></td>
                    <td className="px-4 py-3 text-gray-800">{s.supplierMail}</td>
                    <td className="px-4 py-3 text-gray-800">{s.supplierContact}</td>
                    <td className="px-4 py-3 text-gray-800">{s.notes || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openModal(s)} className="px-3 py-1 rounded-md bg-yellow-400 text-gray-900 hover:brightness-95 transition">Edit</button>
                        <button onClick={() => handleDeleteClick(s)} className="px-3 py-1 rounded-md bg-red-500 text-white hover:brightness-95 transition">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg relative">
            <h3 className="text-lg font-semibold mb-4">{editingSupplier ? "Edit Supplier" : "Add Supplier"}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input name="supplierName" value={formData.supplierName} onChange={handleChange} placeholder="Name" className="w-full border px-3 py-2 rounded" />
              <input name="supplierMail" value={formData.supplierMail} onChange={handleChange} placeholder="Email" className="w-full border px-3 py-2 rounded" />
              <input name="supplierContact" value={formData.supplierContact} onChange={handleChange} placeholder="Contact" className="w-full border px-3 py-2 rounded" />
              <input name="notes" value={formData.notes} onChange={handleChange} placeholder="Notes" className="w-full border px-3 py-2 rounded" />
              <div className="flex items-center gap-2">
                <input type="checkbox" name="active" checked={formData.active} onChange={handleChange} id="activeCheck" />
                <label htmlFor="activeCheck" className="text-sm text-gray-700">Active</label>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button type="button" onClick={closeModal} className="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:brightness-95">{editingSupplier ? "Save" : "Add"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg text-center">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="text-gray-700 mb-4">Are you sure you want to delete <span className="font-medium">{deletingSupplier?.supplierName}</span>?</p>
            <div className="flex justify-center gap-3">
              <button onClick={cancelDelete} className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-md bg-red-500 text-white hover:brightness-95">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
