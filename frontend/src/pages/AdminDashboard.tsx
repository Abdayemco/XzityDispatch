import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaUsers, FaCar, FaUserShield, FaUser } from "react-icons/fa";
import PendingDriversList from "../components/PendingDriversList";
import AdminDriversTable from "../pages/AdminDriversTable";
import AdminCustomersTable from "../pages/AdminCustomersTable";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  // UI state
  const [activeTab, setActiveTab] = useState("users");
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const API_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
    : "";

  useEffect(() => {
    if (!token || role !== "admin") {
      navigate("/login", { replace: true });
    }
  }, [navigate, token, role]);

  // Fetch rides for rides tab
  useEffect(() => {
    if (activeTab !== "rides") return;
    setError("");
    setLoading(true);
    fetch(`${API_URL}/api/admin/rides`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch rides");
        const data = await res.json();
        setRides(data);
      })
      .catch(() => setError("Failed to load rides."))
      .finally(() => setLoading(false));
  }, [activeTab, token, API_URL]);

  function renderRides() {
    return (
      <div style={{ margin: "30px auto", maxWidth: 1100 }}>
        <h3>All Rides</h3>
        {loading && <p>Loading rides...</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}
        {!loading && !error && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Driver</th>
                <th style={thStyle}>Origin</th>
                <th style={thStyle}>Destination</th>
                <th style={thStyle}>Vehicle</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Requested</th>
                <th style={thStyle}>Rating</th>
              </tr>
            </thead>
            <tbody>
              {rides.map((r) => (
                <tr key={r.id}>
                  <td style={tdStyle}>{r.id}</td>
                  <td style={tdStyle}>{r.customer?.name || r.customerId}</td>
                  <td style={tdStyle}>{r.driver?.name || r.driverId || "-"}</td>
                  <td style={tdStyle}>{`${r.originLat}, ${r.originLng}`}</td>
                  <td style={tdStyle}>{`${r.destLat}, ${r.destLng}`}</td>
                  <td style={tdStyle}>{r.vehicleType}</td>
                  <td style={tdStyle}>{r.status}</td>
                  <td style={tdStyle}>{r.requestedAt ? new Date(r.requestedAt).toLocaleString() : "-"}</td>
                  <td style={tdStyle}>{r.rating || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ textAlign: "center" }}>Admin Panel</h2>
      {/* Live Map Link */}
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <Link
          to="/admin/live-map"
          style={{
            display: "inline-block",
            margin: "0 0 24px 0",
            background: "#1976d2",
            color: "#fff",
            padding: "8px 22px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 17,
            boxShadow: "0 1px 5px #0001"
          }}
        >
          Live Map of Drivers & Rides
        </Link>
      </div>
      <div style={tabBarStyle}>
        <TabIcon
          icon={<FaUsers size={28} />}
          label="All Drivers"
          active={activeTab === "users"}
          onClick={() => setActiveTab("users")}
        />
        <TabIcon
          icon={<FaUser size={28} />}
          label="All Customers"
          active={activeTab === "customers"}
          onClick={() => setActiveTab("customers")}
        />
        <TabIcon
          icon={<FaCar size={28} />}
          label="All Rides"
          active={activeTab === "rides"}
          onClick={() => setActiveTab("rides")}
        />
        <TabIcon
          icon={<FaUserShield size={28} />}
          label="Approvals"
          active={activeTab === "approvals"}
          onClick={() => setActiveTab("approvals")}
        />
      </div>
      {activeTab === "users" && <AdminDriversTable />}
      {activeTab === "customers" && <AdminCustomersTable />}
      {activeTab === "rides" && renderRides()}
      {activeTab === "approvals" && (
        <div style={{ margin: "30px auto", maxWidth: 900 }}>
          <h3>Pending Driver Approvals</h3>
          <PendingDriversList token={token} />
        </div>
      )}
    </div>
  );
}

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 40,
  marginTop: 24,
  marginBottom: 16,
};

type TabIconProps = {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
};

function TabIcon({ icon, label, active, onClick }: TabIconProps) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        color: active ? "#1976d2" : "#333",
        borderBottom: active ? "3px solid #1976d2" : "3px solid transparent",
        paddingBottom: 4,
        fontWeight: active ? "bold" : "normal",
        minWidth: 80,
      }}
    >
      {icon}
      <span style={{ fontSize: 15, marginTop: 3 }}>{label}</span>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "8px",
  background: "#f5f5f5",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "8px",
  textAlign: "left",
};