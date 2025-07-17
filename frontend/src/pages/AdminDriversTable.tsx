import React, { useEffect, useState } from "react";

type Driver = {
  id: number;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  vehicleType?: string;
  online?: boolean;
  lat?: number;
  lng?: number;
  country?: string;
  area?: string;
  trialStart?: string | null;
  trialEnd?: string | null;
  subscriptionStatus?: string | null;
  subscriptionFee?: number | null;
  paymentMethod?: string | null;
  isSubscriptionDisabled?: boolean;
  disabled?: boolean;
};

type ScheduledRide = {
  scheduledAt: string;
  destLat: number;
  destLng: number;
  customerName?: string;
  status?: string;
  vehicleType?: string;
};

const DEFAULT_PAGE_SIZE = 20;

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  CAR: "Car",
  DELIVERY: "Delivery",
  TUKTUK: "Tuktuk",
  TRUCK: "Truck",
  WATER_TRUCK: "Water Truck",
  TOW_TRUCK: "Tow Truck",
  WHEELCHAIR: "Wheelchair",
  LIMO: "Limo",
};

function driversToCSV(drivers: Driver[]): string {
  const columns = [
    "id", "name", "phone", "email", "vehicleType", "online", "subscriptionStatus", "trialEnd", "lat", "lng"
  ];
  const header = columns.join(",");
  const rows = drivers.map(driver =>
    columns.map(col => {
      let value = driver[col as keyof Driver];
      if (col === "vehicleType") value = VEHICLE_TYPE_LABELS[value as string] || value || "";
      if (col === "online") value = driver.online ? "Online" : "Offline";
      if (col === "trialEnd" && driver.trialEnd) value = new Date(driver.trialEnd).toISOString().split("T")[0];
      return `"${value ?? ""}"`;
    }).join(",")
  );
  return [header, ...rows].join("\r\n");
}

function getSubscriptionStatus(driver: Driver) {
  if (driver.disabled) return { text: "Disabled", color: "#888" };
  if (driver.isSubscriptionDisabled) return { text: "Account on Hold", color: "#888" };

  const now = Date.now();
  const trialEnd = driver.trialEnd ? new Date(driver.trialEnd).getTime() : null;
  const sub = (driver.subscriptionStatus || "").toLowerCase();

  if (sub === "active" && (!trialEnd || trialEnd > now)) {
    return { text: "Active", color: "#2e7d32" };
  }
  if (trialEnd && trialEnd > now) {
    const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
    return { text: `Trial (${daysLeft} days left)`, color: "#388e3c" };
  }
  if (trialEnd && trialEnd <= now && sub !== "active") {
    return { text: "Expired", color: "#d32f2f" };
  }
  return { text: "Unknown", color: "#aaa" };
}

