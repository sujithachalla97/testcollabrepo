// AdminAnalysis.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import axios from "../api/axiosInstance";
import { useAuth } from "../context/AuthContext";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

const COLORS = ["#4f46e5", "#06b6d4", "#f97316", "#ef4444", "#10b981", "#8b5cf6"];
const ORDERS_PAGE = 50;
const LOW_THRESHOLD = 10;

export default function AdminAnalysis({ compact = false }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // core data
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [suppliersApi, setSuppliersApi] = useState(null);
  const [supplierMap, setSupplierMap] = useState(new Map());
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI
  const [queryModel, setQueryModel] = useState("");
  const [queryProducts, setQueryProducts] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [ordersPage, setOrdersPage] = useState(1);

  useEffect(() => {
    let mounted = true;
    async function loadAll() {
      setLoading(true);
      setError(null);

      try {
        // fetch main resources
        const [tResRaw, pResRaw, oResRaw] = await Promise.all([
          axios.get("/transactions?limit=1000").then((r) => r.data.items ?? r.data ?? []),
          axios.get("/products?limit=0").then((r) => r.data.items ?? r.data ?? []),
          axios.get("/orders?limit=0").then((r) => r.data.items ?? r.data ?? []),
        ]);

        if (!mounted) return;

        const txs = Array.isArray(tResRaw) ? tResRaw : [];
        const prods = Array.isArray(pResRaw) ? pResRaw : [];
        const ords = Array.isArray(oResRaw) ? oResRaw : [];

        setTransactions(txs);
        setProducts(prods);
        setOrders(ords);

        // --- suppliers: fetch from DB endpoints first, fallback to deriving from products ---
        let suppliersFetched = null;
        const supplierEndpoints = [
          { fn: () => axios.get("/suppliers?limit=0").then((r) => r.data.items ?? r.data ?? []), name: "/suppliers?limit=0" },
          { fn: () => axios.get("/vendors?limit=0").then((r) => r.data.items ?? r.data ?? []), name: "/vendors?limit=0" },
          { fn: () => axios.get("/suppliers").then((r) => r.data.items ?? r.data ?? []), name: "/suppliers" },
        ];

        for (const ep of supplierEndpoints) {
          try {
            const res = await ep.fn();
            console.info(`AdminAnalysis: tried ${ep.name}, returned length:`, Array.isArray(res) ? res.length : typeof res);
            if (Array.isArray(res) && res.length) {
              suppliersFetched = res;
              break;
            }
          } catch (e) {
            console.warn(`AdminAnalysis: ${ep.name} failed:`, e?.message || e);
          }
        }

        // fallback: derive suppliers from product.supplier/vendor fields
        if (!suppliersFetched) {
          const derived = [];
          const seen = new Set();
          prods.forEach((p) => {
            const s = p.supplier;
            if (!s) return;
            if (typeof s === "object" && (s.name || s.id || s._id || s.company || s.title || s.organization)) {
              const id = s.id ?? s._id ?? s.name ?? s.company ?? s.title;
              const key = String(id);
              if (!seen.has(key)) {
                seen.add(key);
                derived.push({ id: id ?? key, name: s.name ?? s.company ?? s.title ?? String(id), email: s.email ?? s.contact ?? null, raw: s });
              }
            } else if (typeof s === "string") {
              if (!seen.has(s)) { seen.add(s); derived.push({ id: s, name: s }); }
            }
            if (p.vendor && typeof p.vendor === "object") {
              const id = p.vendor.id ?? p.vendor._id ?? p.vendor.name;
              const key = String(id);
              if (id && !seen.has(key)) { seen.add(key); derived.push({ id, name: p.vendor.name ?? String(id), email: p.vendor.email ?? null, raw: p.vendor }); }
            }
          });
          if (derived.length) {
            suppliersFetched = derived;
            console.info("AdminAnalysis: derived suppliers from products count=", derived.length);
          } else {
            console.info("AdminAnalysis: no suppliers endpoint and no suppliers derivable from products");
          }
        }

        if (suppliersFetched) {
          setSuppliersApi(suppliersFetched);

          // Build supplierMap with robust displayName normalization and multi-key indexing
          const map = new Map();
          suppliersFetched.forEach((s) => {
            const raw = s || {};
            const displayName = raw.name || raw.company || raw.title || raw.organization || raw.displayName || raw._id || raw.id || (typeof raw === "string" ? raw : null);
            const contact = raw.email || raw.phone || raw.contact || null;
            const norm = { ...raw, displayName: displayName ? String(displayName) : null, contact, raw };

            const keyCandidates = [];
            if (raw.id) keyCandidates.push(String(raw.id));
            if (raw._id) keyCandidates.push(String(raw._id));
            if (displayName) keyCandidates.push(String(displayName));
            if (raw.email) keyCandidates.push(String(raw.email));
            if (raw.company) keyCandidates.push(String(raw.company));
            keyCandidates.forEach((k) => {
              if (!k) return;
              map.set(k, norm);
              map.set(k.toLowerCase(), norm);
            });
            if (displayName) map.set(String(displayName).toLowerCase(), norm);
          });

          // Also index embedded supplier/vendor objects from products (best-effort)
          prods.forEach((p) => {
            const s = p.supplier;
            if (s && typeof s === "object") {
              const name = s.name || s.company || s.title;
              const id = s.id ?? s._id ?? name;
              if (id) {
                const norm = { ...s, displayName: name ? String(name) : String(id), contact: s.email || s.phone || s.contact || null, raw: s };
                map.set(String(id), norm);
                if (name) map.set(String(name).toLowerCase(), norm);
              }
            }
            if (p.vendor && p.vendor.name) {
              const vn = p.vendor.name;
              const norm = { ...p.vendor, displayName: vn, contact: p.vendor.email || p.vendor.phone || null, raw: p.vendor };
              map.set(vn, norm);
              map.set(vn.toLowerCase(), norm);
            }
          });

          setSupplierMap(map);
        } else {
          // No suppliers fetched - derive a best-effort map
          const map = new Map();
          prods.forEach((p) => {
            const s = p.supplier;
            if (!s) return;
            if (typeof s === "string") {
              map.set(s, { displayName: s, raw: s });
              map.set(s.toLowerCase(), { displayName: s, raw: s });
            } else if (typeof s === "object") {
              const name = s.name || s.company || s.title || s._id || s.id;
              if (name) {
                map.set(String(name), { ...s, displayName: String(name), raw: s });
                map.set(String(name).toLowerCase(), { ...s, displayName: String(name), raw: s });
              }
            }
            if (p.vendor && p.vendor.name) {
              map.set(p.vendor.name, { ...p.vendor, displayName: p.vendor.name, raw: p.vendor });
              map.set(p.vendor.name.toLowerCase(), { ...p.vendor, displayName: p.vendor.name, raw: p.vendor });
            }
          });
          setSupplierMap(map);
          setSuppliersApi(null);
        }

        // --- alerts: try backend alerts endpoints (and log result) ---
        let fetchedAlerts = null;
        const alertEndpoints = [
          { fn: () => axios.get("/alerts?limit=0").then((r) => r.data.items ?? r.data ?? []), name: "/alerts?limit=0" },
          { fn: () => axios.get("/notifications?limit=0").then((r) => r.data.items ?? r.data ?? []), name: "/notifications?limit=0" },
          { fn: () => axios.get("/alerts").then((r) => r.data.items ?? r.data ?? []), name: "/alerts" },
        ];
        for (const ep of alertEndpoints) {
          try {
            const res = await ep.fn();
            console.info(`AdminAnalysis: tried ${ep.name}, alerts length:`, Array.isArray(res) ? res.length : typeof res);
            if (Array.isArray(res) && res.length) { fetchedAlerts = res; break; }
          } catch (e) {
            console.warn(`AdminAnalysis: ${ep.name} failed:`, e?.message || e);
          }
        }

        if (fetchedAlerts && fetchedAlerts.length) {
          setAlerts(fetchedAlerts);
        } else {
          // Build derived alerts so the admin panel shows action items even when backend alerts are absent
          const derived = [];

          // --- Derived low-stock alerts (use per-product reorder point when available) ---
          const low = prods
            .map((p) => {
              const stock = Number(p.stockLevel ?? p.stock ?? p.qty ?? 0);
              const reorder = Number(
                p.reorderPoint ??
                p.reorder_point ??
                p.reorderLevel ??
                p.reorder_qty ??
                p.minStock ??
                LOW_THRESHOLD
              );
              return { p, stock, reorder, lowBy: Math.max(0, reorder - stock) };
            })
            .filter(x => x.lowBy > 0)
            .slice(0, 10);

          low.forEach(({ p, stock, reorder, lowBy }) => {
            const displayModel = p.name || p.productName || extractModel(p) || (p._id || p.id);
            const supplierName = (p.supplier && (typeof p.supplier === 'string' ? p.supplier : (p.supplier.name || p.supplier.company || p.supplier.title))) || (p.vendor && p.vendor.name) || 'Unknown supplier';
            derived.push({
              _id: `derived-low-${p._id || p.id || Math.random().toString(36).slice(2)}`,
              message: `Low stock: ${displayModel} — ${stock} / reorder ${reorder} (low by ${lowBy}) • supplier: ${supplierName}`,
              severity: 'warning',
              createdAt: new Date().toISOString(),
              raw: { type: 'derived', reason: 'low_stock', product: p, stock, reorder, lowBy }
            });
          });

          // 2) products with missing supplier info
          const missingSup = prods.filter((p) => !p.supplier && !p.vendor).slice(0, 8);
          missingSup.forEach((p) => {
            derived.push({
              _id: `derived-nosup-${p._id || p.id || Math.random().toString(36).slice(2)}`,
              message: `Missing supplier: ${p.name || extractModel(p) || (p._id || p.id)}`,
              severity: 'info',
              createdAt: new Date().toISOString(),
              raw: { type: 'derived', reason: 'missing_supplier', product: p }
            });
          });

          setAlerts(derived);
          console.info("AdminAnalysis: no backend alerts found — showing derived alerts.");
        }
      } catch (err) {
        console.error("AdminAnalysis load error", err);
        setError("Failed to load analytics");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (isAdmin) loadAll();
    return () => (mounted = false);
  }, [isAdmin]);

  // ---------- helpers ----------
  const extractModel = (obj) => {
    if (!obj) return null;
    const keys = [
      "modelNumber", "model_no", "model", "sku", "partNumber", "part_number", "mpn", "productCode", "product_code",
      "variant_sku", "mpn_id"
    ];
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return String(obj[k]);
    }
    if (obj.variant && typeof obj.variant === "object") {
      for (const k of ["modelNumber", "model", "sku", "partNumber", "mpn"]) {
        if (obj.variant[k]) return String(obj.variant[k]);
      }
    }
    if (obj.metadata && typeof obj.metadata === "object") {
      if (obj.metadata.modelNumber) return String(obj.metadata.modelNumber);
      if (obj.metadata.sku) return String(obj.metadata.sku);
    }
    if (obj.productName) return String(obj.productName);
    if (obj.name) return String(obj.name);
    return null;
  };

  const getOrderPrimaryModel = (order) => {
    const first = (order.items && order.items[0]) || null;
    if (first) {
      const m = extractModel(first);
      if (m) return m;
      if (first.productId || first.product_id) {
        const pid = String(first.productId ?? first.product_id);
        const prod = products.find((p) => String(p._id || p.id) === pid || String(p.productId) === pid);
        if (prod) {
          const pm = extractModel(prod);
          if (pm) return pm;
        }
      }
      return first.productName || first.name || "—";
    }
    return extractModel(order) || order.modelNumber || order.productName || "—";
  };

  const normalizeAlert = (a) => {
    if (!a) return null;
    const raw = a || {};
    const message = raw.message || raw.msg || raw.title || (raw.payload && raw.payload.message) || raw.text || (raw.raw && raw.raw.message) || JSON.stringify(raw);
    const severity = (raw.severity || raw.level || raw.priority || "info").toString().toLowerCase();
    const time = raw.createdAt || raw.timestamp || raw.time || raw.ts || raw.date || null;
    const id = raw._id || raw.id || raw.alertId || raw.rawId || Math.random().toString(36).slice(2);
    return { id, message, severity, time, raw };
  };

  const findSupplierForProduct = (p) => {
    const map = supplierMap;
    if (!p) return null;
    const idCandidates = [
      p.supplierId, p.supplier_id, p.supplier?.id, p.supplier?._id, p.supplier, p.vendor?.id, p.vendor?._id
    ].filter(Boolean).map(String);
    for (const id of idCandidates) {
      if (map.has(id)) return map.get(id);
      if (map.has(id.toLowerCase?.())) return map.get(id.toLowerCase());
    }
    // check name keys
    const nameCandidates = [];
    if (p.supplier && typeof p.supplier === 'object') {
      nameCandidates.push(p.supplier.name, p.supplier.company, p.supplier.title);
    }
    if (p.vendor && typeof p.vendor === 'object') nameCandidates.push(p.vendor.name);
    if (p.supplier && typeof p.supplier === 'string') nameCandidates.push(p.supplier);
    if (p.supplierName) nameCandidates.push(p.supplierName);

    for (const name of nameCandidates.filter(Boolean)) {
      if (map.has(name)) return map.get(name);
      if (map.has(name.toLowerCase())) return map.get(name.toLowerCase());
    }

    // best-effort: return normalized object
    if (p.supplier && typeof p.supplier === 'object') {
      const name = p.supplier.name || p.supplier.company || p.supplier.title || p.supplier._id || p.supplier.id;
      return { ...p.supplier, displayName: name || (p.supplier.id ?? p.supplier._id) };
    }
    if (p.vendor && typeof p.vendor === 'object') {
      const name = p.vendor.name;
      return { ...p.vendor, displayName: name || (p.vendor.id ?? p.vendor._id) };
    }
    if (typeof p.supplier === 'string') {
      return { displayName: p.supplier, raw: p.supplier };
    }
    return null;
  };

  // ---------- derived metrics ----------
  const totalRevenue = useMemo(() => transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0), [transactions]);
  const totalOrders = orders.length;
  const totalProducts = products.length;
  const avgOrderValue = totalOrders ? (totalRevenue / totalOrders).toFixed(2) : 0;

  const transactionsPerDay = useMemo(() => {
    const map = new Map();
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: key, amount: 0, count: 0 });
    }
    transactions.forEach((tx) => {
      const d = new Date(tx.createdAt);
      if (isNaN(d)) return;
      const key = d.toISOString().slice(0, 10);
      if (!map.has(key)) return;
      map.get(key).amount += Number(tx.amount ?? 0);
      map.get(key).count += 1;
    });
    return Array.from(map.values());
  }, [transactions]);

  const orderStatusDist = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => map.set(o.status || "Unknown", (map.get(o.status || "Unknown") || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const topProducts = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => (o.items || []).forEach((it) => {
      const key = extractModel(it) || it.productName || it.name || "Unknown";
      map.set(key, (map.get(key) || 0) + (it.qty || 0));
    }));
    return Array.from(map.entries()).map(([product, qty]) => ({ product, qty }))
      .sort((a, b) => b.qty - a.qty).slice(0, 50);
  }, [orders]);

  const topOrderedProducts = useMemo(() => {
    const q = queryProducts.trim().toLowerCase();
    return topProducts.filter(tp => !q || tp.product.toLowerCase().includes(q)).map(tp => ({ product: tp.product, qty: tp.qty }));
  }, [topProducts, queryProducts]);

  const filteredOrders = useMemo(() => {
    const q = queryModel.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const primary = (getOrderPrimaryModel(o) || "").toString();
      return primary.toLowerCase().includes(q) ||
        (o.items || []).some(it => ((extractModel(it) || it.productName || it.name || "")).toString().toLowerCase().includes(q));
    });
  }, [orders, queryModel, products]);

  const paginatedOrders = useMemo(() => {
    const start = 0;
    const end = ordersPage * ORDERS_PAGE;
    return filteredOrders.slice(start, end);
  }, [filteredOrders, ordersPage]);

  // --- improved lowStock (per-product reorder point aware) ---
  const lowStock = useMemo(() => {
    return products
      .map((p) => {
        const stock = Number(p.stockLevel ?? p.stock ?? p.qty ?? 0);
        const reorder = Number(
          p.reorderPoint ??
          p.reorder_point ??
          p.reorderLevel ??
          p.reorder_qty ??
          p.minStock ??
          LOW_THRESHOLD
        );
        const lowBy = Math.max(0, reorder - stock);
        return { ...p, stockLevel: stock, reorderPoint: reorder, lowBy };
      })
      .filter((p) => p.lowBy > 0)
      .sort((a, b) => b.lowBy - a.lowBy);
  }, [products]);

  const stockDistribution = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const c = p.category || "Uncategorized";
      map.set(c, (map.get(c) || 0) + (p.stockLevel ?? 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [products]);

  const suppliers = useMemo(() => {
    if (Array.isArray(suppliersApi) && suppliersApi.length) {
      return suppliersApi.map((s) => {
        const displayName = s.name || s.company || s.title || s.organization || s.displayName || s._id || s.id || (typeof s === "string" ? s : "Unknown supplier");
        const contact = s.email || s.phone || s.contact || null;
        return { id: s.id ?? s._id ?? displayName, name: String(displayName), contact, raw: s };
      });
    }
    const out = [];
    supplierMap.forEach((v, k) => {
      const name = v && (v.displayName || v.name || v.company || v.title) ? (v.displayName || v.name || v.company || v.title) : k;
      const contact = v && (v.email || v.phone || v.contact) ? (v.email || v.phone || v.contact) : "";
      out.push({ id: k, name: String(name), contact, raw: v });
    });
    // dedupe by name (prefer display names)
    const dedup = new Map();
    out.forEach((s) => { const key = String((s.name || '').toLowerCase()); if (!dedup.has(key)) dedup.set(key, s); });
    return Array.from(dedup.values()).sort((a,b)=>a.name.localeCompare(b.name));
  }, [suppliersApi, supplierMap]);

  // actions
  const requestRestock = useCallback(async (productId, qty = 50) => {
    try {
      await axios.post(`/products/${productId}/restock`, { qty });
      alert("Restock requested.");
    } catch (err) {
      console.error("restock error", err);
      alert("Failed to request restock.");
    }
  }, []);

  const contactSupplier = useCallback((supplier) => {
    if (!supplier) return alert("No supplier data");
    // robust extraction
    const cand = supplier.raw || supplier;
    const email = supplier.email || supplier.contact?.email || cand?.email || cand?.contact?.email || cand?.contact || null;
    const phone = supplier.phone || cand?.phone || cand?.contact?.phone || cand?.contact || null;
    if (email && typeof email === 'string') return window.location.href = `mailto:${email}`;
    if (phone && typeof phone === 'string') return window.location.href = `tel:${phone}`;
    // fallback: copy display name to clipboard so admin can search or contact later
    const display = supplier.displayName || supplier.name || supplier.id || supplier._id || JSON.stringify(supplier);
    try {
      navigator.clipboard?.writeText(display?.toString() || '');
      alert(`Supplier info copied: ${display}`);
    } catch (e) {
      alert(`Supplier: ${display}`);
    }
  }, []);

  const acknowledgeAlert = useCallback(async (alertObj) => {
    try {
      const id = alertObj.id || alertObj._id || alertObj.id;
      await axios.post(`/alerts/${id}/acknowledge`).catch(() => axios.post(`/notifications/${id}/acknowledge`).catch(() => {}));
      setAlerts((prev) => prev.filter((a) => {
        const aid = a._id || a.id || a.alertId || a.id;
        return String(aid) !== String(id);
      }));
    } catch (e) {
      console.error("ack error", e);
      alert("Failed to acknowledge");
    }
  }, []);

  if (!isAdmin) return null;

  return (
    <div className={`p-6 bg-gradient-to-b from-gray-50 to-gray-100 min-h-screen ${compact ? "max-w-3xl mx-auto" : "max-w-7xl mx-auto"}`}>
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">📦 Admin · Model + Alerts</h2>
          <p className="text-sm text-gray-500">Real alerts & suppliers from DB · model-focused orders</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            value={queryModel}
            onChange={(e) => setQueryModel(e.target.value)}
            placeholder="Quick model search (e.g. ABC-123 / SKU)"
            className="text-sm px-2 py-1 border rounded"
          />
          <div className="text-sm text-gray-600">Updated: {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Products", value: totalProducts, color: "from-orange-400 to-orange-500" },
          { label: `Low stock (<${LOW_THRESHOLD})`, value: lowStock.length || "None", color: "from-red-400 to-red-500" },
          { label: "Orders", value: totalOrders, color: "from-cyan-400 to-cyan-500" },
          { label: "Avg Order Value", value: `₹${avgOrderValue}`, color: "from-indigo-400 to-indigo-500" },
          { label: "Models matched", value: queryModel ? filteredOrders.length : topProducts.length, color: "from-green-400 to-green-500" },
        ].map((kpi, i) => (
          <div key={i} className={`p-4 rounded-xl shadow-sm bg-gradient-to-r ${kpi.color} text-white hover:scale-[1.01] transition-transform`}>
            <div className="text-xs opacity-90">{kpi.label}</div>
            <div className="text-lg font-bold">{kpi.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="p-6 bg-white rounded shadow text-center">Loading analytics…</div>
      ) : error ? (
        <div className="p-6 bg-red-50 rounded border text-red-700">{error}</div>
      ) : (
        <>
          {/* Top products + Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="col-span-2 bg-white rounded-xl shadow p-4">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Top-selling products / models</h3>
                <div className="text-xs text-gray-500">Based on orders</div>
              </div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 0 }}>
                    <XAxis type="number" />
                    <YAxis dataKey="product" type="category" width={220} />
                    <Tooltip />
                    <Bar dataKey="qty" radius={[6, 6, 6, 6]}>
                      {topProducts.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Alerts panel */}
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Alerts</h3>
                <div className="text-xs text-gray-500">Real-time</div>
              </div>

              {/* show backend alerts first */}
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-2">Backend alerts</div>
                {alerts && alerts.length ? (
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {alerts.map((aRaw) => {
                      const a = normalizeAlert(aRaw);
                      const bg = a.severity === "error" || a.severity === "critical" ? "bg-red-50" :
                                 a.severity === "warning" ? "bg-yellow-50" : "bg-blue-50";
                      return (
                        <div key={a.id} className={`p-2 rounded ${bg} flex items-start justify-between`}>
                          <div>
                            <div className="text-sm font-medium">{a.message}</div>
                            <div className="text-xs text-gray-500">{a.time ? new Date(a.time).toLocaleString() : ""}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setSelectedItem(a); setModalType("alert"); }} className="text-xs px-2 py-1 rounded bg-gray-100">Details</button>
                            <button onClick={() => acknowledgeAlert(a)} className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700">Acknowledge</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">No individual alerts — showing derived insights.</div>
                )}
              </div>

              {/* Low stock (derived) */}
              <div>
                <div className="text-xs text-gray-500 mb-2">Low stock</div>
                {lowStock.length === 0 ? (
                  <div className="text-sm text-gray-600">No low-stock products. 🎉</div>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-auto">
                    {lowStock.slice(0, 8).map((p) => {
                      const sup = findSupplierForProduct(p) || {};
                      const supName = sup?.displayName || sup?.name || sup?.company || sup?.title || sup?.id || sup?._id || "Unknown";
                      return (
                        <div key={p._id || p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <div className="text-sm font-medium">{p.name} {extractModel(p) ? <span className="text-xs text-gray-400">({extractModel(p)})</span> : null}</div>
                            <div className="text-xs text-gray-500">Stock: {p.stockLevel ?? 0} • Reorder: {p.reorderPoint ?? LOW_THRESHOLD} • Low by: {p.lowBy}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setSelectedItem({ ...p, supplier: sup }); setModalType("product"); }} className="text-xs px-2 py-1 rounded bg-gray-100">Details</button>
                            <button onClick={() => requestRestock(p._id || p.id)} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700">Restock</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Suppliers + Top-ordered products */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Suppliers</h3>
                <div className="text-xs text-gray-500">{suppliers.length}</div>
              </div>
              <div className="space-y-2 max-h-60 overflow-auto">
                {suppliers.slice(0, 12).map((s) => (
                  <div key={s.id || s.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.contact || (s.raw && (s.raw.email || s.raw.phone)) || s.id || ""}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setSelectedItem(s); setModalType("supplier"); }} className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700">View</button>
                      <button onClick={() => contactSupplier(s)} className="text-xs px-2 py-1 rounded bg-gray-100">Contact</button>
                    </div>
                  </div>
                ))}
                {!suppliers.length && <div className="text-xs text-gray-500">No supplier records found (check /suppliers or embedded product.supplier fields).</div>}
              </div>
            </div>

            <div className="col-span-2 bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Top-ordered products / models</h3>
                <div className="flex items-center gap-2">
                  <input value={queryProducts} onChange={(e) => setQueryProducts(e.target.value)} placeholder="Search products/model..." className="text-sm px-2 py-1 border rounded" />
                  <div className="text-xs text-gray-500">Most ordered</div>
                </div>
              </div>
              <div className="overflow-auto max-h-60">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-gray-500"><tr><th>Model / Product</th><th>Qty</th><th></th></tr></thead>
                  <tbody>
                    {topOrderedProducts.slice(0, 12).map((p) => (
                      <tr key={p.product} className="border-t">
                        <td className="py-2">{p.product}</td>
                        <td className="py-2 font-medium">{p.qty}</td>
                        <td className="py-2 text-right"><button onClick={() => { setSelectedItem(p); setModalType("product"); }} className="text-xs px-2 py-1 rounded bg-gray-100">View</button></td>
                      </tr>
                    ))}
                    {!topOrderedProducts.length && <tr><td className="py-2 text-xs text-gray-500">No products</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Transactions + Orders */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Transactions (30d)</h3>
              <div style={{ height: 160 }}>
                <ResponsiveContainer>
                  <BarChart data={transactionsPerDay}>
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count">{transactionsPerDay.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Orders by status</h3>
              <div style={{ height: 280 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={orderStatusDist} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} label>
                      {orderStatusDist.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-span-3 bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Recent orders ({paginatedOrders.length})</h3>
                <div className="text-xs text-gray-500">Showing {Math.min(filteredOrders.length, ordersPage * ORDERS_PAGE)} of {filteredOrders.length}</div>
              </div>
              <div className="overflow-auto max-h-72">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-gray-500"><tr><th>Order</th><th>Model / Product</th><th>Total</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {paginatedOrders.map((o) => (
                      <tr key={o._id || o.id} className="border-t">
                        <td className="py-2">{(o._id || o.id)?.toString().slice(0, 10)}</td>
                        <td className="py-2">{getOrderPrimaryModel(o)}</td>
                        <td className="py-2 font-medium">₹{Number(o.totalAmount ?? o.amount ?? 0).toLocaleString()}</td>
                        <td className="py-2">{o.status || "—"}</td>
                        <td className="py-2 text-right"><button onClick={() => { setSelectedItem(o); setModalType("order"); }} className="text-xs px-2 py-1 rounded bg-gray-100">View</button></td>
                      </tr>
                    ))}
                    {!filteredOrders.length && <tr><td className="py-2 text-xs text-gray-500">No orders match the model filter.</td></tr>}
                  </tbody>
                </table>
              </div>
              {ordersPage * ORDERS_PAGE < filteredOrders.length && (
                <div className="mt-3 text-center">
                  <button onClick={() => setOrdersPage((p) => p + 1)} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">Load more</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="mt-6 text-center text-xs text-gray-500">Sensitive KPIs visible to administrators only.</div>

      {/* Modal */}
      {selectedItem && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black opacity-30" onClick={() => setSelectedItem(null)} />
          <div className="relative bg-white rounded-xl shadow-lg p-6 w-[min(900px,95%)] max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-lg font-semibold">
                {modalType === "product" && `Product: ${selectedItem.product || selectedItem.name || extractModel(selectedItem)}`}
                {modalType === "supplier" && `Supplier: ${selectedItem.name || selectedItem.displayName || selectedItem.id}`}
                {modalType === "order" && `Order: ${(selectedItem._id || selectedItem.id)?.toString().slice(0,12)}`}
                {modalType === "alert" && `Alert: ${selectedItem.message?.slice?.(0,60) || ""}`}
              </h4>
              <button onClick={() => setSelectedItem(null)} className="text-gray-500">Close</button>
            </div>

            <div className="text-sm text-gray-700 space-y-3">
              {modalType === "product" && (
                <>
                  <div><strong>Name / Model:</strong> {selectedItem.name || selectedItem.product || extractModel(selectedItem)}</div>
                  <div><strong>Qty ordered:</strong> {selectedItem.qty ?? "—"}</div>
                </>
              )}

              {modalType === "supplier" && (
                <>
                  <div><strong>Name:</strong> {selectedItem.name || selectedItem.displayName || selectedItem.id || selectedItem._id}</div>
                  {selectedItem.contact && <div><strong>Contact:</strong> {JSON.stringify(selectedItem.contact)}</div>}
                  {selectedItem.raw && <div className="text-xs text-gray-500"><strong>Raw:</strong> {JSON.stringify(selectedItem.raw)}</div>}
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => contactSupplier(selectedItem)} className="px-3 py-1 rounded bg-gray-100">Contact</button>
                  </div>
                </>
              )}

              {modalType === "alert" && selectedItem && (
                <>
                  <div><strong>Message:</strong> {selectedItem.message}</div>
                  <div><strong>Severity:</strong> {selectedItem.severity}</div>
                  <div><strong>Time:</strong> {selectedItem.time ? new Date(selectedItem.time).toLocaleString() : "—"}</div>
                  <div><strong>Raw payload:</strong><pre className="text-xs">{JSON.stringify(selectedItem.raw, null, 2)}</pre></div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => acknowledgeAlert(selectedItem)} className="px-3 py-1 rounded bg-indigo-50 text-indigo-700">Acknowledge</button>
                  </div>
                </>
              )}

              {modalType === "order" && (
                <>
                  <div><strong>Order ID:</strong> {selectedItem._id || selectedItem.id}</div>
                  <div><strong>Primary model:</strong> {getOrderPrimaryModel(selectedItem)}</div>
                  <div><strong>Status:</strong> {selectedItem.status}</div>
                  <div><strong>Total:</strong> ₹{Number(selectedItem.totalAmount ?? selectedItem.amount ?? 0).toLocaleString()}</div>
                  <div className="mt-2"><strong>Items:</strong>
                    <ul className="list-disc ml-5">
                      {(selectedItem.items || []).map((it, idx) => <li key={idx}>{extractModel(it) || it.productName || it.name} x {it.qty}</li>)}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
