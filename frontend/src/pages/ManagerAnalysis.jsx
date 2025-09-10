import React, { useEffect, useState } from "react";
import axios from "../api/axiosInstance";
import { toast } from "react-toastify";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { Box, AlertTriangle, ShoppingCart, Clock } from "lucide-react";

export default function ManagerAnalysis() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({
    totalProducts: 0,
    lowStockCount: 0,
    pendingOrders: 0,
    recentTransactionsCount: 0,
  });
  const [monthlyTx, setMonthlyTx] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);

  // flexible normalizers
  const normalizeArray = (resp) => {
    if (!resp) return [];
    if (Array.isArray(resp)) return resp;
    if (resp.items) return resp.items;
    if (resp.data && Array.isArray(resp.data)) return resp.data;
    if (resp.series) return resp.series;
    if (resp.results) return resp.results;
    return [];
  };

  const normalizeScalar = (resp, fallback = 0) => {
    if (!resp) return fallback;
    if (typeof resp === "number") return resp;
    if (resp.meta?.total) return resp.meta.total;
    if (resp.count) return resp.count;
    if (Array.isArray(resp)) return resp.length;
    return fallback;
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [prodRes, alertsRes, ordersRes, txRes, topRes] = await Promise.all([
        axios.get("/products?limit=1").catch((e) => e.response || { error: e.message }),
        axios.get("/alerts/low-stock").catch((e) => e.response || { error: e.message }),
        axios.get("/orders?status=pending&limit=1").catch((e) => e.response || { error: e.message }),
        axios.get("/transactions?range=30").catch((e) => e.response || { error: e.message }),
        axios.get("/reports/top-products?limit=10").catch((e) => e.response || { error: e.message }),
      ]);

      const totalProducts = normalizeScalar(prodRes?.data ?? prodRes);
      const lowStock = normalizeArray(alertsRes?.data ?? alertsRes);
      const pending = normalizeScalar(ordersRes?.data ?? ordersRes);
      const txSeries = normalizeArray(txRes?.data ?? txRes);

      // build series for chart
      let monthlySeries = [];
      if (Array.isArray(txSeries) && txSeries.length > 0) {
        monthlySeries = txSeries.map((d) => ({
          date: d.date || d.day || d._id || (d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ""),
          count: d.count ?? d.total ?? d.c ?? d.qty ?? 0,
        }));
      } else {
        // sensible 7-day fallback
        const fallback = [];
        for (let i = 6; i >= 0; i--) {
          const dd = new Date();
          dd.setDate(dd.getDate() - i);
          fallback.push({ date: dd.toLocaleDateString(), count: 0 });
        }
        monthlySeries = fallback;
      }

      const top = normalizeArray(topRes?.data ?? topRes).slice(0, 10);
      // map top products into { name, sold }
      const topChart = top.map((p, i) => ({
        name: p.name || p.productName || p.modelNumber || `#${i + 1}`,
        sold: p.sold ?? p.count ?? p.qty ?? p.totalSold ?? 0,
      }));

      const recent = normalizeArray(alertsRes?.data ?? alertsRes).slice(0, 6);

      setOverview({
        totalProducts: totalProducts || 0,
        lowStockCount: lowStock.length || 0,
        pendingOrders: pending || 0,
        recentTransactionsCount: txSeries?.length ?? 0,
      });

      setMonthlyTx(monthlySeries);
      setTopProducts(topChart);
      setRecentAlerts(recent);
    } catch (err) {
      console.error("manager fetch", err);
      toast.error("Failed to load manager metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpiCard = (title, value, icon) => (
    <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 border">
      <div className="bg-indigo-50 p-3 rounded-lg grid place-items-center">{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{title}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Manager Analysis</h2>
            <p className="text-sm text-gray-500">Overview of inventory, orders and alerts — actionable insights for managers.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchAll} className="px-3 py-2 border rounded-lg bg-white hover:bg-gray-50">Refresh</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {kpiCard("Total Products", loading ? "..." : overview.totalProducts, <Box size={20} className="text-indigo-600" />)}
          {kpiCard("Low Stock", loading ? "..." : overview.lowStockCount, <AlertTriangle size={20} className="text-amber-600" />)}
          {kpiCard("Pending Orders", loading ? "..." : overview.pendingOrders, <ShoppingCart size={20} className="text-emerald-600" />)}
          {kpiCard("Transactions (30d)", loading ? "..." : overview.recentTransactionsCount, <Clock size={20} className="text-sky-600" />)}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl p-4 shadow-sm border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Transactions — last 30 days</h3>
                <div className="text-sm text-gray-500">Daily transaction counts</div>
              </div>
              <div className="text-sm text-gray-500">Source: transactions API</div>
            </div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTx} margin={{ top: 5, right: 12, left: -12, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#6366F1" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-4 shadow-sm border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Top Moving Products</h4>
                <div className="text-xs text-gray-500">Last 30 days</div>
              </div>

              {/* Bar chart for top products */}
              {topProducts.length === 0 ? (
                <div className="text-sm text-gray-500">No data</div>
              ) : (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical" margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={140} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="sold" fill="#34D399" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Recent Alerts</h4>
                <div className="text-xs text-gray-500">Low stock</div>
              </div>
              {recentAlerts.length === 0 ? (
                <div className="text-sm text-gray-500">No alerts</div>
              ) : (
                <ul className="space-y-2">
                  {recentAlerts.map((a) => (
                    <li key={a._id || a.id} className="flex items-start gap-3">
                      <div className="text-amber-600"><AlertTriangle size={18} /></div>
                      <div>
                        <div className="text-sm font-medium">{a.productName || a.modelNumber}</div>
                        <div className="text-xs text-gray-500">Low by {a.lowBy} — Stock: {a.stockLevel}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl p-4 shadow-sm border">
          <h4 className="font-semibold mb-2">Quick Actions</h4>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => window.location.assign('/dashboard/alerts')} className="px-4 py-2 rounded-lg border hover:bg-gray-50">View Alerts</button>
            <button onClick={() => window.location.assign('/dashboard/transactions')} className="px-4 py-2 rounded-lg border hover:bg-gray-50">Open Transactions</button>
            <button onClick={() => window.location.assign('/dashboard/products')} className="px-4 py-2 rounded-lg border hover:bg-gray-50">Products</button>
          </div>
        </div>
      </div>
    </div>
  );
}