export default function AdminDriversTable() {
  const API_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
    : "";
  const token = localStorage.getItem("token");

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [scheduledRides, setScheduledRides] = useState<{ [id: number]: ScheduledRide | null }>({});
  const [noShowCounts, setNoShowCounts] = useState<{ [id: number]: number }>({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Driver>("id");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [online, setOnline] = useState<"" | "true" | "false">("");
  const [vehicleType, setVehicleType] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [area, setArea] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    params.append("limit", String(DEFAULT_PAGE_SIZE));
    params.append("offset", String((page - 1) * DEFAULT_PAGE_SIZE));
    params.append("sortBy", sortBy);
    params.append("order", order);
    if (search) params.append("search", search);
    if (online) params.append("online", online);
    if (vehicleType) params.append("vehicleType", vehicleType);
    if (country) params.append("country", country);
    if (area) params.append("area", area);

    fetch(`${API_URL}/api/admin/drivers?${params.toString()}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then(async (res) => {
        if (res.status === 401) {
          setError("Unauthorized. Please log in again.");
          setDrivers([]);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch drivers");
        const data = await res.json();
        setDrivers(data);
      })
      .catch((e) => {
        setDrivers([]);
        setError("Failed to fetch drivers.");
      })
      .finally(() => setLoading(false));
  }, [API_URL, page, sortBy, order, search, online, vehicleType, country, area, token]);

  // Fetch scheduled ride + no show count for each driver on page
  useEffect(() => {
    drivers.forEach((driver) => {
      // Scheduled ride info
      fetch(`${API_URL}/api/admin/drivers/${driver.id}/scheduled_ride`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("No scheduled ride");
          const data = await res.json();
          setScheduledRides((prev) => ({ ...prev, [driver.id]: data }));
        })
        .catch(() => setScheduledRides((prev) => ({ ...prev, [driver.id]: null })));

      // No Show count
      fetch(`${API_URL}/api/admin/drivers/${driver.id}/no_show_count`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("No show count");
          const data = await res.json();
          setNoShowCounts((prev) => ({ ...prev, [driver.id]: data.count || 0 }));
        })
        .catch(() => setNoShowCounts((prev) => ({ ...prev, [driver.id]: 0 })));
    });
  }, [drivers, API_URL, token]);

  const columns: { label: string; key: keyof Driver }[] = [
    { label: "ID", key: "id" },
    { label: "Name", key: "name" },
    { label: "Phone", key: "phone" },
    { label: "Email", key: "email" },
    { label: "Vehicle", key: "vehicleType" },
    { label: "Online", key: "online" },
    { label: "Subscription Status", key: "subscriptionStatus" },
    { label: "Country", key: "country" },
    { label: "Area", key: "area" },
    { label: "Lat", key: "lat" },
    { label: "Lng", key: "lng" },
  ];

  function handleSort(key: keyof Driver) {
    if (sortBy === key) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSortBy(key);
      setOrder("asc");
    }
    setPage(1);
  }

  const vehicleTypes = Object.entries(VEHICLE_TYPE_LABELS);
  const countries = Array.from(new Set(drivers.map(d => d.country).filter(Boolean))) as string[];
  const areas = Array.from(new Set(drivers.map(d => d.area).filter(Boolean))) as string[];

  function nextPage() { setPage(page + 1); }
  function prevPage() { if (page > 1) setPage(page - 1); }

  function handleExportCSV() {
    const csv = driversToCSV(drivers);
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `drivers-page${page}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleToggleDisabled(driver: Driver) {
    const endpoint = driver.disabled
      ? `${API_URL}/api/admin/drivers/${driver.id}/enable`
      : `${API_URL}/api/admin/drivers/${driver.id}/disable`;
    try {
      setLoading(true);
      setError("");
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update driver");
      }
      const updated = await res.json();
      setDrivers(list =>
        list.map(d =>
          d.id === driver.id ? { ...d, disabled: updated.disabled } : d
        )
      );
    } catch (err: any) {
      setError(err.message || "Failed to update driver.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h2>Admin - Driver List</h2>
      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 16 }}>
        <input
          type="text"
          value={search}
          placeholder="Search name, phone, email..."
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ padding: 8, minWidth: 220 }}
        />
        <select value={online} onChange={e => { setOnline(e.target.value as any); setPage(1); }}>
          <option value="">Online (All)</option>
          <option value="true">Online</option>
          <option value="false">Offline</option>
        </select>
        <select value={vehicleType} onChange={e => { setVehicleType(e.target.value); setPage(1); }}>
          <option value="">Vehicle (All)</option>
          {vehicleTypes.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select value={country} onChange={e => { setCountry(e.target.value); setPage(1); }}>
          <option value="">Country (All)</option>
          {countries.map(c => (<option key={c} value={c}>{c}</option>))}
        </select>
        <select value={area} onChange={e => { setArea(e.target.value); setPage(1); }}>
          <option value="">Area (All)</option>
          {areas.map(a => (<option key={a} value={a}>{a}</option>))}
        </select>
        <button onClick={handleExportCSV}>Export CSV</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        {error && (
          <div style={{ color: "red", marginBottom: 12 }}>
            {error}
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{ borderBottom: "2px solid #1976D2", cursor: "pointer", padding: "7px 12px", background: "#e3eafc" }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortBy === col.key ? (order === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th style={{ borderBottom: "2px solid #1976D2", padding: "7px 12px", background: "#e3eafc" }}>Scheduled Ride</th>
              <th style={{ borderBottom: "2px solid #1976D2", padding: "7px 12px", background: "#e3eafc" }}>No Show Count</th>
              <th style={{ borderBottom: "2px solid #1976D2", padding: "7px 12px", background: "#e3eafc" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length + 3} style={{ textAlign: "center", padding: 30 }}>Loading...</td></tr>
            ) : drivers.length === 0 ? (
              <tr><td colSpan={columns.length + 3} style={{ textAlign: "center", padding: 30 }}>No drivers found.</td></tr>
            ) : (
              drivers.map(driver => (
                <tr key={driver.id} style={{ background: driver.disabled ? "#ffe0e0" : undefined }}>
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: "7px 12px", borderBottom: "1px solid #eee" }}>
                      {col.key === "vehicleType"
                        ? VEHICLE_TYPE_LABELS[(driver.vehicleType || "").toUpperCase()] || driver.vehicleType || "-"
                        : col.key === "online"
                        ? driver.online ? "Online" : "Offline"
                        : col.key === "subscriptionStatus"
                        ? (() => {
                            const status = getSubscriptionStatus(driver);
                            return (
                              <span style={{
                                padding: "3px 9px",
                                borderRadius: 12,
                                background: status.color === "#d32f2f" ? "#ffd6d6"
                                  : status.color === "#2e7d32" || status.color === "#388e3c" ? "#e0f8e4"
                                  : "#eee",
                                color: status.color,
                                fontWeight: 600,
                                fontSize: 13,
                              }}>
                                {status.text}
                              </span>
                            );
                          })()
                        : driver[col.key] ?? "-"}
                    </td>
                  ))}
                  <td style={{ padding: "7px 12px", borderBottom: "1px solid #eee", textAlign: "center" }}>
                    {scheduledRides[driver.id] ? (
                      <span>
                        {new Date(scheduledRides[driver.id]!.scheduledAt).toLocaleString()}<br />
                        Dest: {scheduledRides[driver.id]!.destLat}, {scheduledRides[driver.id]!.destLng}<br />
                        {scheduledRides[driver.id]!.vehicleType && <span>Vehicle: {scheduledRides[driver.id]!.vehicleType}</span>}
                        {scheduledRides[driver.id]!.status === "no_show" && <span style={{ color: "#f44336" }}>No Show</span>}
                      </span>
                    ) : "-"}
                  </td>
                  <td style={{ padding: "7px 12px", borderBottom: "1px solid #eee", textAlign: "center" }}>
                    {noShowCounts[driver.id] ?? 0}
                  </td>
                  <td style={{ padding: "7px 12px", borderBottom: "1px solid #eee", textAlign: "center" }}>
                    <button
                      style={{
                        padding: "6px 10px",
                        borderRadius: 4,
                        background: driver.disabled ? "#1976d2" : "#d32f2f",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                      }}
                      onClick={() => handleToggleDisabled(driver)}
                      disabled={loading}
                    >
                      {driver.disabled ? "Enable" : "Disable"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={prevPage} disabled={page <= 1}>Previous</button>
        <span>Page {page}</span>
        <button onClick={nextPage} disabled={drivers.length < DEFAULT_PAGE_SIZE}>Next</button>
        <span>{drivers.length} drivers shown</span>
      </div>
    </div>
  );
}