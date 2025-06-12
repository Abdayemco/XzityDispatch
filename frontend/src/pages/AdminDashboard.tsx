import React from "react";
import { FaUsers, FaCar, FaUserShield } from "react-icons/fa";

export default function AdminDashboard() {
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