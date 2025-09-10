// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "../api/axiosInstance";
import { toast } from "react-toastify";

export default function Dashboard() {
  const auth = useAuth();
  const userFromCtx = auth?.user ?? null;
  const setAuthUser = typeof auth?.setUser === "function" ? auth.setUser : null;
  const logout = auth?.logout;
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false); // mobile sidebar

  const [user, setUser] = useState(userFromCtx);
  const [loadingUser, setLoadingUser] = useState(false);

  // normalize helper
  const normalizeUser = (payload) => payload?.user ?? payload?.data ?? payload;

  // fetch canonical user on mount and when route changes so header shows latest name
  const fetchMe = async () => {
    try {
      setLoadingUser(true);
      const res = await axios.get("/auth/me");
      const data = normalizeUser(res.data);
      if (data) {
        setUser(data);
        if (setAuthUser) setAuthUser(data);
      }
    } catch (err) {
      console.error("fetch me", err);
      // don't spam users with toast on every route change; show only if explicit failure
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const handleLogout = () => {
    if (logout) logout();
    navigate("/login");
  };

  const role = (user?.role || "").toLowerCase();
  const isStaff = role === "staff";
  const isManager = role === "manager";
  const isAdmin = role === "admin";

  // ... rest of your navItems, visibleNavItems, goToRoleLanding, dashboardActive (unchanged)
  const navItems = [
    { to: "products", label: "Products" },
    { to: "suppliers", label: "Suppliers" },
    { to: "orders", label: "Orders" },
    { to: "transactions", label: "Transactions" },
    { to: "alerts", label: "Alerts" },
  ];

  const userItems = [
    { to: "users/managers", label: "Managers" },
    { to: "users/staff", label: "Staff" },
  ];

  const visibleNavItems = navItems.filter((i) => !(isStaff && i.to === "suppliers"));

 const displayName = (() => {
  if (!user) {
    return userFromCtx
      ? userFromCtx.username || userFromCtx.firstName || userFromCtx.email
      : null;
  }

  // ✅ username has priority
  return (
    user.username ||
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
    user.email ||
    null
  );
})();


  const goToRoleLanding = () => {
    if (isStaff) {
      navigate("/dashboard/staff");
      return;
    }
    if (isManager) {
      navigate("/dashboard/manager");
      return;
    }
    if (isAdmin) {
      navigate("/dashboard/admin");
      return;
    }
    navigate("/dashboard");
  };

  const dashboardActive = (() => {
    const p = location.pathname || "";
    if (isStaff) return p === "/dashboard/staff" || p.startsWith("/dashboard/staff");
    if (isManager) return p === "/dashboard/manager" || p.startsWith("/dashboard/manager");
    if (isAdmin) return p === "/dashboard/admin" || p.startsWith("/dashboard/admin");
    return p === "/dashboard" || p.startsWith("/dashboard") || p === "/";
  })();

  // ---------- render (keeps your existing layout) ----------
  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200"
        style={{ flex: "0 0 16rem" }}
        aria-label="Sidebar"
      >
        <div className="h-screen flex flex-col justify-between p-6 overflow-hidden">
          <div>
            <div className="mb-6">
              <div
                onClick={goToRoleLanding}
                role="button"
                className={`cursor-pointer text-2xl font-extrabold ${
                  dashboardActive ? "text-indigo-700" : "text-indigo-600"
                }`}
              >
                TIMS
              </div>
              <div className="text-xs text-gray-500 mt-1">Inventory management</div>
            </div>

            <nav className="space-y-2">
              {/* Dashboard tab */}
              <div
                onClick={goToRoleLanding}
                role="button"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                  dashboardActive ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="w-6 text-center text-indigo-400">◉</span>
                <span>Dashboard</span>
              </div>

              {/* other nav items */}
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                      isActive ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-100"
                    }`
                  }
                >
                  <span className="w-6 text-center text-indigo-400">●</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          <div>
            {isAdmin && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="font-semibold mb-3 text-xs uppercase tracking-wider text-gray-500">
                  Manage Users
                </p>
                <div className="space-y-2">
                  {userItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `block px-3 py-2 rounded-lg text-sm font-medium ${
                          isActive ? "bg-cyan-50 text-cyan-700" : "text-gray-700 hover:bg-gray-100"
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile header + sidebar */} 
      {/* (keeps your existing mobile markup: omitted here for brevity in this snippet) */}

      {/* Right panel */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <header className="flex-none bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Welcome, {displayName ?? "User"}</h1>
            <div className="text-xs text-gray-500 hidden sm:block">{user?.email ?? userFromCtx?.email ?? ""}</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">{user?.role ? (user.role || "").toUpperCase() : (userFromCtx?.role || "").toUpperCase()}</div>

            <NavLink to="profile" className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700">
              Profile
            </NavLink>

            <button onClick={handleLogout} className="px-3 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700">
              Logout
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
