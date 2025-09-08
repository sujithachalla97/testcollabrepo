// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children }) {
  const { user } = useAuth();

  if (!user) {
    // not logged in → redirect to login
    return <Navigate to="/login" replace />;
  }

  return children; // logged in → show page
}

export default ProtectedRoute;
