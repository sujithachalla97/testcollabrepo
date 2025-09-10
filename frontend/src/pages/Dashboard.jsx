// src/pages/Dashboard.jsx
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // mobile sidebar

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

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
              <div className="text-2xl font-extrabold text-indigo-600">TIMS</div>
              <div className="text-xs text-gray-500 mt-1">
                Inventory management
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-700 hover:bg-gray-100"
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
            {user?.role === "admin" && (
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
                          isActive
                            ? "bg-cyan-50 text-cyan-700"
                            : "text-gray-700 hover:bg-gray-100"
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
      <div className="md:hidden w-full">
        <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen((s) => !s)}
              className="p-2 rounded-md bg-gray-100 hover:bg-gray-200"
              aria-label="Toggle menu"
            >
              <svg
                className="w-5 h-5 text-gray-700"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div>
              <div className="text-lg font-semibold text-gray-900">TIMS</div>
              <div className="text-xs text-gray-500">{user?.email ?? ""}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NavLink
              to="profile"
              className="px-3 py-1 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            >
              Profile
            </NavLink>
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded-md bg-red-600 text-white text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {open && (
          <div className="fixed inset-0 z-40 flex">
            <div className="w-64 bg-white border-r border-gray-200 p-6">
              <div className="mb-6">
                <div className="text-2xl font-extrabold text-indigo-600">
                  TIMS
                </div>
              </div>

              <nav className="space-y-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-gray-700 hover:bg-gray-100"
                      }`
                    }
                  >
                    <span className="w-6 text-center text-indigo-400">●</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="flex-1" onClick={() => setOpen(false)} />
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <header className="flex-none bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Welcome, {user?.username ?? "User"}
            </h1>
            <div className="text-xs text-gray-500 hidden sm:block">
              {user?.email ?? ""}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              {user?.role ? user.role.toUpperCase() : ""}
            </div>

            {/* 👇 Profile beside Logout */}
            <NavLink
              to="profile"
              className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            >
              Profile
            </NavLink>

            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700"
            >
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
