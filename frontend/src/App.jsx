import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider,useAuth } from "./context/AuthContext";
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
       <Routes>
  {/* Public route */}
  <Route path="/login" element={<LoginRedirect />} />

  {/* Protected Dashboard */}
  <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    }
  >
    {/* Nested routes rendered in <Outlet /> */}
    <Route path="products" element={<Products />} />
    <Route path="suppliers" element={<Suppliers />} />
    <Route path="orders" element={<Orders />} />
    <Route path="transactions" element={<Transactions />} />
    <Route path="alerts" element={<Alerts />} />

    {/* Admin-only */}
    <Route path="users/managers" element={<Managers />} />
    <Route path="users/staff" element={<Staff />} />

    {/* Default child route */}
    <Route index element={<Products />} />  {/* loads Products by default */}
  </Route>

  {/* Catch-all redirect */}
  <Route path="*" element={<Navigate to="/login" />} />
</Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}

function LoginRedirect() {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" /> : <Login />;
}

export default App;
