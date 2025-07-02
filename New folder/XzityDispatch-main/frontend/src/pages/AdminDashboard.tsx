import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUsers, FaCar, FaUserShield } from "react-icons/fa";
import PendingDriversList from "../components/PendingDriversList"; // Make sure the path is correct

/**
 * AdminDashboard
 * - Shows tabbed views for: All Users, All Rides, Approvals
 * - Fetches data for each tab when selected
 * - Allows blocking/unblocking users from the users tab
 */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  // UI state
  const [activeTab, setActiveTab] = useState("users");

  // Data state
  const [users, setUsers] = useState([]);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auth guard
  useEffect(() => {
    if (!token || role !== "admin") {
      navigate("/login", { replace: true });
    }
  }, [navigate, token, role]);

  // Fetchers
  useEffect(() => {
    setError("");
    setLoading(true);

    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/admin/users", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch users");
        const data = await res.json();
        setUsers(data);
      } catch (e) {
        setError("Failed to load users.");
      } finally {
        setLoading(false);
      }
    };

    const fetchRides = async () => {
      try {
        const res = await fetch("/api/admin/rides", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch rides");
        const data = await res.json();
        setRides(data);
      } catch (e) {
        setError("Failed to load rides.");
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === "users") fetchUsers();
    if (activeTab === "rides") fetchRides();
    // No need to fetch pending drivers here anymore!
  }, [activeTab, token]);

  // Block/Unblock user
  async function handleBlockToggle(userId, isBlocked) {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/admin/users/${userId}/block`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ disabled: !isBlocked }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update user status");
      }
      // Update users state to reflect changed status
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, disabled: !isBlocked } : u
        )
      );
    } catch (e) {
      setError(e.message || "Failed to update user status.");
    } finally {
      setLoading(false);
    }
  }

  // Section renderers
  function renderUsers() {
    return (
      <div style={{ margin: "30px auto", maxWidth: 900 }}>
        <h3>All Users</h3>
        {loading && <p>Loading users...</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}
        {!loading && !error && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Vehicle</th>
                <th style={thStyle}>Busy</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Block/Unblock</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={tdStyle}>{u.name}</td>
                  <td style={tdStyle}>{u.phone}</td>
                  <td style={tdStyle}>{u.email}</td>
                  <td style={tdStyle}>{u.role}</td>
                  <td style={tdStyle}>{u.vehicleType || "-"}</td>
                  <td style={tdStyle}>{u.isBusy ? "Yes" : "No"}</td>
                  <td style={tdStyle}>{u.disabled ? "Blocked" : "Active"}</td>
                  <td style={tdStyle}>
                    <button
                      style={{
                        padding: "6px 16px",
                        background: u.disabled ? "#388e3c" : "#d32f2f",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        cursor: loading ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        fontSize: 14,
                        transition: "background 0.2s",
                      }}
                      disabled={loading}
                      onClick={() => handleBlockToggle(u.id, u.disabled)}
                    >
                      {u.disabled ? "Unblock" : "Block"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

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
      <div style={tabBarStyle}>
        <TabIcon
          icon={<FaUsers size={28} />}
          label="All Users"
          active={activeTab === "users"}
          onClick={() => setActiveTab("users")}
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
      {activeTab === "users" && renderUsers()}
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

// --- Styling helpers and TabIcon ---
const tabBarStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 40,
  marginTop: 24,
  marginBottom: 16,
};

function TabIcon({ icon, label, active, onClick }) {
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

const thStyle = {
  border: "1px solid #ddd",
  padding: "8px",
  background: "#f5f5f5",
  textAlign: "left",
};

const tdStyle = {
  border: "1px solid #ddd",
  padding: "8px",
  textAlign: "left",
};