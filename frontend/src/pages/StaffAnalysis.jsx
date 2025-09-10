import React, { useEffect, useState, useMemo } from 'react';
import axios from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';
// Recharts components (assume recharts is installed in your project)
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// StaffAnalysis.jsx
// A compact analysis dashboard component intended to be shown to staff users.
// Fetches orders, transactions and products, and derives several quick insights:
//  - monthly restock/stockout trend (line)
//  - top suppliers by volume (bar)
//  - stock status distribution (pie)
//  - low-stock products table
// This is a single-file, drop-in React component. Uses Tailwind for styling.

const COLORS = ['#4f46e5', '#06b6d4', '#f97316', '#ef4444', '#10b981', '#8b5cf6'];

export default function StaffAnalysis({ compact = false }) {
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';

  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [oRes, tRes, pRes] = await Promise.all([
          axios.get('/orders?page=1&limit=200').then((r) => r.data.items ?? r.data ?? []),
          axios.get('/transactions?limit=200').then((r) => r.data.items ?? r.data ?? []),
          axios.get('/products?limit=0').then((r) => r.data.items ?? r.data ?? []),
        ]);
        if (!mounted) return;
        setOrders(Array.isArray(oRes) ? oRes : []);
        setTransactions(Array.isArray(tRes) ? tRes : []);
        setProducts(Array.isArray(pRes) ? pRes : []);
      } catch (err) {
        console.error('StaffAnalysis load error', err);
        setError('Failed to load analytics');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (isStaff) loadAll();
    return () => (mounted = false);
  }, [isStaff]);

  // Derived metrics
  const stockStatus = useMemo(() => {
    const total = products.length;
    const out = products.filter((p) => (p.stockLevel ?? 0) === 0).length;
    const low = products.filter((p) => (p.stockLevel ?? 0) > 0 && (p.reorderPoint ?? 0) >= (p.stockLevel ?? 0)).length;
    const healthy = total - out - low;
    return [
      { name: 'Healthy', value: healthy },
      { name: 'Low', value: low },
      { name: 'Out', value: out },
    ];
  }, [products]);

  const lowStockList = useMemo(() => {
    return products
      .filter((p) => (p.stockLevel ?? 0) <= (p.reorderPoint ?? 0))
      .sort((a, b) => (a.stockLevel ?? 0) - (b.stockLevel ?? 0))
      .slice(0, 20);
  }, [products]);

  const supplierVolumes = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const s = p.supplierName || 'Unknown';
      const qty = Number(p.stockLevel ?? 0);
      map.set(s, (map.get(s) || 0) + qty);
    });
    return Array.from(map.entries())
      .map(([supplier, qty]) => ({ supplier, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [products]);

  const monthlyTrend = useMemo(() => {
    // monthKey e.g. '2025-09'
    const m = new Map();
    const add = (when, type, qty = 0) => {
      const d = new Date(when);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!m.has(key)) m.set(key, { month: key, restock: 0, stockout: 0 });
      m.get(key)[type] += Number(qty || 0);
    };
    transactions.forEach((tx) => {
      const t = tx.type === 'restock' ? 'restock' : 'stockout';
      (tx.items || []).forEach((it) => add(tx.createdAt || tx.createdAt, t, it.qty || 0));
    });
    // ensure last 6 months present
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!m.has(key)) m.set(key, { month: key, restock: 0, stockout: 0 });
    }
    return Array.from(m.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [transactions]);

  if (!isStaff) return null; // don't show to non-staff

  return (
    <div className={`p-6 bg-gray-50 min-h-screen ${compact ? 'max-w-3xl mx-auto' : 'max-w-6xl mx-auto'}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">Staff Analytics</h2>
          <p className="text-sm text-gray-500">High-level operational insights (staff view-only)</p>
        </div>
        <div className="text-sm text-gray-600">Updated: {new Date().toLocaleString()}</div>
      </div>

      {loading ? (
        <div className="p-6 bg-white rounded shadow text-center">Loading analytics…</div>
      ) : error ? (
        <div className="p-6 bg-red-50 rounded border text-red-700">{error}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="col-span-2 bg-white rounded shadow p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Monthly stock flow (last 6 months)</h3>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={monthlyTrend}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="restock" stroke="#06b6d4" strokeWidth={2} />
                  <Line type="monotone" dataKey="stockout" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded shadow p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Stock status</h3>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={stockStatus} dataKey="value" nameKey="name" label>
                    {stockStatus.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-span-2 bg-white rounded shadow p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Top suppliers by on-hand stock</h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={supplierVolumes} layout="vertical">
                  <XAxis type="number" />
                  <YAxis dataKey="supplier" type="category" width={140} />
                  <Tooltip />
                  <Bar dataKey="qty">
                    {supplierVolumes.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-span-1 bg-white rounded shadow p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Lowest stock items</h3>
            <div className="text-xs text-gray-600 mb-2">Showing up to 20 items near or below reorder point</div>
            <div className="max-h-56 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-gray-500">
                  <tr>
                    <th className="pb-2">Model</th>
                    <th className="pb-2">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockList.map((p) => (
                    <tr key={p.modelNumber} className="border-t">
                      <td className="py-2 text-sm">{p.modelNumber} {p.productName ? `— ${p.productName}` : ''}</td>
                      <td className="py-2 text-sm font-medium">{p.stockLevel ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-right text-xs text-gray-500">Data visible to staff only — no edit permissions granted here.</div>
    </div>
  );
}
