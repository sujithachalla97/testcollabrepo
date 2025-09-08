import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/" replace />; // not logged in

  if (!allowedRoles.includes(user.role)) {
    return <h2>⛔ Access denied</h2>; // wrong role
  }

  return children;
};

export default ProtectedRoute;
