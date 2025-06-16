import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaUsers, FaCar, FaUserShield } from "react-icons/fa";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  // Optional: Auth guard to block access if not admin
  useEffect(() => {
    if (!token || role !== "admin") {
      navigate("/login", { replace: true });
    }
  }, [navigate, token, role]);

  return (
    <div>
      <h2 style={{ textAlign: "center" }}>Admin Panel</h2>
      {/* User and ride management UI will go here */}
      <div style={{ display: "flex", justifyContent: "space-around", marginTop: 20 }}>
        <FaUsers size={32} title="All Users" />
        <FaCar size={32} title="All Rides" />
        <FaUserShield size={32} title="Approvals" />
      </div>
    </div>
  );
}