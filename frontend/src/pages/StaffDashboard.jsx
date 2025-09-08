import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

function StaffDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/"); // ✅ redirect to login
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>🛠 Staff Dashboard</h1>
      <p>Welcome {user?.firstName || user?.username}</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

export default StaffDashboard;
