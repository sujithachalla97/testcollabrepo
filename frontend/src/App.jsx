// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./routes/ProtectedRoute";
import Products from "./pages/Products";
import Suppliers from "./pages/Suppliers";
import Orders from "./pages/Orders";
import Transactions from "./pages/Transactions";
import Alerts from "./pages/Alerts";
import Managers from "./pages/Managers";
import Staff from "./pages/Staff";
import Profile from "./pages/Profile";
import StaffAnalysis from "./pages/StaffAnalysis";
import ManagerAnalysis from "./pages/ManagerAnalysis";
import AdminAnalysis from "./pages/AdminAnalysis";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRedirect />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          >
            <Route index element={<Products />} />
            <Route path="products" element={<Products />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="orders" element={<Orders />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="alerts" element={<Alerts />} />

            {/* Role-specific analysis pages rendered inside Dashboard layout */}
            <Route path="staff" element={<StaffAnalysis />} />
            <Route path="manager" element={<ManagerAnalysis />} />
            <Route path="admin" element={<AdminAnalysis />} />

            <Route path="users/managers" element={<Managers />} />
            <Route path="users/staff" element={<Staff />} />

            <Route path="profile" element={<Profile />} />
          </Route>

          {/* fallback */}
          <Route path="*" element={<SmartFallback />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function LoginRedirect() {
  const { user } = useAuth();
  if (!user) return <Login />;

  const role = (user.role || "").toLowerCase();
  if (role === "staff") return <Navigate to="/dashboard/staff" replace />;
  if (role === "manager") return <Navigate to="/dashboard/manager" replace />;
  if (role === "admin") return <Navigate to="/dashboard/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

function SmartFallback() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const role = (user.role || "").toLowerCase();
  if (role === "staff") return <Navigate to="/dashboard/staff" replace />;
  if (role === "manager") return <Navigate to="/dashboard/manager" replace />;
  if (role === "admin") return <Navigate to="/dashboard/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default App;
