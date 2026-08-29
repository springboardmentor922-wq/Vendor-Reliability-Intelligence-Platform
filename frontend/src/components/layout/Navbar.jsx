import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <span className="navbar-title">VendorIQ</span>

      {currentUser && (
        <div className="navbar-user">
          <span>{currentUser.full_name}</span>
          <span className="navbar-role">{currentUser.role}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      )}
    </nav>
  );
}
